"""
Celery tasks for asynchronous notification delivery
"""
import asyncio
import logging
from datetime import date as py_date
from celery import Task
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.celery_app import celery_app
from app.database import async_session_maker
from app.models import User, Reptile, Schedule, NotificationSettings, NotificationChannel, NotificationType, ScheduleInstance, InstanceStatus
from app.notifications import send_webhook_notification, get_template_for_trigger, render_template
from app.scheduler import create_in_app_notification, is_within_quiet_hours
from app.scheduler.frequency_cap import is_frequency_cap_reached, increment_notification_count, get_frequency_cap_mode
from app.constants import FOOD_CATEGORY_DISPLAY, get_schedule_type_emoji

logger = logging.getLogger(__name__)


async def send_frequency_cap_summary_notification(
    db: AsyncSession,
    user: User,
    reptile: Reptile,
    channel: NotificationChannel,
    date: py_date
):
    """
    Send a summary notification when frequency cap is reached.

    This notifies the user that additional notifications for this reptile
    are being suppressed for the day.

    Args:
        db: Database session
        user: User to notify
        reptile: Reptile the notifications are for
        channel: Notification channel to use
        date: Date for which cap is reached
    """
    try:
        # Get template for frequency_cap_summary trigger
        template = await get_template_for_trigger(
            db=db,
            trigger_type="frequency_cap_summary",
            user_id=user.id,
            channel_type=channel.webhook_type
        )

        # Get current count from tracking
        from app.models import NotificationFrequencyTracking
        result = await db.execute(
            select(NotificationFrequencyTracking).where(
                and_(
                    NotificationFrequencyTracking.user_id == user.id,
                    NotificationFrequencyTracking.reptile_id == reptile.id,
                    NotificationFrequencyTracking.date == date
                )
            )
        )
        tracking = result.scalar_one_or_none()
        notifications_suppressed = tracking.notification_count if tracking else 0

        # Build context
        context = {
            "reptile_name": reptile.name,
            "reptile_id": reptile.id,
            "date": date.strftime('%Y-%m-%d'),
            "notifications_suppressed": notifications_suppressed,
        }

        # Render template or use fallback
        if template:
            message = render_template(template.message_template, context)
            title = render_template(template.title_template, context) if template.title_template else f"Notification Limit Reached - {reptile.name}"
        else:
            # Fallback to hardcoded message
            message = f"Notification limit reached for **{reptile.name}**. Additional reminders for today will be suppressed."
            title = f"Notification Limit Reached - {reptile.name}"

        # Send webhook notification (Discord, Pushover, etc.)
        if channel.webhook_type != "in_app":
            await send_webhook_notification(
                webhook_url=channel.webhook_url,
                webhook_type=channel.webhook_type,
                message=message,
                title=title,
                config=channel.config,
                context=context,
                trigger_type="frequency_cap_summary",
                template=template
            )
            logger.info(f"Sent frequency cap summary via {channel.webhook_type} for reptile {reptile.id} to user {user.email}")

        # Create in-app notification
        if channel.webhook_type == "in_app":
            await create_in_app_notification(
                db=db,
                user=user,
                notification_type=NotificationType.SYSTEM,
                title=title,
                message=message,
                link=f"/reptiles/{reptile.id}",
                notification_metadata={
                    "reptile_id": reptile.id,
                    "reptile_name": reptile.name,
                    "date": date.isoformat(),
                    "notifications_suppressed": notifications_suppressed
                }
            )
            logger.info(f"Sent in-app frequency cap summary for reptile {reptile.id} to user {user.email}")

    except Exception as e:
        logger.error(f"Error sending frequency cap summary notification: {e}", exc_info=True)


class AsyncTask(Task):
    """
    Custom Celery task that runs async functions
    """
    def __call__(self, *args, **kwargs):
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(self.run(*args, **kwargs))

    async def run(self, *args, **kwargs):
        raise NotImplementedError()


