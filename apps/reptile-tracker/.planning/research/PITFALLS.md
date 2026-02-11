# Pitfalls Research

**Domain:** Local Development Environment for FastAPI + React (Vite) + Celery Application
**Researched:** 2026-02-11
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Authentication Bypass Leaks into Production

**What goes wrong:**
Development authentication bypass code accidentally runs in production, allowing anyone to authenticate without OIDC. This happens when environment checks are weak (e.g., checking `ENVIRONMENT != "production"` instead of `ENVIRONMENT == "development"`) or when the bypass dependency is always registered but only conditionally used.

**Why it happens:**
Developers create "escape hatches" for local testing without OIDC setup and use permissive conditionals. The bypass route exists in production but is "guarded" by a check that can fail open. Additionally, testing often happens with `ENVIRONMENT=staging` where bypass is allowed, masking production risks.

**How to avoid:**
1. Use explicit allowlist: `ENVIRONMENT == "development"` (never `!= "production"`)
2. Register bypass routes conditionally at startup, not just guard them
3. Startup validation that crashes if `DEV_AUTH_BYPASS=true` and `ENVIRONMENT=production`
4. Add production health check that verifies bypass routes return 404
5. Use separate dependencies module for dev-only auth functions

**Warning signs:**
- Auth dependency uses negative condition (`if not production`)
- Environment variable defaults to `development` instead of requiring explicit set
- Bypass endpoint returns 401 instead of 404 in production
- Tests don't verify bypass route doesn't exist in production mode
- Seeing `/auth/dev-login` or similar in production logs

**Phase to address:**
Phase 1 (Dev Auth Mode) - Prevention must be built-in from the start. Create `app/auth_dev.py` separate from `app/auth.py`, register conditionally in `main.py`.

---

### Pitfall 2: Secure Cookie Flag Breaks Localhost Development

**What goes wrong:**
Setting `COOKIE_SECURE=true` in docker-compose breaks authentication entirely. Cookies are set but never sent back by browser because HTTP != HTTPS. Developers waste hours debugging "token expired" or "user not found" when the cookie simply isn't being transmitted.

**Why it happens:**
Production config is copied to docker-compose for "parity." The current codebase already has `cookie_secure=True` hardcoded in config with production in mind. Browser security rules strictly enforce secure cookies only over HTTPS - no exceptions for localhost in this case (the exception only applies when testing locally outside containers).

**How to avoid:**
1. Set `COOKIE_SECURE=false` explicitly in docker-compose.yml
2. Use mkcert to generate local HTTPS certificates for production-like testing
3. Create `settings_dev.py` that overrides cookie settings
4. Add startup log warning when `COOKIE_SECURE=false` and `ENVIRONMENT=production`
5. Document this difference in README - it's an acceptable dev/prod gap

**Warning signs:**
- Auth works in production but fails in docker-compose
- Browser dev tools show cookie set but missing in subsequent requests
- Cookie has `Secure` flag in localhost environment
- Response includes Set-Cookie header but Application tab shows no cookies
- Testing shows 401 errors despite successful OIDC callback

**Phase to address:**
Phase 1 (Dev Auth Mode) - Must be addressed when setting up docker-compose, before testing auth flow.

---

### Pitfall 3: Vite HMR Silent Failure in Docker

**What goes wrong:**
Code changes in React frontend don't trigger hot reload. Developers manually refresh and don't notice HMR is broken, or they restart containers repeatedly. Vite appears to run but file watching fails silently inside Docker container.

**Why it happens:**
Vite uses native file watchers that don't detect changes across Docker volume boundaries on some systems (especially Windows + WSL2). Default configuration uses `localhost` which isn't accessible from host browser when running in container. Missing polling fallback means changes are never detected.

**How to avoid:**
1. Add to `vite.config.ts`:
```typescript
server: {
  host: '0.0.0.0',  // Expose to host machine
  port: 5173,
  watch: {
    usePolling: true,  // Required for Docker
    interval: 1000
  },
  hmr: {
    clientPort: 5173  // Must match exposed port
  }
}
```
2. In docker-compose: map port correctly and use bind mount (not named volume)
3. Add `/app/node_modules` as separate volume to prevent mounting host's node_modules
4. Test HMR actually works during setup, don't assume

