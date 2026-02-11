# Architecture Integration: Local Development Environment

**Project:** Reptile Tracker
**Domain:** Local development environment for existing FastAPI + React application
**Researched:** 2026-02-11
**Overall confidence:** HIGH

## Executive Summary

This document outlines the integration architecture for adding a local development environment to the existing reptile-tracker application. The application currently runs in Kubernetes with OIDC authentication, Celery background tasks, and production Docker images. The local development environment needs to provide:

1. **Dev auth bypass** - Skip OIDC flow when running locally
2. **Complete service stack** - Redis, Celery worker, database, backend, frontend
3. **Hot reload** - File changes reflected immediately without rebuild
4. **Minimal production impact** - New features are additive, not modifications

The architecture leverages FastAPI's dependency injection for auth bypass, Docker Compose for service orchestration, environment-based configuration, and multi-stage or separate Dockerfiles for dev-specific features.

## Current Architecture Overview

### Backend (FastAPI)
- **Entry point:** `backend/app/main.py` - FastAPI app with lifespan manager
- **Auth system:** `backend/app/auth.py` - OIDC flow via Authentik, JWT tokens in cookies
  - `get_current_user()` dependency checks tokens (Bearer or cookie)
  - `get_or_create_user()` handles OIDC user info
  - OAuth registered with Authlib
- **Config:** `backend/app/config.py` - Pydantic Settings with `.env` support
  - `environment` field: "production", "development", "staging"
  - Security settings: cookie flags, token expiration, SQL echo
- **Database:** `backend/app/database.py` - SQLAlchemy async with connection pooling
- **Celery:** `backend/app/celery_app.py` - Redis broker/backend, notification tasks
- **Worker:** `backend/celery_worker.py` - Standalone Celery worker process

### Frontend (React + Vite)
- **Build tool:** Vite with React plugin
- **Auth:** `react-oidc-context` for OIDC flow
- **Production:** Multi-stage Dockerfile (build → nginx serve)
- **Dev server:** `npm run dev` (Vite dev server with HMR)

### Docker Setup
- **Existing:** `docker-compose.yml` with postgres, backend, frontend
- **Backend Dockerfile:** Production image with uvicorn, entrypoint migrations
- **Frontend Dockerfile:** Multi-stage build (Node build → Nginx production)
- **Entrypoints:** `entrypoint.sh` (migrations + uvicorn), `entrypoint-celery.sh` (worker)

### Production Environment
- **Platform:** Kubernetes with Flux GitOps
- **Auth:** Authentik SSO (OIDC provider)
- **Redis:** Dragonfly (Redis-compatible) in cluster
- **Database:** CloudNative-PG (PostgreSQL)
- **Ingress:** Envoy Gateway with TLS

## Integration Points

### 1. Authentication Bypass (NEW)

**Location:** `backend/app/auth.py`

**Integration approach:** Add conditional dependency override based on `ENVIRONMENT` setting.

**Implementation:**
```python
# In auth.py, add new function:
async def get_dev_user(db: AsyncSession = Depends(get_db)) -> User:
    """Development-only: bypass OIDC and return mock user"""
    # Check for existing dev user, create if needed
    # Return User object with dev credentials

# In main.py startup:
if settings.environment == "development":
    from app.auth import get_current_user, get_dev_user
    app.dependency_overrides[get_current_user] = get_dev_user
```

**Why this works:**
- FastAPI's `app.dependency_overrides` dictionary replaces dependencies at runtime
- No changes to route handlers or existing auth logic
- Completely isolated from production code (only activates in dev mode)
- Existing `get_current_user` dependency in 20+ routers continues to work

**Configuration trigger:**
```python
# In config.py (already exists)
environment: str = "production"  # Set to "development" for local
```

**Data flow:**
```
Production:  HTTP Request → get_current_user() → Validate JWT → Query DB → User
Development: HTTP Request → get_dev_user() → Query/Create Mock → User
```

### 2. Docker Compose Service Stack (MODIFIED + NEW)

**Location:** `docker-compose.yml` (root level)

**Current services:**
- `postgres` - PostgreSQL 16 (KEEP)
- `backend` - FastAPI with volume mount (KEEP, MODIFY command)
- `frontend` - Production build + nginx (MODIFY to dev server)

**New services to add:**
- `redis` - Redis 7 (NEW)
- `celery-worker` - Celery worker process (NEW)
- `celery-beat` - Celery beat scheduler (NEW, optional)
- `flower` - Celery monitoring (NEW, optional)

