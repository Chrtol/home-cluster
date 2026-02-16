"""
Digest notification generation for daily and weekly planners.

This module handles:
- Querying pending ScheduleInstances for a user's reptiles
- Grouping and sorting tasks (chronologically for daily, by day for weekly)
- Building formatted messages for different notification channels
- Handling overdue task inclusion

Date range semantics for weekly digest:
- "next 7 days from send date" means send date IS day 1 of 7 total days
- Example: If sent on Monday, covers Mon-Sun (7 days total, Monday is first day)
- Range is [start_date, start_date + 6 days] inclusive
"""
import logging
from datetime import date as py_date, datetime, timedelta
from typing import List, Dict, Optional, Any
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Schedule, ScheduleInstance, InstanceStatus, Reptile, User,
    NotificationSettings, NotificationTemplate, household_members
)
from app.constants import get_schedule_type_emoji
from app.notifications import render_template

logger = logging.getLogger(__name__)


async def get_user_reptile_ids(db: AsyncSession, user_id: int) -> List[int]:
    """Get IDs of all reptiles the user has access to via household membership."""
    result = await db.execute(
        select(Reptile.id)
        .join(household_members, Reptile.household_id == household_members.c.household_id)
        .where(household_members.c.user_id == user_id)
    )
    return [row[0] for row in result.all()]


async def get_pending_instances_for_date(
    db: AsyncSession,
    user_id: int,
    target_date: py_date
) -> List[ScheduleInstance]:
    """
    Get all pending schedule instances for user's reptiles on target date.

    Returns instances with schedules and reptiles eagerly loaded.
    Only includes enabled schedules with notifications enabled.
    """
    reptile_ids = await get_user_reptile_ids(db, user_id)
    if not reptile_ids:
        return []

    result = await db.execute(
        select(ScheduleInstance)
        .join(Schedule, ScheduleInstance.schedule_id == Schedule.id)
        .where(
            and_(
                Schedule.reptile_id.in_(reptile_ids),
                ScheduleInstance.scheduled_date == target_date,
                ScheduleInstance.status == InstanceStatus.PENDING,
                Schedule.enabled == True,
                Schedule.notifications_enabled == True
            )
        )
        .options(
            selectinload(ScheduleInstance.schedule).selectinload(Schedule.reptile)
        )
        .order_by(Schedule.earliest_time.asc().nullslast())
    )
    return list(result.scalars().all())


async def get_overdue_instances_for_user(
    db: AsyncSession,
    user_id: int,
    since_date: py_date
) -> List[ScheduleInstance]:
    """
    Get overdue (MISSED) instances from yesterday only.

    Per CONTEXT.md: Only include tasks overdue since yesterday (not accumulated backlog).
    """
    reptile_ids = await get_user_reptile_ids(db, user_id)
    if not reptile_ids:
        return []

    # Only get overdue from the day before target (yesterday)
    yesterday = since_date - timedelta(days=1)

    result = await db.execute(
        select(ScheduleInstance)
        .join(Schedule, ScheduleInstance.schedule_id == Schedule.id)
        .where(
            and_(
                Schedule.reptile_id.in_(reptile_ids),
                ScheduleInstance.scheduled_date == yesterday,
                ScheduleInstance.status == InstanceStatus.MISSED,
                Schedule.enabled == True
            )
        )
        .options(
            selectinload(ScheduleInstance.schedule).selectinload(Schedule.reptile)
        )
        .order_by(Schedule.earliest_time.asc().nullslast())
    )
    return list(result.scalars().all())


