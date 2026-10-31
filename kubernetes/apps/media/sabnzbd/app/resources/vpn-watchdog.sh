#!/bin/sh
# Slow-tunnel watchdog for the gluetun sidecar.
#
# gluetun's own healthcheck (ICMP + a TLS dial every 5 min) passes on a tunnel
# that still connects but crawls: on 2026-10-31 a ProtonVPN endpoint held
# sabnzbd at ~200 KB/s for over a day while the same pod off-VPN pulled 58 MB/s.
# This loop cycles the tunnel (gluetun picks a new random server) when sabnzbd
# is slow AND a direct throughput test through the tunnel confirms it, so a
# slow job alone (par2 repair, sparse articles) never triggers a reconnect.
#
# Cycling via the control server keeps the pod: a pod restart wipes the
# emptyDir /incomplete and sabnzbd loses every in-progress job.

set -eu

GLUETUN="http://127.0.0.1:8000"
SAB="http://127.0.0.1:${SABNZBD_PORT:-80}"
INTERVAL="${INTERVAL:-300}"
SLOW_CHECKS="${SLOW_CHECKS:-2}"
SAB_MIN_KBPS="${SAB_MIN_KBPS:-5120}"
TUNNEL_MIN_BPS="${TUNNEL_MIN_BPS:-3000000}"
TEST_URL="${TEST_URL:-https://speed.cloudflare.com/__down?bytes=25000000}"
MAX_CYCLES_PER_HOUR="${MAX_CYCLES_PER_HOUR:-3}"
SETTLE="${SETTLE:-60}"

log() { echo "[vpn-watchdog] $*"; }

notify() {
  [ -n "${DISCORD_WEBHOOK_URL:-}" ] || return 0
  msg="$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  curl -sf -m 30 -H 'Content-Type: application/json' \
    -d "{\"username\":\"sabnzbd vpn-watchdog\",\"content\":\"${msg}\"}" \
    "$DISCORD_WEBHOOK_URL" >/dev/null 2>&1 || log "WARN: Discord notify failed"
}

# Echoes sabnzbd's current speed in whole KB/s, or -1 when it is not actively
# downloading (idle, paused, post-processing only) or the API did not answer.
sab_kbps() {
  q="$(curl -sf -m 15 "${SAB}/api?mode=queue&output=json&limit=0&apikey=${SABNZBD_API_KEY}" 2>/dev/null || echo '')"
  printf '%s' "$q" | grep -q '"status":"Downloading"' || { echo -1; return; }
  printf '%s' "$q" | grep -q '"paused":true' && { echo -1; return; }
  printf '%s' "$q" | grep -o '"kbpersec":"[0-9.]*"' | head -n1 | tr -cd '0-9.' | cut -d. -f1 | grep . || echo -1
}

tunnel_bps() {
  curl -s -o /dev/null -m 30 -w '%{speed_download}' "$TEST_URL" 2>/dev/null | cut -d. -f1 | grep . || echo 0
}

vpn_ip() {
  curl -sf -m 10 -H "X-API-Key: ${GLUETUN_CONTROL_SERVER_API_KEY}" "${GLUETUN}/v1/publicip/ip" 2>/dev/null \
    | grep -o '"public_ip":"[^"]*"' | cut -d'"' -f4
}

set_vpn() {
  curl -sf -m 15 -X PUT -H "X-API-Key: ${GLUETUN_CONTROL_SERVER_API_KEY}" \
    -H 'Content-Type: application/json' -d "{\"status\":\"$1\"}" \
    "${GLUETUN}/v1/vpn/status" >/dev/null 2>&1
}

# Unix timestamps of cycles in the last hour, space-separated.
cycles=""
capped_alerted=0

recent_cycles() {
  now="$(date +%s)"
  kept=""
  for t in $cycles; do
    [ $((now - t)) -lt 3600 ] && kept="$kept $t"
  done
  cycles="$kept"
  set -- $cycles
  echo $#
}

cycle_tunnel() {
  reason="$1"
  if [ "$(recent_cycles)" -ge "$MAX_CYCLES_PER_HOUR" ]; then
    log "cap reached (${MAX_CYCLES_PER_HOUR}/h) — not cycling: ${reason}"
    if [ "$capped_alerted" -eq 0 ]; then
      notify "VPN still slow after ${MAX_CYCLES_PER_HOUR} reconnects this hour (${reason}); leaving it alone until the hour clears. Possibly a ProtonVPN-wide problem."
      capped_alerted=1
    fi
    return 1
  fi
  old_ip="$(vpn_ip)"
  log "cycling tunnel: ${reason} (exit ${old_ip:-unknown})"
  set_vpn stopped || { log "WARN: stop request failed (control server auth?)"; return 1; }
  sleep 5
  set_vpn running || { log "WARN: start request failed — tunnel left stopped, retrying next check"; return 1; }
  cycles="$cycles $(date +%s)"
  sleep "$SETTLE"
  new_ip="$(vpn_ip)"
  new_bps="$(tunnel_bps)"
  log "reconnected: exit ${new_ip:-unknown}, tunnel test $((new_bps / 1000)) KB/s"
  notify "Reconnected sabnzbd VPN: ${reason}. Exit ${old_ip:-?} -> ${new_ip:-?}, tunnel test now $((new_bps / 1000)) KB/s."
}

log "started: interval=${INTERVAL}s slow_checks=${SLOW_CHECKS} sab_min=${SAB_MIN_KBPS}KB/s tunnel_min=${TUNNEL_MIN_BPS}B/s cap=${MAX_CYCLES_PER_HOUR}/h"
slow=0
while true; do
  kbps="$(sab_kbps)"
  if [ "$kbps" -lt 0 ]; then
    slow=0
  elif [ "$kbps" -lt "$SAB_MIN_KBPS" ]; then
    slow=$((slow + 1))
    log "sabnzbd at ${kbps} KB/s (${slow}/${SLOW_CHECKS})"
    if [ "$slow" -ge "$SLOW_CHECKS" ]; then
      bps="$(tunnel_bps)"
      if [ "$bps" -lt "$TUNNEL_MIN_BPS" ]; then
        cycle_tunnel "sabnzbd ${kbps} KB/s, tunnel test $((bps / 1000)) KB/s" || true
      else
        log "tunnel test $((bps / 1000)) KB/s is fine — sabnzbd slowness is not the VPN"
      fi
      slow=0
    fi
  else
    slow=0
  fi
  [ "$(recent_cycles)" -eq 0 ] && capped_alerted=0
  sleep "$INTERVAL"
done
