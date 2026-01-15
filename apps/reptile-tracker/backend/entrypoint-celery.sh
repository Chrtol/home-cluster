#!/usr/bin/env bash
set -euo pipefail

cd /app

# Ensure Python can import the local `app` package
export PYTHONPATH="/app:${PYTHONPATH:-}"
echo "PYTHONPATH=$PYTHONPATH"

echo "Starting Celery worker with OpenTelemetry instrumentation"
# Use opentelemetry-instrument to auto-instrument the Celery worker
# The OpenTelemetry Operator will inject configuration via environment variables
exec opentelemetry-instrument python celery_worker.py