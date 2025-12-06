"""
Weekly quota tracking for requirement-based schedules.

This module handles tracking weekly feeding quotas for schedules in "requirement" mode,
which allow flexible feeding within quota constraints (e.g., "2x per week with 2+ days between").
"""
from datetime import date, timedelta
from typing import Optional, Dict, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import WeeklyQuota, Schedule, ScheduleMode
from app.schemas import WeeklyQuotaCreate


def get_week_start_date(target_date: date, first_day_of_week: int = 0) -> date:
    """
    Get the Monday (or configured first day) of the week for a given date.

    Args:
        target_date: The date to get the week start for
        first_day_of_week: 0=Monday (default), 6=Sunday

    Returns:
        date: The start of the week
    """
    # Calculate days since the configured first day of week
    days_since_week_start = (target_date.weekday() - first_day_of_week) % 7
    week_start = target_date - timedelta(days=days_since_week_start)
    return week_start


async def get_or_create_weekly_quota(
    db: AsyncSession,
    schedule_id: int,
    reptile_id: int,
    feeding_date: date,
    first_day_of_week: int = 0
) -> WeeklyQuota:
    """
    Get or create a weekly quota record for a schedule and week.

    Args:
        db: Database session
        schedule_id: ID of the requirement schedule
        reptile_id: ID of the reptile
        feeding_date: Date of the feeding (to determine the week)
        first_day_of_week: 0=Monday (default), 6=Sunday

    Returns:
        WeeklyQuota: The weekly quota record
    """
    week_start = get_week_start_date(feeding_date, first_day_of_week)

    # Try to find existing quota for this week
    result = await db.execute(
        select(WeeklyQuota).where(
            WeeklyQuota.schedule_id == schedule_id,
            WeeklyQuota.week_start_date == week_start
        )
    )
    quota = result.scalar_one_or_none()

    if not quota:
        # Create new quota record
        quota = WeeklyQuota(
            schedule_id=schedule_id,
            reptile_id=reptile_id,
            week_start_date=week_start,
            feedings_count=0,
            last_feeding_date=None
        )
        db.add(quota)
        await db.flush()

    return quota


async def increment_weekly_quota(
    db: AsyncSession,
    schedule_id: int,
    reptile_id: int,
    feeding_date: date,
    first_day_of_week: int = 0
) -> WeeklyQuota:
    """
    Increment the weekly quota for a requirement schedule.

    Args:
        db: Database session
        schedule_id: ID of the requirement schedule
        reptile_id: ID of the reptile
        feeding_date: Date of the feeding
        first_day_of_week: 0=Monday (default), 6=Sunday

    Returns:
        WeeklyQuota: The updated weekly quota record
    """
    quota = await get_or_create_weekly_quota(db, schedule_id, reptile_id, feeding_date, first_day_of_week)

    quota.feedings_count += 1
    quota.last_feeding_date = feeding_date

    await db.flush()
    return quota


async def validate_min_days_between(
    db: AsyncSession,
    schedule: Schedule,
    reptile_id: int,
    feeding_date: date,
    first_day_of_week: int = 0
) -> tuple[bool, Optional[str]]:
    """
    Validate that the feeding respects the minimum days between constraint.

    Args:
        db: Database session
        schedule: The requirement schedule
        reptile_id: ID of the reptile
        feeding_date: Date of the proposed feeding
        first_day_of_week: 0=Monday (default), 6=Sunday

    Returns:
        tuple: (is_valid, error_message)
            - is_valid: True if validation passes
            - error_message: None if valid, error message string if invalid
    """
    if not schedule.min_days_between:
        return True, None

    quota = await get_or_create_weekly_quota(db, schedule.id, reptile_id, feeding_date, first_day_of_week)

    if quota.last_feeding_date:
        days_since_last = (feeding_date - quota.last_feeding_date).days

        if days_since_last < schedule.min_days_between:
            return False, (
                f"Feeding too soon. Minimum {schedule.min_days_between} days required "
                f"between feedings (last feeding was {days_since_last} days ago on "
                f"{quota.last_feeding_date.strftime('%Y-%m-%d')})"
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
    Check the quota status for a requirement schedule.

    Args:
        db: Database session
        schedule: The requirement schedule
        reptile_id: ID of the reptile
        current_date: The current date
        first_day_of_week: 0=Monday (default), 6=Sunday

    Returns:
        dict: Status information including:
            - feedings_count: Number of feedings this week
            - frequency_per_week: Target number of feedings
            - quota_met: Boolean indicating if quota is met
            - quota_exceeded: Boolean indicating if quota is exceeded
            - last_feeding_date: Date of last feeding (or None)
            - days_since_last: Days since last feeding (or None)
    """
    quota = await get_or_create_weekly_quota(db, schedule.id, reptile_id, current_date, first_day_of_week)

    days_since_last = None
    if quota.last_feeding_date:
        days_since_last = (current_date - quota.last_feeding_date).days

    return {
        "feedings_count": quota.feedings_count,
        "frequency_per_week": schedule.frequency_per_week or 0,
        "quota_met": quota.feedings_count >= (schedule.frequency_per_week or 0),
        "quota_exceeded": quota.feedings_count > (schedule.frequency_per_week or 0),
        "last_feeding_date": quota.last_feeding_date,
        "days_since_last": days_since_last,
        "week_start_date": quota.week_start_date,
    }


async def get_requirement_schedules_for_feeding(
    db: AsyncSession,
    reptile_id: int,
    food_category: Optional[str] = None
) -> List[Schedule]:
    """
    Get all requirement-based schedules that could match a feeding.

    Args:
        db: Database session
        reptile_id: ID of the reptile
        food_category: Optional food category to filter by

    Returns:
        List[Schedule]: Matching requirement schedules
    """
    query = select(Schedule).where(
        Schedule.reptile_id == reptile_id,
        Schedule.schedule_mode == ScheduleMode.REQUIREMENT,
        Schedule.enabled == True
    )

    if food_category:
        query = query.where(Schedule.food_category == food_category)

    result = await db.execute(query)
    return list(result.scalars().all())


async def process_feeding_for_requirement_schedules(
    db: AsyncSession,
    reptile_id: int,
    feeding_date: date,
    food_category: str,
    first_day_of_week: int = 0
) -> List[Dict[str, any]]:
    """
    Process a feeding against all matching requirement schedules.
    Updates weekly quotas and returns status for each.

    Args:
        db: Database session
        reptile_id: ID of the reptile
        feeding_date: Date of the feeding
        food_category: Category of food fed
        first_day_of_week: 0=Monday (default), 6=Sunday

    Returns:
        List[dict]: List of updated quota statuses
    """
    schedules = await get_requirement_schedules_for_feeding(db, reptile_id, food_category)

    results = []
    for schedule in schedules:
        # Validate min_days_between
        is_valid, error_msg = await validate_min_days_between(
            db, schedule, reptile_id, feeding_date, first_day_of_week
        )

        if is_valid:
            # Increment quota
            quota = await increment_weekly_quota(
                db, schedule.id, reptile_id, feeding_date, first_day_of_week
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
