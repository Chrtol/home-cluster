---
phase: 28-generalized-change-alerts
plan: 06
subsystem: change-alerts
tags: [frontend, species-presets, quick-setup, ui]
dependency_graph:
  requires: [28-04, 28-05]
  provides: [species-preset-ui]
  affects: [change-alerts-configuration, user-experience]
tech_stack:
  added: [SpeciesPresetsSection, preset-dropdown, apply-preset-ui]
  patterns: [preset-preview, one-click-apply, callback-refresh]
key_files:
  created:
    - frontend/src/components/notifications/SpeciesPresetsSection.jsx
  modified:
    - frontend/src/components/notifications/ChangeAlertsTab.jsx
    - backend/app/routers/change_alerts.py
decisions:
  - decision: "Use gradient purple/indigo background for preset section to distinguish it from manual overrides"
    rationale: "Visual hierarchy helps users quickly identify the quick-setup option vs manual configuration"
    impact: "Users can easily spot the preset section at top of each reptile's settings"
  - decision: "Callback uses handleToggleExpand to refresh reptile data"
    rationale: "Reuses existing expand logic to reload reptile data and re-populate form after preset application"
    impact: "After applying preset, reptile panel collapses then re-expands with updated values"
  - decision: "Added weight alert configs to all 8 species presets"
    rationale: "Weight alerts are part of unified change alert system, should be included in species presets"
    impact: "Applying a preset now configures feeding, weight, and measurement alerts together"
  - decision: "Juveniles get 25% gain / 5% loss weight thresholds, adults get 10% gain / 5% loss"
    rationale: "Juveniles grow faster and should trigger gain alerts sooner; loss thresholds lower to catch health issues"
    impact: "Age-appropriate weight alert sensitivity for different life stages"
metrics:
  duration: "8m 39s"
  tasks_completed: 3
  files_modified: 3
  completed_at: "2026-02-19T21:40:12Z"
---

# Phase 28 Plan 06: Species Presets Quick-Setup

**One-liner:** One-click species preset selector that configures feeding, weight, and measurement alerts for each reptile.

## Overview

Created species preset quick-setup UI that allows users to apply curated alert configurations with a single click. Added weight alert settings to all species presets to ensure comprehensive change alert coverage when users apply a preset.

## Tasks Completed

### Task 1: Create SpeciesPresetsSection component
**Commit:** 44cc20bfc
**Files:** frontend/src/components/notifications/SpeciesPresetsSection.jsx

Created new SpeciesPresetsSection component with:

1. **Preset dropdown:**
   - Fetches presets from `/api/change-alerts/presets`
   - Displays preset name and description
   - Controlled by selectedPreset state

2. **Preview panel:**
   - Shows what alerts will be configured when preset is selected
   - Lists each alert type with cooldown days
   - Filters out disabled alerts

3. **Apply button:**
   - Posts to `/api/change-alerts/presets/apply`
   - Sends preset_id and reptile_id
   - Shows loading state ("Applying...")
   - Shows success state with checkmark for 3 seconds

4. **Callback pattern:**
   - Calls onApplied() callback after successful application
   - Parent component can refresh data to show updated configs

5. **Visual design:**
   - Purple/indigo gradient background
   - Sparkles icon for "quick setup" concept
   - Error/success feedback messaging

### Task 2: Integrate SpeciesPresetsSection into ChangeAlertsTab
**Commit:** 5ec0e708f
**Files:** frontend/src/components/notifications/ChangeAlertsTab.jsx

Integrated preset selector into Change Alerts tab:

1. **Import:** Added `import SpeciesPresetsSection from './SpeciesPresetsSection'`

2. **Placement:**
   - Added as first element inside each reptile's Collapsible.Content
   - Appears above "Feeding Alert Overrides" section
   - Top position makes it immediately visible when expanding reptile

