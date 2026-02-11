# Project Research Summary

**Project:** Reptile Tracker Local Development Environment
**Domain:** Docker Compose development environment for existing FastAPI + React + Celery application
**Researched:** 2026-02-11
**Confidence:** HIGH

## Executive Summary

The Reptile Tracker needs a local development environment that eliminates the 3-6 minute CI/CD deployment loop currently blocking rapid iteration. Research shows the standard approach is Docker Compose orchestrating all services (PostgreSQL, Redis, Celery worker, backend API, frontend dev server) with development-specific configurations for authentication bypass, hot reload, and service health checks. The recommended stack uses Redis 8.6.0-alpine (100% compatible with production Dragonfly), Vite dev server with polling-based HMR for Docker volume watching, and FastAPI dependency injection for environment-gated auth bypass.

The critical success factors are: (1) Development auth bypass that cannot leak to production through explicit environment allowlisting, (2) Vite HMR configuration with usePolling for Docker file watching, (3) Celery worker startup coordination with Redis using health checks and broker retry configuration, and (4) Volume permission handling for photo storage. All changes must be additive to preserve production deployment - no modifications to existing production code paths.

Key risks include authentication bypass accidentally enabled in production (mitigate with conditional route registration and startup validation), Vite HMR silently failing in Docker (mitigate with explicit polling configuration and acceptance testing), and volume permission conflicts between development bind mounts and production persistent volumes (mitigate with named volumes and entrypoint permission fixes). Implementation should proceed in phased iterations to minimize integration risk and validate each service independently before full-stack integration.

## Key Findings

### Recommended Stack

The research converges on a production-parity approach using Docker Compose to orchestrate local equivalents of all production services. Redis 8.6.0-alpine replaces Dragonfly (100% protocol compatible), local PostgreSQL 16 matches CloudNative-PG version, and Celery worker uses the same backend code with development environment variables. Frontend switches from production nginx serving to Vite dev server for hot module replacement.

**Core technologies:**
- **Docker Compose 3.8+**: Service orchestration - industry standard for multi-container development, provides dependency management and consistent environments
- **Redis 8.6.0-alpine**: Celery message broker - latest stable (Feb 2026), production uses Dragonfly which is 100% Redis compatible
- **Vite Dev Server 5.4.11**: Frontend hot reload - requires Docker-specific config (host: true, usePolling: true) to work with volume mounts
- **FastAPI dependency injection**: Auth bypass mechanism - app.dependency_overrides pattern allows environment-gated substitution without modifying route handlers
- **Multi-stage Dockerfiles**: Separate development and production stages - development includes debug tools, production remains minimal and secure

**Critical version compatibilities:**
- celery==5.4.0 compatible with redis==5.2.0 Python client
- Redis 5.2.0 Python client supports Redis server 3.x-8.x
- Vite 5.4.11 requires Node 18+ (using Node 20 LTS)
- FastAPI 0.115.0 requires Pydantic v2 (already using 2.9.2)

### Expected Features

Development environments have evolved from "just run the app" to "instant feedback with production parity." Developers expect sub-10 second change-to-browser cycles, zero-friction testing without external dependencies, and one-command setup/teardown.

**Must have (table stakes):**
- **Single command startup** - `docker compose up` starts entire stack - users expect this as industry standard
- **Hot reload for code changes** - Backend with uvicorn --reload, frontend with Vite HMR - required for rapid iteration
- **No external dependencies** - Must work offline without Authentik OIDC - currently blocks local development
- **Background worker support** - Celery/Redis for async tasks - notifications won't work without this
- **Service health checks** - Know when stack is ready, prevent startup race conditions
- **Auto-migrations on startup** - Prevents "forgot to migrate" errors - already implemented in entrypoint.sh
- **Photo storage that works** - Test photo uploads without S3/NFS - needs volume mount with correct permissions

**Should have (competitive advantage):**
- **Development auth bypass** - Auto-login as dev@localhost when ENVIRONMENT=development - eliminates 3-6 minute CI/CD loop for testing
- **Seeded test data** - Start with realistic data immediately using existing seed_data.py
- **Production parity** - Same stack as production (Postgres, Redis pattern, Celery) ensures bugs caught locally
- **Watch mode with live logs** - `docker compose logs -f` for real-time debugging
- **One-command teardown** - `docker compose down -v` resets to clean state

