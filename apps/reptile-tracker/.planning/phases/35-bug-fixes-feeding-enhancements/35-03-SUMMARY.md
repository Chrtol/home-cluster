---
phase: 35
plan: 03
subsystem: feeding-tracking
tags: [feeding, refusal, retry-scheduling, ui, backend]
dependency_graph:
  requires: [35-01]
  provides: [refused-feeding-tracking, retry-scheduling, amber-indicators]
  affects: [feeding-log, activity-history, recent-activity-widget]
tech_stack:
  added: []
  patterns: [service-layer, form-validation, conditional-ui]
key_files:
  created:
    - backend/app/services/feeding_refusal_service.py
  modified:
    - backend/app/schemas.py
    - backend/app/routers/feedings.py
    - backend/app/services/__init__.py
    - frontend/src/pages/FeedingLog.jsx
    - frontend/src/components/dashboard/RecentActivityWidget.jsx
    - frontend/src/pages/ActivityHistory.jsx
decisions:
  - Amber color scheme for refused feedings (distinct from green feeding, red health)
  - Three retry options (tomorrow same time, next scheduled, custom)
  - Retry creates ScheduleInstance for notification support
  - XCircle icon replaces Utensils for refused feedings
metrics:
  duration: ~12 minutes
  completed: 2026-06-08
---

# Phase 35 Plan 03: Refused Feeding Tracking Summary

Track refused feedings with amber indicators and retry scheduling options.

## One-liner

Feeding refusal tracking with retry scheduling service, form UI with amber styling, and amber indicators in activity widgets.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | f8249cdd3 | Add status/retry fields to feeding schemas and router |
| 2 | f61a685e0 | Create feeding refusal service with retry scheduling |
| 3 | e5bc2244a | Add refused toggle and retry prompt to FeedingLog |
| 4 | 104ce34f5 | Add amber indicators in activity views |

## Changes Made

### Backend (Tasks 1-2)

**Schema Updates (schemas.py):**
- Added `RetryOption` enum with `tomorrow_same_time`, `next_scheduled`, `custom` values
- Added to `FeedingCreate`: `status`, `retry_option`, `retry_datetime` fields
- Added to `Feeding` response: `status`, `retry_scheduled_for`, `retry_instance_id` fields

**Router Updates (feedings.py):**
- Import `FeedingStatus` from models
- Set `status` field on new feedings
- Call `schedule_feeding_retry()` when status is REFUSED and retry_option provided
- Include status fields in all response dictionaries (list, create, get, update)

**Feeding Refusal Service (feeding_refusal_service.py):**
- `schedule_feeding_retry()`: Creates ScheduleInstance for retry with notification support
- `_calculate_retry_datetime()`: Handles retry option logic
- `_find_matching_schedule()`: Finds feeding schedule for notification integration
- `_schedule_retry_notifications()`: Schedules notifications via existing system
- `get_next_scheduled_feeding()`: Resolves NEXT_SCHEDULED retry option
- `cancel_retry()`: Cancels scheduled retry and cleans up instance

### Frontend (Tasks 3-4)

**FeedingLog.jsx:**
- Added `is_refused` checkbox with amber styling
- When refused, shows retry options panel with three choices
- Custom retry option shows date/time pickers
- Form validation requires retry option when refused
- View mode shows refused indicator with retry datetime
- Payload includes `status`, `retry_option`, `retry_datetime`

**RecentActivityWidget.jsx:**
- Added `refused` color scheme (amber)
- Refused feedings show XCircle icon instead of Utensils
- "Refused" badge replaces category badge for refused items
- Summary prefixed with "Refused:" for clarity

**ActivityHistory.jsx:**
- Same amber indicators as RecentActivityWidget
- XCircle icon and amber iconColor for refused feedings
- "Refused" badge with amber styling

## Technical Notes

- FeedingStatus enum was already added in Plan 01 (models.py)
- Retry scheduling leverages existing ScheduleInstance and notification infrastructure
- Color scheme uses amber-500 variants for consistency with design system
- Service is exported from `app.services` for easy import

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] backend/app/services/feeding_refusal_service.py exists
- [x] backend/app/schemas.py modified with status fields
- [x] backend/app/routers/feedings.py handles status
- [x] frontend/src/pages/FeedingLog.jsx has refused toggle
- [x] frontend/src/components/dashboard/RecentActivityWidget.jsx has amber indicators
- [x] frontend/src/pages/ActivityHistory.jsx has amber indicators
- [x] All commits present in git log
