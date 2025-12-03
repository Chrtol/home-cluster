"""
Notification scheduler for sending reminders and alerts
"""
import logging
from datetime import datetime, timezone, timedelta, date as py_date
from typing import List, Dict
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models import Schedule, ScheduleCompletion, NotificationSettings, User, Reptile, CompletionStatus
from app.notifications import send_webhook_notification

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = None


def get_next_occurrence_date(schedule: Schedule, from_date: py_date = None) -> py_date:
    """Calculate the next occurrence date for a schedule"""
    if from_date is None:
        from_date = datetime.now(timezone.utc).date()

    if schedule.schedule_rule == "every_x_days":
        if not schedule.frequency_days:
            return from_date
        # For simplicity, just add frequency_days
        return from_date + timedelta(days=schedule.frequency_days)

    elif schedule.schedule_rule == "days_of_week":
        if not schedule.days_of_week:
            return from_date

        # Parse days of week (e.g., "1,3,5" for Mon, Wed, Fri)
        target_days = [int(d) for d in schedule.days_of_week.split(",")]
        current_weekday = from_date.weekday()

        # Find next occurrence
        for i in range(1, 8):  # Check next 7 days
            check_date = from_date + timedelta(days=i)
            # Convert Python weekday (0=Monday) to our format (0=Sunday, 1=Monday, etc.)
            weekday = (check_date.weekday() + 1) % 7
            if weekday in target_days:
                return check_date

        return from_date

    elif schedule.schedule_rule == "monthly":
        if not schedule.day_of_month:
            return from_date

        # Get next occurrence of this day of month
        current_month = from_date.month
        current_year = from_date.year

        # Try current month first
        try:
            next_date = py_date(current_year, current_month, schedule.day_of_month)
            if next_date > from_date:
                return next_date
        except ValueError:
            pass  # Invalid day for this month

        # Try next month
        next_month = current_month + 1
        next_year = current_year
        if next_month > 12:
            next_month = 1
            next_year += 1

        try:
            return py_date(next_year, next_month, schedule.day_of_month)
        except ValueError:
            # If day doesn't exist (e.g., Feb 31), use last day of month
            if next_month == 2:
                return py_date(next_year, next_month, 28)
            elif next_month in [4, 6, 9, 11]:
                return py_date(next_year, next_month, 30)
            else:
                return py_date(next_year, next_month, 31)

    return from_date


async def check_schedule_reminders():
    """Check for schedules that need reminder notifications"""
    logger.info("Running schedule reminder check")

    try:
        async with async_session_maker() as db:
            now = datetime.now(timezone.utc)
            today = now.date()

            # Get all enabled schedules with reminders configured
            result = await db.execute(
                select(Schedule).where(
                    and_(
                        Schedule.enabled == True,
                        Schedule.reminder_minutes_before.isnot(None),
                        Schedule.reminder_minutes_before > 0
                    )
                )
            )
            schedules = result.scalars().all()

            logger.info(f"Found {len(schedules)} schedules with reminders enabled")

            for schedule in schedules:
                try:
                    # Calculate next occurrence
                    next_occurrence_date = get_next_occurrence_date(schedule, today)

                    # Check if there's already a completion for today
                    completion_result = await db.execute(
                        select(ScheduleCompletion).where(
                            and_(
                                ScheduleCompletion.schedule_id == schedule.id,
                                ScheduleCompletion.scheduled_date == next_occurrence_date
                            )
                        )
                    )
                    completion = completion_result.scalars().first()

                    # Skip if already completed
                    if completion and completion.status == CompletionStatus.COMPLETED_ON_TIME:
                        continue

                    # Calculate reminder time
                    # If time window is enabled, use earliest_time, otherwise use current time
                    if schedule.time_window_enabled and schedule.earliest_time:
                        # Combine next_occurrence_date with earliest_time
                        scheduled_datetime = datetime.combine(
                            next_occurrence_date,
                            schedule.earliest_time,
                            tzinfo=timezone.utc
                        )
                    else:
                        # Use noon as default time
                        scheduled_datetime = datetime.combine(
                            next_occurrence_date,
                            datetime.min.time().replace(hour=12),
                            tzinfo=timezone.utc
                        )

                    # Calculate when to send reminder
                    reminder_time = scheduled_datetime - timedelta(minutes=schedule.reminder_minutes_before)

                    # Check if it's time to send reminder (within 5 minute window)
                    time_until_reminder = (reminder_time - now).total_seconds()

                    # Send reminder if within the next check interval (5 minutes)
                    if -300 <= time_until_reminder <= 300:  # 5 minute window
                        # Get reptile and user notification settings
                        reptile = await db.get(Reptile, schedule.reptile_id)
                        if not reptile:
                            continue

                        # Get all users with access to this reptile
                        from app.permissions import get_user_reptiles

                        # Get all users with notification settings
                        notif_result = await db.execute(
                            select(NotificationSettings, User).join(
                                User, NotificationSettings.user_id == User.id
                            ).where(NotificationSettings.webhook_enabled == True)
                        )

                        for notif_settings, user in notif_result:
                            # Check if user has access to this reptile
                            from app.permissions import check_reptile_access
                            try:
                                await check_reptile_access(db, user, reptile.id)
                            except:
                                # User doesn't have access, skip
                                continue

                            # Send reminder
                            await send_schedule_reminder(
                                reptile=reptile,
                                schedule=schedule,
                                scheduled_date=next_occurrence_date,
                                webhook_url=notif_settings.webhook_url,
                                webhook_type=notif_settings.webhook_type
                            )

                            logger.info(
                                f"Sent reminder for schedule {schedule.id} ({schedule.schedule_type}) "
                                f"for reptile {reptile.name} to user {user.email}"
                            )

                except Exception as e:
                    logger.error(f"Error processing schedule {schedule.id}: {e}", exc_info=True)
                    continue

    except Exception as e:
        logger.error(f"Error in check_schedule_reminders: {e}", exc_info=True)