**Defer (v2+):**
- **Flower for Celery monitoring** - Helpful for debugging background jobs but not blocking (port 5555 UI)
- **VSCode devcontainer configuration** - Nice for consistency but docker-compose is sufficient
- **Pre-commit hooks for linting** - Quality feature, not required for basic dev
- **Local S3 emulator (MinIO)** - Only if S3 backend becomes critical to test locally

**Anti-features to avoid:**
- Shared dev database - causes state conflicts, hard to reset, migration hell
- Pre-built images for dev - must rebuild to see code changes, use volume mounts instead
- Auto-watch everything - high CPU usage, watch only src/ not node_modules/venv
- Mock external services - doesn't catch integration bugs, use real Postgres/Redis in containers

### Architecture Approach

The integration architecture is additive only - new development-specific services and configuration files that leave production deployment untouched. Backend gains a development stage in its Dockerfile and conditional auth bypass dependency registration. Frontend gets a separate Dockerfile.dev for Vite dev server (production continues using multi-stage nginx build). All configuration switches on a single ENVIRONMENT variable.

**Major components:**

1. **Development Auth Bypass** - New `get_dev_user()` function in auth.py registered via `app.dependency_overrides[get_current_user]` only when ENVIRONMENT=development. Creates/returns mock user without OIDC validation. Completely isolated from production code paths.

2. **Docker Compose Service Stack** - Extends existing docker-compose.yml with redis, celery-worker, celery-beat services. Modifies backend to use development Dockerfile stage with volume mounts for hot reload. Replaces frontend nginx with Vite dev server using new Dockerfile.dev.

3. **Environment Configuration** - .env file (gitignored) with development-specific overrides: REDIS_URL=redis://redis:6379/0, COOKIE_SECURE=false, ENVIRONMENT=development. Triggers all dev-specific behavior without code changes.

4. **Volume Management** - Code directories mounted for hot reload (./backend/app, ./frontend/src), named volume for photo storage (avoids permission issues), postgres_data volume for database persistence (already exists).

5. **Service Coordination** - Health checks for postgres and redis with depends_on: service_healthy to prevent startup races. Celery worker configured with broker_connection_retry_on_startup=True for Redis timing tolerance.

**Data flow changes:**
- **Production auth:** Browser → Authentik OIDC → Backend validates → JWT in cookie → API requests
- **Development auth:** Browser → API request → get_dev_user() override → Mock user → Response
- **Celery production:** Backend → Dragonfly cluster → Celery worker (K8s pod) → Database
- **Celery development:** Backend → Redis (local) → Celery worker (docker container) → PostgreSQL (local)
- **Frontend production:** npm run build → dist/ → Nginx serves static → Browser
- **Frontend development:** npm run dev → Vite dev server → HMR WebSocket → Browser auto-updates

**Integration points:**
- Backend to Redis to Celery: REDIS_URL environment variable (already supported in celery_app.py)
- Frontend to Backend: Vite proxy in vite.config.js for /api and /auth (already configured)
- Backend to Database: DATABASE_URL with service name `postgres:5432` (not localhost)
- Photo storage: LOCAL_STORAGE_PATH=/app/photos with docker volume mount

### Critical Pitfalls

Research identified 7 critical pitfalls that have blocked similar local development implementations. The top three are authentication bypass leaking to production, Vite HMR silently failing in Docker, and Celery startup race conditions with Redis.

1. **Authentication bypass leaks into production** - Use explicit allowlist `ENVIRONMENT == "development"` never negative conditions. Register bypass routes conditionally at startup, not just guard them. Add production health check that verifies bypass routes return 404. Create separate app/auth_dev.py module. Phase 1 prevention essential.

2. **Vite HMR silent failure in Docker** - Code changes don't trigger hot reload because file watchers don't detect changes across Docker volume boundaries. Add `server.watch.usePolling: true` and `server.host: '0.0.0.0'` to vite.config.js. Use bind mount for src/ but separate volume for node_modules. Test HMR works as part of phase acceptance criteria. Phase 2 critical.

