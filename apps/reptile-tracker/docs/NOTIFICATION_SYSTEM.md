# Reptile Tracker Notification System Documentation

## Overview

The Reptile Tracker notification system provides customizable, multi-channel notifications for schedule reminders, overdue alerts, and other events. The system is designed to be flexible, allowing users to customize notification content, delivery channels, and timing.

## Architecture

### Core Components

1. **Notification Templates** (`NotificationTemplate` model)
   - Customizable message templates with variable substitution
   - System-wide defaults and user-specific overrides
   - Per-channel type customization (Discord, Pushover, generic, in-app)

2. **Notification Channels** (`NotificationChannel` model)
   - Delivery endpoints (Discord webhooks, Pushover API, in-app)
   - Per-user channel configuration with enable/disable controls
   - Association with schedules (many-to-many relationship)

3. **Notification Settings** (`NotificationSettings` model)
   - User preferences for notification types
   - Quiet hours configuration
   - Global enable/disable switches per notification type

4. **Scheduler** (`app/scheduler.py`)
   - APScheduler-based cron jobs for periodic checks
   - Two notification delivery modes:
     - **Exact-time notifications**: Database-persisted jobs scheduled at specific times
     - **Polling-based**: Legacy system using `reminder_minutes_before`

5. **Notification Sender** (`app/notifications.py`)
   - Webhook delivery (Discord, Pushover, generic HTTP)
   - Template rendering with context substitution
   - Discord rich embed formatting
   - SSRF protection for webhook URLs

## Notification Flow

### 1. Template Resolution

When a notification needs to be sent, the system uses a **priority-based matching algorithm** to select the most specific template:

```python
# Get the best matching template for this trigger
template = await get_template_for_trigger(
    db=db,
    trigger_type="schedule_reminder",  # or other trigger types
    user_id=user.id,
    channel_type=webhook_type,  # "discord", "pushover", etc.
    context={  # NEW: Context for matching filters
        "reptile_id": 123,
        "schedule_id": 456,
        "schedule_type": "feeding",
        "food_category": "insects"
    }
)
```

**Template Matching Priority** (highest to lowest specificity):
1. **User templates** always take priority over system templates
2. **Schedule-specific** templates (template has `schedule_id` matching the notification)
3. **Reptile-specific** templates (template has `reptile_id` matching the notification)
4. **Food category filter** (template has `food_category_filter` matching the schedule)
5. **Schedule type filter** (template has `schedule_type_filter` matching the schedule)
6. **Generic templates** (no filters applied)
7. Within the same specificity level, **lower `priority` number wins** (default: 100)

**Example Scenarios:**
- Notification for "Luna's Morning Feeding":
  - If template exists with `schedule_id=456` → **Uses this (most specific)**
  - Else if template exists with `reptile_id=123` → **Uses this**
  - Else if template exists with `schedule_type_filter="feeding"` → **Uses this**
  - Else if generic user template exists → **Uses this**
  - Else uses system default template

This allows users to create:
- Ultra-specific templates for individual schedules (e.g., "Luna's urgent morning reminder")
- Reptile-specific templates (e.g., "All notifications for Spike use formal tone")
- Type-specific templates (e.g., "All feeding reminders are extra detailed")
- Generic fallback templates

### 2. Context Building

Build a context dictionary with all available variables:

```python
context = {
    "reptile_name": "Spike",
    "schedule_name": "Morning Feeding",
    "schedule_type": "feeding",
    "scheduled_date": "2025-12-06",
    "food_category": "Insects/Worms",
    "time_window_display": "08:00 - 10:00",
    "schedule_url": "/schedules/123",
    # ... more variables
}
```

### 3. Template Rendering

Substitute variables in template strings:

```python
if template:
    message = render_template(template.message_template, context)
    title = render_template(template.title_template, context)
else:
    # Fallback to hardcoded message
    message = f"Reminder: {schedule_name} for {reptile_name}"
    title = f"Schedule Reminder - {reptile_name}"
```

