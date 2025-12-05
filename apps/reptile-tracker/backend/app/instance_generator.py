"""
Schedule instance generation system

This module handles creating and managing schedule instances - pre-generated occurrences
of schedules with pre-calculated supplements.
"""
import logging
from datetime import datetime, timezone, timedelta, date as py_date
from typing import List, Dict, Optional
from sqlalchemy import select, and_, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Schedule, ScheduleInstance, FeedingRotation, Supplement
from app.database import async_session_maker

logger = logging.getLogger(__name__)


def should_schedule_occur_on_date(schedule: Schedule, check_date: py_date) -> bool:
    """
    Check if a schedule should occur on a given date based on its rule.
    This is the same logic used in scheduler.py but centralized here.
    """
    if schedule.schedule_rule == "every_x_days":
        if not schedule.frequency_days:
            return False
        # Calculate days since creation
        created_date = schedule.created_at.date() if schedule.created_at else check_date
        days_diff = (check_date - created_date).days
        return days_diff % schedule.frequency_days == 0

    elif schedule.schedule_rule == "days_of_week":
        if not schedule.days_of_week:
            return False
        # days_of_week is comma-separated: '0,2,4' for Sun,Tue,Thu
        # weekday() returns 0=Mon, 6=Sun, but we store 0=Sun, 6=Sat
        weekday = (check_date.weekday() + 1) % 7  # Convert to 0=Sun format
        allowed_days = [int(d.strip()) for d in schedule.days_of_week.split(',')]
        return weekday in allowed_days

    elif schedule.schedule_rule == "monthly":
        if not schedule.day_of_month:
            return False
        return check_date.day == schedule.day_of_month

    # Dependent schedules are not directly scheduled - they depend on parent schedule
    # We'll handle those separately when generating instances
    elif schedule.schedule_rule == "dependent":
        return False

    return False


async def calculate_supplements_for_instance(
    db: AsyncSession,
    reptile_id: int,
    schedule_type: str,
    scheduled_date: py_date,
    feeding_sequence_number: Optional[int] = None,
    food_category: Optional[str] = None
) -> List[Dict]:
    """
    Calculate which supplements should apply to a schedule instance.
    Returns a list of supplement dictionaries with id, name, and priority.

    Args:
        db: Database session
        reptile_id: ID of the reptile
        schedule_type: Type of schedule (feeding, misting, etc.)
        scheduled_date: Date of the instance
        feeding_sequence_number: Sequence number for feeding instances (1, 2, 3, etc.)
        food_category: Category of food (for filtering applicable rotations)
    """
    if schedule_type != "feeding":
        return []

    # Get all active supplement rotations for this reptile
    result = await db.execute(
        select(FeedingRotation)
        .where(
            and_(
                FeedingRotation.reptile_id == reptile_id,
                FeedingRotation.rotation_type == "supplement",
                FeedingRotation.enabled == True
            )
        )
        .options(selectinload(FeedingRotation.supplement))
        .order_by(FeedingRotation.priority.asc())
    )
    rotations = result.scalars().all()

    if not rotations:
        return []

    # First, collect all triggered rotations
    triggered_rotations = []

    for rotation in rotations:
        if not rotation.supplement:
            continue

        # Check if this rotation applies based on food category
        if food_category and rotation.applies_to_category:
            if rotation.applies_to_category != 'all' and rotation.applies_to_category != food_category:
                continue

        # Check if this rotation applies to this instance
        applies = False

        if rotation.trigger_mode == "feeding_count":
            # Check if this feeding number triggers the supplement
            if feeding_sequence_number and rotation.every_n_feedings:
                if feeding_sequence_number % rotation.every_n_feedings == 0:
                    applies = True

        elif rotation.trigger_mode == "schedule_based":
            # Check if the scheduled_date's day of week matches
            if rotation.schedule_days_of_week:
                weekday = (scheduled_date.weekday() + 1) % 7  # Convert to 0=Sun format
                allowed_days = [int(d.strip()) for d in rotation.schedule_days_of_week.split(',')]
                if weekday in allowed_days:
                    applies = True

        if applies:
            triggered_rotations.append(rotation)

    # Handle exclusivity: If any rotation is exclusive, only keep highest priority
    if triggered_rotations and any(r.is_exclusive for r in triggered_rotations):
        exclusive_rotations = [r for r in triggered_rotations if r.is_exclusive]
        if exclusive_rotations:
            # Get the highest priority (lowest number) among exclusive rotations
            highest_priority = min(r.priority if r.priority is not None else 999 for r in exclusive_rotations)
            # Filter to only rotations at this priority level
            triggered_rotations = [r for r in triggered_rotations if (r.priority if r.priority is not None else 999) == highest_priority]

    # Convert to supplement dictionaries
    supplements = [
        {
            "id": rotation.supplement.id,
            "name": rotation.supplement.name,
            "priority": rotation.priority if rotation.priority is not None else 999
        }
        for rotation in triggered_rotations
    ]

    return supplements


