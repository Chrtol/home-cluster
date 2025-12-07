# Reptile Tracker Scheduling System Documentation

**Last Updated**: 2025-12-07
**Version**: 2.0 (Interval Schedule Refactor)

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Schedule Modes](#schedule-modes)
4. [Database Schema](#database-schema)
5. [Backend Modules](#backend-modules)
6. [Frontend Components](#frontend-components)
7. [API Endpoints](#api-endpoints)
8. [Notification System](#notification-system)
9. [Examples & Use Cases](#examples--use-cases)
10. [Migration Guide](#migration-guide)

---

## Overview

The Reptile Tracker scheduling system manages recurring tasks for reptile care, including feeding, misting, weighing, and health checks. The system supports multiple schedule types with flexible rules and automated notifications.

### Key Features

- **Multiple Schedule Modes**: Fixed (calendar-based) and Interval (time-based)
- **Dynamic Instance Generation**: Pre-generates schedule instances for calendar display
- **Quota Tracking**: Informational tracking of feeding counts per period
- **Smart Notifications**: Reminders, warnings, and overdue alerts
- **Flexible Completion**: Allow completing tasks within a time window
- **Auto-completion**: Automatically mark missed tasks as completed
- **Supplement Rotation**: Rotate supplements based on feeding count
- **Dependent Schedules**: Trigger schedules based on other schedule completions

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
├─────────────────────────────────────────────────────────────┤
│  ScheduleForm.jsx    │  Dashboard.jsx   │  Calendar.jsx     │
│  - Schedule creation │  - Today's view  │  - Monthly view   │
│  - Mode selection    │  - Quick actions │  - Event display  │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (FastAPI)                     │
├─────────────────────────────────────────────────────────────┤
│  schedules.py        │  bulk.py         │  quotas.py        │
│  - CRUD operations   │  - Bulk data     │  - Quota status   │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                      │
├─────────────────────────────────────────────────────────────┤
│  instance_generator.py  │  quota_tracker.py  │  scheduler.py│
│  - Generate instances   │  - Track quotas    │  - Send alerts│
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Database (PostgreSQL)                      │
├─────────────────────────────────────────────────────────────┤
│  schedules  │  schedule_instances  │  quota_tracking        │
│  schedule_completions  │  scheduled_notification_jobs       │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Background Jobs (Celery + APScheduler)         │
├─────────────────────────────────────────────────────────────┤
│  - Instance generation (daily)                               │
│  - Notification checks (hourly)                              │
│  - Auto-completion (configurable)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Schedule Modes

### 1. Fixed Schedule Mode

**Purpose**: Calendar-based schedules that occur on specific dates or days.

**Use Cases**:
- Weekly feeding on specific days (e.g., Monday, Wednesday, Friday)
- Monthly weighing on the 1st of each month
- Daily misting at specific times
- Dependent schedules (triggered by parent schedule completion)

**Schedule Rules**:
- `days_of_week`: Repeats on specific days (0=Sunday, 6=Saturday)
- `monthly`: Repeats on a specific day of the month (1-31)
- `every_x_days`: Repeats every N days from a start date
- `dependent`: Triggered by parent schedule completion

**Instance Generation**:
- Pre-generated 7 days in advance
- Daily background job creates new instances

**Example**:
```json
{
  "schedule_mode": "fixed",
  "schedule_rule": "days_of_week",
  "days_of_week": "1,3,5",  // Monday, Wednesday, Friday
  "schedule_type": "feeding"
}
```

---

### 2. Interval Schedule Mode

**Purpose**: Time-based schedules with flexible intervals between events.

**Use Cases**:
- Feeding every 3-4 days (e.g., for ball pythons)
- Misting every 2-3 days for humidity maintenance
- Weighing every 7-14 days for growth tracking

**Configuration**:
- `min_days_between`: Minimum days between events (HARD constraint)
- `max_days_between`: Maximum days between events (HARD constraint)
- `suggested_days`: Optional days of week to prefer for scheduling
- `quota_period`: Grouping period for display tracking (week/month)

**Constraints**:
- **HARD**: `min_days_between` and `max_days_between` are enforced
- **SOFT**: `quota_period` is informational only (no enforcement)

**Instance Generation**:
- Dynamically generated after each completion
- Next instance = `last_completion + min_days_between`
- Adjusted to nearest `suggested_day` if specified

**Example**:
```json
{
  "schedule_mode": "interval",
  "min_days_between": 3,
  "max_days_between": 4,
  "suggested_days": [0, 3],  // Sunday, Wednesday
  "quota_period": "week",
  "schedule_type": "feeding"
}
```

---

## Database Schema

### Core Tables

#### `schedules`

Master table for all schedules.

```sql
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    reptile_id INTEGER NOT NULL REFERENCES reptiles(id),

    -- Basic info
    name VARCHAR,
    schedule_type VARCHAR NOT NULL,  -- feeding, misting, weighing, supplement
    schedule_mode schedule_mode NOT NULL DEFAULT 'fixed',  -- fixed, interval
    schedule_rule VARCHAR NOT NULL,  -- days_of_week, monthly, every_x_days, dependent

    -- Type-specific fields
    food_category VARCHAR,  -- For feeding schedules
    time_slot VARCHAR,      -- For misting schedules
    health_category VARCHAR, -- For weighing schedules
    supplement_id INTEGER REFERENCES supplements(id),

    -- Fixed schedule fields
    frequency_days INTEGER,  -- For every_x_days
    days_of_week VARCHAR,    -- Comma-separated (e.g., "1,3,5")
    day_of_month INTEGER,    -- For monthly (1-31)

    -- Dependent schedule fields
    parent_schedule_id INTEGER REFERENCES schedules(id),
    dependent_rule VARCHAR,     -- every_occurrence, every_nth, specific_days
    dependent_frequency INTEGER, -- For every_nth
    dependent_days VARCHAR,     -- For specific_days

    -- Interval schedule fields
    quota_period quota_period,  -- week, month (informational only)
    min_days_between INTEGER,   -- HARD constraint
    max_days_between INTEGER,   -- HARD constraint
    suggested_days JSON,        -- Array of weekday numbers [0-6]

    -- Time window settings
    earliest_time TIME,
    latest_time TIME,
    time_window_enabled BOOLEAN DEFAULT FALSE,
    reminder_time TIME,

    -- Notification settings
    notifications_enabled BOOLEAN DEFAULT TRUE,

    -- Auto-complete settings
    auto_complete_enabled BOOLEAN DEFAULT FALSE,
    auto_complete_hours_after INTEGER DEFAULT 2,

    -- Flexible completion window
    flexible_completion_enabled BOOLEAN DEFAULT FALSE,
    flexible_completion_days INTEGER DEFAULT 2,

    enabled BOOLEAN DEFAULT TRUE,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `schedule_instances`

Pre-generated occurrences of schedules for calendar display.

```sql
CREATE TABLE schedule_instances (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL REFERENCES schedules(id),
    scheduled_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, completed, missed, skipped

    -- For feeding schedules with supplement rotation
    feeding_sequence_number INTEGER,  -- Nth feeding for this schedule
    supplements JSON,  -- Pre-calculated supplements for this instance

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(schedule_id, scheduled_date)
);
```

#### `schedule_completions`

Tracks completion status of schedule occurrences.

```sql
CREATE TABLE schedule_completions (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL REFERENCES schedules(id),
    instance_id INTEGER REFERENCES schedule_instances(id),
    reptile_id INTEGER NOT NULL REFERENCES reptiles(id),
    scheduled_date DATE NOT NULL,

    -- Completion details
    completed_at TIMESTAMPTZ,
    completion_type completion_type,  -- feeding, misting, weighing, manual
    completion_id INTEGER,  -- ID of the feeding/misting/weighing

    within_time_window BOOLEAN,
    status completion_status NOT NULL,  -- completed_on_time, completed_early, completed_late, missed, pending
    auto_completed BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `quota_tracking`

Tracks quota counts for interval schedules (informational only).

```sql
CREATE TABLE quota_tracking (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL REFERENCES schedules(id),
    reptile_id INTEGER NOT NULL REFERENCES reptiles(id),
    period_start_date DATE NOT NULL,  -- Monday for week, 1st for month
    period_type VARCHAR(10) NOT NULL,  -- week, month

    count INTEGER NOT NULL DEFAULT 0,  -- Completions this period
    last_completion_date DATE,  -- Last completion (for days_since_last)

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(schedule_id, period_start_date)
);
```

#### `scheduled_notification_jobs`

Tracks APScheduler notification jobs.

```sql
CREATE TABLE scheduled_notification_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) UNIQUE NOT NULL,
    job_type VARCHAR(50) NOT NULL DEFAULT 'notification_reminder',  -- notification_reminder, auto_complete
    schedule_id INTEGER NOT NULL REFERENCES schedules(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    channel_id INTEGER NOT NULL REFERENCES notification_channels(id),
    instance_id INTEGER REFERENCES schedule_instances(id),
    scheduled_date DATE NOT NULL,
    scheduled_time_utc TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',  -- pending, sent, failed, cancelled

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Enums

```python
class ScheduleMode(str, Enum):
    FIXED = "fixed"
    INTERVAL = "interval"
    REQUIREMENT = "requirement"  # DEPRECATED (legacy)

class QuotaPeriod(str, Enum):
    WEEK = "week"
    MONTH = "month"

class CompletionStatus(str, Enum):
    COMPLETED_ON_TIME = "completed_on_time"
    COMPLETED_EARLY = "completed_early"
    COMPLETED_LATE = "completed_late"
    MISSED = "missed"
    PENDING = "pending"

class CompletionType(str, Enum):
    FEEDING = "feeding"
    MISTING = "misting"
    WEIGHING = "weighing"
    MANUAL = "manual"
```

---

## Backend Modules

### 1. `instance_generator.py`

**Purpose**: Generates schedule instances for calendar display.

#### Key Functions

##### `generate_instances_for_schedule(schedule, start_date, end_date)`

Generates instances for a specific schedule within a date range.

**Parameters**:
- `schedule`: Schedule object
- `start_date`: Start of date range
- `end_date`: End of date range

**Returns**: List of generated ScheduleInstance objects

**Logic**:
1. For **Fixed schedules**:
   - `days_of_week`: Generate for matching weekdays
   - `monthly`: Generate for matching day of month
   - `every_x_days`: Generate every N days from start
   - `dependent`: Skip (generated on parent completion)

2. For **Interval schedules**:
   - Generate next instance after last completion
   - Apply `min_days_between` constraint
   - Adjust to nearest `suggested_day` if specified

**Example**:
```python
instances = await generate_instances_for_schedule(
    schedule=feeding_schedule,
    start_date=date.today(),
    end_date=date.today() + timedelta(days=7)
)
```

##### `generate_all_instances(start_date, end_date)`

Generates instances for all active schedules.

**Background Job**: Runs daily at 2 AM UTC.

---

### 2. `quota_tracker.py`

**Purpose**: Tracks quota counts for interval schedules (informational only).

#### Key Functions

##### `get_or_create_quota_tracking(db, schedule_id, reptile_id, completion_date, period_type)`

Gets or creates a quota tracking record for a period.

**Parameters**:
- `db`: Database session
- `schedule_id`: Schedule ID
- `reptile_id`: Reptile ID
- `completion_date`: Date to determine period
- `period_type`: "week" or "month"

**Returns**: QuotaTracking object

**Logic**:
- Week starts on Monday (configurable)
- Month starts on 1st

##### `increment_quota(db, schedule_id, reptile_id, completion_date, period_type)`

Increments quota count for a period.

**Side Effects**:
- Increments `count`
- Updates `last_completion_date`

##### `check_quota_status(db, schedule, reptile_id, current_date)`

Checks current quota status for an interval schedule.

**Returns**:
```python
{
    "count": 3,                          # Completions this period
    "period_type": "week",               # week or month
    "last_completion_date": date(2025, 12, 5),
    "days_since_last": 2,                # Days since last completion
    "period_start_date": date(2025, 12, 2),  # Monday
    "period_end_date": date(2025, 12, 8)     # Sunday
}
```

**Note**: No enforcement - purely informational!

##### `validate_min_days_between(db, schedule, reptile_id, completion_date)`

Validates minimum days constraint (HARD constraint).

**Returns**: `(is_valid: bool, error_message: str|None)`

**Example**:
```python
is_valid, error = await validate_min_days_between(
    db, schedule, reptile_id, date.today()
)
if not is_valid:
    raise HTTPException(status_code=400, detail=error)
```

##### `get_interval_schedules_for_feeding(db, reptile_id, food_category)`

Gets all interval schedules matching a feeding.

**Parameters**:
- `db`: Database session
- `reptile_id`: Reptile ID
- `food_category`: Optional food category filter

**Returns**: List of Schedule objects

##### `process_feeding_for_interval_schedules(db, reptile_id, feeding_date, food_category)`

Processes a feeding against all matching interval schedules.

**Returns**:
```python
[
    {
        "schedule_id": 1,
        "schedule_name": "Ball Python Feeding",
        "success": True,
        "quota_status": {...}
    },
    {
        "schedule_id": 2,
        "schedule_name": "Weekly Feeding",
        "success": False,
        "error": "Feeding too soon. Minimum 3 days required..."
    }
]
```

---

### 3. `scheduler.py`

**Purpose**: Background job scheduler for notifications and auto-completion.

#### Background Jobs

##### `check_scheduled_notifications()`

Checks for scheduled notification reminders.

**Schedule**: Every 5 minutes
**Logic**:
1. Get pending notification jobs for next 10 minutes
2. Send notifications via configured channels
3. Mark jobs as sent

##### `check_overdue_schedules()`

Checks for overdue schedule instances.

**Schedule**: Every hour
**Logic**:
1. Find instances past `latest_time` + grace period
2. Send overdue notifications
3. Respect quiet hours settings

##### `check_interval_schedule_notifications()`

Checks interval schedules for max_days warnings.

**Schedule**: Daily at 10 AM UTC
**Logic**:
1. Get all enabled interval schedules
2. Check `days_since_last` against `max_days_between`
3. Send warnings:
   - `max_days_approaching`: 1 day before max
   - `max_days_exceeded`: At or past max

**Note**: Only temporal warnings - no quota enforcement!

##### `check_auto_complete_schedules()`

Auto-completes missed schedule instances.

**Schedule**: Every hour
**Logic**:
1. Find instances past auto-completion threshold
2. Mark as completed with `auto_completed=True`
3. Create completion records

##### `daily_notification_maintenance()`

Schedules notification jobs for upcoming instances.

**Schedule**: Daily at 2 AM UTC
**Logic**:
1. Find instances in next 7 days with reminders
2. Create APScheduler jobs for each
3. Clean up old/cancelled jobs

#### Notification Functions

##### `send_interval_warning_notification(db, reptile, schedule, warning_type, quota_status)`

Sends max_days warning for interval schedules.

**Warning Types**:
- `max_days_approaching`: 1 day before max_days_between
- `max_days_exceeded`: At or exceeded max_days_between

**Template Variables**:
```python
{
    "reptile_name": reptile.name,
    "schedule_name": schedule.name,
    "schedule_type": schedule.schedule_type,
    "days_since_last": quota_status["days_since_last"],
    "max_days_between": schedule.max_days_between,
    "days_remaining": schedule.max_days_between - quota_status["days_since_last"]
}
```

---

### 4. `schedule_matcher.py`

**Purpose**: Matches logged activities to schedule instances.

#### Key Functions

##### `assign_feeding_to_schedule(db, feeding)`

Attempts to match a feeding to a schedule instance.

**Logic**:
1. Find instances within flexible completion window
2. Prioritize exact date matches
3. Check if already completed
4. Create completion record

**Returns**: Matched ScheduleInstance or None

---

## Frontend Components

### 1. `ScheduleForm.jsx`

**Purpose**: Create and edit schedules.

#### Component Structure

```jsx
<ScheduleForm>
  {/* Mode Selection */}
  <ScheduleModeSelector mode={scheduleMode} onChange={setScheduleMode} />

  {/* Fixed Mode Fields */}
  {scheduleMode === 'fixed' && (
    <FixedScheduleFields
      scheduleRule={scheduleRule}
      onRuleChange={setScheduleRule}
    />
  )}

  {/* Interval Mode Fields */}
  {scheduleMode === 'interval' && (
    <IntervalScheduleFields
      minDays={minDaysBetween}
      maxDays={maxDaysBetween}
      suggestedDays={suggestedDays}
      quotaPeriod={quotaPeriod}
    />
  )}

  {/* Common Fields */}
  <TimeWindowSettings />
  <NotificationSettings />
  <AutoCompleteSettings />
</ScheduleForm>
```

#### Schedule Mode Selector

```jsx
<div className="grid grid-cols-2 gap-4">
  <button
    onClick={() => setScheduleMode('fixed')}
    className={scheduleMode === 'fixed' ? 'active' : ''}
  >
    <div>Fixed</div>
    <div>Specific dates/days</div>
  </button>

  <button
    onClick={() => setScheduleMode('interval')}
    className={scheduleMode === 'interval' ? 'active' : ''}
  >
    <div>Interval</div>
    <div>Time-based intervals</div>
  </button>
</div>
```

#### Interval Mode Fields

```jsx
{scheduleMode === 'interval' && (
  <>
    {/* Min/Max Days */}
    <div className="grid grid-cols-2 gap-4">
      <input
        type="number"
        label="Min Days Between"
        value={minDaysBetween}
        min="1"
        required
      />
      <input
        type="number"
        label="Max Days Between"
        value={maxDaysBetween}
        min={minDaysBetween}
        required
      />
    </div>

    {/* Period Tracking */}
    <select label="Period Tracking" value={quotaPeriod}>
      <option value="week">Week</option>
      <option value="month">Month</option>
    </select>

    {/* Suggested Days */}
    <DaySelector
      selectedDays={suggestedDays}
      onToggle={toggleSuggestedDay}
    />
  </>
)}
```

---

### 2. `Dashboard.jsx`

**Purpose**: Today's schedule view with quick actions.

#### Quota Badge Component

```jsx
const getQuotaBadge = (scheduleId, format = 'compact') => {
  const quotaStatus = quotaStatuses[scheduleId];
  if (!quotaStatus) return null;

  const { count, period_type } = quotaStatus;
  const periodLabel = format === 'full'
    ? (period_type === 'week' ? 'this week' : 'this month')
    : (period_type === 'week' ? 'wk' : 'mo');

  // Simple informational badge (no enforcement colors)
  return {
    text: format === 'full'
      ? `${count} ${periodLabel}`
      : `${count}/${periodLabel}`,
    className: 'bg-gray-100 text-gray-700'  // Neutral gray
  };
};
```

#### Event Display

```jsx
{event.schedule_mode === 'interval' && (() => {
  const quotaBadge = getQuotaBadge(event.schedule_id);
  return quotaBadge ? (
    <span className={quotaBadge.className}>
      {quotaBadge.text}
    </span>
  ) : null;
})()}
```

---

### 3. `Calendar.jsx`

**Purpose**: Monthly calendar view of all schedules.

#### Schedule Display

For interval schedules:
```jsx
{schedule.schedule_mode === 'interval' && (
  <>
    Interval-based
    {schedule.min_days_between && schedule.max_days_between && (
      <span>
        • Every {schedule.min_days_between}-{schedule.max_days_between} days
      </span>
    )}
  </>
)}
```

---

## API Endpoints

### Schedule Management

#### `POST /schedules`

Create a new schedule.

**Request Body**:
```json
{
  "reptile_id": 1,
  "schedule_type": "feeding",
  "schedule_mode": "interval",
  "name": "Ball Python Feeding",

  "min_days_between": 3,
  "max_days_between": 4,
  "suggested_days": [0, 3],
  "quota_period": "week",

  "notifications_enabled": true,
  "channel_ids": [1, 2]
}
```

**Response**: Created schedule object

#### `GET /schedules/{schedule_id}`

Get schedule details.

#### `PUT /schedules/{schedule_id}`

Update schedule.

#### `DELETE /schedules/{schedule_id}`

Delete schedule (soft delete - sets enabled=False).

---

### Quota Tracking

#### `GET /quotas/reptile/{reptile_id}/quota-status`

Get quota status for all interval schedules.

**Query Parameters**:
- `current_date`: Optional date (defaults to today)

**Response**:
```json
[
  {
    "schedule_id": 1,
    "schedule_name": "Ball Python Feeding",
    "quota_status": {
      "count": 2,
      "period_type": "week",
      "days_since_last": 3,
      "last_completion_date": "2025-12-04",
      "period_start_date": "2025-12-02",
      "period_end_date": "2025-12-08"
    }
  }
]
```

#### `POST /quotas/validate-feeding`

Validate feeding against interval schedules.

**Request Body**:
```json
{
  "reptile_id": 1,
  "food_category": "insects",
  "feeding_date": "2025-12-07"
}
```

**Response**:
```json
{
  "results": [
    {
      "schedule_id": 1,
      "schedule_name": "Weekly Feeding",
      "is_valid": true,
      "quota_status": {...}
    },
    {
      "schedule_id": 2,
      "schedule_name": "Every 3 Days",
      "is_valid": false,
      "error": "Feeding too soon. Minimum 3 days required (last: 2 days ago)"
    }
  ],
  "has_errors": true,
  "has_warnings": false
}
```

---

### Bulk Data

#### `GET /bulk`

Get all data for dashboard (reptiles, schedules, instances, quota statuses).

**Response**:
```json
{
  "reptiles": [...],
  "schedules": [...],
  "instances": [...],
  "quota_statuses": {
    "1": {
      "count": 2,
      "period_type": "week",
      "days_since_last": 3
    }
  }
}
```

---

## Notification System

### Notification Types

#### 1. Schedule Reminder

Sent at `reminder_time` before scheduled event.

**Template Variables**:
```python
{
    "reptile_name": "Monty",
    "schedule_name": "Evening Feeding",
    "schedule_type": "feeding",
    "scheduled_date": "2025-12-07",
    "scheduled_time": "18:00"
}
```

#### 2. Overdue Alert

Sent when instance is past `latest_time` + grace period.

**Template Variables**:
```python
{
    "reptile_name": "Monty",
    "schedule_name": "Evening Feeding",
    "schedule_type": "feeding",
    "scheduled_date": "2025-12-07",
    "hours_overdue": 2
}
```

#### 3. Max Days Approaching

Sent 1 day before `max_days_between` (interval schedules only).

**Template Variables**:
```python
{
    "reptile_name": "Monty",
    "schedule_name": "Ball Python Feeding",
    "schedule_type": "feeding",
    "days_since_last": 3,
    "max_days_between": 4,
    "days_remaining": 1
}
```

#### 4. Max Days Exceeded

Sent when `days_since_last >= max_days_between` (interval schedules only).

**Template Variables**:
```python
{
    "reptile_name": "Monty",
    "schedule_name": "Ball Python Feeding",
    "schedule_type": "feeding",
    "days_since_last": 5,
    "max_days_between": 4,
    "days_overdue": 1
}
```

### Notification Channels

- Discord webhook
- NTFY push notification
- Apprise (multi-service)
- Email (future)

### Quiet Hours

Notifications respect user-configured quiet hours (e.g., 10 PM - 7 AM).

---

## Examples & Use Cases

### Example 1: Ball Python Feeding (Interval)

Adult ball python fed every 7-10 days.

```json
{
  "schedule_mode": "interval",
  "schedule_type": "feeding",
  "name": "Adult BP Feeding",
  "min_days_between": 7,
  "max_days_between": 10,
  "suggested_days": [0],  // Sundays preferred
  "quota_period": "month",
  "food_category": "frozen"
}
```

**Behavior**:
- After feeding on Sunday 12/1, next instance on Sunday 12/8 (7 days)
- Notification on Saturday 12/14 (approaching max)
- Alert on Monday 12/16 if not completed (exceeded max)

---

### Example 2: Bearded Dragon Feeding (Fixed)

Juvenile bearded dragon fed daily.

```json
{
  "schedule_mode": "fixed",
  "schedule_rule": "days_of_week",
  "days_of_week": "0,1,2,3,4,5,6",  // Every day
  "schedule_type": "feeding",
  "name": "Daily Feeding",
  "earliest_time": "10:00",
  "latest_time": "20:00",
  "reminder_time": "18:00"
}
```

**Behavior**:
- Instance every day at 10 AM - 8 PM window
- Reminder at 6 PM
- Overdue alert if not completed by 10 PM

---

### Example 3: Weekly Weighing (Fixed)

Weekly weight check every Monday.

```json
{
  "schedule_mode": "fixed",
  "schedule_rule": "days_of_week",
  "days_of_week": "1",  // Monday
  "schedule_type": "weighing",
  "name": "Weekly Weigh-In",
  "health_category": "weight_check"
}
```

---

### Example 4: Dependent Schedule (Fixed)

Weigh reptile after every 3rd feeding.

```json
{
  "schedule_mode": "fixed",
  "schedule_rule": "dependent",
  "parent_schedule_id": 1,  // Feeding schedule
  "dependent_rule": "every_nth",
  "dependent_frequency": 3,
  "schedule_type": "weighing",
  "name": "Post-Feeding Weight"
}
```

**Behavior**:
- Instance created after every 3rd feeding completion
- Inherits date from parent completion

---

## Migration Guide

### Migrating from Requirement to Interval (v1 → v2)

#### Database Migration

Migration `0067_refactor_requirement_to_interval.py`:

1. Adds `interval` enum value to `schedule_mode`
2. Migrates all `requirement` → `interval`
3. Drops `quota_frequency` column
4. Keeps `quota_period` for display grouping

```python
# Run migration
alembic upgrade head
```

#### Code Changes

**Before** (Requirement):
```python
schedule = Schedule(
    schedule_mode=ScheduleMode.REQUIREMENT,
    quota_period=QuotaPeriod.WEEK,
    quota_frequency=2,  # 2x per week (ENFORCED)
    min_days_between=2,
    max_days_between=4
)
```

**After** (Interval):
```python
schedule = Schedule(
    schedule_mode=ScheduleMode.INTERVAL,
    quota_period=QuotaPeriod.WEEK,  # Informational only
    min_days_between=2,  # HARD constraint
    max_days_between=4   # HARD constraint
)
```

#### Key Differences

| Aspect | Requirement (v1) | Interval (v2) |
|--------|------------------|---------------|
| **Enforcement** | `quota_frequency` enforced | Only `min/max_days` enforced |
| **Quota Colors** | Green/Orange/Blue badges | Gray badges (neutral) |
| **Warnings** | 4 types (period ending, quota exceeded, max days) | 2 types (max days only) |
| **Philosophy** | Quota-based with time constraints | Time-based with optional tracking |

#### Breaking Changes

1. **`quota_frequency` removed** from database and API
2. **Quota enforcement removed** - no more "quota met" validation
3. **Badge colors changed** - all neutral gray
4. **Warning types reduced** - removed period/quota warnings

#### Frontend Updates

**Schedule Form**:
- Removed "Feedings Per Week/Month" field
- Added "Period Tracking" (informational)
- Updated help text to clarify HARD constraints

**Dashboard**:
- Simplified badge to show count only
- Removed green/orange color coding
- Updated quota status display

---

## Troubleshooting

### Common Issues

#### 1. Instance Not Generated

**Symptoms**: Schedule exists but no instances in calendar

**Causes**:
- Schedule `enabled = False`
- Schedule mode/rule misconfigured
- Background job not running

**Fix**:
```python
# Manually trigger instance generation
await generate_instances_for_schedule(schedule, start_date, end_date)
```

#### 2. Notifications Not Sent

**Symptoms**: Reminder time passed but no notification

**Causes**:
- `notifications_enabled = False` on schedule
- No notification channels configured
- APScheduler job not created
- Quiet hours active

**Fix**:
1. Check schedule settings
2. Verify notification channels exist
3. Check `scheduled_notification_jobs` table
4. Review quiet hours settings

#### 3. Feeding Validation Fails

**Symptoms**: "Feeding too soon" error on interval schedule

**Cause**: `min_days_between` constraint violated

**Fix**:
```python
# Check last feeding
quota_status = await check_quota_status(db, schedule, reptile_id, today)
print(f"Days since last: {quota_status['days_since_last']}")
print(f"Min required: {schedule.min_days_between}")
```

#### 4. Quota Count Incorrect

**Symptoms**: Badge shows wrong count

**Causes**:
- Period boundary calculation error
- Missed completion tracking
- First day of week misconfigured

**Fix**:
```python
# Recalculate quota tracking
await increment_quota(db, schedule_id, reptile_id, completion_date, period_type)
```

---

## Performance Considerations

### Database Indexes

```sql
CREATE INDEX idx_schedules_reptile ON schedules(reptile_id);
CREATE INDEX idx_schedules_mode ON schedules(schedule_mode);
CREATE INDEX idx_instances_schedule_date ON schedule_instances(schedule_id, scheduled_date);
CREATE INDEX idx_instances_status ON schedule_instances(status);
CREATE INDEX idx_completions_schedule ON schedule_completions(schedule_id);
CREATE INDEX idx_quota_schedule_period ON quota_tracking(schedule_id, period_start_date);
```

### Query Optimization

**Bulk Data Loading**:
```python
# Use selectinload for relationships
schedules = await db.execute(
    select(Schedule)
    .options(
        selectinload(Schedule.notification_channels),
        selectinload(Schedule.reptile)
    )
)
```

**Instance Generation**:
- Generates only 7 days ahead (configurable)
- Batches database writes
- Skips dependent schedules

---

## Future Enhancements

### Planned Features

1. **Smart Scheduling**
   - ML-based optimal feeding time suggestions
   - Historical pattern analysis

2. **Multi-Reptile Schedules**
   - Group schedules for multiple reptiles
   - Batch feeding tracking

3. **Advanced Notifications**
   - Email support
   - SMS via Twilio
   - Mobile app push

4. **Schedule Templates**
   - Community-shared templates
   - Species-specific presets

5. **Calendar Integration**
   - iCal export
   - Google Calendar sync

---

## Contributing

When modifying the scheduling system:

1. **Update this documentation** with any changes
2. **Write tests** for new functionality
3. **Create migration** for schema changes
4. **Update frontend** components accordingly
5. **Test notifications** thoroughly

---

## Support

For questions or issues:
- GitHub Issues: https://github.com/your-repo/issues
- Discord: [Your Discord]
- Email: support@example.com

---

**Last Updated**: 2025-12-07
**Version**: 2.0
**Authors**: Development Team
