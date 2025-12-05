from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from app.auth import get_current_user
from app.database import get_db
from app.models import User, Measurement, AccessLevel, Reptile
from app.permissions import check_reptile_access
from app.schemas import Measurement as MeasurementSchema, MeasurementCreate, MeasurementUpdate

router = APIRouter()


@router.get("/reptile/{reptile_id}", response_model=List[MeasurementSchema])
async def list_measurements(
    reptile_id: int,
    measurement_type: Optional[str] = Query(None, description="Filter by measurement type"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all measurements for a reptile, optionally filtered by type"""
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)

    query = select(Measurement).where(Measurement.reptile_id == reptile_id)

    if measurement_type:
        query = query.where(Measurement.measurement_type == measurement_type)

    query = query.order_by(Measurement.measured_at.desc())

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{measurement_id}", response_model=MeasurementSchema)
async def get_measurement(
    measurement_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific measurement"""
    result = await db.execute(
        select(Measurement).where(Measurement.id == measurement_id)
    )
    measurement = result.scalar_one_or_none()
    if not measurement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Measurement not found"
        )
    await check_reptile_access(db, current_user, measurement.reptile_id, AccessLevel.VIEWER)
    return measurement


@router.post("", response_model=MeasurementSchema, status_code=status.HTTP_201_CREATED)
async def create_measurement(
    measurement: MeasurementCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new measurement"""
    await check_reptile_access(db, current_user, measurement.reptile_id, AccessLevel.CARETAKER)

    # Validate custom measurements
    if measurement.measurement_type == 'custom' and not measurement.custom_label:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="custom_label is required when measurement_type is 'custom'"
        )

    new_measurement = Measurement(
        **measurement.model_dump(),
        logged_by_user_id=current_user.id
    )
    db.add(new_measurement)
    await db.commit()
    await db.refresh(new_measurement)
    return new_measurement


@router.patch("/{measurement_id}", response_model=MeasurementSchema)
async def update_measurement(
    measurement_id: int,
    measurement_update: MeasurementUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a measurement"""
    result = await db.execute(select(Measurement).where(Measurement.id == measurement_id))
    measurement = result.scalar_one_or_none()
    if not measurement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Measurement not found"
        )
    await check_reptile_access(db, current_user, measurement.reptile_id, AccessLevel.CARETAKER)

    update_data = measurement_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(measurement, field, value)

    await db.commit()
    await db.refresh(measurement)
    return measurement


@router.delete("/{measurement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_measurement(
    measurement_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a measurement"""
    result = await db.execute(select(Measurement).where(Measurement.id == measurement_id))
    measurement = result.scalar_one_or_none()
    if not measurement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Measurement not found"
        )
    await check_reptile_access(db, current_user, measurement.reptile_id, AccessLevel.MANAGER)
    await db.execute(delete(Measurement).where(Measurement.id == measurement_id))
    await db.commit()
    return None
