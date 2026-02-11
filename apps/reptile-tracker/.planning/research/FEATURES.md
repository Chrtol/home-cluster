# Feature Research

**Domain:** Local Development Environment
**Researched:** 2026-02-11
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features developers assume exist in local dev environments. Missing these = frustrating development experience.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single command startup | Industry standard (`docker compose up`) | LOW | Already implemented - docker-compose.yml exists |
| Hot reload for code changes | Required for rapid iteration | MEDIUM | Backend has `--reload`, frontend needs Vite HMR configuration |
| Auto-migrations on startup | Prevents "forgot to migrate" errors | LOW | Backend already runs Alembic migrations on container start |
| Local data persistence | Keep data between restarts | LOW | Already implemented - postgres_data volume exists |
| Environment variable configuration | Standard for Docker development | LOW | .env.example files exist, need dev-specific defaults |
| No external dependencies | Must work offline/without auth provider | MEDIUM | Currently requires Authentik OIDC - needs bypass mode |
| Fast feedback loop | Sub-10 second change-to-browser | MEDIUM | Vite supports HMR, need proper Docker config |
| Service health checks | Know when stack is ready | LOW | Postgres has healthcheck, backend depends on it |
| Background worker support | Celery/Redis for async tasks | MEDIUM | Not currently in docker-compose.yml - critical gap |
| Photo storage in development | Test photo upload without S3/NFS | LOW | Local storage backend exists, needs volume mount |

### Differentiators (Competitive Advantage)

Features that make local development exceptional. Not required, but highly valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Development auth bypass | Zero-friction testing - no login clicks | LOW | Auto-login as dev@localhost when ENVIRONMENT=development |
| Seeded test data | Start with realistic data immediately | LOW | seed_data.py exists - run on first startup or via flag |
| Watch mode with live logs | See backend/frontend logs in real-time | LOW | `docker compose logs -f` - document in README |
| Photo uploads work locally | No S3/NFS setup required | LOW | Use local storage backend with mounted volume |
| Production parity | Same stack as production (Postgres, Redis, Celery) | MEDIUM | Ensures bugs are caught locally |
| Celery worker visibility | See background jobs processing | LOW | Add Flower for Celery monitoring (optional but helpful) |
| One-command teardown | `docker compose down -v` resets to clean state | LOW | Documentation improvement |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems in development environments.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Shared dev database | "Share data with team" | State conflicts, hard to reset, migration hell | Each dev has own database via docker-compose |
| Mock/stub external services | "Faster than real services" | Doesn't catch integration bugs, diverges from prod | Use real Postgres/Redis in containers - fast enough |
| Auto-watch everything | "Maximum convenience" | High CPU usage, slow reloads on large projects | Watch only source code, not node_modules/venv |
| Pre-built images for dev | "Faster startup" | Must rebuild to see code changes, cache invalidation issues | Use volume mounts + hot reload - instant changes |
| Development-specific schema | "Simpler for local testing" | Schema drift from production, migration bugs | Use same migrations/schema as production |

## Feature Dependencies

```
[Hot reload for frontend]
    └──requires──> [Volume mount for src/]
    └──requires──> [Vite HMR configuration]

[Background job testing]
    └──requires──> [Redis service]
    └──requires──> [Celery worker service]
    └──requires──> [Celery beat service (for scheduled tasks)]

[Development auth bypass]
    └──requires──> [ENVIRONMENT=development detection]
    └──requires──> [Mock user creation in auth.py]

[Photo uploads locally]
    └──requires──> [Volume mount for photo storage]
    └──requires──> [PHOTO_STORAGE_BACKEND=local]

[Seeded test data]
    └──enhances──> [Development auth bypass] (provides data for test user)
    └──requires──> [Database migration completion]
```

### Dependency Notes

- **Hot reload requires volume mounts:** Without mounting source code, changes won't be visible in containers
- **Background jobs require full Celery stack:** Redis (broker), Celery worker, Celery beat (scheduler) - all three needed for notifications/auto-complete
- **Development auth bypass requires environment detection:** Must only activate when ENVIRONMENT=development to prevent production misuse
- **Photo uploads require volume mount:** Local storage backend needs persistent directory mounted from host
- **Seeded data enhances auth bypass:** Provides households, reptiles, schedules for the test user to interact with

