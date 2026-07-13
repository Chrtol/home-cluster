#!/usr/bin/env bash
# Install the middlewared restart script on the NAS and register it as a
# TrueNAS cron job (Sunday 05:00).
#
# Runs as truenas_admin + sudo, NOT as root: TrueNAS disables root SSH by default
# (root has password_disabled=true and no authorized key), so root@nas cannot log
# in at all. truenas_admin has sudo ALL, but with a password - hence `ssh -t` and
# a single `sudo -v` up front to cache the credential for the rest of the run.
# You will be prompted for the truenas_admin password once.
#
# The cron job is stored in the TrueNAS config DB via the middleware API, not in
# /etc/cron.d. This matters: SCALE boots a fresh root dataset on upgrade
# (boot-pool/ROOT/<version>), so anything hand-written into /etc is silently
# wiped by the next update. Config-DB entries survive upgrades and are captured
# in config backups. The script itself lives in /root for the same reason.
#
# Idempotent: re-running updates the existing job rather than creating a duplicate.
#
# Usage: ./setup-cron.sh [user@host]
set -Eeuo pipefail

readonly NAS="${1:-truenas_admin@nas.${SECRET_DOMAIN:?SECRET_DOMAIN must be set}}"
readonly REMOTE_DIR="/root/scripts"
readonly REMOTE_PATH="${REMOTE_DIR}/restart-middlewared.sh"
readonly DESCRIPTION="Restart middlewared weekly (memory leak mitigation)"

readonly SRC="$(dirname "$(readlink -f "$0")")/restart-middlewared.sh"
readonly STAGE="/tmp/restart-middlewared.$$.sh"
readonly REMOTE_RUNNER="/tmp/setup-cron-remote.$$.sh"

log() { printf '\033[1;32m%s\033[0m\n' "$*"; }

[[ -f "${SRC}" ]] || { echo "missing ${SRC}" >&2; exit 1; }

# scp to a world-writable staging path first; truenas_admin cannot write /root.
log "Staging restart-middlewared.sh on ${NAS}"
scp -q "${SRC}" "${NAS}:${STAGE}"

# Build the remote script locally, then run it from a file rather than piping it
# over stdin - sudo needs the TTY's stdin free to read the password prompt.
remote_script="$(
    cat <<REMOTE
set -Eeuo pipefail

# Cache sudo credentials once so the steps below don't each re-prompt.
sudo -v

sudo install -d -m 700 -o root -g root '${REMOTE_DIR}'
sudo install -m 700 -o root -g root '${STAGE}' '${REMOTE_PATH}'
rm -f '${STAGE}'
echo "  installed ${REMOTE_PATH}"

# dow is 1=Monday .. 7=Sunday in TrueNAS (NOT standard cron, where Sunday is 0).
#
# stdout/stderr are left at their suppressing defaults: TrueNAS only delivers
# cron output by email and this box has no SMTP configured, so unsuppressing it
# would just pile up in an unread local mail spool. The script notifies Discord
# itself instead, reusing the webhook already stored in the alert service.
payload=\$(python3 -c '
import json
print(json.dumps({
    "description": "${DESCRIPTION}",
    "command": "${REMOTE_PATH}",
    "user": "root",
    "schedule": {"minute": "0", "hour": "5", "dom": "*", "month": "*", "dow": "7"},
    "enabled": True,
}))')

existing=\$(sudo midclt call cronjob.query '[["description","=","${DESCRIPTION}"]]' \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d[0]["id"] if d else "")')

if [ -n "\${existing}" ]; then
    echo "  updating existing cron job id=\${existing}"
    sudo midclt call cronjob.update "\${existing}" "\${payload}" >/dev/null
else
    echo "  creating cron job"
    sudo midclt call cronjob.create "\${payload}" >/dev/null
fi

echo "  registered:"
sudo midclt call cronjob.query '[["description","=","${DESCRIPTION}"]]' \
    | python3 -c 'import sys,json; [print("   id=%s  %s  user=%s  enabled=%s  %s" % (j["id"], j["schedule"], j["user"], j["enabled"], j["command"])) for j in json.load(sys.stdin)]'
REMOTE
)"

log "Installing script and registering cron job (sudo password required)"
printf '%s' "${remote_script}" | ssh "${NAS}" "cat > '${REMOTE_RUNNER}'"
ssh -t "${NAS}" "bash '${REMOTE_RUNNER}'; rc=\$?; rm -f '${REMOTE_RUNNER}'; exit \$rc"

log "Done. Dry-run it with:"
log "  ssh -t ${NAS} 'sudo ${REMOTE_PATH}'"
