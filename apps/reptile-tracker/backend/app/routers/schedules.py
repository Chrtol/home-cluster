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
            selectinload(Schedule.notification_channels),
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
            selectinload(Schedule.notification_channels),
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

    # Validate interval mode fields
    if schedule.schedule_mode == "interval":
        if not schedule.min_days_between:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="min_days_between is required for interval schedules"
            )
    # Validate fixed/dependent mode fields based on schedule_rule
    elif schedule.schedule_rule:
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

    # Extract channel_ids and validate them
    channel_ids = schedule.channel_ids or []
    schedule_dict = schedule.model_dump(exclude={'channel_ids'})

    new_schedule = Schedule(
        **schedule_dict,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )

    # Add selected notification channels if any
    if channel_ids:
        from app.models import NotificationChannel
        from sqlalchemy.orm import selectinload

        # Get all specified channels with their settings loaded
        result = await db.execute(
            select(NotificationChannel)
            .options(selectinload(NotificationChannel.settings))
            .where(NotificationChannel.id.in_(channel_ids))
        )
        channels = result.scalars().all()

        # Validate we got all requested channels
        if len(channels) != len(channel_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="One or more notification channels not found"
            )

        # Validate user has access to each channel (owns it or it's household-wide)
        for channel in channels:
            if not (channel.settings.user_id == current_user.id or channel.household_wide):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"You don't have access to channel: {channel.name}"
                )

        new_schedule.notification_channels = channels

    db.add(new_schedule)
    await db.commit()
    await db.refresh(new_schedule, ["notification_channels"])

    # Schedule notification jobs for this schedule
    from app.scheduler import schedule_notification_jobs_for_schedule
    try:
        await schedule_notification_jobs_for_schedule(new_schedule.id, days_ahead=7)
    except Exception as e:
        # Log error but don't fail the schedule creation
        import logging
        logging.getLogger(__name__).error(f"Failed to schedule notification jobs for schedule {new_schedule.id}: {e}")

    # Generate schedule instances for this schedule
    from app.instance_generator import generate_instances_for_schedule, create_interval_schedule_instance
    from app.models import ScheduleMode
    from datetime import datetime, timezone

    try:
        # For interval schedules, create the first instance manually since they don't have a fixed schedule
        if new_schedule.schedule_mode == ScheduleMode.INTERVAL:
            # Create the first instance starting from today
            await create_interval_schedule_instance(
                db=db,
                schedule=new_schedule,
                last_completion_date=None  # No previous completion for new schedule
            )
            await db.commit()  # Commit the instance before scheduling notifications

            # Reload the schedule with notification channels
            await db.refresh(new_schedule, ["notification_channels"])

            # Now schedule notifications for the created instance
            from app.scheduler import schedule_notification_jobs_for_schedule
            try:
                await schedule_notification_jobs_for_schedule(new_schedule.id, days_ahead=7)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to schedule notifications after creating interval instance: {e}")
        else:
            # For fixed/dependent schedules, use normal instance generation
            await generate_instances_for_schedule(db, new_schedule)
    except Exception as e:
        # Log error but don't fail the schedule creation
        import logging
        logging.getLogger(__name__).error(f"Failed to generate instances for schedule {new_schedule.id}: {e}")

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

    # Check access to the current reptile
    await check_reptile_access(db, current_user, schedule.reptile_id, AccessLevel.CARETAKER)

    update_data = schedule_update.model_dump(exclude_unset=True)

    # If changing reptile, check access to the new reptile as well
    if "reptile_id" in update_data and update_data["reptile_id"] != schedule.reptile_id:
        await check_reptile_access(db, current_user, update_data["reptile_id"], AccessLevel.CARETAKER)

    # Handle channel_ids separately
    channel_ids = update_data.pop("channel_ids", None)

    # Update other fields
    for field, value in update_data.items():
        setattr(schedule, field, value)

    # Update notification channels if specified
    if channel_ids is not None:
        from app.models import NotificationChannel
        from sqlalchemy.orm import selectinload

        # Load existing channels first to avoid lazy loading during assignment
        await db.refresh(schedule, ["notification_channels"])

        if channel_ids:
            # Get all specified channels with their settings loaded
            result = await db.execute(
                select(NotificationChannel)
                .options(selectinload(NotificationChannel.settings))
                .where(NotificationChannel.id.in_(channel_ids))
            )
            channels = result.scalars().all()

            # Validate we got all requested channels
            if len(channels) != len(channel_ids):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="One or more notification channels not found"
                )

            # Validate user has access to each channel (owns it or it's household-wide)
            for channel in channels:
                if not (channel.settings.user_id == current_user.id or channel.household_wide):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"You don't have access to channel: {channel.name}"
                    )

            schedule.notification_channels = channels
        else:
            # Clear all channels
            schedule.notification_channels = []

    schedule.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(schedule, ["notification_channels"])

    # Reschedule notification jobs for this schedule (cancels old, creates new)
    from app.scheduler import reschedule_notification_jobs_for_schedule
    try:
        await reschedule_notification_jobs_for_schedule(schedule.id)
    except Exception as e:
        # Log error but don't fail the schedule update
        import logging
        logging.getLogger(__name__).error(f"Failed to reschedule notification jobs for schedule {schedule.id}: {e}")

    # Regenerate schedule instances (delete old, create new)
    from app.instance_generator import regenerate_instances_for_schedule
    try:
        await regenerate_instances_for_schedule(db, schedule.id)
    except Exception as e:
        # Log error but don't fail the schedule update
        import logging
        logging.getLogger(__name__).error(f"Failed to regenerate instances for schedule {schedule.id}: {e}")

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

    # Cancel all pending notification jobs for this schedule
    from app.scheduler import cancel_notification_jobs_for_schedule
    try:
        await cancel_notification_jobs_for_schedule(schedule_id)
    except Exception as e:
        # Log error but don't fail the schedule deletion
        import logging
        logging.getLogger(__name__).error(f"Failed to cancel notification jobs for schedule {schedule_id}: {e}")

    await db.execute(delete(Schedule).where(Schedule.id == schedule_id))
    await db.commit()
    return None
