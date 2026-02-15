# Reptile Tracker - Project State

**Last Updated:** 2026-02-15T20:08:16Z

## Current Position

**Phase:** 24.5 of 25 (Unified Notifications Page)
**Plan:** 02 of ~3
**Status:** In progress
**Last activity:** 2026-02-15 - Completed 24.5-02-PLAN.md (Populate Notifications Page Tabs)

**Progress:** Phase 24.5 - Unified Notifications Page
```
24-01: ███████████ COMPLETE (Detection Logic)
24-02: ███████████ COMPLETE (Delivery Integration)
24-03: ███████████ COMPLETE (Settings UI)
24-UAT: ███████████ COMPLETE (7/7 pass, 1 fix applied)

24.5-01: ███████████ COMPLETE (Notifications Page Shell)
24.5-02: ███████████ COMPLETE (Populate Tabs)
24.5-03: ░░░░░░░░░░░ NEXT (Cleanup / Deprecate Old Tabs)

25:   ░░░░░░░░░░░ PLANNED (Weight Alert Customization) - blocked by 24.5
```

**Overall System Progress:**
- ✅ Core notification system with templates
- ✅ Weight change alert detection and delivery
- ✅ User-facing alert settings UI
- 🔄 Phase 24.5: Unified notifications page (in progress - 2/3 complete)
- ⏳ Phase 25: Configurable frequency caps (blocked by 24.5)

## Recent Decisions

| Phase  | Decision | Rationale | Impact |
|--------|----------|-----------|--------|
| 24.5-02 | Inline editing for reptile alerts using Radix Collapsible | Clean UX with expand-one-at-a-time pattern | Users edit settings inline without modal overhead |
| 24.5-02 | Age-aware defaults for weight alerts | Hatchlings grow faster than adults | Hatchlings get 25% gain threshold, adults get 10% |
| 24.5-02 | URL param pre-selection for reptile alerts | Enable deep linking from other pages | /notifications?tab=reptiles&reptile=1 opens specific reptile |
| 24.5-02 | TemplatesTab wraps existing NotificationTemplatesTab | Reuse existing component, avoid duplication | Clean integration without code duplication |
| 24.5-02 | Grouped schedule display by reptile | Users think in terms of "which reptile" not "which schedule" | More intuitive UX with type filter option |
| 24.5-01 | Default to 'global' tab when no query param | User decision from requirements | Clean default entry point to notifications page |
| 24.5-01 | Move NotificationHistory to /notification-history | Free up /notifications for unified page | Maintains existing notification history functionality |
| 24.5-01 | URL-controlled tab navigation | Enable deep linking and browser back button support | Better UX, shareable links to specific tabs |
| 24-03  | Use inline toast notifications (matching UserStreakDisplay) | Consistent UX with rest of app, no intrusive browser alert() | All error notifications follow app-wide pattern |
| 24-03  | Max threshold 500% to accommodate baby growth | Ball python hatchlings can gain 25%+ weekly | Prevents false positives for rapidly growing juveniles |
| 24-03  | Use response.data from PATCH for state updates | Ensures UI matches backend reality, prevents drift | Reliable persistence, single source of truth |
| 24-02  | Queue alerts via Celery for async delivery | Decouples weight logging from notification delivery | Prevents blocking weight log creation |
| 24-02  | Daily sweep job at 4 AM UTC | Safety net for missed alerts, runs after maintenance | Ensures no alerts missed due to edge cases |
| 24-02  | Gold/amber color for Discord embeds | Health alerts use warm warning colors (not critical red) | Visual consistency with alert severity |
| 24-01  | 7-day frequency cap per reptile | Prevents alert fatigue from frequent weight checks | Balances usefulness vs noise |
| 24-01  | Rolling 90-day lookback for baseline | Accommodates seasonal weight fluctuations | More accurate baseline than fixed window |

## Architecture Patterns Established

### Phase 24: Weight Change Alerts
**Pattern:** Detection → Delivery → UI
- Detection logic in `app.scheduler.weight_alerts` (24-01)
- Async delivery via Celery tasks (24-02)
- User-facing controls in ReptileDetail page (24-03)

**Pattern:** Species-aware defaults
- Default thresholds based on species characteristics
- Ball Python: 10%, Leopard Gecko: 15%, Crested Gecko: 12%, General: 15%
- User can override per-reptile

**Pattern:** Inline toast notifications
- Error handling uses inline toast (matching UserStreakDisplay)
- Red background, white text, 3s auto-dismiss
- Consistent UX across app

## Known Issues / Blockers

### Gap Closure Needed (Not Blockers)

The following features from vision were intentionally deferred and need separate plans:

1. ~~**Separate thresholds for gain vs loss**~~ ✅ DONE in 24.5-02
   - ✅ ReptileAlertsTab now has separate gain/loss threshold inputs

2. ~~**Age-aware defaults (baby/juvenile vs adult)**~~ ✅ DONE in 24.5-02
   - ✅ Age category calculated from birth_date (hatchling < 6mo, juvenile < 18mo, adult)
   - ✅ Recommended defaults shown based on age category

