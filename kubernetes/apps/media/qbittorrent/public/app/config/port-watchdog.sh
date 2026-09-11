#!/bin/sh
# gluetun forwarded-port watchdog + qBittorrent listen-port reconciler.
#
# Two failure modes are covered here, and they are independent:
#
# 1. gluetun's healthcheck only monitors internet connectivity, NOT port
#    forwarding. When ProtonVPN's NAT-PMP gateway refuses a renewal, gluetun
#    clears the forwarded port and serves {"port":0} forever while staying
#    "healthy". On a SUSTAINED port==0 this cycles the tunnel (stop->start) via
#    the control server, which reselects a server and re-requests NAT-PMP,
#    WITHOUT restarting the pod (a container-only restart would strand
#    qBittorrent on a loopback-only netns — upstream #3383).
#
# 2. The gluetun-qb-port-sync sidecar aborts with "External IP is empty" when
#    gluetun's /v1/publicip/ip returns "", which happens indefinitely after a
#    control-server-initiated tunnel cycle even though the tunnel itself is
#    fine and NAT-PMP is handing out a valid port. The sidecar never reaches
#    the step that writes the port into qBittorrent, so qBittorrent keeps
#    listening on a stale port -> "firewalled" -> trackers unreachable -> H&R.
#    That cost ~6 days of silent firewalled seeding in Sep 2026 (gluetun held
#    62742 while qBittorrent sat on 33208). This loop therefore reconciles the
#    port itself and does NOT gate on public IP, which is informational only.
#
# qBittorrent's WebUI is reached over localhost, which has auth bypass enabled,
# so no credentials are needed here.

set -eu

API="http://127.0.0.1:8000"
KEY="${GLUETUN_CONTROL_SERVER_API_KEY}"
QB="http://${QBITTORRENT_HOST:-localhost}:${QBITTORRENT_WEBUI_PORT:-80}"
INTERVAL="${INTERVAL:-60}"          # seconds between checks
THRESHOLD="${THRESHOLD:-3}"         # consecutive zeros before acting (~3 min)
SETTLE="${SETTLE:-90}"              # seconds to wait after a cycle before resuming checks

log() { echo "[port-watchdog] $*"; }

# Read the forwarded port; echo an integer (0 on any error/parse failure so a
# broken control server is treated the same as a dead port). gluetun serves
# {"port":N,"ports":[N]} — grep the scalar field only, since a bare digit strip
# would concatenate both numbers into a bogus value.
get_port() {
  resp="$(curl -sf -m 10 -H "X-API-Key: ${KEY}" "${API}/v1/portforward" 2>/dev/null || echo '')"
  port="$(printf '%s' "$resp" | grep -o '"port":[0-9]\{1,\}' | head -n1 | tr -cd '0-9')"
  [ -n "$port" ] && echo "$port" || echo 0
}

# Echo qBittorrent's current listen port, or empty string if the WebUI did not
# answer with parseable preferences (starting up, or auth bypass turned off).
get_qb_port() {
  resp="$(curl -sf -m 10 "${QB}/api/v2/app/preferences" 2>/dev/null || echo '')"
  printf '%s' "$resp" | grep -o '"listen_port":[0-9]\{1,\}' | head -n1 | tr -cd '0-9'
}

# Point qBittorrent at ${1}. Also clears random_port: while it is set,
# qBittorrent reassigns its own port on restart and silently undoes this.
set_qb_port() {
  curl -sf -m 10 -X POST "${QB}/api/v2/app/setPreferences" \
    --data-urlencode "json={\"listen_port\":${1},\"random_port\":false}" >/dev/null 2>&1
}

reconcile_port() {
  want="$1"
  have="$(get_qb_port)"
  if [ -z "$have" ]; then
    log "WARN: qBittorrent preferences unreadable — skipping port reconcile this round"
    return 0
  fi
  if [ "$have" = "$want" ]; then
    return 0
  fi
  log "listen port mismatch: qBittorrent=${have} gluetun=${want} — reconciling"
  if set_qb_port "$want"; then
    log "listen port set to ${want}"
  else
    log "WARN: failed to set listen port to ${want} — will retry next check"
  fi
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

log "started: interval=${INTERVAL}s threshold=${THRESHOLD} settle=${SETTLE}s qb=${QB}"
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
      zeros=0
    fi
    reconcile_port "$port"
  fi
  sleep "${INTERVAL}"
done
