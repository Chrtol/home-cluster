# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** A polished, information-dense tool for managing reptile care — the dashboard as a single pane of glass.
**Current focus:** v1.3 Engagement & Awareness — Phase 18 complete, Phase 19 next

## Current Position

Phase: 20.5 of 25 (User Gamification System)
Plan: 2 of TBD complete
Status: In progress
Last activity: 2026-02-13 — Completed 20.5-02-PLAN.md (User-level streak calculation)

Progress: [████████████████░░░░] 81/TBD plans (Phase 20 complete, Phase 20.5 in progress)

## Performance Metrics

**Velocity:**
- Total plans completed: 62 (across v1.0, v1.1, v1.2)
- v1.0 Average: 10 plans in 1 day
- v1.1 Average: 46 plans in 3 days (Feb 8-10)
- v1.2 Average: 6 plans in 1 day (Feb 11)

**By Milestone:**

| Milestone | Phases | Plans | Duration | Avg/Plan |
|-----------|--------|-------|----------|----------|
| v1.0 | 6 | 10 | 1 day | ~2.4 hours |
| v1.1 | 7 | 46 | 3 days | ~1.6 hours |
| v1.2 | 3 | 6 | 1 day | ~4 hours |
| v1.3 | 9 | TBD | — | — |

**Recent Trend:**
- v1.2 had fewer plans but more complex infrastructure work
- Trend: Stable

