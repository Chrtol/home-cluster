# Roadmap: Reptile Tracker

## Milestones

- **v1.0 Scheduling Refactor** - Phases 1-6 (shipped 2026-02-07)
- **v1.1 UI Overhaul** - Phases 7-13 (shipped 2026-02-10)
- **v1.2 Local Development Environment** - Phases 14-16 (shipped 2026-02-11)
- **v1.3 Engagement & Awareness** - Phases 17-25 (shipped 2026-02-16)
- **v1.4 Schedule Type Alignment & UX Polish** - Phases 26-28 (next)
- **v1.5 Notification Template UI Improvements** - Phases 29-31 (future)
- **v1.6 Bug Fixes & Polish** - Phases 32-34 (future)

## Phases

<details>
<summary>v1.0 Scheduling Refactor (Phases 1-6) - SHIPPED 2026-02-07</summary>

### Phase 1: Bug Fixes
**Goal**: Fix critical bugs in instance tracking and error handling
**Plans**: 2 plans

Plans:
- [x] 01-01: Fix instance drift bug
- [x] 01-02: Fix bare exception handling

### Phase 2: Scheduler Core Extraction
**Goal**: Extract core scheduler logic into focused module
**Plans**: 1 plan

Plans:
- [x] 02-01: Create scheduler/core.py with main orchestration

### Phase 3: Job Management Extraction
**Goal**: Extract notification job CRUD into separate module
**Plans**: 1 plan

Plans:
- [x] 03-01: Create scheduler/jobs.py for notification job management

### Phase 4: Business Logic Extraction
**Goal**: Extract auto-complete and overdue detection
**Plans**: 2 plans

Plans:
- [x] 04-01: Create scheduler/auto_complete.py
- [x] 04-02: Create scheduler/overdue.py

### Phase 5: Notifications Extraction
**Goal**: Extract notification sending logic
**Plans**: 1 plan

Plans:
- [x] 05-01: Create scheduler/notifications.py

### Phase 6: Schedule Matcher Consolidation
**Goal**: Consolidate and simplify schedule_matcher.py
**Plans**: 3 plans

Plans:
- [x] 06-01: Add InstanceStatus enum
- [x] 06-02: Consolidate with dataclass-based configuration
- [x] 06-03: Remove legacy polling system

</details>

<details>
<summary>v1.1 UI Overhaul (Phases 7-13) - SHIPPED 2026-02-10</summary>

### Phase 7: Foundation - Design System & Components
**Goal**: Establish shadcn/ui design system with warm dark palette
**Plans**: 6 plans

Plans:
- [x] 07-01: Install shadcn/ui and configure design tokens
- [x] 07-02: Integrate 16 shadcn/ui components
- [x] 07-03: Create DatePicker with locale support
- [x] 07-04: Create TimePicker with locale support
- [x] 07-05: Standardize form components with react-hook-form
- [x] 07-06: Add Zod validation schemas

### Phase 8: Dashboard - Single Pane of Glass
**Goal**: Transform dashboard into information-dense overview
**Plans**: 6 plans

Plans:
- [x] 08-01: Redesign reptile status cards
- [x] 08-02: Add activity timeline
- [x] 08-03: Add sparkline charts
- [x] 08-04: Add quick stats summary
- [x] 08-05: Add activity type filters
- [x] 08-06: Polish card layouts and spacing

### Phase 9: Reptile Management
**Goal**: Redesign reptile list and detail pages
**Plans**: 4 plans

Plans:
- [x] 09-01: Redesign reptile list with cards
- [x] 09-02: Add ReptileNameWithAvatar component
- [x] 09-03: Redesign reptile detail page
- [x] 09-04: Add photo gallery to detail page

### Phase 10: Calendar & Statistics
**Goal**: Improve calendar quick-view and statistics
**Plans**: 5 plans

Plans:
- [x] 10-01: Redesign calendar quick-view
- [x] 10-02: Add activity density indicators
- [x] 10-03: Redesign statistics page
- [x] 10-04: Add weight trend sparklines
- [x] 10-05: Add activity completion rate charts

### Phase 11: Forms & Tables
**Goal**: Modernize all forms and tables
**Plans**: 7 plans

Plans:
- [x] 11-01: Redesign activity logging form
- [x] 11-02: Redesign schedule forms
- [x] 11-03: Redesign reptile forms
- [x] 11-04: Add filter chips for tables
- [x] 11-05: Standardize table pagination
- [x] 11-06: Add empty states
- [x] 11-07: Add loading states

### Phase 12: Layout & Navigation
**Goal**: Polish navigation and page layouts
**Plans**: 8 plans

Plans:
- [x] 12-01: Redesign sidebar with collapsible sections
- [x] 12-02: Add page transitions
- [x] 12-03: Create PageHeader component
- [x] 12-04: Standardize page layouts
- [x] 12-05: Add breadcrumbs
- [x] 12-06: Mobile navigation polish
- [x] 12-07: Add 44x44px touch targets
- [x] 12-08: Force dark mode on non-auth pages

### Phase 13: Activity History
**Goal**: Create activity history page with filters
**Plans**: 10 plans

Plans:
- [x] 13-01: Create activity history page structure
- [x] 13-02: Add activity type filters
- [x] 13-03: Add date range filters
- [x] 13-04: Add reptile filters
- [x] 13-05: Add pagination
- [x] 13-06: Add activity detail modal
- [x] 13-07: Add export functionality
- [x] 13-08: Add sorting options
- [x] 13-09: Add search
- [x] 13-10: Polish mobile view