async def get_weekly_instances(
    db: AsyncSession,
    user_id: int,
    start_date: py_date,
    days: int = 7
) -> Dict[py_date, List[ScheduleInstance]]:
    """
    Get pending instances for the week starting from start_date, grouped by date.

    Date range semantics (per CONTEXT.md "next 7 days from send date"):
    - start_date IS day 1 of the 7-day range (send date is included)
    - Range covers [start_date, start_date + 6 days] = 7 total days
    - Example: start_date=Monday covers Mon, Tue, Wed, Thu, Fri, Sat, Sun

    Args:
        db: Database session
        user_id: User ID to fetch tasks for
        start_date: First day of the week (this day IS included as day 1)
        days: Number of days to include (default 7)

    Returns:
        Dict mapping date -> list of ScheduleInstances for that day
    """
    reptile_ids = await get_user_reptile_ids(db, user_id)
    if not reptile_ids:
        return {}

    # Calculate end date: start_date + (days - 1) gives us 'days' total days inclusive
    # e.g., days=7: start_date to start_date+6 = 7 days
    end_date = start_date + timedelta(days=days - 1)

    result = await db.execute(
        select(ScheduleInstance)
        .join(Schedule, ScheduleInstance.schedule_id == Schedule.id)
        .where(
            and_(
                Schedule.reptile_id.in_(reptile_ids),
                ScheduleInstance.scheduled_date >= start_date,
                ScheduleInstance.scheduled_date <= end_date,
                ScheduleInstance.status == InstanceStatus.PENDING,
                Schedule.enabled == True,
                Schedule.notifications_enabled == True
            )
        )
        .options(
            selectinload(ScheduleInstance.schedule).selectinload(Schedule.reptile)
        )
        .order_by(ScheduleInstance.scheduled_date.asc(), Schedule.earliest_time.asc().nullslast())
    )

    instances = result.scalars().all()

    # Group by date
    grouped: Dict[py_date, List[ScheduleInstance]] = {}
    for instance in instances:
        d = instance.scheduled_date
        if d not in grouped:
            grouped[d] = []
        grouped[d].append(instance)

    return grouped


def format_time_window(schedule: Schedule) -> str:
    """Format time window for display, e.g., '08:00-10:00' or empty if no window."""
    if not schedule.time_window_enabled or not schedule.earliest_time:
        return ""

    start = schedule.earliest_time.strftime('%H:%M')
    if schedule.latest_time:
        end = schedule.latest_time.strftime('%H:%M')
        return f"{start}-{end}"
    return start


async def get_digest_template(
    db: AsyncSession,
    user_id: int,
    trigger_type: str  # "daily_planner" or "weekly_planner"
) -> Optional[NotificationTemplate]:
    """Get user's custom template or system default for digest type."""
    # Prefer user template, fall back to system template
    result = await db.execute(
        select(NotificationTemplate)
        .where(
            NotificationTemplate.trigger_type == trigger_type,
            or_(
                NotificationTemplate.user_id == user_id,
                NotificationTemplate.user_id.is_(None)  # System template
            )
        )
        .order_by(NotificationTemplate.user_id.desc().nullslast())  # User templates first
        .limit(1)
    )
    return result.scalar_one_or_none()


def build_task_dict(instance: ScheduleInstance) -> dict:
    """Build task dict from instance for template context."""
    schedule = instance.schedule
    reptile = schedule.reptile
    return {
        'reptile_name': reptile.name,
        'schedule_name': schedule.name or schedule.schedule_type.replace('_', ' ').title(),
        'schedule_type': schedule.schedule_type,
        'time_window': format_time_window(schedule),
        'emoji': get_schedule_type_emoji(schedule.schedule_type)
    }


def build_digest_context(
    instances: List[ScheduleInstance],
    overdue_instances: List[ScheduleInstance],
    target_date: py_date,
    app_url: Optional[str] = None
) -> dict:
    """Build context dict for digest template rendering."""
    tasks_by_reptile = {}
    all_tasks = []

    for instance in instances:
        schedule = instance.schedule
        reptile = schedule.reptile
        reptile_name = reptile.name

        task = {
            'reptile_name': reptile_name,
            'schedule_name': schedule.name or schedule.schedule_type.replace('_', ' ').title(),
            'schedule_type': schedule.schedule_type,
            'time_window': format_time_window(schedule),
            'emoji': get_schedule_type_emoji(schedule.schedule_type)
        }

        if reptile_name not in tasks_by_reptile:
            tasks_by_reptile[reptile_name] = []
        tasks_by_reptile[reptile_name].append(task)
        all_tasks.append(task)

    overdue_tasks = []
    for instance in overdue_instances:
        schedule = instance.schedule
        reptile = schedule.reptile
        overdue_tasks.append({
            'reptile_name': reptile.name,
            'schedule_name': schedule.name or schedule.schedule_type.replace('_', ' ').title(),
            'schedule_type': schedule.schedule_type,
            'time_window': format_time_window(schedule),
            'emoji': get_schedule_type_emoji(schedule.schedule_type)
        })

    return {
        'tasks_by_reptile': tasks_by_reptile,
        'all_tasks': all_tasks,
        'overdue_tasks': overdue_tasks,
        'date': target_date.strftime('%A, %B %d'),
        'task_count': len(all_tasks),
        'overdue_count': len(overdue_tasks),
        'app_url': app_url or ''
    }