3. **Celery startup race with Redis** - Worker crashes with "Cannot connect to redis" even though Redis container is healthy. Health checks verify Redis container ready but not that it's accepting connections. Verify Celery >= 5.3 for broker_connection_retry_on_startup, add retry loop in entrypoint-celery.sh, use broker_connection_retry=True as backup. Phase 2 essential for notifications.

4. **Volume permission hell for photo storage** - Backend container (UID 1000 appuser) cannot write to /app/photos volume. Use named volume (not bind mount), add entrypoint chown step before switching to appuser, or run container as root in development (acceptable tradeoff). Test photo upload in phase acceptance criteria. Phase 2 blocker.

5. **Secure cookie flag breaks localhost development** - COOKIE_SECURE=true causes cookies set but never sent back by browser over HTTP. Set COOKIE_SECURE=false explicitly in docker-compose.yml environment. Add startup warning log when COOKIE_SECURE=false and ENVIRONMENT=production. Document this as acceptable dev/prod gap. Phase 1 auth testing blocker.

## Implications for Roadmap

Research suggests a two-phase approach with optional polish phase. Phase 1 establishes the development authentication and service infrastructure. Phase 2 adds frontend hot reload and validates full-stack integration. This order minimizes risk by validating backend changes independently before tackling the more finicky Vite HMR configuration.

### Phase 1: Development Infrastructure & Auth Bypass
**Rationale:** Backend auth bypass is the highest-value feature (eliminates 3-6 minute CI/CD loop) and has the lowest integration risk. Establishing Redis and environment configuration creates foundation for Celery integration. All changes are additive with strong production isolation.

**Delivers:**
- Docker Compose with Redis service
- Development auth bypass (auto-login as dev@localhost)
- Environment-based configuration (.env file with dev defaults)
- Backend development Dockerfile stage with hot reload
- Celery worker service for background tasks

**Addresses features:**
- Development auth bypass (table stakes - no external dependencies)
- Background worker support (table stakes - Celery/Redis)
- Service health checks (table stakes - startup coordination)

**Avoids pitfalls:**
- Pitfall 1: Auth bypass leaks to production - conditional registration, startup validation
- Pitfall 5: Secure cookie breaks localhost - COOKIE_SECURE=false in docker-compose
- Pitfall 6: Environment variable sprawl - .env.example, gitignore, fail-fast for secrets

**Technical scope:**
- Add Redis 8.6.0-alpine to docker-compose.yml with health check
- Create backend/Dockerfile multi-stage (development + production stages)
- Implement get_dev_user() in backend/app/auth.py
- Add dependency override in backend/app/main.py lifespan startup
- Create .env.example and update docker-compose.yml environment variables
- Add celery-worker service to docker-compose.yml
- Configure volume mounts for backend hot reload

**Acceptance criteria:**
- `docker compose up` starts all services without errors
- curl API endpoints return 200 without OIDC tokens
- Backend code changes reload without container restart
- Celery worker starts and connects to Redis successfully
- Photo upload creates file in mounted volume
- Starting with ENVIRONMENT=production prevents auth bypass

### Phase 2: Frontend Hot Reload & Full Stack Integration
**Rationale:** With backend working independently, frontend can be integrated with confidence. Vite HMR is the most finicky piece (Docker file watching) so isolating it reduces debugging complexity. Full-stack testing validates service coordination.

**Delivers:**
- Vite dev server with Docker-compatible HMR
- Frontend auth bypass (skips OIDC redirect)
- Photo storage volume with correct permissions
- Complete local development workflow documentation

**Addresses features:**
- Hot reload for code changes (table stakes - frontend)
- Fast feedback loop (table stakes - sub-10 second)
- Photo uploads work locally (table stakes)
- Single command startup/teardown (table stakes)

**Avoids pitfalls:**
- Pitfall 2: Vite HMR silent failure - usePolling config, acceptance testing
- Pitfall 3: Celery startup race - health check dependencies verified
- Pitfall 4: Volume permission hell - named volume with entrypoint chown
- Pitfall 7: Frontend nginx proxy - skip nginx, use Vite dev server directly