</details>

<details>
<summary>v1.2 Local Development Environment (Phases 14-16) - SHIPPED 2026-02-11</summary>

**Milestone Goal:** One command (`docker compose up`) for a fully working local dev environment with instant feedback loops.

### Phase 14: Development Infrastructure & Auth Bypass

**Goal**: Docker Compose stack with Redis, Celery, and development authentication bypass

**Depends on**: Nothing (first phase of v1.2)

**Requirements**: DEV-01, DEV-02, DEV-03, DEV-04, AUTH-01, AUTH-02, AUTH-03, HOT-01, DX-02

**Success Criteria** (what must be TRUE):
  1. Developer runs `docker compose up` and all services start without errors
  2. Developer can make API requests without OIDC tokens (auto-logged in as dev@localhost)
  3. Developer changes backend Python code and sees reload without container restart
  4. Celery worker connects to Redis and processes scheduled notification tasks
  5. Developer uploads photo via API and file persists in local volume mount
  6. Developer accesses /auth/dev-status endpoint and sees current development auth state

**Plans**: 3 plans

Plans:
- [x] 14-01-PLAN.md - Docker Compose infrastructure (Redis, Celery, photo persistence)
- [x] 14-02-PLAN.md - Development auth bypass (get_current_user bypass, /auth/dev-status)
- [x] 14-03-PLAN.md - Integration verification (end-to-end testing)

### Phase 15: Frontend Hot Reload & DX Polish

**Goal**: Vite dev server with instant hot module replacement and polished developer experience

**Depends on**: Phase 14 (backend API must be working)

**Requirements**: HOT-02, HOT-03, DX-01, DX-03

**Success Criteria** (what must be TRUE):
  1. Developer changes React component and page updates instantly without F5 (HMR working)
  2. Frontend loads at localhost:3000 and successfully communicates with backend API
  3. Developer starts fresh clone with `docker compose up` and sees seeded test data immediately
  4. Developer runs `docker compose down -v && docker compose up` to reset to clean state
  5. Photos uploaded from frontend UI persist across container restarts

**Plans**: 2 plans

Plans:
- [x] 15-01-PLAN.md - Frontend Vite dev server setup (Dockerfile.dev, vite.config.js, docker-compose.yml)
- [x] 15-02-PLAN.md - Database auto-seeding and HMR verification (conditional seeding, human checkpoint)

### Phase 16: Test Data Seeding

**Goal**: Seed realistic test data (reptiles, activity history, edge cases) for development

**Depends on**: Phase 15 (seeding infrastructure must be working)

**Requirements**: DX-01 (full implementation)

**Success Criteria** (what must be TRUE):
  1. Developer starts fresh clone with `docker compose up` and sees 3-5 reptiles with data
  2. Dashboard shows recent activity from seeded feedings and weighings
  3. Calendar shows scheduled tasks including at least one overdue task
  4. Weight chart displays 2-3 months of trend data for seeded reptiles
  5. At least one reptile is in shed status for testing shed UI

**Plans**: 1 plan

Plans:
- [x] 16-01-PLAN.md - Test data seeding (seed_dev_data.py, main.py integration, Faker)

</details>

<details>
<summary>v1.3 Engagement & Awareness (Phases 17-25) - SHIPPED 2026-02-16</summary>

**Milestone Goal:** Know your reptiles' state, get reminded right, feel good tracking.

**Overview**: Add lightweight gamification (streak tracking, celebrations) and intelligent notifications (digests, smart suppression, weight alerts) while improving health status awareness (shedding, brumation, dashboard badges). Features build incrementally with dependency-aware ordering: streak foundation before celebrations, health status derivation before dashboard indicators, smart notification system before digest planner.

### Phase 17: Streak Tracking Foundation

**Goal**: Backend streak calculation with grace period forgiveness to enable gamification without anxiety

**Depends on**: Nothing (first phase of v1.3)

**Requirements**: GAME-01, GAME-03

**Success Criteria** (what must be TRUE):
  1. System calculates consecutive completion days for each reptile based on schedule_completions history
  2. Streak survives missed days within grace period (configurable forgiveness window)
  3. API endpoint returns current streak count and grace period status per reptile
  4. Streak calculation triggers on activity completion and caches results efficiently
  5. Database stores streak state (current count, last completion date, grace days remaining)

**Plans**: 3 plans

Plans:
- [x] 17-01-PLAN.md - Database model and streak calculation service
- [x] 17-02-PLAN.md - Event-driven updates, API endpoint, and Redis caching
- [x] 17-03-PLAN.md - UAT gap closure: fix single endpoint for reptiles without users

### Phase 18: Health Status Derivation

**Goal**: Derive reptile health status (in-shed, brumating, normal) from health records without storing redundant state

**Depends on**: Nothing (independent of Phase 17)

**Requirements**: HEALTH-06, HEALTH-02, HEALTH-03, HEALTH-04, HEALTH-05

**Success Criteria** (what must be TRUE):
  1. System queries health_records using event_type field to detect active shed cycle (started without completion)
  2. System queries health_records using event_type field to detect active brumation period (started without ended event)
  3. Health status returns independent boolean flags (is_shedding, is_brumating) allowing multiple simultaneous states
  4. API endpoint returns current health status for each reptile in real-time
  5. User can log shedding complete event that closes open shed cycle with validation

**Plans**: 3 plans

Plans:
- [x] 18-01-PLAN.md - Health status service and state transition validation
- [x] 18-02-PLAN.md - API endpoints and batch query for dashboard
- [x] 18-03-PLAN.md - UAT gap closure: event_type field and boolean status flags