def render_task_line_from_template(
    template: NotificationTemplate,
    instance: ScheduleInstance,
    show_time_windows: bool
) -> str:
    """Render a single task line using the template format."""
    task_dict = build_task_dict(instance)

    # Add time_window_display field for optional time window
    if show_time_windows and task_dict.get('time_window'):
        task_dict['time_window_display'] = f" ({task_dict['time_window']})"
    else:
        task_dict['time_window_display'] = ""

    # Use short template variant (or fallback to message_template)
    task_template = template.message_template_short or template.message_template
    if not task_template:
        # Final fallback if no template defined
        return build_task_line(instance, include_reptile=True)

    return render_template(task_template, task_dict, use_jinja=False)


async def build_daily_digest_message_with_template(
    db: AsyncSession,
    user_id: int,
    instances: List[ScheduleInstance],
    overdue_instances: List[ScheduleInstance],
    target_date: py_date,
    app_url: Optional[str] = None
) -> Dict[str, str]:
    """Build daily digest using user's template with code-based iteration, or fallback to hardcoded."""
    template = await get_digest_template(db, user_id, "daily_planner")

    if template:
        # Read format options (default to True for backward compat)
        group_by_reptile = template.group_by_reptile if template.group_by_reptile is not None else True
        show_time_windows = template.show_time_windows if template.show_time_windows is not None else True
        include_overdue = template.include_overdue if template.include_overdue is not None else True
        include_app_link = template.include_app_link if template.include_app_link is not None else True

        message_parts = []

        if group_by_reptile:
            # Group tasks by reptile
            tasks_by_reptile = {}
            for instance in instances:
                reptile_name = instance.schedule.reptile.name
                if reptile_name not in tasks_by_reptile:
                    tasks_by_reptile[reptile_name] = []
                tasks_by_reptile[reptile_name].append(instance)

            for reptile_name, reptile_tasks in tasks_by_reptile.items():
                message_parts.append(f"**{reptile_name}**")
                for instance in reptile_tasks:
                    line = render_task_line_from_template(template, instance, show_time_windows)
                    message_parts.append(f"  {line}")
                message_parts.append("")
        else:
            # Flat list
            for instance in instances:
                line = render_task_line_from_template(template, instance, show_time_windows)
                message_parts.append(line)

        if not instances:
            message_parts.append("*No tasks scheduled for today*")

        # Overdue section
        if include_overdue and overdue_instances:
            message_parts.append("")
            message_parts.append("**Overdue:**")
            for instance in overdue_instances:
                line = render_task_line_from_template(template, instance, show_time_windows)
                message_parts.append(f"  {line}")

        # App link
        if include_app_link and app_url:
            message_parts.append("")
            message_parts.append(f"[View in app]({app_url})")

        message = "\n".join(message_parts)

        # Render title
        date_str = target_date.strftime('%A, %B %d')
        title = f"Daily Planner - {date_str}"
        if template.title_template:
            title = render_template(template.title_template, {"date": date_str}, use_jinja=False)

        return {"title": title, "message": message}

    # Fallback to existing hardcoded format
    return build_daily_digest_message(instances, overdue_instances, target_date, app_url)