**Integration approach:**

```yaml
services:
  # EXISTING - Keep as-is
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: reptile_tracker
      POSTGRES_USER: reptile_tracker
      POSTGRES_PASSWORD: dev_password
    # ... existing config

  # NEW - Redis for Celery
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # MODIFIED - Backend with dev environment
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: development  # Use dev stage in multi-stage build
    environment:
      DATABASE_URL: postgresql+asyncpg://reptile_tracker:dev_password@postgres:5432/reptile_tracker
      REDIS_URL: redis://redis:6379/0
      ENVIRONMENT: development  # Triggers auth bypass
      SQL_ECHO: "true"
      COOKIE_SECURE: "false"
      # ... other vars
    volumes:
      - ./backend/app:/app/app:ro  # Hot reload for code
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  # NEW - Celery worker
  celery-worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: development
    environment:
      DATABASE_URL: postgresql+asyncpg://reptile_tracker:dev_password@postgres:5432/reptile_tracker
      REDIS_URL: redis://redis:6379/0
      ENVIRONMENT: development
    volumes:
      - ./backend/app:/app/app:ro
    depends_on:
      - postgres
      - redis
    command: python celery_worker.py

  # MODIFIED - Frontend with Vite dev server
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev  # New dev Dockerfile
    environment:
      VITE_API_URL: http://localhost:8000
    volumes:
      - ./frontend/src:/app/src:ro  # Hot reload for source
      - ./frontend/public:/app/public:ro
      - /app/node_modules  # Preserve node_modules in container
    ports:
      - "3000:3000"
    depends_on:
      - backend
    command: npm run dev -- --host 0.0.0.0

  # NEW - Flower for Celery monitoring (optional)
  flower:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: development
    environment:
      CELERY_BROKER_URL: redis://redis:6379/0
      CELERY_RESULT_BACKEND: redis://redis:6379/0
    ports:
      - "5555:5555"
    depends_on:
      - redis
    command: celery --broker=redis://redis:6379/0 flower
```

**Why this works:**
- All services in single network, can reference by name
- Healthchecks prevent startup races
- Volume mounts enable hot reload
- `depends_on` ensures correct startup order

### 3. Frontend Development Mode (NEW)

**Location:** `frontend/Dockerfile.dev` (NEW FILE)

**Current:** Production Dockerfile uses multi-stage build (Node build → Nginx)

**Integration approach:** Create separate `Dockerfile.dev` for development.

```dockerfile
# frontend/Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source (note: volumes will override in docker-compose)
COPY . .

# Expose Vite dev server port
EXPOSE 3000

# Start Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

**Vite configuration:** Modify `frontend/vite.config.js` for Docker:

```javascript
export default defineConfig({
  server: {
    host: '0.0.0.0',  // Listen on all interfaces for Docker
    port: 3000,
    watch: {
      usePolling: true,  // Required for Docker volume file watching
    },
    hmr: {
      host: 'localhost',  // HMR connects to localhost from browser
    },
  },
  // ... existing config
})
```

**Why separate Dockerfile:**
- Production: Multi-stage build → optimized Nginx image
- Development: Single stage → Node with dev server
- No `--target` flag complexity
- Clear separation of concerns

**Alternative:** Multi-stage build approach:

```dockerfile
# In existing frontend/Dockerfile, add:
FROM node:20-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Existing production stages below...
FROM node:20-alpine AS build
# ... existing build stage
```

### 4. Backend Development Dockerfile (MODIFIED)

**Location:** `backend/Dockerfile`

**Current:** Single-stage production Dockerfile

**Integration approach:** Add multi-stage with development stage

```dockerfile
# Development stage - includes all dev dependencies
FROM python:3.11-slim AS development

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install dev-only tools
RUN pip install --no-cache-dir ipdb pytest-watch

# Copy application code
COPY app ./app
COPY migrations ./migrations
COPY entrypoint.sh ./entrypoint.sh
COPY entrypoint-celery.sh ./entrypoint-celery.sh
COPY celery_worker.py ./celery_worker.py
COPY logging_config.json ./logging_config.json
RUN chmod +x ./entrypoint.sh ./entrypoint-celery.sh

# No USER in dev stage - allows pip install in container
EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]

# Production stage - minimal, secure
FROM python:3.11-slim AS production

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && pip list