async def generate_instances_for_schedule(
    db: AsyncSession,
    schedule: Schedule,
    days_ahead: int = 60,
    from_date: Optional[py_date] = None
) -> int:
    """
    Generate schedule instances for a given schedule for the next N days.

    Args:
        db: Database session
        schedule: The schedule to generate instances for
        days_ahead: How many days ahead to generate instances (default 60)
        from_date: Start date (default: today)

    Returns:
        Number of instances created
    """
    if not schedule.enabled:
        logger.debug(f"Schedule {schedule.id} is disabled, skipping instance generation")
        return 0

    if from_date is None:
        from_date = datetime.now(timezone.utc).date()

    # Get the current maximum feeding sequence number for this schedule
    # This allows us to continue the sequence when generating new instances
    max_seq_result = await db.execute(
        select(func.max(ScheduleInstance.feeding_sequence_number))
        .where(ScheduleInstance.schedule_id == schedule.id)
    )
    current_max_sequence = max_seq_result.scalar() or 0

    instances_created = 0

    for days_offset in range(days_ahead):
        check_date = from_date + timedelta(days=days_offset)

        # Check if this date matches the schedule rule
        if not should_schedule_occur_on_date(schedule, check_date):
            continue

        # Check if instance already exists
        existing = await db.execute(
            select(ScheduleInstance).where(
                and_(
                    ScheduleInstance.schedule_id == schedule.id,
                    ScheduleInstance.scheduled_date == check_date
                )
            )
        )
        if existing.scalars().first():
            logger.debug(f"Instance already exists for schedule {schedule.id} on {check_date}")
            continue

        # Increment feeding sequence number for feeding schedules
        feeding_sequence_number = None
        if schedule.schedule_type == "feeding":
            current_max_sequence += 1
            feeding_sequence_number = current_max_sequence

        # Calculate supplements for this instance
        supplements = await calculate_supplements_for_instance(
            db=db,
            reptile_id=schedule.reptile_id,
            schedule_type=schedule.schedule_type,
            scheduled_date=check_date,
            feeding_sequence_number=feeding_sequence_number,
            food_category=schedule.food_category
        )

        # Create the instance
        instance = ScheduleInstance(
            schedule_id=schedule.id,
            scheduled_date=check_date,
            status="pending",
            feeding_sequence_number=feeding_sequence_number,
            supplements=supplements if supplements else None
        )
        db.add(instance)
        instances_created += 1

        logger.debug(
            f"Created instance for schedule {schedule.id} ({schedule.schedule_type}) "
            f"on {check_date} (seq #{feeding_sequence_number}) with {len(supplements)} supplements"
        )

    await db.flush()
    return instances_created