## MVP Definition

### Launch With (v1)

Minimum viable local development environment - what's needed for productive development.

- [x] Single command startup (`docker compose up`) — Already working
- [ ] Development auth bypass (auto-login as dev@localhost) — CRITICAL - eliminates 3-6 minute CI/CD loop
- [ ] Hot reload for frontend (Vite HMR) — CRITICAL - instant feedback on UI changes
- [ ] Backend hot reload (`--reload`) — Already implemented
- [ ] Redis service — CRITICAL - needed for Celery/notifications
- [ ] Celery worker service — CRITICAL - notifications won't work without it
- [ ] Celery beat service — CRITICAL - scheduled tasks (auto-complete, overdue detection)
- [ ] Photo storage volume mount — Needed to test photo uploads
- [ ] Environment-specific .env defaults — Simplifies setup

### Add After Validation (v1.x)

Features to add once core is working and developers have used it.

- [ ] Seeded test data on first startup — Trigger when database is empty, provides realistic test data
- [ ] Flower for Celery monitoring — Helpful for debugging background jobs, but not blocking
- [ ] Development-specific logging (more verbose) — Easier debugging after basic setup works
- [ ] README section for common dev workflows — Document after patterns emerge

### Future Consideration (v2+)

Features to defer until local dev is proven and stable.

- [ ] VSCode devcontainer configuration — Nice for consistency, but docker-compose is sufficient
- [ ] Pre-commit hooks for linting — Quality feature, not required for basic dev
- [ ] Local S3 emulator (MinIO) — Only if S3 backend becomes critical to test locally
- [ ] Database snapshot/restore scripts — Convenient but not essential with seed data

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Development auth bypass | HIGH | LOW | P1 |
| Frontend hot reload (Vite HMR) | HIGH | MEDIUM | P1 |
| Redis service | HIGH | LOW | P1 |
| Celery worker service | HIGH | LOW | P1 |
| Celery beat service | HIGH | LOW | P1 |
| Photo storage volume | MEDIUM | LOW | P1 |
| Seeded test data | MEDIUM | LOW | P2 |
| Flower monitoring | LOW | LOW | P2 |
| Verbose dev logging | MEDIUM | LOW | P2 |
| Development README docs | MEDIUM | LOW | P2 |
| VSCode devcontainer | LOW | MEDIUM | P3 |
| Pre-commit hooks | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch (blocks productive development)
- P2: Should have, add when possible (improves experience)
- P3: Nice to have, future consideration (polish)

## Existing vs Required Features

### Already Implemented
- Docker Compose with Postgres, backend, frontend services
- Health checks for Postgres
- Volume mount for backend code (`./backend/app:/app/app`)
- Auto-migrations on backend startup
- Local photo storage backend option
- Environment variable configuration via .env

### Missing (Required for MVP)
- **Development auth mode:** No bypass for OIDC - every test requires Authentik login
- **Redis service:** Needed for Celery broker - notifications/background jobs won't work
- **Celery worker:** Background job processing (notifications, auto-complete)
- **Celery beat:** Scheduled task execution (overdue detection, auto-complete timing)
- **Frontend hot reload:** Vite HMR not configured for Docker - must rebuild to see changes
- **Photo volume mount:** Photos not persisted, can't test upload features
- **Development-specific .env:** Defaults still require Authentik secrets

### Existing Features to Preserve
- OIDC integration (production mode) - keep for production parity
- Postgres with volume persistence - perfect for local dev
- Backend hot reload (`--reload`) - already working
- Frontend proxy configuration - already routing /api and /auth

## Implementation Notes

### Development Auth Bypass Pattern
Based on research, the standard pattern is:
1. Detect `ENVIRONMENT=development` in config
2. Add optional auth bypass endpoint or middleware
3. Auto-create dev user on startup if not exists
4. Return pre-signed JWT token for dev user
5. Frontend auto-fetches token on mount in dev mode
6. **CRITICAL:** Must be environment-gated to prevent production use

### Vite HMR in Docker
Based on research, Vite requires specific configuration:
1. Set `server.host: "0.0.0.0"` in vite.config.js (already done with `host: true`)
2. Set `server.hmr.clientPort` to match exposed port (3000)
3. Enable polling for file watching in Docker: `server.watch.usePolling: true`
4. Mount source code as volume (not copying in Dockerfile)
5. Expose port 3000 for HMR websocket connection