# Copy application code
COPY app ./app
COPY migrations ./migrations
COPY entrypoint.sh ./entrypoint.sh
COPY entrypoint-celery.sh ./entrypoint-celery.sh
COPY debug_startup.py ./debug_startup.py
COPY logging_config.json ./logging_config.json
COPY cleanup_duplicate_templates.py ./cleanup_duplicate_templates.py
COPY celery_worker.py ./celery_worker.py
RUN chmod +x ./entrypoint.sh ./entrypoint-celery.sh

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
```

**Docker Compose usage:**
```yaml
backend:
  build:
    context: ./backend
    target: development  # Uses development stage
```

**Why multi-stage:**
- Single Dockerfile to maintain
- `--target` flag selects stage
- Development stage includes debug tools
- Production stage remains minimal and secure
- K8s continues to use production stage (default)

### 5. Environment Configuration (MODIFIED)

**Location:** `backend/app/config.py` (already exists)

**Current state:** Pydantic Settings with environment variable support

**Integration approach:** Add development-specific defaults

```python
class Settings(BaseSettings):
    # ... existing fields

    # MODIFIED - Add dev-friendly defaults when ENVIRONMENT=development
    environment: str = "production"

    # MODIFIED - Conditional defaults based on environment
    cookie_secure: bool = True  # Will be overridden to False in dev
    sql_echo: bool = False  # Will be overridden to True in dev

    # NEW - Dev user configuration
    dev_user_email: str = "dev@localhost"
    dev_user_name: str = "Dev User"

    # NEW - Redis configuration (currently hardcoded in celery_app.py)
    redis_url: str | None = None  # If None, falls back to REDIS_HOST/PORT/etc
    redis_host: str = "dragonfly.database.svc.cluster.local"  # Production default
    redis_port: str = "6379"
    redis_password: str = ""
    redis_db: str = "0"

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
```

**Environment file:** `.env` (local development)

```bash
# .env for local development
DATABASE_URL=postgresql+asyncpg://reptile_tracker:dev_password@postgres:5432/reptile_tracker
SECRET_KEY=dev_secret_key_insecure_local_only
ENVIRONMENT=development

# OIDC - Not used in dev mode but required by config schema
OIDC_CLIENT_ID=reptile-tracker
OIDC_CLIENT_SECRET=unused_in_dev_mode
OIDC_DISCOVERY_URL=https://authentik.example.com/.well-known/openid-configuration
OIDC_REDIRECT_URI=http://localhost:3000/auth/callback

# Frontend
FRONTEND_URL=http://localhost:3000

# Redis
REDIS_URL=redis://redis:6379/0

# Dev mode settings
SQL_ECHO=true
COOKIE_SECURE=false
COOKIE_SAMESITE=lax

# Optional: webhook for testing
WEBHOOK_URL=
```

**Integration with existing code:**
- `celery_app.py` already reads `REDIS_URL` from environment (line 10)
- `config.py` already has `environment` field (line 15)
- `auth.py` already validates `settings.secret_key` (line 53)

**No breaking changes:** All existing environment variables work as before.

### 6. Celery Configuration (MODIFIED)

**Location:** `backend/app/celery_app.py`

**Current:** Reads Redis connection from environment variables

**Integration approach:** Already supports `REDIS_URL` environment variable (line 10-22)

**No changes needed:** Existing code works for both environments:

```python
# Existing code (lines 10-22)
REDIS_URL = os.getenv("REDIS_URL")

if not REDIS_URL:
    # Build from individual components
    redis_host = os.getenv("REDIS_HOST", "dragonfly.database.svc.cluster.local")
    redis_port = os.getenv("REDIS_PORT", "6379")
    redis_password = os.getenv("REDIS_PASSWORD", "")
    redis_db = os.getenv("REDIS_DB", "0")
    # ...
```

**Development:** Set `REDIS_URL=redis://redis:6379/0` in docker-compose

**Production:** Uses individual components with Dragonfly cluster DNS

### 7. Frontend Auth Handling (MODIFIED)

**Location:** Frontend auth context/provider

**Current:** `react-oidc-context` configured to use Authentik

**Integration approach:** Conditional OIDC provider based on environment variable

