# Stack Research

**Domain:** Local Development Environment for FastAPI + React App
**Researched:** 2026-02-11
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Docker Compose | 3.8+ | Development orchestration | Industry standard for local multi-container development, provides service dependency management and consistent environments across team |
| Redis (Alpine) | 8.6.0-alpine | Message broker for Celery | Latest stable Redis (Feb 2026), Alpine variant reduces image size by ~40MB, production app already using Redis via Dragonfly (100% compatible) |
| Vite Dev Server | 5.4.11 | Frontend hot reload | Already in project, requires Docker-specific config for HMR to work in containers (host: true, usePolling) |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-dotenv | Latest | Environment variable management | Optional but recommended - makes .env file management cleaner, though Docker Compose natively supports .env files |
| watchfiles | Latest | File watching in Docker | Alternative to usePolling in Vite - more efficient but usePolling is simpler and already works |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| .env file | Development secrets | Docker Compose reads .env automatically, use env_file attribute in compose for service-specific vars |
| Volume mounts | Code hot reload | Mount source directories as volumes - backend already has this, frontend needs proper dev setup |
| Health checks | Service readiness | Already in place for postgres, ensures services start in correct order |

## Installation

```bash
# Docker Compose setup (no new Python/Node packages needed)
# Existing requirements.txt already has:
# - celery==5.4.0
# - redis==5.2.0

# Create .env file for development (see Development Configuration below)
cp .env.example .env

# Start all services
docker compose up

# Start specific services
docker compose up postgres redis backend
```

## Docker Compose Service Additions

### Redis Service
```yaml
redis:
  image: redis:8.6.0-alpine
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
  ports:
    - "6379:6379"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 3s
    retries: 5
```

**Why this configuration:**
- `8.6.0-alpine` - Latest stable (Feb 2026), small footprint
- `maxmemory 256mb` - Prevents Redis from consuming unlimited memory in dev
- `maxmemory-policy allkeys-lru` - Evicts least recently used keys when full
- Health check ensures Celery worker doesn't start before Redis is ready

### Celery Worker Service
```yaml
celery-worker:
  build:
    context: ./backend
    dockerfile: Dockerfile
  command: python celery_worker.py
  environment:
    DATABASE_URL: postgresql+asyncpg://reptile_tracker:${POSTGRES_PASSWORD:-dev_password}@postgres:5432/reptile_tracker
    SECRET_KEY: ${SECRET_KEY:-dev_secret_key_not_for_production}
    REDIS_URL: redis://redis:6379/0
    ENVIRONMENT: development
    # Auth bypass - see Development Configuration
    ENABLE_DEV_AUTH: ${ENABLE_DEV_AUTH:-false}
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  volumes:
    - ./backend/app:/app/app
```

**Why this configuration:**
- Reuses backend Dockerfile and existing celery_worker.py
- REDIS_URL points to local redis service (not Dragonfly)
- Volume mount enables code changes without rebuild
- Health check dependencies prevent startup failures

### Frontend Development Service
```yaml
frontend-dev:
  build:
    context: ./frontend
    dockerfile: Dockerfile.dev  # New file needed
  ports:
    - "3000:3000"
  environment:
    VITE_API_URL: http://localhost:8000
  depends_on:
    - backend
  volumes:
    - ./frontend/src:/app/src
    - ./frontend/public:/app/public
    - ./frontend/index.html:/app/index.html
    - ./frontend/vite.config.js:/app/vite.config.js
    # Exclude node_modules to avoid host/container conflicts
    - /app/node_modules
```

**Why this configuration:**
- Separate Dockerfile.dev (production uses multi-stage build)
- Volume mounts for source code enable hot reload
- Excludes node_modules to prevent version conflicts
- Vite dev server proxies API requests (already configured)

### Photo Storage Volume
```yaml
volumes:
  postgres_data:
  photo_storage:

services:
  backend:
    volumes:
      - ./backend/app:/app/app
      - photo_storage:/app/photos  # NEW: Persistent photo storage
```

**Why this configuration:**
- Named volume persists between container restarts
- Matches LOCAL_STORAGE_PATH=/app/photos from config.py
- Prevents photo loss during development

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Redis 8.6.0 | Dragonfly | Production uses Dragonfly, but Redis is simpler for local dev and 100% compatible |
| Volume mounts | COPY in Dockerfile | Volume mounts for dev (hot reload), COPY for production (immutable containers) |
| Vite dev server | Nginx (production setup) | Dev server for hot reload, Nginx for production serving of built assets |
| python-dotenv | Direct env vars | Both work, python-dotenv provides better .env file support but Docker Compose has native support |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Vite preview mode | Builds production assets, no hot reload | Vite dev server with host: true |
| Redis without maxmemory | Can consume unlimited RAM in dev | Set maxmemory and eviction policy |
| Frontend production Dockerfile in dev | Multi-stage build slow, no source maps, no hot reload | Separate Dockerfile.dev with dev server |
| Hardcoded secrets in docker-compose.yml | Security risk, leaked in git | .env file with .gitignore |

## Development Configuration Patterns

### Dev Auth Bypass Pattern

**Option 1: Environment Variable Toggle (Recommended)**
```python
# app/auth.py addition
from typing import Optional

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Optional auth - returns None if ENABLE_DEV_AUTH=true"""
    if settings.environment == "development" and os.getenv("ENABLE_DEV_AUTH") == "true":
        # Return first user or create dev user
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                oidc_sub="dev-user",
                email="dev@localhost",
                name="Dev User",
                created_at=datetime.now(timezone.utc),
                last_login=datetime.now(timezone.utc),
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        return user

    # Normal auth flow
    return await get_current_user(credentials, access_token, db)
```

