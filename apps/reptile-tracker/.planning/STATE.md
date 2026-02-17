# Reptile Tracker - Project State

**Last Updated:** 2026-02-17

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** A polished, information-dense tool for managing reptile care — the dashboard as a single pane of glass, with smart notifications and gamification.
**Current focus:** v1.4 Schedule Type Alignment & UX Polish

## Current Position

**Phase:** 26 - Health Schedule Type (1 of 5 plans complete)
**Plan:** 26-01 complete, ready for 26-02
**Status:** In progress
**Last activity:** 2026-02-17 — Completed 26-01-PLAN.md (Add bathing health record type)
**Progress:** █░░░░ (20% - 1/5 plans complete)

**Completed Milestones:**
- v1.0 Scheduling Refactor (Phases 1-6) — 2026-02-07
- v1.1 UI Overhaul (Phases 7-13) — 2026-02-10
- v1.2 Local Development Environment (Phases 14-16) — 2026-02-11
- v1.3 Engagement & Awareness (Phases 17-25) — 2026-02-16

**Next:** Execute Phase 26 plans

### Architecture Summary

#### Notification System
- **Template-based:** All notifications use Jinja2 templates with fallback messages
- **Format variants:** Short/long templates with channel-level format preference
- **Multi-channel:** In-app, Discord, Pushover
- **Async delivery:** Celery tasks for decoupled processing
- **Frequency caps:** Prevent alert fatigue (5/reptile/day, 7-day weight alert cooldown)

#### Gamification System
- **User streaks:** Duolingo-style with freeze capability
- **Reptile streaks:** Per-reptile with grace period forgiveness
- **Celebrations:** Confetti on completion and milestones (respects prefers-reduced-motion)

#### Health Tracking
- **Status derivation:** From health_records (not stored redundantly)
- **Unified logging:** Single Health Log page for all health events
- **Batch queries:** LEFT JOIN pattern for dashboard efficiency

## Key Files Reference

### Notification System
- `backend/app/notifications.py` - Jinja2 environment, template rendering, format variants
- `backend/app/scheduler/digest.py` - Daily/weekly planner generation
- `backend/app/scheduler/weight_alerts.py` - Weight change detection and alerting
- `frontend/src/pages/Notifications.jsx` - Unified settings page with 5 tabs

### Gamification
- `backend/app/services/streak_service.py` - Streak calculation
- `frontend/src/contexts/CelebrationContext.jsx` - Confetti animations
- `frontend/src/components/dashboard/UserStreakDisplay.jsx` - Header streak

### Health Tracking
- `backend/app/services/health_service.py` - Status derivation
- `frontend/src/pages/HealthLog.jsx` - Unified logging page

## Known Tech Debt

From v1.3:
- Follow-up preview always shows 24-hour format (should use user preference)
- Some error states use inline toast but no retry mechanism
- PageHeader component under-utilized

## Deferred Features

For future milestones:
- Growth milestone alerts for juveniles
- Rolling average baseline for weight comparison
- Format preview in template editor (side-by-side short/long)

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Add streak miss details modal and completed task tooltips | 2026-02-17 | 23f2c77e0 | [001-add-streak-miss-details-modal-and-comple](./quick/001-add-streak-miss-details-modal-and-comple/) |

## Session Continuity

**Last session:** 2026-02-17
**Action:** Completed 26-01-PLAN.md (Add bathing health record type)
**Stopped at:** Phase 26 Plan 01 complete
**Resume file:** `.planning/phases/26-health-schedule-type/26-02-PLAN.md`
**Next step:** Execute Plan 26-02 (Database migration)

## Phase 26 Plan Summary

**Goal:** Replace "weighing" schedule type with "health" schedule type that supports sub-types aligned with the health logging system.

**Plans:**
- **26-01 (Wave 1):** Add bathing as health record type (backend + HealthLog.jsx)
- **26-02 (Wave 2):** Database migration (schedule_type change, health_subtype/measurement_type columns)
- **26-03 (Wave 2):** Schedule form UI (health sub-type selector with conditional measurement selector)
- **26-04 (Wave 3):** Completion flow (pre-fill navigation, shedding check modal)
- **26-05 (Wave 4):** Human verification checkpoint (all 10 success criteria)

**Key Changes:**
- Schedule types become: feeding, misting, health (was weighing), supplement
- Health schedules have 6 sub-types: weight, measurement, shedding_check, brumation_check, health_record, bathing
- Measurement sub-type has secondary selector for measurement_type
- Shedding Check shows yes/no modal on completion
- All completion flows navigate to Health Log with pre-filled values

---

**Project Status:** Phase 26 planning complete. Ready for `/gsd:execute-phase 26`.
