#!/usr/bin/env bash
# Stamp the database to the latest alembic revision without applying SQL
# Usage: ./stamp_db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Please set DATABASE_URL env var"
  exit 1
fi
alembic -c migrations/alembic.ini stamp head
echo "Stamped DB to head"

