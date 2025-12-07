"""
Schedule Matching Service

Automatically matches feedings, mistings, and weight logs to their corresponding schedules.
Handles time window validation, completion tracking, and status determination.
"""

from datetime import datetime, time as py_time, timedelta, timezone, date as date_type
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.models import (
    Schedule,
    ScheduleCompletion,
    Feeding,
    MistingLog,
    WeightLog,
    CompletionStatus,
    CompletionType,
)


# Time tolerance for matching (e.g., 30 minutes before/after window is acceptable)
TOLERANCE_MINUTES = 30

# Date window for flexible completion (±X days)
# This allows completing a schedule instance up to X days before or after its scheduled date
DATE_WINDOW_DAYS = 2


async def find_instance_within_window(
    db: AsyncSession,
    schedule: Schedule,
    activity_date: date_type,
) -> Optional[Tuple[object, int]]:
    """
    Find a schedule instance within the flexible completion window of the activity date.
    Uses the schedule's flexible_completion_enabled and flexible_completion_days settings.

    Args:
        db: Database session
        schedule: The schedule object (contains flexible_completion settings)
        activity_date: Date when the activity occurred

    Returns:
        Tuple of (ScheduleInstance, days_offset) or None if no match found.
        days_offset is the number of days between activity and instance (0 = exact match)
    """
    from app.models import ScheduleInstance

    # Determine window size based on schedule settings
    if schedule.flexible_completion_enabled:
        window_days = schedule.flexible_completion_days or DATE_WINDOW_DAYS
    else:
        window_days = 0  # Exact date matching only

    # Calculate date range
    start_date = activity_date - timedelta(days=window_days)
    end_date = activity_date + timedelta(days=window_days)

    # Find all pending instances for this schedule within the window
    result = await db.execute(
        select(ScheduleInstance).where(
            and_(
                ScheduleInstance.schedule_id == schedule.id,
                ScheduleInstance.scheduled_date >= start_date,
                ScheduleInstance.scheduled_date <= end_date,
                ScheduleInstance.status == "pending"
            )
        ).order_by(
            # Prefer instances closer to the activity date
            # PostgreSQL: date subtraction returns integer days, so we can use abs() directly
            func.abs(ScheduleInstance.scheduled_date - activity_date)
        )
    )
    instances = result.scalars().all()

    if not instances:
        return None

    # Return the closest instance
    best_instance = instances[0]
    days_offset = abs((best_instance.scheduled_date - activity_date).days)

    return (best_instance, days_offset)


