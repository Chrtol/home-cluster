---
phase: 15-frontend-hot-reload-dx-polish
plan: 01
subsystem: frontend-dx
tags:
  - docker
  - vite
  - hmr
  - development
dependency_graph:
  requires: []
  provides:
    - frontend-hot-reload
    - docker-dev-mode
  affects:
    - developer-experience
tech_stack:
  added: []
  patterns:
    - Docker development with file polling
    - Vite HMR configuration
    - Volume mounts for source code
key_files:
  created:
    - frontend/Dockerfile.dev
  modified:
    - frontend/vite.config.js
    - docker-compose.yml
decisions:
  - decision: Use file polling for Docker file watching
    rationale: Docker doesn't support inotify events; polling is required for HMR
    alternatives_considered:
      - Native file watching (doesn't work in Docker)
    impact: Slight CPU overhead but enables HMR functionality
  - decision: Hardcode backend:8000 in Vite proxy
    rationale: Proxy runs server-side in container; needs Docker service name
    alternatives_considered:
      - Use VITE_API_URL env var (doesn't work server-side)
    impact: Development-specific configuration; production uses Envoy Gateway
  - decision: Mount source files individually vs COPY in Dockerfile
    rationale: Enables HMR by making changes immediately available to dev server
    alternatives_considered:
      - COPY all files (requires rebuild on every change)
    impact: Fast feedback loop for developers
metrics:
  duration_minutes: 2
  tasks_completed: 3
  commits: 3
  deviations: 0
  completed_date: 2026-02-11
---

# Phase 15 Plan 01: Frontend Hot Reload & DX Polish Summary

**One-liner:** Configured Vite dev server in Docker with hot module replacement using file polling and volume mounts for instant component updates.

## Accomplishments

### Task 1: Create frontend Dockerfile.dev for Vite dev server
- Created `frontend/Dockerfile.dev` with node:20-alpine base
- Configured to install dependencies in container
- Exposed port 3000 for Vite dev server
- Set up npm run dev with --host 0.0.0.0 for external connections
- **Commit:** 05698462c

### Task 2: Update vite.config.js for Docker HMR
- Added `watch.usePolling: true` (REQUIRED for Docker file watching)
- Added `strictPort: true` to fail if port is taken
- Configured HMR with localhost host and clientPort 3000
- Changed proxy target from `process.env.VITE_API_URL` to `backend:8000` container name
- Added polling interval of 100ms for responsive updates
- **Commit:** f1634a716

### Task 3: Update docker-compose.yml for development frontend
- Changed dockerfile from `Dockerfile` to `Dockerfile.dev`
- Updated port mapping from `3000:80` to `3000:3000` (Vite dev server port)
- Added volume mounts for source files (src, public, config files) with `:cached` flag
- Added anonymous `/app/node_modules` volume to use container's dependencies
- Removed nginx.dev.conf mount (no longer using nginx in dev mode)
- **Commit:** c603a44a3

## Verification Results

All verification steps passed:

1. **Build:** Frontend container built successfully with Dockerfile.dev
2. **Startup:** Vite dev server started and logged "ready in 169 ms"
3. **Accessibility:** Frontend accessible at http://localhost:3000 with Vite script tags
4. **HMR Client:** `/@vite/client` endpoint returns 200 OK
5. **React Refresh:** `/@react-refresh` injection script present in HTML

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria

- [x] frontend/Dockerfile.dev exists with node:20-alpine and npm run dev
- [x] vite.config.js has watch.usePolling: true for Docker file watching
- [x] docker-compose.yml frontend uses Dockerfile.dev and mounts source volumes
- [x] Frontend container starts and serves via Vite dev server on port 3000
- [x] Vite proxy forwards /api and /auth requests to backend container

## Technical Notes

**File Watching in Docker:**
Docker containers don't receive inotify file system events from host. Vite's default file watching won't detect changes. `usePolling: true` makes Vite poll the file system every 100ms instead, enabling HMR.

**Proxy Configuration:**
Vite's proxy runs on the server-side (inside container), so it must use Docker service names (`backend:8000`) rather than localhost. The client-side code still uses `/api` and `/auth` paths, which Vite proxies to the backend container.

**Volume Strategy:**
- Mount source directories individually for HMR
- Use `:cached` flag for macOS performance
- Anonymous `/app/node_modules` volume prevents host's node_modules from shadowing container's

**Port Change:**
Development mode uses Vite dev server on port 3000. Production mode (not changed in this plan) still uses nginx on port 80.

## Next Phase Readiness

**Blockers:** None

**Recommended Next Steps:**
1. Test HMR by editing a React component and verifying instant browser update
2. Consider adding Vite plugin for better error overlay
3. Document development workflow (how to start, how to test HMR)

## Self-Check: PASSED

All verification completed successfully:

- FOUND: frontend/Dockerfile.dev
- FOUND: 05698462c (Task 1 commit)
- FOUND: f1634a716 (Task 2 commit)
- FOUND: c603a44a3 (Task 3 commit)
