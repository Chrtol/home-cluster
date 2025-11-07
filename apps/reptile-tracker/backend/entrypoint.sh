#!/usr/bin/env bash
set -euo pipefail

cd /app

# Ensure Python can import the local `app` package when Alembic runs
# (some environments don't automatically include the CWD in sys.path when
# running the alembic CLI). Export PYTHONPATH so `from app.config import ...`
# works inside migrations/env.py
export PYTHONPATH="/app:${PYTHONPATH:-}"
echo "PYTHONPATH=$PYTHONPATH"

MIGRATIONS_DIR=/app/migrations

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set, skipping migrations"
else
  # Normalize URL for psql (strip +asyncpg if present)
  CONN="${DATABASE_URL//+asyncpg/}"

  # Wait for DB to be reachable
  attempt=0
  until psql "$CONN" -c '\q' > /dev/null 2>&1; do
    attempt=$((attempt+1))
    if [ $attempt -ge 15 ]; then
      echo "Timed out waiting for DB after $attempt attempts"
      break
    fi
    echo "Waiting for DB to be ready... (attempt $attempt)"
    sleep 2
  done

  if [ -x "$(command -v alembic)" ]; then
    echo "Checking database migration state..."

    # Check if alembic_version table exists
    has_alembic=$(psql "$CONN" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='alembic_version');" || echo "f")

    if [ "$has_alembic" = "t" ]; then
      echo "alembic_version table found — running migrations"
      alembic -c ${MIGRATIONS_DIR}/alembic.ini upgrade head || true
    else
      # Check if core app table exists (users)
      has_users=$(psql "$CONN" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users');" || echo "f")
      if [ "$has_users" = "t" ]; then
        echo "Found existing app tables but no alembic_version — stamping DB to head"
        alembic -c ${MIGRATIONS_DIR}/alembic.ini stamp head || true
      else
        echo "No existing app tables detected — running migrations to create schema"
        alembic -c ${MIGRATIONS_DIR}/alembic.ini upgrade head || true
      fi
    fi
  else
    echo "alembic not installed; skipping migrations"
  fi

  # Run cleanup script to remove duplicate templates
  if [ -f /app/cleanup_duplicate_templates.py ]; then
    echo "Running duplicate template cleanup..."
    CONFIRM=yes python /app/cleanup_duplicate_templates.py || true
  fi
fi

# Optional debug startup run - when set, run the app's init_db and seed steps
# and exit (helps capture startup exceptions before Uvicorn). Useful during
# debugging in cluster.
if [ "${DEBUG_STARTUP:-0}" = "1" ]; then
  echo "DEBUG_STARTUP=1 detected — running debug_startup.py"
  python /app/debug_startup.py || true
fi

echo "Starting Uvicorn"
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --log-config /app/logging_config.json
