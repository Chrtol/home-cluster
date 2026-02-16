"""
Notification sender functions for schedule reminders, overdue alerts, and interval warnings.

This module contains the three notification sending functions extracted from core.py:
- send_schedule_reminder: Send scheduled reminder notifications
- send_overdue_alert: Send alerts for overdue/missed schedules
- send_interval_warning_notification: Send warnings for interval-based schedules

These functions use utilities from core.py (is_within_quiet_hours, create_in_app_notification).
"""
import logging
from datetime import datetime, timezone, date as py_date
from fastapi import HTTPException
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Schedule, Reptile, User, NotificationSettings, NotificationType,
    FeedingRotation, Supplement
)
from app.notifications import send_webhook_notification, get_template_for_trigger, render_template, get_template_message
from app.constants import FOOD_CATEGORY_DISPLAY, get_schedule_type_emoji

# Note: is_within_quiet_hours and create_in_app_notification are imported inside
# functions to avoid circular import with core.py

logger = logging.getLogger(__name__)


async def send_schedule_reminder(
    db: AsyncSession,
    reptile: Reptile,
    schedule: Schedule,
    scheduled_date: py_date,
    user: User,
    channel: 'NotificationChannel'
):
    """Send a schedule reminder notification"""
    # Late import to avoid circular dependency with core.py
    from .core import create_in_app_notification

    # Extract webhook components from channel
    webhook_url = channel.webhook_url
    webhook_type = channel.webhook_type
    config = channel.config

    # Build context for template matching and rendering
    emoji = get_schedule_type_emoji(schedule.schedule_type)
    schedule_name = schedule.name or f"{schedule.schedule_type.title()}"

    # Build time window string
    time_window = ""
    time_window_display = ""
    if schedule.time_window_enabled and schedule.earliest_time and schedule.latest_time:
        time_window_display = f"{schedule.earliest_time.strftime('%H:%M')} - {schedule.latest_time.strftime('%H:%M')}"
        time_window = f"\nTime window: {time_window_display}"

    # Build notes string
    notes = f"\nNotes: {schedule.notes}" if schedule.notes else ""

    # Build schedule URL for links - use instance if available
    schedule_url = f"/schedules/{schedule.id}"
    try:
        from app.models import ScheduleInstance
        # Try to find the specific instance for this date
        instance_result = await db.execute(
            select(ScheduleInstance).where(
                and_(
                    ScheduleInstance.schedule_id == schedule.id,
                    ScheduleInstance.scheduled_date == scheduled_date
                )
            )
        )
        instance = instance_result.scalars().first()
        if instance:
            schedule_url = f"/schedule-instances/{instance.id}"
    except Exception as e:
        logger.warning(f"Could not find instance for schedule {schedule.id} on {scheduled_date}: {e}")
        # Fall back to schedule URL

    # Build context
    context = {
        "reptile_name": reptile.name,
        "schedule_name": schedule_name,
        "schedule_type": schedule.schedule_type,
        "emoji": emoji,
        "time_window": time_window,
        "time_window_display": time_window_display,
        "notes": notes,
        "scheduled_date": scheduled_date.strftime('%Y-%m-%d'),
        "due_date": scheduled_date.strftime('%Y-%m-%d'),
        "schedule_url": schedule_url,
        "schedule_id": schedule.id,
    }

    # Add food category for feeding schedules
    if schedule.schedule_type == "feeding" and schedule.food_category:
        context["food_category"] = FOOD_CATEGORY_DISPLAY.get(schedule.food_category, schedule.food_category.title())

        # Try to get active supplement rotations for this reptile
        rotation_result = await db.execute(
            select(FeedingRotation)
            .where(
                and_(
                    FeedingRotation.reptile_id == schedule.reptile_id,
                    FeedingRotation.rotation_type == "supplement",
                    FeedingRotation.enabled == True
                )
            )
        )
        rotations = rotation_result.scalars().all()

        if rotations:
            # Get supplement names
            supplement_names = []
            for rotation in rotations:
                if rotation.supplement_id:
                    supplement = await db.get(Supplement, rotation.supplement_id)
                    if supplement:
                        supplement_names.append(supplement.name)

            if supplement_names:
                context["supplement_name"] = ", ".join(supplement_names)

    # Add supplement info for supplement schedules
    if schedule.schedule_type == "supplement" and schedule.supplement_id:
        supplement = await db.get(Supplement, schedule.supplement_id)
        if supplement:
            context["supplement_name"] = supplement.name

    # Add IDs for template matching
    context["reptile_id"] = reptile.id
    context["schedule_id"] = schedule.id
    # food_category key already added for feeding schedules

    # Get template for this trigger with context for matching
    template = await get_template_for_trigger(
        db=db,
        trigger_type="schedule_reminder",
        user_id=user.id,
        channel_type=webhook_type,
        context=context
    )

    # Render template or use fallback
    if template:
        message = render_template(get_template_message(template, channel), context)
        title = render_template(template.title_template, context) if template.title_template else f"Schedule Reminder - {reptile.name}"
    else:
        # Fallback to hardcoded message
        message = f"{emoji} **Reminder:** {schedule_name} for **{reptile.name}**{time_window}{notes}"
        title = f"Schedule Reminder - {reptile.name}"

    await send_webhook_notification(
        webhook_url=webhook_url,
        webhook_type=webhook_type,
        message=message,
        title=title,
        config=config,
        context=context,
        trigger_type="schedule_reminder",
        template=template
    )

    # Create in-app notification
    await create_in_app_notification(
        db=db,
        user=user,
        notification_type=NotificationType.SCHEDULE_REMINDER,
        title=title,
        message=message,
        link=schedule_url,
        notification_metadata={
            "reptile_id": reptile.id,
            "reptile_name": reptile.name,
            "schedule_id": schedule.id,
            "schedule_name": schedule.name or schedule.schedule_type,
            "scheduled_date": scheduled_date.isoformat()
        }
    )


