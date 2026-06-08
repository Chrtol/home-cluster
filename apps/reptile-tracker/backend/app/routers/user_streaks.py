"""
User Streak API Endpoints

Provides endpoints for user-level streak tracking, freeze management, and milestone progress.
"""

from datetime import date, datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, exists

from app.database import get_db
from app.auth import get_current_user
from app.models import User, UserStreak, UserStreakFreeze, ScheduleCompletion, CompletionStatus, Schedule, Reptile, household_members, ScheduleResponsibility, ReptileResponsibility
from app.schemas import (
    UserStreakResponse,
    FreezeScheduleRequest,
    FreezeResponse,
    MissedTaskResponse,
)
from app.services.user_streak_service import get_user_streak
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/me", response_model=UserStreakResponse)
async def get_my_streak(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current user's streak with freeze status.

    Returns streak data including current streak, consecutive misses,
    available freeze days, and next milestone.
    """
    streak_data = await get_user_streak(db, current_user.id)

    if not streak_data:
        # Return default streak for users without any completions yet
        return UserStreakResponse(
            user_id=current_user.id,
            current_streak=0,
            consecutive_misses=0,
            longest_streak=0,
            total_freeze_days=7,
            available_freeze_days=7,
            last_completion_at=None,
            is_frozen_today=False,
            next_milestone=7,
            days_to_milestone=7,
        )

    return UserStreakResponse(**streak_data)


@router.post("/me/freeze", response_model=FreezeResponse)
async def toggle_manual_freeze(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Toggle manual freeze (emergency streak protection).

    Creates a 1-day freeze for today if not already frozen.
    Returns the created freeze or raises error if insufficient freeze days.
    """
    today = date.today()

    # Check if already frozen today
    result = await db.execute(
        select(UserStreakFreeze)
        .where(
            and_(
                UserStreakFreeze.user_id == current_user.id,
                UserStreakFreeze.is_active == True,
                UserStreakFreeze.start_date <= today,
                UserStreakFreeze.end_date >= today,
            )
        )
    )
    existing_freeze = result.scalar_one_or_none()

    if existing_freeze:
        raise HTTPException(status_code=400, detail="Already frozen today")

    # Get user streak to check available freeze days
    result = await db.execute(
        select(UserStreak).where(UserStreak.user_id == current_user.id)
    )
    user_streak = result.scalar_one_or_none()

    if not user_streak:
        # Create default streak if doesn't exist
        user_streak = UserStreak(user_id=current_user.id)
        db.add(user_streak)
        await db.flush()

    available_freeze = user_streak.total_freeze_days - user_streak.used_freeze_days

    if available_freeze < 1:
        raise HTTPException(status_code=400, detail="No freeze days available")

    # Create manual freeze for today
    freeze = UserStreakFreeze(
        user_id=current_user.id,
        freeze_type='manual',
        start_date=today,
        end_date=today,
        days_deducted=1,
        is_active=True,
    )
    db.add(freeze)

    # Deduct freeze days
    user_streak.used_freeze_days += 1

    await db.commit()
    await db.refresh(freeze)

    return freeze


@router.post("/me/freeze/schedule", response_model=FreezeResponse)
async def schedule_vacation_freeze(
    request: FreezeScheduleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Schedule a vacation freeze (deduct days upfront).

    Creates a freeze period from start_date to end_date (inclusive).
    Deducts freeze days upfront.
    """
    # Validate dates
    if request.end_date < request.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    # Calculate days needed
    days_needed = (request.end_date - request.start_date).days + 1

    # Get user streak
    result = await db.execute(
        select(UserStreak).where(UserStreak.user_id == current_user.id)
    )
    user_streak = result.scalar_one_or_none()

    if not user_streak:
        user_streak = UserStreak(user_id=current_user.id)
        db.add(user_streak)
        await db.flush()

    available_freeze = user_streak.total_freeze_days - user_streak.used_freeze_days

    if available_freeze < days_needed:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient freeze days. Need {days_needed}, have {available_freeze}"
        )

    # Check for overlapping freezes
    result = await db.execute(
        select(UserStreakFreeze)
        .where(
            and_(
                UserStreakFreeze.user_id == current_user.id,
                UserStreakFreeze.is_active == True,
                or_(
                    and_(
                        UserStreakFreeze.start_date <= request.start_date,
                        UserStreakFreeze.end_date >= request.start_date,
                    ),
                    and_(
                        UserStreakFreeze.start_date <= request.end_date,
                        UserStreakFreeze.end_date >= request.end_date,
                    ),
                ),
            )
        )
    )
    overlapping = result.first()

    if overlapping:
        raise HTTPException(status_code=400, detail="Freeze period overlaps with existing freeze")

    # Create scheduled freeze
    freeze = UserStreakFreeze(
        user_id=current_user.id,
        freeze_type='scheduled',
        start_date=request.start_date,
        end_date=request.end_date,
        days_deducted=days_needed,
        is_active=True,
    )
    db.add(freeze)

    # Deduct freeze days upfront
    user_streak.used_freeze_days += days_needed

    await db.commit()
    await db.refresh(freeze)

    return freeze


@router.delete("/me/freeze/{freeze_id}", response_model=dict)
async def cancel_scheduled_freeze(
    freeze_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cancel a scheduled freeze (refund days if not started).

    Can only cancel scheduled freezes (not manual).
    Refunds days if freeze hasn't started yet.
    """
    result = await db.execute(
        select(UserStreakFreeze)
        .where(
            and_(
                UserStreakFreeze.id == freeze_id,
                UserStreakFreeze.user_id == current_user.id,
            )
        )
    )
    freeze = result.scalar_one_or_none()

    if not freeze:
        raise HTTPException(status_code=404, detail="Freeze not found")

    if freeze.freeze_type != 'scheduled':
        raise HTTPException(status_code=400, detail="Can only cancel scheduled freezes")

    if not freeze.is_active:
        raise HTTPException(status_code=400, detail="Freeze already cancelled")

    today = date.today()

    # Mark as inactive
    freeze.is_active = False

    # Refund days if freeze hasn't started
    if freeze.start_date > today:
        result = await db.execute(
            select(UserStreak).where(UserStreak.user_id == current_user.id)
        )
        user_streak = result.scalar_one()

        user_streak.used_freeze_days -= freeze.days_deducted

    await db.commit()

    return {
        "message": "Freeze cancelled",
        "refunded": freeze.start_date > today,
        "days_refunded": freeze.days_deducted if freeze.start_date > today else 0,
    }


@router.get("/me/freeze/history", response_model=List[FreezeResponse])
async def get_freeze_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List freeze history for current user.

    Returns all freeze periods (active and cancelled).
    """
    result = await db.execute(
        select(UserStreakFreeze)
        .where(UserStreakFreeze.user_id == current_user.id)
        .order_by(UserStreakFreeze.start_date.desc())
    )
    freezes = result.scalars().all()

    return freezes


@router.get("/me/misses", response_model=List[MissedTaskResponse])
async def get_recent_misses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get recent missed schedule completions for current user.

    Returns recent missed tasks (up to 20) that the user was responsible for.
    Filters by responsibility using the same logic as streak calculation:
    1. ScheduleResponsibility (specific schedule override)
    2. ReptileResponsibility (reptile-level assignment)
    3. Household membership (default if no assignments)
    """
    user_id = current_user.id

    # Build responsibility filter subqueries
    # User has ScheduleResponsibility for this schedule
    has_schedule_resp = exists(
        select(ScheduleResponsibility.id)
        .where(
            and_(
                ScheduleResponsibility.schedule_id == Schedule.id,
                ScheduleResponsibility.user_id == user_id
            )
        )
    )

    # Any ScheduleResponsibility exists for this schedule (used to check if we should fall back)
    any_schedule_resp_exists = exists(
        select(ScheduleResponsibility.id)
        .where(ScheduleResponsibility.schedule_id == Schedule.id)
    )

    # User has ReptileResponsibility for this reptile
    has_reptile_resp = exists(
        select(ReptileResponsibility.id)
        .where(
            and_(
                ReptileResponsibility.reptile_id == Reptile.id,
                ReptileResponsibility.user_id == user_id
            )
        )
    )

    # Any ReptileResponsibility exists for this reptile
    any_reptile_resp_exists = exists(
        select(ReptileResponsibility.id)
        .where(ReptileResponsibility.reptile_id == Reptile.id)
    )

    # User is a household member of this reptile's household
    is_household_member = exists(
        select(household_members.c.user_id)
        .where(
            and_(
                household_members.c.household_id == Reptile.household_id,
                household_members.c.user_id == user_id
            )
        )
    )

    # Responsibility filter: user is responsible if:
    # 1. Has ScheduleResponsibility for this schedule, OR
    # 2. No ScheduleResponsibility exists AND has ReptileResponsibility, OR
    # 3. No ScheduleResponsibility AND no ReptileResponsibility AND is household member
    responsibility_filter = or_(
        has_schedule_resp,
        and_(~any_schedule_resp_exists, has_reptile_resp),
        and_(~any_schedule_resp_exists, ~any_reptile_resp_exists, is_household_member)
    )

    # Query missed completions filtered by responsibility
    result = await db.execute(
        select(
            ScheduleCompletion.id,
            ScheduleCompletion.scheduled_date,
            Schedule.schedule_type,
            Schedule.id.label('schedule_id'),
            Reptile.name.label('reptile_name'),
            Reptile.id.label('reptile_id'),
            Schedule.name.label('schedule_name')
        )
        .join(Schedule, ScheduleCompletion.schedule_id == Schedule.id)
        .join(Reptile, Schedule.reptile_id == Reptile.id)
        .where(
            and_(
                ScheduleCompletion.status == CompletionStatus.MISSED,
                responsibility_filter
            )
        )
        .order_by(ScheduleCompletion.scheduled_date.desc())
        .limit(20)
    )

    # Map results to response schema
    missed_tasks = []
    for row in result.all():
        missed_tasks.append(MissedTaskResponse(
            id=row.id,
            scheduled_date=row.scheduled_date,
            schedule_type=row.schedule_type,
            schedule_id=row.schedule_id,
            reptile_name=row.reptile_name,
            reptile_id=row.reptile_id,
            schedule_name=row.schedule_name
        ))

    return missed_tasks


@router.post("/me/recalculate", response_model=UserStreakResponse)
async def recalculate_streak(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Recalculate user streak from recent completion history.

    This endpoint recalculates the user's streak based on actual completion data.
    Useful for fixing streak data after bug fixes or data inconsistencies.

    Logic:
    - Counts all completed tasks (COMPLETED_ON_TIME or COMPLETED_LATE) from manual schedules
      that the user was responsible for
    - Resets consecutive_misses based on recent miss/completion pattern
    """
    user_id = current_user.id

    # Get or create user streak
    result = await db.execute(
        select(UserStreak).where(UserStreak.user_id == user_id)
    )
    user_streak = result.scalar_one_or_none()

    if not user_streak:
        user_streak = UserStreak(user_id=user_id)
        db.add(user_streak)
        await db.flush()

    # Build responsibility filter subqueries (same logic as misses endpoint)
    has_schedule_resp = exists(
        select(ScheduleResponsibility.id)
        .where(
            and_(
                ScheduleResponsibility.schedule_id == Schedule.id,
                ScheduleResponsibility.user_id == user_id
            )
        )
    )

    any_schedule_resp_exists = exists(
        select(ScheduleResponsibility.id)
        .where(ScheduleResponsibility.schedule_id == Schedule.id)
    )

    has_reptile_resp = exists(
        select(ReptileResponsibility.id)
        .where(
            and_(
                ReptileResponsibility.reptile_id == Reptile.id,
                ReptileResponsibility.user_id == user_id
            )
        )
    )

    any_reptile_resp_exists = exists(
        select(ReptileResponsibility.id)
        .where(ReptileResponsibility.reptile_id == Reptile.id)
    )

    is_household_member = exists(
        select(household_members.c.user_id)
        .where(
            and_(
                household_members.c.household_id == Reptile.household_id,
                household_members.c.user_id == user_id
            )
        )
    )

    responsibility_filter = or_(
        has_schedule_resp,
        and_(~any_schedule_resp_exists, has_reptile_resp),
        and_(~any_schedule_resp_exists, ~any_reptile_resp_exists, is_household_member)
    )

    # Query ALL completions chronologically (oldest first) to simulate streak evolution
    result = await db.execute(
        select(ScheduleCompletion.status, ScheduleCompletion.scheduled_date)
        .join(Schedule, ScheduleCompletion.schedule_id == Schedule.id)
        .join(Reptile, Schedule.reptile_id == Reptile.id)
        .where(
            and_(
                Schedule.auto_complete_enabled == False,  # Manual schedules only
                responsibility_filter
            )
        )
        .order_by(ScheduleCompletion.scheduled_date.asc())  # ASC for chronological processing
    )
    completions = result.all()

    # Simulate streak evolution chronologically
    # Missing 2 tasks in a row resets streak to 0
    streak = 0
    consecutive_misses = 0

    for row in completions:
        if row.status == CompletionStatus.MISSED:
            consecutive_misses += 1
            if consecutive_misses >= 2:
                # Break point - reset streak to 0
                streak = 0
                consecutive_misses = 0
        elif row.status in (CompletionStatus.COMPLETED_ON_TIME, CompletionStatus.COMPLETED_EARLY, CompletionStatus.COMPLETED_LATE):
            # Completion - increment streak and reset miss counter
            streak += 1
            consecutive_misses = 0
        # PENDING status: ignore (shouldn't affect streak calculation)

    old_streak = user_streak.current_streak
    old_misses = user_streak.consecutive_misses

    # Update streak with calculated values
    user_streak.current_streak = streak
    user_streak.consecutive_misses = consecutive_misses
    user_streak.longest_streak = max(user_streak.longest_streak, streak)

    await db.commit()

    logger.info(
        f"Recalculated streak for user {user_id}: "
        f"streak {old_streak} -> {streak}, "
        f"misses {old_misses} -> {consecutive_misses}"
    )

    # Return updated streak data
    return await get_my_streak(current_user, db)
