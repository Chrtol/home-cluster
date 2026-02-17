---
phase: quick-001
plan: 01
subsystem: gamification
tags: [user-streak, ui, modal, tooltip, transparency]
completed_date: 2026-02-17
duration_minutes: 5

dependency_graph:
  requires: []
  provides:
    - "GET /api/user-streaks/me/misses endpoint"
    - "UserStreakDisplay missed tasks modal"
    - "TodayScheduleTimeline completion tooltips"
  affects:
    - "User streak transparency"
    - "Task completion visibility"

tech_stack:
  added: []
  patterns:
    - "React modal with Dialog component"
    - "Hover tooltip pattern in timeline"
    - "REST API for historical data"

key_files:
  created:
    - path: ".planning/quick/001-add-streak-miss-details-modal-and-comple/001-SUMMARY.md"
      purpose: "Quick task execution summary"
  modified:
    - path: "backend/app/schemas.py"
      purpose: "Added MissedTaskResponse schema"
      lines_changed: 10
    - path: "backend/app/routers/user_streaks.py"
      purpose: "Added GET /me/misses endpoint"
      lines_changed: 53
    - path: "frontend/src/components/UserStreakDisplay.jsx"
      purpose: "Added clickable misses modal"
      lines_changed: 85
    - path: "frontend/src/components/dashboard/TodayScheduleTimeline.jsx"
      purpose: "Added completion tooltips"
      lines_changed: 20

decisions: []

metrics:
  tasks_completed: 3
  commits: 3
  files_modified: 4
  backend_endpoints_added: 1
  frontend_components_enhanced: 2
---

# Quick Task 001: Add Streak Miss Details Modal and Completion Tooltips

**One-liner:** Modal showing recent missed tasks and hover tooltips on completed tasks for improved transparency

## Overview

Enhanced the user streak display and today's schedule timeline to provide better visibility into what tasks were missed (affecting streaks) and what was logged for completed tasks. This improves user understanding of streak mechanics and task completion details.

## Tasks Completed

### Task 1: Add API endpoint for recent missed tasks
**Status:** Complete
**Commit:** 6e9438150

Added `GET /api/user-streaks/me/misses` endpoint that returns up to 20 recent missed schedule instances for reptiles in the user's households. The endpoint:
- Filters by user's household membership for proper access control
- Joins ScheduleInstance with Schedule and Reptile to provide complete context
- Orders by scheduled_date DESC for most recent first
- Returns id, scheduled_date, schedule_type, reptile_name, reptile_id, and optional schedule_name

**Files modified:**
- `backend/app/schemas.py` - Added MissedTaskResponse schema
- `backend/app/routers/user_streaks.py` - Added endpoint implementation

### Task 2: Add streak miss details modal to UserStreakDisplay
**Status:** Complete
**Commit:** 70e21335b

Made the "X/2 misses" section in the streak popover clickable, opening a modal dialog with detailed missed task information.

**Implementation:**
- Imported Dialog components from shadcn/ui
- Added state for missesModalOpen, missedTasks, loadingMisses
- Made misses section a clickable button with hover effect
- Fetches missed tasks from API on modal open
- Displays list with reptile name, task type, schedule name (if present), and formatted date
- Shows loading spinner during fetch
- Shows trophy icon with encouraging message when no misses

**Files modified:**
- `frontend/src/components/UserStreakDisplay.jsx`

### Task 3: Add completion tooltip to completed tasks in timeline
**Status:** Complete
**Commit:** 413e56077

Added hover tooltips to completed tasks in the TodayScheduleTimeline's expandable "X completed" section.

**Implementation:**
- Reused existing hover state pattern (hoveredTask, handleMouseEnter, handleMouseLeave)
- Added tooltip rendering in completed schedules section
- Displays completion time (formatted with user's time preference)
- Shows supplements that were logged with the completion
- Positioned tooltip below task item with same styling as pending task tooltips

**Files modified:**
- `frontend/src/components/dashboard/TodayScheduleTimeline.jsx`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All success criteria met:
- Misses count in streak popover is clickable and opens detail modal
- Modal lists recent missed tasks with date, reptile, and task type
- Completed tasks in TodayScheduleTimeline show tooltip on hover
- Tooltip displays completion time and supplements
- Both features integrate seamlessly with existing functionality

## Next Steps

None - this was a self-contained quick task to improve transparency and user awareness.

## Technical Notes

**API Design:**
- Used same permission filtering pattern as calendar endpoint (household membership)
- Limited to 20 misses to prevent excessive data transfer
- Schema includes optional schedule_name for better context

**Frontend Patterns:**
- Dialog component from shadcn/ui maintains consistent modal UX
- Hover tooltip pattern reused from pending tasks for consistency
- Date formatting helper provides relative dates (Today, Yesterday, etc.)
- Loading and empty states provide good UX feedback

**Data Flow:**
- Modal fetches data lazily on open (doesn't load until user clicks)
- Completion time comes from schedule.completed_at (already available in calendar API)
- Supplements already loaded via selectinload in calendar query

## Self-Check

Verifying implementation claims:

**Backend endpoints:**
- GET /api/user-streaks/me/misses - Implementation verified in user_streaks.py line 280

**Frontend components:**
- UserStreakDisplay modal - Implementation verified lines 26-28, 86-117, 263-296
- TodayScheduleTimeline tooltip - Implementation verified lines 488-501

**Schemas:**
- MissedTaskResponse - Verified in schemas.py lines 1447-1454

**All commits present:**
- 6e9438150 - feat(quick-001): add API endpoint for recent missed tasks
- 70e21335b - feat(quick-001): add streak miss details modal
- 413e56077 - feat(quick-001): add completion tooltip to completed tasks

## Self-Check: PASSED

All files, endpoints, and commits verified present and implemented as described.
