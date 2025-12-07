"""
Quota tracking for interval-based schedules (informational only - no enforcement).

This module handles tracking quotas for schedules in "interval" mode,
which use time intervals between events with min/max day constraints
(e.g., "every 3-4 days" or "every 2-7 days").

Note: Quota tracking is purely informational for display purposes.
The only HARD constraints are min_days_between and max_days_between.
"""
from datetime import date, timedelta
from typing import Optional, Dict, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import QuotaTracking, Schedule, ScheduleMode, QuotaPeriod
from app.schemas import QuotaTrackingCreate


def get_period_start_date(target_date: date, period_type: str, first_day_of_week: int = 0) -> date:
    """
    Get the start of the period for a given date.

    Args:
        target_date: The date to get the period start for
        period_type: "week" or "month"
        first_day_of_week: 0=Monday (default), 6=Sunday (only used for weekly periods)

    Returns:
        date: The start of the period
    """
    if period_type == "week":
        # Calculate days since the configured first day of week
        days_since_week_start = (target_date.weekday() - first_day_of_week) % 7
        period_start = target_date - timedelta(days=days_since_week_start)
        return period_start
    elif period_type == "month":
        # First day of the month
        return target_date.replace(day=1)
    else:
        raise ValueError(f"Invalid period_type: {period_type}. Must be 'week' or 'month'.")


async def get_or_create_quota_tracking(
    db: AsyncSession,
    schedule_id: int,
    reptile_id: int,
    completion_date: date,
    period_type: str,
    first_day_of_week: int = 0
) -> QuotaTracking:
    """
    Get or create a quota tracking record for a schedule and period (informational only).

    Args:
        db: Database session
        schedule_id: ID of the interval schedule
        reptile_id: ID of the reptile
        completion_date: Date of the completion (to determine the period)
        period_type: "week" or "month"
        first_day_of_week: 0=Monday (default), 6=Sunday

    Returns:
        QuotaTracking: The quota tracking record
    """
    period_start = get_period_start_date(completion_date, period_type, first_day_of_week)

    # Try to find existing quota for this period
    result = await db.execute(
        select(QuotaTracking).where(
            QuotaTracking.schedule_id == schedule_id,
            QuotaTracking.period_start_date == period_start
        )
    )
    quota = result.scalar_one_or_none()

    if not quota:
        # Create new quota record
        quota = QuotaTracking(
            schedule_id=schedule_id,
            reptile_id=reptile_id,
            period_start_date=period_start,
            period_type=period_type,
            count=0,
            last_completion_date=None
        )
        db.add(quota)
        await db.flush()

    return quota


async def increment_quota(
    db: AsyncSession,
    schedule_id: int,
    reptile_id: int,
    completion_date: date,
    period_type: str,
    first_day_of_week: int = 0
) -> QuotaTracking:
    """
    Increment the quota for an interval schedule (informational tracking only).

    Args:
        db: Database session
        schedule_id: ID of the interval schedule
        reptile_id: ID of the reptile
        completion_date: Date of the completion
        period_type: "week" or "month"
        first_day_of_week: 0=Monday (default), 6=Sunday

    Returns:
        QuotaTracking: The updated quota tracking record
    """
    quota = await get_or_create_quota_tracking(
        db, schedule_id, reptile_id, completion_date, period_type, first_day_of_week
    )

    quota.count += 1
    quota.last_completion_date = completion_date

    await db.flush()
    return quota


async def validate_min_days_between(
    db: AsyncSession,
    schedule: Schedule,
    reptile_id: int,
    completion_date: date,
    first_day_of_week: int = 0
) -> tuple[bool, Optional[str]]:
    """
    Validate that the completion respects the minimum days between constraint (HARD constraint).

    Args:
        db: Database session
        schedule: The interval schedule
        reptile_id: ID of the reptile
        completion_date: Date of the proposed completion
        first_day_of_week: 0=Monday (default), 6=Sunday

    Returns:
        tuple: (is_valid, error_message)
            - is_valid: True if validation passes
            - error_message: None if valid, error message string if invalid
    """
    if not schedule.min_days_between:
        return True, None

    period_type = schedule.quota_period.value if schedule.quota_period else "week"

    quota = await get_or_create_quota_tracking(
        db, schedule.id, reptile_id, completion_date, period_type, first_day_of_week
    )

    if quota.last_completion_date:
        days_since_last = (completion_date - quota.last_completion_date).days

        if days_since_last < schedule.min_days_between:
            return False, (
                f"Feeding too soon. Minimum {schedule.min_days_between} days required "
                f"between feedings (last feeding was {days_since_last} days ago on "
                f"{quota.last_completion_date.strftime('%Y-%m-%d')})"
            )

    return True, None


