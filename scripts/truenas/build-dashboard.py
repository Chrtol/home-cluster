#!/usr/bin/env python3
"""Generate the TrueNAS Grafana dashboard JSON.

Written as a generator rather than hand-edited JSON because Grafana dashboard
JSON is verbose, repetitive and easy to corrupt by hand. Re-run to regenerate:

    ./scripts/truenas/build-dashboard.py

Every query here was verified against the live exporters before being included -
node-exporter (:9100) and process-exporter (:9256) on the NAS. The two community
TrueNAS dashboards (grafana.com 19661 and 12921) were NOT usable: 12921 is
InfluxDB-based, and 19661 expects truenas_* metrics from TrueNAS's collectd /
Graphite exporter, not the node_* metrics we collect. This is built from scratch
on the metrics we actually have.
"""
import json

DS = {"type": "prometheus", "uid": "prometheus"}
NODE = 'job="nas-node-exporter"'
PROC = 'job="nas-process-exporter"'
DATA_MOUNT = "/mnt/truenas/cf-nas"

_id = 0


def nid():
    global _id
    _id += 1
    return _id


def target(expr, legend="", instant=False):
    return {
        "datasource": DS,
        "editorMode": "code",
        "expr": expr,
        "legendFormat": legend or "__auto",
        "range": not instant,
        "instant": instant,
        "refId": "A",
    }


def stat(title, expr, unit, x, y, w=4, h=4, thresholds=None, legend="",
         text_size=None, mappings=None, color_mode="value", reverse=False):
    steps = [{"color": "green", "value": None}]
    if thresholds:
        for color, val in thresholds:
            steps.append({"color": color, "value": val})
    return {
        "id": nid(),
        "type": "stat",
        "title": title,
        "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "targets": [target(expr, legend, instant=True)],
        "options": {
            "colorMode": color_mode,
            "graphMode": "area",
            "justifyMode": "auto",
            "orientation": "auto",
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "textMode": "auto",
            **({"text": {"valueSize": text_size}} if text_size else {}),
        },
        "fieldConfig": {
            "defaults": {
                "unit": unit,
                "mappings": mappings or [],
                "color": {"mode": "thresholds"},
                "thresholds": {"mode": "absolute", "steps": steps},
            },
            "overrides": [],
        },
    }


def timeseries(title, targets, unit, x, y, w=12, h=8, desc="", stack=False,
               fill=10, thresholds=None, minv=None, maxv=None, legend_calcs=None):
    steps = [{"color": "green", "value": None}]
    if thresholds:
        for color, val in thresholds:
            steps.append({"color": color, "value": val})
    p = {
        "id": nid(),
        "type": "timeseries",
        "title": title,
        "description": desc,
        "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "targets": targets,
        "options": {
            "legend": {
                "calcs": legend_calcs or ["last", "max"],
                "displayMode": "table" if legend_calcs else "list",
                "placement": "bottom",
                "showLegend": True,
            },
            "tooltip": {"mode": "multi", "sort": "desc"},
        },
        "fieldConfig": {
            "defaults": {
                "unit": unit,
                "color": {"mode": "palette-classic"},
                "custom": {
                    "drawStyle": "line",
                    "lineInterpolation": "smooth",
                    "lineWidth": 2,
                    "fillOpacity": fill,
                    "gradientMode": "opacity",
                    "showPoints": "never",
                    "stacking": {"group": "A", "mode": "normal" if stack else "none"},
                    "axisPlacement": "auto",
                },
                "thresholds": {"mode": "absolute", "steps": steps},
                **({"min": minv} if minv is not None else {}),
                **({"max": maxv} if maxv is not None else {}),
            },
            "overrides": [],
        },
    }
    return p


def row(title, y, collapsed=False, panels=None):
    return {
        "id": nid(),
        "type": "row",
        "title": title,
        "gridPos": {"h": 1, "w": 24, "x": 0, "y": y},
        "collapsed": collapsed,
        "panels": panels or [],
    }


panels = []

# ---------------------------------------------------------------- health row
panels.append(row("Health", 0))

