"""
Notification job management functions for scheduling, cancelling, and rescheduling
notification jobs using APScheduler.

Extracted from scheduler.py as part of Phase 2 modularization.
"""
import logging
from datetime import datetime, timezone, timedelta, date as py_date
from zoneinfo import ZoneInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models import (
    Schedule,
    NotificationSettings,
    NotificationChannel,
    User,
    ScheduledNotificationJob,
)

# Import callback and utility functions from parent scheduler module
from app.scheduler import execute_scheduled_notification, should_schedule_occur_on_date

logger = logging.getLogger(__name__)


async def schedule_notification_jobs_for_schedule(
    scheduler: AsyncIOScheduler,
    schedule_id: int,
    days_ahead: int = 7
):
    """
    Schedule notification jobs for a given schedule for the next N days

    Args:
        scheduler: APScheduler instance (passed to avoid circular imports)
        schedule_id: The Schedule ID
        days_ahead: How many days ahead to schedule (default 7)
    """
    if not scheduler:
        logger.warning("Scheduler not initialized, cannot schedule jobs")
        return

    try:
        async with async_session_maker() as db:
            # Load schedule with relationships from database
            result = await db.execute(
                select(Schedule)
                .options(selectinload(Schedule.notification_channels))
                .where(Schedule.id == schedule_id)
            )
            schedule = result.scalars().first()

            if not schedule:
                logger.warning(f"Schedule {schedule_id} not found")
                return

            if not schedule.enabled or not schedule.notifications_enabled:
                logger.info(f"Schedule {schedule.id} disabled (enabled={schedule.enabled}, notifications_enabled={schedule.notifications_enabled}), skipping job scheduling")
                return

            if not schedule.notification_channels:
                logger.info(f"Schedule {schedule.id} has no notification channels")
                return

            if not schedule.reminder_time:
                logger.info(f"Schedule {schedule.id} has no reminder_time set")
                return

            today = datetime.now(timezone.utc).date()

            # Get all users with channels for this schedule
            logger.debug(f"Processing {len(schedule.notification_channels)} channels for schedule {schedule.id}, reminder_time={schedule.reminder_time}")
            channel_user_map = {}
            for channel in schedule.notification_channels:
                if not channel.enabled:
                    logger.debug(f"  Channel {channel.id} ({channel.name}) is disabled, skipping")
                    continue

                notif_settings = await db.get(NotificationSettings, channel.notification_settings_id)
                if not notif_settings or not notif_settings.notify_schedule_reminders:
                    logger.debug(f"  Channel {channel.id} ({channel.name}) has notify_schedule_reminders=False, skipping")
                    continue

                user = await db.get(User, notif_settings.user_id)
                if not user:
                    logger.debug(f"  Channel {channel.id} ({channel.name}) user not found, skipping")
                    continue

                if channel.id not in channel_user_map:
                    channel_user_map[channel.id] = user
                    logger.debug(f"  Channel {channel.id} ({channel.name}, type={channel.webhook_type}) added for user {user.email}")

            if not channel_user_map:
                logger.debug(f"No valid channels/users for schedule {schedule.id} (checked {len(schedule.notification_channels)} channels)")
                return

            # Schedule jobs for next N days
            jobs_scheduled = 0
            for days_offset in range(days_ahead):
                check_date = today + timedelta(days=days_offset)

                # Check if this date matches the schedule
                if not should_schedule_occur_on_date(schedule, check_date):
                    continue

                # Schedule for each channel/user combination
                for channel_id, user in channel_user_map.items():
                    await _schedule_single_notification_job(
                        scheduler=scheduler,
                        db=db,
                        schedule=schedule,
                        user=user,
                        channel_id=channel_id,
                        scheduled_date=check_date
                    )
                    jobs_scheduled += 1

            await db.commit()
            logger.info(f"Scheduled {jobs_scheduled} notification jobs for schedule {schedule.id}")

    except Exception as e:
        logger.error(f"Error scheduling jobs for schedule {schedule_id}: {e}", exc_info=True)


async def schedule_notifications_for_interval_instance(
    scheduler: AsyncIOScheduler,
    db: AsyncSession,
    schedule: Schedule,
    instance_date: py_date
):
    """
    Schedule notification jobs for a specific interval schedule instance.
    This is called when an interval instance is dynamically created after completion.

    Args:
        scheduler: APScheduler instance (passed to avoid circular imports)
        db: Database session
        schedule: The interval schedule (must be loaded with notification_channels)
        instance_date: The date of the interval instance to schedule notifications for
    """
    if not scheduler:
        logger.warning("Scheduler not initialized, cannot schedule notifications")
        return

    try:
        # Get all users with channels for this schedule
        channel_user_map = {}
        for channel in schedule.notification_channels:
            if not channel.enabled:
                continue

            notif_settings = await db.get(NotificationSettings, channel.notification_settings_id)
            if not notif_settings or not notif_settings.notify_schedule_reminders:
                continue

            user = await db.get(User, notif_settings.user_id)
            if not user:
                continue

            if channel.id not in channel_user_map:
                channel_user_map[channel.id] = user

        if not channel_user_map:
            logger.debug(f"No valid channels/users for interval instance on {instance_date}")
            return

        # Schedule notification for this instance date
        jobs_scheduled = 0
        for channel_id, user in channel_user_map.items():
            await _schedule_single_notification_job(
                scheduler=scheduler,
                db=db,
                schedule=schedule,
                user=user,
                channel_id=channel_id,
                scheduled_date=instance_date
            )
            jobs_scheduled += 1

        logger.info(f"Scheduled {jobs_scheduled} notification jobs for interval schedule {schedule.id} on {instance_date}")

    except Exception as e:
        logger.error(f"Error scheduling notifications for interval instance: {e}", exc_info=True)