async def find_matching_schedule(
    db: AsyncSession,
    reptile_id: int,
    activity_date: datetime,
    activity_type: str,
    food_category: Optional[str] = None,
    food_id: Optional[int] = None,
    has_supplements: bool = False,
) -> Optional[Tuple[Schedule, int, bool]]:
    """
    Find the best matching schedule for an activity.

    Args:
        db: Database session
        reptile_id: ID of the reptile
        activity_date: When the activity occurred
        activity_type: "feeding", "misting", or "weighing"
        food_category: Category of food (for feedings)
        food_id: Specific food ID (for feedings)
        has_supplements: Whether supplements were used

    Returns:
        Tuple of (Schedule, match_score, within_window) or None if no match
    """
    # Get all pending schedules for this reptile on this date
    result = await db.execute(
        select(Schedule).filter(
            Schedule.reptile_id == reptile_id,
            Schedule.schedule_type == activity_type,
            Schedule.enabled == True,
        )
    )
    matching_schedules = result.scalars().all()

    if not matching_schedules:
        return None

    # Check if each schedule has already been completed for this date
    date_only = activity_date.date()
    best_match = None
    best_score = 0

    for schedule in matching_schedules:
        # Check if this schedule already has a completion for today
        result = await db.execute(
            select(ScheduleCompletion).filter(
                and_(
                    ScheduleCompletion.schedule_id == schedule.id,
                    ScheduleCompletion.scheduled_date == date_only,
                    ScheduleCompletion.status != CompletionStatus.PENDING,
                )
            )
        )
        existing_completion = result.scalar_one_or_none()

        if existing_completion:
            # Already completed, skip
            continue

        match_score = 0
        within_window = True

        # 1. Check time window (if enabled)
        if schedule.time_window_enabled and schedule.earliest_time and schedule.latest_time:
            activity_time = activity_date.time()
            within_window = is_within_time_window(
                activity_time, schedule.earliest_time, schedule.latest_time
            )

            # Check with tolerance
            within_tolerance = is_within_tolerance(
                activity_time, schedule.earliest_time, schedule.latest_time
            )

            if within_window:
                match_score += 10  # Perfect match
            elif within_tolerance:
                match_score += 5  # Acceptable match
            else:
                # Outside window even with tolerance - lower priority
                match_score += 1

        # 2. Food category check (if specified on schedule)
        if schedule.food_category:
            # Normalize both values for comparison (handle singular/plural variations)
            # e.g., "insect" matches "insects", "worm" matches "worms"
            normalized_food_category = food_category.lower().rstrip('s') if food_category else None
            normalized_schedule_category = schedule.food_category.lower().rstrip('s')

            if normalized_food_category == normalized_schedule_category:
                match_score += 5
            else:
                # Wrong food category, skip this schedule
                continue

        # 3. Supplement check (if required)
        # Note: We don't have a requires_supplement field yet, but this is placeholder for future
        # if schedule.requires_supplement and not has_supplements:
        #     continue

        # This schedule matches - check if it's the best so far
        if match_score > best_score:
            best_score = match_score
            best_match = (schedule, match_score, within_window)

    return best_match


def is_within_time_window(
    activity_time: py_time, earliest: py_time, latest: py_time
) -> bool:
    """Check if activity time is within the schedule's time window."""
    return earliest <= activity_time <= latest


def is_within_tolerance(
    activity_time: py_time, earliest: py_time, latest: py_time
) -> bool:
    """Check if activity time is within tolerance of the time window."""
    # Convert to datetime for easier math
    today = datetime.today().date()
    activity_dt = datetime.combine(today, activity_time)
    earliest_dt = datetime.combine(today, earliest)
    latest_dt = datetime.combine(today, latest)

    # Add tolerance
    earliest_with_tolerance = earliest_dt - timedelta(minutes=TOLERANCE_MINUTES)
    latest_with_tolerance = latest_dt + timedelta(minutes=TOLERANCE_MINUTES)

    return earliest_with_tolerance.time() <= activity_time <= latest_with_tolerance.time()


def determine_completion_status(
    activity_time: py_time,
    schedule: Schedule,
    within_window: bool,
) -> CompletionStatus:
    """
    Determine the completion status based on time window compliance.

    Args:
        activity_time: Time when the activity occurred
        schedule: The schedule being fulfilled
        within_window: Whether the activity was within the strict time window

    Returns:
        CompletionStatus enum value
    """
    # If no time window is enabled, it's always on time
    if not schedule.time_window_enabled or not schedule.earliest_time or not schedule.latest_time:
        return CompletionStatus.COMPLETED_ON_TIME

    if within_window:
        return CompletionStatus.COMPLETED_ON_TIME

    # Check if early or late
    if activity_time < schedule.earliest_time:
        return CompletionStatus.COMPLETED_EARLY
    elif activity_time > schedule.latest_time:
        return CompletionStatus.COMPLETED_LATE

    return CompletionStatus.COMPLETED_ON_TIME