panels.append(stat(
    "NAS", f"up{{{NODE}}}", "short", 0, 1, w=3, h=4, color_mode="background",
    mappings=[{"type": "value", "options": {
        "0": {"text": "DOWN", "color": "red", "index": 0},
        "1": {"text": "UP", "color": "green", "index": 1}}}],
))
panels.append(stat(
    "Uptime", f"time() - node_boot_time_seconds{{{NODE}}}", "s", 3, 1, w=3, h=4,
))
panels.append(stat(
    "Web UI (nginx)",
    f'node_systemd_unit_state{{{NODE},name="nginx.service",state="active"}}',
    "short", 6, 1, w=3, h=4, color_mode="background",
    mappings=[{"type": "value", "options": {
        "0": {"text": "DOWN", "color": "red", "index": 0},
        "1": {"text": "UP", "color": "green", "index": 1}}}],
))
# Pool health: sum every non-online state. 0 = healthy.
panels.append(stat(
    "Pool Health", f'sum(node_zfs_zpool_state{{{NODE},state!="online"}})',
    "short", 9, 1, w=3, h=4, color_mode="background",
    thresholds=[("red", 1)],
    mappings=[{"type": "value", "options": {
        "0": {"text": "HEALTHY", "color": "green", "index": 0}}},
        {"type": "range", "options": {"from": 1, "to": 999,
                                      "result": {"text": "DEGRADED", "color": "red", "index": 1}}}],
))
panels.append(stat(
    "RAM Available",
    f"node_memory_MemAvailable_bytes{{{NODE}}}", "bytes", 12, 1, w=4, h=4,
    # Inverted: LOW available memory is bad. This is the condition that
    # OOM-killed nginx on 2026-07-13.
    thresholds=[("red", 0), ("orange", 1e9), ("green", 2e9)],
))
panels.append(stat(
    "Data Pool Free",
    f'node_filesystem_avail_bytes{{{NODE},mountpoint="{DATA_MOUNT}"}}',
    "bytes", 16, 1, w=4, h=4,
    thresholds=[("red", 0), ("orange", 2e12), ("green", 4e12)],
))
panels.append(stat(
    "Load (1m)", f"node_load1{{{NODE}}}", "short", 20, 1, w=4, h=4,
    thresholds=[("orange", 4), ("red", 8)],
))

# ------------------------------------------------------- middlewared row
panels.append(row("middlewared — the memory leak", 5))

panels.append(timeseries(
    "middlewared RSS — the leak",
    [
        target(f'namedprocess_namegroup_memory_bytes{{{PROC},groupname="middlewared",memtype="resident"}}',
               "middlewared RSS"),
        target("4e9", "warning threshold (4 GB)"),
        target("8e9", "critical threshold (8 GB)"),
    ],
    "bytes", 0, 6, w=16, h=9,
    desc=(
        "THE panel. middlewared leaks memory (~485 MB baseline). Left alone it "
        "reached 13.2 GB of 16 GB over 54 days and the kernel OOM-killed nginx "
        "(2026-07-13 03:07). A weekly cron restarts it Sunday 05:00 if it is over "
        "2 GB — expect a sawtooth. A straight climb through the thresholds means "
        "the restart is not keeping up."
    ),
    thresholds=[("orange", 4e9), ("red", 8e9)],
    legend_calcs=["last", "max", "mean"],
))

# Growth rate: the number that tells you if ~235 MB/day was right.
panels.append(timeseries(
    "middlewared growth rate (per day)",
    [target(
        f'deriv(namedprocess_namegroup_memory_bytes{{{PROC},groupname="middlewared",memtype="resident"}}[6h]) * 86400',
        "bytes/day")],
    "bytes", 16, 6, w=8, h=9,
    desc=(
        "Leak rate, extrapolated to bytes/day from a 6h window. The original "
        "estimate (~235 MB/day) was derived from a single before/after "
        "measurement, NOT an observed slope — this panel is the real answer. "
        "Sustained values well above ~235 MB/day mean the cron threshold and the "
        "8 GB alert need retuning."
    ),
    thresholds=[("orange", 5e8), ("red", 2e9)],
    fill=20,
))

panels.append(timeseries(
    "Top memory consumers",
    [target(
        f'topk(8, namedprocess_namegroup_memory_bytes{{{PROC},memtype="resident"}})',
        "{{groupname}}")],
    "bytes", 0, 15, w=12, h=8,
    desc="Which processes hold memory. middlewared should dominate.",
))

panels.append(timeseries(
    "Memory: available vs ARC",
    [
        target(f"node_memory_MemAvailable_bytes{{{NODE}}}", "available"),
        target(f"node_zfs_arc_size{{{NODE}}}", "ARC size"),
        target(f"node_zfs_arc_c_max{{{NODE}}}", "ARC cap (10 GB)"),
        target(
            f'namedprocess_namegroup_memory_bytes{{{PROC},groupname="middlewared",memtype="resident"}}',
            "middlewared"),
    ],
    "bytes", 12, 15, w=12, h=8,
    desc=(
        "The whole failure mode in one panel. There is NO SWAP on this box, so "
        "when available memory hits zero the kernel kills a service outright. "
        "ARC is capped at 10 GB (zfs_arc_max) precisely to reserve headroom the "
        "leak cannot take. Watch 'available' — if it trends toward zero, "
        "something is about to die."
    ),
    thresholds=[("red", 0)],
))

# --------------------------------------------------------------- ZFS row
panels.append(row("ZFS / ARC", 23))

panels.append(stat(
    "ARC Hit Rate",
    f"100 * node_zfs_arc_hits{{{NODE}}} / (node_zfs_arc_hits{{{NODE}}} + node_zfs_arc_misses{{{NODE}}})",
    "percent", 0, 24, w=4, h=5,
    thresholds=[("red", 0), ("orange", 80), ("green", 90)],
))
panels.append(stat(
    "L2ARC Hit Rate",
    f"100 * node_zfs_arc_l2_hits{{{NODE}}} / (node_zfs_arc_l2_hits{{{NODE}}} + node_zfs_arc_l2_misses{{{NODE}}})",
    "percent", 4, 24, w=4, h=5,
    thresholds=[("red", 0), ("orange", 50), ("green", 80)],
))
panels.append(stat(
    "L2ARC Size", f"node_zfs_arc_l2_size{{{NODE}}}", "bytes", 8, 24, w=4, h=5,
))
panels.append(stat(
    "ARC Size", f"node_zfs_arc_size{{{NODE}}}", "bytes", 12, 24, w=4, h=5,
))

