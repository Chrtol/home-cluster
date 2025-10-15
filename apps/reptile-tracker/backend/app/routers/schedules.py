from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from app.auth import get_current_user
from app.database import get_db
from app.models import User, Schedule, AccessLevel
from app.permissions import check_reptile_access
from app.schemas import Schedule as ScheduleSchema, ScheduleCreate, ScheduleUpdate, ScheduleWithDetails

router = APIRouter()


@router.get("/reptile/{reptile_id}", response_model=List[ScheduleWithDetails])
async def list_schedules(
    reptile_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all schedules for a reptile"""
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)
    result = await db.execute(
        select(Schedule)
        .where(Schedule.reptile_id == reptile_id)
        .options(
            selectinload(Schedule.supplement),
            selectinload(Schedule.parent_schedule),
            selectinload(Schedule.child_schedules),
        )
        .order_by(Schedule.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{schedule_id}", response_model=ScheduleWithDetails)
async def get_schedule(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific schedule"""
    result = await db.execute(
        select(Schedule)
        .where(Schedule.id == schedule_id)
        .options(
            selectinload(Schedule.supplement),
            selectinload(Schedule.parent_schedule),
            selectinload(Schedule.child_schedules),
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found"
        )
    await check_reptile_access(db, current_user, schedule.reptile_id, AccessLevel.VIEWER)
    return schedule


@router.post("", response_model=ScheduleSchema, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    schedule: ScheduleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new schedule"""
    await check_reptile_access(db, current_user, schedule.reptile_id, AccessLevel.CARETAKER)

    # Validate schedule data based on schedule_rule
    if schedule.schedule_rule == "every_x_days" and not schedule.frequency_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="frequency_days is required for every_x_days schedule"
        )
    elif schedule.schedule_rule == "days_of_week" and not schedule.days_of_week:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="days_of_week is required for days_of_week schedule"
        )
    elif schedule.schedule_rule == "monthly" and not schedule.day_of_month:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day_of_month is required for monthly schedule"
        )
    elif schedule.schedule_rule == "dependent" and not schedule.parent_schedule_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="parent_schedule_id is required for dependent schedule"
        )

    new_schedule = Schedule(
        **schedule.model_dump(),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(new_schedule)
    await db.commit()
    await db.refresh(new_schedule)
    return new_schedule


@router.patch("/{schedule_id}", response_model=ScheduleSchema)
async def update_schedule(
    schedule_id: int,
    schedule_update: ScheduleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a schedule"""
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found"
        )
    await check_reptile_access(db, current_user, schedule.reptile_id, AccessLevel.CARETAKER)

    update_data = schedule_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(schedule, field, value)

    schedule.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a schedule"""
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found"
        )
    await check_reptile_access(db, current_user, schedule.reptile_id, AccessLevel.CARETAKER)
    await db.execute(delete(Schedule).where(Schedule.id == schedule_id))
    await db.commit()
    return None
