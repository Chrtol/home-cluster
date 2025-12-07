"""
API endpoints for quota tracking (interval-based schedules)
"""
from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models import User, Schedule, ScheduleMode, AccessLevel
from app.permissions import check_reptile_access
from app.schemas import QuotaTracking as QuotaTrackingSchema
from app.quota_tracker import (
    check_quota_status,
    validate_min_days_between,
    get_interval_schedules_for_feeding,
)

router = APIRouter()


@router.get("/reptile/{reptile_id}/quota-status", response_model=List[dict])
async def get_reptile_quota_status(
    reptile_id: int,
    current_date: Optional[date] = Query(default=None, description="Date to check status for (defaults to today)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get quota status for all requirement-based schedules for a reptile.

    Returns weekly quota progress for each requirement schedule including:
    - feedings_count: Number of feedings completed this week
    - frequency_per_week: Target number of feedings
    - quota_met: Whether the quota is met
    - quota_exceeded: Whether the quota is exceeded
    - last_feeding_date: Date of last feeding
    - days_since_last: Days since last feeding
    """
    # Check access
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)

    # Default to today
    check_date = current_date or date.today()

    # Get all interval schedules for this reptile
    result = await db.execute(
        select(Schedule).where(
            Schedule.reptile_id == reptile_id,
            Schedule.schedule_mode == ScheduleMode.INTERVAL,
            Schedule.enabled == True
        )
    )
    schedules = result.scalars().all()

    # Get quota status for each schedule
    statuses = []
    for schedule in schedules:
        # TODO: Get user's first_day_of_week preference from settings
        quota_status = await check_quota_status(
            db, schedule, reptile_id, check_date, first_day_of_week=0
        )

        statuses.append({
            "schedule_id": schedule.id,
            "schedule_name": schedule.name,
            "schedule_type": schedule.schedule_type,
            "food_category": schedule.food_category,
            **quota_status
        })

    return statuses


@router.get("/schedule/{schedule_id}/quota-status", response_model=dict)
async def get_schedule_quota_status(
    schedule_id: int,
    current_date: Optional[date] = Query(default=None, description="Date to check status for (defaults to today)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get quota status for a specific requirement schedule.
    """
    # Get schedule
    result = await db.execute(
        select(Schedule).where(Schedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Check access
    await check_reptile_access(db, current_user, schedule.reptile_id, AccessLevel.VIEWER)

    # Check if it's an interval schedule
    if schedule.schedule_mode != ScheduleMode.INTERVAL:
        raise HTTPException(
            status_code=400,
            detail="This endpoint only works for interval-based schedules"
        )

    # Default to today
    check_date = current_date or date.today()

    # Get quota status
    # TODO: Get user's first_day_of_week preference from settings
    quota_status = await check_quota_status(
        db, schedule, schedule.reptile_id, check_date, first_day_of_week=0
    )

    return {
        "schedule_id": schedule.id,
        "schedule_name": schedule.name,
        "schedule_type": schedule.schedule_type,
        "food_category": schedule.food_category,
        **quota_status
    }


@router.post("/validate-feeding", response_model=dict)
async def validate_feeding(
    reptile_id: int = Query(..., description="Reptile ID"),
    food_category: str = Query(..., description="Food category (insect, vegetable, etc.)"),
    feeding_date: date = Query(default=None, description="Date of proposed feeding (defaults to today)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Validate if a feeding can be logged based on requirement schedule constraints.

    Checks all matching requirement schedules for:
    - Min days between feedings
    - Weekly quota status

    Returns validation result with any warnings or errors.
    """
    # Check access
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)

    # Default to today
    proposed_date = feeding_date or date.today()

    # Get matching interval schedules
    schedules = await get_interval_schedules_for_feeding(db, reptile_id, food_category)

    # Validate each schedule
    results = []
    has_errors = False
    has_warnings = False

    for schedule in schedules:
        # Check min_days_between
        is_valid, error_msg = await validate_min_days_between(
            db, schedule, reptile_id, proposed_date, first_day_of_week=0
        )

        # Get quota status
        quota_status = await check_quota_status(
            db, schedule, reptile_id, proposed_date, first_day_of_week=0
        )

        schedule_result = {
            "schedule_id": schedule.id,
            "schedule_name": schedule.name,
            "min_days_validation": {
                "valid": is_valid,
                "error": error_msg
            },
            "quota_status": quota_status
        }

        # Check if quota would be exceeded
        if quota_status["quota_exceeded"]:
            schedule_result["warning"] = (
                f"Weekly quota already exceeded ({quota_status['feedings_count']}/{quota_status['frequency_per_week']})"
            )
            has_warnings = True
        elif quota_status["quota_met"]:
            schedule_result["warning"] = (
                f"Weekly quota already met ({quota_status['feedings_count']}/{quota_status['frequency_per_week']})"
            )
            has_warnings = True

        if not is_valid:
            has_errors = True

        results.append(schedule_result)

    return {
        "valid": not has_errors,
        "has_warnings": has_warnings,
        "schedules": results,
        "message": (
            "Feeding can be logged" if not has_errors
            else "Feeding cannot be logged - validation failed"
        )
    }