panels.append(timeseries(
    "ARC hit rate over time",
    [target(
        f"100 * rate(node_zfs_arc_hits{{{NODE}}}[10m]) / "
        f"(rate(node_zfs_arc_hits{{{NODE}}}[10m]) + rate(node_zfs_arc_misses{{{NODE}}}[10m]))",
        "ARC hit %"),
     target(
        f"100 * rate(node_zfs_arc_l2_hits{{{NODE}}}[10m]) / "
        f"(rate(node_zfs_arc_l2_hits{{{NODE}}}[10m]) + rate(node_zfs_arc_l2_misses{{{NODE}}}[10m]))",
        "L2ARC hit %")],
    "percent", 16, 24, w=8, h=5, minv=0, maxv=100,
    desc=(
        "IS THE L2ARC WORTH IT? At time of writing ARC was at 98.5% hit rate "
        "while L2ARC managed only ~34% while caching 427 GB. L2ARC lookup headers "
        "consume RAM — on a 16 GB box that may be stealing from the ARC doing the "
        "real work. If L2ARC hit rate stays poor, consider removing the cache "
        "device (nvme1n1) and giving the RAM back to ARC."
    ),
))

# ------------------------------------------------------------ capacity row
panels.append(row("Capacity", 29))

panels.append(timeseries(
    "Data pool free space",
    [target(f'node_filesystem_avail_bytes{{{NODE},mountpoint="{DATA_MOUNT}"}}', "free"),
     target("4e12", "warning (4 TB)"),
     target("2e12", "critical (2 TB)")],
    "bytes", 0, 30, w=12, h=8,
    desc=(
        "ZFS is copy-on-write and needs free space to write ANYTHING, including "
        "deletes. Performance degrades past ~80% and it gets hard to recover past "
        "~95%. Alert thresholds are absolute free space, not percent."
    ),
    thresholds=[("red", 0), ("orange", 2e12), ("green", 4e12)],
))

panels.append(timeseries(
    "Disk temperatures",
    [target(f"node_hwmon_temp_celsius{{{NODE}}}", "{{chip}} {{sensor}}")],
    "celsius", 12, 30, w=12, h=8,
    desc="NVMe + drive temps. Sustained >50C on spinning disks shortens their life.",
    thresholds=[("orange", 50), ("red", 60)],
))

# --------------------------------------------------------------- system row
panels.append(row("System", 38))

panels.append(timeseries(
    "CPU usage",
    [target(
        f'100 - (avg(rate(node_cpu_seconds_total{{{NODE},mode="idle"}}[5m])) * 100)',
        "CPU %")],
    "percent", 0, 39, w=8, h=7, minv=0, maxv=100,
    thresholds=[("orange", 70), ("red", 90)],
))

panels.append(timeseries(
    "Network throughput",
    [target(
        f'rate(node_network_receive_bytes_total{{{NODE},device!~"lo|veth.*|docker.*|br-.*"}}[5m])',
        "rx {{device}}"),
     target(
        f'rate(node_network_transmit_bytes_total{{{NODE},device!~"lo|veth.*|docker.*|br-.*"}}[5m])',
        "tx {{device}}")],
    "Bps", 8, 39, w=8, h=7,
    desc="NFS traffic to the cluster shows up here.",
))

panels.append(timeseries(
    "Disk I/O utilisation",
    [target(
        f'rate(node_disk_io_time_seconds_total{{{NODE},device!~"loop.*|dm-.*"}}[5m]) * 100',
        "{{device}}")],
    "percent", 16, 39, w=8, h=7,
    desc="Percent of time each disk was busy. Sustained 100% means the disk is the bottleneck.",
    thresholds=[("orange", 80)],
))

dashboard = {
    "uid": "truenas-nas",
    "title": "TrueNAS",
    "description": (
        "TrueNAS host + middlewared memory leak monitoring. Built on node-exporter "
        "and process-exporter running on the NAS as a TrueNAS Custom App. "
        "Deployed by scripts/truenas/setup-exporters.sh."
    ),
    "tags": ["truenas", "nas", "storage"],
    "timezone": "browser",
    "editable": True,
    "graphTooltip": 1,  # shared crosshair
    "time": {"from": "now-24h", "to": "now"},
    "refresh": "1m",
    "schemaVersion": 39,
    "panels": panels,
    "templating": {"list": []},
    "annotations": {"list": []},
}

OUT = "kubernetes/apps/observability/exporters/nas/dashboard/nas-dashboard.json"
with open(OUT, "w") as f:
    json.dump(dashboard, f, indent=2)
    f.write("\n")

print(f"wrote {OUT}")
print(f"  panels: {sum(1 for p in panels if p['type'] != 'row')}")
print(f"  rows:   {sum(1 for p in panels if p['type'] == 'row')}")
