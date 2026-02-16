# Reptile Tracker - Project State

**Last Updated:** 2026-02-16T15:10:00Z

## Current Position

**Phase:** 25 of 25 (Weight Alert Customization) - COMPLETE
**Plan:** 5 of 5 plans complete
**Status:** MILESTONE COMPLETE - v1.3 Engagement & Awareness shipped
**Last activity:** 2026-02-16 - Completed Phase 25 with gap closure (plans 25-04, 25-05)

**Progress:** Phase 25 - COMPLETE ✓
```
25-01: ███████████ COMPLETE (Per-Reptile Cooldown Override)
25-02: ███████████ COMPLETE (Jinja2 Template Support)
25-03: ███████████ COMPLETE (Template Format Variants)
25-04: ███████████ COMPLETE (Gap closure: Remove Jinja2 loops) ✅
25-05: ███████████ COMPLETE (Gap closure: Wire get_template_message) ✅
```

**Overall System Progress:**
- ✅ Core notification system with templates
- ✅ Weight change alert detection and delivery
- ✅ User-facing alert settings UI
- ✅ Phase 24.5: Unified notifications page
- ✅ Phase 25: Notification customization & gap closure
- ✅ **v1.3 MILESTONE COMPLETE**

## Gaps Closed

**Gap 1: Jinja2 loops exposed in templates (DESIGN)** - ✅ CLOSED
- Fix: Replaced Jinja2 templates with simple task line format, added format option toggles
- Plan: 25-04
- Commits: f49e92922, 16758ed14, cea8946b1, 5eb0b156a

**Gap 2: Template variant selection not wired (INTEGRATION)** - ✅ CLOSED
- Fix: Wired get_template_message into all 8 notification delivery locations
- Plan: 25-05
- Commits: 07becbf9b, 92f2e5b13

## Recent Decisions

| Phase  | Decision | Rationale | Impact |
|--------|----------|-----------|--------|
| 25-05  | Pass full channel object instead of individual components | Cleaner API, enables channel-specific logic beyond format preference | send_schedule_reminder and send_overdue_alert now accept channel object, extract components internally |
| 25-05  | Digest task lines explicitly use short variant | Digests need concise task lines regardless of channel format | digest.py uses message_template_short directly, doesn't use get_template_message |
| 25-03  | Template variants (short/long) instead of separate templates | Single template with two variants simpler to manage | Users edit one template, system selects variant based on channel preference |
| 25-03  | Channel-level format preference (not per-template) | Format is a property of the delivery channel, not the content | Each channel has format setting, same template renders differently per channel |
| 25-03  | Consolidate expiry_alert into follow_up | Four alert types (reminder, follow-up, expiry, overdue) was confusing | Simplified to three concepts (reminder, follow-up nudge, overdue) |
| 25-03  | Show calculated follow-up time with warning | Users need to see when follow-up will actually fire | Preview helps users understand timing, warning prevents misconfiguration |
| 25-02  | Use use_jinja parameter instead of separate function | Simpler API, single function handles both modes | render_template signature extended with optional bool parameter |
| 25-02  | Order by user_id DESC NULLSLAST for template priority | User templates selected before system templates | Template resolution favors customization |
| 25-02  | Parameterized SQL with text() in migration | Avoid escaping issues with Jinja2 braces in f-strings | Clean, safe SQL execution |
| 25-02  | trim_blocks and lstrip_blocks in Jinja2 env | Remove whitespace from control structures | Cleaner rendered output without extra blank lines |
| 25-02  | Maintain hardcoded fallback functions | Backward compatibility, zero-downtime migration | System works even before templates exist |
| 25-01  | NULL cooldown means inherit global setting | Allows per-reptile override without requiring all reptiles to be configured | Default behavior unchanged, explicit override only when needed |
| 25-01  | Zero cooldown means no cooldown (alert on every weight log) | Enables intensive monitoring for sick reptiles without disabling alerts globally | Users can configure per-reptile no-cooldown for health monitoring |
| 25-01  | get_effective_cooldown_days checks reptile override first, then global | Cascading config pattern matches existing threshold logic | Clean separation of concerns, predictable override behavior |
| 24.5-03 | Use TimePicker component for all time inputs | Consistent UX with logging pages, better quick-pick UI | All time inputs use same popover-based picker |
| 24.5-03 | Respect user time format preference in schedule display | Users expect consistent 12h/24h formatting | Time windows display in user's preferred format |
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

**Last session:** 2026-02-16T14:03:29Z
**Stopped at:** Completed Phase 25-05 (Wire get_template_message)
**Resume file:** /home/chrto/Homelab/github/chrtol/home-cluster/apps/reptile-tracker/.planning/phases/25-weight-alert-customization/25-05-SUMMARY.md

**Next session planning:**
- Execute plan 25-04 to close remaining gap (Jinja2 loops in digest templates)
- After 25-04: Phase 25 complete, ready for production deployment

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

### Phase 25: Weight Alert Customization & Template Enhancements

**Backend (Per-Reptile Cooldown):**
- `backend/app/models.py` - Reptile.weight_alert_cooldown_days column
- `backend/app/scheduler/weight_alerts.py` - get_effective_cooldown_days function
- `frontend/src/components/notifications/ReptileAlertsTab.jsx` - Cooldown dropdown UI
- `backend/migrations/versions/0096_add_reptile_cooldown_override.py` - Migration

**Backend (Jinja2 Templates):**
- `backend/app/notifications.py` - Jinja2 environment, dual-mode render_template, get_template_message
- `backend/app/scheduler/digest.py` - Template-powered digest functions with fallback
- `backend/app/routers/notification_templates.py` - Preview endpoint with sample data
- `backend/migrations/versions/0097_add_digest_template_types.py` - Default digest templates

**Backend (Template Format Variants):**
- `backend/app/models.py` - NotificationTemplate.message_template_short/long, NotificationChannel.notification_format
- `backend/migrations/versions/0098_add_template_format_variants.py` - Template variant columns
- `backend/migrations/versions/0099_consolidate_expiry_to_followup.py` - Consolidate expiry_alert into follow_up

**Frontend (Format Variants UI):**
- `frontend/src/components/notifications/ChannelsTab.jsx` - Notification format dropdown
- `frontend/src/components/notifications/ScheduleNotificationsTab.jsx` - FollowUpPreview component

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

### Phase 25: Weight Alert Customization & Template Enhancements

**Pattern:** Nullable override fields (25-01)
- NULL = inherit global setting
- 0 = no cooldown (intensive monitoring)
- Positive integer = days

**Pattern:** Cascading config resolution (25-01)
- Check per-reptile override first
- Fall back to global NotificationSettings
- Default fallback if no settings exist

**Pattern:** Template format variants (25-03)
- Single template with short and long variants
- Channel-level format preference (not per-template)
- get_template_message() selects variant based on channel.notification_format
- Legacy fallback for backward compatibility

**Pattern:** Calculated UI preview (25-03)
- FollowUpPreview component calculates follow-up fire time
- Shows real-time preview as user changes settings
- Inline warning when configuration issues detected

**Pattern:** Alert sequence simplification (25-03)
- Before: Main reminder → Follow-up → Expiry alert → Overdue (4 concepts)
- After: Main reminder → Follow-up nudge → Overdue (3 concepts)
- Expiry alert functionality merged into follow_up

---

**Project Status:** Phase 24, 24.5, and 25 complete. Notification system fully implemented with per-reptile customization, template format variants, and simplified alert sequence.