**Technical scope:**
- Create frontend/Dockerfile.dev for Vite dev server
- Modify frontend/vite.config.js for Docker (host, polling, HMR)
- Update docker-compose.yml frontend service to use Dockerfile.dev
- Add frontend auth bypass (conditional OIDC based on VITE_DEV_MODE)
- Create frontend/.env.development
- Configure photo_storage named volume
- Add entrypoint permission fix for photo directory

**Acceptance criteria:**
- Change React component, verify page updates without F5 (HMR working)
- Frontend loads at localhost:3000 and makes successful API calls
- Upload photo from frontend, verify file persists in volume
- `docker compose down -v && docker compose up` succeeds (clean state reset)
- Fresh checkout can be started by following README instructions

### Phase 3: Polish & Developer Experience (Optional)
**Rationale:** With core functionality working, enhance developer experience and documentation. These features are nice-to-have and can be deferred if time-constrained.

**Delivers:**
- Seeded test data on first startup
- Flower for Celery monitoring (port 5555)
- Comprehensive troubleshooting documentation
- docker-compose.override.yml.example for personal customization

**Addresses features:**
- Seeded test data (should-have - competitive advantage)
- Celery worker visibility (should-have - debugging)
- Development-specific logging (should-have)

**Technical scope:**
- Modify entrypoint.sh to run seed_data.py when database is empty
- Add flower service to docker-compose.yml
- Write comprehensive LOCAL_DEVELOPMENT.md
- Add troubleshooting section with common issues
- Create docker-compose.override.yml.example

### Phase Ordering Rationale

**Why Phase 1 before Phase 2:**
- Backend auth bypass has higher value (eliminates CI/CD loop) and lower risk (well-documented pattern)
- Redis and Celery needed regardless of frontend work, can be validated independently
- Environment configuration foundation used by both backend and frontend
- Frontend depends on working backend API, so backend must work first

**Why Phase 2 can't be parallelized:**
- Frontend auth bypass depends on backend auth bypass working (needs API endpoints to function)
- Vite HMR testing requires working backend to validate API calls during reload
- Volume permission issues affect both backend (code) and frontend (node_modules)

**Why Phase 3 is optional:**
- Seeded data enhances UX but isn't blocking - manual data creation works
- Flower is debugging convenience, not requirement (celery logs work)
- Documentation can be written after patterns emerge from usage

**How this avoids pitfalls:**
- Phase 1 addresses auth bypass (Pitfall 1), cookie security (Pitfall 5), environment variables (Pitfall 6) before other work
- Phase 2 addresses Vite HMR (Pitfall 2), Celery race (Pitfall 3), permissions (Pitfall 4) when infrastructure is stable
- Phased approach allows validation at each step rather than debugging full stack at once

### Research Flags

**Phases needing deeper research during planning:**
- None - this is a well-documented domain with established patterns. All technologies use standard practices (Docker Compose, FastAPI dependency injection, Vite dev server).

**Phases with standard patterns (skip research-phase):**
- Phase 1: Docker Compose + FastAPI development mode - extensive documentation, multiple 2026 guides
- Phase 2: Vite HMR in Docker - known configuration, multiple implementation guides
- Phase 3: Seeding and monitoring - straightforward implementations

**Validation during implementation:**
- Vite HMR polling interval tuning - may need adjustment based on project size (start with 1000ms)
- Celery worker concurrency - default is fine for dev, document if changes needed
- Database migration order - existing entrypoint.sh handles this, just verify it works

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Docker Compose + Redis + Celery is industry standard, well-documented pattern. Version compatibilities verified from official documentation. |
| Features | HIGH | Development environment feature expectations well-established (hot reload, auth bypass, service orchestration). Anti-features identified from community consensus. |
| Architecture | HIGH | FastAPI dependency injection pattern for auth bypass well-documented. Multi-stage Dockerfiles are best practice. Integration points already exist in codebase. |
| Pitfalls | HIGH | All pitfalls sourced from official GitHub issues, production incident reports, and 2026 guides. Mitigation strategies verified across multiple sources. |

**Overall confidence:** HIGH

