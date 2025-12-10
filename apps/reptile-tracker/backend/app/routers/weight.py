from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from app.auth import get_current_user
from app.database import get_db
from app.models import User, WeightLog, AccessLevel, Reptile, reptile_access
from app.permissions import check_reptile_access
from app.schemas import WeightLog as WeightLogSchema, WeightLogCreate, WeightLogWithReptile, WeightLogUpdate
from app.schedule_matcher import assign_weighing_to_schedule

router = APIRouter()

@router.get("/dashboard", response_model=List[WeightLogWithReptile])
async def get_dashboard_weights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get recent weight logs for all user's reptiles (for dashboard graph)"""
    # Get all reptiles the user has access to (via direct access or household membership)
    from app.permissions import get_user_reptiles

    user_reptiles = await get_user_reptiles(db, current_user)
    reptile_ids = [item["reptile"].id for item in user_reptiles]

    if not reptile_ids:
        return []

    # Get recent weight logs with reptile names
    result = await db.execute(
        select(WeightLog, Reptile.name)
        .join(Reptile, WeightLog.reptile_id == Reptile.id)
        .where(WeightLog.reptile_id.in_(reptile_ids))
        .order_by(WeightLog.measured_at.desc())
        .limit(1000)  # Increased limit to show more historical data for chart interpolation
    )

    # Transform results to include reptile name
    logs = []
    for weight_log, reptile_name in result.all():
        log_dict = {
            "id": weight_log.id,
            "reptile_id": weight_log.reptile_id,
            "weight_grams": weight_log.weight_grams,
            "measured_at": weight_log.measured_at,
            "notes": weight_log.notes,
            "reptile_name": reptile_name
        }
        logs.append(log_dict)

    return logs

@router.get("/reptile/{reptile_id}", response_model=List[WeightLogSchema])
async def list_weight_logs(
    reptile_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all weight logs for a reptile"""
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)
    result = await db.execute(
        select(WeightLog)
        .where(WeightLog.reptile_id == reptile_id)
        .order_by(WeightLog.measured_at.desc())
    )
    return result.scalars().all()

@router.get("/{log_id}", response_model=WeightLogWithReptile)
async def get_weight_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific weight log"""
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(WeightLog)
        .options(selectinload(WeightLog.reptile))
        .where(WeightLog.id == log_id)
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Weight log not found"
        )
    await check_reptile_access(db, current_user, log.reptile_id, AccessLevel.VIEWER)
    return log

@router.post("", response_model=WeightLogSchema, status_code=status.HTTP_201_CREATED)
async def create_weight_log(
    log: WeightLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log a weight measurement"""
    await check_reptile_access(db, current_user, log.reptile_id, AccessLevel.CARETAKER)
    # The fix is here: exclude the duplicate timestamp before saving
    new_log = WeightLog(
        **log.model_dump(exclude={"measured_at"}),
        measured_at=log.measured_at or datetime.now(timezone.utc),
        logged_by_user_id=current_user.id
    )
    db.add(new_log)
    await db.flush()

    # If instance_id provided, directly link to that instance
    if log.instance_id:
        from app.models import ScheduleInstance, ScheduleCompletion, CompletionStatus, CompletionType, ScheduleMode
        from sqlalchemy.orm import selectinload

        # Get the instance
        instance_result = await db.execute(
            select(ScheduleInstance)
            .where(ScheduleInstance.id == log.instance_id)
            .options(selectinload(ScheduleInstance.schedule))
        )
        instance = instance_result.scalar_one_or_none()

        if instance and instance.schedule:
            # Determine if within time window
            within_window = True
            if instance.schedule.time_window_enabled:
                from app.schedule_matcher import is_within_time_window
                within_window = is_within_time_window(
                    new_log.measured_at.time(),
                    instance.schedule.earliest_time,
                    instance.schedule.latest_time
                )

            # Create completion record
            completion = ScheduleCompletion(
                schedule_id=instance.schedule_id,
                instance_id=instance.id,
                scheduled_date=instance.scheduled_date,
                completed_at=new_log.measured_at,
                completion_type=CompletionType.WEIGHING,
                completion_id=new_log.id,
                within_time_window=within_window,
                status=CompletionStatus.COMPLETED_ON_TIME if within_window else CompletionStatus.COMPLETED_LATE,
                reptile_id=log.reptile_id,
            )
            db.add(completion)
            await db.flush()

            # Link weight log to completion
            new_log.schedule_completion_id = completion.id

            # Mark instance as completed
            instance.status = "completed"
            instance.updated_at = datetime.now(timezone.utc)

            # For interval schedules, generate next instance
            if instance.schedule.schedule_mode == ScheduleMode.INTERVAL:
                from app.instance_generator import create_interval_schedule_instance
                try:
                    await create_interval_schedule_instance(
                        db=db,
                        schedule=instance.schedule,
                        last_completion_date=new_log.measured_at.date()
                    )
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error(
                        f"Failed to create next interval instance for schedule {instance.schedule.id}: {e}",
                        exc_info=True
                    )
    else:
        # Try to assign to a matching schedule via auto-matching
        await assign_weighing_to_schedule(db, new_log)

    await db.commit()
    await db.refresh(new_log)
    return new_log

@router.patch("/{log_id}", response_model=WeightLogSchema)
async def update_weight_log(
    log_id: int,
    log_update: WeightLogUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a weight log"""
    result = await db.execute(select(WeightLog).where(WeightLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Weight log not found"
        )
    await check_reptile_access(db, current_user, log.reptile_id, AccessLevel.CARETAKER)

    update_data = log_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(log, field, value)

    await db.commit()
    await db.refresh(log)
    return log

@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_weight_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a weight log"""
    result = await db.execute(select(WeightLog).where(WeightLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Weight log not found"
        )
    await check_reptile_access(db, current_user, log.reptile_id, AccessLevel.MANAGER)

    # If this weight log completed a schedule instance, reset the instance status to pending,
    # delete the completion record, and try to re-match with other weight logs from that day
    if log.schedule_completion_id:
        from app.models import ScheduleCompletion, ScheduleInstance, Schedule
        from app.schedule_matcher import assign_weighing_to_schedule

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

            # Delete the completion record since the weight log that fulfilled it is being deleted
            await db.execute(delete(ScheduleCompletion).where(ScheduleCompletion.id == log.schedule_completion_id))

            # Try to find another weight log from the same day that could fulfill this schedule
            # Look for other weight logs for the same reptile on the scheduled date that aren't already assigned
            other_weights_result = await db.execute(
                select(WeightLog).where(
                    and_(
                        WeightLog.reptile_id == log.reptile_id,
                        WeightLog.id != log_id,
                        func.date(WeightLog.measured_at) == scheduled_date,
                        WeightLog.schedule_completion_id == None  # Not already assigned
                    )
                ).order_by(WeightLog.measured_at.asc())  # Try earliest weight log first
            )
            other_weights = other_weights_result.scalars().all()

            # Try to match the first unassigned weight log to the schedule
            if other_weights:
                # Get the schedule to pass to the matcher
                schedule = await db.get(Schedule, schedule_id)
                if schedule and schedule.enabled:
                    for other_weight in other_weights:
                        # Try to assign this weight log - it will check if it matches the schedule
                        await assign_weighing_to_schedule(db, other_weight)
                        # Only need to assign one - the matcher will pick the best match
                        break

    await db.execute(delete(WeightLog).where(WeightLog.id == log_id))
    await db.commit()
    return None