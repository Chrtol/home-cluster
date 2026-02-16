---
phase: 25-weight-alert-customization
plan: 02
subsystem: notifications
tags: [templates, jinja2, digest, planner]
completed: 2026-02-16T13:15:59Z
duration_seconds: 199
commits:
  - f8f6fbd6e
  - 9ffb74fc4
  - 782eeafdc
---

# Phase 25 Plan 02: Jinja2 Template Support for Planner Digests Summary

**One-liner:** Jinja2-powered digest templates with loops and conditionals for daily and weekly planners

## What Was Built

Added full Jinja2 template support for daily and weekly planner digest notifications, allowing users to customize digest format using loops and conditionals while maintaining backward compatibility with hardcoded fallback formats.

### Key Components

1. **Jinja2 Integration** (`backend/app/notifications.py`)
   - Added Jinja2==3.1.4 dependency to requirements.txt
   - Created Jinja2 environment with trim_blocks and lstrip_blocks enabled
   - Extended `render_template()` with `use_jinja` parameter for dual-mode rendering
   - Maintained SafeDict pattern for format_map compatibility

2. **Digest Template System** (`backend/app/scheduler/digest.py`)
   - `get_digest_template()` - Queries user/system templates by trigger type
   - `build_digest_context()` - Builds template context with tasks_by_reptile and all_tasks structures
   - `build_task_dict()` - Converts ScheduleInstance to template-friendly dict
   - `build_daily_digest_message_with_template()` - Jinja2 rendering for daily digests
   - `build_weekly_digest_message_with_template()` - Jinja2 rendering with weekly-specific context (days array)
   - All functions fall back to existing hardcoded formats when no template exists

3. **Template Preview Support** (`backend/app/routers/notification_templates.py`)
   - `generate_sample_digest_context()` - Generates realistic sample data with 3 tasks across 2 reptiles
   - Enhanced `preview_template()` endpoint to detect digest trigger types and use Jinja2
   - Sample data includes time windows, emojis, and weekly day breakdown

4. **Default Templates** (migration 0097)
   - Daily planner template: Flat task list with overdue section
   - Weekly planner template: Grouped by day with nested task loops
   - Both use Jinja2 syntax ({% for %}, {% if %}, {{ variable }})
   - Created as system templates (user_id = NULL)

### Context Variables Available

**All digest templates:**
- `tasks_by_reptile` - Dict mapping reptile name to task list (for grouped display)
- `all_tasks` - Flat list of all tasks (for chronological display)
- `overdue_tasks` - List of overdue tasks from yesterday
- `date` - Formatted date string (e.g., "Monday, February 16")
- `task_count` - Total number of tasks
- `overdue_count` - Number of overdue tasks
- `app_url` - Link to application

**Weekly-specific:**
- `start_date` - Start date string (e.g., "February 16")
- `end_date` - End date string (e.g., "February 22")
- `days` - Array of 7 day objects with `date` and `tasks` properties

**Task properties:**
- `reptile_name` - Reptile name
- `schedule_name` - Schedule name or schedule type title
- `schedule_type` - Schedule type identifier
- `time_window` - Formatted time window (e.g., "08:00-10:00")
- `emoji` - Schedule type emoji

## Deviations from Plan

None - plan executed exactly as written.

## Technical Decisions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Use `use_jinja` parameter instead of separate function | Simpler API, single function handles both modes | render_template signature extended with optional bool parameter |
| Order by user_id DESC NULLSLAST for template priority | User templates selected before system templates | Template resolution favors customization |
| Parameterized SQL with text() in migration | Avoid escaping issues with Jinja2 braces in f-strings | Clean, safe SQL execution |
| trim_blocks and lstrip_blocks in Jinja2 env | Remove whitespace from control structures | Cleaner rendered output without extra blank lines |
| Maintain hardcoded fallback functions | Backward compatibility, zero-downtime migration | System works even before templates exist |

## Files Modified

**Backend:**
- `backend/requirements.txt` - Added Jinja2==3.1.4
- `backend/app/notifications.py` - Jinja2 environment, dual-mode render_template
- `backend/app/scheduler/digest.py` - Template-powered digest functions
- `backend/app/routers/notification_templates.py` - Preview endpoint with sample data
- `backend/migrations/versions/0097_add_digest_template_types.py` - Default templates

## Testing Notes

**Verification completed:**
- ✅ Jinja2 dependency added to requirements.txt
- ✅ Jinja2 environment created in notifications.py
- ✅ render_template supports use_jinja parameter
- ✅ digest.py builds context with tasks_by_reptile and all_tasks
- ✅ Template-powered functions exist with fallback to hardcoded
- ✅ Preview endpoint generates sample data for digest templates
- ✅ Migration creates daily_planner and weekly_planner templates
- ✅ Default templates use Jinja2 loops and conditionals
- ✅ All Python files compile successfully

**Manual testing recommended:**
1. Run migration to create default templates
2. Preview daily_planner template via API
3. Preview weekly_planner template via API
4. Test digest generation with template (if scheduler integrated)
5. Test fallback when no template exists

## Dependencies

**Requires:**
- Phase 25 Plan 01 (25-01-PLAN.md) - Cooldown override UI (independent feature)

**Provides:**
- Jinja2 template rendering for digests
- Default digest templates as customization starting point
- Template preview with realistic sample data

**Affects:**
- Future digest sending code must use `build_*_with_template` functions
- Frontend templates tab will allow editing digest templates

## Next Phase Readiness

**Phase 25 Plan 03:** Ready to integrate template-powered digest sending into scheduler jobs.

**Required integrations:**
- Update daily planner job to call `build_daily_digest_message_with_template`
- Update weekly planner job to call `build_weekly_digest_message_with_template`
- Pass `db` session and `user_id` to enable template lookup

## Commits

| Hash | Message | Files |
|------|---------|-------|
| f8f6fbd6e | feat(25-02): add Jinja2 dependency and template rendering infrastructure | requirements.txt, notifications.py |
| 9ffb74fc4 | feat(25-02): update digest.py to use template system with Jinja2 | digest.py, notification_templates.py |
| 782eeafdc | feat(25-02): create migration with default digest templates | 0097_add_digest_template_types.py |

## Self-Check: PASSED

**File existence verification:**
```
✓ backend/requirements.txt - Jinja2==3.1.4 present
✓ backend/app/notifications.py - jinja_env and use_jinja present
✓ backend/app/scheduler/digest.py - template functions present
✓ backend/app/routers/notification_templates.py - preview endpoint updated
✓ backend/migrations/versions/0097_add_digest_template_types.py - migration created
```

**Commit existence verification:**
```
✓ f8f6fbd6e - feat(25-02): add Jinja2 dependency and template rendering infrastructure
✓ 9ffb74fc4 - feat(25-02): update digest.py to use template system with Jinja2
✓ 782eeafdc - feat(25-02): create migration with default digest templates
```

**Code quality verification:**
```
✓ All Python files compile without syntax errors
✓ Jinja2 syntax present in migration templates ({% for %}, {% if %})
✓ use_jinja=True calls present in digest.py (4 instances)
✓ tasks_by_reptile and all_tasks structures in context
```

All verifications passed. Plan executed successfully.
