#!/bin/sh
set -eu

# Operational logs go to stderr so they never mix with collector stdout (which
# is captured into the .prom files). Data → stdout, diagnostics → stderr.
echo "hetzner-exporter: starting, interval=${INTERVAL_SECONDS}s, textfile=${TEXTFILE_DIR}" >&2

while true; do
  ok=0
  failed=0
  for collector in /scripts/*.sh; do
    # skip the runner itself
    if [ "$collector" = "/scripts/run.sh" ]; then
      continue
    fi
    name=$(basename "$collector" .sh)
    tmp="${TEXTFILE_DIR}/${name}.prom.$$"
    if sh "$collector" > "$tmp"; then
      mv "$tmp" "${TEXTFILE_DIR}/${name}.prom"   # atomic, per-collector
      ok=$((ok + 1))
    else
      rm -f "$tmp"
      failed=$((failed + 1))
      echo "hetzner-exporter: collector ${name} failed" >&2
    fi
  done
  touch "${TEXTFILE_DIR}/.heartbeat"
  # One summary line per cycle: a steady pulse in the logs shows the loop is
  # alive, and a non-zero 'failed' count surfaces partial failures at a glance.
  echo "hetzner-exporter: cycle complete, ${ok} ok, ${failed} failed" >&2
  sleep "${INTERVAL_SECONDS}"
done