3. **Growth milestone alerts for juveniles**
   - Current: Only threshold-based alerts
   - Desired: Celebrate milestones (doubled birth weight, etc.)
   - Complexity: New feature, separate from alerts

4. **Rolling average baseline**
   - Current: Uses most recent weight as baseline
   - Desired: Compare to rolling average
   - Complexity: Requires detection logic + DB query changes

**Note:** Items 1 and 2 completed in 24.5-02. Items 3 and 4 remain as enhancement opportunities.

## Session Continuity

**Last session:** 2026-02-15T20:08:16Z
**Stopped at:** Completed 24.5-02 (Populate Notifications Page Tabs)
**Resume file:** `.planning/phases/24.5-unified-notifications-page/24.5-02-SUMMARY.md`

**Next session planning:**
- Phase 24.5-03 (optional): Clean up old notification tabs in Settings page if needed
- Phase 25: Weight Alert Customization (separate gain/loss thresholds in backend) - UNBLOCKED

## Key Files Reference

### Phase 24: Weight Change Alerts

**Backend (Detection):**
- `backend/app/scheduler/weight_alerts.py` - Detection logic, threshold comparison, frequency cap
- `backend/app/models/weight_alert_tracking.py` - Alert tracking model for 7-day cooldown

**Backend (Delivery):**
- `backend/app/celery_tasks.py` - `send_weight_change_alert_task` (async delivery)
- `backend/app/routers/weight.py` - POST endpoint integration (triggers check)
- `backend/app/scheduler/core.py` - `daily_weight_alert_sweep` (safety net at 4 AM)
- `backend/migrations/versions/0090_add_weight_change_alert_template.py` - Default template

**Frontend (UI):**
- `apps/reptile-tracker/frontend/src/pages/ReptileDetail.jsx` - Weight Alert Settings section

### Phase 24.5: Unified Notifications Page

**Frontend (Pages):**
- `frontend/src/pages/Notifications.jsx` - Unified notifications page with 5 tabs
- `frontend/src/App.jsx` - Route configuration (/notifications, /notification-history)
- `frontend/src/components/Layout.jsx` - Sidebar navigation with Bell icon

**Frontend (Tab Components):**
- `frontend/src/components/notifications/ChannelsTab.jsx` - Channel CRUD with test notification
- `frontend/src/components/notifications/GlobalSettingsTab.jsx` - Global preferences and planner digests
- `frontend/src/components/notifications/ReptileAlertsTab.jsx` - Per-reptile weight alert config
- `frontend/src/components/notifications/ScheduleNotificationsTab.jsx` - Per-schedule notification toggles
- `frontend/src/components/notifications/TemplatesTab.jsx` - Template editor wrapper

## Accumulated Context

### Notification System Architecture
- **Template-based:** All notifications use template system with fallback messages
- **Multi-channel:** In-app, Discord, Pushover, etc.
- **Async delivery:** Celery tasks for decoupled processing
- **Frequency caps:** Prevent alert fatigue (7-day cap for weight alerts)

### Weight Alert System Flow
```
User logs weight
  → POST /api/weight
  → check_weight_change_alert() (compare to baseline)
  → If threshold exceeded + cap not reached:
    → Queue send_weight_change_alert_task.delay()
    → Celery worker picks up task
    → Render template
    → Send to enabled channels
    → Update tracking (start 7-day cooldown)
```

### Species-Aware Defaults
- Ball Python: 10% (slow steady growers)
- Leopard Gecko: 15% (moderate metabolism)
- Crested Gecko: 12% (small fluctuations normal)
- General default: 15% (safe for most species)

**User can override per-reptile via ReptileDetail settings.**

## Architecture Patterns Established (continued)

### Phase 24.5: Unified Notifications Page
**Pattern:** URL-controlled tab navigation
- Tab state stored in URL query params (?tab=channels, ?tab=templates, etc.)
- Browser back button support
- Deep linking to specific tabs
- Radix UI Tabs with controlled mode

**Pattern:** Self-contained tab components
- Each tab component fetches its own data
- No prop drilling from parent Notifications page
- Clean separation of concerns

**Pattern:** Inline editing with Radix Collapsible
- Expand-one-at-a-time pattern for clean UX
- Used in ReptileAlertsTab and ScheduleNotificationsTab
- Consistent chevron icons (ChevronDown/ChevronRight)

**Pattern:** Age-aware defaults
- Calculate age category from birth_date: hatchling < 6mo, juvenile < 18mo, adult
- Different recommended thresholds per age category
- Hatchlings: 25% gain / 10% loss
- Juveniles: 15% gain / 8% loss
- Adults: 10% gain / 5% loss

---

**Project Status:** Phase 24 complete (UAT passed). Phase 24.5 (Unified Notifications Page) in progress - Plan 02 complete (all tabs functional). Next: Optional cleanup. Phase 25 (Weight Alert Customization) unblocked.