**Warning signs:**
- `[vite] connected` message appears but changes don't reflect
- `[vite] page reload src/App.tsx` only after manual refresh
- Works on some machines but not others
- Works outside Docker but not inside
- `chokidar` warnings in logs

**Phase to address:**
Phase 2 (Docker Compose) - Vite config must be updated when adding docker-compose file. Include HMR test in phase acceptance criteria.

---

### Pitfall 4: Celery Startup Race with Redis

**What goes wrong:**
Celery worker crashes on startup with "Cannot connect to redis://..." even though Redis container is healthy. This happens because `depends_on: service_healthy` only ensures Redis container is ready, not that it's accepting connections. Race condition between Redis socket binding and Celery connection attempt.

**Why it happens:**
The existing backend uses `broker_connection_retry_on_startup=True` (line 47 in celery_app.py), but this is a Celery 5.3+ feature that may not be in current installation. Docker health checks verify `redis-cli ping` succeeds, but binding to network interface takes additional milliseconds. Without retry logic, Celery makes one attempt and fails.

**How to avoid:**
1. Verify Celery >= 5.3 in requirements.txt for `broker_connection_retry_on_startup`
2. Add explicit retry loop in entrypoint-celery.sh before starting worker
3. Use `broker_connection_retry=True` and `broker_connection_max_retries=10` as belt-and-suspenders
4. Redis health check should be: `redis-cli ping && sleep 0.5` to add buffer
5. Consider separate `celery-check` script that waits for Redis before exec'ing worker

**Warning signs:**
- Celery worker exits immediately after Redis startup
- "Max retries exceeded" in Celery logs
- Works when containers started sequentially, fails when `docker-compose up`
- No Celery logs (crashed before initialization)
- Celery restarts repeatedly in first 10 seconds

**Phase to address:**
Phase 2 (Docker Compose) - Celery service configuration must include proper dependencies and retry logic. Critical for notification system reliability.

---

### Pitfall 5: Volume Permission Hell - Photo Storage

**What goes wrong:**
Backend container (running as non-root user `appuser` UID 1000) cannot write to `/app/photos` volume. Permission denied errors on photo upload. Works in Kubernetes (persistent volumes mounted with correct permissions) but fails in docker-compose. Or reverse: works locally but breaks in production.

**Why it happens:**
Docker bind mounts inherit host filesystem permissions. If host directory is owned by your user (UID 1000) but container runs as different UID, writes fail. Named volumes have Docker-managed permissions but may not match container user. The existing Dockerfile creates `appuser` with UID 1000 (line 27 in backend/Dockerfile), assuming host user is also UID 1000 - not always true.

**How to avoid:**
1. Use named volume (not bind mount) for photos in docker-compose:
```yaml
volumes:
  photos_data:
    driver: local
```
2. Add entrypoint script chown step (as root) before switching to appuser:
```bash
if [ "$ENVIRONMENT" = "development" ]; then
  chown -R appuser:appuser /app/photos
fi
```
3. OR run container as root in development (acceptable tradeoff)
4. Document that `/app/photos` must be writable by UID 1000
5. Add startup check that attempts to write test file to volume

**Warning signs:**
- 500 errors when uploading photos in local development
- "Permission denied" in backend logs for `/app/photos/`
- Photos upload successfully but can't be read back
- Works on Linux but fails on macOS/Windows
- `ls -la /app/photos` inside container shows wrong owner

**Phase to address:**
Phase 2 (Docker Compose) - Volume configuration must be correct from the start. Add upload test to phase acceptance criteria.

---

### Pitfall 6: Environment Variable Sprawl and Leakage

**What goes wrong:**
Docker-compose.yml becomes a secret dumping ground with production credentials accidentally committed. Variables meant for production leak into development (like WEBHOOK_URL pointing to real Discord). Development uses different database URLs, OIDC endpoints, and secrets but no systematic way to manage them. Git history contains exposed OIDC client secrets.

