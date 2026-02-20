---
type: quick
id: 004
description: Fix change alert settings save and notification sending
completed: 2026-02-20
duration: 2m 24s
commits:
  - d3a3ad5e0
  - 8b8237b9f
---

# Quick Task 004: Fix Change Alert Settings Save and Notification Sending

**One-liner:** Fixed per-reptile alert settings auto-save endpoint mismatch and wired feeding/measurement alerts to send notifications on log creation

## Summary

Completed the Change Alerts system from Phase 28 by fixing two critical bugs:

1. **Frontend endpoint mismatch (404 errors)**: Frontend was calling non-existent PUT/POST endpoints for per-reptile settings. Fixed by using the existing PATCH endpoint that creates-or-updates.

2. **Alerts never triggered**: Feeding and measurement change alert detection logic existed but wasn't wired to the log creation routers. Added alert checks after log creation that trigger Celery task for async notification delivery.

## Tasks Completed

### Task 1: Fix frontend to use correct API endpoint
**Status:** Complete
**Commit:** d3a3ad5e0

**Changes:**
- Updated `ChangeAlertsTab.jsx` saveConfig function to use `PATCH /api/change-alerts/reptile/{reptile_id}/{alert_type}`
- Removed config.id lookup - PATCH endpoint handles both create and update
- Simplified useCallback dependencies (removed `configs`)

**Files modified:**
- `frontend/src/components/notifications/ChangeAlertsTab.jsx`

**Verification:** Per-reptile alert settings now save without 404 errors. Settings persist across page refreshes.

### Task 2: Wire change alerts to feeding/measurement log creation
**Status:** Complete
**Commit:** 8b8237b9f

**Changes:**
- Added feeding alert check in `feedings.py` after feeding creation (uses sync SessionLocal for feeding_alerts.py)
- Added measurement alert check in `measurements.py` after measurement creation (uses async session)
- Fixed `feeding_alerts.py` to return `trigger_type` instead of `alert_type` for consistency with Celery task
- Mapped feeding alert types: `no_feedings_logged` → `feeding_none_logged`, `eating_less` → `feeding_decrease`
- Reused existing `send_change_alert_notification_task` Celery task for async delivery

**Files modified:**
- `backend/app/routers/feedings.py`
- `backend/app/routers/measurements.py`
- `backend/app/scheduler/feeding_alerts.py`

**Verification:** Feeding/measurement alerts now trigger when thresholds exceeded. Notifications delivered to in-app and external channels. Cooldown periods respected.

## Deviations from Plan

**Rule 1 (Auto-fix bugs):**

**1. Feeding alerts trigger_type inconsistency**
- **Found during:** Task 2
- **Issue:** `feeding_alerts.py` returned `alert_type` but Celery task expects `trigger_type`
- **Fix:** Changed return dict keys to `trigger_type`, updated values to match Celery task expectations (`feeding_none_logged`, `feeding_decrease`)
- **Files modified:** `backend/app/scheduler/feeding_alerts.py`
- **Commit:** 8b8237b9f (included in Task 2)

This was a correctness issue - without this fix, feeding alerts would fail to render proper messages in notifications.

## Key Files

**Created:**
- None

**Modified:**
- `frontend/src/components/notifications/ChangeAlertsTab.jsx` - Fixed API endpoint calls
- `backend/app/routers/feedings.py` - Added feeding alert check after log creation
- `backend/app/routers/measurements.py` - Added measurement alert check after log creation
- `backend/app/scheduler/feeding_alerts.py` - Fixed trigger_type consistency

## Decisions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Reuse existing send_change_alert_notification_task | Celery task already handles feeding/measurement alerts with proper template rendering and channel delivery | No need to create separate tasks - one unified change alert task |
| Use sync SessionLocal for feeding alerts | feeding_alerts.py is written with sync SQLAlchemy (uses Session, not AsyncSession) | Prevents async/sync mismatch errors |
| Map alert_type to trigger_type in feeding_alerts.py | Celery task expects trigger_type for consistent template lookup | Enables proper fallback messages in notifications |

## Metrics

- **Tasks completed:** 2/2
- **Commits:** 2
- **Duration:** 2m 24s
- **Files modified:** 4
- **Deviations:** 1 (Rule 1 - bug fix)

## Next Steps

None - this quick task is complete and standalone.

## Self-Check: PASSED

**Files created:** None expected

**Commits verified:**
```bash
git log --oneline | grep -E "(d3a3ad5e0|8b8237b9f)"
```
- FOUND: d3a3ad5e0 - fix(quick-004): update frontend to use PATCH endpoint
- FOUND: 8b8237b9f - feat(quick-004): wire change alerts to log creation

**Files modified exist:**
- FOUND: apps/reptile-tracker/frontend/src/components/notifications/ChangeAlertsTab.jsx
- FOUND: apps/reptile-tracker/backend/app/routers/feedings.py
- FOUND: apps/reptile-tracker/backend/app/routers/measurements.py
- FOUND: apps/reptile-tracker/backend/app/scheduler/feeding_alerts.py

All claims verified. Summary accurate.
