"""
User Streak API Endpoints

Provides endpoints for user-level streak tracking, freeze management, and milestone progress.
"""

from datetime import date, datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.database import get_db
from app.auth import get_current_user
from app.models import User, UserStreak, UserStreakFreeze, ScheduleInstance, Schedule, Reptile, HouseholdMember
from app.schemas import (
    UserStreakResponse,
    FreezeScheduleRequest,
    FreezeResponse,
    MissedTaskResponse,
)
from app.services.user_streak_service import get_user_streak

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
    Get recent missed schedule instances for current user.

    Returns recent missed tasks (up to 20) for reptiles in user's households.
    """
    # Get user's household IDs
    household_result = await db.execute(
        select(HouseholdMember.household_id)
        .where(HouseholdMember.user_id == current_user.id)
    )
    household_ids = [row[0] for row in household_result.all()]

    if not household_ids:
        return []

    # Query missed instances for reptiles in user's households
    result = await db.execute(
        select(
            ScheduleInstance.id,
            ScheduleInstance.scheduled_date,
            Schedule.schedule_type,
            Reptile.name.label('reptile_name'),
            Reptile.id.label('reptile_id'),
            Schedule.name.label('schedule_name')
        )
        .join(Schedule, ScheduleInstance.schedule_id == Schedule.id)
        .join(Reptile, Schedule.reptile_id == Reptile.id)
        .where(
            and_(
                ScheduleInstance.status == 'missed',
                Reptile.household_id.in_(household_ids)
            )
        )
        .order_by(ScheduleInstance.scheduled_date.desc())
        .limit(20)
    )

    # Map results to response schema
    missed_tasks = []
    for row in result.all():
        missed_tasks.append(MissedTaskResponse(
            id=row.id,
            scheduled_date=row.scheduled_date,
            schedule_type=row.schedule_type,
            reptile_name=row.reptile_name,
            reptile_id=row.reptile_id,
            schedule_name=row.schedule_name
        ))

    return missed_tasks