async def _schedule_single_notification_job(
    scheduler: AsyncIOScheduler,
    db: AsyncSession,
    schedule: Schedule,
    user: User,
    channel_id: int,
    scheduled_date: py_date
):
    """
    Helper function to schedule a single notification job

    Args:
        scheduler: APScheduler instance
        db: Database session
        schedule: The schedule to create notification for
        user: User to notify
        channel_id: Notification channel ID
        scheduled_date: Date to schedule notification for
    """
    try:
        # Calculate reminder time in user's timezone
        user_tz = ZoneInfo(user.timezone if user.timezone else "UTC")
        reminder_time_local = datetime.combine(scheduled_date, schedule.reminder_time, tzinfo=user_tz)
        reminder_time_utc = reminder_time_local.astimezone(timezone.utc)

        # Log the calculated time
        now_utc = datetime.now(timezone.utc)
        logger.debug(f"Attempting to schedule job for schedule {schedule.id} on {scheduled_date}: reminder_time_utc={reminder_time_utc}, now_utc={now_utc}, user_tz={user.timezone}")

        # Skip if in the past
        if reminder_time_utc < now_utc:
            logger.debug(f"Skipping job for schedule {schedule.id} on {scheduled_date} - reminder time {reminder_time_utc} is in the past (now is {now_utc})")
            return

        # Generate unique job ID
        job_id = f"notif_{schedule.id}_{user.id}_{channel_id}_{scheduled_date.isoformat()}"

        # Check if job already exists
        existing_result = await db.execute(
            select(ScheduledNotificationJob).where(ScheduledNotificationJob.job_id == job_id)
        )
        existing_job = existing_result.scalars().first()
        if existing_job:
            # If the existing job has a different scheduled time or is cancelled/failed, delete it
            if existing_job.scheduled_time_utc != reminder_time_utc or existing_job.status in ["cancelled", "failed"]:
                logger.debug(f"Deleting old job {job_id} (status={existing_job.status}, old_time={existing_job.scheduled_time_utc}, new_time={reminder_time_utc})")
                await db.delete(existing_job)
                await db.flush()
            else:
                # Job already exists with same time and is pending/sent
                logger.debug(f"Job {job_id} already exists with same time, skipping")
                return

        # Create database record
        job_record = ScheduledNotificationJob(
            job_id=job_id,
            schedule_id=schedule.id,
            user_id=user.id,
            channel_id=channel_id,
            scheduled_date=scheduled_date,
            scheduled_time_utc=reminder_time_utc,
            status="pending"
        )
        db.add(job_record)
        await db.flush()

        # Schedule APScheduler job
        scheduler.add_job(
            func=execute_scheduled_notification,
            trigger='date',
            run_date=reminder_time_utc,
            args=[schedule.id, user.id, channel_id, scheduled_date, job_id],
            id=job_id,
            replace_existing=True,
            misfire_grace_time=300  # Allow 5 minutes grace if scheduler was down
        )

        logger.debug(f"Scheduled notification job {job_id} for {reminder_time_utc} UTC ({reminder_time_local} local)")

    except Exception as e:
        logger.error(f"Error scheduling single job: {e}", exc_info=True)


async def cancel_notification_jobs_for_schedule(
    scheduler: AsyncIOScheduler,
    schedule_id: int
):
    """
    Cancel and delete all notification jobs for a schedule

    Args:
        scheduler: APScheduler instance
        schedule_id: The schedule ID to cancel jobs for
    """
    try:
        async with async_session_maker() as db:
            # Get ALL jobs for this schedule (pending, cancelled, or failed)
            # We need to clean up everything to avoid duplicate job_ids
            result = await db.execute(
                select(ScheduledNotificationJob).where(
                    ScheduledNotificationJob.schedule_id == schedule_id
                )
            )
            jobs = result.scalars().all()

            for job in jobs:
                # Remove from APScheduler if it's still there
                try:
                    if scheduler and scheduler.get_job(job.job_id):
                        scheduler.remove_job(job.job_id)
                except Exception as e:
                    logger.debug(f"Job {job.job_id} not in scheduler (already executed or removed): {e}")

                # Delete from database
                await db.delete(job)

            await db.commit()
            logger.info(f"Deleted {len(jobs)} jobs for schedule {schedule_id}")

    except Exception as e:
        logger.error(f"Error cancelling jobs for schedule {schedule_id}: {e}", exc_info=True)


async def reschedule_notification_jobs_for_schedule(
    scheduler: AsyncIOScheduler,
    schedule_id: int
):
    """
    Reschedule notification jobs for a schedule (cancel old, create new)

    Args:
        scheduler: APScheduler instance
        schedule_id: The schedule ID to reschedule
    """
    # Cancel existing jobs
    await cancel_notification_jobs_for_schedule(scheduler, schedule_id)

    # Schedule new jobs
    await schedule_notification_jobs_for_schedule(scheduler, schedule_id)