### 4. Notification Delivery

Send to webhook or API:

```python
await send_webhook_notification(
    webhook_url=channel.webhook_url,
    webhook_type=channel.webhook_type,  # "discord", "pushover", "generic"
    message=message,
    title=title,
    config=channel.config,  # Pushover settings, etc.
    context=context,  # For Discord rich embeds
    trigger_type="schedule_reminder",
    template=template  # For Discord discord_config
)
```

### 5. In-App Notification

Create in-app notification record:

```python
await create_in_app_notification(
    db=db,
    user=user,
    notification_type=NotificationType.SCHEDULE_REMINDER,
    title=title,
    message=message,
    link=schedule_url,
    notification_metadata={...}
)
```

## Trigger Types

Current trigger types in the system:

### Core Triggers

1. **`schedule_reminder`**
   - Sent when a schedule is due (based on `reminder_time` or `reminder_minutes_before`)
   - Used for fixed-schedule reminders
   - Also used for requirement-based quota warnings (max_days warnings, period reminders)

2. **`overdue_alert`**
   - Sent when a schedule instance was not completed on time
   - Runs daily at 1 AM UTC via `check_overdue_schedules()`

3. **`feeding_logged`**
   - (Not currently implemented in scheduler)
   - Placeholder for feeding completion notifications

### Requirement Schedule Triggers

Requirement-based schedules use `schedule_reminder` trigger type with different warning types in metadata:

- **`max_days_approaching`**: Approaching maximum days between feedings
- **`max_days_exceeded`**: Exceeded maximum days between feedings
- **`period_ending_soon`**: Period ending soon with quota not met
- **`quota_exceeded`**: Fed more than quota frequency this period

## Available Template Variables

### Common Variables (All Triggers)

| Variable | Description | Example |
|----------|-------------|---------|
| `{reptile_name}` | Name of the reptile | "Spike" |
| `{schedule_name}` | Name of the schedule | "Morning Feeding" |
| `{schedule_type}` | Type of schedule | "feeding", "misting", "weighing" |
| `{schedule_url}` | Relative URL to schedule | "/schedules/123" |
| `{schedule_id}` | ID of the schedule | 123 |
| `{emoji}` | Schedule type emoji | "🍽️", "💧", "⚖️" |

### Schedule Reminder Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{scheduled_date}` | Date the schedule is due | "2025-12-06" |
| `{due_date}` | Alias for scheduled_date | "2025-12-06" |
| `{time_window}` | Full time window text | "\\nTime window: 08:00 - 10:00" |
| `{time_window_display}` | Just the time range | "08:00 - 10:00" |
| `{notes}` | Schedule notes | "\\nNotes: Give extra calcium" |
| `{food_category}` | Food category display name | "Insects/Worms" |
| `{supplement_name}` | Supplement name(s) | "Calcium D3, Multivitamin" |

### Overdue Alert Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{missed_date}` | Date the schedule was missed | "2025-12-05" |
| `{food_category}` | (if feeding schedule) | "Insects/Worms" |
| `{supplement_name}` | (if supplement schedule) | "Calcium D3" |

### Quota Warning Variables (Requirement Schedules)

| Variable | Description | Example |
|----------|-------------|---------|
| `{quota_count}` | Current feeding count | 2 |
| `{quota_frequency}` | Target feeding frequency | 3 |
| `{period_type}` | Period type | "week", "month" |
| `{days_since_last}` | Days since last feeding | 5 |
| `{max_days_between}` | Maximum days allowed | 7 |
| `{warning_type}` | Type of quota warning | "max_days_approaching" |

## Template Examples

### Schedule Reminder Template

```
{emoji} **Reminder:** {schedule_name} for **{reptile_name}**{time_window}{notes}
```

Renders to:
```
🍽️ **Reminder:** Morning Feeding for **Spike**
Time window: 08:00 - 10:00
Notes: Give extra calcium
```

