# Reptile Tracker - Project State

**Last Updated:** 2026-02-17

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** A polished, information-dense tool for managing reptile care — the dashboard as a single pane of glass, with smart notifications and gamification.
**Current focus:** Planning next milestone (v1.4)

## Current Position

**Phase:** Ready for v1.4 planning
**Plan:** Not started
**Status:** Ready to plan
**Last activity:** 2026-02-16 — v1.2 and v1.3 milestones archived

**Completed Milestones:**
- v1.0 Scheduling Refactor (Phases 1-6) — 2026-02-07
- v1.1 UI Overhaul (Phases 7-13) — 2026-02-10
- v1.2 Local Development Environment (Phases 14-16) — 2026-02-11
- v1.3 Engagement & Awareness (Phases 17-25) — 2026-02-16

**Next:** v1.4 Schedule Type Alignment & UX Polish (Phases 26-28)
**Future:** v1.5 Notification Template UI Improvements (Phases 29-31)

## Architecture Summary

### Notification System
- **Template-based:** All notifications use Jinja2 templates with fallback messages
- **Format variants:** Short/long templates with channel-level format preference
- **Multi-channel:** In-app, Discord, Pushover
- **Async delivery:** Celery tasks for decoupled processing
- **Frequency caps:** Prevent alert fatigue (5/reptile/day, 7-day weight alert cooldown)

### Gamification System
- **User streaks:** Duolingo-style with freeze capability
- **Reptile streaks:** Per-reptile with grace period forgiveness
- **Celebrations:** Confetti on completion and milestones (respects prefers-reduced-motion)

### Health Tracking
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

## Session Continuity

**Last session:** 2026-02-17
**Action:** Clarified Phase 26 assumptions via `/gsd:list-phase-assumptions`
**Next step:** Plan Phase 26 with clarified scope

## Accumulated Context

### Roadmap Evolution

- v1.5 milestone added: Notification Template UI Improvements (Phases 29-31)
- Phase 29 added: Creation Wizard
- Phase 30 added: Grouped Template List View
- Phase 31 added: Improved Template Editor

### Phase 26 Assumptions Clarified (2026-02-17)

**Key discoveries from codebase analysis:**
- Health log types: `weight`, `health` (record_type subtypes), `shedding`, `brumation`, `measurement`
- Current schedule `health_category` values don't align with log types
- "Food Category" exists on feeding schedules (not "prey selector")

**Scope clarifications from user:**
- Bathing needs to be added as a health record type first, then becomes schedulable
- Measurement subtype needs sub-selector for measurement_type (including custom)
- Shedding Check prompts yes/no → can start shedding event → always marks done
- Brumation Check is a reminder to review/update status
- Health Record subtype uses existing record_types (medication, observation, etc.)
- Completion flow follows same pattern as feeding (navigate to log page with pre-fill)

**ROADMAP.md updated with:**
- Detailed health schedule subtypes table
- Shedding check completion flow specification
- Revised success criteria (10 items)
- Updated plan breakdown (5 plans)

---

**Project Status:** Phase 26 assumptions clarified and documented. Ready for `/gsd:plan-phase 26`.
