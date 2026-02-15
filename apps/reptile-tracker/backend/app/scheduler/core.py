"""
Notification scheduler for sending reminders and alerts
"""
import logging
from datetime import datetime, timezone, timedelta, date as py_date, time as py_time
from zoneinfo import ZoneInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, and_, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.database import async_session_maker
from app.models import Schedule, ScheduleCompletion, NotificationSettings, NotificationChannel, User, Reptile, CompletionStatus, UserNotification, NotificationType, ScheduledNotificationJob, AccessLevel, household_members, ScheduleMode, InstanceStatus
from opentelemetry import trace

# Import notification job functions from scheduler.jobs module (Phase 2 extraction)
from .jobs import (
    schedule_notification_jobs_for_schedule as _schedule_notification_jobs_for_schedule,
    schedule_notifications_for_interval_instance as _schedule_notifications_for_interval_instance,
    cancel_notification_jobs_for_schedule as _cancel_notification_jobs_for_schedule,
    reschedule_notification_jobs_for_schedule as _reschedule_notification_jobs_for_schedule,
)

# Import auto-complete functions from scheduler.auto_complete module (Phase 3 extraction)
from .auto_complete import (
    _perform_autocomplete,
    execute_autocomplete_job,
    schedule_autocomplete_for_instance as _schedule_autocomplete_for_instance,
)

# Import notification sender functions from scheduler.notifications module (Phase 4 extraction)
from .notifications import (
    send_schedule_reminder,
    send_overdue_alert,
    send_interval_warning_notification,
)

# Import overdue detection from scheduler.overdue module (Phase 4 extraction)
from .overdue import check_overdue_schedules

# Import digest functions from scheduler.digest module (Phase 23 - Notification Planner)
from .digest import (
    get_pending_instances_for_date,
    get_overdue_instances_for_user,
    get_weekly_instances,
    build_daily_digest_message,
    build_weekly_digest_message,
    build_short_form_message,
)

logger = logging.getLogger(__name__)

__all__ = [
    # Global instance
    "scheduler",
    # Lifecycle
    "start_scheduler",
    "stop_scheduler",
    # Wrapper functions (maintain backward compat)
    "schedule_notification_jobs_for_schedule",
    "schedule_notifications_for_interval_instance",
    "cancel_notification_jobs_for_schedule",
    "reschedule_notification_jobs_for_schedule",
    # Callbacks used by jobs.py
    "execute_scheduled_notification",
    "execute_follow_up_notification",
    "execute_expiry_alert",
    "should_schedule_occur_on_date",
    # Other public functions used by routers
    "create_in_app_notification",
    "send_schedule_reminder",
    "is_within_quiet_hours",
    "schedule_autocomplete_for_instance",
    # Planner digest scheduling functions (Phase 23)
    "schedule_daily_planner_jobs",
    "schedule_weekly_planner_jobs",
    "execute_daily_planner_delivery",
    "execute_weekly_planner_delivery",
    # Weight alert sweep (Phase 24)
    "daily_weight_alert_sweep",
]


def get_tracer():
    """Get the OpenTelemetry tracer lazily to ensure TracerProvider is fully configured."""
    return trace.get_tracer(__name__)

# Critical notification types that bypass quiet hours
CRITICAL_NOTIFICATION_TYPES = {
    NotificationType.HEALTH_EVENT,
    NotificationType.SYSTEM
}

# Global scheduler instance
scheduler = None


def is_within_quiet_hours(
    notification_settings: NotificationSettings,
    notification_type: NotificationType = None,
    current_time: datetime = None
) -> bool:
    """
    Check if current time is within user's quiet hours.
    Critical notifications bypass quiet hours.

    Args:
        notification_settings: User's notification settings
        notification_type: Type of notification (for critical check)
        current_time: Current datetime (defaults to now in UTC)

    Returns:
        True if within quiet hours and notification should be suppressed
    """
    # Critical notifications always bypass quiet hours
    if notification_type and notification_type in CRITICAL_NOTIFICATION_TYPES:
        return False

    # If quiet hours not enabled, always send
    if not notification_settings.quiet_hours_enabled:
        return False

    # If times not configured, treat as not within quiet hours
    if not notification_settings.quiet_hours_start or not notification_settings.quiet_hours_end:
        return False

    if current_time is None:
        current_time = datetime.now(timezone.utc)

    current_time_only = current_time.time()
    start = notification_settings.quiet_hours_start
    end = notification_settings.quiet_hours_end

    # Handle quiet hours that span midnight (e.g., 22:00 to 08:00)
    if start > end:
        # Quiet hours span midnight
        return current_time_only >= start or current_time_only <= end
    else:
        # Normal case (e.g., 01:00 to 06:00)
        return start <= current_time_only <= end


async def execute_scheduled_notification(
    schedule_id: int,
    user_id: int,
    channel_id: int,
    scheduled_date: py_date,
    job_id: str
):
    """
    Execute a scheduled notification job (called by APScheduler at exact time)
    This function queues the notification to Celery
    """
    try:
        async with async_session_maker() as db:
            # Get the scheduled job record
            job_record = await db.execute(
                select(ScheduledNotificationJob).where(ScheduledNotificationJob.job_id == job_id)
            )
            job_record = job_record.scalars().first()

            if not job_record or job_record.status != "pending":
                logger.warning(f"Job {job_id} not found or already processed, skipping")
                return

            # Get schedule, reptile, user, and channel
            schedule = await db.get(Schedule, schedule_id)
            if not schedule or not schedule.enabled or not schedule.notifications_enabled:
                logger.info(f"Schedule {schedule_id} disabled, marking job as cancelled")
                job_record.status = "cancelled"
                await db.commit()
                return

            reptile = await db.get(Reptile, schedule.reptile_id)
            user = await db.get(User, user_id)
            channel = await db.get(NotificationChannel, channel_id)

            if not reptile or not user or not channel or not channel.enabled:
                logger.warning(f"Missing required entities for job {job_id}, marking as cancelled")
                job_record.status = "cancelled"
                await db.commit()
                return

            # Check if already completed
            completion = await db.execute(
                select(ScheduleCompletion).where(
                    and_(
                        ScheduleCompletion.schedule_id == schedule_id,
                        ScheduleCompletion.scheduled_date == scheduled_date,
                        ScheduleCompletion.status == CompletionStatus.COMPLETED_ON_TIME
                    )
                )
            )
            if completion.scalars().first():
                logger.info(f"Schedule {schedule_id} already completed for {scheduled_date}, skipping notification")
                job_record.status = "cancelled"
                await db.commit()
                return

            # Check quiet hours
            notif_settings = await db.execute(
                select(NotificationSettings).where(NotificationSettings.user_id == user_id)
            )
            notif_settings = notif_settings.scalars().first()

            if notif_settings and is_within_quiet_hours(notif_settings, NotificationType.SCHEDULE_REMINDER, datetime.now(timezone.utc)):
                logger.info(f"Skipping job {job_id} - within quiet hours")
                job_record.status = "cancelled"
                await db.commit()
                return

            # Check user access
            from app.permissions import check_reptile_access
            try:
                await check_reptile_access(db, user, reptile.id)
            except HTTPException:
                # User lacks access - skip notification
                logger.warning(f"User {user_id} no longer has access to reptile {reptile.id}")
                job_record.status = "cancelled"
                await db.commit()
                return

            # Queue to Celery with trace context propagation
            try:
                from app.celery_tasks import send_schedule_reminder_task

                # Create a trace span so Celery instrumentation can propagate context
                with get_tracer().start_as_current_span(
                    "dispatch_schedule_reminder",
                    attributes={
                        "schedule.id": schedule.id,
                        "schedule.type": schedule.schedule_type,
                        "reptile.id": reptile.id,
                        "reptile.name": reptile.name,
                        "user.id": user.id,
                        "channel.id": channel.id,
                    }
                ):
                    send_schedule_reminder_task.delay(
                        schedule_id=schedule.id,
                        reptile_id=reptile.id,
                        scheduled_date_str=scheduled_date.isoformat(),
                        user_id=user.id,
                        channel_id=channel.id
                    )

                logger.info(
                    f"Queued exact-time reminder for schedule {schedule.id} ({schedule.schedule_type}) "
                    f"for reptile {reptile.name} to user {user.email} via channel '{channel.name}'"
                )

                job_record.status = "sent"
                await db.commit()

            except Exception as celery_error:
                logger.error(f"Failed to queue job {job_id} to Celery: {celery_error}")
                job_record.status = "failed"
                await db.commit()

                # Fallback: Send directly
                from app.scheduler import send_schedule_reminder
                await send_schedule_reminder(
                    db=db,
                    reptile=reptile,
                    schedule=schedule,
                    scheduled_date=scheduled_date,
                    user=user,
                    webhook_url=channel.webhook_url,
                    webhook_type=channel.webhook_type,
                    config=channel.config
                )

    except Exception as e:
        logger.error(f"Error executing scheduled notification job {job_id}: {e}", exc_info=True)