### Phase 19: Health Logging UI

**Goal**: Unified Health Log page with shedding/brumation event flows and history view

**Depends on**: Phase 18 (health status backend must exist)

**Requirements**: HEALTH-01

**Success Criteria** (what must be TRUE):
  1. User accesses single Health Log page (replaces separate measurement and health-log pages)
  2. User logs weighing, feeding observation, or health note from unified form
  3. User logs shedding started event with date picker (creates health_record)
  4. User logs brumation started event with optional notes field
  5. Health Log displays history with filtering by event type and reptile

**Plans**: 4 plans

Plans:
- [x] 19-01-PLAN.md - Add shedding and brumation event types to HealthLog form
- [x] 19-02-PLAN.md - Health status awareness and success feedback improvements
- [x] 19-03-PLAN.md - Unified history view and Measurements page deprecation
- [x] 19-04-PLAN.md - UAT gap closure: status format, form reset, auto-select, and /measurements route

### Phase 19.1: Measurements Feature Restoration (INSERTED)

**Goal**: Restore custom measurements, measurement recording UI, and measurement type customization that were lost in Phase 19 deprecation

**Depends on**: Phase 19

**Requirements**: Urgent restoration work

**Success Criteria** (what must be TRUE):
  1. User can record custom measurements (length, humidity, etc.) from Health Log
  2. User can create and manage custom measurement types (via Custom option with label)
  3. Measurement history displays in unified history view with proper filtering
  4. Existing measurement data remains accessible and queryable

**Plans**: 2 plans

Plans:
- [x] 19.1-01-PLAN.md - Add Measurement log type with conditional fields and API integration
- [x] 19.1-02-PLAN.md - Integrate measurements in history view and implement view/edit/delete

### Phase 20: Dashboard Status Indicators

**Goal**: Display health status badges, birthday countdown, next feeding indicator on dashboard cards; per-reptile care streak moved to detail page

**Depends on**: Phase 17 (streak data), Phase 18 (health status)

**Requirements**: DASH-03, DASH-01, DASH-02, GAME-02

**Success Criteria** (what must be TRUE):
  1. Reptile status card shows health status badge (In Shed / Brumating) when applicable
  2. Reptile status card shows next scheduled feeding with date and time (derived from schedule)
  3. Reptile status card shows birthday countdown (year-round with adaptive format)
  4. Birthday badge has confetti easter egg on actual birthday (click to trigger)
  5. Per-reptile care streak displays on Reptile Detail page (as statistic, not gamification)
  6. Card gets festive glow on reptile's birthday

**Plans**: 4 plans

Plans:
- [x] 20-01-PLAN.md - Badge variants, HealthStatusBadge with SnakeIcon
- [x] 20-02-PLAN.md - BirthdayBadge (year-round, confetti easter egg), NextFeedingIndicator
- [x] 20-03-PLAN.md - Dashboard batch fetching and ReptileStatusCard integration
- [x] 20-04-PLAN.md - Visual verification and UAT refinements

### Phase 20.5: User Gamification System (INSERTED)

**Goal**: Duolingo-style user streak in header based on schedule completion, with responsibility assignment for multi-user households

**Depends on**: Phase 20

**Requirements**: User motivation/engagement (inspired by Duolingo streak system)

