"""
User Streak API Endpoints

Provides endpoints for user-level streak tracking, freeze management, and milestone progress.
"""

from datetime import date, datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.database import get_db
from app.auth import get_current_user
from app.models import User, UserStreak, UserStreakFreeze
from app.schemas import (
    UserStreakResponse,
    FreezeScheduleRequest,
    FreezeResponse,
)
from app.services.user_streak_service import get_user_streak

router = APIRouter()


@router.get("/me", response_model=UserStreakResponse)
def get_my_streak(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get current user's streak with freeze status.

    Returns streak data including current streak, consecutive misses,
    available freeze days, and next milestone.
    """
    streak_data = get_user_streak(db, current_user.id)

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
def toggle_manual_freeze(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Toggle manual freeze (emergency streak protection).

    Creates a 1-day freeze for today if not already frozen.
    Returns the created freeze or raises error if insufficient freeze days.
    """
    today = date.today()

    # Check if already frozen today
    existing_freeze = db.execute(
        select(UserStreakFreeze)
        .where(
            and_(
                UserStreakFreeze.user_id == current_user.id,
                UserStreakFreeze.is_active == True,
                UserStreakFreeze.start_date <= today,
                UserStreakFreeze.end_date >= today,
            )
        )
    ).scalar_one_or_none()

    if existing_freeze:
        raise HTTPException(status_code=400, detail="Already frozen today")

    # Get user streak to check available freeze days
    user_streak = db.execute(
        select(UserStreak).where(UserStreak.user_id == current_user.id)
    ).scalar_one_or_none()

    if not user_streak:
        # Create default streak if doesn't exist
        user_streak = UserStreak(user_id=current_user.id)
        db.add(user_streak)
        db.flush()

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

    db.commit()
    db.refresh(freeze)

    return freeze


@router.post("/me/freeze/schedule", response_model=FreezeResponse)
def schedule_vacation_freeze(
    request: FreezeScheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
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
    user_streak = db.execute(
        select(UserStreak).where(UserStreak.user_id == current_user.id)
    ).scalar_one_or_none()

    if not user_streak:
        user_streak = UserStreak(user_id=current_user.id)
        db.add(user_streak)
        db.flush()

    available_freeze = user_streak.total_freeze_days - user_streak.used_freeze_days

    if available_freeze < days_needed:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient freeze days. Need {days_needed}, have {available_freeze}"
        )

    # Check for overlapping freezes
    overlapping = db.execute(
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
    ).first()

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

    db.commit()
    db.refresh(freeze)

    return freeze


@router.delete("/me/freeze/{freeze_id}", response_model=dict)
def cancel_scheduled_freeze(
    freeze_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cancel a scheduled freeze (refund days if not started).

    Can only cancel scheduled freezes (not manual).
    Refunds days if freeze hasn't started yet.
    """
    freeze = db.execute(
        select(UserStreakFreeze)
        .where(
            and_(
                UserStreakFreeze.id == freeze_id,
                UserStreakFreeze.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()

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
        user_streak = db.execute(
            select(UserStreak).where(UserStreak.user_id == current_user.id)
        ).scalar_one()

        user_streak.used_freeze_days -= freeze.days_deducted

    db.commit()

    return {
        "message": "Freeze cancelled",
        "refunded": freeze.start_date > today,
        "days_refunded": freeze.days_deducted if freeze.start_date > today else 0,
    }


@router.get("/me/freeze/history", response_model=List[FreezeResponse])
def get_freeze_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List freeze history for current user.

    Returns all freeze periods (active and cancelled).
    """
    freezes = db.execute(
        select(UserStreakFreeze)
        .where(UserStreakFreeze.user_id == current_user.id)
        .order_by(UserStreakFreeze.start_date.desc())
    ).scalars().all()

    return freezes