**Why this approach:**
- Only active when both ENVIRONMENT=development AND ENABLE_DEV_AUTH=true
- No code changes needed - toggle via .env file
- Production safety: defaults to false
- Uses dependency override pattern from [FastAPI 2026 best practices](https://fastlaunchapi.dev/blog/fastapi-best-practices-production-2026)

**Option 2: Dependency Override (Testing Pattern)**
```python
# For tests or local dev script
app.dependency_overrides[get_current_user] = lambda: mock_user
```

**Why option 1 is better for this use case:**
- Option 2 is better for tests (isolated overrides)
- Option 1 is better for development (persistent across requests)

### Vite Docker Configuration

**Required vite.config.js changes:**
```javascript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,  // Already present - exposes to Docker network
    port: 3000,
    strictPort: true,  // ADD: Fail if port unavailable
    watch: {
      usePolling: true,  // ADD: Required for Docker volume watching
      interval: 1000,  // ADD: Check every 1 second
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

**Why these additions:**
- `usePolling: true` - Required for volume mount file watching ([source](https://courses.devopsdirective.com/docker-beginner-to-pro/lessons/11-development-workflow/01-hot-reloading))
- `strictPort: true` - Prevents silent failures
- `interval: 1000` - Balance between responsiveness and CPU usage

**Alternative: watchfiles library**
- More efficient than polling but requires additional package
- usePolling is simpler and works reliably

### Frontend Dockerfile.dev

**New file: frontend/Dockerfile.dev**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source (volumes will override in docker-compose)
COPY . .

# Expose Vite dev server port
EXPOSE 3000

# Start dev server
CMD ["npm", "run", "dev"]
```

**Why separate from production Dockerfile:**
- Production: Multi-stage build, Nginx serving
- Development: Single stage, Vite dev server, no build step
- Pattern from [Dockerizing React with Vite hot reload](https://medium.com/@sankettikam17/dockerizing-your-react-app-with-hot-reloading-yarn-and-vite-a-smooth-development-workflow-303ae51ac11a)

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| celery==5.4.0 | redis==5.2.0 | Confirmed compatible, Celery 5.4.0 fixed Redis broker reconnection issues via Kombu 5.4.0 ([source](https://docs.celeryq.dev/en/stable/getting-started/backends-and-brokers/redis.html)) |
| redis==5.2.0 (Python) | Redis 8.6.0 (server) | Python redis client supports all Redis server versions 3.x-8.x |
| Vite 5.4.11 | Node 20-alpine | Vite 5.x requires Node 18+, Node 20 is current LTS |
| FastAPI 0.115.0 | Pydantic 2.9.2 | FastAPI 0.100+ requires Pydantic v2, version in requirements.txt is correct |

## Integration Points

### Backend → Redis → Celery
```
FastAPI endpoint → celery_app.send_task() → Redis broker → Celery worker consumes task
```

**Configuration:**
- Backend: REDIS_URL=redis://redis:6379/0
- Celery: Uses same REDIS_URL from app/celery_app.py
- Production uses Dragonfly (100% Redis compatible)

### Frontend → Backend
```
Vite dev server (port 3000) → Proxy /api & /auth → Backend (port 8000)
```

**Configuration:**
- VITE_API_URL only used in production builds
- Dev mode uses vite.config.js proxy (already configured)
- Proxying handles CORS issues automatically

### Photo Storage
```
Backend → LOCAL_STORAGE_PATH=/app/photos → Docker volume (photo_storage)
```

**Configuration:**
- PHOTO_STORAGE_BACKEND=local
- Volume mount persists photos between restarts
- Production uses PVC in Kubernetes

## Environment Variables Reference

### New Variables for Development

| Variable | Default | Purpose | Required |
|----------|---------|---------|----------|
| ENABLE_DEV_AUTH | false | Bypass OIDC auth in dev | No |
| REDIS_URL | redis://redis:6379/0 | Redis connection for Celery | Yes (auto-set in compose) |
| SECRET_KEY | (error) | JWT signing key | Yes (set in .env) |

### Existing Variables (from production)

All existing environment variables from production HelmRelease work as-is:
- DATABASE_URL, OIDC_*, FRONTEND_URL, etc.
- Only SECRET_KEY and OIDC_CLIENT_SECRET need real values for auth to work
- With ENABLE_DEV_AUTH=true, OIDC vars can be dummy values

## Sources

- [Docker Hub - Redis Official Image](https://hub.docker.com/_/redis) - Redis 8.6.0-alpine version verification
- [Celery Documentation - Using Redis](https://docs.celeryq.dev/en/stable/getting-started/backends-and-brokers/redis.html) - Redis broker configuration and version compatibility
- [Docker Compose Environment Variables](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/) - env_file and environment attribute patterns
- [FastAPI Best Practices 2026](https://fastlaunchapi.dev/blog/fastapi-best-practices-production-2026) - Dependency injection patterns for development mode
- [Dockerizing React with Vite Hot Reload](https://medium.com/@sankettikam17/dockerizing-your-react-app-with-hot-reloading-yarn-and-vite-a-smooth-development-workflow-303ae51ac11a) - Vite Docker configuration for HMR
- [Docker Development Workflow - Hot Reloading](https://courses.devopsdirective.com/docker-beginner-to-pro/lessons/11-development-workflow/01-hot-reloading) - Volume mounting and file watching patterns
- [Dragonfly Docker Guide](https://oneuptime.com/blog/post/2026-02-08-how-to-run-dragonfly-in-docker-redis-compatible-cache/view) - Redis compatibility confirmation

---
*Stack research for: Reptile Tracker Local Development Environment*
*Researched: 2026-02-11*
*Focus: NEW capabilities for development (Redis, Celery worker, dev auth, Vite hot reload)*
