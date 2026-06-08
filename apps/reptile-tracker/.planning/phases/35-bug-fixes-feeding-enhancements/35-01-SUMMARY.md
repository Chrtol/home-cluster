---
phase: 35
plan: 01
subsystem: foundation
tags: [react-query, database, models, migration]
dependency_graph:
  requires: []
  provides: [react-query-setup, feeding-status-model, local-auth-model]
  affects: [apps/reptile-tracker/frontend/src/App.jsx, apps/reptile-tracker/backend/app/models.py]
tech_stack:
  added: ["@tanstack/react-query@5.101.0"]
  patterns: [QueryClientProvider-at-root, server-default-migration]
key_files:
  created:
    - apps/reptile-tracker/frontend/src/lib/queryClient.js
    - apps/reptile-tracker/backend/migrations/versions/0107_add_feeding_status_and_local_auth.py
  modified:
    - apps/reptile-tracker/frontend/package.json
    - apps/reptile-tracker/frontend/package-lock.json
    - apps/reptile-tracker/frontend/src/App.jsx
    - apps/reptile-tracker/backend/app/models.py
    - apps/reptile-tracker/backend/app/config.py
decisions:
  - "QueryClientProvider placed inside CelebrationProvider but outside Router per plan spec"
  - "staleTime set to 30000ms (30s) for real-time header feel"
  - "FeedingStatus enum uses lowercase values (eaten/refused) for PostgreSQL compatibility"
  - "server_default='eaten' ensures existing feedings get correct status value"
metrics:
  duration: 4m
  completed: 2026-06-08
---

# Phase 35 Plan 01: Foundation Infrastructure Summary

React Query v5 installed with QueryClientProvider wrapping app, FeedingStatus enum and local auth fields added to models with migration 0107.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Install React Query and configure QueryClientProvider | 0356f7a6e | @tanstack/react-query v5.101.0, queryClient.js with staleTime 30s, App.jsx wrapped |
| 2 | Add FeedingStatus enum and password_hash to models | 98407ecc0 | FeedingStatus enum, Feeding.status/retry fields, User.password_hash fields, config settings |
| 3 | Create database migration for new fields | 464096c51 | Migration 0107 with feedingstatus enum, feedings columns, users columns |

## Implementation Details

### React Query Setup

Created `frontend/src/lib/queryClient.js`:
```javascript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds - short for real-time feel
      refetchOnWindowFocus: false,
    },
  },
});
```

App.jsx updated with QueryClientProvider inside CelebrationProvider, outside Router:
```jsx
<CelebrationProvider>
  <QueryClientProvider client={queryClient}>
    {/* ... app content ... */}
  </QueryClientProvider>
</CelebrationProvider>
```

### Model Changes

**FeedingStatus enum** (models.py):
- `EATEN = "eaten"` - Normal feeding
- `REFUSED = "refused"` - Reptile refused

**Feeding model additions**:
- `status` - FeedingStatus enum, default EATEN
- `retry_scheduled_for` - DateTime for retry scheduling
- `retry_instance_id` - FK to ScheduleInstance

**User model additions**:
- `password_hash` - String(255), nullable for OIDC-only users
- `temp_password_hash` - For admin-generated password resets
- `temp_password_expires` - DateTime for temp password expiry

**Config additions**:
- `local_auth_enabled: bool = False`
- `self_registration_enabled: bool = False`

### Migration 0107

PostgreSQL migration creates:
1. `feedingstatus` enum type
2. Adds `status`, `retry_scheduled_for`, `retry_instance_id` to `feedings`
3. Adds `password_hash`, `temp_password_hash`, `temp_password_expires` to `users`

Server default `'eaten'` ensures existing feedings are marked correctly.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] npm list @tanstack/react-query shows 5.101.0
- [x] queryClient.js exports queryClient with staleTime: 30000
- [x] App.jsx has QueryClientProvider wrapping content
- [x] FeedingStatus enum exists with EATEN/REFUSED
- [x] Feeding model has status, retry_scheduled_for, retry_instance_id
- [x] User model has password_hash, temp_password_hash, temp_password_expires
- [x] Config has local_auth_enabled and self_registration_enabled
- [x] Migration 0107 exists with correct revision chain

## Self-Check: PASSED

All files verified to exist:
- `apps/reptile-tracker/frontend/src/lib/queryClient.js` - FOUND
- `apps/reptile-tracker/backend/migrations/versions/0107_add_feeding_status_and_local_auth.py` - FOUND

All commits verified:
- `0356f7a6e` - FOUND
- `98407ecc0` - FOUND
- `464096c51` - FOUND