async def build_weekly_digest_message_with_template(
    db: AsyncSession,
    user_id: int,
    instances_by_date: Dict[py_date, List[ScheduleInstance]],
    start_date: py_date,
    app_url: Optional[str] = None
) -> Dict[str, str]:
    """Build weekly digest using user's template with code-based iteration, or fallback to hardcoded."""
    template = await get_digest_template(db, user_id, "weekly_planner")

    if template:
        # Read format options (default to True for backward compat)
        group_by_reptile = template.group_by_reptile if template.group_by_reptile is not None else True
        show_time_windows = template.show_time_windows if template.show_time_windows is not None else True
        include_overdue = template.include_overdue if template.include_overdue is not None else True
        include_app_link = template.include_app_link if template.include_app_link is not None else True

        message_parts = []
        has_tasks = False

        # Iterate through all 7 days
        for i in range(7):
            day = start_date + timedelta(days=i)
            day_instances = instances_by_date.get(day, [])

            if day_instances:
                has_tasks = True
                # Day header
                day_header = day.strftime('%A, %B %d')
                message_parts.append(f"**{day_header}**")

                if group_by_reptile:
                    # Group tasks by reptile within this day
                    tasks_by_reptile = {}
                    for instance in day_instances:
                        reptile_name = instance.schedule.reptile.name
                        if reptile_name not in tasks_by_reptile:
                            tasks_by_reptile[reptile_name] = []
                        tasks_by_reptile[reptile_name].append(instance)

                    for reptile_name, reptile_tasks in tasks_by_reptile.items():
                        message_parts.append(f"  **{reptile_name}**")
                        for instance in reptile_tasks:
                            line = render_task_line_from_template(template, instance, show_time_windows)
                            message_parts.append(f"    {line}")
                else:
                    # Flat list for this day
                    for instance in day_instances:
                        line = render_task_line_from_template(template, instance, show_time_windows)
                        message_parts.append(f"  {line}")

                message_parts.append("")  # Blank line between days

        if not has_tasks:
            message_parts.append("*No tasks scheduled for the next week*")

        # App link
        if include_app_link and app_url:
            if has_tasks:
                message_parts.append("")
            message_parts.append(f"[View in app]({app_url})")

        message = "\n".join(message_parts)

        # Render title
        start_str = start_date.strftime('%B %d')
        end_date = start_date + timedelta(days=6)
        end_str = end_date.strftime('%B %d')
        title = f"Weekly Planner - {start_str} to {end_str}"
        if template.title_template:
            title = render_template(template.title_template, {
                "start_date": start_str,
                "end_date": end_str
            }, use_jinja=False)

        return {"title": title, "message": message}

    # Fallback to existing hardcoded format
    return build_weekly_digest_message(instances_by_date, start_date, app_url)


def build_task_line(instance: ScheduleInstance, include_reptile: bool = True) -> str:
    """
    Build a single task line for digest or individual notification.

    Format: [emoji] [reptile_name:] task_name (time_window)

    This function is the single source of truth for task line formatting.
    Used by both grouped digests and individual notifications (when digest_format="individual").

    Args:
        instance: The ScheduleInstance to format
        include_reptile: Whether to include reptile name prefix (default True)

    Returns:
        Formatted task line string
    """
    schedule = instance.schedule
    reptile = schedule.reptile

    emoji = get_schedule_type_emoji(schedule.schedule_type)
    task_name = schedule.name or schedule.schedule_type.replace('_', ' ').title()
    time_window = format_time_window(schedule)

    parts = [emoji]
    if include_reptile:
        parts.append(f"**{reptile.name}:**")
    parts.append(task_name)
    if time_window:
        parts.append(f"({time_window})")

    return " ".join(parts)


def build_individual_task_message(instance: ScheduleInstance, is_overdue: bool = False) -> Dict[str, str]:
    """
    Build a message dict for an individual task notification.

    Used when digest_format="individual" to send separate notifications per task.
    This ensures consistent formatting with grouped digests by reusing build_task_line.

    Args:
        instance: The ScheduleInstance to build message for
        is_overdue: Whether this is an overdue task

    Returns:
        Dict with 'title' and 'message' keys
    """
    schedule = instance.schedule
    reptile = schedule.reptile
    task_name = schedule.name or schedule.schedule_type.replace('_', ' ').title()

    if is_overdue:
        title = f"Overdue: {reptile.name} - {task_name}"
    else:
        title = f"{reptile.name} - {task_name}"

    # Use build_task_line for consistent formatting
    message = build_task_line(instance, include_reptile=True)

    return {
        "title": title,
        "message": message
    }