### Flask/FastAPI + Celery + Redis Pattern
Standard docker-compose.yml structure:
```yaml
services:
  redis:
    image: redis:7-alpine

  celery-worker:
    build: ./backend
    command: celery -A app.celery_app worker --loglevel=info
    depends_on: [redis, postgres]

  celery-beat:
    build: ./backend
    command: celery -A app.celery_app beat --loglevel=info
    depends_on: [redis, postgres]
```

### Photo Storage Volume
```yaml
backend:
  volumes:
    - ./backend/app:/app/app  # Code hot reload
    - ./dev-photos:/app/photos  # Photo persistence
  environment:
    PHOTO_STORAGE_BACKEND: local
    LOCAL_STORAGE_PATH: /app/photos
```

## Sources

**Development Environment Best Practices:**
- [The Ultimate Guide to a Smooth Dev Environment | Speedscale](https://speedscale.com/blog/the-ultimate-guide-to-a-smooth-dev-environment-setup-tips-and-best-practices/)
- [Best Practices Setting up Your Local Development Environment - Deckrun](https://deckrun.com/blog/best-practices-setting-up-your-local-development-environment)
- [Optimize local dev environments for better onboarding - GitHub](https://github.com/readme/guides/developer-onboarding)

**Docker Compose Development Workflows:**
- [Docker for Full Stack Developers in 2026 - Nucamp](https://www.nucamp.co/blog/docker-for-full-stack-developers-in-2026-containers-compose-and-production-workflows)
- [How to Use Docker Compose Watch for Live Development](https://oneuptime.com/blog/post/2026-01-16-docker-compose-watch/view)
- [Setting up a local development environment using Docker Compose](https://medium.com/simform-engineering/setting-up-a-local-development-environment-using-docker-compose-551efb4ec0ee)

**Vite Hot Reload with Docker:**
- [Dockerizing Your React App with Hot Reloading (Yarn and Vite) - Medium](https://medium.com/@sankettikam17/dockerizing-your-react-app-with-hot-reloading-yarn-and-vite-a-smooth-development-workflow-303ae51ac11a)
- [Hot Reloading - Docker: Beginner to Pro](https://courses.devopsdirective.com/docker-beginner-to-pro/lessons/11-development-workflow/01-hot-reloading)
- [How to have ViteJS to Hot Reload when inside a Docker Container](https://patrickdesjardins.com/blog/docker-vitejs-hot-reload)

**Flask/Celery/Redis Docker Compose:**
- [Dockerize a Flask, Celery, and Redis Application - Nick Janetakis](https://nickjanetakis.com/blog/dockerize-a-flask-celery-and-redis-application-with-docker-compose)
- [The Definitive Guide to Celery and Flask - TestDriven.io](https://testdriven.io/courses/flask-celery/docker/)
- [GitHub - docker-flask-celery-redis](https://github.com/mattkohl/docker-flask-celery-redis)

**Environment Variables and Configuration:**
- [Best practices | Docker Docs](https://docs.docker.com/compose/how-tos/environment-variables/best-practices/)
- [Flask Environment Specific Configurations - GeeksforGeeks](https://www.geeksforgeeks.org/flask-environment-specific-configurations/)
- [How to Use Docker Environment Files (.env) Effectively](https://oneuptime.com/blog/post/2026-01-16-docker-env-files/view)

**Volume Mounts Development vs Production:**
- [How to Choose Between Docker Bind Mounts and Named Volumes](https://oneuptime.com/blog/post/2026-01-16-docker-bind-mounts-vs-volumes/view)
- [Volumes | Docker Docs](https://docs.docker.com/engine/storage/volumes/)
- [6 Docker Compose Best Practices for Dev and Prod | Release](https://release.com/blog/6-docker-compose-best-practices-for-dev-and-prod)

**Development Authentication Patterns:**
- [Auto-Login for Swagger Documentation in NestJS - Medium](https://medium.com/@kevinalbertoorellana/auto-login-for-swagger-documentation-in-nestjs-streamlining-development-authentication-7f481781b211)

---
*Feature research for: Local Development Environment for Reptile Tracker*
*Researched: 2026-02-11*
