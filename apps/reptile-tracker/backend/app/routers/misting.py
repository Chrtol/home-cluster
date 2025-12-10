from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from app.auth import get_current_user
from app.database import get_db
from app.models import User, MistingLog, AccessLevel
from app.permissions import check_reptile_access
from app.schemas import MistingLog as MistingLogSchema, MistingLogCreate, MistingLogUpdate
from app.schedule_matcher import assign_misting_to_schedule

router = APIRouter()


@router.get("/reptile/{reptile_id}", response_model=List[MistingLogSchema])
async def list_misting_logs(
    reptile_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all misting logs for a reptile"""
    from sqlalchemy.orm import selectinload
    from app.models import Reptile

    await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)
    result = await db.execute(
        select(MistingLog)
        .options(selectinload(MistingLog.reptile))
        .where(MistingLog.reptile_id == reptile_id)
        .order_by(MistingLog.misted_at.desc())
    )
    return result.scalars().all()


@router.get("/{log_id}", response_model=MistingLogSchema)
async def get_misting_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific misting log"""
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(MistingLog)
        .options(selectinload(MistingLog.reptile))
        .where(MistingLog.id == log_id)
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Misting log not found"
        )
    await check_reptile_access(db, current_user, log.reptile_id, AccessLevel.VIEWER)
    return log


@router.post("", response_model=MistingLogSchema, status_code=status.HTTP_201_CREATED)
async def create_misting_log(
    log: MistingLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new misting log"""
    await check_reptile_access(db, current_user, log.reptile_id, AccessLevel.CARETAKER)
    new_log = MistingLog(
        **log.model_dump(exclude={"misted_at"}),
        misted_at=log.misted_at or datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        logged_by_user_id=current_user.id
    )
    db.add(new_log)
    await db.flush()

    # Try to assign to a matching schedule
    await assign_misting_to_schedule(db, new_log)

    await db.commit()
    await db.refresh(new_log)
    return new_log


@router.patch("/{log_id}", response_model=MistingLogSchema)
async def update_misting_log(
    log_id: int,
    log_update: MistingLogUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a misting log"""
    result = await db.execute(
        select(MistingLog)
        .options(selectinload(MistingLog.reptile))
        .where(MistingLog.id == log_id)
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Misting log not found"
        )
    await check_reptile_access(db, current_user, log.reptile_id, AccessLevel.CARETAKER)

    update_data = log_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(log, field, value)

    await db.commit()
    await db.refresh(log)
    return log


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_misting_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a misting log"""
    result = await db.execute(select(MistingLog).where(MistingLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Misting log not found"
        )
    await check_reptile_access(db, current_user, log.reptile_id, AccessLevel.CARETAKER)

    # If this misting completed a schedule instance, reset the instance status to pending,
    # delete the completion record, and try to re-match with other mistings from that day
    if log.schedule_completion_id:
        from app.models import ScheduleCompletion, ScheduleInstance, Schedule
        from app.schedule_matcher import assign_misting_to_schedule

        # Get the completion to find the instance and schedule details
        completion_result = await db.execute(
            select(ScheduleCompletion).where(ScheduleCompletion.id == log.schedule_completion_id)
        )
        completion = completion_result.scalar_one_or_none()

        if completion:
            schedule_id = completion.schedule_id
            scheduled_date = completion.scheduled_date

            # Reset the instance to pending if it exists
            if completion.instance_id:
                instance_result = await db.execute(
                    select(ScheduleInstance).where(ScheduleInstance.id == completion.instance_id)
                )
                instance = instance_result.scalar_one_or_none()
                if instance:
                    instance.status = "pending"
                    from datetime import datetime, timezone
                    instance.updated_at = datetime.now(timezone.utc)

            # Delete the completion record since the misting that fulfilled it is being deleted
            await db.execute(delete(ScheduleCompletion).where(ScheduleCompletion.id == log.schedule_completion_id))

            # Try to find another misting from the same day that could fulfill this schedule
            # Look for other mistings for the same reptile on the scheduled date that aren't already assigned
            other_mistings_result = await db.execute(
                select(MistingLog).where(
                    and_(
                        MistingLog.reptile_id == log.reptile_id,
                        MistingLog.id != log_id,
                        func.date(MistingLog.misted_at) == scheduled_date,
                        MistingLog.schedule_completion_id == None  # Not already assigned
                    )
                ).order_by(MistingLog.misted_at.asc())  # Try earliest misting first
            )
            other_mistings = other_mistings_result.scalars().all()

            # Try to match the first unassigned misting to the schedule
            if other_mistings:
                # Get the schedule to pass to the matcher
                schedule = await db.get(Schedule, schedule_id)
                if schedule and schedule.enabled:
                    for other_misting in other_mistings:
                        # Try to assign this misting - it will check if it matches the schedule
                        await assign_misting_to_schedule(db, other_misting)
                        # Only need to assign one - the matcher will pick the best match
                        break

    await db.execute(delete(MistingLog).where(MistingLog.id == log_id))
    await db.commit()
    return None