@celery_app.task(base=AsyncTask, bind=True, max_retries=3, default_retry_delay=60)
async def send_schedule_reminder_task(
    self,
    schedule_id: int,
    reptile_id: int,
    scheduled_date_str: str,
    user_id: int,
    channel_id: int
):
    """
    Celery task to send a schedule reminder notification

    Args:
        schedule_id: Schedule ID
        reptile_id: Reptile ID
        scheduled_date_str: Date string in ISO format (YYYY-MM-DD)
        user_id: User ID to send notification to
        channel_id: Notification channel ID to use
    """
    try:
        async with async_session_maker() as db:
            # Parse date first (needed for completion check)
            scheduled_date = py_date.fromisoformat(scheduled_date_str)

            # 1. CHECK COMPLETION STATUS FIRST (before any other work)
            # This ensures we don't send notifications for already completed tasks
            instance_result = await db.execute(
                select(ScheduleInstance).where(
                    and_(
                        ScheduleInstance.schedule_id == schedule_id,
                        ScheduleInstance.scheduled_date == scheduled_date
                    )
                )
            )
            instance = instance_result.scalar_one_or_none()

            if instance and instance.status == InstanceStatus.COMPLETED.value:
                logger.info(f"Skipping notification for schedule {schedule_id} on {scheduled_date} - already completed")
                return  # SUPPRESS - task complete

            # Fetch all required data
            schedule = await db.get(Schedule, schedule_id)
            reptile = await db.get(Reptile, reptile_id)
            user = await db.get(User, user_id)
            channel = await db.get(NotificationChannel, channel_id)

            if not all([schedule, reptile, user, channel]):
                logger.error(f"Missing data for reminder: schedule={schedule_id}, reptile={reptile_id}, user={user_id}, channel={channel_id}")
                return

            # Check if channel is still enabled
            if not channel.enabled:
                logger.info(f"Channel {channel_id} is disabled, skipping notification")
                return

            # 2. CHECK FREQUENCY CAP
            if await is_frequency_cap_reached(db, user_id, reptile_id, scheduled_date):
                logger.info(f"Frequency cap reached for reptile {reptile_id} on {scheduled_date}")

                # Check if we should send summary instead
                mode = await get_frequency_cap_mode(db, user_id)
                if mode == "summary":
                    await send_frequency_cap_summary_notification(
                        db, user, reptile, channel, scheduled_date
                    )
                return  # SUPPRESS - cap reached

            # Get template for this trigger
            template = await get_template_for_trigger(
                db=db,
                trigger_type="schedule_reminder",
                user_id=user.id,
                channel_type=channel.webhook_type
            )

            # Build context for template rendering
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

            # Build schedule URL for links
            schedule_url = f"/schedules/{schedule.id}"

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
                from app.models import FeedingRotation, Supplement
                # Note: select and and_ already imported at module level
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
                from app.models import Supplement
                supplement = await db.get(Supplement, schedule.supplement_id)
                if supplement:
                    context["supplement_name"] = supplement.name

            # Render template or use fallback
            if template:
                message = render_template(template.message_template, context)
                title = render_template(template.title_template, context) if template.title_template else f"Schedule Reminder - {reptile.name}"
            else:
                # Fallback to hardcoded message
                message = f"{emoji} **Reminder:** {schedule_name} for **{reptile.name}**{time_window}{notes}"
                title = f"Schedule Reminder - {reptile.name}"

            # Send webhook notification (Discord, Pushover, etc.)
            if channel.webhook_type != "in_app":
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
                logger.info(f"Sent {channel.webhook_type} reminder for schedule {schedule_id} to user {user.email}")

            # Create in-app notification
            if channel.webhook_type == "in_app":
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
                logger.info(f"Sent in-app reminder for schedule {schedule_id} to user {user.email}")

            # 3. INCREMENT FREQUENCY COUNTER (after successful send)
            await increment_notification_count(db, user_id, reptile_id, scheduled_date)
            await db.commit()

            # 4. SCHEDULE FOLLOW-UP REMINDER (if enabled)
            # Only main reminder schedules follow-up, never follow-up itself (prevents infinite chains)
            # Use Celery countdown instead of APScheduler since we're in a Celery worker process
            if schedule.follow_up_enabled and schedule.follow_up_delay_minutes:
                try:
                    countdown_seconds = schedule.follow_up_delay_minutes * 60
                    send_follow_up_reminder_task.apply_async(
                        args=[schedule_id, reptile_id, scheduled_date_str, user_id, channel_id],
                        countdown=countdown_seconds
                    )
                    logger.info(f"Scheduled follow-up reminder for schedule {schedule_id} in {schedule.follow_up_delay_minutes} minutes via Celery countdown")
                except Exception as e:
                    logger.error(f"Failed to schedule follow-up reminder: {e}", exc_info=True)
                    # Don't fail the main task if follow-up scheduling fails

    except Exception as exc:
        logger.error(f"Error sending schedule reminder: {exc}", exc_info=True)
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 60)