async def execute_follow_up_notification(
    schedule_id: int,
    user_id: int,
    channel_id: int,
    scheduled_date: py_date,
    job_id: str
):
    """
    Execute a follow-up reminder job (called by APScheduler).
    Queues to Celery for actual delivery.

    Follow-ups are similar to main reminders but:
    - Use follow_up_reminder trigger type for templates
    - Do NOT schedule another follow-up (prevents infinite chains)
    """
    try:
        async with async_session_maker() as db:
            # Get the scheduled job record
            job_record = await db.execute(
                select(ScheduledNotificationJob).where(ScheduledNotificationJob.job_id == job_id)
            )
            job_record = job_record.scalars().first()

            if not job_record or job_record.status != "pending":
                logger.warning(f"Follow-up job {job_id} not found or already processed, skipping")
                return

            # Get schedule, reptile, user, and channel
            schedule = await db.get(Schedule, schedule_id)
            if not schedule or not schedule.enabled or not schedule.notifications_enabled:
                logger.info(f"Schedule {schedule_id} disabled, marking follow-up job as cancelled")
                job_record.status = "cancelled"
                await db.commit()
                return

            reptile = await db.get(Reptile, schedule.reptile_id)
            user = await db.get(User, user_id)
            channel = await db.get(NotificationChannel, channel_id)

            if not reptile or not user or not channel or not channel.enabled:
                logger.warning(f"Missing required entities for follow-up job {job_id}, marking as cancelled")
                job_record.status = "cancelled"
                await db.commit()
                return

            # Check if already completed - if so, suppress follow-up
            completion = await db.execute(
                select(ScheduleCompletion).where(
                    and_(
                        ScheduleCompletion.schedule_id == schedule_id,
                        ScheduleCompletion.scheduled_date == scheduled_date,
                        ScheduleCompletion.status == CompletionStatus.COMPLETED_ON_TIME
                    )
                )
            )
            if completion.scalars().first():
                logger.info(f"Schedule {schedule_id} already completed for {scheduled_date}, suppressing follow-up")
                job_record.status = "cancelled"
                await db.commit()
                return

            # Check quiet hours
            notif_settings = await db.execute(
                select(NotificationSettings).where(NotificationSettings.user_id == user_id)
            )
            notif_settings = notif_settings.scalars().first()

            if notif_settings and is_within_quiet_hours(notif_settings, NotificationType.SCHEDULE_REMINDER, datetime.now(timezone.utc)):
                logger.info(f"Skipping follow-up job {job_id} - within quiet hours")
                job_record.status = "cancelled"
                await db.commit()
                return

            # Check user access
            from app.permissions import check_reptile_access
            try:
                await check_reptile_access(db, user, reptile.id)
            except HTTPException:
                logger.warning(f"User {user_id} no longer has access to reptile {reptile.id}")
                job_record.status = "cancelled"
                await db.commit()
                return

            # Queue to Celery
            try:
                from app.celery_tasks import send_follow_up_reminder_task

                with get_tracer().start_as_current_span(
                    "dispatch_follow_up_reminder",
                    attributes={
                        "schedule.id": schedule.id,
                        "schedule.type": schedule.schedule_type,
                        "reptile.id": reptile.id,
                        "reptile.name": reptile.name,
                        "user.id": user.id,
                        "channel.id": channel.id,
                    }
                ):
                    send_follow_up_reminder_task.delay(
                        schedule_id=schedule.id,
                        reptile_id=reptile.id,
                        scheduled_date_str=scheduled_date.isoformat(),
                        user_id=user.id,
                        channel_id=channel.id,
                        follow_up_number=1
                    )

                logger.info(
                    f"Queued follow-up reminder for schedule {schedule.id} ({schedule.schedule_type}) "
                    f"for reptile {reptile.name} to user {user.email} via channel '{channel.name}'"
                )

                job_record.status = "sent"
                await db.commit()

            except Exception as celery_error:
                logger.error(f"Failed to queue follow-up job {job_id} to Celery: {celery_error}")
                job_record.status = "failed"
                await db.commit()

    except Exception as e:
        logger.error(f"Error executing follow-up notification job {job_id}: {e}", exc_info=True)


