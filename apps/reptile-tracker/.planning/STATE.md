# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** A polished, information-dense tool for managing reptile care — the dashboard as a single pane of glass.
**Current focus:** v1.3 Engagement & Awareness — Phase 18 complete, Phase 19 next

## Current Position

Phase: 19.1 of 25 (Measurements Feature Restoration - INSERTED)
Plan: 00 of TBD (not planned)
Status: Phase 19.1 inserted - needs planning
Last activity: 2026-02-13 — Inserted Phase 19.1 for urgent measurements restoration

Progress: [████████████████░░░░] 72/TBD plans (19 phases complete, 1 inserted)

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
Stopped at: Phase 19.1 inserted (Measurements Feature Restoration)
Resume file: N/A (phase not yet planned)
Next action: Plan Phase 19.1 with /gsd:plan-phase 19.1

## Deferred Items

- Shed status indicator on dashboard/list cards (minor UI polish from Phase 16 UAT)