async def send_overdue_alert(
    db: AsyncSession,
    reptile: Reptile,
    schedule: Schedule,
    missed_date: py_date,
    user: User,
    channel: 'NotificationChannel'
) -> bool:
    """
    Send an overdue schedule alert

    Returns:
        bool: True if notification was sent successfully, False on failure
    """
    # Late import to avoid circular dependency with core.py
    from .core import create_in_app_notification

    # Extract webhook components from channel
    webhook_url = channel.webhook_url
    webhook_type = channel.webhook_type
    config = channel.config

    schedule_name = schedule.name or f"{schedule.schedule_type.title()}"

    # Build schedule URL for links - use instance if available
    schedule_url = f"/schedules/{schedule.id}"
    try:
        from app.models import ScheduleInstance
        # Try to find the specific instance for this date
        instance_result = await db.execute(
            select(ScheduleInstance).where(
                and_(
                    ScheduleInstance.schedule_id == schedule.id,
                    ScheduleInstance.scheduled_date == missed_date
                )
            )
        )
        instance = instance_result.scalars().first()
        if instance:
            schedule_url = f"/schedule-instances/{instance.id}"
    except Exception as e:
        logger.warning(f"Could not find instance for schedule {schedule.id} on {missed_date}: {e}")
        # Fall back to schedule URL

    context = {
        "reptile_name": reptile.name,
        "schedule_name": schedule_name,
        "schedule_type": schedule.schedule_type,
        "missed_date": missed_date.strftime('%Y-%m-%d'),
        "schedule_url": schedule_url,
    }

    # Add food category for feeding schedules
    if schedule.schedule_type == "feeding" and schedule.food_category:
        context["food_category"] = FOOD_CATEGORY_DISPLAY.get(schedule.food_category, schedule.food_category.title())

        # Try to get active supplement rotations for this reptile
        rotation_result = await db.execute(
            select(FeedingRotation)
            .where(
                and_(
                    FeedingRotation.reptile_id == schedule.reptile_id,
                    FeedingRotation.rotation_type == "supplement",
                    FeedingRotation.enabled == True
                )
            )
        )
        rotations = rotation_result.scalars().all()

        if rotations:
            # Get supplement names
            supplement_names = []
            for rotation in rotations:
                if rotation.supplement_id:
                    supplement = await db.get(Supplement, rotation.supplement_id)
                    if supplement:
                        supplement_names.append(supplement.name)

            if supplement_names:
                context["supplement_name"] = ", ".join(supplement_names)

    # Add supplement info for supplement schedules
    if schedule.schedule_type == "supplement" and schedule.supplement_id:
        supplement = await db.get(Supplement, schedule.supplement_id)
        if supplement:
            context["supplement_name"] = supplement.name

    # Add IDs for template matching
    context["reptile_id"] = reptile.id
    context["schedule_id"] = schedule.id
    # food_category key already added for feeding schedules

    # Get template for this trigger with context for matching
    template = await get_template_for_trigger(
        db=db,
        trigger_type="overdue_alert",
        user_id=user.id,
        channel_type=webhook_type,
        context=context
    )

    # Render template or use fallback
    if template:
        message = render_template(get_template_message(template, channel), context)
        title = render_template(template.title_template, context) if template.title_template else f"Overdue Schedule - {reptile.name}"
    else:
        # Fallback to hardcoded message
        message = f"⚠️ **Overdue Alert:** {schedule_name} for **{reptile.name}** was not completed on {missed_date.strftime('%Y-%m-%d')}"
        title = f"Overdue Schedule - {reptile.name}"

    # Send webhook notification and track success
    webhook_success = await send_webhook_notification(
        webhook_url=webhook_url,
        webhook_type=webhook_type,
        message=message,
        title=title,
        config=config,
        context=context,
        trigger_type="overdue_alert",
        template=template
    )

    # Create in-app notification
    await create_in_app_notification(
        db=db,
        user=user,
        notification_type=NotificationType.OVERDUE_ALERT,
        title=title,
        message=message,
        link=schedule_url,  # Link to specific instance or schedule
        notification_metadata={
            "reptile_id": reptile.id,
            "reptile_name": reptile.name,
            "schedule_id": schedule.id,
            "schedule_name": schedule.name or schedule.schedule_type,
            "missed_date": missed_date.isoformat()
        }
    )

    return webhook_success