async def check_overdue_schedules():
    """Check for overdue schedules and send alerts"""
    logger.info("Running overdue schedule check")

    try:
        async with async_session_maker() as db:
            now = datetime.now(timezone.utc)
            today = now.date()
            yesterday = today - timedelta(days=1)

            # Get all enabled schedules
            result = await db.execute(
                select(Schedule).where(Schedule.enabled == True)
            )
            schedules = result.scalars().all()

            logger.info(f"Checking {len(schedules)} schedules for overdue items")

            for schedule in schedules:
                try:
                    # Check if yesterday's occurrence was missed
                    completion_result = await db.execute(
                        select(ScheduleCompletion).where(
                            and_(
                                ScheduleCompletion.schedule_id == schedule.id,
                                ScheduleCompletion.scheduled_date == yesterday,
                                ScheduleCompletion.status.in_([
                                    CompletionStatus.PENDING,
                                    CompletionStatus.MISSED
                                ])
                            )
                        )
                    )
                    completion = completion_result.scalars().first()

                    if completion:
                        # Get reptile
                        reptile = await db.get(Reptile, schedule.reptile_id)
                        if not reptile:
                            continue

                        # Get users with notification settings
                        notif_result = await db.execute(
                            select(NotificationSettings, User).join(
                                User, NotificationSettings.user_id == User.id
                            ).where(NotificationSettings.webhook_enabled == True)
                        )

                        for notif_settings, user in notif_result:
                            # Check if user has access
                            from app.permissions import check_reptile_access
                            try:
                                await check_reptile_access(db, user, reptile.id)
                            except:
                                continue

                            # Send overdue alert
                            await send_overdue_alert(
                                reptile=reptile,
                                schedule=schedule,
                                missed_date=yesterday,
                                webhook_url=notif_settings.webhook_url,
                                webhook_type=notif_settings.webhook_type
                            )

                            logger.info(
                                f"Sent overdue alert for schedule {schedule.id} "
                                f"for reptile {reptile.name} to user {user.email}"
                            )

                        # Mark as MISSED
                        completion.status = CompletionStatus.MISSED
                        await db.commit()

                except Exception as e:
                    logger.error(f"Error processing schedule {schedule.id}: {e}", exc_info=True)
                    continue

    except Exception as e:
        logger.error(f"Error in check_overdue_schedules: {e}", exc_info=True)


async def send_schedule_reminder(
    reptile: Reptile,
    schedule: Schedule,
    scheduled_date: py_date,
    webhook_url: str,
    webhook_type: str
):
    """Send a schedule reminder notification"""
    schedule_type_emoji = {
        "feeding": "🍽️",
        "misting": "💧",
        "weighing": "⚖️",
        "supplement": "💊"
    }

    emoji = schedule_type_emoji.get(schedule.schedule_type, "📅")

    # Build message
    schedule_name = schedule.name or f"{schedule.schedule_type.title()}"
    message = f"{emoji} **Reminder:** {schedule_name} for **{reptile.name}**"

    if schedule.time_window_enabled and schedule.earliest_time and schedule.latest_time:
        message += f"\nTime window: {schedule.earliest_time.strftime('%H:%M')} - {schedule.latest_time.strftime('%H:%M')}"

    if schedule.notes:
        message += f"\nNotes: {schedule.notes}"

    title = f"Schedule Reminder - {reptile.name}"

    await send_webhook_notification(
        webhook_url=webhook_url,
        webhook_type=webhook_type,
        message=message,
        title=title
    )


async def send_overdue_alert(
    reptile: Reptile,
    schedule: Schedule,
    missed_date: py_date,
    webhook_url: str,
    webhook_type: str
):
    """Send an overdue schedule alert"""
    schedule_name = schedule.name or f"{schedule.schedule_type.title()}"

    message = (
        f"⚠️ **Overdue Alert:** {schedule_name} for **{reptile.name}** was not completed on "
        f"{missed_date.strftime('%Y-%m-%d')}"
    )

    title = f"Overdue Schedule - {reptile.name}"

    await send_webhook_notification(
        webhook_url=webhook_url,
        webhook_type=webhook_type,
        message=message,
        title=title
    )


def start_scheduler():
    """Start the notification scheduler"""
    global scheduler

    if scheduler is not None:
        logger.warning("Scheduler already started")
        return

    logger.info("Starting notification scheduler")

    scheduler = AsyncIOScheduler(timezone="UTC")

    # Check for reminders every 5 minutes
    scheduler.add_job(
        check_schedule_reminders,
        trigger=IntervalTrigger(minutes=5),
        id="check_reminders",
        name="Check schedule reminders",
        replace_existing=True
    )

    # Check for overdue schedules once per day at 1 AM UTC
    scheduler.add_job(
        check_overdue_schedules,
        trigger="cron",
        hour=1,
        minute=0,
        id="check_overdue",
        name="Check overdue schedules",
        replace_existing=True
    )

    scheduler.start()
    logger.info("Notification scheduler started successfully")


def stop_scheduler():
    """Stop the notification scheduler"""
    global scheduler

    if scheduler is None:
        logger.warning("Scheduler not running")
        return

    logger.info("Stopping notification scheduler")
    scheduler.shutdown()
    scheduler = None
    logger.info("Notification scheduler stopped")