**Why it happens:**
Developers copy production config to docker-compose for convenience. The existing docker-compose.yml (lines 26-37) has improved from earlier versions but still has mixed approaches: some vars use `${VAR:?ERROR}` (fail if missing), others use `${VAR:-default}`, others are hardcoded. No single source of truth for dev config. `.env` file not in `.gitignore` or `.env.example` not provided.

**How to avoid:**
1. Create `.env.example` with all required vars, dummy values
2. Add `.env` to `.gitignore` (probably already there, verify)
3. Use explicit defaults for ALL dev-only settings in docker-compose:
```yaml
ENVIRONMENT: development  # Never default
COOKIE_SECURE: "false"  # Explicit override
DATABASE_URL: postgresql+asyncpg://reptile_tracker:dev_password@postgres:5432/reptile_tracker
```
4. Fail-fast for secrets: `${SECRET_KEY:?SECRET_KEY required}`
5. Document in README: "Never commit `.env`, never use production values in docker-compose"
6. Add pre-commit hook to detect production domain/URL patterns

**Warning signs:**
- Production webhook notifications during local testing
- Real user emails in development logs
- Cannot start docker-compose without production secrets
- Docker-compose.yml contains URLs with real domains
- `.env` file in git history
- Different developers have different working configurations

**Phase to address:**
Phase 1 (Setup) - Before any code changes. Create `.env.example`, update docker-compose.yml, document in README.

---

### Pitfall 7: Frontend Nginx Config Assumes Backend Service Name

**What goes wrong:**
Frontend container (nginx) cannot proxy to backend because service name resolution fails or DNS timing issue. Nginx starts before backend is ready, caches DNS failure, continues returning 502 Bad Gateway even after backend starts. The existing nginx.conf has no proxy_pass rules - assumes backend is reached via external URL during development.

**Why it happens:**
Current nginx.conf is production-focused (security headers for external access). In docker-compose, frontend needs to proxy `/api/` requests to `http://backend:8000` but configuration doesn't include this. Nginx resolves DNS at startup, not per-request. If backend service not ready, nginx caches negative response.

**How to avoid:**
1. Create `nginx.dev.conf` for docker-compose with proxy rules:
```nginx
location /api/ {
    proxy_pass http://backend:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    resolver 127.0.0.11 valid=10s;  # Docker DNS
}
```
2. Use Docker's internal DNS resolver to avoid caching
3. Add backend health check dependency for frontend service
4. OR skip nginx in development - run Vite dev server directly on port 5173
5. Frontend Dockerfile: `COPY ${NGINX_CONFIG:-nginx.conf} /etc/nginx/conf.d/default.conf`

**Warning signs:**
- Frontend loads but API calls return 502
- Works when accessing backend:8000 directly
- `docker-compose logs frontend` shows "upstream timed out"
- Fresh container start works, subsequent requests fail
- Nginx resolves to wrong IP after backend restart