async def check_quota_status(
    db: AsyncSession,
    schedule: Schedule,
    reptile_id: int,
    current_date: date,
    first_day_of_week: int = 0
) -> Dict[str, any]:
    """
    Check the quota status for an interval schedule (informational only - no enforcement).

    Args:
        db: Database session
        schedule: The interval schedule
        reptile_id: ID of the reptile
        current_date: The current date
        first_day_of_week: 0=Monday (default), 6=Sunday

    Returns:
        dict: Status information including:
            - count: Number of completions this period (read-only tracking)
            - period_type: "week" or "month"
            - last_completion_date: Date of last completion (or None)
            - days_since_last: Days since last completion (or None)
            - period_start_date: Start date of the current period
            - period_end_date: End date of the current period
    """
    period_type = schedule.quota_period.value if schedule.quota_period else "week"

    quota = await get_or_create_quota_tracking(
        db, schedule.id, reptile_id, current_date, period_type, first_day_of_week
    )

    days_since_last = None
    if quota.last_completion_date:
        days_since_last = (current_date - quota.last_completion_date).days

    # Calculate period end date
    period_end_date = quota.period_start_date
    if period_type == "week":
        period_end_date = quota.period_start_date + timedelta(days=6)
    elif period_type == "month":
        # Last day of the month
        if quota.period_start_date.month == 12:
            period_end_date = quota.period_start_date.replace(day=31)
        else:
            next_month = quota.period_start_date.replace(month=quota.period_start_date.month + 1, day=1)
            period_end_date = next_month - timedelta(days=1)

    return {
        "count": quota.count,
        "period_type": period_type,
        "last_completion_date": quota.last_completion_date,
        "days_since_last": days_since_last,
        "period_start_date": quota.period_start_date,
        "period_end_date": period_end_date,
    }


async def get_interval_schedules_for_feeding(
    db: AsyncSession,
    reptile_id: int,
    food_category: Optional[str] = None
) -> List[Schedule]:
    """
    Get all interval-based schedules that could match a feeding.

    Args:
        db: Database session
        reptile_id: ID of the reptile
        food_category: Optional food category to filter by

    Returns:
        List[Schedule]: Matching interval schedules
    """
    query = select(Schedule).where(
        Schedule.reptile_id == reptile_id,
        Schedule.schedule_mode == ScheduleMode.INTERVAL,
        Schedule.enabled == True
    )

    if food_category:
        # Case-insensitive comparison for food category
        query = query.where(func.lower(Schedule.food_category) == func.lower(food_category))

    result = await db.execute(query)
    return list(result.scalars().all())


async def process_feeding_for_interval_schedules(
    db: AsyncSession,
    reptile_id: int,
    feeding_date: date,
    food_category: str,
    first_day_of_week: int = 0
) -> List[Dict[str, any]]:
    """
    Process a feeding against all matching interval schedules.
    Updates quota tracking (informational only) and returns status for each.

    Args:
        db: Database session
        reptile_id: ID of the reptile
        feeding_date: Date of the feeding
        food_category: Category of food fed
        first_day_of_week: 0=Monday (default), 6=Sunday

    Returns:
        List[dict]: List of updated quota statuses
    """
    schedules = await get_interval_schedules_for_feeding(db, reptile_id, food_category)

    results = []
    for schedule in schedules:
        # Validate min_days_between
        is_valid, error_msg = await validate_min_days_between(
            db, schedule, reptile_id, feeding_date, first_day_of_week
        )

        if is_valid:
            # Increment quota
            period_type = schedule.quota_period.value if schedule.quota_period else "week"
            quota = await increment_quota(
                db, schedule.id, reptile_id, feeding_date, period_type, first_day_of_week
            )

            # Get updated status
            status = await check_quota_status(
                db, schedule, reptile_id, feeding_date, first_day_of_week
            )

            results.append({
                "schedule_id": schedule.id,
                "schedule_name": schedule.name,
                "success": True,
                "quota_status": status
            })
        else:
            results.append({
                "schedule_id": schedule.id,
                "schedule_name": schedule.name,
                "success": False,
                "error": error_msg
            })

    return results