def build_daily_digest_message(
    instances: List[ScheduleInstance],
    overdue_instances: List[ScheduleInstance],
    target_date: py_date,
    app_url: Optional[str] = None
) -> Dict[str, str]:
    """
    Build daily digest message content.

    Per CONTEXT.md:
    - Primary sort: chronological (by time)
    - Secondary sort: by reptile (when same start time)
    - Flat chronological list
    - Overdue section at bottom (only from yesterday)
    - Always include clickable link to app

    Returns dict with 'title' and 'message' keys.
    """
    date_str = target_date.strftime('%A, %B %d')

    lines = []

    # Today's tasks (already sorted by earliest_time from query)
    if instances:
        for instance in instances:
            lines.append(build_task_line(instance, include_reptile=True))
    else:
        lines.append("*No tasks scheduled for today*")

    # Overdue section (if any)
    if overdue_instances:
        lines.append("")
        lines.append("**Overdue:**")
        for instance in overdue_instances:
            lines.append(f"  {build_task_line(instance, include_reptile=True)}")

    # App link
    if app_url:
        lines.append("")
        lines.append(f"[View in app]({app_url})")

    return {
        "title": f"Daily Planner - {date_str}",
        "message": "\n".join(lines)
    }


def build_weekly_digest_message(
    instances_by_date: Dict[py_date, List[ScheduleInstance]],
    start_date: py_date,
    app_url: Optional[str] = None
) -> Dict[str, str]:
    """
    Build weekly digest message content.

    Per CONTEXT.md:
    - Grouped by day with date headers ("Monday, Feb 14")
    - List each recurring task instance separately
    - Covers next 7 days from send date (send date is day 1, so 7 total days)

    Date range: [start_date, start_date + 6 days] inclusive = 7 days total.

    Returns dict with 'title' and 'message' keys.
    """
    start_str = start_date.strftime('%B %d')
    end_date = start_date + timedelta(days=6)
    end_str = end_date.strftime('%B %d')

    lines = []

    # Iterate through all 7 days in order
    current_date = start_date
    has_tasks = False

    for _ in range(7):
        day_instances = instances_by_date.get(current_date, [])

        if day_instances:
            has_tasks = True
            # Date header
            day_header = current_date.strftime('%A, %B %d')
            lines.append(f"**{day_header}**")

            for instance in day_instances:
                lines.append(f"  {build_task_line(instance, include_reptile=True)}")

            lines.append("")  # Blank line between days

        current_date += timedelta(days=1)

    if not has_tasks:
        lines.append("*No tasks scheduled for the next week*")

    # App link
    if app_url:
        lines.append(f"[View in app]({app_url})")

    return {
        "title": f"Weekly Planner - {start_str} to {end_str}",
        "message": "\n".join(lines)
    }


def build_short_form_message(
    instances: List[ScheduleInstance],
    overdue_instances: List[ScheduleInstance],
    target_date: py_date,
    is_weekly: bool = False
) -> str:
    """
    Build short-form message for platforms with length limits (e.g., Pushover).

    Format: "3 tasks today (1 overdue). Open app for details."
    """
    task_count = len(instances)
    overdue_count = len(overdue_instances)

    if is_weekly:
        task_word = "task" if task_count == 1 else "tasks"
        msg = f"{task_count} {task_word} this week"
    else:
        task_word = "task" if task_count == 1 else "tasks"
        msg = f"{task_count} {task_word} today"

    if overdue_count > 0:
        overdue_word = "overdue" if overdue_count == 1 else "overdue"
        msg += f" ({overdue_count} {overdue_word})"

    msg += ". Open app for details."

    return msg