@celery_app.task(base=AsyncTask, bind=True, max_retries=3, default_retry_delay=60)
async def send_overdue_alert_task(
    self,
    schedule_id: int,
    reptile_id: int,
    missed_date_str: str,
    user_id: int,
    channel_id: int
):
    """
    Celery task to send an overdue alert notification

    Args:
        schedule_id: Schedule ID
        reptile_id: Reptile ID
        missed_date_str: Date string in ISO format (YYYY-MM-DD)
        user_id: User ID to send notification to
        channel_id: Notification channel ID to use
    """
    try:
        async with async_session_maker() as db:
            # Similar to send_schedule_reminder_task but for overdue alerts
            # Implementation follows same pattern
            logger.info(f"Overdue alert task for schedule {schedule_id}")
            # TODO: Implement full overdue alert logic if needed
            pass

    except Exception as exc:
        logger.error(f"Error sending overdue alert: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 60)


@celery_app.task(base=AsyncTask, bind=True, max_retries=3, default_retry_delay=60)
async def send_follow_up_reminder_task(
    self,
    schedule_id: int,
    reptile_id: int,
    scheduled_date_str: str,
    user_id: int,
    channel_id: int,
    follow_up_number: int = 1
):
    """
    Celery task to send a follow-up reminder notification.

    Same completion/frequency checks as main reminder.
    Does NOT schedule another follow-up (prevents infinite chains).

    Args:
        schedule_id: Schedule ID
        reptile_id: Reptile ID
        scheduled_date_str: Date string in ISO format (YYYY-MM-DD)
        user_id: User ID to send notification to
        channel_id: Notification channel ID to use
        follow_up_number: Which follow-up this is (1, 2, etc.)
    """
    try:
        async with async_session_maker() as db:
            # Parse date first
            scheduled_date = py_date.fromisoformat(scheduled_date_str)

            # 1. CHECK COMPLETION STATUS FIRST
            instance_result = await db.execute(
                select(ScheduleInstance).where(
                    and_(
                        ScheduleInstance.schedule_id == schedule_id,
                        ScheduleInstance.scheduled_date == scheduled_date
                    )
                )
            )
            instance = instance_result.scalar_one_or_none()

            if instance and instance.status == InstanceStatus.COMPLETED.value:
                logger.info(f"Suppressing follow-up for schedule {schedule_id} on {scheduled_date} - already completed")
                return  # SUPPRESS - task complete

            # Fetch all required data
            schedule = await db.get(Schedule, schedule_id)
            reptile = await db.get(Reptile, reptile_id)
            user = await db.get(User, user_id)
            channel = await db.get(NotificationChannel, channel_id)

            if not all([schedule, reptile, user, channel]):
                logger.error(f"Missing data for follow-up: schedule={schedule_id}, reptile={reptile_id}, user={user_id}, channel={channel_id}")
                return

            # Check if channel is still enabled
            if not channel.enabled:
                logger.info(f"Channel {channel_id} is disabled, skipping follow-up notification")
                return

            # 2. CHECK FREQUENCY CAP
            if await is_frequency_cap_reached(db, user_id, reptile_id, scheduled_date):
                logger.info(f"Frequency cap reached for follow-up, reptile {reptile_id} on {scheduled_date}")
                mode = await get_frequency_cap_mode(db, user_id)
                if mode == "summary":
                    await send_frequency_cap_summary_notification(
                        db, user, reptile, channel, scheduled_date
                    )
                return  # SUPPRESS - cap reached

            # Get template for follow_up_reminder trigger type
            template = await get_template_for_trigger(
                db=db,
                trigger_type="follow_up_reminder",
                user_id=user.id,
                channel_type=channel.webhook_type
            )

            # Build context for template rendering
            emoji = get_schedule_type_emoji(schedule.schedule_type)
            schedule_name = schedule.name or f"{schedule.schedule_type.title()}"

            # Build time window string
            time_window = ""
            time_window_display = ""
            if schedule.time_window_enabled and schedule.earliest_time and schedule.latest_time:
                time_window_display = f"{schedule.earliest_time.strftime('%H:%M')} - {schedule.latest_time.strftime('%H:%M')}"
                time_window = f"\nTime window: {time_window_display}"

            # Build schedule URL for links
            schedule_url = f"/schedules/{schedule.id}"

            # Build context
            context = {
                "reptile_name": reptile.name,
                "schedule_name": schedule_name,
                "schedule_type": schedule.schedule_type,
                "emoji": emoji,
                "time_window": time_window,
                "time_window_display": time_window_display,
                "scheduled_date": scheduled_date.strftime('%Y-%m-%d'),
                "due_date": scheduled_date.strftime('%Y-%m-%d'),
                "schedule_url": schedule_url,
                "schedule_id": schedule.id,
                "follow_up_number": follow_up_number,
            }

            # Render template or use fallback
            if template:
                message = render_template(template.message_template, context)
                title = render_template(template.title_template, context) if template.title_template else f"Follow-up Reminder - {reptile.name}"
            else:
                # Fallback to hardcoded message
                message = f"{emoji} **Reminder (follow-up #{follow_up_number}):** {schedule_name} for **{reptile.name}** is still pending{time_window}"
                title = f"Follow-up Reminder - {reptile.name}"

            # Send webhook notification
            if channel.webhook_type != "in_app":
                await send_webhook_notification(
                    webhook_url=channel.webhook_url,
                    webhook_type=channel.webhook_type,
                    message=message,
                    title=title,
                    config=channel.config,
                    context=context,
                    trigger_type="follow_up_reminder",
                    template=template
                )
                logger.info(f"Sent {channel.webhook_type} follow-up #{follow_up_number} for schedule {schedule_id} to user {user.email}")

            # Create in-app notification
            if channel.webhook_type == "in_app":
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
                        "scheduled_date": scheduled_date.isoformat(),
                        "follow_up_number": follow_up_number
                    }
                )
                logger.info(f"Sent in-app follow-up #{follow_up_number} for schedule {schedule_id} to user {user.email}")

            # 3. INCREMENT FREQUENCY COUNTER
            await increment_notification_count(db, user_id, reptile_id, scheduled_date)
            await db.commit()

            # NOTE: Follow-up does NOT schedule another follow-up (prevents infinite chains)

    except Exception as exc:
        logger.error(f"Error sending follow-up reminder: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 60)


@celery_app.task(base=AsyncTask, bind=True, max_retries=3, default_retry_delay=60)
async def send_expiry_alert_task(
    self,
    schedule_id: int,
    reptile_id: int,
    scheduled_date_str: str,
    user_id: int,
    channel_id: int
):
    """
    Celery task to send a window expiry alert notification.

    Sent when the time window is approaching its end (window_start + offset).
    Same completion/frequency checks as main reminder.

    Args:
        schedule_id: Schedule ID
        reptile_id: Reptile ID
        scheduled_date_str: Date string in ISO format (YYYY-MM-DD)
        user_id: User ID to send notification to
        channel_id: Notification channel ID to use
    """
    try:
        async with async_session_maker() as db:
            # Parse date first
            scheduled_date = py_date.fromisoformat(scheduled_date_str)

            # 1. CHECK COMPLETION STATUS FIRST
            instance_result = await db.execute(
                select(ScheduleInstance).where(
                    and_(
                        ScheduleInstance.schedule_id == schedule_id,
                        ScheduleInstance.scheduled_date == scheduled_date
                    )
                )
            )
            instance = instance_result.scalar_one_or_none()

            if instance and instance.status == InstanceStatus.COMPLETED.value:
                logger.info(f"Suppressing expiry alert for schedule {schedule_id} on {scheduled_date} - already completed")
                return  # SUPPRESS - task complete

            # Fetch all required data
            schedule = await db.get(Schedule, schedule_id)
            reptile = await db.get(Reptile, reptile_id)
            user = await db.get(User, user_id)
            channel = await db.get(NotificationChannel, channel_id)

            if not all([schedule, reptile, user, channel]):
                logger.error(f"Missing data for expiry alert: schedule={schedule_id}, reptile={reptile_id}, user={user_id}, channel={channel_id}")
                return

            # Check if channel is still enabled
            if not channel.enabled:
                logger.info(f"Channel {channel_id} is disabled, skipping expiry alert notification")
                return

            # 2. CHECK FREQUENCY CAP
            if await is_frequency_cap_reached(db, user_id, reptile_id, scheduled_date):
                logger.info(f"Frequency cap reached for expiry alert, reptile {reptile_id} on {scheduled_date}")
                mode = await get_frequency_cap_mode(db, user_id)
                if mode == "summary":
                    await send_frequency_cap_summary_notification(
                        db, user, reptile, channel, scheduled_date
                    )
                return  # SUPPRESS - cap reached

            # Get template for expiry_alert trigger type
            template = await get_template_for_trigger(
                db=db,
                trigger_type="expiry_alert",
                user_id=user.id,
                channel_type=channel.webhook_type
            )

            # Build context for template rendering
            emoji = get_schedule_type_emoji(schedule.schedule_type)
            schedule_name = schedule.name or f"{schedule.schedule_type.title()}"

            # Build time window string
            time_window_display = ""
            window_start = ""
            window_end = ""
            if schedule.time_window_enabled and schedule.earliest_time and schedule.latest_time:
                time_window_display = f"{schedule.earliest_time.strftime('%H:%M')} - {schedule.latest_time.strftime('%H:%M')}"
                window_start = schedule.earliest_time.strftime('%H:%M')
                window_end = schedule.latest_time.strftime('%H:%M')

            # Build schedule URL for links
            schedule_url = f"/schedules/{schedule.id}"

            # Build context
            context = {
                "reptile_name": reptile.name,
                "schedule_name": schedule_name,
                "schedule_type": schedule.schedule_type,
                "emoji": emoji,
                "time_window_display": time_window_display,
                "window_start": window_start,
                "window_end": window_end,
                "scheduled_date": scheduled_date.strftime('%Y-%m-%d'),
                "due_date": scheduled_date.strftime('%Y-%m-%d'),
                "schedule_url": schedule_url,
                "schedule_id": schedule.id,
            }

            # Render template or use fallback
            if template:
                message = render_template(template.message_template, context)
                title = render_template(template.title_template, context) if template.title_template else f"Window Closing - {reptile.name}"
            else:
                # Fallback to hardcoded message
                message = f"{emoji} **Window Closing:** {schedule_name} for **{reptile.name}** must be completed by {window_end}"
                title = f"Window Closing - {reptile.name}"

            # Send webhook notification
            if channel.webhook_type != "in_app":
                await send_webhook_notification(
                    webhook_url=channel.webhook_url,
                    webhook_type=channel.webhook_type,
                    message=message,
                    title=title,
                    config=channel.config,
                    context=context,
                    trigger_type="expiry_alert",
                    template=template
                )
                logger.info(f"Sent {channel.webhook_type} expiry alert for schedule {schedule_id} to user {user.email}")

            # Create in-app notification
            if channel.webhook_type == "in_app":
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
                        "scheduled_date": scheduled_date.isoformat(),
                        "alert_type": "expiry_alert"
                    }
                )
                logger.info(f"Sent in-app expiry alert for schedule {schedule_id} to user {user.email}")

            # 3. INCREMENT FREQUENCY COUNTER
            await increment_notification_count(db, user_id, reptile_id, scheduled_date)
            await db.commit()

    except Exception as exc:
        logger.error(f"Error sending expiry alert: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 60)