### Overdue Alert Template

```
⚠️ **Overdue Alert:** {schedule_name} for **{reptile_name}** was not completed on {missed_date}
```

### Quota Warning Templates

Requirement-based schedules send notifications using the same `schedule_reminder` trigger type but with additional quota-specific variables in the context. Templates can use the `{warning_type}` variable to differentiate between different quota scenarios.

**Max Days Approaching:**
```
⏰ **Reminder:** It's been {days_since_last} days since you fed **{reptile_name}**.
The maximum time between feedings is {max_days_between} days.
```

**Max Days Exceeded:**
```
⚠️ **Alert:** It's been {days_since_last} days since you fed **{reptile_name}**!
The maximum time between feedings is {max_days_between} days. Please feed soon.
```

**Period Ending Soon (Quota Not Met):**
```
📊 **Reminder:** **{reptile_name}** still needs {remaining_feedings} more feeding(s) {period_label}.
Current progress: {quota_count}/{quota_frequency}
```

**Quota Exceeded:**
```
⚠️ **Notice:** **{reptile_name}** has been fed {quota_count} times {period_label}.
Target quota: {quota_frequency} times {period_label}
```

**Advanced: Conditional Template Based on Warning Type**

Users can create a single template that handles all quota warning types:

```
{emoji} **{reptile_name}** Quota Status

{schedule_name} - {schedule_type}

Days since last: {days_since_last}
Current count: {quota_count}/{quota_frequency} {period_label}
Max days between: {max_days_between}

Warning: {warning_type}
```

## Discord Rich Embed Configuration

Templates can include `discord_config` JSON for rich embeds:

```json
{
  "color": 3447003,
  "footer_text": "Reptile Tracker",
  "include_fields": [
    "scheduled_date",
    "schedule_type",
    "food_category",
    "time_window",
    "notes",
    "schedule_link"
  ],
  "link_text": "View Schedule",
  "link_label": "View Details"
}
```

### Color Codes

- Blue (`3447003`): Schedule reminders
- Red (`15158332`): Overdue alerts
- Green (`3066993`): Feeding logged
- Teal (`5814783`): Default

### Available Fields

| Field Name | Description | Inline |
|------------|-------------|--------|
| `scheduled_date` | Due Date | Yes |
| `schedule_type` | Schedule Type | Yes |
| `food_category` | Food (with supplement) | Yes |
| `time_window` | Time Window | Yes |
| `notes` | Notes | No |
| `missed_date` | Missed Date | Yes |
| `schedule_link` | Clickable link to schedule | No |

## Requirement-Based Schedules Integration

### Overview

Requirement-based schedules (introduced in migration 0063) provide flexible quota-based scheduling instead of rigid fixed schedules. For example: "Feed 2x per week with 2+ days between" or "Feed 4x per month with 5+ days between".

These schedules integrate fully with the notification template system, reusing the `schedule_reminder` trigger type with additional quota-specific context variables.

### How It Works

1. **Quota Tracking**: The `quota_tracker.py` module tracks feeding counts per period (weekly or monthly)
2. **Daily Check**: The `check_requirement_schedule_notifications()` job runs daily at 10 AM UTC
3. **Condition Detection**: Checks for 4 quota warning conditions:
   - **Max days approaching**: 1 day before `max_days_between` limit
   - **Max days exceeded**: Reached or exceeded `max_days_between`
   - **Period ending soon**: 1 day before period ends with quota not met
   - **Quota exceeded**: Fed more than `quota_frequency` this period

4. **Template Resolution**: Uses `get_template_for_trigger()` with `schedule_reminder` trigger type
5. **Context Building**: Passes quota-specific variables (`quota_count`, `days_since_last`, etc.)
6. **Notification Delivery**: Sends via configured channels (Discord, Pushover, in-app)

### Template Customization

Users can customize quota notifications in two ways:

#### Option 1: Single Template for All Warnings

Create one custom `schedule_reminder` template that uses quota variables when available:

```
{emoji} **Reminder: {schedule_name}**

Reptile: **{reptile_name}**

{#- Fixed schedule info -#}
{scheduled_date}
{time_window}

{#- Quota schedule info -#}
Days since last: {days_since_last}
Quota: {quota_count}/{quota_frequency} {period_label}
Max between: {max_days_between} days

{notes}
```

Variables not present in the context (e.g., `{scheduled_date}` for requirement schedules, or `{quota_count}` for fixed schedules) are rendered as empty strings, so the template works for both types.

#### Option 2: Create Separate Templates (Advanced)

Currently not supported (would require adding new trigger types like `quota_warning_max_days`, `quota_warning_period_ending`, etc.), but users can still differentiate using the `{warning_type}` variable in a single template.

### Example Notification Flow

```python
# Daily at 10 AM UTC: check_requirement_schedule_notifications()

for schedule in requirement_schedules:
    quota_status = await check_quota_status(db, schedule, reptile_id, today)

    # Check max_days_between
    if days_since_last == max_days_between - 1:
        await send_quota_warning_notification(
            db, reptile, schedule,
            warning_type="max_days_approaching",
            quota_status=quota_status
        )

# send_quota_warning_notification():
#   1. Builds context with quota variables
#   2. Gets template via get_template_for_trigger(trigger_type="schedule_reminder")
#   3. Renders template with quota context
#   4. Sends via webhooks and creates in-app notification
```

### Available Quota Variables

See "Quota Warning Variables (Requirement Schedules)" section for full list. Key variables:

- `{quota_count}`: Current feedings this period
- `{quota_frequency}`: Target feedings per period
- `{period_type}`: "week" or "month"
- `{period_label}`: "this week" or "this month"
- `{days_since_last}`: Days since last feeding
- `{max_days_between}`: Maximum allowed days between feedings
- `{remaining_feedings}`: Feedings needed to meet quota (for period_ending_soon)
- `{warning_type}`: Type of quota warning

### Migration and Upgrades

- **Migration 0063**: Added requirement schedule fields (schedule_mode, quota_period, quota_frequency, min_days_between, max_days_between)
- **Migration 0064**: Added quota_tracking table for period-based counting
- **Migration 0065**: Added example system templates demonstrating quota variables (disabled by default)

Example templates in the database:
- "Quota Warning - Max Days (Example)"
- "Quota Warning - Period Ending (Example)"
- "Quota Warning - Exceeded (Example)"

Users can copy these templates and activate them or create their own from scratch.

## Scheduler Jobs

### Cron Jobs (APScheduler)

| Job ID | Frequency | Function | Purpose |
|--------|-----------|----------|---------|
| `create_completions` | Daily 00:05 UTC | `create_pending_completions()` | Create pending completion records |
| `check_reminders` | Every 5 min | `check_schedule_reminders()` | Legacy polling for `reminder_minutes_before` |
| `check_overdue` | Daily 01:00 UTC | `check_overdue_schedules()` | Check for missed schedules |
| `check_requirement_notifications` | Daily 10:00 UTC | `check_requirement_schedule_notifications()` | Check quota warnings |
| `daily_maintenance` | Daily 02:00 UTC | `daily_notification_maintenance()` | Schedule jobs, cleanup old records |
| `daily_instance_maintenance` | Daily 03:00 UTC | `daily_instance_maintenance()` | Generate instances, autocomplete jobs |

### Exact-Time Notification Jobs

For schedules with `reminder_time` set:

