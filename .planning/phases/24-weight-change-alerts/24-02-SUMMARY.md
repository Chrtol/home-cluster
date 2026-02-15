---
phase: 24-weight-change-alerts
plan: 02
subsystem: notifications
tags: [celery, templates, weight-alerts, health-monitoring]
dependency_graph:
  requires: [24-01, 24-01.5]
  provides: [weight-alert-delivery, celery-integration]
  affects: [notification-system, weight-logging]
tech_stack:
  added: [celery-weight-alerts]
  patterns: [async-notification-delivery, template-rendering, frequency-cap]
key_files:
  created:
    - backend/migrations/versions/0090_add_weight_change_alert_template.py
  modified:
    - backend/app/celery_tasks.py
    - backend/app/routers/weight.py
    - backend/app/scheduler/core.py
    - backend/app/notifications.py
decisions:
  - choice: Queue alerts via Celery for async delivery
    rationale: Decouples weight logging from notification delivery, prevents blocking
    alternatives: [synchronous-send, background-tasks]
  - choice: Daily sweep job at 4 AM UTC
    rationale: Safety net for missed alerts, runs after instance maintenance (3 AM)
    alternatives: [hourly-sweep, on-demand-only]
  - choice: Gold/amber color for Discord embeds
    rationale: Health-related alerts use warm warning colors (not critical red)
    alternatives: [red, yellow, blue]
metrics:
  duration_minutes: 20
  commits: 3
  files_modified: 5
  files_created: 1
  completed_at: "2026-02-15T14:18:29Z"
---

# Phase 24 Plan 02: Weight Alert Delivery Integration Summary

**One-liner:** Integrated weight change detection with Celery-based notification delivery via templates and scheduled daily sweep

## Objective

Wire up weight change detection logic to send actual notifications via existing template system and Celery task queue.

## What Was Built

### 1. Celery Task for Weight Alert Delivery (Task 1)

**File:** `backend/app/celery_tasks.py`

Created `send_weight_change_alert_task` following the pattern of `send_schedule_reminder_task`:

- **Load entities:** Reptile and WeightLog from database
- **Get users:** Fetch all users with access to reptile via `get_reptile_users`
- **Build context:** Alert context with baseline/current weight, change percentage, direction, time span
- **Template rendering:** Get template for `weight_change_alert` trigger or use fallback message
- **Multi-channel delivery:** Send to each user's enabled channels (in-app, Discord, Pushover, etc.)
- **Tracking update:** Call `update_weight_alert_tracking` to mark alert sent and start 7-day cooldown
- **Retry logic:** 3 retries with exponential backoff (60s, 120s, 240s)

**Fallback message format:**
```
📈/📉 **{reptile_name}** has experienced a significant weight change.

**Change:** {percent}% {direction} ({grams}g)
**Baseline:** {baseline}g
**Current:** {current}g
**Time span:** {days} days
```

**Commit:** `34ab44e51`

### 2. Router Integration (Task 2)

**File:** `backend/app/routers/weight.py`

Modified `create_weight_log` endpoint to trigger weight change check:

- **Import:** Added `check_weight_change_alert` from `app.scheduler.weight_alerts`
- **Trigger point:** AFTER commit/refresh (ensures weight log persisted)
- **Error handling:** Try/except to prevent weight log creation failure if alert check fails
- **Celery dispatch:** If alert context returned, queue `send_weight_change_alert_task.delay()`
- **PATCH exclusion:** Only triggers on POST (creation), not PATCH (updates) per plan requirement

**Flow:**
```
POST /api/weight
 → Save weight log
 → Commit to DB
 → Check alert (compare to baseline)
 → If threshold exceeded + cap not reached:
   → Queue Celery task
 → Return weight log
```

**Commit:** `082452702`

### 3. Default Template and Daily Sweep (Task 3)

#### Migration 0090
**File:** `backend/migrations/versions/0090_add_weight_change_alert_template.py`

Inserts default system template for `weight_change_alert` trigger type:

