# Migrations — Reptile Tracker (concise)

This document explains how migrations are handled and gives quick commands and a Kubernetes Job example.

Summary
- The container entrypoint will wait for the DB and then:
  - if `alembic_version` exists: run `alembic upgrade head`
  - if `alembic_version` does not exist and core app tables (e.g. `users`) exist: run `alembic stamp head`
  - otherwise: run `alembic upgrade head` to create the schema
- For production, prefer running migrations as a single step in CI or as a Kubernetes Job *before* rolling out application pods.

Quick commands (run from `apps/reptile-tracker/backend`)

Apply migrations:
```bash
cd apps/reptile-tracker/backend
alembic -c migrations/alembic.ini upgrade head
```

Stamp DB as current (no SQL run):
```bash
alembic -c migrations/alembic.ini stamp head
```

Or use the helper script:
```bash
./scripts/stamp_db.sh
```

Generate an autogenerate migration (requires DB configured and reachable):
```bash
alembic -c migrations/alembic.ini revision --autogenerate -m "describe change"
```

Backup before migrating (example using pg_dump):
```bash
PGPASSWORD=$DB_PASS pg_dump -h $DB_HOST -U $DB_USER -Fc $DB_NAME > backup_before_migration.dump
```

Kubernetes Job example (run once before deployment):

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: reptile-migrations
  namespace: default
spec:
  template:
    spec:
      restartPolicy: OnFailure
      containers:
      - name: migrate
        image: ghcr.io/chrtol/reptile-tracker-backend:latest
        command: ["/bin/sh","-c","alembic -c /app/migrations/alembic.ini upgrade head"]
        env:
        - name: DATABASE_URL
          value: "postgresql+asyncpg://user:pass@postgres:5432/reptile"
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: reptile-secrets
              key: SECRET_KEY
```

Notes
- The `env.py` in `migrations` converts an async URL (e.g., `postgresql+asyncpg://...`) to a sync URL for Alembic.
- Running migrations from multiple pods concurrently may cause race conditions. Use a single-run job or CI as the canonical migration step.
- After migrating, verify the app in staging before promoting to production.

If you want, I can add a small GitHub Actions job that runs migrations and tests before deployment.
