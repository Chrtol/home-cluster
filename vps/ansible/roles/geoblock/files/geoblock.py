#!/usr/bin/env python3
"""Drop inbound web and game traffic from outside the allowed countries.

  geoblock.py sync    download GeoLite2 Country, rebuild the ipset, cache it
  geoblock.py apply   load the set from the cache if needed, then the chain and its jump
  geoblock.py remove  take the chain and its jump out (the set is kept)

Every "keep what is there" path exits 0: a failed or implausible download never
touches the live set, and with no set at all nothing is blocked. Addresses and
credentials are never printed; the journal only sees counts.
"""

import base64
import csv
import dataclasses
import io
import os
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile

DOWNLOAD_URL = "https://download.maxmind.com/geoip/databases/GeoLite2-Country-CSV/download?suffix=zip"
BLOCKS_CSV = "GeoLite2-Country-Blocks-IPv4.csv"
LOCATIONS_CSV = "GeoLite2-Country-Locations-en.csv"
CACHE_FILE = "allow-v4.txt"


class DownloadError(Exception):
    pass


class DataError(Exception):
    pass


def _list(value):
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclasses.dataclass
class Config:
    account_id: str
    license_key: str
    allowed_continents: set
    allowed_countries: set
    denied_countries: set
    tcp_ports: list
    udp_ports: list
    min_networks: int
    state_dir: str
    set_name: str
    chain: str
    exempt_interfaces: list

    @classmethod
    def from_env(cls, env):
        return cls(
            account_id=env.get("MAXMIND_ACCOUNT_ID", ""),
            license_key=env.get("MAXMIND_LICENSE_KEY", ""),
            allowed_continents=set(_list(env["GEOBLOCK_ALLOWED_CONTINENTS"])),
            allowed_countries=set(_list(env["GEOBLOCK_ALLOWED_COUNTRIES"])),
            denied_countries=set(_list(env["GEOBLOCK_DENIED_COUNTRIES"])),
            tcp_ports=_list(env["GEOBLOCK_TCP_PORTS"]),
            udp_ports=_list(env["GEOBLOCK_UDP_PORTS"]),
            min_networks=int(env["GEOBLOCK_MIN_NETWORKS"]),
            state_dir=env["GEOBLOCK_STATE_DIR"],
            set_name=env["GEOBLOCK_SET"],
            chain=env["GEOBLOCK_CHAIN"],
            exempt_interfaces=_list(env["GEOBLOCK_EXEMPT_INTERFACES"]),
        )

    @property
    def cache_path(self):
        return os.path.join(self.state_dir, CACHE_FILE)


def log(message):
    print(message, flush=True)


def run(argv, stdin=None):
    return subprocess.run(argv, input=stdin, capture_output=True, text=True, check=False)


def download(cfg):
    if not cfg.account_id or not cfg.license_key:
        raise DownloadError("MaxMind credentials are not set")
    request = urllib.request.Request(DOWNLOAD_URL)
    token = base64.b64encode(f"{cfg.account_id}:{cfg.license_key}".encode()).decode()
    # Not forwarded on the redirect to the storage URL, which is presigned
    request.add_unredirected_header("Authorization", f"Basic {token}")
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        raise DownloadError(f"HTTP {exc.code}") from None


