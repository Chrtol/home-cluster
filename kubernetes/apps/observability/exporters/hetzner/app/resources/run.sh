#!/bin/sh
set -eu
while true; do
  for collector in /scripts/*.sh; do
    # skip the runner itself
    if [ "$collector" = "/scripts/run.sh" ]; then
      continue
    fi
    name=$(basename "$collector" .sh)
    tmp="${TEXTFILE_DIR}/${name}.prom.$$"
    if sh "$collector" > "$tmp"; then
      mv "$tmp" "${TEXTFILE_DIR}/${name}.prom"   # atomic, per-collector
    else
      rm -f "$tmp"
    fi
  done
  touch "${TEXTFILE_DIR}/.heartbeat"
  sleep "${INTERVAL_SECONDS}"
done