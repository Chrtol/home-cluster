"""Bulk data API endpoints for optimized dashboard and calendar loading"""
from fastapi import APIRouter, Depends, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import date as py_date, datetime, timedelta, time

from app import models
from app.database import get_db
from app.routers.auth import get_current_user
from app.permissions import get_accessible_reptile_ids

router = APIRouter(prefix="/bulk", tags=["bulk"])


def convert_time_fields(obj):
    """Remove problematic time/date fields that cause frontend parsing errors"""
    import re

    if isinstance(obj, dict):
        # Remove specific problematic fields from schedules
        result = {}
        for k, v in obj.items():
            # Skip time-related fields that cause parsing issues
            if k in ('earliest_time', 'latest_time', 'reminder_time', 'reminder_minutes_before'):
                result[k] = None
            else:
                result[k] = convert_time_fields(v)
        return result
    elif isinstance(obj, list):
        return [convert_time_fields(item) for item in obj]
    else:
        return obj


@router.get("/dashboard")
async def get_dashboard_data(
    week_start: py_date = Query(..., description="Start date for weekly calendar"),
    week_end: py_date = Query(..., description="End date for weekly calendar"),
    reptile_ids: Optional[str] = Query(None, description="Comma-separated reptile IDs for calendar filter"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Get all data needed for dashboard in a single request.
    Returns: reptiles, recent feedings, weight data, schedules, rotations, weekly completions, and instances.
    """
    # Get accessible reptile IDs
    accessible_ids = await get_accessible_reptile_ids(db, current_user)

    if not accessible_ids:
        return {
            "reptiles": [],
            "recent_feedings": [],
            "weight_data": [],
            "last_activity": {},
            "schedules": [],
            "feeding_rotations": [],
            "weekly_feedings": [],
            "weekly_mistings": [],
            "weekly_instances": []
        }

    # Parse reptile filter
    calendar_reptile_ids = accessible_ids
    if reptile_ids:
        try:
            calendar_reptile_ids = [int(rid.strip()) for rid in reptile_ids.split(',') if rid.strip()]
            # Only include accessible IDs
            calendar_reptile_ids = [rid for rid in calendar_reptile_ids if rid in accessible_ids]
        except ValueError:
            calendar_reptile_ids = accessible_ids

    # Fetch reptiles
    reptiles_result = await db.execute(
        select(models.Reptile)
        .where(models.Reptile.id.in_(accessible_ids))
        .options(selectinload(models.Reptile.household))
    )
    reptiles = reptiles_result.scalars().all()

    # Fetch recent feedings (last 5)
    recent_feedings_result = await db.execute(
        select(models.Feeding)
        .where(models.Feeding.reptile_id.in_(accessible_ids))
        .options(
            selectinload(models.Feeding.reptile),
            selectinload(models.Feeding.user)
        )
        .order_by(models.Feeding.fed_at.desc())
        .limit(5)
    )
    recent_feedings = recent_feedings_result.scalars().all()

    # Fetch weight dashboard data (no eager loading - we manually serialize)
    weight_result = await db.execute(
        select(models.WeightLog)
        .where(models.WeightLog.reptile_id.in_(accessible_ids))
        .order_by(models.WeightLog.measured_at.desc())
    )
    all_weights = weight_result.scalars().all()

    # Group weights by reptile for dashboard - manually create plain dicts
    weight_data = {}
    for weight in all_weights:
        if weight.reptile_id not in weight_data:
            weight_data[weight.reptile_id] = []

        # Frontend expects both weighed_at and measured_at (for different components)
        measured_at_iso = weight.measured_at.isoformat() if weight.measured_at else None

        weight_data[weight.reptile_id].append({
            "id": weight.id,
            "weight": float(weight.weight_grams) if weight.weight_grams else None,
            "weighed_at": measured_at_iso,  # For recent activity display
            "measured_at": measured_at_iso,  # For weight charts
            "notes": weight.notes
        })

    # Fetch last activity per reptile (last feeding, misting, health)
    last_activity = {}
    for reptile_id in accessible_ids:
        # Last feeding
        last_feeding_result = await db.execute(
            select(models.Feeding)
            .where(models.Feeding.reptile_id == reptile_id)
            .order_by(models.Feeding.fed_at.desc())
            .limit(1)
        )
        last_feeding = last_feeding_result.scalars().first()

        # Last misting
        last_misting_result = await db.execute(
            select(models.MistingLog)
            .where(models.MistingLog.reptile_id == reptile_id)
            .order_by(models.MistingLog.misted_at.desc())
            .limit(1)
        )
        last_misting = last_misting_result.scalars().first()

        # Last health
        last_health_result = await db.execute(
            select(models.HealthRecord)
            .where(models.HealthRecord.reptile_id == reptile_id)
            .order_by(models.HealthRecord.date.desc())
            .limit(1)
        )
        last_health = last_health_result.scalars().first()

        # Serialize to dicts to avoid ORM serialization issues
        last_feeding_dict = None
        if last_feeding:
            last_feeding_dict = {
                "id": last_feeding.id,
                "fed_at": last_feeding.fed_at.isoformat() if last_feeding.fed_at else None,
                "reptile_id": last_feeding.reptile_id
            }

        last_misting_dict = None
        if last_misting:
            last_misting_dict = {
                "id": last_misting.id,
                "misted_at": last_misting.misted_at.isoformat() if last_misting.misted_at else None,
                "reptile_id": last_misting.reptile_id
            }

        last_health_dict = None
        if last_health:
            last_health_dict = {
                "id": last_health.id,
                "date": last_health.date.isoformat() if last_health.date else None,
                "record_type": last_health.record_type,
                "reptile_id": last_health.reptile_id
            }

        last_activity[reptile_id] = {
            "last_feeding": [last_feeding_dict] if last_feeding_dict else [],
            "last_misting": [last_misting_dict] if last_misting_dict else [],
            "last_health": [last_health_dict] if last_health_dict else []
        }

    # Fetch schedules for all accessible reptiles
    schedules_result = await db.execute(
        select(models.Schedule)
        .where(models.Schedule.reptile_id.in_(accessible_ids))
        .options(
            selectinload(models.Schedule.reptile),
            selectinload(models.Schedule.notification_channels)
        )
    )
    schedules = schedules_result.scalars().all()

    # Fetch feeding rotations
    rotations_result = await db.execute(
        select(models.FeedingRotation)
        .where(models.FeedingRotation.reptile_id.in_(accessible_ids))
        .options(selectinload(models.FeedingRotation.reptile))
    )
    feeding_rotations = rotations_result.scalars().all()

    # Fetch weekly feedings (filtered by date range)
    weekly_feedings_result = await db.execute(
        select(models.Feeding)
        .where(
            and_(
                models.Feeding.reptile_id.in_(accessible_ids),
                models.Feeding.fed_at >= datetime.combine(week_start, datetime.min.time()),
                models.Feeding.fed_at <= datetime.combine(week_end, datetime.max.time())
            )
        )
        .options(
            selectinload(models.Feeding.reptile),
            selectinload(models.Feeding.user)
        )
    )
    weekly_feedings = weekly_feedings_result.scalars().all()

    # Fetch weekly mistings (filtered by date range)
    weekly_mistings_result = await db.execute(
        select(models.MistingLog)
        .where(
            and_(
                models.MistingLog.reptile_id.in_(accessible_ids),
                models.MistingLog.misted_at >= datetime.combine(week_start, datetime.min.time()),
                models.MistingLog.misted_at <= datetime.combine(week_end, datetime.max.time())
            )
        )
        .options(
            selectinload(models.MistingLog.reptile),
            selectinload(models.MistingLog.logged_by)
        )
    )
    weekly_mistings = weekly_mistings_result.scalars().all()

    # Fetch weekly schedule instances (with calendar filter applied)
    instances_result = await db.execute(
        select(models.ScheduleInstance)
        .join(models.Schedule)
        .where(
            and_(
                models.ScheduleInstance.scheduled_date >= week_start,
                models.ScheduleInstance.scheduled_date <= week_end,
                models.Schedule.reptile_id.in_(calendar_reptile_ids)
            )
        )
        .options(
            selectinload(models.ScheduleInstance.schedule).selectinload(models.Schedule.reptile),
            selectinload(models.ScheduleInstance.schedule).selectinload(models.Schedule.notification_channels),
            selectinload(models.ScheduleInstance.completions)
        )
        .order_by(models.ScheduleInstance.scheduled_date.asc())
    )
    weekly_instances = instances_result.scalars().all()

    data = jsonable_encoder({
        "reptiles": reptiles,
        "recent_feedings": recent_feedings,
        "weight_data": weight_data,
        "last_activity": last_activity,
        "schedules": schedules,
        "feeding_rotations": feeding_rotations,
        "weekly_feedings": weekly_feedings,
        "weekly_mistings": weekly_mistings,
        "weekly_instances": weekly_instances
    })
    return convert_time_fields(data)


@router.get("/calendar")
async def get_calendar_data(
    start_date: py_date = Query(..., description="Start date for calendar view"),
    end_date: py_date = Query(..., description="End date for calendar view"),
    reptile_ids: Optional[str] = Query(None, description="Comma-separated reptile IDs to filter"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Get all data needed for calendar view in a single request.
    Returns: reptiles, schedules, rotations, feedings, mistings, and instances for the date range.
    """
    # Get accessible reptile IDs
    accessible_ids = await get_accessible_reptile_ids(db, current_user)

    if not accessible_ids:
        return {
            "reptiles": [],
            "schedules": [],
            "feeding_rotations": [],
            "feedings": [],
            "mistings": [],
            "instances": []
        }

    # Parse reptile filter for instances
    instance_reptile_ids = accessible_ids
    if reptile_ids:
        try:
            instance_reptile_ids = [int(rid.strip()) for rid in reptile_ids.split(',') if rid.strip()]
            # Only include accessible IDs
            instance_reptile_ids = [rid for rid in instance_reptile_ids if rid in accessible_ids]
        except ValueError:
            instance_reptile_ids = accessible_ids

    # Fetch reptiles
    reptiles_result = await db.execute(
        select(models.Reptile)
        .where(models.Reptile.id.in_(accessible_ids))
        .options(selectinload(models.Reptile.household))
    )
    reptiles = reptiles_result.scalars().all()

    # Fetch schedules for all accessible reptiles
    schedules_result = await db.execute(
        select(models.Schedule)
        .where(models.Schedule.reptile_id.in_(accessible_ids))
        .options(
            selectinload(models.Schedule.reptile),
            selectinload(models.Schedule.notification_channels)
        )
    )
    schedules = schedules_result.scalars().all()

    # Fetch feeding rotations
    rotations_result = await db.execute(
        select(models.FeedingRotation)
        .where(models.FeedingRotation.reptile_id.in_(accessible_ids))
        .options(selectinload(models.FeedingRotation.reptile))
    )
    feeding_rotations = rotations_result.scalars().all()

    # Fetch feedings in date range
    feedings_result = await db.execute(
        select(models.Feeding)
        .where(
            and_(
                models.Feeding.reptile_id.in_(accessible_ids),
                models.Feeding.fed_at >= datetime.combine(start_date, datetime.min.time()),
                models.Feeding.fed_at <= datetime.combine(end_date, datetime.max.time())
            )
        )
        .options(
            selectinload(models.Feeding.reptile),
            selectinload(models.Feeding.user)
        )
    )
    feedings = feedings_result.scalars().all()

    # Fetch mistings in date range
    mistings_result = await db.execute(
        select(models.MistingLog)
        .where(
            and_(
                models.MistingLog.reptile_id.in_(accessible_ids),
                models.MistingLog.misted_at >= datetime.combine(start_date, datetime.min.time()),
                models.MistingLog.misted_at <= datetime.combine(end_date, datetime.max.time())
            )
        )
        .options(
            selectinload(models.MistingLog.reptile),
            selectinload(models.MistingLog.logged_by)
        )
    )
    mistings = mistings_result.scalars().all()

    # Fetch schedule instances (with reptile filter applied)
    instances_result = await db.execute(
        select(models.ScheduleInstance)
        .join(models.Schedule)
        .where(
            and_(
                models.ScheduleInstance.scheduled_date >= start_date,
                models.ScheduleInstance.scheduled_date <= end_date,
                models.Schedule.reptile_id.in_(instance_reptile_ids)
            )
        )
        .options(
            selectinload(models.ScheduleInstance.schedule).selectinload(models.Schedule.reptile),
            selectinload(models.ScheduleInstance.schedule).selectinload(models.Schedule.notification_channels),
            selectinload(models.ScheduleInstance.completions)
        )
        .order_by(models.ScheduleInstance.scheduled_date.asc())
    )
    instances = instances_result.scalars().all()

    data = jsonable_encoder({
        "reptiles": reptiles,
        "schedules": schedules,
        "feeding_rotations": feeding_rotations,
        "feedings": feedings,
        "mistings": mistings,
        "instances": instances
    })
    return convert_time_fields(data)