def _read_csv(archive, name):
    for member in archive.namelist():
        if os.path.basename(member) == name:
            with archive.open(member) as fh:
                return list(csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8")))
    raise DataError(f"{name} missing from the archive")


def allowed_networks(zip_bytes, cfg):
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
        locations = {row["geoname_id"]: row for row in _read_csv(archive, LOCATIONS_CSV)}
        blocks = _read_csv(archive, BLOCKS_CSV)

    allowed = []
    for block in blocks:
        location = locations.get(block["geoname_id"] or block["registered_country_geoname_id"])
        if location is None:
            continue
        country = location["country_iso_code"]
        if country in cfg.denied_countries:
            continue
        if location["continent_code"] in cfg.allowed_continents or country in cfg.allowed_countries:
            allowed.append(block["network"])
    return allowed


def _restore_input(set_name, networks):
    maxelem = max(65536, 2 * len(networks))
    lines = [f"create {set_name} hash:net family inet maxelem {maxelem} -exist", f"flush {set_name}"]
    lines += [f"add {set_name} {net}" for net in networks]
    return "\n".join(lines) + "\n"


def _write_cache(cfg, networks):
    os.makedirs(cfg.state_dir, exist_ok=True)
    tmp = cfg.cache_path + ".tmp"
    with open(tmp, "w") as fh:
        fh.write("\n".join(networks) + "\n")
    os.replace(tmp, cfg.cache_path)


def sync(cfg, run=run, download=download):
    try:
        networks = allowed_networks(download(cfg), cfg)
    except (DownloadError, DataError, OSError, zipfile.BadZipFile, KeyError, csv.Error) as exc:
        log(f"download or parse failed ({type(exc).__name__}: {exc}); keeping the current set")
        return 0

    if len(networks) < cfg.min_networks:
        log(f"only {len(networks)} allowed networks (minimum {cfg.min_networks}); keeping the current set")
        return 0

    staging = f"{cfg.set_name}-new"
    result = run(["ipset", "restore"], _restore_input(staging, networks))
    if result.returncode != 0:
        run(["ipset", "destroy", staging])
        log("ipset restore failed; the live set is unchanged")
        return 1

    # swap needs both sets to exist; an empty live set is fine, it is swapped out at once
    run(["ipset", "create", cfg.set_name, "hash:net", "family", "inet", "-exist"])
    if run(["ipset", "swap", staging, cfg.set_name]).returncode != 0:
        run(["ipset", "destroy", staging])
        log("ipset swap failed; the live set is unchanged")
        return 1
    run(["ipset", "destroy", staging])

    _write_cache(cfg, networks)
    log(f"loaded {len(networks)} allowed networks")
    return 0


def _load_cache(cfg):
    try:
        with open(cfg.cache_path) as fh:
            return [line.strip() for line in fh if line.strip()]
    except FileNotFoundError:
        return []


def _chain_rules(cfg):
    rules = [["-i", iface, "-j", "RETURN"] for iface in cfg.exempt_interfaces]
    rules.append(["-m", "conntrack", "--ctstate", "ESTABLISHED,RELATED", "-j", "RETURN"])
    for proto, ports in (("tcp", cfg.tcp_ports), ("udp", cfg.udp_ports)):
        if ports:
            rules.append([
                "-p", proto, "-m", "multiport", "--dports", ",".join(ports),
                "-m", "set", "!", "--match-set", cfg.set_name, "src", "-j", "DROP",
            ])
    return rules


def apply(cfg, run=run):
    if run(["ipset", "list", "-n", cfg.set_name]).returncode != 0:
        networks = _load_cache(cfg)
        if not networks:
            log("no set and no cache yet; leaving traffic unfiltered until the first sync")
            return 0
        if run(["ipset", "restore"], _restore_input(cfg.set_name, networks)).returncode != 0:
            log("could not load the set from the cache; leaving traffic unfiltered")
            return 1
        log(f"loaded {len(networks)} allowed networks from the cache")

    if run(["iptables", "-n", "-L", cfg.chain]).returncode != 0:
        run(["iptables", "-N", cfg.chain])
    run(["iptables", "-F", cfg.chain])
    for rule in _chain_rules(cfg):
        if run(["iptables", "-A", cfg.chain, *rule]).returncode != 0:
            log("could not build the chain; removing its jump so traffic is not half-filtered")
            remove(cfg, run)
            return 1

    if run(["iptables", "-C", "INPUT", "-j", cfg.chain]).returncode != 0:
        run(["iptables", "-I", "INPUT", "1", "-j", cfg.chain])
    log(f"{cfg.chain} active")
    return 0


def remove(cfg, run=run):
    # Bounded: a hand-added duplicate jump is the only way there is more than one
    for _ in range(5):
        if run(["iptables", "-D", "INPUT", "-j", cfg.chain]).returncode != 0:
            break
    run(["iptables", "-F", cfg.chain])
    run(["iptables", "-X", cfg.chain])
    log(f"{cfg.chain} removed")
    return 0


def main(argv):
    commands = {"sync": sync, "apply": apply, "remove": remove}
    if len(argv) != 2 or argv[1] not in commands:
        print(f"usage: {argv[0]} {{{'|'.join(commands)}}}", file=sys.stderr)
        return 2
    return commands[argv[1]](Config.from_env(os.environ))


if __name__ == "__main__":
    sys.exit(main(sys.argv))