**Implementation:**
```javascript
// In frontend/src/auth.js or main.jsx
const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

// Development: Skip OIDC, use mock auth
if (isDevMode) {
  // Simple auth context that assumes logged in
  // Or: Make backend call to /auth/dev-login to get cookies
}

// Production: Use OIDC
const oidcConfig = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_OIDC_REDIRECT_URI,
  // ... other config
};
```

**Environment variables:** `frontend/.env.development`

```bash
VITE_API_URL=http://localhost:8000
VITE_DEV_MODE=true
```

**Why this works:**
- Backend auth bypass handles API security
- Frontend just needs to not redirect to OIDC
- Cookies still work for session management

## New Components

### 1. Development Auth Bypass

**Component:** `get_dev_user()` function in `auth.py`

**Purpose:** Return mock user without OIDC validation

**Interface:**
```python
async def get_dev_user(db: AsyncSession = Depends(get_db)) -> User:
    """
    Development-only user authentication bypass.
    Returns a mock user for local development without OIDC.
    """
```

**Data flow:**
1. Check for existing user with `oidc_sub="dev-user-local"`
2. If not exists, create user with dev credentials
3. Return User object

**Database impact:** Creates one dev user record on first run

### 2. Redis Service

**Component:** Redis container in docker-compose

**Purpose:** Celery broker/backend for development

**Replaces:** Dragonfly cluster in production

**Configuration:**
- Image: `redis:7-alpine`
- Port: `6379`
- No persistence in dev (data lost on restart)
- Healthcheck: `redis-cli ping`

### 3. Celery Worker Service

**Component:** Celery worker container in docker-compose

**Purpose:** Process background tasks (notifications)

**Configuration:**
- Uses same backend image with development stage
- Runs `celery_worker.py` (existing file)
- Shares environment with backend
- Volume mount for hot reload

### 4. Frontend Development Dockerfile

**Component:** `Dockerfile.dev` for Vite dev server

**Purpose:** Hot reload for frontend development

**Key differences from production:**
- Single stage (no build step)
- Runs `npm run dev` instead of nginx
- Includes all source files
- Node modules in container

### 5. Development .env File

**Component:** `.env` file at project root

**Purpose:** Local development configuration

**Key values:**
- `ENVIRONMENT=development` - Triggers all dev behaviors
- `REDIS_URL=redis://redis:6379/0` - Local Redis
- `DATABASE_URL=postgresql+asyncpg://...@postgres:5432/...` - Local DB
- Security settings: `COOKIE_SECURE=false`, `SQL_ECHO=true`

## Data Flow Changes

### Authentication Flow

**Before (Production):**
```
Browser → /auth/login → Authentik OIDC → /auth/callback → Backend validates → JWT in cookie → API requests
```

**After (Development):**
```
Browser → API request → Backend get_dev_user() → Mock user → Response
```

**Key difference:** No frontend OIDC flow, backend creates/returns dev user automatically.

### Celery Task Flow

**Before (Production):**
```
Backend → Dragonfly (Redis protocol) → Celery Worker (K8s pod) → Database
```

**After (Development):**
```
Backend → Redis (local) → Celery Worker (docker container) → PostgreSQL (local)
```

**Key difference:** All services local, same network. No behavioral changes to tasks.

### Frontend Development

**Before (Production):**
```
npm run build → dist/ → Nginx serves static files → Browser
```

**After (Development):**
```
npm run dev → Vite dev server → HMR over WebSocket → Browser auto-updates
```

**Key difference:** Hot module replacement, instant feedback on changes.

## Component Boundaries

| Component | Responsibility | Communicates With | Configuration |
|-----------|---------------|-------------------|---------------|
| **Backend (FastAPI)** | API endpoints, auth, business logic | postgres, redis, celery-worker | `.env`, docker-compose env vars |
| **PostgreSQL** | Data persistence | backend, celery-worker | docker-compose env vars |
| **Redis** | Message broker, task queue | backend, celery-worker, flower | None (default config) |
| **Celery Worker** | Background task execution | redis, postgres, external APIs | Same as backend |
| **Frontend (Vite)** | UI, client-side routing, API calls | backend | `.env.development`, vite.config.js |
| **Flower** (optional) | Celery monitoring UI | redis | Environment vars |

## Modified vs. New Files

### New Files

1. **`frontend/Dockerfile.dev`** - Development Dockerfile for Vite dev server
2. **`frontend/.env.development`** - Frontend dev environment variables
3. **`.env`** (project root) - Local development configuration
4. **`docker-compose.override.yml`** (optional) - Personal overrides
5. **`docs/LOCAL_DEVELOPMENT.md`** - Developer setup guide