- **Template type:** system
- **Message:** `{reptile_name} has had a significant weight {change_direction}.\n\n**Change:** {weight_change_percent}% ({weight_change_grams}g)\n**From:** {baseline_weight}g to {current_weight}g\n**Over:** {time_span_days} days`
- **Title:** `Weight Alert - {reptile_name}`
- **Priority:** 100
- **Active:** true

#### Notifications.py Updates
**File:** `backend/app/notifications.py`

- **Documentation:** Added `weight_change_alert` to trigger type list (Phase 24 section)
- **Discord color:** Added `"weight_change_alert": 15844367` (gold/amber) to `color_map`

#### Daily Sweep Job
**File:** `backend/app/scheduler/core.py`

Created `daily_weight_alert_sweep()` function:

- **Schedule:** 4 AM UTC (runs after instance maintenance at 3 AM)
- **Lookback window:** Last 24 hours
- **Logic:**
  1. Query all `WeightLog` entries from last 24 hours
  2. For each log, call `check_weight_change_alert(db, log, is_sweep=True)`
  3. If alert context returned, queue Celery task
  4. Log count of alerts triggered
- **Purpose:** Safety net for edge cases where on-creation trigger failed
- **Added to `__all__`:** Exported for external access

**Commit:** `5ab1c8646`

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

### From Phase 24-01 (Detection Logic)
- Uses `check_weight_change_alert()` from `app.scheduler.weight_alerts`
- Uses `update_weight_alert_tracking()` to mark alerts sent
- Leverages `get_threshold_for_reptile()` via detection module

### From Phase 24-01.5 (Template UX)
- Renders templates via existing `get_template_for_trigger()` and `render_template()`
- Supports channel-specific templates (Discord, Pushover, in-app)

### To Existing Systems
- **Celery:** New task type `send_weight_change_alert_task` in task queue
- **Notification templates:** New trigger type `weight_change_alert` in template system
- **Scheduler:** New daily job `daily_weight_alert_sweep` at 4 AM UTC
- **Weight router:** POST endpoint now triggers alert check

## Testing Notes

**Manual test path:**
1. Create weight log with significant change (>threshold %)
2. Verify Celery task queued (check Celery logs)
3. Verify notification sent to enabled channels
4. Verify tracking record updated (7-day cooldown started)
5. Create another weight log immediately → should NOT alert (cap reached)
6. Wait 7 days → next weight log with change should alert

**Daily sweep test:**
1. Force-fail weight log creation alert (e.g., raise exception in router)
2. Wait for 4 AM UTC sweep
3. Verify sweep finds log and triggers alert retroactively

## Next Phase Readiness

**Phase 24-03 (Frontend UX) blockers:** None

**Prerequisites met:**
- ✅ Backend alert delivery working
- ✅ Templates created and rendering
- ✅ Frequency cap integrated
- ✅ Multi-channel support (in-app, Discord, Pushover)

**Frontend can now:**
- Display weight alerts in notification center (in-app channel)
- Show alert context (baseline, current, change %, time span)
- Allow users to customize templates per channel

## Self-Check: PASSED

**Created files exist:**
```
✓ backend/migrations/versions/0090_add_weight_change_alert_template.py
```

**Commits exist:**
```
✓ 34ab44e51 feat(24-02): add Celery task for weight change alert delivery
✓ 082452702 feat(24-02): integrate weight alert check in weight router POST endpoint
✓ 5ab1c8646 feat(24-02): add default template and daily sweep job for weight alerts
```

**Functions exist:**
```
✓ send_weight_change_alert_task in backend/app/celery_tasks.py (line 990)
✓ check_weight_change_alert import in backend/app/routers/weight.py (line 12)
✓ daily_weight_alert_sweep in backend/app/scheduler/core.py (line 1486)
✓ weight_change_alert color in backend/app/notifications.py (line 408)
```

**Scheduler job registered:**
```
✓ daily_weight_alert_sweep job added at line 1738 (4 AM UTC)
✓ Exported in __all__ at line 82
```

All artifacts verified. Plan 24-02 complete.