**Phase to address:**
Phase 2 (Docker Compose) - Frontend service configuration. Consider skipping nginx entirely in dev environment (use Vite dev server).

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skipping OIDC in development, using hardcoded tokens | Fast local testing without identity provider | Bypass code exists in production, security risk if leaked | Only if bypass route is conditionally registered (not just guarded) |
| Running container as root to avoid permission issues | No volume permission problems | Security risk, masks production issues | Never acceptable, even in development |
| Using `cookie_secure=false` in all environments | Works everywhere without HTTPS | Opens MITM vulnerabilities in production | Acceptable in development, must be environment-gated |
| Hardcoding `localhost` URLs in docker-compose | Quick to set up | Breaks when running in different network contexts | Acceptable only if documented and alternatives provided |
| Disabling Celery in development | Simpler stack, faster startup | Async task behavior not tested locally | Acceptable for frontend-only work, not for notification work |
| Using SQLite instead of PostgreSQL in development | Zero-config database | SQL dialect differences cause production bugs | Never acceptable for this app (already using PostgreSQL) |
| Bind mounting entire backend directory including `__pycache__` | Simple volume configuration | Python bytecode from different Python versions causes import errors | Never - always exclude `__pycache__` or use named volumes |
| Committing `.env` file to git for convenience | Team has working config immediately | Secrets in git history forever | Never acceptable |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PostgreSQL | Using `localhost:5432` from backend container | Use service name: `postgres:5432` in docker-compose |
| Redis (Celery) | Assuming Redis ready when container starts | Add health check + Celery retry config + entrypoint wait loop |
| OIDC Provider | Using production OIDC endpoint from localhost | Set up local Authentik instance OR use dev bypass mode |
| Frontend -> Backend | Using `http://localhost:8000` in React code | Use relative URLs `/api/...` and proxy in nginx OR use `http://backend:8000` from browser |
| Photo Storage | Binding to host directory without checking permissions | Use named volume with explicit permission setup in entrypoint |
| External Webhooks | Using production webhook URLs in development | Set `WEBHOOK_URL=""` in docker-compose to disable notifications |
| CORS | Allowing `*` in development | Explicitly allow `http://localhost:3000` to match production behavior |
| Database Migrations | Running migrations from host machine | Always run migrations inside container (entrypoint.sh handles this) |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Polling-based file watching | High CPU usage in Docker | Use Vite's polling with reasonable interval (1000ms) | >5000 files in project |
| Mounting entire `node_modules` from host | Extremely slow frontend startup in Docker | Use named volume for node_modules, only mount src/ | >200 dependencies |
| Not using `.dockerignore` | Huge Docker build contexts | Add `.git/`, `node_modules/`, `*.pyc` to .dockerignore | >100MB source directory |
| Database without volume | Lose all data on container restart | Use named volume for postgres_data | First container restart |
| Logs to stdout without limits | Container disk fills up | Use Docker log rotation: `--log-opt max-size=10m` | After 1-2 days of running |
| No restart policy | Manual restart after crash | Use `restart: unless-stopped` in docker-compose | First unhandled exception |
| Not using multi-stage builds for frontend | 1.5GB frontend image | Multi-stage: build in node:20, serve in nginx:alpine | Always - current Dockerfile already does this |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Leaving auth bypass endpoint registered in production | Authentication bypass vulnerability | Conditionally register route only when ENVIRONMENT=development |
| Committing OIDC client secret to git | Credential exposure in public repos | Use .env file (gitignored) and .env.example with dummy values |
| Using weak SECRET_KEY in docker-compose defaults | JWT tokens can be forged | Require SECRET_KEY from environment, fail if not set: `${SECRET_KEY:?ERROR}` |
| Disabling COOKIE_SECURE globally | Session hijacking over HTTP | Environment-based config: false in dev, true in production |
| Exposing PostgreSQL port to host | Database accessible from network | Only expose ports needed for debugging, comment out by default |
| Using same database for dev and production | Accidentally deleting production data | Always use separate databases, ideally separate instances |
| Hardcoding `SQLALCHEMY_ECHO=true` | SQL queries (possibly with PII) in logs | Only enable in development via environment variable |
| No rate limiting in development | Rate limit logic not tested | Keep rate limiting enabled, use high limits in development |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| HMR not working | Constant manual refreshes, slow development | Test HMR as part of docker-compose setup checklist |
| Slow container startup | 2+ minutes to start, breaks flow | Use build caching, install deps in image not at runtime |
| No clear setup instructions | Can't get environment running | README with step-by-step setup, prerequisites, troubleshooting |
| Debugging requires restarting containers | Long feedback loops | Mount source code volumes for hot reload |
| Production auth required in development | Need access to Authentik for local work | Auth bypass mode documented in README |
| Unclear error messages on missing env vars | Random crashes during startup | Use `${VAR:?ERROR - VAR required}` syntax with helpful messages |
| Different port numbers than production | Confusion about what URLs to use | Document port mapping, keep paths consistent |
| No way to reset to clean state | Accumulated test data causes issues | Add `make clean` command to remove volumes and reset database |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Docker Compose File:** Often missing healthchecks - verify `condition: service_healthy` works by stopping dependency and checking dependent service fails
- [ ] **Auth Bypass:** Often missing production safety check - verify bypass route returns 404 when ENVIRONMENT=production
- [ ] **Volume Mounts:** Often wrong user ownership - verify file write succeeds from inside container: `docker-compose exec backend touch /app/photos/test.txt`
- [ ] **Hot Reload:** Often silently broken - verify changing a file triggers reload without manual refresh
- [ ] **Environment Variables:** Often has hardcoded secrets - verify docker-compose up fails without .env file
- [ ] **Database Migrations:** Often not automated - verify migrations run on startup without manual intervention
- [ ] **Celery Worker:** Often starts before Redis ready - verify Celery doesn't crash loop on fresh `docker-compose up`
- [ ] **Frontend API Proxy:** Often missing or misconfigured - verify API calls work from browser at http://localhost:3000
- [ ] **README Instructions:** Often out of date - verify fresh checkout can be started by following README exactly
- [ ] **Cookie Settings:** Often still using production values - verify COOKIE_SECURE=false in docker-compose environment

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Auth bypass in production | HIGH | Immediately redeploy with bypass disabled, rotate JWT secret, audit access logs, force all users to re-authenticate |
| Secrets in git history | HIGH | Rotate all secrets, use `git filter-branch` or BFG Repo Cleaner, notify team, update documentation |
| Volume permission issues | LOW | `docker-compose down -v`, recreate volumes, or add chown to entrypoint script and restart |
| Celery crash loop | LOW | Fix health check, add retry logic to celery_app.py, restart stack |
| Vite HMR not working | LOW | Add polling config to vite.config.ts, restart frontend service |
| COOKIE_SECURE breaking dev | LOW | Set COOKIE_SECURE=false in docker-compose.yml backend environment, restart backend |
| Frontend 502 to backend | MEDIUM | Add proxy config to nginx.dev.conf or switch to Vite dev server, rebuild frontend image |
| Database connection failures | LOW | Verify DATABASE_URL uses service name (postgres) not localhost, check postgres healthcheck |
| Environment variable leakage | MEDIUM | Create .env.example, remove secrets from docker-compose.yml, git rm .env, update .gitignore |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Auth bypass leaks to production | Phase 1 - Dev Auth Mode | Start with ENVIRONMENT=production, verify bypass route returns 404 not 401 |
| Secure cookie breaks localhost | Phase 1 - Dev Auth Mode | Verify login works in docker-compose without mkcert/HTTPS |
| Vite HMR silent failure | Phase 2 - Docker Compose | Change a React component, verify page updates without F5 |
| Celery startup race with Redis | Phase 2 - Docker Compose | `docker-compose down && docker-compose up`, verify no Celery crash |
| Volume permission hell | Phase 2 - Docker Compose | Upload photo from frontend, verify no 500 error and file exists |
| Environment variable sprawl | Phase 1 - Setup | `.env` in `.gitignore`, `.env.example` exists, docker-compose has no secrets |
| Frontend nginx proxy issues | Phase 2 - Docker Compose | Frontend at localhost:3000, verify API calls succeed (Network tab) |
| Database migrations not automated | Phase 2 - Docker Compose | Fresh database, verify tables created automatically on first start |
| Hardcoded production URLs | Phase 1 - Setup | Grep codebase for production domains, verify none in docker-compose |
| Missing setup documentation | Phase 2 - Docker Compose | Fresh checkout on new machine, follow README, verify success |

