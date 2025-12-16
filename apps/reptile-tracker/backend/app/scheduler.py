"""
Notification scheduler for sending reminders and alerts
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta, date as py_date, time as py_time
from typing import List, Dict
from zoneinfo import ZoneInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, and_, or_, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models import Schedule, ScheduleCompletion, NotificationSettings, NotificationChannel, User, Reptile, CompletionStatus, UserNotification, NotificationType, ScheduledNotificationJob, AccessLevel, household_members, ScheduleMode
from app.notifications import send_webhook_notification, get_template_for_trigger, render_template
from app.quota_tracker import check_quota_status

logger = logging.getLogger(__name__)

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
            except:
                logger.warning(f"User {user_id} no longer has access to reptile {reptile.id}")
                job_record.status = "cancelled"
                await db.commit()
                return

            # Queue to Celery
            try:
                from app.celery_tasks import send_schedule_reminder_task

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


async def schedule_notification_jobs_for_schedule(schedule_id: int, days_ahead: int = 7):
    """
    Schedule notification jobs for a given schedule for the next N days

    Args:
        schedule_id: The Schedule ID
        days_ahead: How many days ahead to schedule (default 7)
    """
    global scheduler

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
    db: AsyncSession,
    schedule: Schedule,
    instance_date: py_date
):
    """
    Schedule notification jobs for a specific interval schedule instance.
    This is called when an interval instance is dynamically created after completion.

    Args:
        db: Database session
        schedule: The interval schedule (must be loaded with notification_channels)
        instance_date: The date of the interval instance to schedule notifications for
    """
    global scheduler

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
    db: AsyncSession,
    schedule: Schedule,
    user: User,
    channel_id: int,
    scheduled_date: py_date
):
    """Helper function to schedule a single notification job"""
    global scheduler

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


async def cancel_notification_jobs_for_schedule(schedule_id: int):
    """Cancel and delete all notification jobs for a schedule"""
    global scheduler

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


async def reschedule_notification_jobs_for_schedule(schedule_id: int):
    """Reschedule notification jobs for a schedule (cancel old, create new)"""
    # Cancel existing jobs
    await cancel_notification_jobs_for_schedule(schedule_id)

    # Schedule new jobs
    await schedule_notification_jobs_for_schedule(schedule_id)


async def _perform_autocomplete(db: AsyncSession, instance_id: int):
    """
    Core autocomplete logic - completes a schedule instance.

    Args:
        db: Database session
        instance_id: ID of the instance to autocomplete

    Returns:
        True if autocomplete was successful, False otherwise
    """
    from app.models import ScheduleInstance

    # Get the instance
    instance = await db.get(ScheduleInstance, instance_id)
    if not instance:
        logger.warning(f"Instance {instance_id} not found")
        return False

    # Check if instance is still pending
    if instance.status != "pending":
        logger.info(f"Instance {instance_id} already {instance.status}, skipping autocomplete")
        return False

    # Get the schedule
    schedule = await db.get(Schedule, instance.schedule_id)
    if not schedule:
        logger.warning(f"Schedule {instance.schedule_id} not found for instance {instance_id}")
        return False

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
        # If completion exists but not linked to this instance, link it and update instance status
        if existing_completion.instance_id is None:
            now = datetime.now(timezone.utc)
            existing_completion.instance_id = instance.id

            # Fix orphaned completions with NULL or invalid completed_at timestamps
            if existing_completion.completed_at is None:
                # Use the scheduled date as completion time for old records
                existing_completion.completed_at = datetime.combine(
                    instance.scheduled_date,
                    datetime.min.time()
                ).replace(tzinfo=timezone.utc)
                logger.info(f"Fixed NULL completed_at for orphaned completion {existing_completion.id}")

            instance.status = "completed"
            instance.updated_at = now

            # For interval schedules, create the next instance
            from app.models import ScheduleMode
            if schedule.schedule_mode == ScheduleMode.INTERVAL:
                from app.instance_generator import create_interval_schedule_instance
                try:
                    completion_date = existing_completion.completed_at.date() if existing_completion.completed_at else instance.scheduled_date
                    await create_interval_schedule_instance(
                        db=db,
                        schedule=schedule,
                        last_completion_date=completion_date
                    )
                    logger.info(f"Created next interval instance for schedule {schedule.id} after linking orphaned completion")
                except Exception as e:
                    logger.error(
                        f"Failed to create next interval instance for schedule {schedule.id}: {e}",
                        exc_info=True
                    )

            await db.commit()
            logger.info(f"Linked orphaned completion {existing_completion.id} to instance {instance_id}")
            return True

        # Completion already linked to this or another instance
        logger.info(f"Instance {instance_id} already has completion record, skipping")

        # Ensure instance status is synced
        if instance.status != "completed":
            instance.status = "completed"
            instance.updated_at = datetime.now(timezone.utc)
            await db.commit()

        return False

    # Create auto-completion record
    now = datetime.now(timezone.utc)
    completion = ScheduleCompletion(
        schedule_id=schedule.id,
        instance_id=instance.id,
        reptile_id=schedule.reptile_id,
        scheduled_date=instance.scheduled_date,
        completed_at=now,
        completion_type=None,
        completion_id=None,
        within_time_window=False,
        status=CompletionStatus.COMPLETED_ON_TIME,
        auto_completed=True
    )
    db.add(completion)

    # Update instance status
    instance.status = "completed"
    instance.updated_at = now

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

    await db.commit()

    logger.info(
        f"Auto-completed instance {instance_id} for schedule {schedule.id} "
        f"({schedule.schedule_type}) on {instance.scheduled_date}"
    )

    return True


async def execute_autocomplete_job(
    instance_id: int,
    job_id: str
):
    """
    Execute an autocomplete job (called by APScheduler at exact time).
    This automatically completes a schedule instance that wasn't manually logged.
    """
    try:
        async with async_session_maker() as db:
            # Get the scheduled job record
            job_record = await db.execute(
                select(ScheduledNotificationJob).where(ScheduledNotificationJob.job_id == job_id)
            )
            job_record = job_record.scalars().first()

            if not job_record or job_record.status != "pending":
                logger.warning(f"Autocomplete job {job_id} not found or already processed, skipping")
                return

            # Perform the autocomplete
            success = await _perform_autocomplete(db, instance_id)

            # Mark job as executed or failed
            if success:
                job_record.status = "sent"
            else:
                job_record.status = "failed"

            await db.commit()

    except Exception as e:
        logger.error(f"Error executing autocomplete job {job_id}: {e}", exc_info=True)


async def schedule_autocomplete_for_instance(
    instance: "ScheduleInstance",
    schedule: Schedule,
    user_tz: ZoneInfo
):
    """
    Schedule an autocomplete job for a specific schedule instance.

    Args:
        instance: The schedule instance to autocomplete
        schedule: The schedule this instance belongs to
        user_tz: Timezone of the household owner/manager
    """
    global scheduler

    try:
        async with async_session_maker() as db:
            # Calculate the trigger time for auto-completion in user's timezone
            if schedule.time_window_enabled and schedule.latest_time:
                # Use latest_time as the base
                trigger_datetime_local = datetime.combine(
                    instance.scheduled_date,
                    schedule.latest_time,
                    tzinfo=user_tz
                )
            else:
                # Use end of day (23:59) as the base
                trigger_datetime_local = datetime.combine(
                    instance.scheduled_date,
                    py_time(23, 59),
                    tzinfo=user_tz
                )

            # Add the configured delay hours
            delay_hours = schedule.auto_complete_hours_after if schedule.auto_complete_hours_after else 2
            trigger_datetime_local += timedelta(hours=delay_hours)

            # Convert to UTC for storage and APScheduler
            trigger_datetime_utc = trigger_datetime_local.astimezone(timezone.utc)

            # Generate unique job ID
            job_id = f"autocomplete_{instance.id}_{instance.scheduled_date.isoformat()}"

            # Check if trigger time has already passed - execute immediately
            now_utc = datetime.now(timezone.utc)
            if trigger_datetime_utc < now_utc:
                logger.info(
                    f"Autocomplete trigger for instance {instance.id} is overdue "
                    f"(was {trigger_datetime_utc}, now {now_utc}), executing immediately"
                )
                # Execute the autocomplete immediately without creating a scheduled job
                await _perform_autocomplete(db, instance.id)
                return

            # Check if job already exists
            existing = await db.execute(
                select(ScheduledNotificationJob).where(ScheduledNotificationJob.job_id == job_id)
            )
            if existing.scalars().first():
                logger.debug(f"Autocomplete job {job_id} already exists")
                return

            # Get household owner/manager for user_id
            # (needed for the job record, even though autocomplete doesn't send notifications)
            reptile = await db.get(Reptile, schedule.reptile_id)
            if not reptile or not reptile.household_id:
                logger.warning(f"Cannot schedule autocomplete: reptile {schedule.reptile_id} has no household")
                return

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
            if not household_user:
                logger.warning(f"No owner/admin/manager found for household {reptile.household_id}")
                return

            # Create database record
            # For autocomplete jobs, we use a placeholder channel_id (we don't send notifications)
            # We'll use the first in-app channel, or any channel owned by this user
            channel_result = await db.execute(
                select(NotificationChannel)
                .join(NotificationSettings, NotificationChannel.notification_settings_id == NotificationSettings.id)
                .where(NotificationSettings.user_id == household_user.id)
                .limit(1)
            )
            channel = channel_result.scalars().first()
            if not channel:
                # If no channel exists, we can't create the job
                # This shouldn't happen in practice since users should have at least in-app channel
                logger.warning(f"No notification channel found for user {household_user.id}, cannot schedule autocomplete")
                return

            job_record = ScheduledNotificationJob(
                job_id=job_id,
                job_type="auto_complete",
                schedule_id=schedule.id,
                user_id=household_user.id,
                channel_id=channel.id,  # Placeholder, not actually used for autocomplete
                instance_id=instance.id,
                scheduled_date=instance.scheduled_date,
                scheduled_time_utc=trigger_datetime_utc,
                status="pending"
            )
            db.add(job_record)
            await db.flush()

            # Schedule APScheduler job
            scheduler.add_job(
                func=execute_autocomplete_job,
                trigger='date',
                run_date=trigger_datetime_utc,
                args=[instance.id, job_id],
                id=job_id,
                replace_existing=True,
                misfire_grace_time=3600  # Allow 1 hour grace for autocomplete
            )

            await db.commit()

            logger.debug(
                f"Scheduled autocomplete job {job_id} for instance {instance.id} "
                f"at {trigger_datetime_utc} UTC ({trigger_datetime_local} local)"
            )

    except Exception as e:
        logger.error(f"Error scheduling autocomplete for instance {instance.id}: {e}", exc_info=True)


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

            logger.info(f"Successfully rebuilt {notification_count} notification jobs and {autocomplete_count} autocomplete jobs")

    except Exception as e:
        logger.error(f"Error rebuilding notification jobs from database: {e}", exc_info=True)


async def daily_notification_maintenance():
    """
    Daily maintenance job to:
    1. Schedule notification jobs for the next 7 days for all enabled schedules
    2. Clean up old completed/failed jobs from the database
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