1. **Daily maintenance** creates `ScheduledNotificationJob` records for next 7 days
2. **APScheduler** creates one-time jobs at exact `reminder_time` (in user's timezone)
3. **Job execution** queues notification to Celery or sends directly (fallback)
4. **On startup**, `rebuild_notification_jobs_from_db()` recovers pending jobs

## Quiet Hours

Quiet hours prevent non-critical notifications during specified time windows:

```python
# In NotificationSettings model
quiet_hours_enabled: bool
quiet_hours_start: time  # e.g., 22:00
quiet_hours_end: time    # e.g., 08:00
```

**Critical notifications** (bypass quiet hours):
- `NotificationType.HEALTH_EVENT`
- `NotificationType.SYSTEM`

**Non-critical** (respect quiet hours):
- `NotificationType.SCHEDULE_REMINDER`
- `NotificationType.OVERDUE_ALERT`

## User Access & Permissions

All notifications check user access before sending:

```python
from app.permissions import check_reptile_access

try:
    await check_reptile_access(db, user, reptile.id)
except:
    # User doesn't have access, skip notification
    continue
```

## Adding a New Trigger Type

### 1. Define the Trigger Type

Add to trigger type constants (or use existing like `schedule_reminder`):

```python
TRIGGER_TYPE_NEW_FEATURE = "new_feature_reminder"
```

### 2. Create System Template (Migration)

Create a migration to insert default system templates:

```python
op.execute("""
    INSERT INTO notification_templates
    (user_id, name, template_type, trigger_type, message_template, title_template,
     is_active, reptile_id, schedule_id, schedule_type_filter, food_category_filter, priority)
    VALUES
    (NULL, 'New Feature Reminder', 'system', 'new_feature_reminder',
     '{emoji} **{reptile_name}** needs attention for {feature_name}!',
     'New Feature Reminder - {reptile_name}',
     true, NULL, NULL, NULL, NULL, 100)
""")
```

**Note**: The new filter fields (`reptile_id`, `schedule_id`, `schedule_type_filter`, `food_category_filter`, `priority`) are typically NULL for generic system templates. Set them only when creating specific templates.

### 3. Implement Notification Sender Function

```python
async def send_new_feature_notification(
    db: AsyncSession,
    reptile: Reptile,
    user: User,
    webhook_url: str,
    webhook_type: str,
    config: dict = None
):
    """Send new feature notification"""

    # Build context for template matching and rendering
    context = {
        "reptile_id": reptile.id,  # For template matching
        "reptile_name": reptile.name,
        "feature_name": "Example Feature",
        "emoji": "🔔",
        # ... more variables
    }

    # Get template with context for matching
    template = await get_template_for_trigger(
        db=db,
        trigger_type="new_feature_reminder",
        user_id=user.id,
        channel_type=webhook_type,
        context=context  # NEW: Pass context for filter matching
    )

    # Render template or use fallback
    if template:
        message = render_template(template.message_template, context)
        title = render_template(template.title_template, context)
    else:
        # Fallback
        message = f"🔔 {reptile.name} needs attention!"
        title = f"New Feature Reminder - {reptile.name}"

    # Send notification
    await send_webhook_notification(
        webhook_url=webhook_url,
        webhook_type=webhook_type,
        message=message,
        title=title,
        config=config,
        context=context,
        trigger_type="new_feature_reminder",
        template=template
    )

    # Create in-app notification
    await create_in_app_notification(
        db=db,
        user=user,
        notification_type=NotificationType.SCHEDULE_REMINDER,  # Or create new enum
        title=title,
        message=message,
        link=f"/reptiles/{reptile.id}",
        notification_metadata={
            "reptile_id": reptile.id,
            "feature_name": "Example Feature"
        }
    )
```

### 4. Call from Scheduler

Add a cron job or integrate into existing checks:

```python
async def check_new_feature():
    """Check for new feature conditions"""
    async with async_session_maker() as db:
        # ... query logic

        for item in items:
            # ... get channels, check quiet hours, etc.

            await send_new_feature_notification(
                db=db,
                reptile=reptile,
                user=user,
                webhook_url=channel.webhook_url,
                webhook_type=channel.webhook_type,
                config=channel.config
            )

# In start_scheduler()
scheduler.add_job(
    check_new_feature,
    trigger="cron",
    hour=9,
    minute=0,
    id="check_new_feature",
    name="Check new feature conditions"
)
```

## Security

### SSRF Protection

All webhook URLs are validated to prevent Server-Side Request Forgery attacks:

```python
from app.notifications import validate_webhook_url

if not validate_webhook_url(webhook_url):
    raise ValueError("Invalid webhook URL")
```

**Blocked**:
- Private IP ranges (10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12)
- Localhost (127.0.0.0/8, ::1)
- Link-local addresses
- Cloud metadata services (169.254.169.254, metadata.google.internal, etc.)
- Non-HTTP(S) protocols

## Best Practices

### For Notification Senders

1. **Always use templates**: Call `get_template_for_trigger()` and `render_template()`
2. **Provide fallbacks**: Hardcode fallback messages if no template exists
3. **Check quiet hours**: Use `is_within_quiet_hours()` for non-critical notifications
4. **Verify access**: Use `check_reptile_access()` before sending
5. **Create in-app notifications**: Always create in-app copy for history
6. **Include context**: Pass full context dict for Discord rich embeds

### For Template Creation

1. **Use descriptive names**: "Schedule Reminder - Discord" instead of "Template 1"
2. **Test variable substitution**: Ensure all {variables} are available in context
3. **Discord embeds**: Use `discord_config` for rich formatting
4. **Keep messages concise**: Especially for Pushover (limited characters)
5. **Provide user-friendly defaults**: System templates should work well out-of-box

### For Scheduler Integration

1. **Respect existing patterns**: Follow the same flow as `send_schedule_reminder()`
2. **Handle errors gracefully**: Log errors but don't raise exceptions
3. **Batch processing**: Use async bulk queries to avoid N+1 problems
4. **Timezone awareness**: Always use UTC internally, convert for display
5. **Job recovery**: Use `ScheduledNotificationJob` table for persistent scheduling

## Debugging

### Check Template Resolution

```python
template = await get_template_for_trigger(
    db, "schedule_reminder", user_id=1, channel_type="discord"
)
print(f"Template: {template.name if template else 'None (using fallback)'}")
```

### Test Template Rendering

```python
context = {"reptile_name": "Test Reptile", "schedule_name": "Test Schedule"}
message = render_template("Reminder for {reptile_name}: {schedule_name}", context)
print(message)  # "Reminder for Test Reptile: Test Schedule"
```

### View Scheduled Jobs

```python
# In scheduler.py
logger.info(f"Jobs: {[job.id for job in scheduler.get_jobs()]}")
```

### Check Notification Delivery

1. Check logs for "Sent [trigger_type] notification" messages
2. Query `UserNotification` table for in-app notifications
3. Verify webhook delivery in Discord/Pushover logs
4. Check `ScheduledNotificationJob` table for job status

## Migration History

Relevant migrations:

- **0044**: Added `NotificationTemplate` model
- **0045**: Added schedule-channel many-to-many association
- **0046**: Added `reminder_time` for exact-time notifications
- **0047**: Added `ScheduledNotificationJob` for job persistence
- **0050**: Added `discord_config` to templates
- **0063**: Added requirement-based schedule fields
- **0064**: Added quota tracking table
- **0070**: Added template matching criteria (`reptile_id`, `schedule_id`, `schedule_type_filter`, `food_category_filter`, `priority`, `applies_to_description`) for priority-based template resolution

## Related Files

- `app/models.py`: Database models
- `app/schemas.py`: Pydantic schemas
- `app/scheduler.py`: Notification scheduler and cron jobs
- `app/notifications.py`: Template rendering and webhook delivery
- `app/celery_tasks.py`: Celery task wrappers
- `app/routers/notification_templates.py`: Template CRUD API
- `app/routers/notification_channels.py`: Channel CRUD API
- `app/routers/notification_settings.py`: Settings CRUD API