async def send_interval_warning_notification(
    db: AsyncSession,
    reptile: Reptile,
    schedule: Schedule,
    warning_type: str,
    days_since_last: int
):
    """
    Send interval warning notification to all channels for an interval schedule.

    Only sends max_days_between warnings (HARD constraint).

    Uses the notification template system to allow user customization.

    warning_type can be:
    - max_days_approaching: Approaching max_days_between limit
    - max_days_exceeded: Exceeded max_days_between limit
    """
    # Late import to avoid circular dependency with core.py
    from .core import is_within_quiet_hours, create_in_app_notification

    try:
        # Get schedule's notification channels
        await db.refresh(schedule, ["notification_channels"])

        if not schedule.notification_channels:
            logger.debug(f"No channels for schedule {schedule.id}, skipping interval warning")
            return

        schedule_url = f"/schedules/{schedule.id}"

        # Build context for template matching and rendering
        # Note: Interval schedules don't use quotas, only min/max days between
        context = {
            "reptile_id": reptile.id,
            "reptile_name": reptile.name,
            "schedule_id": schedule.id,
            "schedule_name": schedule.name or f"{schedule.schedule_type.title()} Schedule",
            "schedule_type": schedule.schedule_type,
            "schedule_url": schedule_url,
            "days_since_last": days_since_last,
            "min_days_between": schedule.min_days_between,
            "max_days_between": schedule.max_days_between,
            "warning_type": warning_type,
            "emoji": "⏰",  # Default emoji for interval warnings
        }

        # Send to each channel
        for channel in schedule.notification_channels:
            if not channel.enabled:
                continue

            # Get the channel owner's notification settings and user
            notif_settings = await db.get(NotificationSettings, channel.notification_settings_id)
            if not notif_settings or not notif_settings.notify_schedule_reminders:
                continue

            # Get the user
            user = await db.get(User, notif_settings.user_id)
            if not user:
                continue

            # Check quiet hours
            if is_within_quiet_hours(notif_settings, NotificationType.SCHEDULE_REMINDER, datetime.now(timezone.utc)):
                logger.debug(f"Skipping quota notification for user {user.email} - within quiet hours")
                continue

            # Check user access
            from app.permissions import check_reptile_access
            try:
                await check_reptile_access(db, user, reptile.id)
            except HTTPException:
                # User lacks access to this reptile - skip notification
                continue

            # Get template for this trigger (reuse schedule_reminder trigger type)
            template = await get_template_for_trigger(
                db=db,
                trigger_type="schedule_reminder",
                user_id=user.id,
                channel_type=channel.webhook_type,
                context=context
            )

            # Render template or use fallback based on warning_type
            if template:
                # User has a custom template - use it with interval warning context
                message = render_template(get_template_message(template, channel), context)
                title = render_template(template.title_template, context) if template.title_template else f"Schedule Reminder - {reptile.name}"
            else:
                # Fallback to hardcoded messages if no template exists
                if warning_type == "max_days_approaching":
                    title = f"Feeding Reminder - {reptile.name}"
                    message = (
                        f"⏰ **Reminder:** It's been {days_since_last} days since you fed **{reptile.name}**.\n"
                        f"The maximum time between feedings is {schedule.max_days_between} days."
                    )
                elif warning_type == "max_days_exceeded":
                    title = f"Feeding Overdue - {reptile.name}"
                    message = (
                        f"⚠️ **Alert:** It's been {days_since_last} days since you fed **{reptile.name}**!\n"
                        f"The maximum time between feedings is {schedule.max_days_between} days. Please feed soon."
                    )
                else:
                    return  # Unknown warning type

            # Send notification
            await send_webhook_notification(
                webhook_url=channel.webhook_url,
                webhook_type=channel.webhook_type,
                message=message,
                title=title,
                config=channel.config,
                context=context,
                trigger_type="schedule_reminder",
                template=template
            )

            # Create in-app notification
            await create_in_app_notification(
                db=db,
                user=user,
                notification_type=NotificationType.SCHEDULE_REMINDER,
                title=title,
                message=message,
                link=schedule_url,
                notification_metadata={
                    "reptile_id": reptile.id,
                    "reptile_name": reptile.name,
                    "schedule_id": schedule.id,
                    "schedule_name": schedule.name or f"{schedule.schedule_type.title()} Schedule",
                    "warning_type": warning_type,
                    "days_since_last": days_since_last,
                    "max_days_between": schedule.max_days_between
                }
            )

            logger.info(
                f"Sent interval {warning_type} notification for schedule {schedule.id} "
                f"for reptile {reptile.name} to user {user.email} via channel '{channel.name}'"
            )

    except Exception as e:
        logger.error(f"Error sending interval warning notification: {e}", exc_info=True)