async def execute_expiry_alert(
    schedule_id: int,
    user_id: int,
    channel_id: int,
    scheduled_date: py_date,
    job_id: str
):
    """
    Execute an expiry alert job (called by APScheduler).
    Queues to Celery for actual delivery.

    Expiry alerts are sent when the time window is closing.
    """
    try:
        async with async_session_maker() as db:
            # Get the scheduled job record
            job_record = await db.execute(
                select(ScheduledNotificationJob).where(ScheduledNotificationJob.job_id == job_id)
            )
            job_record = job_record.scalars().first()

            if not job_record or job_record.status != "pending":
                logger.warning(f"Expiry alert job {job_id} not found or already processed, skipping")
                return

            # Get schedule, reptile, user, and channel
            schedule = await db.get(Schedule, schedule_id)
            if not schedule or not schedule.enabled or not schedule.notifications_enabled:
                logger.info(f"Schedule {schedule_id} disabled, marking expiry alert job as cancelled")
                job_record.status = "cancelled"
                await db.commit()
                return

            reptile = await db.get(Reptile, schedule.reptile_id)
            user = await db.get(User, user_id)
            channel = await db.get(NotificationChannel, channel_id)

            if not reptile or not user or not channel or not channel.enabled:
                logger.warning(f"Missing required entities for expiry alert job {job_id}, marking as cancelled")
                job_record.status = "cancelled"
                await db.commit()
                return

            # Check if already completed - if so, suppress expiry alert
            completion = await db.execute(
                select(ScheduleCompletion).where(
                    and_(
                        ScheduleCompletion.schedule_id == schedule_id,
                        ScheduleCompletion.scheduled_date == scheduled_date,
                        ScheduleCompletion.status == CompletionStatus.COMPLETED_ON_TIME
                    )
                )
            )
            if completion.scalars().first():
                logger.info(f"Schedule {schedule_id} already completed for {scheduled_date}, suppressing expiry alert")
                job_record.status = "cancelled"
                await db.commit()
                return

            # Check quiet hours
            notif_settings = await db.execute(
                select(NotificationSettings).where(NotificationSettings.user_id == user_id)
            )
            notif_settings = notif_settings.scalars().first()

            if notif_settings and is_within_quiet_hours(notif_settings, NotificationType.SCHEDULE_REMINDER, datetime.now(timezone.utc)):
                logger.info(f"Skipping expiry alert job {job_id} - within quiet hours")
                job_record.status = "cancelled"
                await db.commit()
                return

            # Check user access
            from app.permissions import check_reptile_access
            try:
                await check_reptile_access(db, user, reptile.id)
            except HTTPException:
                logger.warning(f"User {user_id} no longer has access to reptile {reptile.id}")
                job_record.status = "cancelled"
                await db.commit()
                return

            # Queue to Celery
            try:
                from app.celery_tasks import send_expiry_alert_task

                with get_tracer().start_as_current_span(
                    "dispatch_expiry_alert",
                    attributes={
                        "schedule.id": schedule.id,
                        "schedule.type": schedule.schedule_type,
                        "reptile.id": reptile.id,
                        "reptile.name": reptile.name,
                        "user.id": user.id,
                        "channel.id": channel.id,
                    }
                ):
                    send_expiry_alert_task.delay(
                        schedule_id=schedule.id,
                        reptile_id=reptile.id,
                        scheduled_date_str=scheduled_date.isoformat(),
                        user_id=user.id,
                        channel_id=channel.id
                    )

                logger.info(
                    f"Queued expiry alert for schedule {schedule.id} ({schedule.schedule_type}) "
                    f"for reptile {reptile.name} to user {user.email} via channel '{channel.name}'"
                )

                job_record.status = "sent"
                await db.commit()

            except Exception as celery_error:
                logger.error(f"Failed to queue expiry alert job {job_id} to Celery: {celery_error}")
                job_record.status = "failed"
                await db.commit()

    except Exception as e:
        logger.error(f"Error executing expiry alert job {job_id}: {e}", exc_info=True)


# Wrapper functions that pass global scheduler to extracted job management functions
# These maintain backward compatibility for existing call sites while using the
# extracted functions from scheduler.jobs module

async def schedule_notification_jobs_for_schedule(schedule_id: int, days_ahead: int = 7):
    """
    Schedule notification jobs for a given schedule for the next N days.
    Wrapper that passes global scheduler instance to extracted function.

    Args:
        schedule_id: The Schedule ID
        days_ahead: How many days ahead to schedule (default 7)
    """
    global scheduler
    await _schedule_notification_jobs_for_schedule(scheduler, schedule_id, days_ahead)


async def schedule_notifications_for_interval_instance(
    db: AsyncSession,
    schedule: Schedule,
    instance_date: py_date
):
    """
    Schedule notification jobs for a specific interval schedule instance.
    Wrapper that passes global scheduler instance to extracted function.

    Args:
        db: Database session
        schedule: The interval schedule (must be loaded with notification_channels)
        instance_date: The date of the interval instance to schedule notifications for
    """
    global scheduler
    await _schedule_notifications_for_interval_instance(scheduler, db, schedule, instance_date)


async def cancel_notification_jobs_for_schedule(schedule_id: int):
    """
    Cancel and delete all notification jobs for a schedule.
    Wrapper that passes global scheduler instance to extracted function.

    Args:
        schedule_id: The schedule ID to cancel jobs for
    """
    global scheduler
    await _cancel_notification_jobs_for_schedule(scheduler, schedule_id)


async def reschedule_notification_jobs_for_schedule(schedule_id: int):
    """
    Reschedule notification jobs for a schedule (cancel old, create new).
    Wrapper that passes global scheduler instance to extracted function.

    Args:
        schedule_id: The schedule ID to reschedule
    """
    global scheduler
    await _reschedule_notification_jobs_for_schedule(scheduler, schedule_id)


async def schedule_autocomplete_for_instance(
    instance: "ScheduleInstance",
    schedule: Schedule,
    user_tz: ZoneInfo
):
    """
    Schedule an autocomplete job for a specific schedule instance.
    Wrapper that passes global scheduler instance to extracted function.

    Args:
        instance: The schedule instance to autocomplete
        schedule: The schedule this instance belongs to
        user_tz: Timezone of the household owner/manager
    """
    global scheduler
    await _schedule_autocomplete_for_instance(scheduler, instance, schedule, user_tz)


