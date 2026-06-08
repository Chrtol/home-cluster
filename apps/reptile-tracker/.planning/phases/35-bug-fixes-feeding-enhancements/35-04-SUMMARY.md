---
phase: 35
plan: 04
subsystem: auth
tags: [local-auth, bcrypt, dev-tools, multi-user]
dependency_graph:
  requires: [35-01]
  provides: [local-auth-endpoint, dev-user-switching, multi-role-testing]
  affects: [apps/reptile-tracker/backend/app/routers/auth_router.py, apps/reptile-tracker/frontend/src/pages/Login.jsx, apps/reptile-tracker/frontend/src/pages/Settings.jsx]
tech_stack:
  added: [passlib-bcrypt]
  patterns: [environment-gated-endpoints, cookie-based-jwt, queryClient-clear-on-switch]
key_files:
  created:
    - apps/reptile-tracker/backend/app/routers/auth_router.py
    - apps/reptile-tracker/frontend/src/components/DevUserSwitcher.jsx
  modified:
    - apps/reptile-tracker/backend/app/main.py
    - apps/reptile-tracker/backend/app/seed_dev_data.py
    - apps/reptile-tracker/frontend/src/pages/Login.jsx
    - apps/reptile-tracker/frontend/src/pages/Settings.jsx
decisions:
  - "bcrypt password hashing via passlib CryptContext"
  - "oidc_sub pattern 'local:{email}' for local auth users"
  - "Dev Tools tab only visible in development environment"
  - "Environment check returns 403 for dev endpoints in production"
metrics:
  duration: 6m
  completed: 2026-06-08
---

# Phase 35 Plan 04: Local Auth & Dev User Switching Summary

Local authentication with bcrypt password hashing, 5 seeded dev users across 2 households for multi-role testing, and DevUserSwitcher in Settings Dev Tools tab.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Create auth router with local login and dev switch endpoints | 749799a7a | auth_router.py with bcrypt, POST /auth/local, POST /auth/dev/switch, GET /auth/dev/users |
| 2 | Expand seed_dev_data.py with 5 multi-role users | 25aa7749a | 2 households, 5 users with password_hash, reptile_access grants |
| 3 | Update Login page to show local auth option | c49d5d396 | Toggle OIDC/local auth, email/password form, POST /auth/local |
| 4 | Create DevUserSwitcher component and add to Settings | cecad5849 | DevUserSwitcher.jsx, Dev Tools tab, password reference table |

## Implementation Details

### Auth Router (auth_router.py)

Created new router with three endpoints:

```python
# POST /auth/local - Local username/password authentication
# Returns 403 if LOCAL_AUTH_ENABLED is false
# Verifies password via bcrypt, issues JWT tokens, sets cookies

# POST /auth/dev/switch - Switch user session (dev only)
# Returns 403 in non-development environment
# Issues new tokens for target user without password check

# GET /auth/dev/users - List users for switcher dropdown
# Returns 403 in non-development environment
# Returns user list with id, email, name, access_level
```

Password utilities using passlib:
```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def hash_password(password: str) -> str
def verify_password(plain_password: str, hashed_password: str) -> bool
```

### Dev User Seeding (seed_dev_data.py)

Created 5 dev users across 2 households per D-16:

**Household A (4 users):**
- owner@local.dev (owner123) - Owner
- admin@local.dev (admin123) - Admin
- caretaker@local.dev (caretaker123) - Caretaker
- viewer@local.dev (viewer123) - Viewer

**Household B (1 user):**
- other@local.dev (other123) - Owner (isolated for cross-household testing)

**Preserved:**
- dev@local.dev (dev123) - Owner in Household A (backward compat with auth bypass)

All users have:
- `password_hash` set via bcrypt
- `oidc_sub` pattern `local:{email}`
- `reptile_access` to all 4 reptiles (Household A users only)

### Login Page (Login.jsx)

Added local auth form toggle:
- Default: OIDC login ("Login with Single Sign-On")
- When local auth enabled, shows "Or sign in with email" link
- Local auth form: email + password inputs
- Submits to POST /auth/local
- On success: cookies set by backend, redirect to /
- Error handling: 401 (invalid), 403 (disabled)

### DevUserSwitcher Component

Created dropdown for instant user switching:
- Fetches users from GET /auth/dev/users
- Displays: "Name (email) - Role"
- On select: POST /auth/dev/switch, clear queryClient, reload page
- Loading and error states handled

### Settings Dev Tools Tab

Added conditional tab (dev environment only):
- "User Switching" section with DevUserSwitcher
- Current user display
- Password reference table for testing

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] auth_router.py exists in routers directory
- [x] POST /auth/local endpoint validates credentials and issues JWT
- [x] POST /auth/local returns 403 when local_auth_enabled is False
- [x] POST /auth/dev/switch swaps session to target user (dev only)
- [x] POST /auth/dev/switch returns 403 in non-dev environment
- [x] GET /auth/dev/users returns user list for switcher dropdown
- [x] Router included in main.py
- [x] passlib CryptContext configured with bcrypt
- [x] seed_dev_data.py creates 5 users (owner, admin, caretaker, viewer, other)
- [x] 4 users in Household A with different access levels
- [x] 1 user in Household B (isolated)
- [x] All users have password_hash set using bcrypt
- [x] All users have oidc_sub as "local:{email}"
- [x] Existing dev@local.dev user preserved
- [x] Household A users have reptile_access to all 4 reptiles
- [x] Household B user has no reptile access
- [x] Login.jsx has local auth form state
- [x] Login page shows option to switch between OIDC and local auth
- [x] Local auth form has email and password inputs
- [x] Form submits to POST /auth/local
- [x] DevUserSwitcher.jsx component exists
- [x] DevUserSwitcher fetches users from /auth/dev/users
- [x] Settings.jsx has Dev Tools tab (dev environment only)
- [x] Dev Tools tab contains DevUserSwitcher component

## Self-Check: PASSED

All files verified to exist:
- `apps/reptile-tracker/backend/app/routers/auth_router.py` - FOUND
- `apps/reptile-tracker/frontend/src/components/DevUserSwitcher.jsx` - FOUND

All commits verified:
- `749799a7a` - FOUND
- `25aa7749a` - FOUND
- `c49d5d396` - FOUND
- `cecad5849` - FOUND