### Modified Files

1. **`backend/app/auth.py`**
   - Add: `get_dev_user()` function
   - Modify: None (new function only)

2. **`backend/app/main.py`**
   - Add: Dependency override in startup when `ENVIRONMENT=development`
   - Location: Inside `lifespan()` startup section (line ~42)

3. **`backend/Dockerfile`**
   - Add: Multi-stage with `development` stage
   - Keep: Existing production stage as default

4. **`docker-compose.yml`**
   - Add: redis, celery-worker, flower services
   - Modify: backend environment variables, add volume mounts
   - Modify: frontend to use Dockerfile.dev and dev command

5. **`backend/app/config.py`**
   - Add: `dev_user_email`, `dev_user_name` fields (optional)
   - Keep: All existing fields unchanged

6. **`frontend/vite.config.js`**
   - Add: Docker-compatible server config (host, polling, HMR)
   - Keep: Existing build and plugin config

## Build Order

### First Time Setup

**Recommended order to minimize integration issues:**

1. **Phase 1: Docker Infrastructure** (No code changes)
   - Add Redis to docker-compose.yml
   - Test: `docker compose up redis postgres`
   - Verify: `redis-cli -h localhost ping` returns PONG

2. **Phase 2: Backend Dev Mode** (Minimal code changes)
   - Add development stage to backend/Dockerfile
   - Modify docker-compose backend service (target, environment, volumes)
   - Create `.env` file with dev configuration
   - Test: `docker compose up postgres redis backend`
   - Verify: Backend starts, migrations run, API responds

3. **Phase 3: Auth Bypass** (Code changes in auth.py)
   - Add `get_dev_user()` function to auth.py
   - Add dependency override in main.py startup
   - Test: curl API endpoints, should work without OIDC
   - Verify: Check logs for "Development mode" messages

4. **Phase 4: Celery Integration** (New service, uses existing code)
   - Add celery-worker to docker-compose.yml
   - Test: `docker compose up postgres redis backend celery-worker`
   - Verify: Celery worker logs show "ready", test notification task

5. **Phase 5: Frontend Dev Server** (New Dockerfile, config changes)
   - Create frontend/Dockerfile.dev
   - Modify frontend/vite.config.js for Docker
   - Update docker-compose frontend service
   - Test: `docker compose up` (all services)
   - Verify: Open http://localhost:3000, HMR works on file change

6. **Phase 6: Frontend Auth Skip** (Frontend code changes)
   - Add dev mode detection in frontend auth
   - Create `.env.development` for frontend
   - Test: Full stack with auth bypass
   - Verify: Can access protected routes without OIDC

7. **Phase 7: Documentation & Polish**
   - Write LOCAL_DEVELOPMENT.md
   - Add docker-compose.override.yml.example
   - Test: Full teardown and setup from docs

### Dependency Rationale

**Why this order:**
- Infrastructure first (Redis) - no code dependencies
- Backend dev mode - establishes foundation for other services
- Auth bypass - unblocks API testing without OIDC
- Celery - depends on Redis and backend patterns
- Frontend - depends on working backend API
- Frontend auth - final integration piece

**Key dependencies:**
- Celery worker requires Redis (message broker)
- Backend dev mode required before auth bypass (needs ENVIRONMENT setting)
- Frontend dev server requires working backend (API calls)
- Auth bypass blocks testing of both frontend and Celery (needs authenticated user)

### Parallel Work Opportunities

**Can be done in parallel:**
- Phase 1 (Redis) + Phase 5 (Frontend Dockerfile) - No overlap
- Phase 6 (Frontend auth) can start after Phase 2 (Backend dev mode) - Don't need Phase 3/4

**Must be sequential:**
- Phase 2 → Phase 3 → Phase 4 (Backend changes build on each other)
- Phase 1 → Phase 4 (Celery needs Redis)
- Phase 3 → Phase 6 (Frontend auth needs backend auth working)

## Scalability Considerations

| Concern | Local Development | Production |
|---------|------------------|------------|
| **Database connections** | Low (1-2 devs) - default pool size OK | High - use CloudNative-PG with connection pooling |
| **Redis memory** | Minimal - task queue only, no persistence | Moderate - Dragonfly with persistence enabled |
| **Celery concurrency** | 1-2 workers sufficient | Auto-scale based on queue depth (K8s HPA) |
| **File watching overhead** | Polling in Docker impacts CPU | N/A - no dev server in production |
| **Build time** | Development stage includes all deps | Multi-stage build produces minimal image |
| **Hot reload** | Essential for DX | Disabled - no volumes, static assets |

