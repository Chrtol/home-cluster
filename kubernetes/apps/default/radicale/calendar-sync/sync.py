"""Copy calendars into Radicale for Holm, one way:

- every iCloud calendar that holds events -> Radicale user RADICALE_ICLOUD_USER
- every link in FEEDS ("Calendar name = https://link", split by ';' or lines)
                                          -> Radicale user RADICALE_LINKS_USER

Holm shows each Radicale user as its own account, with its own color. Both
Radicale users exist only for this copy: anything in them that the sources
no longer have is deleted. A source that can't be read is left as it was
rather than emptied.

Stdlib only: runs on the stock python image with nothing to install.
"""

import base64
import hashlib
import os
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError
from urllib.parse import quote, unquote, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen

ICLOUD = "https://caldav.icloud.com/"
NS = {"d": "DAV:", "c": "urn:ietf:params:xml:ns:caldav"}
MARK = "X-CALSYNC-HASH"
PRODID = "-//home-cluster//radicale-calendar-sync//EN"
TIMEOUT = 60
# Holm searches 30 days back to a year ahead; copy a little more than that.
WINDOW_PAST, WINDOW_AHEAD = timedelta(days=60), timedelta(days=400)


def log(msg):
    print(msg, flush=True)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


opener = build_opener(NoRedirect)


# ── CalDAV ────────────────────────────────────────────────────────


class Dav:
    """One CalDAV login. `allowed` decides where its password may be sent;
    redirects are followed by hand and checked against it."""

    def __init__(self, username, password, allowed):
        self.auth = "Basic " + base64.b64encode(f"{username}:{password}".encode()).decode()
        self.allowed = allowed

    def request(self, method, url, body=None, depth=None, ctype="application/xml; charset=utf-8"):
        for _ in range(5):
            if not self.allowed(url):
                raise RuntimeError(f"refusing to send credentials to {url}")
            headers = {"Authorization": self.auth}
            if body is not None:
                headers["Content-Type"] = ctype
            if depth is not None:
                headers["Depth"] = str(depth)
            data = body.encode() if isinstance(body, str) else body
            try:
                with opener.open(Request(url, data=data, method=method, headers=headers), timeout=TIMEOUT) as res:
                    return res.status, url, res.read()
            except HTTPError as e:
                if 300 <= e.code < 400 and e.headers.get("Location"):
                    url = urljoin(url, e.headers["Location"])
                    continue
                return e.code, url, e.read()
        raise RuntimeError("too many redirects")

    def multistatus(self, method, url, body, depth):
        status, base, data = self.request(method, url, body, depth)
        if status in (401, 403):
            raise RuntimeError(f"{method} {url}: login rejected ({status})")
        if status != 207:
            raise RuntimeError(f"{method} {url} answered {status}")
        return [(urljoin(base, r.findtext("d:href", namespaces=NS)), r) for r in ET.fromstring(data).findall("d:response", NS)]

    def propfind(self, url, props, depth):
        body = f'<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop>{props}</d:prop></d:propfind>'
        return self.multistatus("PROPFIND", url, body, depth)

    def home(self, root):
        """The URL's user -> principal -> calendar home."""
        principal = self.first_href(root, "d:current-user-principal")
        return self.first_href(principal, "c:calendar-home-set")

    def first_href(self, url, name):
        resps = self.propfind(url, f"<{name}/>", 0)
        el = prop(resps[0][1], f"{name}/d:href") if resps else None
        if el is None or not el.text:
            raise RuntimeError(f"{url} did not answer {name}")
        return urljoin(url, el.text.strip())

    def calendars(self, home):
        """href -> display name, for calendars that hold events (task-only
        lists, such as iCloud Reminders, are skipped)."""
        out = {}
        for href, r in self.propfind(home, "<d:resourcetype/><d:displayname/><c:supported-calendar-component-set/>", 1):
            rt = prop(r, "d:resourcetype")
            if rt is None or rt.find("c:calendar", NS) is None:
                continue
            comps = prop(r, "c:supported-calendar-component-set")
            if comps is not None and len(comps) and not any(c.get("name", "").upper() == "VEVENT" for c in comps):
                continue
            dn = prop(r, "d:displayname")
            out[href] = ((dn.text or "").strip() if dn is not None else "") or "Calendar"
        return out

    def events(self, cal, window=False):
        """href -> iCalendar text, for every event resource in a calendar."""
        rng = ""
        if window:
            now = datetime.now(timezone.utc)
            fmt = "%Y%m%dT%H%M%SZ"
            rng = f'<c:time-range start="{(now - WINDOW_PAST).strftime(fmt)}" end="{(now + WINDOW_AHEAD).strftime(fmt)}"/>'
        body = (
            '<?xml version="1.0" encoding="utf-8"?>'
            '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
            "<d:prop><c:calendar-data/></d:prop>"
            f'<c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">{rng}</c:comp-filter></c:comp-filter></c:filter>'
            "</c:calendar-query>"
        )
        out = {}
        for href, r in self.multistatus("REPORT", cal, body, 1):
            cd = prop(r, "c:calendar-data")
            if cd is not None and cd.text:
                out[href] = cd.text
        return out

    def create_calendar(self, url, name):
        body = (
            '<?xml version="1.0" encoding="utf-8"?>'
            '<c:mkcalendar xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:set><d:prop>'
            f"<d:displayname>{xml_text(name)}</d:displayname>"
            '<c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>'
            "</d:prop></d:set></c:mkcalendar>"
        )
        status, _, data = self.request("MKCALENDAR", url, body)
        if status != 201:
            raise RuntimeError(f"creating calendar {name!r} answered {status}: {data[:200]!r}")

    def rename(self, url, name):
        body = (
            '<?xml version="1.0" encoding="utf-8"?>'
            '<d:propertyupdate xmlns:d="DAV:"><d:set><d:prop>'
            f"<d:displayname>{xml_text(name)}</d:displayname>"
            "</d:prop></d:set></d:propertyupdate>"
        )
        self.multistatus("PROPPATCH", url, body, None)