async def rebuild_notification_jobs_from_db():
    """
    Rebuild APScheduler jobs from database on startup
    This recovers jobs after pod restarts
    """
    global scheduler

    if not scheduler:
        logger.warning("Scheduler not initialized, cannot rebuild jobs")
        return

    try:
        async with async_session_maker() as db:
            # Get all pending jobs that are in the future
            now_utc = datetime.now(timezone.utc)

            result = await db.execute(
                select(ScheduledNotificationJob).where(
                    and_(
                        ScheduledNotificationJob.status == "pending",
                        ScheduledNotificationJob.scheduled_time_utc > now_utc
                    )
                ).order_by(ScheduledNotificationJob.scheduled_time_utc)
            )
            pending_jobs = result.scalars().all()

            if not pending_jobs:
                logger.info("No pending notification jobs to rebuild")
                return

            logger.info(f"Rebuilding {len(pending_jobs)} jobs from database")

            notification_count = 0
            autocomplete_count = 0
            follow_up_count = 0
            expiry_alert_count = 0

            for job_record in pending_jobs:
                try:
                    # Recreate the APScheduler job based on job_type
                    if job_record.job_type == "auto_complete":
                        # Rebuild autocomplete job
                        scheduler.add_job(
                            func=execute_autocomplete_job,
                            trigger='date',
                            run_date=job_record.scheduled_time_utc,
                            args=[
                                job_record.instance_id,
                                job_record.job_id
                            ],
                            id=job_record.job_id,
                            replace_existing=True,
                            misfire_grace_time=3600  # 1 hour grace for autocomplete
                        )
                        autocomplete_count += 1
                        logger.debug(f"Rebuilt autocomplete job {job_record.job_id} for {job_record.scheduled_time_utc} UTC")
                    elif job_record.job_type == "follow_up_reminder":
                        # Rebuild follow-up reminder job
                        scheduler.add_job(
                            func=execute_follow_up_notification,
                            trigger='date',
                            run_date=job_record.scheduled_time_utc,
                            args=[
                                job_record.schedule_id,
                                job_record.user_id,
                                job_record.channel_id,
                                job_record.scheduled_date,
                                job_record.job_id
                            ],
                            id=job_record.job_id,
                            replace_existing=True,
                            misfire_grace_time=300  # 5 minutes grace
                        )
                        follow_up_count += 1
                        logger.debug(f"Rebuilt follow-up job {job_record.job_id} for {job_record.scheduled_time_utc} UTC")
                    elif job_record.job_type == "expiry_alert":
                        # Rebuild expiry alert job
                        scheduler.add_job(
                            func=execute_expiry_alert,
                            trigger='date',
                            run_date=job_record.scheduled_time_utc,
                            args=[
                                job_record.schedule_id,
                                job_record.user_id,
                                job_record.channel_id,
                                job_record.scheduled_date,
                                job_record.job_id
                            ],
                            id=job_record.job_id,
                            replace_existing=True,
                            misfire_grace_time=300  # 5 minutes grace
                        )
                        expiry_alert_count += 1
                        logger.debug(f"Rebuilt expiry alert job {job_record.job_id} for {job_record.scheduled_time_utc} UTC")
                    else:
                        # Rebuild notification reminder job (default)
                        scheduler.add_job(
                            func=execute_scheduled_notification,
                            trigger='date',
                            run_date=job_record.scheduled_time_utc,
                            args=[
                                job_record.schedule_id,
                                job_record.user_id,
                                job_record.channel_id,
                                job_record.scheduled_date,
                                job_record.job_id
                            ],
                            id=job_record.job_id,
                            replace_existing=True,
                            misfire_grace_time=300  # 5 minutes grace for notifications
                        )
                        notification_count += 1
                        logger.debug(f"Rebuilt notification job {job_record.job_id} for {job_record.scheduled_time_utc} UTC")

                except Exception as e:
                    logger.error(f"Failed to rebuild job {job_record.job_id}: {e}")
                    continue

            logger.info(f"Successfully rebuilt {notification_count} notification, {follow_up_count} follow-up, {expiry_alert_count} expiry alert, and {autocomplete_count} autocomplete jobs")

    except Exception as e:
        logger.error(f"Error rebuilding notification jobs from database: {e}", exc_info=True)


async def daily_notification_maintenance():
    """
    Daily maintenance job to:
    1. Schedule notification jobs for the next 7 days for all enabled schedules
    2. Clean up old completed/failed jobs from the database
    3. Clean up old frequency tracking records
    """
    logger.info("Starting daily notification maintenance")

    try:
        async with async_session_maker() as db:
            # 1. Get all enabled schedules with notifications enabled
            result = await db.execute(
                select(Schedule).where(
                    and_(
                        Schedule.enabled == True,
                        Schedule.notifications_enabled == True,
                        Schedule.reminder_time.is_not(None)
                    )
                ).options(
                    selectinload(Schedule.notification_channels)
                )
            )
            schedules = result.scalars().all()

            logger.info(f"Scheduling jobs for {len(schedules)} active schedules")

            # Schedule jobs for each schedule
            for schedule in schedules:
                try:
                    await schedule_notification_jobs_for_schedule(schedule.id, days_ahead=7)
                except Exception as e:
                    logger.error(f"Error scheduling jobs for schedule {schedule.id}: {e}")
                    continue

            # 2. Clean up old job records (older than 30 days and not pending)
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)

            delete_result = await db.execute(
                delete(ScheduledNotificationJob).where(
                    and_(
                        ScheduledNotificationJob.scheduled_time_utc < cutoff_date,
                        ScheduledNotificationJob.status.in_(["sent", "failed", "cancelled"])
                    )
                )
            )

            await db.commit()

            deleted_count = delete_result.rowcount if hasattr(delete_result, 'rowcount') else 0
            logger.info(f"Cleaned up {deleted_count} old notification job records")

            # 3. Clean up old frequency tracking records (older than 7 days)
            from app.scheduler.frequency_cap import cleanup_old_frequency_tracking
            try:
                await cleanup_old_frequency_tracking(days_to_keep=7)
            except Exception as e:
                logger.error(f"Error cleaning up frequency tracking records: {e}")

            logger.info("Daily notification maintenance completed successfully")

    except Exception as e:
        logger.error(f"Error in daily notification maintenance: {e}", exc_info=True)


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

        # Find next occurrence (including today)
        for i in range(0, 8):  # Check today + next 7 days
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


async def create_in_app_notification(
    db: AsyncSession,
    user: User,
    notification_type: NotificationType,
    title: str,
    message: str,
    link: str = None,
    notification_metadata: dict = None
):
    """Create an in-app notification for a user if in-app channel is enabled"""
    try:
        # Check if user has in-app notification channel enabled
        # Note: Explicit join condition required because NotificationChannel has two FKs to NotificationSettings
        result = await db.execute(
            select(NotificationChannel)
            .join(NotificationSettings, NotificationChannel.notification_settings_id == NotificationSettings.id)
            .where(
                NotificationSettings.user_id == user.id,
                NotificationChannel.webhook_type == "in_app",
                NotificationChannel.enabled == True
            )
        )
        in_app_channel = result.scalars().first()

        if not in_app_channel:
            logger.debug(f"In-app notifications disabled for user {user.email}, skipping")
            return

        # Get user's notification settings to check quiet hours
        settings_result = await db.execute(
            select(NotificationSettings).where(NotificationSettings.user_id == user.id)
        )
        notif_settings = settings_result.scalars().first()

        # Check quiet hours (unless critical notification)
        if notif_settings and is_within_quiet_hours(notif_settings, notification_type):
            logger.debug(f"Skipping in-app notification for user {user.email} - within quiet hours")
            return

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


