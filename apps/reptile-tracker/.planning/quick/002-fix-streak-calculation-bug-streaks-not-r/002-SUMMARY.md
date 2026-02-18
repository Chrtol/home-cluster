---
phase: quick-002
plan: 01
subsystem: gamification
tags:
  - bug-fix
  - user-streaks
  - calculation-logic
dependency_graph:
  requires: []
  provides:
    - "Correct user streak calculation with break point detection"
    - "Streak resets properly after 2 consecutive misses"
  affects:
    - user_streaks.py (recalculate endpoint)
    - user_streak_service.py (recalculate_all function)
tech_stack:
  added: []
  patterns:
    - "Chronological event simulation for state derivation"
    - "Break point detection in time-series data"
key_files:
  created: []
  modified:
    - path: "apps/reptile-tracker/backend/app/routers/user_streaks.py"
      purpose: "Fixed recalculate_streak endpoint to properly calculate streak with break points"
    - path: "apps/reptile-tracker/backend/app/services/user_streak_service.py"
      purpose: "Fixed recalculate_all_user_streaks to properly calculate streak with break points"
decisions: []
metrics:
  duration_minutes: 1.5
  completed_date: "2026-02-18"
---

# Quick Task 002: Fix Streak Calculation Bug - Streaks Not Resetting After Misses

**One-liner:** Fixed user streak calculation to properly reset to 0 after 2 consecutive misses instead of showing total lifetime completions

## Objective

Fixed a critical bug in user streak calculation where the system was counting total lifetime completions instead of tracking consecutive completions that reset when 2 tasks are missed in a row. This caused users who had missed tasks to see inflated streak counts (e.g., showing "16" when the actual streak should be "0").

## Context

The user streak system is designed to work like Duolingo's streak system:
- Each manual task completion increments the streak
- Missing 2 tasks in a row breaks the streak (resets to 0)
- The streak then counts up from 0 with new completions

However, both recalculation functions were using a simple count of total completions instead of simulating the streak evolution chronologically with break point detection.

## Tasks Completed

### Task 1: Fix recalculate_streak endpoint in user_streaks.py
**Status:** ✓ Complete
**Commit:** 748147253

