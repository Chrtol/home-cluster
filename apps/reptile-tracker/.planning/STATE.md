# Project State

## Current Position

**Phase:** 22 of 25 (Smart Notification System)
**Plan:** 3 of TBD complete
**Status:** In progress
**Last activity:** 2026-02-14 - Completed 22-03-PLAN.md (Completion-Aware Execution and Frequency Cap)

### Progress
```
Phase 20: Complete
Phase 21: Complete (celebration animations)
Phase 22: In progress (3/TBD complete: 22-01, 22-02, 22-03)
```

---

## Accumulated Decisions

| Phase | Decision | Rationale | Impact |
|-------|----------|-----------|---------|
| 21-01 | Single global toggle controls all celebrations | Simpler UX than per-feature toggles | All celebration features check single celebrationsEnabled flag |
| 21-01 | Auto-disable for prefers-reduced-motion with manual override | Respect accessibility by default | Users with reduced-motion preference start with celebrations disabled but can enable |
| 21-01 | Backend sync for celebration preference | Cross-device persistence | User preference stored in database, synced via /auth/me |
| 21-01 | Default celebrations to True for new users | Opt-out better than opt-in for positive features | New users see celebrations unless they disable or have reduced-motion |
| 21-03 | Party hat positioned top-left, angled left (-rotate-12) | Classic party hat orientation, matches user vision | Consistent visual appearance across all avatar sizes |
| 21-03 | Static hat (no animation) | Per user requirements, keeps UI subtle | Lower cognitive load, respects reduced-motion preferences |
| 21-03 | Festive styling matches ReptileStatusCard pattern | Visual consistency across birthday elements | Unified celebration aesthetic (fuchsia/violet theme) |
| 22-01 | Frequency cap defaults to 5 per reptile per day | Balance between notification usefulness and spam prevention | Users receive reasonable notifications without overwhelming |
| 22-01 | Frequency cap enabled by default | Safer default to prevent notification fatigue | New users protected from notification spam out-of-box |
| 22-01 | Frequency cap mode defaults to "silent" | Less intrusive than summary mode | Suppressed notifications don't generate additional notifications |
| 22-01 | Use PostgreSQL table for frequency tracking | Easier queries and cleanup vs Redis | Simpler architecture, consistent with existing data patterns |
| 22-02 | Separate templates for each trigger type with distinct title patterns | Better UX and clearer notification categorization | Each smart notification type has unique default template |
| 22-02 | Time formatting respects user locale settings | Consistent with existing localization patterns | window_start/window_end formatted at context build time |
| 22-03 | Check ScheduleInstance status at fire time | Per NOTIF-01 requirement, suppress notifications for completed tasks | Prevents redundant notifications after task completion |
| 22-03 | All notification types count against frequency cap | Unified cap enforcement across main, follow-up, expiry | Consistent daily notification limits |
| 22-03 | FOR UPDATE lock for atomic frequency counter increment | Prevent race conditions | Accurate count tracking with concurrent notifications |
| 22-03 | 7-day frequency tracking retention | Balance historical visibility with storage | Old records cleaned up automatically in daily maintenance |

---

## Active Context

**Current subsystem:** Backend / Notifications / Smart Notification System
**Key patterns:**
- Smart notification fields on Schedule model (follow-up, expiry alert)
- Frequency tracking via PostgreSQL table with composite index
- Per-schedule notification customization
- Per-user notification settings with frequency caps
- New template trigger types: follow_up_reminder, expiry_alert, frequency_cap_summary
- New template variables: window_start, window_end, follow_up_number, notifications_suppressed
- Completion check at fire time (NOTIF-01)
- Frequency cap integration in celery tasks

**Key files to remember:**
- `backend/app/models.py` - Schedule with smart notification fields, NotificationFrequencyTracking model
- `backend/migrations/versions/0083_add_smart_notification_fields.py` - Alembic migration for Phase 22 models
- `backend/migrations/versions/0083_add_smart_notification_templates.py` - Alembic migration for Phase 22 templates
- `backend/app/notifications.py` - Notification service with new trigger types and template variables
- `backend/app/scheduler/frequency_cap.py` - Frequency cap tracking functions (NEW in 22-03)
- `backend/app/celery_tasks.py` - Notification execution with completion check and frequency cap
- `backend/app/scheduler/core.py` - Daily maintenance with frequency tracking cleanup
- `docs/NOTIFICATION_SYSTEM.md` - Updated documentation for new trigger types

---

## Blockers & Concerns

None currently.

---

## Session Continuity

**Last session:** 2026-02-14
**Stopped at:** Plan 22-03 complete (Completion-Aware Execution and Frequency Cap)
**Resume from:** Next plan in phase 22 (follow-up reminder scheduling, expiry alert scheduling)
**Resume file:** `.planning/phases/22-smart-notification-system/22-04-PLAN.md` (if exists)

---

## Tech Stack Additions

| Phase | Technology | Purpose |
|-------|------------|---------|
| 21-01 | CelebrationContext (React) | Global celebration state management |
| 21-01 | prefers-reduced-motion detection | Accessibility support for animations |
| 21-03 | PartyHatIcon component | Birthday hat SVG with violet/fuchsia theme |
| 21-03 | Birthday detection pattern (date-fns) | Month/day equality check for annual birthdays |
| 21-03 | Conditional overlay rendering | Responsive hat sizing and positioning |
| 22-01 | NotificationFrequencyTracking model | Per-reptile daily notification count tracking |
| 22-01 | Smart notification Schedule fields | Follow-up reminders and expiry alerts per schedule |
| 22-02 | Smart notification trigger types | follow_up_reminder, expiry_alert, frequency_cap_summary |
| 22-02 | Smart notification template variables | window_start, window_end, follow_up_number, notifications_suppressed |
| 22-03 | frequency_cap.py module | Atomic frequency cap checking and increment with FOR UPDATE lock |
| 22-03 | Completion check at fire time | NOTIF-01 compliant notification suppression |
| 22-03 | Frequency cap summary notifications | Summary mode sends notification when cap reached |

---

## Next Steps

1. Implement follow-up reminder scheduling logic (22-04 - already partially committed)
2. Implement expiry alert scheduling logic (22-05)
3. All smart notification features will use the database models and templates created in 22-01 and 22-02

---

*Last updated: 2026-02-14T15:04:00Z*
