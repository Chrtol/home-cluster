"""
Celery tasks for asynchronous notification delivery
"""
import asyncio
import logging
from datetime import date as py_date
from celery import Task
from sqlalchemy.ext.asyncio import AsyncSession
from app.celery_app import celery_app
from app.database import async_session_maker
from app.models import User, Reptile, Schedule, NotificationSettings, NotificationChannel, NotificationType
from app.notifications import send_webhook_notification, get_template_for_trigger, render_template
from app.scheduler import create_in_app_notification, is_within_quiet_hours

logger = logging.getLogger(__name__)


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

            # Parse date
            scheduled_date = py_date.fromisoformat(scheduled_date_str)

            # Get template for this trigger
            template = await get_template_for_trigger(
                db=db,
                trigger_type="schedule_reminder",
                user_id=user.id,
                channel_type=channel.webhook_type
            )

            # Build context for template rendering
            schedule_type_emoji = {
                "feeding": "🍽️",
                "misting": "💧",
                "weighing": "⚖️",
                "supplement": "💊"
            }

            emoji = schedule_type_emoji.get(schedule.schedule_type, "📅")
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
                food_category_display = {
                    "insects": "Insects/Worms",
                    "salad": "Salad/Vegetables",
                    "frozen": "Frozen Prey (Rodents)",
                    "prepared": "Prepared Diet (CGD, Repashy, etc.)",
                    "mixed": "Mixed (Multiple Types)",
                    "other": "Other"
                }
                context["food_category"] = food_category_display.get(schedule.food_category, schedule.food_category.title())

                # Try to get active supplement rotations for this reptile
                from app.models import FeedingRotation, Supplement
                from sqlalchemy import select, and_
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
