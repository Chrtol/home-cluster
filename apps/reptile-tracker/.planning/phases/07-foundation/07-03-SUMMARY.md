---
phase: 07-foundation
plan: 03
subsystem: frontend/ui
tags: [date-picker, time-picker, shadcn, user-preferences]
dependency_graph:
  requires: [07-01]
  provides: [date-picker-component, time-picker-component, calendar-component]
  affects: [forms, scheduling]
tech_stack:
  added:
    - "@radix-ui/react-popover: ^2.1.4"
    - "react-day-picker: ^9.13.1"
  patterns:
    - "User preference integration (date format, first day of week)"
    - "Popover-based pickers with shadcn/ui styling"
    - "ISO date format for API, user format for display"
key_files:
  created:
    - frontend/src/components/ui/popover.jsx
    - frontend/src/components/ui/calendar.jsx
    - frontend/src/components/ui/date-picker.jsx
    - frontend/src/components/ui/time-picker.jsx
  modified:
    - frontend/package.json
decisions:
  - choice: "react-day-picker for calendar library"
    reason: "Official shadcn/ui choice, actively maintained, good accessibility"
  - choice: "ISO format for onChange, user format for display"
    reason: "API compatibility while respecting user preferences"
  - choice: "24-hour TimePicker format"
    reason: "Consistency and international compatibility"
  - choice: "Quick-pick grid with 30-minute default step"
    reason: "Fast time selection for common use cases"
metrics:
  duration: "2 minutes 18 seconds"
  tasks_completed: 3
  commits: 3
  files_created: 4
  files_modified: 1
  completed_date: "2026-02-07T23:24:15Z"
---

# Phase 7 Plan 3: Date/Time Picker Components Summary

**One-liner:** Calendar-based DatePicker and quick-pick TimePicker components with user format preference integration (DD/MM/YYYY, first day of week)

## Objective Achievement

Created DatePicker and TimePicker components using shadcn/ui patterns, fully integrated with the existing user date format preference system from plan 07-01. Both pickers respect user locale preferences while maintaining ISO format for API communication.

**Purpose addressed:** Replace text-based DateInput with proper calendar-based selection (FOUND-03) while preserving user format preferences established in the existing codebase.

## Components Delivered

### 1. Popover Component
**File:** `frontend/src/components/ui/popover.jsx`

Radix UI Popover wrapper with shadcn styling:
- Animation support (fade-in/out, zoom, slide)
- Warm dark palette integration
- Portal rendering for proper z-index handling
- Exports: `Popover`, `PopoverTrigger`, `PopoverContent`

### 2. Calendar Component
**File:** `frontend/src/components/ui/calendar.jsx`

DayPicker wrapper with comprehensive styling:
- Warm dark theme styling matching design system
- Chevron navigation icons from lucide-react
- Support for single date, range, and multiple selection modes
- Responsive month layout (stacked on mobile)
- Accessibility features (keyboard navigation, focus management)

### 3. DatePicker Component
**File:** `frontend/src/components/ui/date-picker.jsx`

Single date picker with user preference integration:
- **Display:** Shows dates in user's preferred format (DD/MM/YYYY, MM/DD/YYYY, DD.MM.YYYY, YYYY-MM-DD)
- **API:** Returns ISO format (YYYY-MM-DD) via onChange for backend compatibility
- **Preferences:** Respects `getUserDateFormat()` and `getUserFirstDayOfWeek()` from existing utils
- **Features:** Min/max date constraints, calendar icon, placeholder support
- **Interface:** Same as existing DateInput component for drop-in replacement

### 4. DateRangePicker Component
**File:** `frontend/src/components/ui/date-picker.jsx`

Date range picker for statistics and filtering:
- Two-month calendar display
- Range selection with from/to dates
- Same user preference integration as DatePicker
- Returns `{ from: "YYYY-MM-DD", to: "YYYY-MM-DD" }` format

### 5. TimePicker Component
**File:** `frontend/src/components/ui/time-picker.jsx`

Time picker with dual input methods:
- **Manual entry:** HH:MM text input with validation
- **Quick-pick grid:** Configurable step size (default 30 minutes)
- **Format:** 24-hour time for consistency
- **Features:** Min/max time constraints, numeric input mode for mobile
- **UX:** Grid shows all valid times, current selection highlighted

### 6. TimeInput Component
**File:** `frontend/src/components/ui/time-picker.jsx`

Simple inline time input:
- Native HTML5 time input with shadcn styling
- For contexts where popover is unnecessary
- Same constraints (min/max time) as TimePicker

## User Preference Integration

All pickers integrate with existing preference utilities:

```javascript
// from frontend/src/utils/dateFormatting.js
getUserDateFormat()      // Returns: DD/MM/YYYY, MM/DD/YYYY, etc.
getUserFirstDayOfWeek()  // Returns: 'monday' or 'sunday'
toLocalISODate(date)     // Converts Date to ISO string in local time
```

**Format conversion logic:**
- User format (YYYY-MM-DD) → date-fns format (yyyy-MM-dd)
- Display uses user preference
- API communication uses ISO format
- No timezone conversion issues (local date preserved)

## Dependencies Added