*Updated after v1.3 roadmap creation*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- 2026-02-13: Consecutive-miss logic for user streaks (breaks after 2 misses, not time-based)
- 2026-02-13: Only manual-completion schedules count toward streak (auto-complete excluded)
- 2026-02-13: Freeze days protect streak during vacation (tasks still due, notifications still fire)
- 2026-02-13: Milestone rewards at 7, 30, 100, 365 days (1, 2, 3, 5 freeze days)
- 2026-02-13: Any co-responsible user's completion credits all co-responsible users
- 2026-02-13: Scheduled freezes deduct days upfront (manual freezes are emergency 1-day)
- 2026-02-13: Support shared responsibility (multiple users per reptile/schedule) for co-parenting scenarios
- 2026-02-13: Junction tables with metadata (assigned_at, assigned_by) for audit trail
- 2026-02-13: Self-removal allowed anytime for user autonomy
- 2026-02-13: Mid-day responsibility changes take immediate effect (no scheduling needed)
- 2026-02-13: Unassigned reptiles accessible to all household members by default
- 2026-02-13: Dashboard centralizes batch data fetching for streaks and health statuses (not ReptileStatusCards)
- 2026-02-13: Separate try/catch for streak and health batch fetches (graceful degradation)
- 2026-02-13: Filter scheduleInstances per reptile in ReptileStatusCards (filtering logic close to usage)
- 2026-02-13: Birthday badge hidden when date_of_birth null or > 30 days away
- 2026-02-13: Next feeding uses absolute time format (Today 6pm) per UX research
- 2026-02-13: NextFeedingIndicator accepts isHidden prop for caller control (brumation state)
- 2026-02-13: Clock icon used for next feeding (distinct from utensil icon for last feeding)
- 2026-02-13: Health status format "Shedding for X days" (more natural language than "In shed (X days)")
- 2026-02-13: event_subtype resets when reptile changes to prevent stale selections
- 2026-02-13: Auto-select always sets value when only one option valid (ignores previous value)
- 2026-02-13: Base /measurements route added for backward compatibility
- 2026-02-13: Green badge color for measurements in history (distinct from weight=blue, shedding=amber, brumation=purple)
- 2026-02-13: Title case formatting for measurement type labels (split snake_case, capitalize words)
- 2026-02-13: Custom label takes precedence over formatted type in measurement display
- 2026-02-13: Three-way fetch in loadHistory for complete event data (weight, health, measurements)
- 2026-02-13: Use plain 'C' and 'F' for temperature units (not degree symbol) to avoid encoding issues
- 2026-02-13: Measurement button placed after Brumation in log type selector
- 2026-02-13: Custom label required only when measurement_type='custom'
- 2026-02-13: Track lastLogType as 'measurement' for post-submission navigation
- 2026-02-13: Combined API fetching for history (separate weight/health endpoints, normalize client-side)
- 2026-02-13: Client-side event type filtering (adequate performance for typical data volumes)
- 2026-02-13: Measurements page redirect vs removal (keep route, replace with redirect for backward compatibility)
- 2026-02-13: History Item component inline (keeps related UI logic together, colored badges for distinction)
- 2026-02-13: Health status fetched on reptile selection in create mode only (view/edit shows historical context)
- 2026-02-13: Auto-select valid state transition when only one option available (UX improvement)
- 2026-02-13: Log Another button keeps reptile selection to support rapid logging workflows
- 2026-02-13: Success action buttons replace auto-navigation for better user control
- 2026-02-12: Boolean flags (is_shedding, is_brumating) replace single status enum - reptiles can be both states simultaneously
- 2026-02-12: event_type field replaces title parsing for state detection - explicit, validated, locale-independent
- 2026-02-12: Migration 0079 backfills existing records by title pattern for zero-downtime deployment
- 2026-02-12: Batch health status query uses IN clause for 2 queries total regardless of reptile count (avoids N+1 problem)
- 2026-02-12: Batch endpoint trusts caller filtered reptile_ids to accessible ones (permission check upstream)
- 2026-02-12: LEFT JOIN self-join pattern for event-sourced state derivation (detects unclosed shed/brumation events)
- 2026-02-12: State transition validation at API layer before database insert (prevents invalid state data)
- 2026-02-12: Timezone-aware date calculations for "days in state" (prevents DST off-by-one errors)
- 2026-02-12: Zero-state fallback for missing streak records (no database write for reptiles without users)
- 2026-02-12: SQLAlchemy after_insert event for automatic streak updates (atomic with completion insert)
- 2026-02-12: Synchronous Redis client in event listener (events run in sync context)
- 2026-02-12: Graceful cache degradation (cache failures don't break API)
- 2026-02-12: v1.3 phase ordering prioritizes dependencies (streaks before celebrations, health status before badges)
- 2026-02-11: Check Food table for existing records before seeding (efficient single-query emptiness check)
- 2026-02-11: Use file polling for Docker file watching (inotify doesn't work in Docker)
- 2026-02-11: Use exact "development" match for auth bypass (not "!= production") - fail-safe approach

### Roadmap Evolution

- Phase 19.1 inserted after Phase 19: Measurements Feature Restoration (URGENT) - restore custom measurements, measurement recording UI, and measurement type customization lost in Phase 19 deprecation

### From v1.3 Research

Key patterns for upcoming phases:
- Streak tracking with grace period to prevent anxiety (Phase 17)
- Health status derivation from existing health_records (no new tables) (Phase 18)
- Dashboard badges leverage Phases 17-18 data (Phase 20)
- Smart notification system foundation before planner/digest (Phases 22-23)
- canvas-confetti library for celebration animations (Phase 21)

### From v1.2

- Docker Compose with Redis, Celery, dev auth bypass working
- Frontend Vite HMR working
- Database seeding infrastructure in place

### From v1.1

- shadcn/ui design system established
- react-hook-form + Zod validation patterns
- Dashboard "single pane of glass" architecture
- ReptileNameWithAvatar component pattern

### From v1.0

- Scheduler modularized (core, jobs, auto_complete, overdue, notifications)
- InstanceStatus enum for type-safe status handling
- Notification system with templates, groups, priority matching

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed 20.5-02-PLAN.md (User-level streak calculation)
Resume file: .planning/phases/20.5-user-gamification-system/20.5-02-SUMMARY.md
Next action: Continue Phase 20.5 with plan 03 (Gamification UI) or proceed to next phase per roadmap

## Deferred Items

- Shed status indicator on dashboard/list cards (minor UI polish from Phase 16 UAT)
