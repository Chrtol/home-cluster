---
phase: 23-notification-planner
plan: 03
subsystem: notifications
tags: [planner, digest, scheduling, celery, apscheduler, timezone-aware]
dependencies:
  requires: [23-01, 23-02]
  provides: [digest-scheduling, digest-delivery]
  affects: [scheduler, celery-workers]
tech-stack:
  added: []
  patterns: [cron-scheduling, timezone-conversion, format-branching, frequency-cap]
key-files:
  created: []
  modified:
    - backend/app/scheduler/core.py
    - backend/app/celery_tasks.py
    - backend/app/scheduler/__init__.py
decisions:
  - id: D23-03-1
    decision: Use APScheduler cron jobs at midnight UTC to schedule per-user delivery jobs
    rationale: Centralized scheduling point + timezone-aware per-user delivery times
    alternatives: [Per-user cron jobs, Celery Beat]
  - id: D23-03-2
    decision: Empty digest suppression in execute_*_planner_delivery functions
    rationale: Check before queuing to Celery, avoid unnecessary task overhead
    alternatives: [Check in Celery task]
  - id: D23-03-3
    decision: Use build_individual_task_message from digest.py for individual format
    rationale: Single source of truth for task formatting ensures consistency
    alternatives: [Duplicate formatting logic in celery_tasks.py]
  - id: D23-03-4
    decision: Digest notifications skip quiet hours check
    rationale: User explicitly configured delivery time - intentional override
    alternatives: [Respect quiet hours, Add separate quiet hours override setting]
metrics:
  duration: 265 seconds
  completed: 2026-02-14T21:28:46Z
---

# Phase 23 Plan 03: Digest Scheduling & Delivery Summary

**One-liner:** APScheduler cron jobs schedule timezone-aware planner digests, Celery tasks deliver with grouped/individual format branching using digest.py as single source of truth

## Implementation Overview

Implemented the final wiring for planner digest notifications: APScheduler cron jobs run at midnight UTC to schedule per-user delivery jobs at their configured times (timezone-aware), then Celery tasks build and send digests via all enabled channels with format branching (grouped = single message, individual = per-task notifications using build_individual_task_message from digest.py).

## Completed Tasks

### Task 1: Add digest scheduling functions to scheduler/core.py
**Status:** Complete
**Commit:** 4fe2fa8ce

**Changes:**
- Imported digest module functions (get_pending_instances_for_date, get_overdue_instances_for_user, get_weekly_instances, build_*_message)
- Added `schedule_daily_planner_jobs()` - runs at 00:01 UTC daily, schedules per-user delivery jobs
- Added `schedule_weekly_planner_jobs()` - runs at 00:02 UTC daily, checks configured day
- Added `execute_daily_planner_delivery()` - APScheduler callback, checks for tasks, queues to Celery
- Added `execute_weekly_planner_delivery()` - APScheduler callback for weekly digest
- Updated `__all__` exports with new planner functions
- Added cron job registrations in `start_scheduler()`

**Key patterns:**
- Timezone conversion: user's local time → UTC for APScheduler run_date
- Empty digest suppression: return early if no instances (before queuing to Celery)
- Date trigger: 'date' trigger for one-time per-user delivery jobs
- Day-of-week conversion: Python weekday() → Sunday=0 format

**Files modified:**
- `backend/app/scheduler/core.py` (+246 lines)

### Task 2: Add Celery tasks for digest delivery with format branching
**Status:** Complete
**Commit:** 75125d3ec

**Changes:**
- Added `send_daily_planner_task()` - Celery task for daily digest delivery
- Added `send_weekly_planner_task()` - Celery task for weekly digest delivery
- Added `_send_individual_task_notifications()` helper - uses `build_individual_task_message` from digest.py
- Added `_send_grouped_digest_notification()` helper - original digest behavior
- Implemented format branching based on `settings.digest_format` (grouped vs individual)
- Frequency cap increment per reptile mentioned (grouped digest = 1 per reptile)
- Quiet hours bypass (digest has intentional delivery time)

**Key patterns:**
- Re-fetch instances from DB in Celery task (serialized IDs from scheduler)
- Check instance status (skip if completed since scheduling)
- Format branching: `if digest_format == "individual"` → use build_individual_task_message
- Individual format: reuses existing overdue_alert/schedule_reminder templates
- Grouped format: uses build_daily_digest_message/build_weekly_digest_message
- Short-form for Pushover channel

**Files modified:**
- `backend/app/celery_tasks.py` (+429 lines)

### Task 3: Update scheduler __init__.py exports
**Status:** Complete
**Commit:** da17458bd

**Changes:**
- Imported digest module functions
- Exported all digest query and formatting functions
- Allows other modules to import from `app.scheduler` directly

**Files modified:**
- `backend/app/scheduler/__init__.py` (+19 lines)

## Deviations from Plan

None - plan executed exactly as written.

## Technical Details

### Scheduling Flow

1. **Midnight UTC cron jobs:**
   - 00:01 UTC: `schedule_daily_planner_jobs` - queries users with `daily_planner_enabled=True`
   - 00:02 UTC: `schedule_weekly_planner_jobs` - queries users with `weekly_planner_enabled=True`, checks configured day