## Testing Strategy

### Unit Tests (Unchanged)
- Use `app.dependency_overrides` for test database and auth
- Existing pattern already in place

### Integration Tests with Dev Environment
```python
# In pytest fixture
@pytest.fixture
def dev_client():
    """Test client with development auth bypass enabled"""
    settings.environment = "development"
    app.dependency_overrides[get_current_user] = get_dev_user
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
```

### Manual Testing Flow
1. Start stack: `docker compose up`
2. Access frontend: http://localhost:3000
3. Should auto-login with dev user
4. Make code change in backend or frontend
5. Verify hot reload works
6. Create schedule, verify Celery task runs
7. Check Flower UI: http://localhost:5555

## Known Integration Pitfalls

### 1. Volume Mount Performance (Docker)

**Issue:** File watching with volumes on Docker Desktop (Mac/Windows) can be slow

**Solution:**
- Use `:cached` or `:delegated` flags (Docker Desktop)
- Use `usePolling: true` in Vite (necessary evil)
- Exclude `node_modules` volume to prevent permission issues

**Mitigation:**
```yaml
volumes:
  - ./frontend/src:/app/src:cached  # Faster on Mac
  - /app/node_modules  # Anonymous volume, preserved in container
```

### 2. Environment Variable Precedence

**Issue:** `.env` file vs. docker-compose environment vs. OS environment

**Precedence:** OS env > docker-compose env > .env file

**Solution:**
- Use `.env` for defaults
- Override in `docker-compose.yml` for service-specific values
- Personal overrides in `docker-compose.override.yml` (gitignored)

### 3. Dependency Override Scope

**Issue:** `app.dependency_overrides` affects ALL routes globally

**Impact:** Can't have mixed auth in development (some OIDC, some bypass)

**Solution:** Accept this limitation for simplicity. If mixed auth needed, use query parameter flag instead:

```python
async def get_current_user(
    auth_bypass: bool = Query(False),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    ...
):
    if settings.environment == "development" and auth_bypass:
        return await get_dev_user(db)
    # ... normal auth flow
```

### 4. CORS in Development

**Issue:** Frontend on localhost:3000, backend on localhost:8000

**Current solution:** `allow_origins=[settings.frontend_url]` in main.py

**Development:** Set `FRONTEND_URL=http://localhost:3000` in `.env`

**Production:** Set to production domain

**No code changes needed:** Already configured correctly.

### 5. Celery Worker Crashes on Code Change

**Issue:** Volume mount means worker loads new code, may crash on syntax errors

**Impact:** Developer must check celery-worker logs, not just backend logs

**Solution:**
- Use `--reload` for Celery in development (experimental)
- Or: Accept manual restart after major changes
- Flower UI helps monitor worker health

### 6. Database Migrations

**Issue:** Development migrations might conflict with production state

**Solution:**
- Use separate database for local (already configured)
- Entrypoint script runs migrations automatically (existing: `entrypoint.sh`)
- Can reset local DB anytime: `docker compose down -v` (removes volumes)

### 7. Secret Key Validation

**Issue:** `auth.py` validates secret key isn't default (line 53-54)

**Development workaround:** Use non-default but insecure key in `.env`:
```bash
SECRET_KEY=dev_secret_key_insecure_local_only
```

**Why:** Passes validation check but clearly not for production.

### 8. OIDC Config Required Despite Bypass

**Issue:** `config.py` requires OIDC settings even in dev mode (no optional fields)

**Solution:** Provide dummy values in `.env`:
```bash
OIDC_CLIENT_ID=reptile-tracker
OIDC_CLIENT_SECRET=unused_in_dev_mode
OIDC_DISCOVERY_URL=https://example.com/.well-known/openid-configuration
```

**Future improvement:** Make OIDC fields optional when `environment != "production"`

## Security Considerations

### Development vs. Production Isolation

| Security Control | Development | Production |
|------------------|-------------|------------|
| **OIDC Authentication** | Bypassed | Required |
| **Secure Cookies** | Disabled (HTTP OK) | Enabled (HTTPS only) |
| **CORS** | Permissive (localhost) | Restricted to production domain |
| **Secret Key** | Insecure placeholder | Secure random key from 1Password |
| **SQL Echo** | Enabled (log queries) | Disabled |
| **TLS** | Not required | cert-manager Let's Encrypt |