**Changes:**
- Replaced `total_completions` count query with chronological streak simulation
- Query now orders completions by `scheduled_date.asc()` (oldest first)
- Added break point detection: when `consecutive_misses >= 2`, reset `streak = 0`
- Completions increment streak and reset consecutive_misses to 0
- PENDING status is ignored (doesn't affect streak)
- Fixed log message to use calculated `streak` value instead of `total_completions`

**Files Modified:**
- `apps/reptile-tracker/backend/app/routers/user_streaks.py`

### Task 2: Fix recalculate_all_user_streaks in user_streak_service.py
**Status:** ✓ Complete
**Commit:** 77029e5c4

**Changes:**
- Applied the same fix to the `recalculate_all_user_streaks` function
- Replaced total_completions count with chronological streak simulation
- Query orders completions by `scheduled_date.asc()` for chronological processing
- Same break point detection logic: `consecutive_misses >= 2` → `streak = 0`
- Removed the separate "recent completions" query (no longer needed)
- Updated log message to use calculated `streak` value

**Files Modified:**
- `apps/reptile-tracker/backend/app/services/user_streak_service.py`

### Task 3: Manual Testing Documentation
**Status:** ✓ Complete

**Testing Steps for User Verification:**

1. **Check current streak (before fix):**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" https://reptile-tracker.example.com/api/user-streaks/me
   ```
   Expected: Shows inflated streak count (e.g., 16 when should be 0)

2. **Trigger recalculation (apply fix):**
   ```bash
   curl -X POST -H "Authorization: Bearer $TOKEN" https://reptile-tracker.example.com/api/user-streaks/me/recalculate
   ```
   Expected: Returns corrected streak value

3. **Expected Behavior After Fix:**
   - If user completed 16 tasks, then missed 2 in a row, then completed 0 more → streak = 0
   - If user completed 16 tasks, missed 2, then completed 3 more → streak = 3
   - `consecutive_misses` reflects only trailing misses (not those before last completion)

4. **Automated Recalculation:**
   - On next app startup, `recalculate_all_user_streaks` runs automatically
   - Check logs for streak recalculation messages
   - All users' streaks will be corrected

## Algorithm Explanation

### Old (Broken) Algorithm:
```python
# Count ALL completions ever
total_completions = count(status in COMPLETED_*)
current_streak = total_completions  # WRONG - ignores breaks
```

### New (Correct) Algorithm:
```python
# Simulate streak evolution chronologically
streak = 0
consecutive_misses = 0

for completion in all_completions_ordered_by_date_asc:
    if completion.status == MISSED:
        consecutive_misses += 1
        if consecutive_misses >= 2:
            streak = 0  # Break point!
            consecutive_misses = 0
    elif completion.status in COMPLETED_*:
        streak += 1
        consecutive_misses = 0
```

**Key Insight:** The streak is the count of completions AFTER the most recent break point (2 consecutive misses), not the total lifetime count.

## Verification

### Self-Check: PASSED

**Files exist:**
```bash
FOUND: apps/reptile-tracker/backend/app/routers/user_streaks.py
FOUND: apps/reptile-tracker/backend/app/services/user_streak_service.py
```

**Commits exist:**
```bash
FOUND: 748147253
FOUND: 77029e5c4
```

**Code verification:**
- Both functions now use chronological processing (`.order_by(scheduled_date.asc())`)
- Both implement break point detection (`if consecutive_misses >= 2: streak = 0`)
- No code path sets `current_streak = total_completions`
- Log messages use `streak` variable (not `total_completions`)

## Deviations from Plan

None - plan executed exactly as written.

## Impact

### User Experience:
- **Before:** User sees "16 day streak" despite missing tasks for weeks
- **After:** User sees "0 day streak" after missing 2 tasks, accurate count after resuming

### Gamification Integrity:
- Streak system now matches documented behavior and user expectations
- Streak milestones (7, 30, 100, 365) are now meaningful achievements
- Freeze system becomes relevant (prevents streak breaks during vacations)

### Data Consistency:
- Recalculation endpoint immediately fixes individual user streaks
- Startup recalculation corrects all user streaks automatically
- Event-driven updates (on task completion/miss) continue to work correctly

## Next Steps

1. **Deploy fix** - The fix will auto-apply on next deployment via `recalculate_all_user_streaks` at startup
2. **Manual verification** - User should check their streak before/after via API or UI
3. **Monitor logs** - Check for recalculation messages in backend logs after deployment
4. **Consider UI indicator** - Optionally show "Streak recalculated" message to users on next login

## Technical Notes

### Why Chronological Simulation?

The streak is a **derived state** that depends on the **order of events**. You cannot calculate it from aggregates (like counts) - you must replay the history:

- Event 1: Complete → streak = 1
- Event 2: Complete → streak = 2
- Event 3: Miss → consecutive_misses = 1
- Event 4: Miss → consecutive_misses = 2 → **BREAK** → streak = 0
- Event 5: Complete → streak = 1

Simply counting "4 completions" gives wrong answer (4 vs correct answer: 1).

### Performance Considerations

- The fix queries ALL completions (not just recent 10)
- For users with thousands of completions, this could be slow
- Consider future optimization: binary search for most recent break point
- Current implementation prioritizes correctness over performance

### Event-Driven Updates Still Work

The event listeners (`on_schedule_completion_updated`) incrementally update streaks on each completion/miss. These listeners work correctly because they:
- Increment streak on completion
- Increment consecutive_misses on miss
- Reset streak when consecutive_misses reaches 2

The bug was only in the recalculation functions (used for fixing inconsistencies or startup sync).

---

**Plan Status:** Complete (2/2 tasks executed, 2 commits created)
