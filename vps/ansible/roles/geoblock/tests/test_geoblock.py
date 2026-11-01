import io
import os
import subprocess
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "files"))
import geoblock  # noqa: E402

LOCATIONS = """geoname_id,locale_code,continent_code,continent_name,country_iso_code,country_name,is_in_european_union
2921044,en,EU,Europe,DE,Germany,1
3144096,en,EU,Europe,NO,Norway,0
2661886,en,EU,Europe,SE,Sweden,1
6252001,en,NA,"North America",US,"United States",0
2017370,en,EU,Europe,RU,Russia,0
630336,en,EU,Europe,BY,Belarus,0
1814991,en,AS,Asia,CN,China,0
298795,en,AS,Asia,TR,Turkey,0
6255148,en,EU,Europe,,,0
"""

BLOCKS = """network,geoname_id,registered_country_geoname_id,represented_country_geoname_id,is_anonymous_proxy,is_satellite_provider,is_anycast
198.51.100.0/28,2921044,2921044,,0,0,
198.51.100.16/28,3144096,3144096,,0,0,
198.51.100.32/28,6252001,6252001,,0,0,
198.51.100.48/28,2017370,2017370,,0,0,
198.51.100.64/28,630336,630336,,0,0,
198.51.100.80/28,1814991,1814991,,0,0,
198.51.100.96/28,298795,298795,,0,0,
198.51.100.112/28,,2661886,,0,0,
198.51.100.128/28,,,,1,0,
198.51.100.144/28,6255148,,,0,0,
198.51.100.160/28,2921044,2017370,,0,0,
"""

ALLOWED = [
    "198.51.100.0/28",    # DE
    "198.51.100.16/28",   # NO
    "198.51.100.32/28",   # US
    "198.51.100.112/28",  # SE via registered country
    "198.51.100.144/28",  # continent-level Europe, no country
    "198.51.100.160/28",  # DE located, RU registered: the location decides
]


def make_zip(blocks=BLOCKS, locations=LOCATIONS):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("GeoLite2-Country-CSV_20261030/GeoLite2-Country-Blocks-IPv4.csv", blocks)
        zf.writestr("GeoLite2-Country-CSV_20261030/GeoLite2-Country-Locations-en.csv", locations)
        zf.writestr("GeoLite2-Country-CSV_20261030/LICENSE.txt", "x")
    return buf.getvalue()


class FakeRunner:
    """Records argv; answers by the first matching prefix in `rc`."""

    def __init__(self, rc=None):
        self.calls = []
        self.rc = rc or {}

    def __call__(self, argv, stdin=None):
        self.calls.append((list(argv), stdin))
        code = 0
        for prefix, value in self.rc.items():
            if tuple(argv[: len(prefix)]) == prefix:
                code = value
                break
        return subprocess.CompletedProcess(argv, code, "", "")

    def argvs(self):
        return [c[0] for c in self.calls]


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.cfg = geoblock.Config(
            account_id="1",
            license_key="k",
            allowed_continents={"EU"},
            allowed_countries={"US"},
            denied_countries={"RU", "BY"},
            tcp_ports=["80", "443"],
            udp_ports=["443", "19132"],
            min_networks=3,
            state_dir=self.tmp.name,
            set_name="geo-allow-v4",
            chain="GEOBLOCK",
            exempt_interfaces=["lo", "wg0"],
        )
        self.cache = os.path.join(self.tmp.name, "allow-v4.txt")


