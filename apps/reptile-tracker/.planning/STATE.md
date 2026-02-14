# Project State

## Current Position

**Phase:** 22 of 25 (Smart Notification System)
**Plan:** 1 of TBD complete
**Status:** In progress
**Last activity:** 2026-02-14 - Completed 22-01-PLAN.md (Database Models for Smart Notifications)

### Progress
```
Phase 20: Complete
Phase 21: Complete (celebration animations)
Phase 22: In progress (1/TBD complete: 22-01)
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

---

## Active Context

**Current subsystem:** Backend / Notifications / Smart Notification System
**Key patterns:**
- Smart notification fields on Schedule model (follow-up, expiry alert)
- Frequency tracking via PostgreSQL table with composite index
- Per-schedule notification customization
- Per-user notification settings with frequency caps

**Key files to remember:**
- `backend/app/models.py` - Schedule with smart notification fields, NotificationFrequencyTracking model
- `backend/migrations/versions/0083_add_smart_notification_fields.py` - Alembic migration for Phase 22
- `backend/app/notifications.py` - Notification service (to be extended)
- `backend/app/scheduler.py` - APScheduler integration (to be extended)

---

## Blockers & Concerns

None currently.

---

## Session Continuity

**Last session:** 2026-02-14
**Stopped at:** Plan 22-01 complete (Database Models for Smart Notifications)
**Resume from:** Next plan in phase 22 (completion suppression logic, follow-up scheduler, frequency cap enforcement)
**Resume file:** `.planning/phases/22-smart-notification-system/22-02-PLAN.md` (if exists)

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

---

## Next Steps

1. Implement completion suppression logic (22-02)
2. Implement follow-up reminder scheduler (22-03)
3. Implement frequency cap enforcement (22-04)
4. All smart notification features will use the database models created in 22-01

---

*Last updated: 2026-02-14T14:56:00Z*
