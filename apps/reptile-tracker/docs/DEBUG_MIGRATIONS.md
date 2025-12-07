## Reptile Tracker — Migrations & Startup debugging notes

This document records the changes made while adding household/invitation functionality and the follow-up fixes for Alembic/migration/startup issues encountered when running the backend container. Use this as a reference for reproducing the problem, understanding the fixes that were applied, and next recommended steps.

### Summary of work completed

- Added Household and Invitation models and schemas. Added `household_members` association and a nullable `household_id` FK on `Reptile`.
- Implemented routers: `households` and `invitations` with endpoints to create/accept/list invites.
- Integrated invite auto-accept into the OIDC callback so `next=/accept-invite?code=...` is accepted server-side after login.
- Frontend: added Settings UI and `/accept-invite` page.
- Added Alembic scaffolding: `migrations/env.py`, `migrations/alembic.ini`, and revision files (initial and household FK).
- Made the container entrypoint robust: wait for DB, detect `alembic_version`, run `alembic upgrade head` or `alembic stamp head` depending on state.

### Problem observed when deploying the container

When the backend container started in the cluster it printed lines showing Alembic ran (or stamped) but Uvicorn then failed during startup. Initial logs showed an Alembic import error:

- `ModuleNotFoundError: No module named 'app.config'` when Alembic ran `env.py`.
- After addressing that, later errors included a logging config evaluation error inside `fileConfig()` and then an SQL error (revision ID too long for `alembic_version` column).

The high-level root causes were:

1. Alembic CLI (running in the container) could not import the local `app` package because the container's Python path did not include the application root when alembic executed.
2. `migrations/alembic.ini` contains logging handler args that reference `sys.stderr`; `fileConfig()` evaluation failed in the container in one environment.
3. Alembic revision identifiers in the migration files were longer than the DB's `alembic_version.version_num` column allowed (the DB used `varchar(32)`), causing `psycopg2.errors.StringDataRightTruncation` when stamping.

### Changes applied to fix issues (chronological)

1. Export `PYTHONPATH` in `entrypoint.sh` so Alembic can import the application module:

   - File: `apps/reptile-tracker/backend/entrypoint.sh`
   - Added: `export PYTHONPATH="/app:${PYTHONPATH:-}"` and a debug `echo` of `PYTHONPATH`.

2. Harden `migrations/env.py` logging config handling:

   - File: `apps/reptile-tracker/backend/migrations/env.py`
   - Provided `sys` to `fileConfig()` via `defaults={"sys": sys}` so expressions like `args = (sys.stderr,)` evaluate.
   - Wrapped the call in `try/except` and fall back to `logging.basicConfig()` if the ini can't be processed.

3. Use a sync SQL driver for Alembic's sync engine:

   - Installed `psycopg2-binary` by adding `psycopg2-binary==2.9.7` to `apps/reptile-tracker/backend/requirements.txt` so `sqlalchemy.create_engine()` can use a sync driver in the container.

4. Avoid engine-from-config path issues in `env.py` by creating the engine from the resolved URL directly:

   - Replaced `engine_from_config(...)` with `create_engine(sqlalchemy_url, poolclass=pool.NullPool)` to ensure alembic can connect in containerized environments.

5. Shortened Alembic revision identifiers to fit `alembic_version.version_num`:

   - `migrations/versions/0001_initial.py`: changed `Revision ID` and `revision` to `'0001'`.
   - `migrations/versions/0002_add_household_id_to_reptiles.py`: changed `Revision ID` and `revision` to `'0002'` and `down_revision` to `'0001'`.

6. Added a small debug helper and entrypoint hook to capture full startup exceptions:

   - File: `apps/reptile-tracker/backend/debug_startup.py` — runs `init_db()` and `seed_database()` and prints full tracebacks.
   - `entrypoint.sh`: if `DEBUG_STARTUP=1` the script runs before starting Uvicorn.

### How to reproduce the debug run (safe, non-GitOps)

Use a one-off pod so Flux/Helm won't revert changes to the `reptile-tracker` Deployment.

Option A — ephemeral Pod manifest (recommended):

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: reptile-debug
  namespace: default
spec:
  restartPolicy: Never
  containers:
    - name: reptile-debug
      image: ghcr.io/chrtol/reptile-tracker-backend:main-879bbb1
      envFrom:
        - secretRef:
            name: reptile-tracker-secret
        - secretRef:
            name: reptile-tracker-database-secret
      command: ["/bin/sh", "-c", "python /app/debug_startup.py"]
```

Apply and stream logs:

```bash
kubectl apply -f debug-pod.yaml
kubectl -n default logs -f pod/reptile-debug
kubectl -n default delete pod/reptile-debug
```

Option B — `kubectl run` one-off pod:

```bash
kubectl -n default run --rm -it reptile-debug --restart=Never \
  --image=ghcr.io/chrtol/reptile-tracker-backend:main-879bbb1 \
  --overrides='{"apiVersion":"v1","spec":{"restartPolicy":"Never","containers":[{"name":"reptile-debug","image":"ghcr.io/chrtol/reptile-tracker-backend:main-879bbb1","envFrom":[{"secretRef":{"name":"reptile-tracker-secret"}},{"secretRef":{"name":"reptile-tracker-database-secret"}}],"command":["/bin/sh","-c","python /app/debug_startup.py"]}]}}' -- /bin/sh -c 'sleep 1'
```

Either will print the full exception when `init_db()` or seeding fails; paste that traceback into your notes for triage.

### Observed final state after fixes (as of this log)

- Alembic stamping/upgrading runs in the container (the `alembic_version` check and stamp succeeded after fixes).
- Alembic logging evaluation warnings may still appear; they are now captured and handled.
- Uvicorn startup still failed in the cluster prior to adding `debug_startup.py`; using the debug pod will expose the exact error (likely caused by DB schema/data mismatch or an env/config issue). Once the debug traceback is obtained it can be fixed.

### Recommended next steps (followups)

1. Run the debug pod to capture the full traceback and paste it into this doc for root-cause analysis.
2. Remove or gate `Base.metadata.create_all()` in `app/database.py` for production. Rely on Alembic for schema management and avoid running `create_all()` in production.
3. Decide whether the entrypoint should be fail-fast on migration errors (remove `|| true` after `alembic` calls) — recommended for production so broken migrations don't silently allow the app to start.
4. Implement a leader-only migration Job (Kubernetes Job or HelmHook) so only a single process runs migrations during deploy and you avoid concurrency/race issues.
5. Add CI step / GitHub Action to run `alembic upgrade --sql` or validate migrations during merges so regressions are caught before deployment.
6. Remove `debug_startup.py` and any `PYTHONPATH` echo after debugging is complete.

### Contact and references

- Files of interest:
  - `apps/reptile-tracker/backend/entrypoint.sh`
  - `apps/reptile-tracker/backend/migrations/env.py`
  - `apps/reptile-tracker/backend/migrations/versions/0001.py` (formerly `0001_initial.py`)
  - `apps/reptile-tracker/backend/migrations/versions/0002.py` (formerly `0002_add_household_id_to_reptiles.py`)
  - `apps/reptile-tracker/backend/debug_startup.py`

If you get the debug traceback and paste it into this file (or send it back to me) I will produce a targeted patch to fix the underlying startup exception.