async def check_schedule_reminders():
    """
    Check for LEGACY schedules that need reminder notifications (polling-based)
    This only handles schedules using reminder_minutes_before (legacy approach)
    Schedules with reminder_time are handled by the exact-time APScheduler system
    """
    logger.info("Running legacy schedule reminder check (polling-based)")

    try:
        async with async_session_maker() as db:
            now = datetime.now(timezone.utc)
            today = now.date()

            # Get all users with schedule reminders enabled in their notification settings
            result = await db.execute(
                select(User)
                .join(NotificationSettings)
                .where(NotificationSettings.notify_schedule_reminders == True)
            )
            users = result.scalars().all()

            logger.info(f"Found {len(users)} users with schedule reminders enabled")

            for user in users:
                try:
                    # Get user's timezone (default to UTC if not set)
                    user_tz = ZoneInfo(user.timezone if user.timezone else "UTC")

                    # Get user's notification settings
                    notif_settings_result = await db.execute(
                        select(NotificationSettings).where(NotificationSettings.user_id == user.id)
                    )
                    notif_settings = notif_settings_result.scalars().first()

                    if not notif_settings:
                        continue

                    # Get enabled notification channels for this user
                    channels_result = await db.execute(
                        select(NotificationChannel).where(
                            and_(
                                NotificationChannel.notification_settings_id == notif_settings.id,
                                NotificationChannel.enabled == True
                            )
                        )
                    )
                    channels = channels_result.scalars().all()

                    if not channels:
                        continue

                    # Get all schedules that use any of these channels
                    channel_ids = [c.id for c in channels]

                    # Query schedules that have these channels
                    # ONLY include legacy schedules using reminder_minutes_before
                    # Schedules with reminder_time are handled by the exact-time APScheduler system
                    schedules_result = await db.execute(
                        select(Schedule)
                        .join(Schedule.notification_channels)
                        .where(
                            and_(
                                Schedule.enabled == True,
                                Schedule.notifications_enabled == True,
                                # Only legacy schedules (no reminder_time set)
                                Schedule.reminder_time.is_(None),
                                Schedule.reminder_minutes_before.isnot(None),
                                Schedule.reminder_minutes_before > 0,
                                NotificationChannel.id.in_(channel_ids)
                            )
                        )
                        .distinct(Schedule.id)
                    )
                    schedules = schedules_result.scalars().all()

                    logger.debug(f"Found {len(schedules)} schedules for user {user.email}")

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

                            # Calculate when to send reminder using user's timezone
                            # This polling system only handles legacy schedules with reminder_minutes_before
                            # Schedules with reminder_time are handled by exact-time APScheduler

                            # If time window is enabled, use earliest_time, otherwise use noon
                            if schedule.time_window_enabled and schedule.earliest_time:
                                scheduled_datetime = datetime.combine(
                                    next_occurrence_date,
                                    schedule.earliest_time,
                                    tzinfo=user_tz
                                )
                            else:
                                # Use noon as default time
                                scheduled_datetime = datetime.combine(
                                    next_occurrence_date,
                                    datetime.min.time().replace(hour=12),
                                    tzinfo=user_tz
                                )

                            # Convert to UTC and calculate reminder time
                            scheduled_utc = scheduled_datetime.astimezone(timezone.utc)
                            reminder_time = scheduled_utc - timedelta(minutes=schedule.reminder_minutes_before)

                            # Check if it's time to send reminder (within 5 minute window)
                            time_until_reminder = (reminder_time - now).total_seconds()

                            # Send reminder if within the next check interval (5 minutes)
                            if -300 <= time_until_reminder <= 300:  # 5 minute window
                                # Get reptile
                                reptile = await db.get(Reptile, schedule.reptile_id)
                                if not reptile:
                                    continue

                                # Check if user has access to this reptile
                                from app.permissions import check_reptile_access
                                try:
                                    await check_reptile_access(db, user, reptile.id)
                                except:
                                    # User doesn't have access, skip
                                    continue

                                # Check quiet hours (schedule reminders are not critical)
                                if is_within_quiet_hours(notif_settings, NotificationType.SCHEDULE_REMINDER, now):
                                    logger.debug(f"Skipping reminder for user {user.email} - within quiet hours")
                                    continue

                                # Send to each of this user's channels that are associated with this schedule
                                await db.refresh(schedule, ["notification_channels"])

                                for channel in schedule.notification_channels:
                                    # Only send to channels that belong to this user and are enabled
                                    if channel.notification_settings_id != notif_settings.id:
                                        continue
                                    if not channel.enabled:
                                        continue

                                    # Try to queue reminder task for reliable delivery
                                    # If Celery/Redis is down, fall back to direct send
                                    try:
                                        from app.celery_tasks import send_schedule_reminder_task

                                        send_schedule_reminder_task.delay(
                                            schedule_id=schedule.id,
                                            reptile_id=reptile.id,
                                            scheduled_date_str=next_occurrence_date.isoformat(),
                                            user_id=user.id,
                                            channel_id=channel.id
                                        )

                                        logger.info(
                                            f"Queued reminder task for schedule {schedule.id} ({schedule.schedule_type}) "
                                            f"for reptile {reptile.name} to user {user.email} via channel '{channel.name}'"
                                        )
                                    except Exception as celery_error:
                                        # Fallback: Send notification directly if Celery is down
                                        logger.warning(
                                            f"Celery queue failed for schedule {schedule.id}, falling back to direct send: {celery_error}"
                                        )

                                        # Send the reminder directly (synchronous fallback)
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
                                            f"Sent reminder directly (fallback) for schedule {schedule.id} "
                                            f"to user {user.email} via channel '{channel.name}'"
                                        )

                        except Exception as e:
                            logger.error(f"Error processing schedule {schedule.id} for user {user.email}: {e}", exc_info=True)
                            continue

                except Exception as e:
                    logger.error(f"Error processing user {user.email}: {e}", exc_info=True)
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
                    # Only check PENDING status to prevent duplicate alerts
                    # (once marked MISSED, alert has already been sent)
                    completion_result = await db.execute(
                        select(ScheduleCompletion).where(
                            and_(
                                ScheduleCompletion.schedule_id == schedule.id,
                                ScheduleCompletion.scheduled_date == yesterday,
                                ScheduleCompletion.status == CompletionStatus.PENDING
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

                            # Check quiet hours (overdue alerts are not critical)
                            if is_within_quiet_hours(notif_settings, NotificationType.OVERDUE_ALERT, now):
                                logger.debug(f"Skipping overdue alert for user {notif_settings.user_id} - within quiet hours")
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
    """Create an in-app notification for a user if in-app channel is enabled"""
    try:
        # Check if user has in-app notification channel enabled
        result = await db.execute(
            select(NotificationChannel)
            .join(NotificationSettings)
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
    # Build context for template matching and rendering
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
    webhook_url: str,
    webhook_type: str,
    config: dict = None
):
    """Send an overdue schedule alert"""
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
                        ScheduleInstance.status == "pending"
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
                    instance.status = "completed"
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

                    # Get quota status
                    period_type = schedule.quota_period.value if schedule.quota_period else "week"
                    quota_status = await check_quota_status(
                        db, schedule, schedule.reptile_id, today, first_day_of_week=0
                    )

                    # Only check max_days_between warning (HARD constraint)
                    if schedule.max_days_between and quota_status.get("days_since_last") is not None:
                        days_since_last = quota_status["days_since_last"]

                        # Send warning if approaching max (1 day before max)
                        if days_since_last == schedule.max_days_between - 1:
                            await send_interval_warning_notification(
                                db=db,
                                reptile=reptile,
                                schedule=schedule,
                                warning_type="max_days_approaching",
                                quota_status=quota_status
                            )
                        # Send alert if max exceeded
                        elif days_since_last >= schedule.max_days_between:
                            await send_interval_warning_notification(
                                db=db,
                                reptile=reptile,
                                schedule=schedule,
                                warning_type="max_days_exceeded",
                                quota_status=quota_status
                            )

                except Exception as e:
                    logger.error(f"Error checking interval schedule {schedule.id}: {e}", exc_info=True)
                    continue

    except Exception as e:
        logger.error(f"Error in check_interval_schedule_notifications: {e}", exc_info=True)


async def send_interval_warning_notification(
    db: AsyncSession,
    reptile: Reptile,
    schedule: Schedule,
    warning_type: str,
    quota_status: Dict
):
    """
    Send interval warning notification to all channels for an interval schedule.

    Only sends max_days_between warnings (HARD constraint).

    Uses the notification template system to allow user customization.

    warning_type can be:
    - max_days_approaching: Approaching max_days_between limit
    - max_days_exceeded: Exceeded max_days_between limit
    - period_ending_soon: Period ending soon and quota not met
    - quota_exceeded: Quota has been exceeded this period
    """
    try:
        # Get schedule's notification channels
        await db.refresh(schedule, ["notification_channels"])

        if not schedule.notification_channels:
            logger.debug(f"No channels for schedule {schedule.id}, skipping quota notification")
            return

        period_type = schedule.quota_period.value if schedule.quota_period else "week"
        period_label = "this week" if period_type == "week" else "this month"

        schedule_url = f"/schedules/{schedule.id}"

        # Calculate remaining feedings for period_ending_soon
        remaining = quota_status['quota_frequency'] - quota_status['count'] if warning_type == "period_ending_soon" else 0

        # Build context for template matching and rendering
        context = {
            "reptile_id": reptile.id,
            "reptile_name": reptile.name,
            "schedule_id": schedule.id,
            "schedule_name": schedule.name or "Requirement Schedule",
            "schedule_type": schedule.schedule_type,
            "schedule_url": schedule_url,
            "quota_count": quota_status["count"],
            "quota_frequency": quota_status["quota_frequency"],
            "period_type": period_type,
            "period_label": period_label,
            "days_since_last": quota_status.get("days_since_last"),
            "max_days_between": schedule.max_days_between,
            "warning_type": warning_type,
            "remaining_feedings": remaining,
            "emoji": "📊",  # Default emoji for quota warnings
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
            except:
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
                # User has a custom template - use it with quota warning context
                message = render_template(template.message_template, context)
                title = render_template(template.title_template, context) if template.title_template else f"Schedule Reminder - {reptile.name}"
            else:
                # Fallback to hardcoded messages if no template exists
                if warning_type == "max_days_approaching":
                    title = f"Feeding Reminder - {reptile.name}"
                    message = (
                        f"⏰ **Reminder:** It's been {quota_status['days_since_last']} days since you fed **{reptile.name}**.\n"
                        f"The maximum time between feedings is {schedule.max_days_between} days."
                    )
                elif warning_type == "max_days_exceeded":
                    title = f"Feeding Overdue - {reptile.name}"
                    message = (
                        f"⚠️ **Alert:** It's been {quota_status['days_since_last']} days since you fed **{reptile.name}**!\n"
                        f"The maximum time between feedings is {schedule.max_days_between} days. Please feed soon."
                    )
                elif warning_type == "period_ending_soon":
                    title = f"Quota Reminder - {reptile.name}"
                    message = (
                        f"📊 **Reminder:** **{reptile.name}** still needs {remaining} more feeding(s) {period_label}.\n"
                        f"Current progress: {quota_status['count']}/{quota_status['quota_frequency']}"
                    )
                elif warning_type == "quota_exceeded":
                    title = f"Quota Exceeded - {reptile.name}"
                    message = (
                        f"⚠️ **Notice:** **{reptile.name}** has been fed {quota_status['count']} times {period_label}.\n"
                        f"Target quota: {quota_status['quota_frequency']} times {period_label}"
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
                    "schedule_name": schedule.name or "Requirement Schedule",
                    "warning_type": warning_type,
                    "quota_status": quota_status
                }
            )

            logger.info(
                f"Sent quota {warning_type} notification for schedule {schedule.id} "
                f"for reptile {reptile.name} to user {user.email} via channel '{channel.name}'"
            )

    except Exception as e:
        logger.error(f"Error sending quota warning notification: {e}", exc_info=True)


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
