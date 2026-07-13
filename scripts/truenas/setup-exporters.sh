#!/usr/bin/env bash
# Deploy node-exporter + process-exporter on the NAS as a TrueNAS Custom App.
#
# Runs as truenas_admin + sudo (root SSH is disabled on TrueNAS by default).
# You will be prompted for the truenas_admin password once.
#
# Prereq: the Apps pool must be configured (Apps -> Configuration -> Choose Pool).
#
# The process-exporter config lives on a pool dataset, NOT in /etc or /root:
# SCALE boots a fresh root dataset on upgrade, so anything on the root filesystem
# is silently wiped by the next update. The app itself is stored in the TrueNAS
# config DB, which survives upgrades.
#
# Idempotent: re-running redeploys the app in place.
#
# Usage: ./setup-exporters.sh [user@host]
set -Eeuo pipefail

readonly NAS="${1:-truenas_admin@nas.${SECRET_DOMAIN:?SECRET_DOMAIN must be set}}"
readonly APP_NAME="exporters"
readonly CONFIG_DIR="/mnt/truenas/ix-apps-config/process-exporter"

readonly HERE="$(dirname "$(readlink -f "$0")")/exporters"
readonly COMPOSE="${HERE}/docker-compose.yml"
readonly PROC_CFG="${HERE}/process-exporter.yml"

readonly STAGE_COMPOSE="/tmp/exporters-compose.$$.yml"
readonly STAGE_PROC="/tmp/process-exporter.$$.yml"
readonly REMOTE_RUNNER="/tmp/setup-exporters.$$.sh"

log() { printf '\033[1;32m%s\033[0m\n' "$*"; }

for f in "${COMPOSE}" "${PROC_CFG}"; do
    [[ -f "${f}" ]] || { echo "missing ${f}" >&2; exit 1; }
done

log "Staging exporter config on ${NAS}"
scp -q "${COMPOSE}" "${NAS}:${STAGE_COMPOSE}"
scp -q "${PROC_CFG}" "${NAS}:${STAGE_PROC}"

remote_script="$(
    cat <<REMOTE
set -Eeuo pipefail
export PATH="\$PATH:/usr/sbin:/sbin"

sudo -v

# Config lives on the pool so a SCALE upgrade cannot wipe it.
sudo mkdir -p '${CONFIG_DIR}'
sudo install -m 644 '${STAGE_PROC}' '${CONFIG_DIR}/process-exporter.yml'
rm -f '${STAGE_PROC}'
echo "  installed ${CONFIG_DIR}/process-exporter.yml"

compose=\$(cat '${STAGE_COMPOSE}')
rm -f '${STAGE_COMPOSE}'

payload=\$(python3 -c '
import json, os, sys
print(json.dumps({
    "app_name": "${APP_NAME}",
    "custom_app": True,
    "custom_compose_config_string": sys.stdin.read(),
}))' <<<"\${compose}")

if sudo midclt call app.query '[["name","=","${APP_NAME}"]]' | python3 -c 'import sys,json; sys.exit(0 if json.load(sys.stdin) else 1)'; then
    echo "  app '${APP_NAME}' exists - redeploying"
    update=\$(python3 -c '
import json, sys
print(json.dumps({"custom_compose_config_string": sys.stdin.read()}))' <<<"\${compose}")
    sudo midclt call --job app.update '${APP_NAME}' "\${update}" >/dev/null
else
    echo "  creating app '${APP_NAME}'"
    sudo midclt call --job app.create "\${payload}" >/dev/null
fi

echo "  waiting for containers..."
for i in \$(seq 1 30); do
    sleep 2
    if curl -sf -m 3 http://127.0.0.1:9100/metrics >/dev/null 2>&1 \
       && curl -sf -m 3 http://127.0.0.1:9256/metrics >/dev/null 2>&1; then
        echo "  both exporters responding"
        break
    fi
done

echo
echo "  === verification ==="
echo -n "  node-exporter (9100):    "
curl -sf -m 5 http://127.0.0.1:9100/metrics >/dev/null 2>&1 && echo "OK" || echo "NOT RESPONDING"
echo -n "  process-exporter (9256): "
curl -sf -m 5 http://127.0.0.1:9256/metrics >/dev/null 2>&1 && echo "OK" || echo "NOT RESPONDING"

# The whole point: does middlewared report a PLAUSIBLE RSS?
#
# Checking mere presence is not enough - it previously exported the group with a
# memory value of 0 (unprivileged container could not read another user's
# /proc/PID/status), which looked "OK" while monitoring nothing. Assert a sane
# floor instead: baseline RSS is ~485 MB, so anything under 100 MB is broken.
# NOTE on the greps below: metric values are in scientific notation
# (7.59488512e+08), which bash arithmetic cannot parse - hence python for the
# numbers. And memtype has five values, of which "proportionalResident" sorts
# BEFORE "resident" and is legitimately 0 (PSS needs smaps_rollup access we do
# not have). A loose grep + head -1 silently picks the 0 and reports a false
# failure. Match memtype="resident" exactly.
echo -n "  middlewared RSS:         "
curl -sf -m 5 http://127.0.0.1:9256/metrics 2>/dev/null | python3 -c '
import re, sys
m = re.search(r"^namedprocess_namegroup_memory_bytes\{groupname=\"middlewared\",memtype=\"resident\"\} (\S+)", sys.stdin.read(), re.M)
if not m:
    print("MISSING - alert would never fire! check the process-exporter config")
else:
    mib = float(m.group(1)) / 1024 / 1024
    # Baseline is ~485 MB; anything under 100 MiB means we are reading the wrong
    # thing or lack permission to read /proc/PID/status.
    print(f"BROKEN - {mib:.0f} MiB, expected >100 (permissions?)" if mib < 100 else f"OK - {mib:.0f} MiB")
'

# Prove node-exporter sees the HOST, not the container, by asserting the
# collectors actually succeeded rather than grepping for metric names.
metrics=\$(curl -sf -m 5 http://127.0.0.1:9100/metrics 2>/dev/null)

echo -n "  systemd collector:       "
echo "\${metrics}" | python3 -c '
import re, sys
m = re.search(r"^node_scrape_collector_success\{collector=\"systemd\"\} 1", sys.stdin.read(), re.M)
print("OK" if m else "FAILED - NASWebUIDown alert will not work")
'

echo -n "  zfs collector / ARC cap: "
echo "\${metrics}" | python3 -c '
import re, sys
d = sys.stdin.read()
ok = re.search(r"^node_scrape_collector_success\{collector=\"zfs\"\} 1", d, re.M)
arc = re.search(r"^node_zfs_arc_c_max (\S+)", d, re.M)
if ok and arc:
    print(f"OK - {float(arc.group(1)) / 1024**3:.0f} GB")
else:
    print("FAILED - no ARC metrics")
'
REMOTE
)"

log "Deploying exporters (sudo password required)"
printf '%s' "${remote_script}" | ssh "${NAS}" "cat > '${REMOTE_RUNNER}'"
ssh -t "${NAS}" "bash '${REMOTE_RUNNER}'; rc=\$?; rm -f '${REMOTE_RUNNER}'; exit \$rc"

log "Done. Prometheus will pick these up via the nas-*-exporter ScrapeConfigs."
