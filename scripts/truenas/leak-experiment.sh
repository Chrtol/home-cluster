#!/usr/bin/env bash
# Test whether middlewared's memory leak tracks open TrueNAS web-UI sessions.
#
# Hypothesis (from community reports, and consistent with our own 2026-07-13 data):
# middlewared RSS grows only while a browser tab holds the TrueNAS UI open - the
# dashboard streams realtime stats over a WebSocket - and goes flat when closed.
# Our box grew 485 -> 729 MiB while the UI was in use, then DROPPED to 519 MiB
# once the session ended. A monotonic leak does not do that.
#
# Usage:
#   ./leak-experiment.sh mark baseline    # start a phase with NO UI tabs open
#   ./leak-experiment.sh mark ui-open     # start a phase with the dashboard open
#   ./leak-experiment.sh status           # current RSS + websocket clients
#   ./leak-experiment.sh compare          # slope of each phase, side by side
#
# Run each phase for >= 24h. Prediction if the hypothesis holds: baseline is
# near-flat, ui-open shows a clear positive slope with ~25-30 min steps.
set -Eeuo pipefail

readonly KUBECONFIG_PATH="${KUBECONFIG:-$HOME/Homelab/github/chrtol/home-cluster/kubeconfig}"
readonly PROM_POD="prometheus-kube-prometheus-stack-0"
readonly PROM_NS="observability"
readonly STATE="${HOME}/.cache/truenas-leak-experiment.json"
readonly METRIC='namedprocess_namegroup_memory_bytes{groupname="middlewared",memtype="resident"}'

export KUBECONFIG="${KUBECONFIG_PATH}"

promql() {
    local q="$1" path="${2:-query}" extra="${3:-}"
    local enc
    enc="$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "${q}")"
    kubectl exec -n "${PROM_NS}" "${PROM_POD}" -c prometheus -- \
        wget -qO- "http://localhost:9090/api/v1/${path}?query=${enc}${extra}" 2>/dev/null
}

cmd_status() {
    echo "=== middlewared right now ==="
    promql "${METRIC}" | python3 -c '
import sys, json
d = json.load(sys.stdin)
r = d["data"]["result"]
if not r:
    print("  no data - is process-exporter up?")
else:
    mib = float(r[0]["value"][1]) / 1024 / 1024
    print("  RSS: %.0f MiB" % mib)
'
    # A 6h deriv extrapolated to a day - the same query the dashboard uses.
    promql "deriv(${METRIC}[6h]) * 86400" | python3 -c '
import sys, json
d = json.load(sys.stdin)
r = d["data"]["result"]
if r:
    mb = float(r[0]["value"][1]) / 1024 / 1024
    print("  growth: %+.0f MiB/day (6h window)" % mb)
'
    echo
    echo "=== phases marked so far ==="
    [[ -f "${STATE}" ]] && python3 -c '
import json, datetime, sys
for p in json.load(open(sys.argv[1])):
    t = datetime.datetime.fromtimestamp(p["ts"]).strftime("%Y-%m-%d %H:%M")
    print("  %s  %s" % (t, p["name"]))
' "${STATE}" || echo "  (none - run: $0 mark baseline)"
}

cmd_mark() {
    local name="${1:?usage: $0 mark <phase-name>}"
    local now
    now="$(date +%s)"
    mkdir -p "$(dirname "${STATE}")"
    [[ -f "${STATE}" ]] || echo '[]' > "${STATE}"
    python3 - "${STATE}" "${name}" "${now}" <<'PY'
import json, sys
path, name, ts = sys.argv[1], sys.argv[2], int(sys.argv[3])
phases = json.load(open(path))
phases.append({"name": name, "ts": ts})
json.dump(phases, open(path, "w"), indent=2)
PY
    echo "marked phase '${name}' at $(date -d "@${now}" '+%Y-%m-%d %H:%M')"
    echo
    case "${name}" in
        baseline) echo "  -> Close ALL TrueNAS web UI tabs. Leave it alone >= 24h." ;;
        ui-open)  echo "  -> Open the TrueNAS dashboard in a tab and LEAVE IT OPEN >= 24h." ;;
    esac
}

cmd_compare() {
    [[ -f "${STATE}" ]] || { echo "no phases marked yet"; exit 1; }
    echo "=== slope per phase ==="
    echo
    python3 - "${STATE}" <<'PY' > /tmp/leak-phases.txt
import json, sys, datetime
phases = json.load(open(sys.argv[1]))
now = int(datetime.datetime.now().timestamp())
for i, p in enumerate(phases):
    end = phases[i + 1]["ts"] if i + 1 < len(phases) else now
    if end - p["ts"] < 1800:
        continue
    print(f'{p["name"]}\t{p["ts"]}\t{end}')
PY
    while IFS=$'\t' read -r name start end; do
        hours=$(( (end - start) / 3600 ))
        # Linear regression over the phase window: bytes/day.
        slope="$(promql "deriv(${METRIC}[${hours}h])" "query" "&time=${end}" \
            | python3 -c '
import sys, json
d = json.load(sys.stdin)
r = d["data"]["result"]
print(float(r[0]["value"][1]) * 86400 / 1024 / 1024 if r else 0)
' 2>/dev/null || echo 0)"
        printf "  %-12s  %3dh window   %+8.0f MiB/day\n" "${name}" "${hours}" "${slope}"
    done < /tmp/leak-phases.txt
    echo
    echo "  If 'ui-open' is materially steeper than 'baseline', the hypothesis holds:"
    echo "  the leak is driven by open web-UI WebSocket sessions, not by uptime."
}

case "${1:-status}" in
    status)  cmd_status ;;
    mark)    shift; cmd_mark "$@" ;;
    compare) cmd_compare ;;
    *)       echo "usage: $0 {status|mark <phase>|compare}"; exit 1 ;;
esac