async def assign_feeding_to_schedule(
    db: AsyncSession, feeding: Feeding
) -> Optional[ScheduleCompletion]:
    """
    Automatically assign a feeding to a matching schedule.

    Args:
        db: Database session
        feeding: The feeding object to assign

    Returns:
        ScheduleCompletion object if assigned, None otherwise
    """
    # Load foods to determine category
    from app.models import Food, feeding_foods, feeding_supplements

    # Get food category from first food
    food_category = None
    food_result = await db.execute(
        select(Food)
        .join(feeding_foods, Food.id == feeding_foods.c.food_id)
        .where(feeding_foods.c.feeding_id == feeding.id)
        .limit(1)
    )
    first_food = food_result.scalar_one_or_none()
    if first_food:
        # Convert enum to its string value for comparison
        food_category = first_food.category.value if hasattr(first_food.category, 'value') else str(first_food.category)

    # Check if supplements were used
    supplement_result = await db.execute(
        select(feeding_supplements.c.supplement_id)
        .where(feeding_supplements.c.feeding_id == feeding.id)
        .limit(1)
    )
    has_supplements = supplement_result.scalar_one_or_none() is not None

    # Find matching schedule
    match = await find_matching_schedule(
        db=db,
        reptile_id=feeding.reptile_id,
        activity_date=feeding.fed_at,
        activity_type="feeding",
        food_category=food_category,
        has_supplements=has_supplements,
    )

    if not match:
        # No matching schedule found - that's okay, this is an unscheduled feeding
        return None

    schedule, score, within_window = match

    # Determine completion status
    status = determine_completion_status(
        activity_time=feeding.fed_at.time(),
        schedule=schedule,
        within_window=within_window,
    )

    # Check if there's an existing PENDING completion for this schedule/date
    existing_result = await db.execute(
        select(ScheduleCompletion).filter(
            and_(
                ScheduleCompletion.schedule_id == schedule.id,
                ScheduleCompletion.scheduled_date == feeding.fed_at.date(),
                ScheduleCompletion.status == CompletionStatus.PENDING,
            )
        )
    )
    existing_completion = existing_result.scalar_one_or_none()

    # Look up the instance for this schedule
    instance = None
    instance_id = None
    days_offset = 0

    # For interval schedules, validate against min/max days and move instance to actual date
    from app.models import ScheduleMode
    if schedule.schedule_mode == ScheduleMode.INTERVAL:
        # Find the pending instance (should only be one for interval schedules)
        result = await db.execute(
            select(ScheduleInstance).where(
                and_(
                    ScheduleInstance.schedule_id == schedule.id,
                    ScheduleInstance.status == "pending"
                )
            ).limit(1)
        )
        instance = result.scalars().first()

        if instance:
            # Validate that completion is within min/max days from last completion
            # Get the last completion date
            last_completion_result = await db.execute(
                select(ScheduleCompletion.completed_at).where(
                    and_(
                        ScheduleCompletion.schedule_id == schedule.id,
                        ScheduleCompletion.status != CompletionStatus.PENDING
                    )
                ).order_by(ScheduleCompletion.completed_at.desc()).limit(1)
            )
            last_completion_datetime = last_completion_result.scalar()

            if last_completion_datetime:
                last_completion_date = last_completion_datetime.date()
                days_since_last = (feeding.fed_at.date() - last_completion_date).days

                # Validate min_days_between
                if schedule.min_days_between and days_since_last < schedule.min_days_between:
                    import logging
                    logging.getLogger(__name__).warning(
                        f"Feeding on {feeding.fed_at.date()} is too soon for interval schedule {schedule.id} "
                        f"(only {days_since_last} days since last, min is {schedule.min_days_between})"
                    )
                    return None

                # Validate max_days_between
                if schedule.max_days_between and days_since_last > schedule.max_days_between:
                    import logging
                    logging.getLogger(__name__).warning(
                        f"Feeding on {feeding.fed_at.date()} is too late for interval schedule {schedule.id} "
                        f"(already {days_since_last} days since last, max is {schedule.max_days_between})"
                    )
                    # Still allow it, but log warning - user might be catching up

            # Move the instance to the actual completion date
            instance.scheduled_date = feeding.fed_at.date()
            instance_id = instance.id
    else:
        # For fixed schedules, use flexible completion window
        instance_match = await find_instance_within_window(
            db=db,
            schedule=schedule,
            activity_date=feeding.fed_at.date()
        )
        if instance_match:
            instance, days_offset = instance_match
            instance_id = instance.id

    if existing_completion:
        # Update existing PENDING completion instead of creating a new one
        existing_completion.completed_at = feeding.fed_at
        existing_completion.completion_type = CompletionType.FEEDING
        existing_completion.completion_id = feeding.id
        existing_completion.within_time_window = within_window
        existing_completion.status = status
        existing_completion.instance_id = instance_id
        completion = existing_completion
    else:
        # Create new completion record
        completion = ScheduleCompletion(
            schedule_id=schedule.id,
            instance_id=instance_id,
            scheduled_date=feeding.fed_at.date(),
            completed_at=feeding.fed_at,
            completion_type=CompletionType.FEEDING,
            completion_id=feeding.id,
            within_time_window=within_window,
            status=status,
            reptile_id=feeding.reptile_id,
        )
        db.add(completion)

    await db.flush()  # Get the ID without committing

    # Mark the instance as completed
    if instance:
        instance.status = "completed"
        instance.updated_at = datetime.now(timezone.utc)

        # For interval schedules, generate the next instance dynamically
        from app.models import ScheduleMode
        if schedule.schedule_mode == ScheduleMode.INTERVAL:
            from app.instance_generator import create_interval_schedule_instance
            try:
                await create_interval_schedule_instance(
                    db=db,
                    schedule=schedule,
                    last_completion_date=feeding.fed_at.date()
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(
                    f"Failed to create next interval instance for schedule {schedule.id}: {e}",
                    exc_info=True
                )

    # Link feeding to completion
    feeding.schedule_completion_id = completion.id

    return completion


async def assign_misting_to_schedule(
    db: AsyncSession, misting: MistingLog
) -> Optional[ScheduleCompletion]:
    """
    Automatically assign a misting to a matching schedule.

    Args:
        db: Database session
        misting: The misting log object to assign

    Returns:
        ScheduleCompletion object if assigned, None otherwise
    """
    # Find matching schedule
    match = await find_matching_schedule(
        db=db,
        reptile_id=misting.reptile_id,
        activity_date=misting.misted_at,
        activity_type="misting",
    )

    if not match:
        return None

    schedule, score, within_window = match

    # Determine completion status
    status = determine_completion_status(
        activity_time=misting.misted_at.time(),
        schedule=schedule,
        within_window=within_window,
    )

    # Check if there's an existing PENDING completion for this schedule/date
    existing_result = await db.execute(
        select(ScheduleCompletion).filter(
            and_(
                ScheduleCompletion.schedule_id == schedule.id,
                ScheduleCompletion.scheduled_date == misting.misted_at.date(),
                ScheduleCompletion.status == CompletionStatus.PENDING,
            )
        )
    )
    existing_completion = existing_result.scalar_one_or_none()

    # Look up the instance for this schedule
    instance = None
    instance_id = None
    days_offset = 0

    # For interval schedules, validate against min/max days and move instance to actual date
    from app.models import ScheduleMode
    if schedule.schedule_mode == ScheduleMode.INTERVAL:
        # Find the pending instance (should only be one for interval schedules)
        result = await db.execute(
            select(ScheduleInstance).where(
                and_(
                    ScheduleInstance.schedule_id == schedule.id,
                    ScheduleInstance.status == "pending"
                )
            ).limit(1)
        )
        instance = result.scalars().first()

        if instance:
            # Validate that completion is within min/max days from last completion
            # Get the last completion date
            last_completion_result = await db.execute(
                select(ScheduleCompletion.completed_at).where(
                    and_(
                        ScheduleCompletion.schedule_id == schedule.id,
                        ScheduleCompletion.status != CompletionStatus.PENDING
                    )
                ).order_by(ScheduleCompletion.completed_at.desc()).limit(1)
            )
            last_completion_datetime = last_completion_result.scalar()

            if last_completion_datetime:
                last_completion_date = last_completion_datetime.date()
                days_since_last = (misting.misted_at.date() - last_completion_date).days

                # Validate min_days_between
                if schedule.min_days_between and days_since_last < schedule.min_days_between:
                    import logging
                    logging.getLogger(__name__).warning(
                        f"Misting on {misting.misted_at.date()} is too soon for interval schedule {schedule.id} "
                        f"(only {days_since_last} days since last, min is {schedule.min_days_between})"
                    )
                    return None

                # Validate max_days_between
                if schedule.max_days_between and days_since_last > schedule.max_days_between:
                    import logging
                    logging.getLogger(__name__).warning(
                        f"Misting on {misting.misted_at.date()} is too late for interval schedule {schedule.id} "
                        f"(already {days_since_last} days since last, max is {schedule.max_days_between})"
                    )
                    # Still allow it, but log warning - user might be catching up

            # Move the instance to the actual completion date
            instance.scheduled_date = misting.misted_at.date()
            instance_id = instance.id
    else:
        # For fixed schedules, use flexible completion window
        instance_match = await find_instance_within_window(
            db=db,
            schedule=schedule,
            activity_date=misting.misted_at.date()
        )
        if instance_match:
            instance, days_offset = instance_match
            instance_id = instance.id

    if existing_completion:
        # Update existing PENDING completion instead of creating a new one
        existing_completion.completed_at = misting.misted_at
        existing_completion.completion_type = CompletionType.MISTING
        existing_completion.completion_id = misting.id
        existing_completion.within_time_window = within_window
        existing_completion.status = status
        existing_completion.instance_id = instance_id
        completion = existing_completion
    else:
        # Create new completion record
        completion = ScheduleCompletion(
            schedule_id=schedule.id,
            instance_id=instance_id,
            scheduled_date=misting.misted_at.date(),
            completed_at=misting.misted_at,
            completion_type=CompletionType.MISTING,
            completion_id=misting.id,
            within_time_window=within_window,
            status=status,
            reptile_id=misting.reptile_id,
        )
        db.add(completion)

    await db.flush()

    # Mark the instance as completed
    if instance:
        instance.status = "completed"
        instance.updated_at = datetime.now(timezone.utc)

        # For interval schedules, generate the next instance dynamically
        from app.models import ScheduleMode
        if schedule.schedule_mode == ScheduleMode.INTERVAL:
            from app.instance_generator import create_interval_schedule_instance
            try:
                await create_interval_schedule_instance(
                    db=db,
                    schedule=schedule,
                    last_completion_date=misting.misted_at.date()
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(
                    f"Failed to create next interval instance for schedule {schedule.id}: {e}",
                    exc_info=True
                )

    # Link misting to completion
    misting.schedule_completion_id = completion.id

    return completion


async def assign_weighing_to_schedule(
    db: AsyncSession, weight_log: WeightLog
) -> Optional[ScheduleCompletion]:
    """
    Automatically assign a weight log to a matching schedule.

    Args:
        db: Database session
        weight_log: The weight log object to assign

    Returns:
        ScheduleCompletion object if assigned, None otherwise
    """
    # Find matching schedule
    match = await find_matching_schedule(
        db=db,
        reptile_id=weight_log.reptile_id,
        activity_date=weight_log.measured_at,
        activity_type="weighing",
    )

    if not match:
        return None

    schedule, score, within_window = match

    # Determine completion status
    status = determine_completion_status(
        activity_time=weight_log.measured_at.time(),
        schedule=schedule,
        within_window=within_window,
    )

    # Check if there's an existing PENDING completion for this schedule/date
    existing_result = await db.execute(
        select(ScheduleCompletion).filter(
            and_(
                ScheduleCompletion.schedule_id == schedule.id,
                ScheduleCompletion.scheduled_date == weight_log.measured_at.date(),
                ScheduleCompletion.status == CompletionStatus.PENDING,
            )
        )
    )
    existing_completion = existing_result.scalar_one_or_none()

    # Look up the instance for this schedule
    instance = None
    instance_id = None
    days_offset = 0

    # For interval schedules, validate against min/max days and move instance to actual date
    from app.models import ScheduleMode
    if schedule.schedule_mode == ScheduleMode.INTERVAL:
        # Find the pending instance (should only be one for interval schedules)
        result = await db.execute(
            select(ScheduleInstance).where(
                and_(
                    ScheduleInstance.schedule_id == schedule.id,
                    ScheduleInstance.status == "pending"
                )
            ).limit(1)
        )
        instance = result.scalars().first()

        if instance:
            # Validate that completion is within min/max days from last completion
            # Get the last completion date
            last_completion_result = await db.execute(
                select(ScheduleCompletion.completed_at).where(
                    and_(
                        ScheduleCompletion.schedule_id == schedule.id,
                        ScheduleCompletion.status != CompletionStatus.PENDING
                    )
                ).order_by(ScheduleCompletion.completed_at.desc()).limit(1)
            )
            last_completion_datetime = last_completion_result.scalar()

            if last_completion_datetime:
                last_completion_date = last_completion_datetime.date()
                days_since_last = (weight_log.measured_at.date() - last_completion_date).days

                # Validate min_days_between
                if schedule.min_days_between and days_since_last < schedule.min_days_between:
                    import logging
                    logging.getLogger(__name__).warning(
                        f"Weight log on {weight_log.measured_at.date()} is too soon for interval schedule {schedule.id} "
                        f"(only {days_since_last} days since last, min is {schedule.min_days_between})"
                    )
                    return None

                # Validate max_days_between
                if schedule.max_days_between and days_since_last > schedule.max_days_between:
                    import logging
                    logging.getLogger(__name__).warning(
                        f"Weight log on {weight_log.measured_at.date()} is too late for interval schedule {schedule.id} "
                        f"(already {days_since_last} days since last, max is {schedule.max_days_between})"
                    )
                    # Still allow it, but log warning - user might be catching up

            # Move the instance to the actual completion date
            instance.scheduled_date = weight_log.measured_at.date()
            instance_id = instance.id
    else:
        # For fixed schedules, use flexible completion window
        instance_match = await find_instance_within_window(
            db=db,
            schedule=schedule,
            activity_date=weight_log.measured_at.date()
        )
        if instance_match:
            instance, days_offset = instance_match
            instance_id = instance.id

    if existing_completion:
        # Update existing PENDING completion instead of creating a new one
        existing_completion.completed_at = weight_log.measured_at
        existing_completion.completion_type = CompletionType.WEIGHING
        existing_completion.completion_id = weight_log.id
        existing_completion.within_time_window = within_window
        existing_completion.status = status
        existing_completion.instance_id = instance_id
        completion = existing_completion
    else:
        # Create new completion record
        completion = ScheduleCompletion(
            schedule_id=schedule.id,
            instance_id=instance_id,
            scheduled_date=weight_log.measured_at.date(),
            completed_at=weight_log.measured_at,
            completion_type=CompletionType.WEIGHING,
            completion_id=weight_log.id,
            within_time_window=within_window,
            status=status,
            reptile_id=weight_log.reptile_id,
        )
        db.add(completion)

    await db.flush()

    # Mark the instance as completed
    if instance:
        instance.status = "completed"
        instance.updated_at = datetime.now(timezone.utc)

        # For interval schedules, generate the next instance dynamically
        from app.models import ScheduleMode
        if schedule.schedule_mode == ScheduleMode.INTERVAL:
            from app.instance_generator import create_interval_schedule_instance
            try:
                await create_interval_schedule_instance(
                    db=db,
                    schedule=schedule,
                    last_completion_date=weight_log.measured_at.date()
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(
                    f"Failed to create next interval instance for schedule {schedule.id}: {e}",
                    exc_info=True
                )

    # Link weight log to completion
    weight_log.schedule_completion_id = completion.id

    return completion