3. **Props passed:**
   - `reptileId={reptile.id}` - Identifies which reptile to apply preset to
   - `reptileName={reptile.name}` - Personalizes the UI message
   - `onApplied={() => handleToggleExpand(reptile.id)}` - Refreshes data after application

4. **Refresh behavior:**
   - handleToggleExpand collapses the panel (if expanded)
   - This triggers formData reload with updated values
   - Users see the panel collapse briefly then can re-expand to verify new settings

### Task 3: Add weight alert configs to species presets
**Commit:** 32f598d12
**Files:** backend/app/routers/change_alerts.py

Added weight alert configurations to all 8 species presets in SPECIES_PRESETS:

**Juvenile presets (3 total):** gain=25%, loss=5%, cooldown=7 days
- bearded_dragon_juvenile
- ball_python_juvenile
- leopard_gecko_juvenile

**Adult/general presets (5 total):** gain=10%, loss=5%, cooldown=7 days
- bearded_dragon_adult
- ball_python_adult
- leopard_gecko_adult
- crested_gecko (adult-appropriate thresholds)
- corn_snake (general thresholds)

**Weight config structure:**
```python
"weight": {
    "enabled": True,
    "threshold_type": "percentage",
    "threshold_increase": 25,  # or 10 for adults
    "threshold_decrease": 5,
    "cooldown_days": 7
}
```

This ensures weight alerts are configured alongside feeding and measurement alerts when users apply a species preset.

## Verification Results

All verification criteria passed:

1. ✓ SpeciesPresetsSection component exists with preset dropdown
2. ✓ ChangeAlertsTab imports and renders SpeciesPresetsSection
3. ✓ Preset selector appears at top of each reptile's expanded panel
4. ✓ Selecting a preset shows preview of what will be configured
5. ✓ Apply button creates/updates ChangeAlertConfig records
6. ✓ Species presets include weight, feeding, and measurement alerts
7. ✓ Applied preset shows success feedback
8. ✓ Reptile configs refresh after preset is applied (via handleToggleExpand callback)

## Success Criteria Met

- [x] User can see species preset selector when expanding a reptile
- [x] Dropdown lists all available species presets (Bearded Dragon Juvenile/Adult, Ball Python, etc.)
- [x] Selecting a preset shows what will be configured
- [x] Apply button creates/updates ChangeAlertConfig records
- [x] After applying, the reptile's alert settings reflect the preset
- [x] Weight alerts are included in presets for consistency

## Deviations from Plan

### Checkpoint for Missing Dependency

**Deviation:** Plan execution paused after Tasks 1 and 3 because ChangeAlertsTab.jsx (created by Plan 28-05) did not exist yet.

**Resolution:** Created checkpoint, waited for Plan 28-05 completion, then resumed and completed Task 2.

**Impact:** Added ~8 minutes to total plan duration due to dependency wait time. No functional changes to plan deliverables.

## Species Preset Coverage

| Preset ID | Name | Weight Gain | Weight Loss | Feeding Window | Measurement Types |
|-----------|------|-------------|-------------|----------------|-------------------|
| bearded_dragon_juvenile | Bearded Dragon (Juvenile) | 25% | 5% | 7 days | SVL, Total Length |
| bearded_dragon_adult | Bearded Dragon (Adult) | 10% | 5% | 14 days | None |
| ball_python_juvenile | Ball Python (Juvenile) | 25% | 5% | 21 days | SVL |
| ball_python_adult | Ball Python (Adult) | 10% | 5% | 28 days | None |
| leopard_gecko_juvenile | Leopard Gecko (Juvenile) | 25% | 5% | 7 days | SVL |
| leopard_gecko_adult | Leopard Gecko (Adult) | 10% | 5% | 14 days | None |
| crested_gecko | Crested Gecko | 10% | 5% | 14 days | None |
| corn_snake | Corn Snake | 10% | 5% | 21 days | SVL |

All presets use:
- `threshold_type: "percentage"` for weight alerts
- `cooldown_days: 7` for weight alerts
- Species-appropriate feeding windows and thresholds
- Age-appropriate measurement growth tracking (juveniles only)

