"""
Feeding refusal service for handling retry scheduling when a reptile refuses food.

This module handles:
- Scheduling retry attempts based on user-selected options
- Creating schedule instances for retry notifications
- Linking retry instances back to the original feeding log
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Feeding,
    Schedule,
    ScheduleInstance,
    FeedingStatus,
    InstanceStatus,
    ScheduleMode,
)
from app.schemas import RetryOption

logger = logging.getLogger(__name__)


async def schedule_feeding_retry(
    db: AsyncSession,
    feeding: Feeding,
    retry_option: RetryOption,
    retry_datetime: Optional[datetime] = None
) -> Optional[int]:
    """
    Schedule a retry attempt for a refused feeding.

    Args:
        db: Database session
        feeding: The feeding record that was refused
        retry_option: The retry scheduling option selected by the user
        retry_datetime: Custom datetime if retry_option is CUSTOM

    Returns:
        The ID of the created schedule instance, or None if no instance could be created
    """
    if feeding.status != FeedingStatus.REFUSED:
        logger.warning(f"Cannot schedule retry for feeding {feeding.id} - status is {feeding.status}, not REFUSED")
        return None

    # Calculate the retry datetime based on the option
    scheduled_retry = _calculate_retry_datetime(
        feeding=feeding,
        retry_option=retry_option,
        retry_datetime=retry_datetime
    )

    if not scheduled_retry:
        logger.warning(f"Could not calculate retry datetime for feeding {feeding.id}")
        return None

    # Try to find a matching feeding schedule for this reptile
    # to create a proper instance with notification support
    schedule = await _find_matching_schedule(db, feeding.reptile_id)

    if schedule:
        # Create a schedule instance for the retry
        instance = ScheduleInstance(
            schedule_id=schedule.id,
            scheduled_date=scheduled_retry.date(),
            status=InstanceStatus.PENDING,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(instance)
        await db.flush()

        # Link the retry instance to the original feeding
        feeding.retry_scheduled_for = scheduled_retry
        feeding.retry_instance_id = instance.id

        # Schedule notification for the retry instance
        await _schedule_retry_notifications(db, schedule, instance, scheduled_retry)

        logger.info(
            f"Scheduled feeding retry for feeding {feeding.id} on {scheduled_retry} "
            f"with instance {instance.id}"
        )

        return instance.id
    else:
        # No matching schedule found, just store the retry datetime without an instance
        feeding.retry_scheduled_for = scheduled_retry
        feeding.retry_instance_id = None

        logger.info(
            f"Scheduled feeding retry for feeding {feeding.id} on {scheduled_retry} "
            f"(no matching schedule found)"
        )

        return None


def _calculate_retry_datetime(
    feeding: Feeding,
    retry_option: RetryOption,
    retry_datetime: Optional[datetime] = None
) -> Optional[datetime]:
    """
    Calculate when to retry based on the selected option.

    Args:
        feeding: The refused feeding
        retry_option: The selected retry option
        retry_datetime: Custom datetime for CUSTOM option

    Returns:
        The calculated retry datetime
    """
    fed_at = feeding.fed_at

    if retry_option == RetryOption.TOMORROW_SAME_TIME:
        # Same time tomorrow
        return fed_at + timedelta(days=1)

    elif retry_option == RetryOption.CUSTOM:
        # Use the provided custom datetime
        if retry_datetime:
            return retry_datetime
        else:
            # Default to tomorrow same time if no custom datetime provided
            logger.warning("Custom retry option selected but no datetime provided, defaulting to tomorrow")
            return fed_at + timedelta(days=1)

    elif retry_option == RetryOption.NEXT_SCHEDULED:
        # This requires looking up the next scheduled feeding
        # For now, return None and let the caller handle finding the next schedule
        # The frontend/API should resolve this to a specific datetime
        return None

    return None


async def _find_matching_schedule(
    db: AsyncSession,
    reptile_id: int
) -> Optional[Schedule]:
    """
    Find a feeding schedule for the reptile that can be used for the retry instance.

    Prefers enabled schedules with notifications configured.
    """
    result = await db.execute(
        select(Schedule)
        .options(selectinload(Schedule.notification_channels))
        .where(
            and_(
                Schedule.reptile_id == reptile_id,
                Schedule.schedule_type == "feeding",
                Schedule.enabled == True,
            )
        )
        .order_by(Schedule.created_at.desc())
        .limit(1)
    )
    return result.scalars().first()


async def _schedule_retry_notifications(
    db: AsyncSession,
    schedule: Schedule,
    instance: ScheduleInstance,
    retry_datetime: datetime
):
    """
    Schedule notifications for a retry instance using the existing notification system.

    This leverages the schedule's configured notification channels.
    """
    if not schedule.notification_channels or not schedule.notifications_enabled:
        logger.debug(f"No notifications to schedule for retry instance {instance.id}")
        return

    try:
        # Import here to avoid circular imports
        from app.scheduler import schedule_notifications_for_interval_instance, scheduler

        if scheduler:
            await schedule_notifications_for_interval_instance(
                scheduler,
                db,
                schedule,
                retry_datetime.date()
            )
            logger.info(f"Scheduled notifications for retry instance {instance.id}")
        else:
            logger.warning("Scheduler not available, cannot schedule retry notifications")
    except Exception as e:
        logger.error(f"Error scheduling retry notifications: {e}", exc_info=True)


async def get_next_scheduled_feeding(
    db: AsyncSession,
    reptile_id: int,
    after_date: datetime
) -> Optional[datetime]:
    """
    Find the next scheduled feeding for a reptile after a given date.

    This is used to resolve the NEXT_SCHEDULED retry option.

    Args:
        db: Database session
        reptile_id: The reptile ID
        after_date: Find instances after this date

    Returns:
        The datetime of the next scheduled feeding, or None if not found
    """
    result = await db.execute(
        select(ScheduleInstance)
        .join(Schedule, ScheduleInstance.schedule_id == Schedule.id)
        .where(
            and_(
                Schedule.reptile_id == reptile_id,
                Schedule.schedule_type == "feeding",
                Schedule.enabled == True,
                ScheduleInstance.status == InstanceStatus.PENDING,
                ScheduleInstance.scheduled_date > after_date.date(),
            )
        )
        .order_by(ScheduleInstance.scheduled_date.asc())
        .limit(1)
    )
    instance = result.scalars().first()

    if instance:
        # Combine date with schedule's reminder time for a full datetime
        schedule_result = await db.execute(
            select(Schedule).where(Schedule.id == instance.schedule_id)
        )
        schedule = schedule_result.scalars().first()

        if schedule and schedule.earliest_time:
            return datetime.combine(
                instance.scheduled_date,
                schedule.earliest_time,
                tzinfo=timezone.utc
            )
        else:
            # Default to start of day
            return datetime.combine(
                instance.scheduled_date,
                datetime.min.time(),
                tzinfo=timezone.utc
            )

    return None


async def cancel_retry(
    db: AsyncSession,
    feeding_id: int
) -> bool:
    """
    Cancel a scheduled retry for a feeding.

    Args:
        db: Database session
        feeding_id: The feeding ID to cancel retry for

    Returns:
        True if retry was cancelled, False if no retry was found
    """
    result = await db.execute(
        select(Feeding).where(Feeding.id == feeding_id)
    )
    feeding = result.scalars().first()

    if not feeding:
        return False

    if not feeding.retry_scheduled_for and not feeding.retry_instance_id:
        return False

    # Delete the retry instance if it exists and is still pending
    if feeding.retry_instance_id:
        instance_result = await db.execute(
            select(ScheduleInstance).where(ScheduleInstance.id == feeding.retry_instance_id)
        )
        instance = instance_result.scalars().first()

        if instance and instance.status == InstanceStatus.PENDING:
            await db.delete(instance)
            logger.info(f"Deleted retry instance {instance.id} for feeding {feeding_id}")

    # Clear the retry fields on the feeding
    feeding.retry_scheduled_for = None
    feeding.retry_instance_id = None

    logger.info(f"Cancelled retry for feeding {feeding_id}")
    return True
