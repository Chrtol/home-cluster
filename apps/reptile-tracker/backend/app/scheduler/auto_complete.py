"""
Auto-complete job management functions for scheduling and executing automatic
completion of schedule instances.

Extracted from scheduler/core.py as part of Phase 3 modularization.
"""
import logging
from datetime import datetime, timezone, timedelta, time as py_time
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models import (
    Schedule,
    ScheduleCompletion,
    ScheduledNotificationJob,
    NotificationChannel,
    NotificationSettings,
    User,
    Reptile,
    CompletionStatus,
    AccessLevel,
    household_members,
    ScheduleMode,
    InstanceStatus,
)

if TYPE_CHECKING:
    from app.models import ScheduleInstance

logger = logging.getLogger(__name__)


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
    if instance.status != InstanceStatus.PENDING:
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

            instance.status = InstanceStatus.COMPLETED
            instance.updated_at = now

            # For interval schedules, create the next instance
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
        if instance.status != InstanceStatus.COMPLETED:
            instance.status = InstanceStatus.COMPLETED
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
    instance.status = InstanceStatus.COMPLETED
    instance.updated_at = now

    # For interval schedules, create the next instance
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
    scheduler: AsyncIOScheduler,
    instance: "ScheduleInstance",
    schedule: Schedule,
    user_tz: ZoneInfo
):
    """
    Schedule an autocomplete job for a specific schedule instance.

    Args:
        scheduler: APScheduler instance (passed to avoid circular imports)
        instance: The schedule instance to autocomplete
        schedule: The schedule this instance belongs to
        user_tz: Timezone of the household owner/manager
    """
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