2. **Per-user delivery scheduling:**
   - Calculate user's local time: `datetime.combine(today_local, delivery_time_local, tzinfo=user_tz)`
   - Convert to UTC: `delivery_datetime_local.astimezone(timezone.utc)`
   - Schedule APScheduler job with `trigger='date'` and `run_date=delivery_datetime_utc`
   - Skip if delivery time already passed (user missed today's window)

3. **Delivery execution:**
   - APScheduler calls `execute_*_planner_delivery` at user's configured time
   - Query pending instances via digest.py functions
   - Skip if no tasks (empty digest suppression)
   - Serialize instance IDs, queue to Celery task

4. **Celery delivery:**
   - Re-fetch instances from DB (check status, eagerly load schedule+reptile)
   - Get user's `digest_format` setting
   - Branch: grouped (single message) or individual (per-task notifications)
   - Send via all enabled channels
   - Increment frequency cap per reptile

### Format Branching

**Grouped (default):**
- Single digest message with all tasks
- Uses `build_daily_digest_message()` or `build_weekly_digest_message()`
- Sent via `_send_grouped_digest_notification()`

**Individual:**
- Separate notification per task
- Uses `build_individual_task_message()` from digest.py (single source of truth)
- Reuses existing templates (schedule_reminder, overdue_alert)
- Sent via `_send_individual_task_notifications()`

### Timezone Handling

- User's timezone stored in `User.timezone` (ZoneInfo string)
- Delivery time stored as `Time` type (user's local time context)
- Conversion: local time → UTC for APScheduler
- Weekly day: 0=Sunday, 6=Saturday (converted from Python's Monday=0)

### Empty Digest Suppression

Checked in two places:
1. `execute_*_planner_delivery()` - before queuing to Celery
2. Celery task - after re-fetching instances (in case completed since scheduling)

### Frequency Cap

- Grouped digest: 1 notification per reptile mentioned
- Individual format: same cap (1 per reptile, but sent as separate messages)
- Collected reptile IDs from all instances, increment once per reptile

## Verification Results

1. Cron job registration: ✓ `schedule_daily_planners` at 00:01 UTC, `schedule_weekly_planners` at 00:02 UTC
2. Celery tasks exist: ✓ `send_daily_planner_task`, `send_weekly_planner_task`
3. Format branching: ✓ `digest_format == "individual"` conditional logic present
4. Import check: ✓ `from .digest import` in core.py and celery_tasks.py
5. Individual format uses digest.py: ✓ `build_individual_task_message` imported and used
6. Empty digest suppression: ✓ Early return in `execute_daily_planner_delivery`

## Success Criteria

- [x] APScheduler cron job "schedule_daily_planners" runs at 00:01 UTC daily
- [x] APScheduler cron job "schedule_weekly_planners" runs at 00:02 UTC daily
- [x] Per-user delivery jobs use 'date' trigger with user's timezone-aware delivery time
- [x] send_daily_planner_task and send_weekly_planner_task Celery tasks exist
- [x] When digest_format == "grouped": sends single digest message with all tasks
- [x] When digest_format == "individual": imports and uses build_individual_task_message from digest.py
- [x] Empty digest check prevents sending when no tasks
- [x] Frequency cap incremented per reptile mentioned in digest
- [x] Digest skips quiet hours check (intentional delivery time)

## Self-Check

**File existence check:**
```bash
[x] backend/app/scheduler/core.py - FOUND
[x] backend/app/celery_tasks.py - FOUND
[x] backend/app/scheduler/__init__.py - FOUND
```

**Commit verification:**
```bash
[x] 4fe2fa8ce - feat(23-03): add digest scheduling functions to scheduler/core.py
[x] 75125d3ec - feat(23-03): add Celery tasks for digest delivery with format branching
[x] da17458bd - feat(23-03): update scheduler __init__.py exports for digest functions
```

**Function verification:**
```bash
[x] schedule_daily_planner_jobs() - FOUND at line 1269
[x] schedule_weekly_planner_jobs() - FOUND at line 1334
[x] execute_daily_planner_delivery() - FOUND at line 1402
[x] execute_weekly_planner_delivery() - FOUND at line 1436
[x] send_daily_planner_task() - FOUND at line 692
[x] send_weekly_planner_task() - FOUND at line 978
[x] _send_individual_task_notifications() - FOUND at line 819
[x] _send_grouped_digest_notification() - FOUND at line 889
```

**Import verification:**
```bash
[x] digest imports in core.py - FOUND at line 44
[x] build_individual_task_message import in celery_tasks.py - FOUND (multiple locations)
[x] digest exports in __init__.py - FOUND at line 42
```

## Self-Check: PASSED

All files created/modified exist. All commits verified. All functions present with expected signatures.

## Next Phase Readiness

**Ready for:** Plan 23-04 (Planner Digest UI) - already completed (see STATE.md)

**Blockers:** None

**Notes:**
- Plan 23-04 was completed out of order (already has SUMMARY.md)
- This completes the backend implementation for planner digests
- Ready for end-to-end testing with real users and timezone scenarios