async def generate_instances_for_all_schedules(days_ahead: int = 60) -> Dict[str, int]:
    """
    Generate instances for all enabled schedules.
    This should be run daily to ensure instances exist for the next N days.

    Returns:
        Dictionary with statistics: {'schedules_processed': X, 'instances_created': Y}
    """
    logger.info(f"Generating instances for all schedules ({days_ahead} days ahead)")

    async with async_session_maker() as db:
        # Get all enabled schedules
        result = await db.execute(
            select(Schedule).where(Schedule.enabled == True)
        )
        schedules = result.scalars().all()

        schedules_processed = 0
        instances_created = 0

        for schedule in schedules:
            try:
                count = await generate_instances_for_schedule(db, schedule, days_ahead)
                instances_created += count
                schedules_processed += 1
            except Exception as e:
                logger.error(f"Error generating instances for schedule {schedule.id}: {e}", exc_info=True)
                continue

        await db.commit()

        logger.info(
            f"Instance generation complete: {schedules_processed} schedules processed, "
            f"{instances_created} instances created"
        )

        return {
            'schedules_processed': schedules_processed,
            'instances_created': instances_created
        }


async def delete_instances_for_schedule(db: AsyncSession, schedule_id: int) -> int:
    """
    Delete all future instances for a schedule.
    Used when a schedule is edited or deleted.

    Returns:
        Number of instances deleted
    """
    today = datetime.now(timezone.utc).date()

    result = await db.execute(
        delete(ScheduleInstance).where(
            and_(
                ScheduleInstance.schedule_id == schedule_id,
                ScheduleInstance.scheduled_date >= today,
                ScheduleInstance.status == "pending"
            )
        )
    )

    deleted_count = result.rowcount if hasattr(result, 'rowcount') else 0
    logger.info(f"Deleted {deleted_count} future instances for schedule {schedule_id}")

    return deleted_count


async def regenerate_instances_for_schedule(
    db: AsyncSession,
    schedule_id: int,
    days_ahead: int = 60
) -> int:
    """
    Delete and regenerate instances for a schedule.
    Used when a schedule is edited.

    Returns:
        Number of instances created
    """
    logger.info(f"Regenerating instances for schedule {schedule_id}")

    # Delete existing future instances
    await delete_instances_for_schedule(db, schedule_id)

    # Get the schedule
    schedule = await db.get(Schedule, schedule_id)
    if not schedule:
        logger.warning(f"Schedule {schedule_id} not found")
        return 0

    # Generate new instances
    instances_created = await generate_instances_for_schedule(db, schedule, days_ahead)

    await db.commit()

    logger.info(f"Regenerated {instances_created} instances for schedule {schedule_id}")
    return instances_created


async def cleanup_old_instances(days_to_keep: int = 30) -> int:
    """
    Clean up old instances that are past their scheduled date.
    Keeps instances for the last N days for historical reference.

    Returns:
        Number of instances deleted
    """
    logger.info(f"Cleaning up instances older than {days_to_keep} days")

    async with async_session_maker() as db:
        cutoff_date = datetime.now(timezone.utc).date() - timedelta(days=days_to_keep)

        result = await db.execute(
            delete(ScheduleInstance).where(
                ScheduleInstance.scheduled_date < cutoff_date
            )
        )

        deleted_count = result.rowcount if hasattr(result, 'rowcount') else 0
        await db.commit()

        logger.info(f"Cleaned up {deleted_count} old instances")
        return deleted_count


async def update_instance_status(
    db: AsyncSession,
    instance_id: int,
    status: str
) -> bool:
    """
    Update the status of a schedule instance.

    Args:
        db: Database session
        instance_id: ID of the instance to update
        status: New status (pending, completed, missed, skipped)

    Returns:
        True if updated, False if instance not found
    """
    instance = await db.get(ScheduleInstance, instance_id)
    if not instance:
        logger.warning(f"Instance {instance_id} not found")
        return False

    instance.status = status
    instance.updated_at = datetime.now(timezone.utc)
    await db.flush()

    logger.debug(f"Updated instance {instance_id} status to {status}")
    return True
