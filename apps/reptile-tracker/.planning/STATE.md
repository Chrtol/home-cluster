# Reptile Tracker - Project State

**Last Updated:** 2026-02-19

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** A polished, information-dense tool for managing reptile care — the dashboard as a single pane of glass, with smart notifications and gamification.
**Current focus:** v1.4 Schedule Type Alignment & UX Polish

## Current Position

**Phase:** 28 - Generalized Change Alerts (2 of 3 plans complete)
**Plan:** 28-05 complete
**Status:** In progress
**Last activity:** 2026-02-19 — Completed 28-05-PLAN.md (Change Alerts Tab on Notifications Page)
**Progress:** ██░ (67% - 2/3 plans complete)

**Completed Milestones:**
- v1.0 Scheduling Refactor (Phases 1-6) — 2026-02-07
- v1.1 UI Overhaul (Phases 7-13) — 2026-02-10
- v1.2 Local Development Environment (Phases 14-16) — 2026-02-11
- v1.3 Engagement & Awareness (Phases 17-25) — 2026-02-16

**Next:** Continue Phase 28 (plans remaining: 28-02, 28-03, or other plans as needed)

## Recent Completions

### Phase 28 Plan 05: Change Alerts Tab on Notifications Page
**Completed:** 2026-02-19
**Summary:** Created Change Alerts tab with global feeding/measurement settings and per-reptile overrides, deprecated old weight alerts UI

**Key accomplishments:**
- Created ChangeAlertsTab component (743 lines) with global feeding and measurement alert settings
- Added global feeding alerts (window, threshold, cooldown) and measurement alerts (types, rolling window, threshold, cooldown)
- Implemented per-reptile override collapsibles for both feeding and measurement alerts
- Replaced ReptileAlertsTab weight settings with redirect notice to Change Alerts tab
- Added 6th tab to Notifications page with TrendingUp icon

**Files created:**
- `frontend/src/components/notifications/ChangeAlertsTab.jsx`

**Files modified:**
- `frontend/src/pages/Notifications.jsx`
- `frontend/src/components/notifications/ReptileAlertsTab.jsx`

### Phase 28 Plan 01: Database Models for Generalized Change Alerts
**Completed:** 2026-02-19
**Summary:** Polymorphic alert config/tracking tables with global defaults for feeding trends and measurement growth alerts

**Key accomplishments:**
- Added ChangeAlertConfig and ChangeAlertTracking models with polymorphic alert_type field
- Added feeding_alert_* and measurement_alert_* global defaults to NotificationSettings
- Created migration 0105 with data preservation from WeightAlertTracking
- Established extensible foundation for feeding and measurement alerts

**Files modified:**
- `backend/app/models.py`
- `backend/migrations/versions/0105_add_generalized_change_alerts.py`

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

### Modals (Phase 27)
- `frontend/src/components/ui/sheet.jsx` - Directional slide-in modal component
- `frontend/src/components/ui/alert-dialog.jsx` - Confirmation dialog component
- `frontend/src/hooks/useModalState.js` - URL-driven modal state management
- `frontend/src/components/modals/ViewLogModal.jsx` - Right-slide view modal with in-place edit
- `frontend/src/components/modals/LogViewContent.jsx` - Sectioned content layout (What/When/Notes)
- `frontend/src/components/modals/EditLogContent.jsx` - Edit form content for in-place editing
- `frontend/src/components/modals/CollapsibleNotes.jsx` - Collapsible text component
- `frontend/src/components/modals/CreateLogModal.jsx` - Left-slide create modal for all log types
- `frontend/src/components/modals/ViewScheduleModal.jsx` - Right-slide schedule definition view
- `frontend/src/components/modals/ScheduleViewContent.jsx` - Schedule definition sectioned layout
- `frontend/src/components/modals/ViewInstanceModal.jsx` - Right-slide instance view (for dashboard)
- `frontend/src/components/modals/InstanceViewContent.jsx` - Instance details sectioned layout
- `frontend/src/contexts/CreateLogModalContext.jsx` - Global context for CreateLogModal registration

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
- Full undo for deleted logs (requires re-creation API)

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Add streak miss details modal and completed task tooltips | 2026-02-17 | 23f2c77e0 | [001-add-streak-miss-details-modal-and-comple](./quick/001-add-streak-miss-details-modal-and-comple/) |
| 002 | Fix streak calculation bug - streaks not resetting after misses | 2026-02-18 | 77029e5c4 | [002-fix-streak-calculation-bug-streaks-not-r](./quick/002-fix-streak-calculation-bug-streaks-not-r/) |
| 003 | Fix blank notifications page JSON parse error | 2026-02-19 | 98dd5b116 | [003-fix-blank-notifications-page-json-parse-](./quick/003-fix-blank-notifications-page-json-parse-/) |

