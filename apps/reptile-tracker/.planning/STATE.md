# Project State

## Current Position

**Phase:** 23 of 25 (Notification Planner)
**Plan:** 4 of 4 (all complete)
**Status:** Phase complete
**Last activity:** 2026-02-15 - Phase 23 UAT passed (all 11 tests)

### Progress
```
Phase 20: Complete
Phase 21: Complete (celebration animations)
Phase 22: Complete (smart notification system: 22-01, 22-02, 22-03, 22-04, 22-05)
Phase 23: Complete (notification planner: 23-01 ✓, 23-02 ✓, 23-03 ✓, 23-04 ✓)
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
| 22-04 | Follow-up scheduled from main reminder only (no infinite chains) | Prevent notification spam | Follow-up tasks never schedule more follow-ups |
| 22-04 | Expiry alert offset from window_start (earliest_time) | Per user decision, allows flexible offset placement | Users set offset relative to window start, not end |
| 22-04 | Fire-time completion check for follow-up and expiry | Suppress if task completed between scheduling and fire | Avoids redundant notifications |
| 22-05 | Smart Notifications section only visible when notifications enabled | Clean UX, hide complexity when not relevant | Users see options only when they need them |
| 22-05 | Expiry alert section only visible when time window enabled | Logical dependency - expiry makes no sense without window | Prevents confusion from non-applicable options |
| 22-05 | Warning for expiry offset exceeding window (non-blocking) | Flexibility for advanced users | Users can configure edge cases intentionally |
| 23-01 | weekly_planner_day uses 0-6 integer (Sunday=0) | Matches Python's weekday() + 1 % 7 pattern and cron notation | Consistent with common scheduling conventions |
| 23-01 | daily_planner_time is nullable Time type | Defaults to 08:00 in application logic/UI layer | Flexible default time handling |
| 23-01 | digest_format defaults to "grouped" | Single message with all tasks is default, opt-in for individual | Reduces notification noise by default |
| 23-01 | Planner fields in NotificationSettings model | Extended existing model vs separate table | Simpler architecture, planner settings are per-user preferences |
| 23-02 | Weekly digest covers [start_date, start_date + 6] = 7 days total | Send date IS day 1 of the 7-day range (inclusive semantics) | Clear date range definition prevents off-by-one errors |
| 23-02 | Overdue section only shows yesterday's missed tasks | Per CONTEXT.md, not accumulated backlog | Prevents notification fatigue from old missed tasks |
| 23-02 | build_task_line is single source of truth for task formatting | Reusable by both grouped and individual digest modes | Ensures consistent formatting across notification modes |
| 23-02 | Message builders return Dict with title/message keys | Template consumption pattern | Clean interface between digest generation and notification system |
| 23-04 | Auto-create in-app channel on settings GET | Ensures every user has in-app notifications available | No manual channel setup required |
| 23-04 | digest_channel_id with SET NULL on delete | Graceful fallback to all channels if selected channel deleted | Robust configuration |
| 23-04 | Weekly planner default day from getDayNumbers()[0] | Dynamic locale-aware default | Respects user's first day of week preference |
| 23-04 | Weekly planner shows time picker when daily disabled | Independent time configuration | Users can configure weekly-only digests |
| 23-03 | APScheduler cron jobs at midnight UTC to schedule per-user delivery | Centralized scheduling point + timezone-aware per-user delivery times | Single cron job schedules individual delivery jobs at user's local time |
| 23-03 | Empty digest suppression in execute_*_planner_delivery functions | Check before queuing to Celery, avoid unnecessary task overhead | Prevents empty digest notifications |
| 23-03 | Use build_individual_task_message from digest.py for individual format | Single source of truth for task formatting ensures consistency | Grouped and individual modes use same task formatting logic |
| 23-03 | Digest notifications skip quiet hours check | User explicitly configured delivery time - intentional override | Planner digest delivered at exact configured time regardless of quiet hours |

---

## Active Context

**Current subsystem:** Notification Planner (in progress)
**Key patterns:**
- Planner digest settings stored in NotificationSettings model
- weekly_planner_day uses Integer 0-6 (Sunday=0, Saturday=6)
- daily_planner_time stored as Time type (user's timezone context)
- digest_format enum: "grouped" or "individual"
- Planner settings follow same pattern as quiet hours (enabled boolean + time/day configuration)

**Previous subsystem:** Smart Notification System (complete)
- Smart notification fields on Schedule model (follow-up, expiry alert)
- Frequency tracking via PostgreSQL table with composite index
- Per-schedule notification customization via ScheduleForm UI
- Per-user notification settings with frequency caps via Settings UI
- New template trigger types: follow_up_reminder, expiry_alert, frequency_cap_summary
- New template variables: window_start, window_end, follow_up_number, notifications_suppressed
- Completion check at fire time (NOTIF-01)

**Key files to remember:**
- `backend/app/models.py` - NotificationSettings with planner digest fields + digest_channel_id (23-01, 23-04)
- `backend/app/schemas.py` - Pydantic schemas for planner settings (23-01, 23-04)
- `backend/app/scheduler/digest.py` - Digest generation module with query and formatting functions (23-02)
- `backend/app/scheduler/core.py` - Digest scheduling cron jobs + execution functions (23-03)
- `backend/app/celery_tasks.py` - Digest delivery Celery tasks with format branching (23-03)
- `backend/app/scheduler/__init__.py` - Digest function exports (23-03)
- `backend/app/routers/notification_settings.py` - Auto-creates settings + in-app channel on GET (23-04)
- `backend/app/routers/notification_channels.py` - Auto-creates in-app channel on GET (23-04)
- `backend/migrations/versions/0085_add_planner_digest_settings.py` - Alembic migration for planner schema (23-01)
- `backend/migrations/versions/0086_add_planner_digest_templates.py` - Alembic migration for planner templates (23-02)
- `backend/migrations/versions/0087_add_digest_channel_id.py` - Alembic migration for digest channel (23-04)
- `backend/app/notifications.py` - Notification service with planner trigger types (23-02) and template variables
- `backend/app/scheduler/frequency_cap.py` - Frequency cap tracking functions (22-03)
- `backend/app/scheduler/jobs.py` - schedule_follow_up_reminder, schedule_expiry_alert functions (22-04)
- `frontend/src/pages/ScheduleForm.jsx` - Smart Notifications section UI (22-05)
- `frontend/src/components/NotificationsTab_new.jsx` - Planner Digests UI with channel selection (23-04)
- `docs/NOTIFICATION_SYSTEM.md` - Updated documentation for new trigger types

---

## Blockers & Concerns

None currently. Phase 23 complete - all planner digest functionality implemented end-to-end.

---

## Session Continuity

**Last session:** 2026-02-15
**Stopped at:** Phase 23 UAT complete - all planner delivery issues fixed
**Resume from:** Phase 24 (Weight Change Alerts)
**Resume command:** `/gsd:execute-phase 24`

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
| 22-04 | schedule_follow_up_reminder | Schedule follow-up X minutes after main reminder |
| 22-04 | schedule_expiry_alert | Schedule alert at window_start + offset |
| 22-04 | execute_follow_up_notification / execute_expiry_alert | Fire-time execution with completion check |
| 22-04 | send_follow_up_reminder_task / send_expiry_alert_task | Celery delivery with template support |
| 22-05 | shadcn-ui/collapsible | Collapsible sections for advanced settings |
| 22-05 | Collapsible settings sections pattern | Hide complexity until needed |
| 23-01 | Planner digest schema fields | Daily/weekly planner enabled, time/day, digest format in NotificationSettings |
| 23-01 | Migration 0085 | Planner digest settings columns with proper defaults |
| 23-02 | scheduler/digest.py module | Query logic for pending/overdue tasks, message builders for daily/weekly digests |
| 23-02 | daily_planner and weekly_planner trigger types | New notification trigger types for digest notifications |
| 23-02 | Migration 0086 | Default templates for daily_planner and weekly_planner |
| 23-02 | Digest query pattern | get_user_reptile_ids → filter by household membership for multi-user access |
| 23-02 | Task line formatting pattern | build_task_line as single source of truth for consistent formatting |
| 23-04 | Auto-create in-app channel pattern | ensure_in_app_channel called on GET settings/channels |
| 23-04 | Migration 0087 | digest_channel_id FK with SET NULL ondelete |
| 23-04 | Planner Digests UI section | TimePicker, channel selector, locale-aware day defaults |
| 23-04 | getDayNumbers()[0] for default | Dynamic first-day-of-week default |
| 23-03 | APScheduler cron jobs for planner scheduling | Midnight UTC cron jobs schedule per-user delivery at timezone-aware times |
| 23-03 | Celery digest delivery tasks | send_daily_planner_task and send_weekly_planner_task with format branching |
| 23-03 | Format branching (grouped vs individual) | Single message or per-task notifications based on digest_format setting |
| 23-03 | build_individual_task_message as single source | Digest.py provides consistent formatting for individual mode |

---

## Phase 22 Completion Summary

**Smart Notification System - Feature Complete**

All original requirements implemented:
- NOTIF-01: Notification suppressed if schedule instance is complete
- NOTIF-02: Window expiry alert configurable per schedule
- NOTIF-03: Expiry threshold configurable (offset from window start)
- Frequency cap per reptile per day with silent/summary modes

Plans completed:
- 22-01: Database models and migrations
- 22-02: Template system with new trigger types
- 22-03: Frequency cap module and celery integration
- 22-04: Follow-up and expiry alert scheduling
- 22-05: UI configuration for all smart notification features

---

## Phase 23 Completion Summary

**Notification Planner - Feature Complete**

All planner digest functionality implemented:
- Daily planner: timezone-aware delivery at user's configured morning time
- Weekly planner: delivered on user's configured day
- Format branching: grouped (single message) vs individual (per-task notifications)
- Empty digest suppression: only send when there are tasks
- Frequency cap integration: counts per reptile mentioned
- Quiet hours bypass: intentional delivery time override

Plans completed:
- 23-01: Planner digest schema (database and API layer)
- 23-02: Digest generation and formatting (query logic, message builders)
- 23-03: Scheduler jobs (APScheduler cron jobs + Celery delivery tasks)
- 23-04: Frontend UI for planner settings (Planner Digests section, channel selection, auto-created in-app channel)

---

## Next Steps

1. Move to Phase 24 (next phase in roadmap)
2. Test planner digest delivery end-to-end with real users and timezone scenarios

---

*Last updated: 2026-02-15T12:00:00Z*
