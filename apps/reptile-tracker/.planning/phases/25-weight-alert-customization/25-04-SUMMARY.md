---
phase: 25-weight-alert-customization
plan: 04
subsystem: notifications
tags: [jinja2, templates, digest, notifications, format-options]

# Dependency graph
requires:
  - phase: 25-02
    provides: Jinja2 template support with render_template function
  - phase: 25-03
    provides: Template format variants (short/long)
provides:
  - Simple per-task line template format without Jinja2 loops
  - Format option toggles (group_by_reptile, show_time_windows, include_overdue, include_app_link)
  - Code-based digest iteration respecting format options
  - Enhanced preview showing full grouped digest with multiple reptiles
affects: [digest, templates, notifications, user-customization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Template as single-line format, system handles iteration"
    - "Format options as boolean toggles on template"
    - "Code-based message building with format option conditionals"
    - "Preview mirrors actual digest building logic"

key-files:
  created:
    - backend/migrations/versions/0100_add_digest_format_options.py
  modified:
    - backend/migrations/versions/0097_add_digest_template_types.py
    - backend/app/models.py
    - backend/app/schemas.py
    - backend/app/scheduler/digest.py
    - backend/app/routers/notification_templates.py

key-decisions:
  - "Templates define per-task line format only, not full digest structure"
  - "Format options control grouping, time windows, sections (not Jinja2 logic)"
  - "All format options default to True for backward compatibility"
  - "Preview uses same code path as actual digest building"

patterns-established:
  - "Pattern: Simple variable substitution templates with code-based iteration"
  - "Pattern: Format options as nullable booleans (NULL = default True)"
  - "Pattern: render_task_line_from_template helper for per-task rendering"
  - "Pattern: Preview mirrors production logic exactly"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 25 Plan 04: Remove Jinja2 Loops from Digest Templates

**Digest templates use simple per-task line format with toggle options instead of exposed Jinja2 loop syntax**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T13:59:37Z
- **Completed:** 2026-02-16T14:03:54Z
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments
- Removed all Jinja2 loop syntax from digest templates ({% for %}, {% if %})
- Added format option columns to NotificationTemplate (group_by_reptile, show_time_windows, include_overdue, include_app_link)
- Converted digest building functions to code-based iteration respecting format options
- Enhanced preview to show full grouped digest with multiple sample reptiles

## Task Commits

Each task was committed atomically:

1. **Task 1: Simplify digest templates in migration 0097** - `f49e92922` (refactor)
2. **Task 2: Add format options migration** - `16758ed14` (feat)
3. **Task 3: Update digest.py to use code-based iteration** - `cea8946b1` (refactor)
4. **Task 4: Update preview endpoint to show full digest** - `5eb0b156a` (feat)

## Files Created/Modified
- `backend/migrations/versions/0097_add_digest_template_types.py` - Simplified templates to single-line format
- `backend/migrations/versions/0100_add_digest_format_options.py` - Added format option columns
- `backend/app/models.py` - Added group_by_reptile, show_time_windows, include_overdue, include_app_link columns
- `backend/app/schemas.py` - Added format option fields to NotificationTemplateBase
- `backend/app/scheduler/digest.py` - Code-based iteration with render_task_line_from_template helper
- `backend/app/routers/notification_templates.py` - Preview with build_digest_preview_message and multiple reptiles

## Decisions Made

**1. Templates define per-task line format only**
- Rationale: Users customize via simple variables, not programming syntax
- Impact: System handles iteration, grouping, and sections

**2. Format options as nullable boolean toggles**
- Rationale: NULL = use default (True for backward compat), explicit False = disable
- Impact: Existing templates get default behavior, new templates can toggle options

**3. All format options default to True**
- Rationale: Backward compatibility with existing digest behavior
- Impact: Existing users see no change, new users can disable sections as desired

**4. Preview mirrors production logic**
- Rationale: Users need to see exactly what they will receive
- Impact: Preview uses same code path as digest.py, respects format options

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks executed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Gap 1 closed:** Digest templates no longer expose Jinja2 loop syntax to users.

**Ready for Gap 2 (plan 25-05):** Wire get_template_message into delivery code to use template format variants.

## Self-Check

Verification of plan execution:

**Files created:**
- Migration 0100: `/home/chrto/Homelab/github/chrtol/home-cluster/apps/reptile-tracker/backend/migrations/versions/0100_add_digest_format_options.py` ✓

**Files modified:**
- Migration 0097: Contains simple `{emoji} {reptile_name}: {schedule_name}{time_window_display}` format ✓
- models.py: Contains group_by_reptile column ✓
- schemas.py: Contains format option fields ✓
- digest.py: No use_jinja=True calls, uses render_task_line_from_template ✓
- notification_templates.py: No use_jinja=True calls, uses build_digest_preview_message ✓

**Commits exist:**
- f49e92922: refactor(25-04): simplify digest templates ✓
- 16758ed14: feat(25-04): add digest format option toggles ✓
- cea8946b1: refactor(25-04): convert digest functions ✓
- 5eb0b156a: feat(25-04): enhance preview ✓

**Verification checks:**
- No {% for %} in migration 0097: 0 found ✓
- Format options in models.py: Present ✓
- No use_jinja=True in digest.py: 0 found ✓
- No use_jinja=True in notification_templates.py: 0 found ✓
- Python syntax valid in all modified files ✓

## Self-Check: PASSED

---
*Phase: 25-weight-alert-customization*
*Completed: 2026-02-16*