## Session Continuity

**Last session:** 2026-02-19
**Action:** Completed Phase 28 Plan 05 - Change Alerts Tab on Notifications Page
**Stopped at:** Phase 28 Plan 05 complete
**Resume from:** .planning/phases/28-generalized-change-alerts/28-05-SUMMARY.md

## Phase 26 Plan Summary

**Goal:** Replace "weighing" schedule type with "health" schedule type that supports sub-types aligned with the health logging system.

**Plans:**
- **26-01 (Wave 1):** Add bathing as health record type (backend + HealthLog.jsx) ✓
- **26-02 (Wave 2):** Database migration (schedule_type change, health_subtype/measurement_type columns) ✓
- **26-03 (Wave 2):** Schedule form UI (health sub-type selector with conditional measurement selector) ✓
- **26-04 (Wave 3):** Completion flow (pre-fill navigation, shedding check modal) ✓
- **26-05 (Wave 4):** Human verification checkpoint (all 10 success criteria) ✓
- **26-06 (Wave 5):** Gap closure - field propagation (health_subtype/measurement_type through event pipeline) ✓
- **26-07 (Wave 5):** Gap closure - Recent Activity and schedule matching for health schedules

**Key Changes:**
- Schedule types become: feeding, misting, health (was weighing), supplement
- Health schedules have 6 sub-types: weight, measurement, shedding_check, brumation_check, health_record, bathing
- Measurement sub-type has secondary selector for measurement_type
- Shedding Check shows yes/no modal on completion
- All completion flows navigate to Health Log with pre-filled values

## Phase 26 Decisions

| Decision | Plan | Rationale | Impact |
|----------|------|-----------|--------|
| Map health_subtype fields through all event transformation pipelines | 26-06 | Enables TaskChip and QuickLogForm to display and route based on specific health schedule subtypes | Dashboard shows "Weight Check", "Shedding Check", etc. instead of generic "Health" |
| Weight and measurement schedules redirect to full form from quick-log | 26-06 | These schedules require specific value inputs (weight_grams, measurement value) that quick-log form doesn't provide | Ensures data integrity for weight and measurement logging |
| Display measurement_type in TaskChip for measurement schedules | 26-06 | Provides clarity about which measurement is due (SVL, Total Length, etc.) | Users can see exact measurement type in task chip label |
| Added MEASUREMENT to CompletionType enum | 26-07 | Required to support measurement logs completing health schedules | Enables measurement schedule completion functionality |
| Used health_subtype filtering in schedule matcher | 26-07 | Enables precise matching of weight logs to weight health schedules and measurement logs to measurement health schedules | Schedule matcher now supports health schedule type alignment |

## Phase 28 Plan Summary

**Goal:** Generalize weight alert infrastructure to support feeding trend alerts and measurement growth alerts.

**Plans:**
- **28-01 (Wave 1):** Database models and migration - COMPLETE
- **28-02 (Wave 2):** Feeding trend alerts implementation
- **28-03 (Wave 3):** Measurement growth alerts implementation

**Key Patterns Established:**
- Polymorphic alert_type field enables single table for multiple alert types
- Per-reptile config override pattern (NULL cooldown_days = inherit global)
- JSON last_alert_context for type-specific tracking data
- Data migration preserves existing weight alert tracking

## Phase 28 Decisions

| Decision | Plan | Rationale | Impact |
|----------|------|-----------|--------|
| Use alert_type polymorphism instead of separate tables | 28-01 | Enables extensible alert system without schema changes for new alert types | Single config/tracking table serves feeding, measurement, weight, and future alert types |
| Preserve WeightAlertTracking table during migration | 28-01 | Maintains backward compatibility during transition period | Both old and new tracking systems coexist until weight alerts migrated to new system |
| Migrate existing weight alert data to new tables | 28-01 | Ensures continuity of cooldown tracking when transitioning to new system | No alert spam when migrating existing reptile weight alerts |
| Use TrendingUp icon for Change Alerts tab | 28-05 | Visually represents growth/change trends for feeding and measurement alerts | Consistent iconography across notification tabs |
| Replace entire ReptileAlertsTab content with redirect notice | 28-05 | Weight alerts moved to new generalized system, old UI is deprecated | Users clearly directed to new location without confusing dual interfaces |
| Inherit pattern with null values for per-reptile overrides | 28-05 | Matches existing ReptileAlertsTab pattern for consistency | Empty inputs inherit global defaults, clear UX for override behavior |

