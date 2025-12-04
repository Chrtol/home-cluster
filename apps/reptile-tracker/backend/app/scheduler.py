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
from app.models import Schedule, ScheduleCompletion, NotificationSettings, User, Reptile, CompletionStatus, UserNotification, NotificationType
from app.notifications import send_webhook_notification, get_template_for_trigger, render_template

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


async def create_pending_completions():
    """Create pending ScheduleCompletion records for upcoming schedules (next 7 days)"""
    logger.info("Creating pending schedule completions")

    try:
        async with async_session_maker() as db:
            today = datetime.now(timezone.utc).date()

            # Get all enabled schedules
            result = await db.execute(
                select(Schedule).where(Schedule.enabled == True)
            )
            schedules = result.scalars().all()

            logger.info(f"Processing {len(schedules)} enabled schedules")

            for schedule in schedules:
                try:
                    # Create completions for next 7 days
                    for days_ahead in range(7):
                        check_date = today + timedelta(days=days_ahead)

                        # Check if this date matches the schedule
                        if not should_schedule_occur_on_date(schedule, check_date):
                            continue

                        # Check if completion already exists
                        existing = await db.execute(
                            select(ScheduleCompletion).where(
                                and_(
                                    ScheduleCompletion.schedule_id == schedule.id,
                                    ScheduleCompletion.scheduled_date == check_date
                                )
                            )
                        )

                        if existing.scalars().first():
                            continue  # Already exists

                        # Create pending completion
                        completion = ScheduleCompletion(
                            schedule_id=schedule.id,
                            reptile_id=schedule.reptile_id,
                            scheduled_date=check_date,
                            status=CompletionStatus.PENDING
                        )
                        db.add(completion)

                    await db.commit()

                except Exception as e:
                    logger.error(f"Error creating completions for schedule {schedule.id}: {e}", exc_info=True)
                    await db.rollback()
                    continue

    except Exception as e:
        logger.error(f"Error in create_pending_completions: {e}", exc_info=True)


def should_schedule_occur_on_date(schedule: Schedule, check_date: py_date) -> bool:
    """Check if a schedule should occur on a given date"""
    if schedule.schedule_rule == "every_x_days":
        # For every_x_days, we need to check if check_date is a valid occurrence
        # This is simplified - in production you'd track the last occurrence
        return True

    elif schedule.schedule_rule == "days_of_week":
        if not schedule.days_of_week:
            return False
        target_days = [int(d) for d in schedule.days_of_week.split(",")]
        # Convert Python weekday (0=Monday) to our format (0=Sunday)
        weekday = (check_date.weekday() + 1) % 7
        return weekday in target_days

    elif schedule.schedule_rule == "monthly":
        if not schedule.day_of_month:
            return False
        return check_date.day == schedule.day_of_month

    return False