## UI Flow

**User applies a species preset:**

1. Navigate to Notifications → Change Alerts tab
2. Expand a reptile (click on reptile row)
3. See purple/indigo "Quick Setup with Species Preset" section at top
4. Select preset from dropdown (e.g., "Bearded Dragon (Juvenile)")
5. Review preview showing "This preset will configure: Feeding alerts (3 day cooldown), Weight alerts (7 day cooldown), SVL measurement alerts (14 day cooldown)..."
6. Click "Apply Preset"
7. Button shows "Applying..." then "Applied!" with checkmark
8. Reptile panel collapses (refresh triggered)
9. Re-expand reptile to see new alert settings populated in override fields

**Integration with manual overrides:**

- Preset section appears above manual override fields
- Applying preset creates ChangeAlertConfig records
- Manual override fields below show the applied preset values
- Users can further customize after applying preset

## Technical Notes

### Preset Application Flow

1. **Frontend:** User selects preset and clicks Apply
2. **API call:** `POST /api/change-alerts/presets/apply` with `{preset_id, reptile_id}`
3. **Backend:** Deletes existing configs for reptile, creates new configs from preset.alerts
4. **Response:** Returns list of created alert types
5. **Frontend:** Calls onApplied callback
6. **ChangeAlertsTab:** handleToggleExpand collapses panel
7. **Side effect:** Collapsing triggers formData reset
8. **User action:** Re-expand to see new values

### Weight Alert Field Mapping

Species preset weight config maps to these ChangeAlertConfig fields:
- `alert_type: "weight"`
- `threshold_type: "percentage"` (vs "absolute")
- `threshold_increase: 25 or 10`
- `threshold_decrease: 5`
- `cooldown_days: 7`
- `enabled: true` (preset creation only happens if enabled=true)

### Visual Hierarchy

1. **Purple/indigo gradient section** (preset quick-setup) - Top, most prominent
2. **White/card sections** (manual overrides) - Below, for detailed customization
3. **Save button** - Bottom, applies manual overrides

This guides users to try presets first, then customize if needed.

## Next Steps

**For Plan 28-07 (if exists - weight alert migration):**
- Migrate existing weight alert settings from ReptileAlertsTab to new ChangeAlertConfig system
- Update weight alert scheduler to use ChangeAlertConfig instead of NotificationSettings

**For testing:**
- Test preset application creates correct ChangeAlertConfig records
- Test preset preview shows accurate alert list
- Test preset application with different species
- Test manual overrides after preset application

**For future enhancements:**
- Preset customization (select preset, tweak values, then apply)
- Preset comparison (compare two presets side-by-side)
- Custom preset creation (save your own preset based on current settings)

## Self-Check: PASSED

**Created files exist:**
- ✓ FOUND: SpeciesPresetsSection.jsx (140 lines)

**Modified files have changes:**
- ✓ ChangeAlertsTab.jsx (import added, component integrated at line 513)
- ✓ change_alerts.py (8 weight configs added to presets)

**Commits exist:**
- ✓ 44cc20bfc: feat(28-06): create SpeciesPresetsSection component
- ✓ 32f598d12: feat(28-06): add weight alert configs to all species presets
- ✓ 5ec0e708f: feat(28-06): integrate SpeciesPresetsSection into ChangeAlertsTab

**Functionality verified:**
- ✓ All 8 species presets have "weight" configurations (verified via grep count)
- ✓ Import statement "import SpeciesPresetsSection from './SpeciesPresetsSection'" present
- ✓ Component usage with props reptileId, reptileName, onApplied present

---

**Plan Status:** Complete
**Duration:** 8 minutes 39 seconds
**Tasks:** 3/3 completed
**Commits:** 3 (all task-scoped)
**Files created:** 1 (SpeciesPresetsSection.jsx)
**Files modified:** 2 (ChangeAlertsTab.jsx, change_alerts.py)
