#!/bin/sh
set -eu

API_URL="https://api.hetzner.com/v1/storage_boxes"

# Fetch all storage boxes. On failure, emit up=0 so Prometheus sees the outage
# as a value (alertable) rather than a vanished series, then exit 0 so run.sh
# still publishes this file.
if ! boxes=$(curl -sf --max-time 20 \
    -H "Authorization: Bearer ${HETZNER_API_TOKEN}" "$API_URL"); then
  echo 'hetzner_storagebox_up{box="unknown"} 0'
  exit 0
fi

# ── Box-level metrics ──────────────────────────────────────────────────────
echo "# HELP hetzner_storagebox_up Whether the Hetzner API call succeeded (1) or not (0)."
echo "# TYPE hetzner_storagebox_up gauge"
echo "# HELP hetzner_storagebox_used_bytes Total disk usage of the storage box in bytes."
echo "# TYPE hetzner_storagebox_used_bytes gauge"
echo "# HELP hetzner_storagebox_quota_bytes Total capacity of the storage box in bytes."
echo "# TYPE hetzner_storagebox_quota_bytes gauge"
echo "$boxes" | jq -r '
  .storage_boxes[] |
  "hetzner_storagebox_up{box=\"\(.name)\"} 1",
  "hetzner_storagebox_status{box=\"\(.name)\",status=\"\(.status)\"} 1",
  "hetzner_storagebox_used_bytes{box=\"\(.name)\"} \(.stats.size)",
  "hetzner_storagebox_data_bytes{box=\"\(.name)\"} \(.stats.size_data)",
  "hetzner_storagebox_snapshots_bytes{box=\"\(.name)\"} \(.stats.size_snapshots)",
  "hetzner_storagebox_quota_bytes{box=\"\(.name)\"} \(.storage_box_type.size)",
  "hetzner_storagebox_snapshot_limit{box=\"\(.name)\"} \(.storage_box_type.snapshot_limit)"
'

# ── Snapshot aggregates (one API call per box) ─────────────────────────────
echo "# HELP hetzner_storagebox_snapshot_count Number of snapshots on the storage box."
echo "# TYPE hetzner_storagebox_snapshot_count gauge"
echo "# HELP hetzner_storagebox_latest_snapshot_timestamp_seconds Unix time of the newest snapshot."
echo "# TYPE hetzner_storagebox_latest_snapshot_timestamp_seconds gauge"
echo "$boxes" | jq -r '.storage_boxes[] | "\(.id) \(.name)"' |
while read -r id name; do
  snaps=$(curl -sf --max-time 20 \
    -H "Authorization: Bearer ${HETZNER_API_TOKEN}" "${API_URL}/${id}/snapshots") || continue
  echo "$snaps" | jq -r --arg box "$name" '
    (.snapshots // []) as $s |
    ($s | length) as $count |
    ([$s[].created | fromdateiso8601] | sort) as $t |
    "hetzner_storagebox_snapshot_count{box=\"\($box)\"} \($count)",
    "hetzner_storagebox_latest_snapshot_timestamp_seconds{box=\"\($box)\"} \($t[-1] // 0)",
    "hetzner_storagebox_oldest_snapshot_timestamp_seconds{box=\"\($box)\"} \($t[0] // 0)"
  '
done