## Sources

**Development Best Practices:**
- [FastAPI in Containers - Docker](https://fastapi.tiangolo.com/deployment/docker/)
- [FastAPI Docker Best Practices | Better Stack Community](https://betterstack.com/community/guides/scaling-python/fastapi-docker-best-practices/)
- [How to Build Fast API Application using Docker Compose | DigitalOcean](https://www.digitalocean.com/community/tutorials/create-fastapi-app-using-docker-compose)

**Authentication & Security:**
- [Security - FastAPI](https://fastapi.tiangolo.com/tutorial/security/)
- [FastAPI Security Pitfalls That Almost Leaked My User Data | Medium](https://medium.com/@ThinkingLoop/fastapi-security-pitfalls-that-almost-leaked-my-user-data-c9903bc13fd7)
- [How to secure APIs built with FastAPI: A complete guide](https://escape.tech/blog/how-to-secure-fastapi-api/)
- [Localhost Cookies: Complete Developer's Guide to Local Development with Cookies in 2026](https://copyprogramming.com/howto/localhost-development-with-cookies)
- [Secure/HTTPOnly cookies untestable · Issue #3339 · fastapi/fastapi](https://github.com/fastapi/fastapi/issues/3339)

**Vite HMR in Docker:**
- [Docker + Vite + HMR = No/Slow reload · vitejs/vite · Discussion #14007](https://github.com/vitejs/vite/discussions/14007)
- [Hot reload not working in Docker container · Issue #396](https://github.com/fi3ework/vite-plugin-checker/issues/396)
- [Dockerizing Your React App with Hot Reloading (Yarn and Vite) | Medium](https://medium.com/@sankettikam17/dockerizing-your-react-app-with-hot-reloading-yarn-and-vite-a-smooth-development-workflow-303ae51ac11a)
- [Vite Docker HMR Guide | Restackio](https://www.restack.io/p/vite-answer-docker-hmr-guide)

**Docker Compose Service Dependencies:**
- [Control startup order - Docker Compose](https://docs.docker.com/compose/how-tos/startup-order/)
- [How to Use Docker Compose depends_on with Health Checks](https://oneuptime.com/blog/post/2026-01-16-docker-compose-depends-on-healthcheck/view)
- [Docker Compose Health Checks: An Easy-to-follow Guide | Last9](https://last9.io/blog/docker-compose-health-checks/)
- [Docker Compose Service Dependencies: Solving Database Startup Sequence](https://eastondev.com/blog/en/posts/dev/20251217-docker-compose-healthcheck/)

**Celery & Redis:**
- [Celery 2026: Python Distributed Task Queue, Redis, RabbitMQ, and the 5.6 Recovery Release](https://www.programming-helper.com/tech/celery-2026-python-distributed-task-queue-redis-rabbitmq)
- [Django, Docker Compose, Celery, and Remote Redis: Complete 2026 Configuration Guide](https://copyprogramming.com/howto/django-docker-compose-celery-redis-how-to-use-redis-deployed-in-my-own-remote-server)
- [Configure Docker Compose startup order for Django, REST Framework and Celery/RabbitMQ/Redis | Medium](https://kenanbek.medium.com/configure-docker-compose-startup-order-for-django-rest-framework-and-celery-rabbitmq-redis-127f7a482626)

**Volume Permissions:**
- [How to Fix "Permission Denied" Errors in Docker Volumes](https://oneuptime.com/blog/post/2026-01-24-fix-permission-denied-docker-volumes/view)
- [Fix Docker Permission Denied: Volumes, Bind Mounts & CI/CD](https://www.buildwithmatija.com/blog/how-to-fix-permission-denied-when-manipulating-files-in-docker-container)
- [Handling Permissions with Docker Volumes - Deni Bertović](https://denibertovic.com/posts/handling-permissions-with-docker-volumes/)
- [Docker Compose Shell Permission Volume Issues: Complete 2026 Guide](https://copyprogramming.com/howto/docker-compose-volume-permissions-linux)

**12-Factor App & Environment Parity:**
- [The Twelve-Factor App - Dev/Prod Parity](https://12factor.net/dev-prod-parity)
- [12 factor app configuration vs leaking environment variables · GitHub](https://gist.github.com/telent/9742059)
- [Environment Parity - Beyond the Twelve-Factor App](https://www.oreilly.com/library/view/beyond-the-twelve-factor/9781492042631/ch09.html)

---

*Research confidence: HIGH - based on official documentation, 2026 guides, known issues in Vite/Docker/FastAPI ecosystems, and analysis of existing reptile-tracker codebase*