### Development Security Best Practices

1. **Never use production secrets in `.env`** - Use dummy values
2. **Don't commit `.env`** - Add to `.gitignore` (already done)
3. **Separate dev database** - Never point to production DB
4. **Environment check** - Auth bypass only works if `ENVIRONMENT=development`
5. **Documentation** - Clearly mark dev user in database for cleanup

### Production Safety Checks

**Existing safeguards:**
- Secret key validation in `auth.py` (line 53-54)
- Environment-based configuration in `config.py` (line 15)
- Cookie security flags (line 21-24)

**Additional safeguard for dev bypass:**
```python
# In main.py, before setting override:
if settings.environment == "development":
    if settings.secret_key.startswith("dev_secret"):  # Sanity check
        logger.warning("DEVELOPMENT MODE: Auth bypass enabled")
        app.dependency_overrides[get_current_user] = get_dev_user
    else:
        logger.error("Cannot enable dev mode with production-like secret")
        raise ValueError("Invalid dev configuration")
```

## Recommended Integration Approach

### Iteration 1: Minimal Viable Dev Environment

**Goal:** Get backend running locally with auth bypass

**Changes:**
1. Add Redis to docker-compose
2. Add development stage to backend Dockerfile
3. Implement `get_dev_user()` in auth.py
4. Add dependency override in main.py
5. Create `.env` file

**Testing:** curl API endpoints, verify auth bypass works

**Time estimate:** 2-4 hours

**Risk:** Low - isolated changes, doesn't affect frontend or Celery

### Iteration 2: Add Celery Support

**Goal:** Enable background tasks in local environment

**Changes:**
1. Add celery-worker service to docker-compose
2. Optionally add flower service
3. Configure Redis connection (already done via REDIS_URL)

**Testing:** Trigger notification task, verify in logs/Flower

**Time estimate:** 1-2 hours

**Risk:** Low - uses existing celery code, just adding service

### Iteration 3: Frontend Hot Reload

**Goal:** Enable rapid frontend iteration

**Changes:**
1. Create frontend/Dockerfile.dev
2. Modify frontend/vite.config.js
3. Update docker-compose frontend service
4. Add frontend auth bypass (conditional OIDC)

**Testing:** Change React component, verify HMR works

**Time estimate:** 2-3 hours

**Risk:** Medium - Vite + Docker + HMR can be finicky

### Iteration 4: Documentation & Polish

**Goal:** Make setup reproducible for other developers

**Changes:**
1. Write LOCAL_DEVELOPMENT.md
2. Add troubleshooting section
3. Create docker-compose.override.yml.example
4. Add VSCode debug configurations (optional)

**Time estimate:** 1-2 hours

**Risk:** Low - documentation only

## Architecture Diagrams

### Development Environment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Compose Network                   │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐     ┌────────────┐ │
│  │   Frontend   │─────▶│   Backend    │────▶│ PostgreSQL │ │
│  │ (Vite dev)   │      │  (FastAPI)   │     │   (DB)     │ │
│  │ localhost:   │      │ localhost:   │     │            │ │
│  │   3000       │      │   8000       │     └────────────┘ │
│  └──────────────┘      └──────┬───────┘                    │
│         │                     │                             │
│         │                     ▼                             │
│         │              ┌──────────────┐                     │
│         │              │    Redis     │                     │
│         │              │  (Broker)    │                     │
│         │              └──────┬───────┘                     │
│         │                     │                             │
│         │                     ▼                             │
│         │              ┌──────────────┐                     │
│         │              │    Celery    │                     │
│         │              │   Worker     │                     │
│         │              └──────────────┘                     │
│         │                                                   │
│         │              ┌──────────────┐                     │
│         └─────────────▶│    Flower    │                     │
│                        │ (Monitor UI) │                     │
│                        │ localhost:   │                     │
│                        │   5555       │                     │
│                        └──────────────┘                     │
└─────────────────────────────────────────────────────────────┘

Host filesystem volumes mounted for hot reload
```

### Authentication Data Flow

```
Production Flow:
Browser ─(1)─▶ Authentik OIDC ─(2)─▶ Backend ─(3)─▶ JWT Token ─(4)─▶ Cookies

