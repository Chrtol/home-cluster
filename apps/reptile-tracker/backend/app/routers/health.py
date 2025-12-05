from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from app.auth import get_current_user
from app.database import get_db
from app.models import User, HealthRecord, AccessLevel
from app.permissions import check_reptile_access
from app.schemas import HealthRecord as HealthRecordSchema, HealthRecordCreate, HealthRecordUpdate

router = APIRouter()


@router.get("/reptile/{reptile_id}", response_model=List[HealthRecordSchema])
async def list_health_records(
    reptile_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all health records for a reptile"""
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)
    result = await db.execute(
        select(HealthRecord)
        .where(HealthRecord.reptile_id == reptile_id)
        .order_by(HealthRecord.date.desc())
    )
    return result.scalars().all()


@router.get("/{record_id}", response_model=HealthRecordSchema)
async def get_health_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific health record"""
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(HealthRecord)
        .options(selectinload(HealthRecord.reptile))
        .where(HealthRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Health record not found"
        )
    await check_reptile_access(db, current_user, record.reptile_id, AccessLevel.VIEWER)
    return record


@router.post("", response_model=HealthRecordSchema, status_code=status.HTTP_201_CREATED)
async def create_health_record(
    record: HealthRecordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new health record"""
    await check_reptile_access(db, current_user, record.reptile_id, AccessLevel.MANAGER)
    new_record = HealthRecord(
        **record.model_dump(exclude={"date"}),
        date=record.date or datetime.now(timezone.utc),
        logged_by_user_id=current_user.id
    )
    db.add(new_record)
    await db.commit()
    await db.refresh(new_record)
    return new_record


@router.patch("/{record_id}", response_model=HealthRecordSchema)
async def update_health_record(
    record_id: int,
    record_update: HealthRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a health record"""
    result = await db.execute(select(HealthRecord).where(HealthRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Health record not found"
        )
    await check_reptile_access(db, current_user, record.reptile_id, AccessLevel.MANAGER)

    update_data = record_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_health_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a health record"""
    result = await db.execute(select(HealthRecord).where(HealthRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Health record not found"
        )
    await check_reptile_access(db, current_user, record.reptile_id, AccessLevel.MANAGER)
    await db.execute(delete(HealthRecord).where(HealthRecord.id == record_id))
    await db.commit()
    return None