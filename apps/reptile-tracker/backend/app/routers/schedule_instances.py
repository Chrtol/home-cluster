"""Schedule instances API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import date as py_date, datetime, timezone

from app import models, schemas
from app.database import get_db
from app.routers.auth import get_current_user
from app.permissions import check_reptile_access
from app.instance_generator import (
    generate_instances_for_schedule,
    regenerate_instances_for_schedule,
    update_instance_status
)

router = APIRouter(prefix="/schedule-instances", tags=["schedule-instances"])


@router.get("/calendar", response_model=List[schemas.ScheduleInstanceWithSchedule])
async def get_calendar_instances(
    start_date: py_date = Query(..., description="Start date for calendar view"),
    end_date: py_date = Query(..., description="End date for calendar view"),
    reptile_ids: Optional[str] = Query(None, description="Comma-separated reptile IDs to filter"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Get schedule instances for calendar display.
    Returns all instances within the date range with full schedule details.
    """

    # Build query
    query = select(models.ScheduleInstance).options(
        selectinload(models.ScheduleInstance.schedule).selectinload(models.Schedule.reptile),
        selectinload(models.ScheduleInstance.schedule).selectinload(models.Schedule.notification_channels),
        selectinload(models.ScheduleInstance.completions)
    ).join(models.Schedule)

    # Date range filter
    query = query.where(
        and_(
            models.ScheduleInstance.scheduled_date >= start_date,
            models.ScheduleInstance.scheduled_date <= end_date
        )
    )

    # Reptile filter
    if reptile_ids:
        reptile_id_list = [int(rid.strip()) for rid in reptile_ids.split(',') if rid.strip()]
        query = query.where(models.Schedule.reptile_id.in_(reptile_id_list))

    # Order by date
    query = query.order_by(models.ScheduleInstance.scheduled_date.asc())

    result = await db.execute(query)
    instances = result.scalars().all()

    # Check access for each instance's reptile and filter out orphaned instances
    filtered_instances = []
    for instance in instances:
        # Skip instances with missing schedule or reptile (orphaned data)
        if not instance.schedule:
            continue
        if not instance.schedule.reptile:
            continue

        try:
            await check_reptile_access(db, current_user, instance.schedule.reptile.id)
            filtered_instances.append(instance)
        except HTTPException:
            # User doesn't have access, skip this instance
            continue

    return filtered_instances


@router.get("/", response_model=List[schemas.ScheduleInstance])
async def list_schedule_instances(
    schedule_id: Optional[int] = Query(None, description="Filter by schedule ID"),
    reptile_id: Optional[int] = Query(None, description="Filter by reptile ID"),
    start_date: Optional[py_date] = Query(None, description="Filter instances on or after this date"),
    end_date: Optional[py_date] = Query(None, description="Filter instances on or before this date"),
    status: Optional[str] = Query(None, description="Filter by status (pending, completed, missed, skipped)"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List schedule instances with optional filters"""

    # Build query
    query = select(models.ScheduleInstance).options(
        selectinload(models.ScheduleInstance.schedule).selectinload(models.Schedule.reptile)
    )

    filters = []

    if schedule_id:
        filters.append(models.ScheduleInstance.schedule_id == schedule_id)

    if reptile_id:
        # Join with schedules to filter by reptile
        query = query.join(models.Schedule)
        filters.append(models.Schedule.reptile_id == reptile_id)

    if start_date:
        filters.append(models.ScheduleInstance.scheduled_date >= start_date)

    if end_date:
        filters.append(models.ScheduleInstance.scheduled_date <= end_date)

    if status:
        filters.append(models.ScheduleInstance.status == status)

    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(models.ScheduleInstance.scheduled_date.asc())

    result = await db.execute(query)
    instances = result.scalars().all()

    # Check access for each instance's reptile and filter out orphaned instances
    filtered_instances = []
    for instance in instances:
        # Skip instances with missing schedule or reptile (orphaned data)
        if not instance.schedule:
            continue
        if not instance.schedule.reptile:
            continue

        try:
            await check_reptile_access(db, current_user, instance.schedule.reptile.id)
            filtered_instances.append(instance)
        except HTTPException:
            # User doesn't have access, skip this instance
            continue

    return filtered_instances


@router.get("/{instance_id}", response_model=schemas.ScheduleInstanceWithSchedule)
async def get_schedule_instance(
    instance_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get a specific schedule instance by ID"""
    result = await db.execute(
        select(models.ScheduleInstance)
        .where(models.ScheduleInstance.id == instance_id)
        .options(
            selectinload(models.ScheduleInstance.schedule).selectinload(models.Schedule.reptile)
        )
    )
    instance = result.scalars().first()

    if not instance:
        raise HTTPException(status_code=404, detail="Schedule instance not found")

    # Check access to the reptile
    if instance.schedule and instance.schedule.reptile:
        await check_reptile_access(db, current_user, instance.schedule.reptile.id)

    return instance


@router.patch("/{instance_id}", response_model=schemas.ScheduleInstance)
async def update_schedule_instance(
    instance_id: int,
    update_data: schemas.ScheduleInstanceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update a schedule instance (typically to change status)"""
    result = await db.execute(
        select(models.ScheduleInstance)
        .where(models.ScheduleInstance.id == instance_id)
        .options(
            selectinload(models.ScheduleInstance.schedule).selectinload(models.Schedule.reptile)
        )
    )
    instance = result.scalars().first()

    if not instance:
        raise HTTPException(status_code=404, detail="Schedule instance not found")

    # Check access to the reptile
    if instance.schedule and instance.schedule.reptile:
        await check_reptile_access(db, current_user, instance.schedule.reptile.id)

    # Update fields
    if update_data.status is not None:
        instance.status = update_data.status

    if update_data.supplements is not None:
        instance.supplements = update_data.supplements

    instance.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(instance)

    return instance


@router.post("/generate/{schedule_id}")
async def generate_instances(
    schedule_id: int,
    days_ahead: int = Query(14, description="How many days ahead to generate instances"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Manually trigger instance generation for a schedule"""

    # Get the schedule
    schedule = await db.get(models.Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Check access
    await check_reptile_access(db, current_user, schedule.reptile_id)

    # Generate instances
    count = await generate_instances_for_schedule(db, schedule, days_ahead)
    await db.commit()

    return {
        "schedule_id": schedule_id,
        "instances_created": count,
        "message": f"Generated {count} instances for the next {days_ahead} days"
    }


@router.post("/regenerate/{schedule_id}")
async def regenerate_instances(
    schedule_id: int,
    days_ahead: int = Query(14, description="How many days ahead to generate instances"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Delete and regenerate instances for a schedule (useful after editing)"""

    # Get the schedule
    schedule = await db.get(models.Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Check access
    await check_reptile_access(db, current_user, schedule.reptile_id)

    # Regenerate instances
    count = await regenerate_instances_for_schedule(db, schedule_id, days_ahead)

    return {
        "schedule_id": schedule_id,
        "instances_created": count,
        "message": f"Regenerated {count} instances for the next {days_ahead} days"
    }