async def check_schedule_reminders():
    """Check for schedules that need reminder notifications"""
    logger.info("Running schedule reminder check")

    try:
        async with async_session_maker() as db:
            now = datetime.now(timezone.utc)
            today = now.date()

            # Get all enabled schedules with reminders configured AND notifications enabled
            result = await db.execute(
                select(Schedule).where(
                    and_(
                        Schedule.enabled == True,
                        Schedule.notifications_enabled == True,
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
                        # Get reptile
                        reptile = await db.get(Reptile, schedule.reptile_id)
                        if not reptile:
                            continue

                        # Get schedule's selected notification channels
                        # Use the relationship to load channels for this schedule
                        await db.refresh(schedule, ["notification_channels"])

                        if not schedule.notification_channels:
                            logger.debug(f"No channels selected for schedule {schedule.id}, skipping")
                            continue

                        # Send reminder to each selected channel
                        for channel in schedule.notification_channels:
                            # Channel must be enabled
                            if not channel.enabled:
                                continue

                            # Get the channel owner's notification settings and user
                            notif_settings = await db.get(NotificationSettings, channel.notification_settings_id)
                            if not notif_settings:
                                continue

                            # Check if owner has schedule reminders enabled
                            if not notif_settings.notify_schedule_reminders:
                                continue

                            # Get the user
                            user = await db.get(User, notif_settings.user_id)
                            if not user:
                                continue

                            # Check if user has access to this reptile
                            from app.permissions import check_reptile_access
                            try:
                                await check_reptile_access(db, user, reptile.id)
                            except:
                                # User doesn't have access, skip
                                continue

                            # Send the reminder
                            await send_schedule_reminder(
                                db=db,
                                reptile=reptile,
                                schedule=schedule,
                                scheduled_date=next_occurrence_date,
                                user=user,
                                webhook_url=channel.webhook_url,
                                webhook_type=channel.webhook_type,
                                config=channel.config
                            )

                            logger.info(
                                f"Sent reminder for schedule {schedule.id} ({schedule.schedule_type}) "
                                f"for reptile {reptile.name} to user {user.email} via channel '{channel.name}'"
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

            # Get all enabled schedules with notifications enabled
            result = await db.execute(
                select(Schedule).where(
                    and_(
                        Schedule.enabled == True,
                        Schedule.notifications_enabled == True
                    )
                )
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

                        # Get schedule's selected notification channels
                        await db.refresh(schedule, ["notification_channels"])

                        if not schedule.notification_channels:
                            logger.debug(f"No channels selected for schedule {schedule.id}, skipping overdue alert")
                            # Still mark as MISSED even if no channels
                            completion.status = CompletionStatus.MISSED
                            await db.commit()
                            continue

                        # Send overdue alert to each selected channel
                        for channel in schedule.notification_channels:
                            # Channel must be enabled
                            if not channel.enabled:
                                continue

                            # Get the channel owner's notification settings and user
                            notif_settings = await db.get(NotificationSettings, channel.notification_settings_id)
                            if not notif_settings:
                                continue

                            # Check if owner has overdue alerts enabled
                            if not notif_settings.notify_overdue_alerts:
                                continue

                            # Get the user
                            user = await db.get(User, notif_settings.user_id)
                            if not user:
                                continue

                            # Check if user has access to this reptile
                            from app.permissions import check_reptile_access
                            try:
                                await check_reptile_access(db, user, reptile.id)
                            except:
                                continue

                            # Send the overdue alert
                            await send_overdue_alert(
                                db=db,
                                reptile=reptile,
                                schedule=schedule,
                                missed_date=yesterday,
                                user=user,
                                webhook_url=channel.webhook_url,
                                webhook_type=channel.webhook_type,
                                config=channel.config
                            )

                            logger.info(
                                f"Sent overdue alert for schedule {schedule.id} "
                                f"for reptile {reptile.name} to user {user.email} via channel '{channel.name}'"
                            )

                        # Mark as MISSED
                        completion.status = CompletionStatus.MISSED
                        await db.commit()

                except Exception as e:
                    logger.error(f"Error processing schedule {schedule.id}: {e}", exc_info=True)
                    continue

    except Exception as e:
        logger.error(f"Error in check_overdue_schedules: {e}", exc_info=True)


async def create_in_app_notification(
    db: AsyncSession,
    user: User,
    notification_type: NotificationType,
    title: str,
    message: str,
    link: str = None,
    notification_metadata: dict = None
):
    """Create an in-app notification for a user"""
    try:
        notification = UserNotification(
            user_id=user.id,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
            notification_metadata=notification_metadata
        )
        db.add(notification)
        await db.commit()
        logger.info(f"Created in-app notification for user {user.email}: {title}")
    except Exception as e:
        logger.error(f"Error creating in-app notification: {e}", exc_info=True)


async def send_schedule_reminder(
    db: AsyncSession,
    reptile: Reptile,
    schedule: Schedule,
    scheduled_date: py_date,
    user: User,
    webhook_url: str,
    webhook_type: str,
    config: dict = None
):
    """Send a schedule reminder notification"""
    # Get template for this trigger
    template = await get_template_for_trigger(
        db=db,
        trigger_type="schedule_reminder",
        user_id=user.id,
        channel_type=webhook_type
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

    await send_webhook_notification(
        webhook_url=webhook_url,
        webhook_type=webhook_type,
        message=message,
        title=title,
        config=config,
        context=context,
        trigger_type="schedule_reminder"
    )

    # Create in-app notification
    await create_in_app_notification(
        db=db,
        user=user,
        notification_type=NotificationType.SCHEDULE_REMINDER,
        title=title,
        message=message,
        link=f"/reptiles/{reptile.id}",
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
    webhook_url: str,
    webhook_type: str,
    config: dict = None
):
    """Send an overdue schedule alert"""
    # Get template for this trigger
    template = await get_template_for_trigger(
        db=db,
        trigger_type="overdue_alert",
        user_id=user.id,
        channel_type=webhook_type
    )

    schedule_name = schedule.name or f"{schedule.schedule_type.title()}"

    context = {
        "reptile_name": reptile.name,
        "schedule_name": schedule_name,
        "schedule_type": schedule.schedule_type,
        "missed_date": missed_date.strftime('%Y-%m-%d'),
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
        title = render_template(template.title_template, context) if template.title_template else f"Overdue Schedule - {reptile.name}"
    else:
        # Fallback to hardcoded message
        message = f"⚠️ **Overdue Alert:** {schedule_name} for **{reptile.name}** was not completed on {missed_date.strftime('%Y-%m-%d')}"
        title = f"Overdue Schedule - {reptile.name}"

    await send_webhook_notification(
        webhook_url=webhook_url,
        webhook_type=webhook_type,
        message=message,
        title=title,
        config=config,
        context=context,
        trigger_type="overdue_alert"
    )

    # Create in-app notification
    await create_in_app_notification(
        db=db,
        user=user,
        notification_type=NotificationType.OVERDUE_ALERT,
        title=title,
        message=message,
        link=f"/reptiles/{reptile.id}",
        notification_metadata={
            "reptile_id": reptile.id,
            "reptile_name": reptile.name,
            "schedule_id": schedule.id,
            "schedule_name": schedule.name or schedule.schedule_type,
            "missed_date": missed_date.isoformat()
        }
    )


def start_scheduler():
    """Start the notification scheduler"""
    global scheduler

    if scheduler is not None:
        logger.warning("Scheduler already started")
        return

    logger.info("Starting notification scheduler")

    scheduler = AsyncIOScheduler(timezone="UTC")

    # Create pending completions once per day at midnight UTC
    scheduler.add_job(
        create_pending_completions,
        trigger="cron",
        hour=0,
        minute=5,
        id="create_completions",
        name="Create pending schedule completions",
        replace_existing=True
    )

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
