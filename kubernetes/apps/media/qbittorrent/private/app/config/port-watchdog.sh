#!/bin/sh
# gluetun forwarded-port watchdog.
#
# gluetun's healthcheck only monitors internet connectivity, NOT port
# forwarding. When ProtonVPN's NAT-PMP gateway refuses a renewal, gluetun
# (v3.41.1, pre-fix) clears the forwarded port and serves {"port":0} forever
# while staying "healthy". qBittorrent then listens on port 0 -> "firewalled"
# -> can't seed -> private-tracker Hit-and-Runs.
#
# This loop polls the forwarded port and, only after it has been 0 for
# THRESHOLD consecutive checks (i.e. a persistent failure, not a brief
# reconnect), cycles the tunnel via the control server. stop->start makes
# gluetun reselect a server and re-request NAT-PMP, recovering the port
# WITHOUT restarting the pod (a container-only restart would leave qBittorrent
# on a loopback-only netns — upstream #3383).

set -eu

API="http://127.0.0.1:8000"
KEY="${GLUETUN_CONTROL_SERVER_API_KEY}"
INTERVAL="${INTERVAL:-60}"          # seconds between checks
THRESHOLD="${THRESHOLD:-3}"         # consecutive zeros before acting (~3 min)
SETTLE="${SETTLE:-90}"              # seconds to wait after a cycle before resuming checks

log() { echo "[port-watchdog] $*"; }

# Read the forwarded port; echo an integer (0 on any error/parse failure so a
# broken control server is treated the same as a dead port).
get_port() {
  resp="$(curl -sf -m 10 -H "X-API-Key: ${KEY}" "${API}/v1/portforward" 2>/dev/null || echo '')"
  # response is {"port":NNNN}; strip everything but digits
  port="$(printf '%s' "$resp" | tr -cd '0-9')"
  [ -n "$port" ] && echo "$port" || echo 0
}

cycle_tunnel() {
  log "forwarded port stuck at 0 for ${THRESHOLD} checks — cycling VPN tunnel"
  if ! curl -sf -m 10 -X PUT -H "X-API-Key: ${KEY}" \
        -d '{"status":"stopped"}' "${API}/v1/vpn/status" >/dev/null 2>&1; then
    log "WARN: stop request failed (control server / auth?) — will retry next cycle"
    return 1
  fi
  sleep 5
  if ! curl -sf -m 10 -X PUT -H "X-API-Key: ${KEY}" \
        -d '{"status":"running"}' "${API}/v1/vpn/status" >/dev/null 2>&1; then
    log "WARN: start request failed — tunnel left stopped, will retry next cycle"
    return 1
  fi
  log "tunnel restart requested; waiting ${SETTLE}s for reconnect + new NAT-PMP port"
  sleep "${SETTLE}"
  return 0
}

log "started: interval=${INTERVAL}s threshold=${THRESHOLD} settle=${SETTLE}s"
zeros=0
while true; do
  port="$(get_port)"
  if [ "$port" -eq 0 ] 2>/dev/null; then
    zeros=$((zeros + 1))
    log "forwarded port = 0 (${zeros}/${THRESHOLD})"
    if [ "$zeros" -ge "$THRESHOLD" ]; then
      cycle_tunnel && zeros=0
    fi
  else
    if [ "$zeros" -ne 0 ]; then
      log "forwarded port recovered = ${port}"
    fi
    zeros=0
  fi
  sleep "${INTERVAL}"
done