async def check_auto_complete_schedules():
    """
    Check for schedule instances that should be auto-completed.
    Runs every 30 minutes to check if any pending instances are past their auto-complete trigger time.
    """
    logger.info("Running auto-complete check for schedule instances")

    try:
        async with async_session_maker() as db:
            now = datetime.now(timezone.utc)

            # Import ScheduleInstance model
            from app.models import ScheduleInstance

            # Get all pending instances for schedules with auto-complete enabled
            result = await db.execute(
                select(ScheduleInstance)
                .join(Schedule, ScheduleInstance.schedule_id == Schedule.id)
                .where(
                    and_(
                        Schedule.enabled == True,
                        Schedule.auto_complete_enabled == True,
                        ScheduleInstance.status == InstanceStatus.PENDING
                    )
                )
                .options(selectinload(ScheduleInstance.schedule))
            )
            instances = result.scalars().all()

            logger.info(f"Found {len(instances)} pending instances with auto-complete enabled")

            auto_completed_count = 0

            for instance in instances:
                try:
                    schedule = instance.schedule

                    # Get the reptile and household to determine timezone
                    reptile = await db.get(Reptile, schedule.reptile_id)
                    if not reptile:
                        logger.warning(f"Reptile {schedule.reptile_id} not found for instance {instance.id}")
                        continue

                    # Get household owner's timezone (or UTC if no household)
                    user_tz = timezone.utc
                    if reptile.household_id:
                        # Get household owner or any admin/manager
                        household_result = await db.execute(
                            select(User)
                            .join(household_members)
                            .where(
                                and_(
                                    household_members.c.household_id == reptile.household_id,
                                    household_members.c.access_level.in_([AccessLevel.OWNER, AccessLevel.ADMIN, AccessLevel.MANAGER])
                                )
                            )
                            .limit(1)
                        )
                        household_user = household_result.scalars().first()
                        if household_user and household_user.timezone:
                            user_tz = ZoneInfo(household_user.timezone)

                    # Calculate the trigger time for auto-completion in user's timezone
                    # If schedule has time window, use latest_time + delay hours
                    # Otherwise, use end of day (23:59) + delay hours
                    if schedule.time_window_enabled and schedule.latest_time:
                        # Use latest_time as the base (in user's timezone)
                        trigger_datetime_local = datetime.combine(
                            instance.scheduled_date,
                            schedule.latest_time,
                            tzinfo=user_tz
                        )
                    else:
                        # Use end of day (23:59) as the base (in user's timezone)
                        trigger_datetime_local = datetime.combine(
                            instance.scheduled_date,
                            py_time(23, 59),
                            tzinfo=user_tz
                        )

                    # Add the configured delay hours
                    trigger_datetime_local += timedelta(hours=schedule.auto_complete_hours_after)

                    # Convert to UTC for comparison
                    trigger_datetime = trigger_datetime_local.astimezone(timezone.utc)

                    # Check if we're past the trigger time
                    if now < trigger_datetime:
                        continue  # Not yet time to auto-complete

                    # Check if there's already a completion record
                    existing_result = await db.execute(
                        select(ScheduleCompletion).where(
                            and_(
                                ScheduleCompletion.schedule_id == schedule.id,
                                ScheduleCompletion.scheduled_date == instance.scheduled_date
                            )
                        )
                    )
                    existing_completion = existing_result.scalar_one_or_none()

                    if existing_completion:
                        # If there's already a completion (manually logged or previously auto-completed), skip
                        logger.debug(f"Instance {instance.id} already has completion record, skipping")
                        continue

                    # Create auto-completion record
                    completion = ScheduleCompletion(
                        schedule_id=schedule.id,
                        instance_id=instance.id,
                        reptile_id=schedule.reptile_id,
                        scheduled_date=instance.scheduled_date,
                        completed_at=trigger_datetime,  # Use trigger time as completion time
                        completion_type=None,  # No specific type for auto-completion
                        completion_id=None,  # No linked activity
                        within_time_window=False,  # Auto-completed, not within window
                        status=CompletionStatus.COMPLETED_ON_TIME,
                        auto_completed=True  # Mark as auto-completed
                    )
                    db.add(completion)

                    # Update instance status
                    instance.status = InstanceStatus.COMPLETED
                    instance.updated_at = now

                    await db.flush()

                    # For interval schedules, create the next instance
                    from app.models import ScheduleMode
                    if schedule.schedule_mode == ScheduleMode.INTERVAL:
                        from app.instance_generator import create_interval_schedule_instance
                        try:
                            await create_interval_schedule_instance(
                                db=db,
                                schedule=schedule,
                                last_completion_date=instance.scheduled_date
                            )
                            logger.info(f"Created next interval instance for schedule {schedule.id} after auto-completion")
                        except Exception as e:
                            logger.error(
                                f"Failed to create next interval instance for schedule {schedule.id}: {e}",
                                exc_info=True
                            )

                    auto_completed_count += 1
                    logger.info(
                        f"Auto-completed instance {instance.id} for schedule {schedule.id} "
                        f"({schedule.schedule_type}) on {instance.scheduled_date}"
                    )

                except Exception as e:
                    logger.error(f"Error auto-completing instance {instance.id}: {e}", exc_info=True)
                    await db.rollback()
                    continue

            await db.commit()
            logger.info(f"Auto-completed {auto_completed_count} schedule instances")

    except Exception as e:
        logger.error(f"Error in check_auto_complete_schedules: {e}", exc_info=True)


async def check_interval_schedule_notifications():
    """
    Check interval-based schedules and send max_days_between warnings:
    - Max days approaching (1 day before max_days_between)
    - Max days exceeded (reached or exceeded max_days_between)

    Note: Quota enforcement warnings (period ending, quota exceeded) have been removed.
    Only temporal (time-based) constraints are enforced.
    """
    logger.info("Running interval schedule notification check")

    try:
        async with async_session_maker() as db:
            now = datetime.now(timezone.utc)
            today = now.date()

            # Get all enabled interval schedules with notifications enabled
            result = await db.execute(
                select(Schedule).where(
                    and_(
                        Schedule.enabled == True,
                        Schedule.notifications_enabled == True,
                        Schedule.schedule_mode == ScheduleMode.INTERVAL
                    )
                ).options(
                    selectinload(Schedule.notification_channels)
                )
            )
            schedules = result.scalars().all()

            logger.info(f"Found {len(schedules)} interval schedules with notifications enabled")

            for schedule in schedules:
                try:
                    # Get reptile
                    reptile = await db.get(Reptile, schedule.reptile_id)
                    if not reptile:
                        continue

                    # For interval schedules, get days since last completion directly
                    # (no quota tracking needed - just min/max days between)
                    last_completion_result = await db.execute(
                        select(ScheduleCompletion.completed_at).where(
                            and_(
                                ScheduleCompletion.schedule_id == schedule.id,
                                ScheduleCompletion.status != CompletionStatus.PENDING
                            )
                        ).order_by(ScheduleCompletion.completed_at.desc()).limit(1)
                    )
                    last_completion_datetime = last_completion_result.scalar()

                    days_since_last = None
                    if last_completion_datetime:
                        last_completion_date = last_completion_datetime.date()
                        days_since_last = (today - last_completion_date).days

                    # Only check max_days_between warning (HARD constraint)
                    if schedule.max_days_between and days_since_last is not None:


                        # Send warning if approaching max (1 day before max)
                        if days_since_last == schedule.max_days_between - 1:
                            await send_interval_warning_notification(
                                db=db,
                                reptile=reptile,
                                schedule=schedule,
                                warning_type="max_days_approaching",
                                days_since_last=days_since_last
                            )
                        # Send alert if max exceeded
                        elif days_since_last >= schedule.max_days_between:
                            await send_interval_warning_notification(
                                db=db,
                                reptile=reptile,
                                schedule=schedule,
                                warning_type="max_days_exceeded",
                                days_since_last=days_since_last
                            )

                except Exception as e:
                    logger.error(f"Error checking interval schedule {schedule.id}: {e}", exc_info=True)
                    continue

    except Exception as e:
        logger.error(f"Error in check_interval_schedule_notifications: {e}", exc_info=True)