Research confidence is exceptionally high because:
1. Every recommendation is backed by official documentation or multiple 2026 guides
2. Existing codebase already has most infrastructure (entrypoint.sh migrations, celery_app.py Redis support, vite.config.js proxy)
3. Changes are additive only - no modifications to production code paths
4. All technologies are current stable versions with active communities
5. Pitfalls sourced from actual production issues, not theoretical concerns

### Gaps to Address

**Minor gaps requiring validation during implementation:**

- **Celery 5.3+ verification** - Need to confirm current celery version supports broker_connection_retry_on_startup. If <5.3, add retry loop in entrypoint-celery.sh. Resolution: Check requirements.txt, update if needed.

- **Vite polling interval tuning** - 1000ms is recommended starting point but may need adjustment based on project size and developer machine performance. Resolution: Start with 1000ms, document if developers need to adjust.

- **Photo volume permissions on macOS/Windows** - Docker Desktop handles volumes differently than Linux. Named volume approach should work but needs testing on all platforms. Resolution: Document platform-specific issues in troubleshooting section, provide bind mount alternative.

- **Frontend auth bypass UX** - Research focused on backend bypass, frontend implementation less documented. May need iteration on user experience (auto-login vs manual dev mode toggle). Resolution: Start with simple auto-login when VITE_DEV_MODE=true, iterate based on feedback.

**No gaps requiring pre-implementation research:**
- All recommended technologies are current and actively maintained
- Integration patterns are well-established
- Pitfall mitigations are specific and actionable
- Phase structure maps directly to technical dependencies

## Sources

### Primary (HIGH confidence)

**Stack recommendations:**
- Docker Hub - Redis Official Image (redis:8.6.0-alpine version verification)
- Celery Documentation - Using Redis (broker configuration, version compatibility)
- Docker Compose Environment Variables (env_file and environment patterns)
- FastAPI Best Practices 2026 (dependency injection for development mode)
- Dockerizing React with Vite Hot Reload (Vite Docker configuration)

**Feature expectations:**
- Speedscale - The Ultimate Guide to Dev Environment Setup
- GitHub - Optimize local dev environments for better onboarding
- Nucamp - Docker for Full Stack Developers in 2026
- TestDriven.io - Flask/Celery/Redis Docker Compose patterns
- Docker Development Workflow - Hot Reloading (volume mounting patterns)

**Architecture patterns:**
- TestDriven.io - The Definitive Guide to Celery and FastAPI Dockerizing
- FastAPI Advanced Testing - Testing Dependencies with Overrides
- Pydantic Settings Management - Official documentation
- Docker Compose Production Best Practices - Official documentation
- Use single Dockerfile for development and production (multi-stage patterns)

**Pitfall prevention:**
- FastAPI Security Pitfalls - Medium article with production incident examples
- Vite Docker HMR Discussion (GitHub issue 14007) - solutions for silent HMR failure
- Docker Compose Health Checks - Last9 comprehensive guide
- OneUpTime - Fix Permission Denied Docker Volumes (2026 guide)
- Docker Compose depends_on with Health Checks (startup coordination)
- Localhost Cookies Developer's Guide 2026 (COOKIE_SECURE behavior)

### Secondary (MEDIUM confidence)

- Medium - Dockerizing React with Vite Hot Reload (hands-on guide)
- DevOpsDirective - Docker Development Workflow Hot Reloading course
- Medium - Flask Environment Specific Configurations (pattern examples)
- Release.com - 6 Docker Compose Best Practices for Dev and Prod
- Vite Server Options (official documentation for HMR config)

### Tertiary (LOW confidence, validated against primary sources)

- GitHub community discussions on FastAPI dependency overrides
- Medium blog posts on FastAPI dependency injection patterns
- Stack Overflow solutions for Docker volume permissions
- Various 2026-dated guides on Docker Compose development workflows

**Research quality notes:**
- All recommendations verified across minimum 2 sources
- Official documentation prioritized over blog posts
- 2026-dated sources used to ensure current best practices
- Existing codebase analyzed to validate compatibility
- No recommendations based on single source or unverified claims
- Version numbers verified from official registries (Docker Hub, PyPI, npm)

---
*Research completed: 2026-02-11*
*Ready for roadmap: yes*
