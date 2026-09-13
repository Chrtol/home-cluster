"""Prometheus exporter that runs speedtest-go on every scrape.

speedtest-go tests against the same Ookla servers as the official CLI but finds
them through www.speedtest.net/api/js/servers, not cli.speedtest.net's config
API, which has been returning intermittent 503s.

Metric names and semantics match MiguelNdeCarvalho/speedtest-exporter so the
dashboard and alerts carry over: a failed test reports speedtest_up 0 and 0 for
every measurement.
"""

import json
import logging
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BINARY = os.environ.get("SPEEDTEST_GO_BINARY", "/opt/speedtest-go/speedtest-go")
EXTRA_ARGS = os.environ.get("SPEEDTEST_GO_ARGS", "").split()
ATTEMPTS = int(os.environ.get("SPEEDTEST_RETRY_ATTEMPTS", "3"))
DELAY = float(os.environ.get("SPEEDTEST_RETRY_DELAY_SECONDS", "10"))
# All attempts must finish inside Prometheus' scrapeTimeout, or the scrape
# itself fails and records up=0 instead of speedtest_up=0.
BUDGET = float(os.environ.get("SPEEDTEST_TIMEOUT", "110"))
PORT = int(os.environ.get("SPEEDTEST_PORT", "9798"))

METRICS = [
    ("speedtest_server_id", "Speedtest server ID used to test"),
    ("speedtest_jitter_latency_milliseconds", "Speedtest current Jitter in ms"),
    ("speedtest_ping_latency_milliseconds", "Speedtest current Ping in ms"),
    ("speedtest_download_bits_per_second", "Speedtest current Download Speed in bit/s"),
    ("speedtest_upload_bits_per_second", "Speedtest current Upload speed in bits/s"),
    ("speedtest_up", "Speedtest status whether the scrape worked"),
]
FAILED = {name: 0 for name, _ in METRICS}

logging.basicConfig(level=logging.INFO, format="level=%(levelname)s datetime=%(asctime)s %(message)s")
log = logging.getLogger("speedtest-exporter")
# Two concurrent tests would share the line and both read low.
test_lock = threading.Lock()


def run_once(timeout):
    proc = subprocess.run([BINARY, "--json", *EXTRA_ARGS], capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(f"exit {proc.returncode}: {proc.stderr.strip()[-300:]}")
    # An unknown or unreachable server can still exit 0, with "servers": null.
    servers = json.loads(proc.stdout).get("servers") or []
    if not servers:
        raise RuntimeError("no server was tested")
    s = servers[0]
    if not s.get("dl_speed") or not s.get("ul_speed"):
        raise RuntimeError(f"server {s.get('id')} returned no throughput")
    return {
        "speedtest_server_id": int(s["id"]),
        # latency and jitter are Go durations (nanoseconds); speeds are bytes/s
        "speedtest_jitter_latency_milliseconds": s["jitter"] / 1e6,
        "speedtest_ping_latency_milliseconds": s["latency"] / 1e6,
        "speedtest_download_bits_per_second": s["dl_speed"] * 8,
        "speedtest_upload_bits_per_second": s["ul_speed"] * 8,
        "speedtest_up": 1,
    }


def measure():
    deadline = time.monotonic() + BUDGET
    for attempt in range(1, ATTEMPTS + 1):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        try:
            return run_once(remaining)
        except (RuntimeError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired) as err:
            log.warning("attempt %d/%d failed: %s", attempt, ATTEMPTS, err)
        if attempt < ATTEMPTS:
            time.sleep(max(0.0, min(DELAY, deadline - time.monotonic())))
    log.error("all attempts failed, reporting speedtest_up 0")
    return FAILED


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] != "/metrics":
            self._send(b"ok\n", "text/plain")
            return
        with test_lock:
            v = measure()
        log.info(
            "Server=%s Jitter=%.3fms Ping=%.3fms Download=%.2fMbps Upload=%.2fMbps",
            v["speedtest_server_id"],
            v["speedtest_jitter_latency_milliseconds"],
            v["speedtest_ping_latency_milliseconds"],
            v["speedtest_download_bits_per_second"] / 1e6,
            v["speedtest_upload_bits_per_second"] / 1e6,
        )
        body = "".join(f"# HELP {n} {h}\n# TYPE {n} gauge\n{n} {v[n]}\n" for n, h in METRICS)
        self._send(body.encode(), "text/plain; version=0.0.4; charset=utf-8")

    def _send(self, body, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    log.info("Starting speedtest-exporter on :%d using %s", PORT, BINARY)
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()