class TestFilter(Base):
    def test_filter_allows_eu_and_us_minus_ru_by(self):
        allowed = geoblock.allowed_networks(make_zip(), self.cfg)
        self.assertEqual(sorted(allowed), sorted(ALLOWED))

    def test_registered_country_fallback(self):
        self.assertIn("198.51.100.112/28", geoblock.allowed_networks(make_zip(), self.cfg))

    def test_unmapped_network_dropped(self):
        self.assertNotIn("198.51.100.128/28", geoblock.allowed_networks(make_zip(), self.cfg))

    def test_missing_csv_raises(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("x/GeoLite2-Country-Locations-en.csv", LOCATIONS)
        with self.assertRaises(geoblock.DataError):
            geoblock.allowed_networks(buf.getvalue(), self.cfg)


class TestSync(Base):
    def test_tiny_result_refused(self):
        self.cfg.min_networks = 100
        run = FakeRunner()
        rc = geoblock.sync(self.cfg, run, lambda cfg: make_zip())
        self.assertEqual(rc, 0)
        self.assertFalse(any(a[:2] == ["ipset", "swap"] for a in run.argvs()))
        self.assertFalse(os.path.exists(self.cache))

    def test_download_failure_keeps_set(self):
        for exc in (geoblock.DownloadError("HTTP 401"), OSError("network down")):
            run = FakeRunner()

            def fail(cfg, exc=exc):
                raise exc

            self.assertEqual(geoblock.sync(self.cfg, run, fail), 0)
            self.assertEqual(run.calls, [])

    def test_corrupt_zip_keeps_set(self):
        run = FakeRunner()
        self.assertEqual(geoblock.sync(self.cfg, run, lambda cfg: b"PK\x03\x04trunc"), 0)
        self.assertEqual(run.calls, [])

    def test_swap_then_cache(self):
        events = []
        run = FakeRunner()
        orig = run.__call__

        def recording(argv, stdin=None):
            events.append(("run", argv[:2], os.path.exists(self.cache)))
            return orig(argv, stdin)

        rc = geoblock.sync(self.cfg, recording, lambda cfg: make_zip())
        self.assertEqual(rc, 0)
        argvs = [a for a, _ in run.calls]
        restore = [i for i, a in enumerate(argvs) if a[:2] == ["ipset", "restore"]]
        swap = [i for i, a in enumerate(argvs) if a[:2] == ["ipset", "swap"]]
        destroy = [i for i, a in enumerate(argvs) if a[:2] == ["ipset", "destroy"]]
        self.assertTrue(restore and swap and destroy)
        self.assertLess(restore[0], swap[0])
        self.assertLess(swap[0], destroy[0])
        self.assertEqual(argvs[swap[0]][2:], ["geo-allow-v4-new", "geo-allow-v4"])
        restore_input = run.calls[restore[0]][1]
        self.assertIn("create geo-allow-v4-new hash:net family inet", restore_input)
        for net in ALLOWED:
            self.assertIn(f"add geo-allow-v4-new {net}\n", restore_input)
        self.assertNotIn("198.51.100.48/28", restore_input)
        # the cache did not exist at the swap and does now
        self.assertFalse([e for e in events if e[1] == ["ipset", "swap"]][0][2])
        with open(self.cache) as fh:
            self.assertEqual(sorted(fh.read().split()), sorted(ALLOWED))

    def test_restore_failure_leaves_live_set(self):
        run = FakeRunner(rc={("ipset", "restore"): 1})
        rc = geoblock.sync(self.cfg, run, lambda cfg: make_zip())
        self.assertNotEqual(rc, 0)
        self.assertFalse(any(a[:2] == ["ipset", "swap"] for a in run.argvs()))
        self.assertFalse(os.path.exists(self.cache))


class TestApply(Base):
    def write_cache(self):
        with open(self.cache, "w") as fh:
            fh.write("\n".join(ALLOWED) + "\n")

    def chain_rules(self, run):
        return [a for a in run.argvs() if a[:3] == ["iptables", "-A", "GEOBLOCK"]]

    def test_rules_skip_tunnel_and_loopback(self):
        self.write_cache()
        run = FakeRunner(rc={("iptables", "-C"): 1})
        self.assertEqual(geoblock.apply(self.cfg, run), 0)
        rules = self.chain_rules(run)
        text = [" ".join(r) for r in rules]
        drops = [i for i, r in enumerate(text) if r.endswith("-j DROP")]
        lo = text.index("iptables -A GEOBLOCK -i lo -j RETURN")
        wg = text.index("iptables -A GEOBLOCK -i wg0 -j RETURN")
        self.assertEqual(len(drops), 2)
        self.assertLess(max(lo, wg), min(drops))
        self.assertTrue(all("51820" not in r for r in text))
        self.assertIn("-p tcp -m multiport --dports 80,443 -m set ! --match-set geo-allow-v4 src -j DROP", text[drops[0]])
        self.assertIn("-p udp -m multiport --dports 443,19132 -m set ! --match-set geo-allow-v4 src -j DROP", text[drops[1]])

    def test_missing_cache_inserts_no_jump(self):
        run = FakeRunner(rc={("ipset", "list"): 1, ("iptables", "-C"): 1})
        self.assertEqual(geoblock.apply(self.cfg, run), 0)
        self.assertFalse(any(a[:3] == ["iptables", "-I", "INPUT"] for a in run.argvs()))
        self.assertFalse(self.chain_rules(run))

    def test_set_loaded_from_cache_when_absent(self):
        self.write_cache()
        run = FakeRunner(rc={("ipset", "list"): 1, ("iptables", "-C"): 1})
        self.assertEqual(geoblock.apply(self.cfg, run), 0)
        restores = [s for a, s in run.calls if a[:2] == ["ipset", "restore"]]
        self.assertEqual(len(restores), 1)
        self.assertIn("create geo-allow-v4 hash:net family inet", restores[0])
        self.assertIn(["iptables", "-I", "INPUT", "1", "-j", "GEOBLOCK"], run.argvs())

    def test_jump_inserted_once(self):
        self.write_cache()
        run = FakeRunner()
        self.assertEqual(geoblock.apply(self.cfg, run), 0)
        self.assertFalse(any(a[:3] == ["iptables", "-I", "INPUT"] for a in run.argvs()))

    def test_remove_drops_jump_and_chain(self):
        run = FakeRunner()
        self.assertEqual(geoblock.remove(self.cfg, run), 0)
        argvs = run.argvs()
        self.assertIn(["iptables", "-D", "INPUT", "-j", "GEOBLOCK"], argvs)
        self.assertIn(["iptables", "-X", "GEOBLOCK"], argvs)


class TestConfig(unittest.TestCase):
    def test_from_env(self):
        cfg = geoblock.Config.from_env({
            "MAXMIND_ACCOUNT_ID": "1",
            "MAXMIND_LICENSE_KEY": "k",
            "GEOBLOCK_ALLOWED_CONTINENTS": "EU",
            "GEOBLOCK_ALLOWED_COUNTRIES": "US",
            "GEOBLOCK_DENIED_COUNTRIES": "RU,BY",
            "GEOBLOCK_TCP_PORTS": "80,443",
            "GEOBLOCK_UDP_PORTS": "443",
            "GEOBLOCK_MIN_NETWORKS": "50000",
            "GEOBLOCK_STATE_DIR": "/var/lib/geoblock",
            "GEOBLOCK_SET": "geo-allow-v4",
            "GEOBLOCK_CHAIN": "GEOBLOCK",
            "GEOBLOCK_EXEMPT_INTERFACES": "lo,wg0",
        })
        self.assertEqual(cfg.denied_countries, {"RU", "BY"})
        self.assertEqual(cfg.udp_ports, ["443"])
        self.assertEqual(cfg.min_networks, 50000)


if __name__ == "__main__":
    unittest.main()
