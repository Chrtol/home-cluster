---
phase: 22
plan: 02
subsystem: notifications/templates
tags: [notifications, templates, smart-notifications, phase-22]

dependency_graph:
  requires: []
  provides:
    - Smart notification trigger types (follow_up_reminder, expiry_alert, frequency_cap_summary)
    - Template variables for smart notifications (window_start, window_end, follow_up_number, notifications_suppressed)
    - Default system templates for new trigger types
  affects:
    - backend/app/notifications.py
    - backend/app/scheduler/notifications.py (future - will use new templates)

tech_stack:
  added: []
  patterns:
    - Alembic migration for inserting system templates
    - SafeDict pattern for template variable substitution
    - Discord embed field handlers for new variables

key_files:
  created:
    - backend/migrations/versions/0083_add_smart_notification_templates.py
  modified:
    - backend/app/notifications.py
    - docs/NOTIFICATION_SYSTEM.md

decisions:
  - decision: "Separate templates for each trigger type with distinct title patterns"
    rationale: "Better user experience and clearer notification categorization"
  - decision: "Time formatting respects user locale settings"
    rationale: "User decision - formatting happens at context build time"

metrics:
  duration: "4m 51s"
  completed: 2026-02-14
---

# Phase 22 Plan 02: Extend Template System Summary

Extended template system to support new trigger types and variables for smart notification features.

## One-liner

Template system now recognizes follow_up_reminder, expiry_alert, and frequency_cap_summary triggers with default templates and smart notification variables.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Template Variables for Smart Notifications | a8355b5fb | backend/app/notifications.py |
| 2 | Create Default Templates Migration | 7c4c285ac | backend/migrations/versions/0083_add_smart_notification_templates.py |
| 3 | Update NOTIFICATION_SYSTEM.md Trigger Types Section | 8a2e1210b | docs/NOTIFICATION_SYSTEM.md |

## Implementation Details

### Task 1: Template Variables and Trigger Types

Added to `notifications.py`:

1. **Documentation block** explaining supported trigger types and template variables:
   - Core triggers: schedule_reminder, overdue_alert, feeding_logged
   - Smart notification triggers (Phase 22): follow_up_reminder, expiry_alert, frequency_cap_summary

2. **New template variables documented**:
   - `window_start` - Schedule window start time (formatted per user locale)
   - `window_end` - Schedule window end time (formatted per user locale)
   - `follow_up_number` - Which follow-up this is (1, 2, etc.)
   - `notifications_suppressed` - Count of suppressed notifications

3. **Discord color codes** for new trigger types:
   - `follow_up_reminder`: Orange (16750899)
   - `expiry_alert`: Bright red (16711680)
   - `frequency_cap_summary`: Purple (10181046)

4. **Discord embed field handlers** for new variables in `_create_discord_embed()`:
   - Window Start, Window End, Follow-up #, Tasks Suppressed

### Task 2: Migration for Default Templates

Created `0083_add_smart_notification_templates.py`:

1. **Follow-up Reminder (Default)** template:
   - Message: `{emoji} **Still Pending:** {schedule_name} for **{reptile_name}** (Follow-up #{follow_up_number}){time_window}{notes}`
   - Title: `Follow-up #{follow_up_number} - {reptile_name}`

2. **Window Expiry Alert (Default)** template:
   - Message: `{emoji} **Window Closing:** {schedule_name} for **{reptile_name}** - window {window_start}-{window_end} is ending soon!`
   - Title: `Window Closing - {reptile_name}`

3. **Frequency Cap Summary (Default)** template:
   - Message: `{reptile_name} has {notifications_suppressed} more tasks today. Notification limit reached.`
   - Title: `Tasks Remaining - {reptile_name}`

### Task 3: Documentation Updates

Updated `NOTIFICATION_SYSTEM.md`:

1. **Added Smart Notification Triggers section** after Requirement Schedule Triggers
2. **Added Smart Notification Variables table** after Quota Warning Variables
3. Documented all three new trigger types with their timing and behavior

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] `notifications.py` contains new template variables documentation
- [x] Migration file `0083_add_smart_notification_templates.py` exists
- [x] Migration contains templates for all three new trigger types
- [x] `NOTIFICATION_SYSTEM.md` documents new trigger types and variables
- [x] Discord embed field handlers support new variables

## Self-Check

### Files Exist

```
FOUND: backend/app/notifications.py
FOUND: backend/migrations/versions/0083_add_smart_notification_templates.py
FOUND: docs/NOTIFICATION_SYSTEM.md
```

### Commits Exist

```
FOUND: a8355b5fb
FOUND: 7c4c285ac
FOUND: 8a2e1210b
```

## Self-Check: PASSED

## Next Steps

- Plan 22-03: Implement follow-up reminder scheduling logic
- Plan 22-04: Implement expiry alert scheduling logic
- Plan 22-05: Implement frequency cap summary logic