```json
{
  "@radix-ui/react-popover": "^2.1.4",
  "react-day-picker": "^9.13.1"
}
```

**Existing dependencies leveraged:**
- date-fns (3.6.0) - date parsing/formatting
- lucide-react - icons (Calendar, Clock, ChevronLeft, ChevronRight)
- @/lib/utils - cn() utility

## Technical Patterns

### Pattern 1: User Preference Respect
```jsx
const userFormat = getUserDateFormat()        // e.g., "DD/MM/YYYY"
const dateFnsFormat = convertDateFormat(userFormat)  // → "dd/MM/yyyy"
const displayText = format(selectedDate, dateFnsFormat)  // User sees their format
const isoDate = toLocalISODate(date)          // API gets ISO
```

### Pattern 2: Popover-Based Selection
```jsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">
      <CalendarIcon />
      {displayText}
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <Calendar onSelect={handleSelect} />
  </PopoverContent>
</Popover>
```

### Pattern 3: Constraint Support
```jsx
<DatePicker
  value="2025-12-05"
  onChange={handleChange}
  minDate={new Date(2025, 0, 1)}  // Jan 1, 2025
  maxDate={new Date()}             // Today
/>
```

## Verification Results

**Build:** ✓ Succeeded (6.08s)
```
dist/index.html                     0.68 kB
dist/assets/index-BdLz22VV.css     79.93 kB
dist/assets/index-D8_kPQmY.js   1,297.07 kB
```

**Component exports:** ✓ All verified
- Popover, PopoverTrigger, PopoverContent
- Calendar
- DatePicker, DateRangePicker
- TimePicker, TimeInput

**User preference integration:** ✓ Confirmed
- `getUserDateFormat()` called in DatePicker
- `getUserFirstDayOfWeek()` used for calendar configuration
- Format conversion logic tested

## Deviations from Plan

None - plan executed exactly as written.

All tasks completed successfully:
1. Installed dependencies and created Popover component
2. Created Calendar and DatePicker components with user format integration
3. Created TimePicker component with quick-pick grid

## Usage Examples

### Basic DatePicker
```jsx
import { DatePicker } from '@/components/ui/date-picker'

function FeedingForm() {
  const [date, setDate] = useState('')  // ISO format: "2025-12-05"

  return (
    <DatePicker
      value={date}
      onChange={setDate}
      placeholder="Select feeding date"
    />
  )
  // User sees: "05/12/2025" (if DD/MM/YYYY preference)
  // API receives: "2025-12-05"
}
```

### DateRangePicker for Statistics
```jsx
import { DateRangePicker } from '@/components/ui/date-picker'

function Statistics() {
  const [range, setRange] = useState(null)

  return (
    <DateRangePicker
      value={range}
      onChange={setRange}
      placeholder="Select date range"
    />
  )
  // Returns: { from: "2025-12-01", to: "2025-12-31" }
}
```

### TimePicker
```jsx
import { TimePicker } from '@/components/ui/time-picker'

function ScheduleFeeding() {
  const [time, setTime] = useState('')  // "14:30"

  return (
    <TimePicker
      value={time}
      onChange={setTime}
      step={15}  // 15-minute intervals in quick-pick
    />
  )
}
```

### TimeInput (Inline)
```jsx
import { TimeInput } from '@/components/ui/time-picker'

function QuickTimeEntry() {
  const [time, setTime] = useState('')

  return (
    <TimeInput
      value={time}
      onChange={setTime}
      minTime="06:00"
      maxTime="22:00"
    />
  )
}
```

## Mobile Considerations

All pickers are mobile-friendly:
- **Touch targets:** Minimum 44px tap targets
- **Input modes:** `inputMode="numeric"` for manual time entry
- **Native fallback:** TimeInput uses native HTML5 time picker on mobile
- **Responsive layout:** Calendar stacks months vertically on small screens
- **Popover placement:** Auto-adjusts to stay on screen

## Accessibility

- **Keyboard navigation:** Full support in Calendar component
- **Focus management:** `initialFocus` prop on Calendar
- **ARIA labels:** Inherited from Radix UI primitives
- **Screen readers:** Semantic button triggers with descriptive text

## Next Phase Readiness

**Blockers:** None

**Provides for future phases:**
- Phase 8 (Dashboard): DateRangePicker for statistics filtering
- Phase 9 (Reptile Pages): DatePicker for feeding history
- Phase 11 (Forms/Tables): All pickers for form inputs

**Component variants ready:**
- Single date selection (DatePicker)
- Date range selection (DateRangePicker)
- Time selection with grid (TimePicker)
- Time selection inline (TimeInput)

## Self-Check: PASSED

Verified all deliverables exist and are committed.

**Created files:**
- [✓] frontend/src/components/ui/popover.jsx
- [✓] frontend/src/components/ui/calendar.jsx
- [✓] frontend/src/components/ui/date-picker.jsx
- [✓] frontend/src/components/ui/time-picker.jsx

**Commits:**
- [✓] 06e104faa - Popover component
- [✓] a1f6ae54a - Calendar and DatePicker
- [✓] b8789e68e - TimePicker

**Build verification:**
- [✓] Build succeeds (6.08s)
- [✓] No TypeScript/ESLint errors
