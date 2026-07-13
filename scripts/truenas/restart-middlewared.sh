#!/usr/bin/env bash
# Weekly restart of TrueNAS middlewared to reclaim leaked memory.
#
# middlewared leaks ~235 MB/day (baseline RSS ~485 MB). Left alone it reached
# 13.2 GB of 16 GB over 54 days, which starved the box and got nginx OOM-killed
# (2026-07-13 03:07 CEST), taking the web UI down while NFS/SSH stayed up.
#
# ARC is capped at 10 GB (zfs_arc_max tunable) to reserve headroom; this job
# bounds the other side by keeping a week's leak to ~1.7 GB.
#
# Restarting middlewared drops the UI/API briefly. It does NOT touch NFS or the
# pools, so cluster storage keeps serving. It can interrupt an in-flight
# replication/scrub, hence the quiet Sunday 05:00 slot.
#
# Notifications go to Discord. There is no SMTP on this box, so TrueNAS cron's
# email-on-output is useless; instead we reuse the webhook already stored in the
# "Discord Notifications" alert service (a Slack-type service pointed at
# Discord's /slack-compatible endpoint). Reading it from the config DB at runtime
# keeps the secret out of this file and out of git.
set -Eeuo pipefail

readonly THRESHOLD_BYTES=$((2 * 1024 * 1024 * 1024)) # 2 GiB
readonly ALERT_SERVICE="Discord Notifications"

log() { printf '%s middlewared-restart: %s\n' "$(date -Is)" "$*"; }

# Pull the Discord webhook out of the TrueNAS alert service config.
#
# Wrapped in `timeout` because midclt talks to middlewared over a unix socket,
# and on the success path we call this immediately after restarting middlewared.
# If it came back slow or unhealthy the socket could block forever - and this
# runs unattended from cron at 05:00, so an indefinite hang would go unnoticed.
webhook_url() {
    timeout 20 midclt call alertservice.query "[[\"name\",\"=\",\"${ALERT_SERVICE}\"]]" 2>/dev/null \
        | python3 -c 'import sys, json; d = json.load(sys.stdin); print(d[0]["attributes"]["url"] if d else "")' 2>/dev/null || true
}

# Post to Discord. Never fail the script on a notification error - a missed
# message must not turn a successful restart into a failed cron job.
notify() {
    local text="$1" url
    url="$(webhook_url)"
    if [[ -z "${url}" ]]; then
        log "WARN: no webhook on alert service '${ALERT_SERVICE}'; skipping notify"
        return 0
    fi
    curl -fsS -m 15 -X POST -H 'Content-Type: application/json' \
        -d "$(python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1]}))' "${text}")" \
        "${url}" >/dev/null 2>&1 \
        || log "WARN: Discord notify failed"
}

# RSS of the middlewared main process (reports as "asyncio_loop" in ps).
rss_bytes() {
    local pid kb
    pid="$(systemctl show -p MainPID --value middlewared 2>/dev/null || true)"
    [[ -n "${pid}" && "${pid}" != "0" ]] || return 1
    kb="$(awk '/^VmRSS:/ {print $2}' "/proc/${pid}/status" 2>/dev/null || true)"
    [[ -n "${kb}" ]] || return 1
    echo $((kb * 1024))
}

mib() { echo $(($1 / 1024 / 1024)); }

main() {
    local before after
    if ! before="$(rss_bytes)"; then
        log "ERROR: could not read middlewared RSS; is it running?"
        notify ":rotating_light: **NAS**: middlewared restart job could not read RSS — is middlewared running?"
        exit 1
    fi

    log "current RSS: $(mib "${before}") MiB"

    # Skip the restart if memory is still healthy. The disruption is only worth
    # it once the leak has actually accumulated; a normal week lands ~2.1 GiB.
    # This also means the job quietly becomes a no-op if a TrueNAS update ever
    # fixes the leak, instead of bouncing the API forever out of habit.
    if ((before < THRESHOLD_BYTES)); then
        log "below $(mib "${THRESHOLD_BYTES}") MiB threshold; skipping restart"
        exit 0
    fi

    log "restarting middlewared"
    systemctl restart middlewared

    # Wait for it to come back rather than assuming. `systemctl restart` exiting 0
    # does not mean the API is healthy again - and middlewared IS the API, so a
    # silent failure here would leave the box headless until someone noticed.
    local i
    for i in {1..30}; do
        sleep 2
        if systemctl is-active --quiet middlewared && after="$(rss_bytes)"; then
            log "restarted OK; RSS now $(mib "${after}") MiB (was $(mib "${before}") MiB)"
            notify ":recycle: **NAS**: middlewared restarted — reclaimed $(( (before - after) / 1024 / 1024 )) MiB (was $(mib "${before}") MiB, now $(mib "${after}") MiB)"
            exit 0
        fi
    done

    log "ERROR: middlewared did not come back healthy within 60s"
    systemctl is-active middlewared || true
    notify ":rotating_light: **NAS**: middlewared FAILED to restart — API/UI may be down. Check the box."
    exit 1
}

main "$@"
