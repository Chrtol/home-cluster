# Reptile Tracker - Project State

**Last Updated:** 2026-02-15T19:10:00Z

## Current Position

**Phase:** 24.5 of 25 (Unified Notifications Page)
**Plan:** Requirements defined
**Status:** Ready to plan
**Last activity:** 2026-02-15 - Completed Phase 24 UAT, created Phase 24.5 and 25 requirements

**Progress:** Phase 24.5 - Unified Notifications Page
```
24-01: ███████████ COMPLETE (Detection Logic)
24-02: ███████████ COMPLETE (Delivery Integration)
24-03: ███████████ COMPLETE (Settings UI)
24-UAT: ███████████ COMPLETE (7/7 pass, 1 fix applied)

24.5: ░░░░░░░░░░░ PLANNED (Unified Notifications Page)
25:   ░░░░░░░░░░░ PLANNED (Weight Alert Customization) - blocked by 24.5
```

**Overall System Progress:**
- ✅ Core notification system with templates
- ✅ Weight change alert detection and delivery
- ✅ User-facing alert settings UI
- ⏳ Phase 24.5: Unified notifications page (planned)
- ⏳ Phase 25: Configurable frequency caps (blocked by 24.5)

## Recent Decisions

| Phase  | Decision | Rationale | Impact |
|--------|----------|-----------|--------|
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

1. **Separate thresholds for gain vs loss**
   - Current: Single threshold for both directions
   - Desired: Different thresholds (e.g., 5% loss / 15% gain)
   - Complexity: Requires schema changes + UI redesign

2. **Age-aware defaults (baby/juvenile vs adult)**
   - Current: Species-based defaults only
   - Desired: Different defaults based on age
   - Complexity: Requires age tracking system

3. **Growth milestone alerts for juveniles**
   - Current: Only threshold-based alerts
   - Desired: Celebrate milestones (doubled birth weight, etc.)
   - Complexity: New feature, separate from alerts

4. **Rolling average baseline**
   - Current: Uses most recent weight as baseline
   - Desired: Compare to rolling average
   - Complexity: Requires detection logic + DB query changes

**Note:** These are enhancement opportunities, not bugs. Core system is production-ready.

## Session Continuity

**Last session:** 2026-02-15T19:10:00Z
**Stopped at:** Phase 24 complete, Phase 24.5 and 25 requirements created, roadmap updated
**Resume file:** `.planning/phases/24.5-unified-notifications-page/24.5-REQUIREMENTS.md`

**Next session planning:**
- Phase 24.5: Unified Notifications Page (consolidate scattered notification settings)
- Phase 25: Weight Alert Customization (blocked by 24.5)

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

---

**Project Status:** Phase 24 complete (UAT passed). Phase 24.5 (Unified Notifications Page) requirements defined - consolidates scattered notification settings. Phase 25 (Weight Alert Customization) blocked by 24.5.