async def daily_instance_maintenance():
    """
    Daily job to generate schedule instances and clean up old ones.
    Runs at 3 AM UTC to ensure instances exist for configured days ahead.
    """
    logger.info("Starting daily instance maintenance")

    try:
        from app.instance_generator import generate_instances_for_all_schedules, cleanup_old_instances, schedule_autocomplete_jobs_for_instances

        # Generate instances (uses config value)
        stats = await generate_instances_for_all_schedules()
        logger.info(
            f"Generated instances: {stats['schedules_processed']} schedules processed, "
            f"{stats['instances_created']} instances created"
        )

        # Schedule autocomplete jobs for all pending instances with autocomplete enabled
        jobs_scheduled = await schedule_autocomplete_jobs_for_instances()
        logger.info(f"Scheduled {jobs_scheduled} autocomplete jobs")

        # Clean up instances older than 30 days
        deleted_count = await cleanup_old_instances(days_to_keep=30)
        logger.info(f"Cleaned up {deleted_count} old instances")

        logger.info("Daily instance maintenance completed successfully")

    except Exception as e:
        logger.error(f"Error in daily instance maintenance: {e}", exc_info=True)


async def schedule_daily_planner_jobs():
    """
    Run at midnight UTC daily.
    For each user with daily_planner_enabled, schedule a delivery job
    at their configured time in their timezone.
    """
    logger.info("Scheduling daily planner jobs for all users")

    async with async_session_maker() as db:
        # Get all users with daily planner enabled
        result = await db.execute(
            select(User, NotificationSettings)
            .join(NotificationSettings, User.id == NotificationSettings.user_id)
            .where(NotificationSettings.daily_planner_enabled == True)
        )
        users_with_settings = result.all()

        today_utc = datetime.now(timezone.utc).date()
        jobs_scheduled = 0

        for user, settings in users_with_settings:
            try:
                # Calculate delivery time in user's timezone
                user_tz = ZoneInfo(user.timezone) if user.timezone else ZoneInfo("UTC")
                today_local = datetime.now(user_tz).date()

                # Default to 8am if not configured
                delivery_time_local = settings.daily_planner_time or py_time(8, 0)

                delivery_datetime_local = datetime.combine(
                    today_local,
                    delivery_time_local,
                    tzinfo=user_tz
                )
                delivery_datetime_utc = delivery_datetime_local.astimezone(timezone.utc)

                # Skip if delivery time has already passed
                now_utc = datetime.now(timezone.utc)
                if delivery_datetime_utc < now_utc:
                    logger.debug(f"Skipping daily planner for user {user.id} - delivery time passed")
                    continue

                # Schedule APScheduler job for delivery
                job_id = f"daily_planner_{user.id}_{today_local.isoformat()}"

                scheduler.add_job(
                    func=execute_daily_planner_delivery,
                    trigger='date',
                    run_date=delivery_datetime_utc,
                    args=[user.id, today_local],
                    id=job_id,
                    replace_existing=True,
                    misfire_grace_time=3600  # 1 hour grace
                )

                jobs_scheduled += 1
                logger.debug(f"Scheduled daily planner for user {user.email} at {delivery_datetime_utc}")

            except Exception as e:
                logger.error(f"Error scheduling daily planner for user {user.id}: {e}")

        logger.info(f"Scheduled {jobs_scheduled} daily planner jobs")


async def schedule_weekly_planner_jobs():
    """
    Run at midnight UTC daily.
    Check if today is user's configured weekly planner day, and if so,
    schedule delivery at their configured time.
    """
    logger.info("Checking weekly planner schedules")

    async with async_session_maker() as db:
        # Get all users with weekly planner enabled
        result = await db.execute(
            select(User, NotificationSettings)
            .join(NotificationSettings, User.id == NotificationSettings.user_id)
            .where(NotificationSettings.weekly_planner_enabled == True)
        )
        users_with_settings = result.all()

        jobs_scheduled = 0

        for user, settings in users_with_settings:
            try:
                user_tz = ZoneInfo(user.timezone) if user.timezone else ZoneInfo("UTC")
                today_local = datetime.now(user_tz).date()

                # Check if today is the configured day (0=Sunday, 6=Saturday)
                # Python weekday(): Monday=0, Sunday=6
                # Convert: Sunday=0 -> (weekday + 1) % 7
                configured_day = settings.weekly_planner_day or 0  # Default Sunday
                today_day = (today_local.weekday() + 1) % 7  # Convert to Sunday=0

                if today_day != configured_day:
                    continue

                # Use weekly_planner_time if set, otherwise fall back to daily_planner_time or default 8am
                delivery_time_local = settings.weekly_planner_time or settings.daily_planner_time or py_time(8, 0)

                delivery_datetime_local = datetime.combine(
                    today_local,
                    delivery_time_local,
                    tzinfo=user_tz
                )
                delivery_datetime_utc = delivery_datetime_local.astimezone(timezone.utc)

                # Skip if delivery time has already passed
                now_utc = datetime.now(timezone.utc)
                if delivery_datetime_utc < now_utc:
                    continue

                job_id = f"weekly_planner_{user.id}_{today_local.isoformat()}"

                scheduler.add_job(
                    func=execute_weekly_planner_delivery,
                    trigger='date',
                    run_date=delivery_datetime_utc,
                    args=[user.id, today_local],
                    id=job_id,
                    replace_existing=True,
                    misfire_grace_time=3600
                )

                jobs_scheduled += 1
                logger.debug(f"Scheduled weekly planner for user {user.email} at {delivery_datetime_utc}")

            except Exception as e:
                logger.error(f"Error scheduling weekly planner for user {user.id}: {e}")

        logger.info(f"Scheduled {jobs_scheduled} weekly planner jobs")