## Phase 27 Plan Summary

**Goal:** Replace full-page views with directional slide-in modals and polish UI density.

**Plans:**
- **27-01 (Wave 1):** Sheet component & modal state hook - COMPLETE
- **27-02 (Wave 2):** View modal components (ViewLogModal, LogViewContent, CollapsibleNotes) - COMPLETE
- **27-03 (Wave 2):** CreateLogModal component - COMPLETE
- **27-04 (Wave 3):** In-place edit/delete for ViewLogModal - COMPLETE
- **27-05 (Wave 3):** Schedule view modals - COMPLETE
- **27-06 (Wave 4):** Activity History modal integration - COMPLETE
- **27-07a (Wave 4):** Dashboard modal integration (log views) - COMPLETE
- **27-07b (Wave 5):** Dashboard modal integration (schedule views, create) - COMPLETE
- **27-08 (Wave 6):** Visual polish (dense spacing, hover states)

**Key Patterns Established:**
- Sheet component: side="right" for view modals, side="left" for create/edit
- useModalState hook for URL-driven state with deep linking support
- Spring physics animation (damping=30, stiffness=300)
- Mode state pattern for in-place view/edit transformation

## Phase 27 Decisions

| Decision | Plan | Rationale | Impact |
|----------|------|-----------|--------|
| Spring animation with damping=30, stiffness=300 | 27-01 | Natural feel per research, avoids CSS transition jankiness | Smooth 60fps animations on mobile/desktop |
| useModalState uses replace:false | 27-01 | Enables browser back/forward to close/reopen modals | Better UX for deep linking and navigation |
| Sheet defaults to side="right" | 27-01 | View modals slide from right per user constraints | Consistent directional pattern |
| Simple feeding in CreateLogModal | 27-03 | Complex feedings with food items need full page | Users directed to FeedingLog page for detailed logs |
| Schema-per-log-type validation | 27-03 | Keeps validation tight to each form variant | Clean separation of concerns |
| AlertDialog for delete confirmation | 27-04 | Matches modal pattern, better UX than native confirm() | Consistent styling with rest of UI |
| In-place edit via mode state | 27-04 | Avoids modal close/reopen flicker per user decision | Seamless view-to-edit transformation |
| Edit navigates to ScheduleForm page | 27-05 | Schedule forms are complex with many conditional fields | In-place schedule editing deferred to future enhancement |
| BEHAVIOR section conditional render | 27-05 | Only shows when at least one setting is enabled | Cleaner view for simple schedules |
| type:id URL format for activity modals | 27-06 | Encodes both log type and ID in single param to restore modal state on deep link | Enables proper modal restoration from shared URLs |
| Modal callbacks via props | 27-07a | Simpler pattern than context for widget-to-modal communication | Dashboard widgets call parent callbacks to open modals |
| Link fallback in RecentActivityWidget | 27-07a | Maintains backwards compatibility when no callback provided | Widget can be used with or without modal integration |
| Eye icon for schedule view button | 27-07b | Provides visual affordance for viewing schedule details | Users can click eye icon in timeline to open schedule modal |
| TaskChip uses onViewSchedule for completed tasks | 27-07b | Keeps completed task clicks in modal context instead of navigating | Dashboard stays open when viewing completed task schedules |
| Schedule-to-log-type mapping in handleCreateLogFromSchedule | 27-07b | Maps health schedule subtypes (weight, measurement) to appropriate log types | Correct prefill data passed to CreateLogModal |
| Reptile avatar/name in ScheduleTypeSection header row | 27-08 | Schedule type badge and reptile identity on same row saves vertical space | More compact layout with all key info visible at once |
| ViewInstanceModal for dashboard items | 27-08 | Dashboard calendar/timeline shows schedule instances, not schedule definitions | Separate modals: ViewInstanceModal (instance data) vs ViewScheduleModal (schedule rules) |
| onViewInstance replaces onViewSchedule in dashboard | 27-08 | Widgets pass instance ID to open instance modal, not schedule ID | TaskChip, TodayScheduleTimeline, ReptileStatusCards all updated |
| Supplement pre-fill extracts IDs from objects | 27-08 | Schedule instances pass `[{id, name}]` but form expects `[id]` | CreateLogModal now handles both formats |

---

**Project Status:** Phase 28 execution in progress. Plan 28-01 complete.