def prop(resp, path):
    for ps in resp.findall("d:propstat", NS):
        if "200" in (ps.findtext("d:status", namespaces=NS) or ""):
            el = ps.find(f"d:prop/{path}", NS)
            if el is not None:
                return el
    return None


def xml_text(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def path_of(url):
    return unquote(urlsplit(url).path)


def same_origin(base):
    origin = urlsplit(base)[:2]
    return lambda url: urlsplit(url)[:2] == origin


def icloud_only(url):
    parts = urlsplit(url)
    return parts.scheme == "https" and (parts.hostname or "").endswith(".icloud.com")


def key(s):
    return hashlib.sha1(s.encode()).hexdigest()


# ── iCalendar ─────────────────────────────────────────────────────


def physical_lines(text):
    return [l for l in re.split(r"\r\n|\n|\r", text) if l]


def logical_lines(text):
    """(unfolded line, its physical lines), so output keeps the source's own
    line folding."""
    out = []
    for raw in physical_lines(text):
        if raw[:1] in (" ", "\t") and out:
            out[-1][0] += raw[1:]
            out[-1][1].append(raw)
        else:
            out.append([raw, [raw]])
    return out


def split_feed(text):
    """A feed's VTIMEZONEs, and its VEVENTs grouped by UID (a recurring
    series and its changed occurrences share one UID, so one resource).
    Alarms are dropped: a subscribed link doesn't ring, so its copy shouldn't."""
    timezones, events = [], {}
    block, kind, depth, in_alarm = [], None, 0, 0
    for line, raw in logical_lines(text):
        upper = line.upper()
        if kind is None:
            if upper in ("BEGIN:VTIMEZONE", "BEGIN:VEVENT"):
                kind, depth, block, uid = upper[6:], 1, list(raw), None
            continue
        if upper.startswith("BEGIN:"):
            depth += 1
            in_alarm += kind == "VEVENT" and upper == "BEGIN:VALARM"
        elif upper.startswith("END:"):
            depth -= 1
            if in_alarm and upper == "END:VALARM":
                in_alarm -= 1
                continue
        if in_alarm:
            continue
        if uid is None and depth == 1 and re.match(r"UID[:;]", line, re.I):
            uid = line.split(":", 1)[1].strip()
        block.extend(raw)
        if depth == 0:
            if kind == "VTIMEZONE":
                timezones.append(block)
            else:
                events.setdefault(uid or key("\n".join(block)), []).append(block)
            kind = None
    return timezones, events


def feed_resource(timezones, vevents):
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", f"PRODID:{PRODID}"]
    for block in timezones + vevents:
        lines += block
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


def marked(text):
    """The resource with a hash of its content in each VEVENT, so the next
    run can tell what changed without keeping state of its own."""
    lines = physical_lines(text)
    digest = hashlib.sha256("\n".join(lines).encode()).hexdigest()[:32]
    out = []
    for line in lines:
        if line.upper() == "END:VEVENT":
            out.append(f"{MARK}:{digest}")
        out.append(line)
    return ("\r\n".join(out) + "\r\n").encode(), digest


def fetch_feed(url):
    if url.lower().startswith("webcal://"):
        url = "https://" + url[len("webcal://"):]
    with urlopen(Request(url, headers={"User-Agent": "radicale-calendar-sync"}), timeout=TIMEOUT) as res:
        return res.read().decode("utf-8", errors="replace")


# ── Radicale side ─────────────────────────────────────────────────


class Target:
    """One Radicale user. Its calendars are named by a hash of their source,
    so a source keeps its calendar across renames."""

    def __init__(self, base, username, password):
        self.dav = Dav(username, password, same_origin(base))
        self.home = urljoin(base, f"{quote(username)}/")
        self.existing = self.dav.calendars(self.home)
        self.kept = set()

    def mirror(self, source_id, name, resources):
        """Make calendar `source_id` hold exactly `resources` (name -> text)."""
        url = urljoin(self.home, f"{key(source_id)[:16]}/")
        self.kept.add(path_of(url))
        current = {path_of(h): n for h, n in self.existing.items()}
        if path_of(url) not in current:
            self.dav.create_calendar(url, name)
            log(f"[{name}] created calendar")
        elif current[path_of(url)] != name:
            self.dav.rename(url, name)

        have = {}
        for href, text in self.dav.events(url).items():
            m = re.search(rf"^{MARK}:(\w+)", text.replace("\r\n ", "").replace("\n ", ""), re.M)
            have[path_of(href)] = m.group(1) if m else None

        added = changed = removed = failed = 0
        want = {}
        for rname, text in resources.items():
            href = urljoin(url, f"{rname}.ics")
            want[path_of(href)] = (href, *marked(text))
        for path, (href, body, digest) in want.items():
            if have.get(path) == digest:
                continue
            status, _, data = self.dav.request("PUT", href, body, ctype="text/calendar; charset=utf-8")
            if status in (200, 201, 204):
                changed += path in have
                added += path not in have
            else:
                failed += 1
                log(f"[{name}] PUT {path} answered {status}: {data[:200]!r}")
        for path in have.keys() - want.keys():
            status, _, _ = self.dav.request("DELETE", urljoin(url, path))
            if status in (200, 204, 404):
                removed += 1
            else:
                failed += 1
                log(f"[{name}] DELETE {path} answered {status}")
        log(f"[{name}] {len(want)} events: {added} added, {changed} changed, {removed} removed, {failed} failed")
        return failed == 0

    def keep(self, source_id):
        """A source that couldn't be read keeps its calendar as it is."""
        self.kept.add(path_of(urljoin(self.home, f"{key(source_id)[:16]}/")))

    def prune(self):
        for href, name in self.existing.items():
            if path_of(href) not in self.kept:
                status, _, _ = self.dav.request("DELETE", href)
                log(f"[{name}] source gone, calendar deleted ({status})")


# ── Sources ───────────────────────────────────────────────────────


def sync_icloud(target):
    dav = Dav(os.environ["ICLOUD_USERNAME"], os.environ["ICLOUD_APP_PASSWORD"], icloud_only)
    # Raises before anything is pruned if iCloud can't be listed.
    calendars = dav.calendars(dav.home(ICLOUD))
    ok = True
    for href, name in calendars.items():
        source_id = "icloud:" + path_of(href)
        try:
            resources = {key(path_of(h)): text for h, text in dav.events(href, window=True).items()}
            ok = target.mirror(source_id, name, resources) and ok
        except Exception as e:
            ok = False
            target.keep(source_id)
            log(f"[{name}] {e}")
    return ok


def parse_feeds(raw):
    """Entries split by newlines or ';', since 1Password text fields are one line."""
    feeds = []
    for n, line in enumerate(re.split(r"[\n;]", raw), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name, sep, url = line.partition("=")
        if not sep or not name.strip() or not url.strip():
            raise RuntimeError(f"FEEDS entry {n} is not 'Calendar name = https://link'")
        feeds.append((name.strip(), url.strip()))
    return feeds


def sync_feeds(target):
    ok = True
    for name, url in parse_feeds(os.environ["FEEDS"]):
        source_id = "feed:" + name
        try:
            timezones, events = split_feed(fetch_feed(url))
            if not events:
                raise RuntimeError("the link returned no events")
            resources = {key(uid): feed_resource(timezones, blocks) for uid, blocks in events.items()}
            ok = target.mirror(source_id, name, resources) and ok
        except Exception as e:
            ok = False
            target.keep(source_id)
            log(f"[{name}] left as it was: {e}")
    return ok


def main():
    base = os.environ["RADICALE_URL"].rstrip("/") + "/"
    ok = True
    for user_env, pass_env, sync in (
        ("RADICALE_ICLOUD_USER", "RADICALE_ICLOUD_PASSWORD", sync_icloud),
        ("RADICALE_LINKS_USER", "RADICALE_LINKS_PASSWORD", sync_feeds),
    ):
        # A source that fails to list raises before prune(); one calendar or
        # link that fails was kept, so prune() only removes sources that are gone.
        try:
            target = Target(base, os.environ[user_env], os.environ[pass_env])
            ok = sync(target) and ok
            target.prune()
        except Exception as e:
            ok = False
            log(f"[{os.environ[user_env]}] {e}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