async def execute_daily_planner_delivery(user_id: int, target_date: py_date):
    """
    Execute daily planner digest delivery for a user.
    Called by APScheduler at user's configured delivery time.
    """
    logger.info(f"execute_daily_planner_delivery called for user_id={user_id}, target_date={target_date}")

    try:
        from app.celery_tasks import send_daily_planner_task

        async with async_session_maker() as db:
            # Get pending instances
            logger.info(f"Fetching pending instances for user {user_id} on {target_date}")
            instances = await get_pending_instances_for_date(db, user_id, target_date)
            overdue_instances = await get_overdue_instances_for_user(db, user_id, target_date)
            logger.info(f"Found {len(instances)} pending instances, {len(overdue_instances)} overdue instances")

            # Skip if no tasks (no empty digests)
            if not instances and not overdue_instances:
                logger.info(f"No tasks for user {user_id} on {target_date}, skipping daily planner")
                return

            # Serialize instance IDs for Celery task
            instance_ids = [i.id for i in instances]
            overdue_ids = [i.id for i in overdue_instances]

            # Queue to Celery
            logger.info(f"Queuing Celery task send_daily_planner_task for user {user_id}")
            send_daily_planner_task.delay(
                user_id=user_id,
                target_date_str=target_date.isoformat(),
                instance_ids=instance_ids,
                overdue_ids=overdue_ids
            )

            logger.info(f"Queued daily planner for user {user_id} with {len(instances)} tasks, {len(overdue_instances)} overdue")

    except Exception as e:
        logger.error(f"Error executing daily planner delivery for user {user_id}: {e}", exc_info=True)


async def execute_weekly_planner_delivery(user_id: int, start_date: py_date):
    """
    Execute weekly planner digest delivery for a user.

    Note: start_date is day 1 of the 7-day preview period (see digest.py docstrings).
    The weekly digest covers [start_date, start_date + 6 days] = 7 total days.
    """
    try:
        from app.celery_tasks import send_weekly_planner_task

        async with async_session_maker() as db:
            # Get instances for next 7 days (start_date is day 1)
            instances_by_date = await get_weekly_instances(db, user_id, start_date, days=7)

            # Count total tasks
            total_tasks = sum(len(v) for v in instances_by_date.values())

            # Skip if no tasks
            if total_tasks == 0:
                logger.info(f"No tasks for user {user_id} this week, skipping weekly planner")
                return

            # Serialize: {date_iso: [instance_ids]}
            serialized = {
                d.isoformat(): [i.id for i in instances]
                for d, instances in instances_by_date.items()
            }

            send_weekly_planner_task.delay(
                user_id=user_id,
                start_date_str=start_date.isoformat(),
                instances_by_date=serialized
            )

            logger.info(f"Queued weekly planner for user {user_id} with {total_tasks} tasks over 7 days")

    except Exception as e:
        logger.error(f"Error executing weekly planner delivery for user {user_id}: {e}", exc_info=True)


async def daily_weight_alert_sweep():
    """
    Daily job to check for weight changes that might have been missed.
    Safety net for edge cases where on-creation trigger failed.
    Runs at 4 AM UTC.
    """
    logger.info("Running daily weight alert sweep")

    try:
        from app.models import WeightLog
        from app.scheduler.weight_alerts import check_weight_change_alert

        async with async_session_maker() as db:
            # Find all weight logs from last 24 hours
            yesterday = datetime.now(timezone.utc) - timedelta(days=1)

            result = await db.execute(
                select(WeightLog)
                .where(WeightLog.measured_at >= yesterday)
                .order_by(WeightLog.measured_at.desc())
            )

            weight_logs = result.scalars().all()
            logger.info(f"Found {len(weight_logs)} weight logs in last 24 hours to check")

            alerts_triggered = 0
            for log in weight_logs:
                try:
                    alert_context = await check_weight_change_alert(db, log, is_sweep=True)
                    if alert_context:
                        # Queue Celery task
                        from app.celery_tasks import send_weight_change_alert_task
                        send_weight_change_alert_task.delay(
                            reptile_id=log.reptile_id,
                            weight_log_id=log.id,
                            alert_context=alert_context
                        )
                        alerts_triggered += 1
                except Exception as e:
                    logger.error(f"Error checking weight alert for log {log.id}: {e}")

            logger.info(f"Daily weight alert sweep complete: {alerts_triggered} alerts triggered")

    except Exception as e:
        logger.error(f"Error in daily weight alert sweep: {e}", exc_info=True)


async def schedule_planner_for_user(user_id: int):
    """
    Schedule planner digest delivery for a specific user on-demand.

    Called when user saves planner settings, so they don't have to wait
    for the midnight cron job to take effect.

    Uses Celery's native eta scheduling instead of APScheduler for reliability.
    This ensures the task goes directly to Celery's queue with the scheduled time.

    Schedules:
    - Daily planner for today (if enabled and delivery time hasn't passed)
    - Weekly planner for today (if enabled and today is the configured day)
    """
    logger.info(f"schedule_planner_for_user called for user_id={user_id}")

    try:
        from app.celery_tasks import send_daily_planner_task, send_weekly_planner_task

        async with async_session_maker() as db:
            # Get user and settings
            result = await db.execute(
                select(User, NotificationSettings)
                .join(NotificationSettings, User.id == NotificationSettings.user_id)
                .where(User.id == user_id)
            )
            row = result.first()
            if not row:
                logger.warning(f"Cannot schedule planner for user {user_id}: not found or no settings")
                return

            user, settings = row
            logger.info(f"Found user {user.email}, daily_planner_enabled={settings.daily_planner_enabled}, weekly_planner_enabled={settings.weekly_planner_enabled}")

            user_tz = ZoneInfo(user.timezone) if user.timezone else ZoneInfo("UTC")
            now_utc = datetime.now(timezone.utc)
            today_local = datetime.now(user_tz).date()

            # Default delivery time
            delivery_time_local = settings.daily_planner_time or py_time(8, 0)
            logger.info(f"User timezone={user_tz}, delivery_time_local={delivery_time_local}, now_utc={now_utc}")

            delivery_datetime_local = datetime.combine(
                today_local,
                delivery_time_local,
                tzinfo=user_tz
            )
            delivery_datetime_utc = delivery_datetime_local.astimezone(timezone.utc)

            # Check if delivery time is still in the future
            time_in_future = delivery_datetime_utc > now_utc
            logger.info(f"delivery_datetime_utc={delivery_datetime_utc}, time_in_future={time_in_future}")

            # Schedule daily planner if enabled and time hasn't passed
            if settings.daily_planner_enabled and time_in_future:
                # Get pending instances for today
                instances = await get_pending_instances_for_date(db, user_id, today_local)
                overdue_instances = await get_overdue_instances_for_user(db, user_id, today_local)

                if instances or overdue_instances:
                    instance_ids = [i.id for i in instances]
                    overdue_ids = [i.id for i in overdue_instances]

                    # Use Celery's eta parameter to schedule the task
                    task_id = f"daily_planner_{user_id}_{today_local.isoformat()}"
                    send_daily_planner_task.apply_async(
                        kwargs={
                            'user_id': user_id,
                            'target_date_str': today_local.isoformat(),
                            'instance_ids': instance_ids,
                            'overdue_ids': overdue_ids
                        },
                        eta=delivery_datetime_utc,
                        task_id=task_id
                    )
                    logger.info(f"Scheduled daily planner via Celery eta for user {user.email} at {delivery_datetime_utc} with {len(instances)} tasks, {len(overdue_instances)} overdue")
                else:
                    logger.info(f"Daily planner not scheduled: no tasks for today")
            else:
                logger.info(f"Daily planner not scheduled: enabled={settings.daily_planner_enabled}, time_in_future={time_in_future}")

            # Schedule weekly planner if enabled and today is the right day
            if settings.weekly_planner_enabled:
                configured_day = settings.weekly_planner_day or 0  # 0=Sunday
                today_day = (today_local.weekday() + 1) % 7  # Convert to Sunday=0
                logger.info(f"Weekly planner check: configured_day={configured_day}, today_day={today_day}")

                if today_day == configured_day:
                    # Use weekly_planner_time if set, otherwise fall back to daily_planner_time
                    weekly_time_local = settings.weekly_planner_time or settings.daily_planner_time or py_time(8, 0)
                    weekly_datetime_local = datetime.combine(
                        today_local,
                        weekly_time_local,
                        tzinfo=user_tz
                    )
                    weekly_datetime_utc = weekly_datetime_local.astimezone(timezone.utc)
                    weekly_time_in_future = weekly_datetime_utc > now_utc
                    logger.info(f"Weekly planner time: {weekly_time_local}, UTC: {weekly_datetime_utc}, in_future: {weekly_time_in_future}")

                    if weekly_time_in_future:
                        # Get instances for the week
                        instances_by_date = await get_weekly_instances(db, user_id, today_local, days=7)
                        total_tasks = sum(len(v) for v in instances_by_date.values())

                        if total_tasks > 0:
                            # Convert date keys to strings for JSON serialization
                            instances_by_date_str = {
                                d.isoformat(): [i.id for i in instances]
                                for d, instances in instances_by_date.items()
                            }

                            task_id = f"weekly_planner_{user_id}_{today_local.isoformat()}"
                            send_weekly_planner_task.apply_async(
                                kwargs={
                                    'user_id': user_id,
                                    'start_date_str': today_local.isoformat(),
                                    'instances_by_date': instances_by_date_str
                                },
                                eta=weekly_datetime_utc,
                                task_id=task_id
                            )
                            logger.info(f"Scheduled weekly planner via Celery eta for user {user.email} at {weekly_datetime_utc} with {total_tasks} tasks")
                        else:
                            logger.info(f"Weekly planner not scheduled: no tasks for the week")
                    else:
                        logger.info(f"Weekly planner not scheduled: time already passed")
                else:
                    logger.info(f"Weekly planner not scheduled: wrong day (configured={configured_day}, today={today_day})")

    except Exception as e:
        logger.error(f"Error in schedule_planner_for_user for user {user_id}: {e}", exc_info=True)