Development Flow:
Browser ─(1)─▶ Backend ─(2)─▶ get_dev_user() ─(3)─▶ Mock User ─(4)─▶ Response

Where:
1. HTTP Request
2. Auth validation (OIDC vs bypass)
3. User object creation
4. Response with auth context
```

### File Change Hot Reload Flow

```
Developer ─┬─▶ Edit backend/app/foo.py
           │   │
           │   ▼
           │   Volume mount ─▶ Container ─▶ Uvicorn --reload ─▶ Restart
           │
           └─▶ Edit frontend/src/Bar.jsx
               │
               ▼
               Volume mount ─▶ Container ─▶ Vite HMR ─▶ Browser update (no refresh)
```

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| **Auth Bypass Integration** | HIGH | FastAPI dependency_overrides is well-documented, existing pattern in tests |
| **Docker Compose Stack** | HIGH | Standard pattern for FastAPI + Celery + Redis, multiple examples found |
| **Vite Dev Server in Docker** | MEDIUM | HMR + Docker requires careful config (polling, host), can be finicky |
| **Multi-stage Dockerfiles** | HIGH | Best practice pattern, well-supported |
| **Environment Configuration** | HIGH | Pydantic-settings makes this straightforward, already in use |
| **Celery Integration** | HIGH | Existing code already supports REDIS_URL, just adding service |
| **Frontend Auth Bypass** | MEDIUM | Requires conditional OIDC setup, less documented pattern |
| **Production Isolation** | HIGH | Environment-based feature flags are reliable isolation mechanism |

## Sources

### Architecture Patterns
- [The Definitive Guide to Celery and FastAPI - Dockerizing](https://testdriven.io/courses/fastapi-celery/docker/)
- [Dockerize Your FastAPI and Celery Application](https://www.nashruddinamin.com/blog/dockerize-your-fastapi-and-celery-application)
- [Asynchronous Tasks with FastAPI and Celery](https://testdriven.io/blog/fastapi-and-celery/)
- [FastAPI Best Practices for Production: Complete 2026 Guide](https://fastlaunchapi.dev/blog/fastapi-best-practices-production-2026)

### Authentication & Dependency Injection
- [Testing Dependencies with Overrides - FastAPI](https://fastapi.tiangolo.com/advanced/testing-dependencies/)
- [Testing FastAPI Dependency Injection](https://hrekov.com/blog/testing-fastapi-dependency-injection)
- [How to get dependency_override to work to skip authentication](https://github.com/fastapi/fastapi/discussions/10118)
- [Mastering Dependency Injection in FastAPI](https://medium.com/@azizmarzouki/mastering-dependency-injection-in-fastapi-clean-scalable-and-testable-apis-5f78099c3362)

### Configuration Management
- [Settings Management - Pydantic](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
- [Settings and Environment Variables - FastAPI](https://fastapi.tiangolo.com/advanced/settings/)
- [Environment variables using Pydantic](https://medium.com/@mahimamanik.22/environment-variables-using-pydantic-ff6ccb2b8976)

### Docker & Development Workflow
- [Use Compose in production | Docker Docs](https://docs.docker.com/compose/how-tos/production/)
- [Use single Dockerfile for development and production](https://mateuszcholewka.com/post/single-dockerfile-dev-prod/)
- [6 Docker Compose Best Practices for Dev and Prod](https://release.com/blog/6-docker-compose-best-practices-for-dev-and-prod)
- [One Dockerfile for Dev & Production? Yes, and Here's Why](https://buildsoftwaresystems.com/post/docker-build-target-dev-prod/)

### Vite Development Setup
- [Dockerizing Your React App with Hot Reloading (Vite)](https://medium.com/@sankettikam17/dockerizing-your-react-app-with-hot-reloading-yarn-and-vite-a-smooth-development-workflow-303ae51ac11a)
- [Dockerizing the frontend with React.js + Vite](https://www.innokrea.com/dockerizing-the-frontend-do-it-right-with-react-js-vite/)
- [Server Options | Vite](https://v3.vitejs.dev/config/server-options)
- [Solving CORS with Vite Proxy Configuration](https://en.kelen.cc/posts/solving-cors-with-vite-proxy-configuration)
- [Simplifying API Proxies in Vite](https://medium.com/@eric_abell/simplifying-api-proxies-in-vite-a-guide-to-vite-config-js-a5cc3a091a2f)