**Success Criteria** (what must be TRUE):
  1. User-level streak displayed in header (flame icon + count)
  2. Streak based on not missing schedule instances that require manual intervention (not daily activity)
  3. User can freeze streak temporarily (vacation mode)
  4. Streak milestones trigger visual recognition (7, 30, 100, 365 days)
  5. User can assign responsibility for reptiles OR individual schedules
  6. Multi-user household: task completion by assigned user maintains their streak
  7. Clear handling of cross-user task completion (does it break/maintain others' streaks?)

**Plans**: 4 plans in 3 waves

Plans:
- [x] 20.5-01-PLAN.md - Responsibility assignment database models and API
- [x] 20.5-02-PLAN.md - User streak model, calculation service, and API
- [x] 20.5-03-PLAN.md - Header streak display with flame icon and freeze overlay
- [x] 20.5-04-PLAN.md - Responsibility UI, freeze scheduling, and human verification

### Phase 21: Celebration Animations

**Goal**: Confetti animations for task completion, streak milestones, and birthdays with accessibility controls

**Depends on**: Phase 17 (streak milestones), Phase 20 (birthday detection)

**Requirements**: GAME-04, GAME-05, GAME-06, DASH-04, DASH-05, DASH-06

**Success Criteria** (what must be TRUE):
  1. Confetti animation plays when user marks task complete (dismissible, short burst)
  2. Enhanced confetti plays on streak milestones (7 days, 30 days, 100 days)
  3. Birthday countdown styling escalates as date approaches (3 days, 1 day, today)
  4. On reptile's birthday, avatar displays birthday hat overlay across all pages
  5. User can disable confetti animations via settings toggle
  6. Confetti respects prefers-reduced-motion accessibility setting

**Plans**: 4 plans in 3 waves

Plans:
- [x] 21-01-PLAN.md - Backend preference, CelebrationContext provider, settings toggle
- [x] 21-02-PLAN.md - Confetti hook with presets and task completion integration
- [x] 21-03-PLAN.md - Birthday hat overlay on ReptileAvatar
- [x] 21-04-PLAN.md - Visual verification checkpoint

### Phase 22: Smart Notification System

**Goal**: Intelligent notification suppression (skip if complete), frequency caps, follow-up reminders, window expiry alerts

**Depends on**: Nothing (independent notification foundation)

**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03

**Success Criteria** (what must be TRUE):
  1. Notification does not fire if schedule instance is already marked complete (real-time check at fire time)
  2. User configures time window closing alert per schedule (notification X minutes after window opens)
  3. System enforces frequency cap (max N notifications per reptile per day, default 5)
  4. User can enable single follow-up reminder per schedule (fires X minutes after main if still not complete)
  5. Smart suppression preserves existing auto-complete logic without modification

**Plans**: 5 plans in 3 waves

Plans:
- [x] 22-01-PLAN.md - Database models and migration (Schedule fields, NotificationSettings fields, NotificationFrequencyTracking table)
- [x] 22-02-PLAN.md - New trigger types and default templates (follow_up_reminder, expiry_alert, frequency_cap_summary)
- [x] 22-03-PLAN.md - Completion-aware notification execution and frequency cap tracking
- [x] 22-04-PLAN.md - Follow-up reminder and window expiry alert scheduling
- [x] 22-05-PLAN.md - UI for per-schedule settings and global frequency cap + human verification

### Phase 23: Notification Planner & Digest

**Goal**: Daily and weekly planner digests batching tasks into single morning notifications

**Depends on**: Phase 22 (smart suppression and frequency caps must exist)

**Requirements**: NOTIF-04, NOTIF-05, NOTIF-06

**Success Criteria** (what must be TRUE):
  1. User enables daily planner notification sent at configured morning time (default 8am)
  2. Daily digest lists all scheduled tasks for today grouped by reptile
  3. User enables weekly planner notification (Sunday preview of week's tasks)
  4. User chooses digest format (single grouped message) or individual notifications per task
  5. Digest includes overdue section when applicable (runs after auto-complete)
  6. Planner respects smart suppression rules (skips completed tasks)

**Plans**: 4 plans in 3 waves

Plans:
- [x] 23-01-PLAN.md - Database models and migration (NotificationSettings planner fields)
- [x] 23-02-PLAN.md - Digest generation module with query and formatting logic
- [x] 23-03-PLAN.md - APScheduler cron jobs and Celery delivery tasks
- [x] 23-04-PLAN.md - Planner digest settings UI + human verification

### Phase 24: Weight Change Alerts

**Goal**: Automatic notifications when reptile weight changes exceed configured threshold

**Depends on**: Phase 22 (notification system infrastructure)

**Requirements**: NOTIF-07, NOTIF-08

**Success Criteria** (what must be TRUE):
  1. System detects weight change greater than threshold percentage (default 10%)
  2. User receives notification when weight gain or loss exceeds threshold
  3. User configures weight change threshold per reptile (species-aware defaults)
  4. Alert includes baseline weight, current weight, percentage change, and time span
  5. Weight alerts respect frequency cap (max once per week per reptile)

**Plans**: 5 plans

Plans:
- [x] 24-01-PLAN.md - Database models and weight change detection logic
- [x] 24-01.5-PLAN.md - Template UX fixes (404 bug, live preview panel, Escape key)
- [x] 24-02-PLAN.md - Celery task, router integration, and daily sweep job
- [x] 24-03-PLAN.md - Weight alert settings UI + human verification
- [x] 24-UAT.md - User acceptance testing (7/7 tests passed)

### Phase 24.5: Unified Notifications Page (INSERTED)

**Goal**: Consolidate all notification-related settings from scattered locations into a single "Notifications" page accessible from the sidebar

**Depends on**: Phase 24 (weight alerts complete)

**Requirements**: UX improvement - notification settings currently fragmented across ReptileDetail, Settings > Notification Templates, Settings > Notification Channels, Settings > Notifications, Schedule modals

**Success Criteria** (what must be TRUE):
  1. New sidebar item "Notifications" (bell icon) links to /notifications route
  2. Channels section: configure Discord, Pushover, in-app with test notification button
  3. Templates section: view/edit notification templates by trigger type with preview
  4. Global Settings section: daily/weekly planner enable/disable and time configuration
  5. Per-Reptile Alerts section: list reptiles with weight alert settings (quick view + link to edit)
  6. Schedule Notifications section: list schedules with reminder timing settings
  7. Settings page no longer has notification tabs (immediate removal, no deprecation)

**Plans**: 3 plans in 3 waves

Plans:
- [x] 24.5-01-PLAN.md - Notifications page shell with URL-controlled tabs and sidebar navigation
- [x] 24.5-02-PLAN.md - Extract and create tab components (Channels, Templates, Global Settings, Reptile Alerts, Schedule Notifications)
- [x] 24.5-03-PLAN.md - Settings cleanup, ReptileDetail read-only alerts, and workflow verification

### Phase 25: Notification Customization & Deferred Items

**Goal**: Consolidate all notification-related enhancements deferred from earlier phases: format choices (NOTIF-09), per-schedule configuration (NOTIF-10), per-reptile cooldown overrides, and digest template support.

**Depends on**: Phase 24.5 (unified notifications page provides the UI location)

**Requirements**: NOTIF-09, NOTIF-10, per-reptile cooldown, digest templates

**Success Criteria** (what must be TRUE):
  1. User can choose long-form or short-form notification format (NOTIF-09)
  2. User can configure smart notification features per-schedule (NOTIF-10)
  3. User can configure cooldown period per-reptile (override global default)
  4. Daily and weekly planner digests use template system for customization
  5. ScheduleNotificationsTab shows per-schedule follow-up settings with calculated preview

**Plans**: 8 plans (3 original + 5 gap closures)

Plans:
- [x] 25-01-PLAN.md - Per-reptile cooldown override (database, API, UI)
- [x] 25-02-PLAN.md - Digest template support (Jinja2 integration, daily_planner/weekly_planner templates)
- [x] 25-03-PLAN.md - Template format variants (short/long), channel format setting, expiry consolidation
- [x] 25-04-PLAN.md - Gap closure: Remove Jinja2 loops from digest templates, use code-based iteration
- [x] 25-05-PLAN.md - Gap closure: Wire get_template_message into notification delivery code
- [x] 25-06-PLAN.md - Gap closure: Fix in-app channel webhook validation, remove expiry alert UI
- [x] 25-07-PLAN.md - Gap closure: Add digest trigger types and template format variants UI
- [x] 25-08-PLAN.md - Gap closure: UAT fixes (in-app save, format options UI, preview data, system templates, format clarity)

</details>

## v1.4 Schedule Type Alignment & UX Polish (Phases 26-28)

**Milestone Goal:** Align schedule types with logging types, improve read-only views with modal-based UX, and generalize change detection alerts.

### Phase 26: Health Schedule Type

**Goal**: Replace "weighing" schedule type with "health" schedule type that supports sub-types aligned with the health logging system, and add bathing as a new health record type.

**Depends on**: Phase 25 (v1.3 complete)

**Requirements**: Schedule/logging type alignment, attribution for all health tasks, bathing support

**Context** (discovered during assumption review):
- Current health log types: `weight`, `health` (with record_type), `shedding`, `brumation`, `measurement`
- Current schedule health_category values: `weight_check`, `bathing`, `shedding_check`, `health_inspection`
- These don't align — Phase 26 fixes this mismatch

**Health Schedule Subtypes** (final list):
| Subtype | Maps to Log Type | Sub-selector | Notes |
|---------|------------------|--------------|-------|
| Weight | `weight` | None | Direct weight logging |
| Measurement | `measurement` | measurement_type (SVL, total_length, humidity, temp, shell_length, custom) | Includes custom |
| Shedding Check | `shedding` | None | Prompts yes/no → can start shedding event |
| Brumation Check | `brumation` | None | Reminder to review/update brumation status |
| Health Record | `health` | record_type (medication, observation, vet_visit, bowel_movement) | Existing health subtypes |
| Bathing | `health` (new record_type: bathing) | None | **New** - add to health log first |

**Shedding Check Completion Flow**:
```
User completes "Shedding Check" schedule
  → Modal: "Is [Reptile] showing signs of shedding?"
  → [Yes] → Creates shedding start event + marks task done
  → [No] → Just marks task done
  → [Cancel] → Returns without changes
```

**Success Criteria** (what must be TRUE):
  1. Schedule types are: feeding, misting, health (replacing weighing), supplement
  2. Health schedules have sub-type selector matching the table above
  3. Measurement sub-type has secondary selector for measurement type (SVL, total_length, custom, etc.)
  4. Bathing exists as a health record type in HealthLog.jsx before being schedulable
  5. Existing "weighing" schedules migrated to "health" with "Weight" sub-type
  6. Schedule form UI follows Food Category pattern (dropdown with conditional sub-selector)
  7. Completion navigates to Health Log with pre-filled log_type and sub-selectors
  8. Shedding Check completion shows yes/no prompt; can start shedding event; always marks done
  9. Attribution works for all health schedule completions
  10. Dashboard "next feeding" indicator unchanged; health schedules appear in timeline

**Plans**: 8 plans in 4 waves (5 original + 3 gap closures)

Plans:
- [x] 26-01-PLAN.md — Add bathing as health record type (backend + HealthLog.jsx)
- [x] 26-02-PLAN.md — Database migration (schedule_type change, health_subtype/measurement_type columns, data migration)
- [x] 26-03-PLAN.md — Schedule form UI (health sub-type selector with conditional measurement selector)
- [x] 26-04-PLAN.md — Completion flow (pre-fill navigation, shedding check modal)
- [x] 26-05-PLAN.md — Human verification checkpoint (all 10 success criteria)
- [x] Gap closure: Updated 14 frontend files from 'weighing' to 'health' schedule type (critical filter fix)
- [x] Gap closure: Added custom_measurement_label field for custom measurement type schedules
- [x] 26-06-PLAN.md — Gap closure: Fix health_subtype/measurement_type propagation through frontend pipeline
- [x] 26-07-PLAN.md — Gap closure: Add health records to Recent Activity + update schedule_matcher
- [x] 26-08-PLAN.md — Gap closure: Human verification for all 6 failed UAT tests

### Phase 27: Read-Only Views & UX Polish

**Goal**: Replace page-based read-only views with modal-based views, improve information density, and polish visual design across detail/log pages.

**Depends on**: Phase 26

**Requirements**: UX consistency, improved information display

**Success Criteria** (what must be TRUE):
  1. Feeding log entries open in modal instead of separate page
  2. Misting log entries open in modal instead of separate page
  3. Health log entries open in modal instead of separate page
  4. Schedule read-only view shows all info available in edit mode
  5. Modal views have consistent design language with edit forms
  6. Detail pages have improved visual hierarchy and spacing
  7. Card/list item designs feel polished and intentional (not generic)

**Plans**: 10 plans in 6 waves

Plans:
- [x] 27-01-PLAN.md — Sheet component and useModalState hook (Wave 1)
- [x] 27-02-PLAN.md — View modal components (ViewLogModal, LogViewContent, CollapsibleNotes) (Wave 2)
- [x] 27-03-PLAN.md — CreateLogModal component (Wave 2)
- [x] 27-04-PLAN.md — In-place edit transformation and delete flow (Wave 3)
- [x] 27-05-PLAN.md — Schedule view modal (ViewScheduleModal, ScheduleViewContent) (Wave 3)
- [x] 27-06-PLAN.md — ActivityHistory modal integration (Wave 4)
- [x] 27-07a-PLAN.md — Dashboard modal integration (log views) (Wave 4)
- [x] 27-07b-PLAN.md — Dashboard modal integration (schedule views, create) (Wave 5)
- [x] 27-08-PLAN.md — Human verification checkpoint (Wave 6)
- [x] 27-09-PLAN.md — Gap closure: Full feeding edit capability in modal (Wave 6)

### Phase 28: Generalized Change Alerts

**Goal**: Expand the weight alert pattern to cover all log types — feeding trends, measurement growth, and custom thresholds for any numeric field.

**Depends on**: Phase 25 (weight alert infrastructure), Phase 26 (health schedule alignment)

**Requirements**: Generalize change detection beyond weight

**Success Criteria** (what must be TRUE):
  1. User can configure feeding volume alerts ("X% less/more in past Y days")
  2. Feeding alerts normalize using nutritional data (3 small crickets ≈ 1 large cricket)
  3. User can configure measurement growth alerts for any measurement type (SVL, length, etc.)
  4. Custom threshold alerts work for any numeric log field
  5. Alert configuration UI follows patterns established for weight alerts
  6. Alerts respect per-reptile and global cooldown settings

**Plans**: 8 plans in 5 waves

Plans:
- [x] 28-01-PLAN.md — Database models and migration (ChangeAlertConfig, ChangeAlertTracking tables) (Wave 1)
- [x] 28-02-PLAN.md — Feeding trend detection with nutritional normalization (Wave 2)
- [x] 28-03-PLAN.md — Measurement growth detection with rolling averages (Wave 2)
- [x] 28-04-PLAN.md — Change alert configuration API endpoints (Wave 2)
- [x] 28-05-PLAN.md — Change Alerts tab on Notifications page (Wave 3) — *superseded by 28-08*
- [x] 28-06-PLAN.md — Species presets and preset application UI (Wave 3) — *superseded by 28-08*
- [x] 28-07-PLAN.md — Daily sweep integration and templates (Wave 4) — *verification moved to 28-08*
- [x] 28-08-PLAN.md — Data model refactor, UX redesign, activation wizard, bulk operations (Wave 5)

---

## v1.5 Notification Template UI Improvements (Phases 29-31)

**Milestone Goal:** A user with zero prior knowledge of the template system should be able to create a working notification template in under 2 minutes without reading documentation.

**Overview**: Redesign the notification template management experience to reduce complexity and improve discoverability. Replace the flat card layout with a guided creation wizard, cleaner grouped list view, and streamlined edit modal. System templates remain in the backend but are hidden from the UI.

### Phase 29: Creation Wizard

**Goal**: Replace default system template listing with a stepped wizard modal that progressively narrows template configuration through focused steps

**Depends on**: Phase 26 (Tasks), Phase 28 (Change Alerts) — these phases provide the trigger type refactors needed

**Requirements**: Progressive disclosure, wizard-based template creation

**Success Criteria** (what must be TRUE):
  1. System templates are hidden from UI (still exist in backend as base configurations)
  2. Primary CTA on Notification Templates page is "+ New Template" opening stepped wizard
  3. Step 1: User selects notification/alert type from clean list (Schedule Reminder, Follow-up, Task Logged, Overdue, Change Alert, Planner Digest)
  4. Step 2: User selects reptile scope (All Reptiles or specific multi-select)
  5. Step 3: User selects schedule scope (All Schedules, Schedule Type filter, or Specific Schedule); "Specific Schedule" greyed out with tooltip when "All Reptiles" selected in Step 2
  6. Step 4: User assigns channels (multi-select: In-App, Discord, Pushover, Generic Webhook)
  7. Step 5: Summary card shows all selections, "Create Template" opens pre-filled editor
  8. "Quick Create (Advanced)" link at Step 1 for power users to skip wizard
  9. Daily/Weekly Planner Digest selection skips Steps 2-3 (aggregates across all)
  10. Wizard supports Back navigation at every step

**Plans**: TBD

Plans:
- [ ] 29-01: TBD (run /gsd:plan-phase 29 to break down)

### Phase 30: Grouped Template List View

**Goal**: Replace flat card list with table-based layout grouped by template group and trigger type, inspired by Supplement Rotations page

**Depends on**: Phase 29 (wizard output feeds into the list)

**Requirements**: Hierarchical grouping, conflict visibility, filtering

**Success Criteria** (what must be TRUE):
  1. Templates displayed in table with columns: Reptile Scope, Schedule Scope, Channel(s), Priority, Status, Actions
  2. Templates grouped by Group (collapsible) → Trigger Type (collapsible sub-header)
  3. Reptile scope shows avatars + names or "All Reptiles" badge
  4. Priority is inline-editable number field
  5. Competing templates (same trigger + overlapping scope + same channel) shown adjacent with priority visible; lower priority number wins
  6. Filter by reptile (tab bar), filter by trigger type (dropdown), optional search by name
  7. Empty state with friendly message and "+ New Template" button

**Plans**: TBD

Plans:
- [ ] 30-01: TBD (run /gsd:plan-phase 30 to break down)

### Phase 31: Improved Template Editor

**Goal**: Reorganize template editor into clearly separated, collapsible sections with visual hierarchy while preserving all functionality

**Depends on**: Can ship independently, pairs naturally with Phase 29

**Requirements**: Layout reorganization, progressive disclosure, friendly variable names

**Success Criteria** (what must be TRUE):
  1. Editor is modal/slide-over panel with live preview on right (as existing)
  2. Section 1 (top, compact): Template Summary showing wizard selections as read-only chips/badges with edit icons
  3. Section 2 (middle, primary): Template Name, Short Format Message, Long Format Message text areas
  4. Variable badges below text areas show friendly names (e.g., "Reptile Name" not `{reptile_name}`) with technical name on hover
  5. Clicking variable badge inserts at cursor position
  6. Section 3 (collapsed default): Channel & Delivery (channels, priority, active toggle)
  7. Section 4 (collapsed default): Discord Styling — only rendered when Discord channel selected, fully removed from DOM otherwise (not collapsed or greyed out)
  8. All existing configuration options remain accessible

**Plans**: TBD

Plans:
- [ ] 31-01: TBD (run /gsd:plan-phase 31 to break down)

---

## v1.6 Bug Fixes & Polish (Phases 32-34)

**Milestone Goal:** Fix reported bugs, complete partially-implemented features, and polish UX consistency.

### Phase 32: Bug Fixes

**Goal**: Fix critical bugs affecting daily use and data integrity

**Depends on**: Nothing (can start immediately)

**Requirements**: Bug fixes for logging, deletion, and layout editing

**Bugs to fix:**
1. Quick-logging doesn't pre-fill current time
2. Logging a task doesn't auto-refresh dashboard (should appear immediately)
3. Default food not pre-filled when logging (both quick-log and full log)
4. Dashboard layout editing can't target other device profiles (e.g., edit mobile layout from desktop)
5. Deleting feeding log returns 500 error
6. Creating supplement rotation returns 422 error with unhelpful `[object Object]` popup

**Success Criteria** (what must be TRUE):
  1. Quick-log form pre-fills current time when opened
  2. After logging any task, dashboard components refresh to show new entry
  3. Default food for reptile is pre-filled in both quick-log and full log forms
  4. Dashboard settings allow editing layouts for any device profile, not just current device
  5. Deleting a feeding log succeeds without error
  6. Creating a supplement rotation succeeds; validation errors show readable messages

**Plans**: 3 plans in 2 waves

Plans:
- [ ] 32-01-PLAN.md — Backend fixes: add missing and_ import, fix validation error display (Wave 1)
- [ ] 32-02-PLAN.md — Form pre-fill fixes: current time, default food, dashboard refresh (Wave 2)
- [ ] 32-03-PLAN.md — Profile preview panel: Sheet-based layout editing for non-active profiles (Wave 2)

### Phase 33: UX Polish & Feature Completion

**Goal**: Replace inconsistent UI patterns and complete partially-built gamification animations

**Depends on**: Phase 32 (bugs should be fixed first)

**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06

**Items:**
1. **Toast/popup replacement**: Replace browser toasts and window popups ("are you sure", "success", "failure") with in-app banner/popup style used elsewhere (like when editing/deleting logged items)
2. **Gamification animation completion**: Complete the reward animation flow when logging a task:
   - Centered screen overlay showing task counter visually incrementing
   - Confetti animation (partially exists)
   - Proper "you did it" moment on task completion

**Success Criteria** (what must be TRUE):
  1. No browser-native confirm() or alert() dialogs anywhere in the app
  2. All success/error feedback uses consistent in-app banner component
  3. Logging a task triggers centered overlay with task counter animation
  4. Task counter visually increments by 1 with animation
  5. Confetti plays alongside task counter (respects prefers-reduced-motion)
  6. Animation is dismissible and doesn't block further interaction

**Plans**: 7 plans in 5 waves

Plans:
- [x] 33-01-PLAN.md — Foundational components: ConfirmButton, TaskCounterOverlay, CelebrationContext extension (Wave 1)
- [x] 33-02-PLAN.md — Settings.jsx: Replace alert() calls with toast, add ConfirmButton for non-destructive (Wave 2)
- [x] 33-03-PLAN.md — Settings.jsx: Replace confirm() calls with AlertDialog for destructive actions (Wave 2) [merged into 33-02]
- [x] 33-04-PLAN.md — Component dialog replacement: PhotoGallery, NotificationTemplatesTab, and 6 other files (Wave 3)
- [x] 33-05-PLAN.md — Page dialog replacement: ReptileDetail, ScheduleTemplates, and 10 other pages (Wave 4)
- [x] 33-06-PLAN.md — Celebration wiring: TaskCounterOverlay in App.jsx, triggers in QuickLogForm and log pages (Wave 5)
- [x] 33-07-PLAN.md — Human verification checkpoint: dialogs, toasts, celebrations, reduced motion (Wave 6)
- [x] 33-08-PLAN.md — UAT gap closure: ConfirmButton red styling, Settings.jsx toast migration (Wave 6)

### Phase 34: Import/Export System

**Goal**: Full import/export system for users and reptiles — backend APIs, data serialization, and wizard-based UI for migration between instances or households

**Depends on**: Phase 33 (polish should be complete first)

**Requirements**: Data portability, household management, backup/restore capability

**Scope includes:**
- Backend export API (data retrieval, serialization, file generation)
- Backend import API (validation, conflict detection, data insertion)
- Frontend wizard UI for guided export/import flows
- Photo/media handling for exports

**Export Flow:**
1. **User selection**: Export your own user or other users (requires appropriate permissions)
2. **Reptile selection**: Multi-select which reptiles to export
3. **Data inclusion**: All data associated with selected reptiles:
   - Reptile detail page info (name, species, morph, birth date, etc.)
   - Statistics and logs (feedings, health records, measurements)
   - Notification settings
   - Schedules and supplement rotations
   - Photos and avatar
4. **Format**: JSON or other portable format (consider compression for photos)

**Import Flow:**
1. **Source selection**: Upload file or receive from another instance
2. **Household decision**:
   - Create a new household, OR
   - Choose an existing household to join
3. **Conflict resolution**: Handle duplicate reptile names, user accounts, etc.
4. **Validation**: Preview what will be imported before committing

**Future consideration — Vet Export:**
A separate "vet export" feature (printable 1-page summary for veterinary visits) is planned for a future phase. Design decision needed: should vet export share infrastructure with this export system (same entry point, different export "type") or be completely separate? Key differences:
- This phase: Full data dump (JSON) for migration/backup
- Vet export: Curated, human-readable summary (printable PDF/HTML)

Consider building export infrastructure in a way that could support multiple export formats/types later.

**Success Criteria** (what must be TRUE):
  1. Backend export API generates complete data package for selected reptiles
  2. Backend import API validates and inserts data with transaction safety
  3. User can access export wizard from settings or profile menu
  4. Export wizard allows selecting specific users (with permission check)
  5. Export wizard allows multi-selecting reptiles to include
  6. Exported file contains all reptile data: info, logs, schedules, rotations, notifications, photos
  7. User can import from uploaded file
  8. Import wizard offers choice: new household or existing household
  9. Import shows preview of what will be created before committing
  10. Duplicate/conflict handling shows clear options to user
  11. Import completes without data loss or corruption

**Plans**: TBD

Plans:
- [ ] 34-01: TBD (run /gsd:plan-phase 34 to break down)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Bug Fixes | v1.0 | 2/2 | Complete | 2026-02-07 |
| 2. Scheduler Core | v1.0 | 1/1 | Complete | 2026-02-07 |
| 3. Job Management | v1.0 | 1/1 | Complete | 2026-02-07 |
| 4. Business Logic | v1.0 | 2/2 | Complete | 2026-02-07 |
| 5. Notifications | v1.0 | 1/1 | Complete | 2026-02-07 |
| 6. Schedule Matcher | v1.0 | 3/3 | Complete | 2026-02-07 |
| 7. Foundation | v1.1 | 6/6 | Complete | 2026-02-08 |
| 8. Dashboard | v1.1 | 6/6 | Complete | 2026-02-08 |
| 9. Reptile Mgmt | v1.1 | 4/4 | Complete | 2026-02-09 |
| 10. Calendar/Stats | v1.1 | 5/5 | Complete | 2026-02-09 |
| 11. Forms/Tables | v1.1 | 7/7 | Complete | 2026-02-09 |
| 12. Layout/Nav | v1.1 | 8/8 | Complete | 2026-02-10 |
| 13. Activity History | v1.1 | 10/10 | Complete | 2026-02-10 |
| 14. Dev Infrastructure | v1.2 | 3/3 | Complete | 2026-02-11 |
| 15. Frontend HMR | v1.2 | 2/2 | Complete | 2026-02-11 |
| 16. Test Data Seeding | v1.2 | 1/1 | Complete | 2026-02-11 |
| 17. Streak Foundation | v1.3 | 3/3 | Complete | 2026-02-12 |
| 18. Health Status | v1.3 | 3/3 | Complete | 2026-02-12 |
| 19. Health Logging UI | v1.3 | 4/4 | Complete | 2026-02-13 |
| 19.1 Measurements Restoration | v1.3 | 2/2 | Complete | 2026-02-13 |
| 20. Dashboard Indicators | v1.3 | 4/4 | Complete | 2026-02-13 |
| 20.5 User Gamification | v1.3 | 4/4 | Complete | 2026-02-14 |
| 21. Celebrations | v1.3 | 4/4 | Complete | 2026-02-14 |
| 22. Smart Notifications | v1.3 | 5/5 | Complete | 2026-02-14 |
| 23. Notification Planner | v1.3 | 4/4 | Complete | 2026-02-15 |
| 24. Weight Alerts | v1.3 | 5/5 | Complete | 2026-02-15 |
| 24.5 Unified Notifications | v1.3 | 3/3 | Complete | 2026-02-15 |
| 25. Notification Customization | v1.3 | 8/8 | Complete | 2026-02-16 |
| 26. Health Schedule Type | v1.4 | 8/8 | Complete | 2026-02-20 |
| 27. Read-Only Views & UX Polish | v1.4 | 10/10 | Complete | 2026-02-20 |
| 28. Generalized Change Alerts | v1.4 | 8/8 | Complete | 2026-02-20 |
| 29. Creation Wizard | v1.5 | 0/1 | Future | - |
| 30. Grouped Template List View | v1.5 | 0/1 | Future | - |
| 31. Improved Template Editor | v1.5 | 0/1 | Future | - |
| 32. Bug Fixes | v1.6 | 3/3 | Complete | 2026-06-07 |
| 33. UX Polish & Feature Completion | v1.6 | 8/8 | Complete | 2026-06-07 |
| 34. Import/Export Wizard | v1.6 | 0/1 | Future | - |