async def start_scheduler():
    """Start the notification scheduler"""
    global scheduler

    if scheduler is not None:
        logger.warning("Scheduler already started")
        return

    logger.info("Starting notification scheduler")

    # Reduce APScheduler's logging verbosity
    logging.getLogger('apscheduler').setLevel(logging.WARNING)

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

    # Check interval schedule notifications once per day at 10 AM UTC
    scheduler.add_job(
        check_interval_schedule_notifications,
        trigger="cron",
        hour=10,
        minute=0,
        id="check_interval_notifications",
        name="Check interval schedule notifications",
        replace_existing=True
    )

    # Daily maintenance: schedule new jobs and cleanup old ones (runs at 2 AM UTC)
    scheduler.add_job(
        daily_notification_maintenance,
        trigger="cron",
        hour=2,
        minute=0,
        id="daily_maintenance",
        name="Daily notification maintenance",
        replace_existing=True
    )

    # Daily instance maintenance: generate instances for next 14 days and cleanup old ones (runs at 3 AM UTC)
    scheduler.add_job(
        daily_instance_maintenance,
        trigger="cron",
        hour=3,
        minute=0,
        id="daily_instance_maintenance",
        name="Daily schedule instance maintenance",
        replace_existing=True
    )

    # Daily weight alert sweep (runs at 4 AM UTC)
    scheduler.add_job(
        daily_weight_alert_sweep,
        trigger="cron",
        hour=4,
        minute=0,
        id="daily_weight_alert_sweep",
        name="Daily weight alert sweep (safety net)",
        replace_existing=True
    )

    # Schedule daily planner digest notifications (runs at midnight UTC)
    scheduler.add_job(
        schedule_daily_planner_jobs,
        trigger="cron",
        hour=0,
        minute=1,  # 1 minute after midnight to avoid race with date change
        id="schedule_daily_planners",
        name="Schedule daily planner notifications for all users",
        replace_existing=True
    )

    # Schedule weekly planner digest notifications (also runs at midnight UTC, checks day)
    scheduler.add_job(
        schedule_weekly_planner_jobs,
        trigger="cron",
        hour=0,
        minute=2,  # 2 minutes after midnight
        id="schedule_weekly_planners",
        name="Schedule weekly planner notifications (checks configured day)",
        replace_existing=True
    )

    # DEPRECATED: Polling-based autocomplete check replaced by database-persisted jobs
    # Autocomplete jobs are now scheduled as APScheduler jobs via daily_instance_maintenance
    # and recovered on startup via rebuild_notification_jobs_from_db
    # Uncomment below if you need to re-enable polling as a fallback:
    #
    # scheduler.add_job(
    #     check_auto_complete_schedules,
    #     trigger=IntervalTrigger(minutes=5),
    #     id="check_auto_complete",
    #     name="Check auto-complete schedules (DEPRECATED - POLLING FALLBACK)",
    #     replace_existing=True
    # )

    scheduler.start()

    logger.info("Notification scheduler started successfully")

    # Rebuild notification jobs from database (for recovery after pod restarts)
    try:
        await rebuild_notification_jobs_from_db()
        logger.info("Notification jobs rebuilt successfully")
    except Exception as e:
        logger.error(f"Error rebuilding notification jobs: {e}", exc_info=True)

    # Generate initial schedule instances on startup
    # This also schedules autocomplete jobs for all pending instances
    try:
        await daily_instance_maintenance()
        logger.info("Initial instance maintenance completed successfully")
    except Exception as e:
        logger.error(f"Error in initial instance maintenance: {e}", exc_info=True)

    # DEPRECATED: Startup autocomplete check no longer needed
    # Autocomplete jobs are now rebuilt from database via rebuild_notification_jobs_from_db (above)
    # and scheduled via daily_instance_maintenance (above)
    # Uncomment below if you need polling fallback:
    #
    # try:
    #     loop = asyncio.get_event_loop()
    #     if loop.is_running():
    #         asyncio.create_task(check_auto_complete_schedules())
    #     else:
    #         loop.run_until_complete(check_auto_complete_schedules())
    # except Exception as e:
    #     logger.error(f"Error running initial auto-complete check: {e}", exc_info=True)


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
