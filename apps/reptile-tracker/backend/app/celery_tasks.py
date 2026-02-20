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
from app.models import User, Reptile, Schedule, NotificationSettings, NotificationChannel, NotificationType, ScheduleInstance, InstanceStatus, WeightLog
from app.notifications import send_webhook_notification, get_template_for_trigger, render_template, get_template_message
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
            message = render_template(get_template_message(template, channel), context)
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
                message = render_template(get_template_message(template, channel), context)
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
                message = render_template(get_template_message(template, channel), context)
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
                message = render_template(get_template_message(template, channel), context)
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


@celery_app.task(base=AsyncTask, bind=True, max_retries=3, default_retry_delay=60)
async def send_daily_planner_task(
    self,
    user_id: int,
    target_date_str: str,
    instance_ids: list,
    overdue_ids: list
):
    """
    Send daily planner digest notification.

    Args:
        user_id: User ID
        target_date_str: ISO date string (YYYY-MM-DD)
        instance_ids: List of ScheduleInstance IDs for today
        overdue_ids: List of overdue ScheduleInstance IDs (from yesterday)
    """
    logger.info(f"=== CELERY send_daily_planner_task STARTED === user_id={user_id}, date={target_date_str}, instances={len(instance_ids)}, overdue={len(overdue_ids)}")

    from app.scheduler.digest import build_daily_digest_message, build_short_form_message, build_individual_task_message
    from app.scheduler.frequency_cap import increment_notification_count

    try:
        async with async_session_maker() as db:
            user = await db.get(User, user_id)
            if not user:
                logger.error(f"User {user_id} not found for daily planner")
                return

            target_date = py_date.fromisoformat(target_date_str)

            # Get user's notification settings (needed for digest_format)
            settings_result = await db.execute(
                select(NotificationSettings).where(NotificationSettings.user_id == user_id)
            )
            settings = settings_result.scalar_one_or_none()

            if not settings:
                logger.warning(f"No notification settings for user {user_id}")
                return

            # Re-fetch instances from database
            instances = []
            for instance_id in instance_ids:
                instance = await db.get(ScheduleInstance, instance_id)
                if instance and instance.status == InstanceStatus.PENDING:
                    # Eagerly load schedule and reptile
                    await db.refresh(instance, ['schedule'])
                    if instance.schedule:
                        await db.refresh(instance.schedule, ['reptile'])
                    instances.append(instance)

            overdue_instances = []
            for instance_id in overdue_ids:
                instance = await db.get(ScheduleInstance, instance_id)
                if instance and instance.status == InstanceStatus.MISSED:
                    await db.refresh(instance, ['schedule'])
                    if instance.schedule:
                        await db.refresh(instance.schedule, ['reptile'])
                    overdue_instances.append(instance)

            # Skip if all instances were completed since scheduling
            if not instances and not overdue_instances:
                logger.info(f"All tasks completed for user {user_id}, skipping daily planner")
                return

            # Get channels for digest delivery
            # If digest_channel_id is set, use only that channel; otherwise use all enabled channels
            if settings.digest_channel_id:
                logger.info(f"Using specific digest channel: {settings.digest_channel_id}")
                channel = await db.get(NotificationChannel, settings.digest_channel_id)
                if channel and channel.enabled:
                    channels = [channel]
                else:
                    logger.warning(f"Digest channel {settings.digest_channel_id} not found or disabled")
                    channels = []
            else:
                logger.info(f"Using all enabled channels for digest")
                channels_result = await db.execute(
                    select(NotificationChannel).where(
                        NotificationChannel.notification_settings_id == settings.id,
                        NotificationChannel.enabled == True
                    )
                )
                channels = channels_result.scalars().all()

            logger.info(f"Found {len(channels)} channels for digest delivery")

            if not channels:
                logger.info(f"No enabled channels for user {user_id}")
                return

            # Check digest_format setting - branch logic here
            digest_format = settings.digest_format or "grouped"

            if digest_format == "individual":
                # INDIVIDUAL FORMAT: Send separate notification per task
                # Uses build_individual_task_message from digest.py for consistent formatting
                await _send_individual_task_notifications(
                    db=db,
                    user=user,
                    instances=instances,
                    overdue_instances=overdue_instances,
                    channels=channels,
                    target_date=target_date,
                    trigger_prefix="daily_planner"
                )
            else:
                # GROUPED FORMAT: Send single digest message
                await _send_grouped_digest_notification(
                    db=db,
                    user=user,
                    instances=instances,
                    overdue_instances=overdue_instances,
                    channels=channels,
                    target_date=target_date,
                    trigger_type="daily_planner",
                    is_weekly=False
                )

            # Increment frequency counter (1 per reptile mentioned)
            # Per RESEARCH.md: Grouped digest counts as 1 notification per reptile
            reptile_ids = set()
            for instance in instances:
                if instance.schedule:
                    reptile_ids.add(instance.schedule.reptile_id)
            for instance in overdue_instances:
                if instance.schedule:
                    reptile_ids.add(instance.schedule.reptile_id)

            for reptile_id in reptile_ids:
                await increment_notification_count(db, user_id, reptile_id, target_date)

            await db.commit()
            logger.info(f"Daily planner ({digest_format}) sent to user {user.email} for {target_date}")

    except Exception as exc:
        logger.error(f"Error sending daily planner: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 60)


async def _send_individual_task_notifications(
    db: AsyncSession,
    user: User,
    instances: list,
    overdue_instances: list,
    channels: list,
    target_date: py_date,
    trigger_prefix: str
):
    """
    Send individual notifications per task (when digest_format == "individual").

    IMPORTANT: Uses build_individual_task_message from digest.py as single source of truth
    for task message formatting. This ensures consistency with grouped digests.
    """
    from app.scheduler.digest import build_individual_task_message

    # Combine all instances (pending + overdue)
    all_instances = instances + overdue_instances

    for instance in all_instances:
        schedule = instance.schedule
        reptile = schedule.reptile
        is_overdue = instance in overdue_instances

        # Use build_individual_task_message from digest.py for consistent formatting
        task_msg = build_individual_task_message(instance, is_overdue=is_overdue)
        title = task_msg["title"]
        message = task_msg["message"]

        # Determine trigger type for template lookup
        if is_overdue:
            trigger_type = "overdue_alert"  # Reuse existing overdue template
        else:
            trigger_type = "schedule_reminder"  # Reuse existing reminder template

        # Get template for this trigger type
        template = await get_template_for_trigger(
            db=db,
            trigger_type=trigger_type,
            user_id=user.id
        )

        # Send to each enabled channel
        for channel in channels:
            try:
                if channel.webhook_type == "in_app":
                    await create_in_app_notification(
                        db=db,
                        user=user,
                        notification_type=NotificationType.SCHEDULE_REMINDER if not is_overdue else NotificationType.OVERDUE_ALERT,
                        title=title,
                        message=message,
                        link=f"/reptiles/{reptile.id}",
                        notification_metadata={
                            "trigger_type": trigger_type,
                            "schedule_id": schedule.id,
                            "instance_id": instance.id,
                            "from_planner": True
                        }
                    )
                else:
                    await send_webhook_notification(
                        webhook_url=channel.webhook_url,
                        webhook_type=channel.webhook_type,
                        message=message,
                        title=title,
                        config=channel.config,
                        trigger_type=trigger_type,
                        template=template
                    )

                logger.debug(f"Sent individual notification for {schedule.name} via {channel.webhook_type}")

            except Exception as channel_error:
                logger.error(f"Failed to send individual notification to channel {channel.id}: {channel_error}")


async def _send_grouped_digest_notification(
    db: AsyncSession,
    user: User,
    instances: list,
    overdue_instances: list,
    channels: list,
    target_date: py_date,
    trigger_type: str,
    is_weekly: bool = False
):
    """
    Send single grouped digest notification (when digest_format == "grouped").

    This is the original digest behavior - all tasks in one message.
    """
    from app.scheduler.digest import build_daily_digest_message, build_short_form_message

    # Build digest message
    app_url = None  # TODO: Get from config if needed
    digest = build_daily_digest_message(
        instances, overdue_instances, target_date, app_url
    )

    # Get template
    template = await get_template_for_trigger(
        db=db,
        trigger_type=trigger_type,
        user_id=user.id
    )

    # Send to each enabled channel
    # NOTE: Digest does NOT respect quiet hours (per CONTEXT.md - intentional delivery time)
    for channel in channels:
        try:
            if channel.webhook_type == "in_app":
                await create_in_app_notification(
                    db=db,
                    user=user,
                    notification_type=NotificationType.SCHEDULE_REMINDER,
                    title=digest["title"],
                    message=digest["message"],
                    link="/dashboard",
                    notification_metadata={
                        "trigger_type": trigger_type,
                        "target_date": target_date.isoformat()
                    }
                )
            elif channel.webhook_type == "pushover":
                # Use short-form for Pushover
                short_msg = build_short_form_message(
                    instances, overdue_instances, target_date, is_weekly=is_weekly
                )
                await send_webhook_notification(
                    webhook_url=None,
                    webhook_type=channel.webhook_type,
                    message=short_msg,
                    title=digest["title"],
                    config=channel.config,
                    trigger_type=trigger_type,
                    template=template
                )
            else:
                # Discord and other webhooks get full message
                await send_webhook_notification(
                    webhook_url=channel.webhook_url,
                    webhook_type=channel.webhook_type,
                    message=digest["message"],
                    title=digest["title"],
                    config=channel.config,
                    trigger_type=trigger_type,
                    template=template
                )

            logger.info(f"Sent {trigger_type} digest via {channel.webhook_type} to user {user.email}")

        except Exception as channel_error:
            logger.error(f"Failed to send digest to channel {channel.id}: {channel_error}")


@celery_app.task(base=AsyncTask, bind=True, max_retries=3, default_retry_delay=60)
async def send_weight_change_alert_task(
    self,
    reptile_id: int,
    weight_log_id: int,
    alert_context: dict
):
    """
    Celery task to send weight change alert notification.

    Args:
        reptile_id: Reptile ID
        weight_log_id: The weight log that triggered the alert
        alert_context: Dict with baseline_weight, current_weight, change_percent, etc.
    """
    logger.info(f"=== CELERY send_weight_change_alert_task STARTED === reptile_id={reptile_id}, weight_log_id={weight_log_id}")

    try:
        async with async_session_maker() as db:
            # Load entities
            reptile = await db.get(Reptile, reptile_id)
            weight_log = await db.get(WeightLog, weight_log_id)

            if not reptile or not weight_log:
                logger.error(f"Missing data for weight alert: reptile={reptile_id}, weight_log={weight_log_id}")
                return

            # Get users who have access to this reptile (via household)
            from app.permissions import get_reptile_users
            users = await get_reptile_users(db, reptile)

            if not users:
                logger.warning(f"No users with access to reptile {reptile_id}")
                return

            # Get trigger type from detection logic (weight_gain, weight_loss, or growth_milestone)
            trigger_type = alert_context.get("trigger_type", "weight_change_alert")
            age_category = alert_context.get("age_category", "adult")
            is_growth_milestone = alert_context.get("is_growth_milestone", False)

            # Build notification context
            context = {
                "reptile_id": reptile.id,
                "reptile_name": reptile.name,
                "baseline_weight": alert_context["baseline_weight"],
                "current_weight": alert_context["current_weight"],
                "weight_change_grams": alert_context["weight_change_grams"],
                "weight_change_percent": alert_context["weight_change_percent"],
                "change_direction": alert_context["change_direction"],
                "threshold_percent": alert_context["threshold_percent"],
                "age_category": age_category,
                "is_growth_milestone": is_growth_milestone,
                "trigger_type": trigger_type,
            }

            # Send to each user's configured weight alert channel
            for user in users:
                try:
                    # Get user's notification settings
                    settings_result = await db.execute(
                        select(NotificationSettings).where(NotificationSettings.user_id == user.id)
                    )
                    settings = settings_result.scalar_one_or_none()

                    if not settings:
                        logger.debug(f"No notification settings for user {user.id}")
                        continue

                    # Get channels for weight alert delivery
                    # If weight_alert_channel_id is set, use only that channel; otherwise use all enabled channels
                    if settings.weight_alert_channel_id:
                        logger.info(f"Using specific weight alert channel: {settings.weight_alert_channel_id}")
                        channel = await db.get(NotificationChannel, settings.weight_alert_channel_id)
                        if channel and channel.enabled:
                            channels = [channel]
                        else:
                            logger.warning(f"Weight alert channel {settings.weight_alert_channel_id} not found or disabled")
                            channels = []
                    else:
                        logger.info(f"Using all enabled channels for weight alerts")
                        channels_result = await db.execute(
                            select(NotificationChannel).where(
                                NotificationChannel.notification_settings_id == settings.id,
                                NotificationChannel.enabled == True
                            )
                        )
                        channels = channels_result.scalars().all()

                    for channel in channels:
                        try:
                            # Get template for specific trigger type (weight_gain, weight_loss, growth_milestone)
                            template = await get_template_for_trigger(
                                db=db,
                                trigger_type=trigger_type,
                                user_id=user.id,
                                channel_type=channel.webhook_type
                            )

                            # Render template or use fallback
                            if template:
                                message = render_template(get_template_message(template, channel), context)
                                title = render_template(template.title_template, context) if template.title_template else f"Weight Alert - {reptile.name}"
                            else:
                                # Fallback messages based on trigger type
                                change_percent = context['weight_change_percent']
                                if trigger_type == "growth_milestone":
                                    title = f"🎉 {reptile.name}: Growth Milestone!"
                                    message = (
                                        f"🎉 Your {age_category} **{reptile.name}** has hit a growth milestone!\n\n"
                                        f"**Gained:** {change_percent}% ({context['weight_change_grams']:.1f}g)\n"
                                        f"**Now weighing:** {context['current_weight']:.1f}g\n"
                                        f"**Baseline (avg):** {context['baseline_weight']:.1f}g\n\n"
                                        f"Look how much they've grown! 🦎"
                                    )
                                elif trigger_type == "weight_gain":
                                    title = f"{reptile.name}: Weight Gain"
                                    message = (
                                        f"📈 **{reptile.name}** has gained weight.\n\n"
                                        f"**Change:** {change_percent}% ({context['weight_change_grams']:.1f}g)\n"
                                        f"**From:** {context['baseline_weight']:.1f}g → {context['current_weight']:.1f}g"
                                    )
                                else:  # weight_loss
                                    title = f"{reptile.name}: Weight Loss"
                                    message = (
                                        f"📉 **{reptile.name}** has lost weight.\n\n"
                                        f"**Change:** {change_percent}% ({context['weight_change_grams']:.1f}g)\n"
                                        f"**From:** {context['baseline_weight']:.1f}g → {context['current_weight']:.1f}g"
                                    )

                            # Send via webhook or in-app
                            if channel.webhook_type == "in_app":
                                await create_in_app_notification(
                                    db=db,
                                    user=user,
                                    notification_type=NotificationType.HEALTH_EVENT,
                                    title=title,
                                    message=message,
                                    link=f"/reptiles/{reptile.id}",
                                    notification_metadata={
                                        "reptile_id": reptile.id,
                                        "weight_log_id": weight_log_id,
                                        "alert_type": trigger_type,
                                        **context
                                    }
                                )
                            else:
                                await send_webhook_notification(
                                    webhook_url=channel.webhook_url,
                                    webhook_type=channel.webhook_type,
                                    message=message,
                                    title=title,
                                    config=channel.config,
                                    context=context,
                                    trigger_type=trigger_type,
                                    template=template
                                )

                            logger.info(f"Sent weight alert via {channel.webhook_type} for reptile {reptile.name} to user {user.email}")

                        except Exception as channel_error:
                            logger.error(f"Failed to send weight alert to channel {channel.id}: {channel_error}")

                except Exception as user_error:
                    logger.error(f"Failed to send weight alert to user {user.id}: {user_error}")

            # Update tracking record (marks alert as sent, starts 7-day cooldown)
            from app.scheduler.weight_alerts import update_weight_alert_tracking
            await update_weight_alert_tracking(db, reptile_id, weight_log_id)
            await db.commit()

            logger.info(f"Weight change alert sent for reptile {reptile.name}")

    except Exception as exc:
        logger.error(f"Error sending weight change alert: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 60)


@celery_app.task(base=AsyncTask, bind=True, max_retries=3, default_retry_delay=60)
async def send_change_alert_notification_task(
    self,
    reptile_id: int,
    alert_context: dict
):
    """
    Celery task to send change alert notification (feeding or measurement).

    Args:
        reptile_id: Reptile ID
        alert_context: Dict with alert details (trigger_type, values, etc.)
    """
    logger.info(f"=== CELERY send_change_alert_notification_task STARTED === reptile_id={reptile_id}")

    try:
        async with async_session_maker() as db:
            # Load reptile
            reptile = await db.get(Reptile, reptile_id)

            if not reptile:
                logger.error(f"Reptile {reptile_id} not found for change alert")
                return

            # Get users who have access to this reptile
            from app.permissions import get_reptile_users
            users = await get_reptile_users(db, reptile)

            if not users:
                logger.warning(f"No users with access to reptile {reptile_id}")
                return

            trigger_type = alert_context.get("trigger_type")
            if not trigger_type:
                logger.error(f"No trigger_type in alert_context: {alert_context}")
                return

            # Send to each user's configured channels
            for user in users:
                try:
                    # Get user's notification settings
                    settings_result = await db.execute(
                        select(NotificationSettings).where(NotificationSettings.user_id == user.id)
                    )
                    settings = settings_result.scalar_one_or_none()

                    if not settings:
                        logger.debug(f"No notification settings for user {user.id}")
                        continue

                    # Get enabled channels
                    channels_result = await db.execute(
                        select(NotificationChannel).where(
                            NotificationChannel.notification_settings_id == settings.id,
                            NotificationChannel.enabled == True
                        )
                    )
                    channels = channels_result.scalars().all()

                    for channel in channels:
                        try:
                            # Get template for trigger type
                            template = await get_template_for_trigger(
                                db=db,
                                trigger_type=trigger_type,
                                user_id=user.id,
                                channel_type=channel.webhook_type
                            )

                            # Build notification context
                            context = {
                                "reptile_id": reptile.id,
                                "reptile_name": reptile.name,
                                **alert_context
                            }

                            # Render template or use fallback
                            if template:
                                message = render_template(get_template_message(template, channel), context)
                                title = render_template(template.title_template, context) if template.title_template else f"Alert - {reptile.name}"
                            else:
                                # Fallback messages based on trigger type
                                if trigger_type == "feeding_decrease":
                                    title = f"{reptile.name}: Feeding Decrease"
                                    message = alert_context.get("message", "Feeding quantity decreased")
                                elif trigger_type == "feeding_increase":
                                    title = f"{reptile.name}: Feeding Increase"
                                    message = alert_context.get("message", "Feeding quantity increased")
                                elif trigger_type == "feeding_none_logged":
                                    title = f"{reptile.name}: No Feedings Logged"
                                    message = alert_context.get("message", "No feedings logged recently")
                                elif trigger_type == "measurement_increase":
                                    title = f"{reptile.name}: Measurement Increase"
                                    message = alert_context.get("message", "Measurement increased")
                                elif trigger_type == "measurement_decrease":
                                    title = f"{reptile.name}: Measurement Decrease"
                                    message = alert_context.get("message", "Measurement decreased")
                                else:
                                    title = f"{reptile.name}: Change Alert"
                                    message = alert_context.get("message", "Change detected")

                            # Send via webhook or in-app
                            if channel.webhook_type == "in_app":
                                await create_in_app_notification(
                                    db=db,
                                    user=user,
                                    notification_type=NotificationType.HEALTH_EVENT,
                                    title=title,
                                    message=message,
                                    link=f"/reptiles/{reptile.id}",
                                    notification_metadata={
                                        "reptile_id": reptile.id,
                                        "alert_type": trigger_type,
                                        **context
                                    }
                                )
                            else:
                                await send_webhook_notification(
                                    webhook_url=channel.webhook_url,
                                    webhook_type=channel.webhook_type,
                                    message=message,
                                    title=title,
                                    config=channel.config,
                                    context=context,
                                    trigger_type=trigger_type,
                                    template=template
                                )

                            logger.info(f"Sent change alert via {channel.webhook_type} for reptile {reptile.name} to user {user.email}")

                        except Exception as channel_error:
                            logger.error(f"Failed to send change alert to channel {channel.id}: {channel_error}")

                except Exception as user_error:
                    logger.error(f"Failed to send change alert to user {user.id}: {user_error}")

            # Update tracking record (marks alert as sent, starts cooldown)
            # Uses alert_type from context for generic tracking across all alert types
            alert_type = alert_context.get("alert_type")
            if alert_type:
                from app.models import ChangeAlertTracking
                from datetime import datetime, timezone as tz

                tracking_result = await db.execute(
                    select(ChangeAlertTracking).where(
                        ChangeAlertTracking.reptile_id == reptile_id,
                        ChangeAlertTracking.alert_type == alert_type
                    )
                )
                tracking = tracking_result.scalar_one_or_none()
                now = datetime.now(tz.utc)

                if tracking:
                    tracking.last_alert_at = now
                    tracking.last_alert_context = alert_context
                    tracking.updated_at = now
                else:
                    tracking = ChangeAlertTracking(
                        reptile_id=reptile_id,
                        alert_type=alert_type,
                        last_alert_at=now,
                        last_alert_context=alert_context
                    )
                    db.add(tracking)

                await db.commit()
                logger.info(f"Updated tracking for {alert_type} alert on reptile {reptile.name}")

            logger.info(f"Change alert sent for reptile {reptile.name}")

    except Exception as exc:
        logger.error(f"Error sending change alert: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 60)


@celery_app.task(base=AsyncTask, bind=True, max_retries=3, default_retry_delay=60)
async def send_weekly_planner_task(
    self,
    user_id: int,
    start_date_str: str,
    instances_by_date: dict
):
    """
    Send weekly planner digest notification.

    Args:
        user_id: User ID
        start_date_str: ISO date string for start of week (day 1 of 7-day preview)
        instances_by_date: Dict of {date_iso: [instance_ids]} for the week
    """
    logger.info(f"=== CELERY send_weekly_planner_task STARTED === user_id={user_id}, start_date={start_date_str}, days={len(instances_by_date)}")

    from app.scheduler.digest import build_weekly_digest_message, build_individual_task_message

    try:
        async with async_session_maker() as db:
            user = await db.get(User, user_id)
            if not user:
                logger.error(f"User {user_id} not found for weekly planner")
                return

            start_date = py_date.fromisoformat(start_date_str)

            # Get settings for digest_format
            settings_result = await db.execute(
                select(NotificationSettings).where(NotificationSettings.user_id == user_id)
            )
            settings = settings_result.scalar_one_or_none()

            if not settings:
                return

            # Re-fetch and rebuild instances_by_date
            rebuilt: dict = {}
            all_instances_flat = []
            for date_str, instance_ids in instances_by_date.items():
                d = py_date.fromisoformat(date_str)
                rebuilt[d] = []
                for instance_id in instance_ids:
                    instance = await db.get(ScheduleInstance, instance_id)
                    if instance and instance.status == InstanceStatus.PENDING:
                        await db.refresh(instance, ['schedule'])
                        if instance.schedule:
                            await db.refresh(instance.schedule, ['reptile'])
                        rebuilt[d].append(instance)
                        all_instances_flat.append(instance)

            # Skip if all instances were completed
            total = sum(len(v) for v in rebuilt.values())
            if total == 0:
                logger.info(f"All weekly tasks completed for user {user_id}, skipping")
                return

            # Get channels for digest delivery
            # If digest_channel_id is set, use only that channel; otherwise use all enabled channels
            if settings.digest_channel_id:
                logger.info(f"Using specific digest channel for weekly: {settings.digest_channel_id}")
                channel = await db.get(NotificationChannel, settings.digest_channel_id)
                if channel and channel.enabled:
                    channels = [channel]
                else:
                    logger.warning(f"Digest channel {settings.digest_channel_id} not found or disabled for weekly")
                    channels = []
            else:
                logger.info(f"Using all enabled channels for weekly digest")
                channels_result = await db.execute(
                    select(NotificationChannel).where(
                        NotificationChannel.notification_settings_id == settings.id,
                        NotificationChannel.enabled == True
                    )
                )
                channels = channels_result.scalars().all()

            logger.info(f"Found {len(channels)} channels for weekly digest delivery")

            if not channels:
                logger.info(f"No enabled channels for weekly planner user {user_id}")
                return

            # Check digest_format - branch logic
            digest_format = settings.digest_format or "grouped"

            if digest_format == "individual":
                # INDIVIDUAL FORMAT: Send separate notification per task
                # Uses build_individual_task_message from digest.py for consistent formatting
                await _send_individual_task_notifications(
                    db=db,
                    user=user,
                    instances=all_instances_flat,
                    overdue_instances=[],  # Weekly doesn't have overdue concept
                    channels=channels,
                    target_date=start_date,
                    trigger_prefix="weekly_planner"
                )
            else:
                # GROUPED FORMAT: Send single weekly digest message
                app_url = None
                digest = build_weekly_digest_message(rebuilt, start_date, app_url)

                template = await get_template_for_trigger(
                    db=db,
                    trigger_type="weekly_planner",
                    user_id=user_id
                )

                # Send to each channel
                for channel in channels:
                    try:
                        if channel.webhook_type == "in_app":
                            await create_in_app_notification(
                                db=db,
                                user=user,
                                notification_type=NotificationType.SCHEDULE_REMINDER,
                                title=digest["title"],
                                message=digest["message"],
                                link="/dashboard",
                                notification_metadata={
                                    "trigger_type": "weekly_planner",
                                    "start_date": start_date_str
                                }
                            )
                        elif channel.webhook_type == "pushover":
                            # Short form for Pushover
                            msg = f"{total} tasks this week. Open app for details."
                            await send_webhook_notification(
                                webhook_url=None,
                                webhook_type=channel.webhook_type,
                                message=msg,
                                title=digest["title"],
                                config=channel.config,
                                trigger_type="weekly_planner",
                                template=template
                            )
                        else:
                            await send_webhook_notification(
                                webhook_url=channel.webhook_url,
                                webhook_type=channel.webhook_type,
                                message=digest["message"],
                                title=digest["title"],
                                config=channel.config,
                                trigger_type="weekly_planner",
                                template=template
                            )

                        logger.info(f"Sent weekly planner via {channel.webhook_type} to user {user.email}")

                    except Exception as channel_error:
                        logger.error(f"Failed to send to channel {channel.id}: {channel_error}")

            await db.commit()
            logger.info(f"Weekly planner ({digest_format}) sent to user {user.email}")

    except Exception as exc:
        logger.error(f"Error sending weekly planner: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 60)
