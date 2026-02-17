from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from app.auth import get_current_user
from app.database import get_db
from app.models import User, HealthRecord, AccessLevel
from app.permissions import check_reptile_access
from app.schemas import HealthRecord as HealthRecordSchema, HealthRecordCreate, HealthRecordUpdate, HealthStatus
from app.services.health_status_service import validate_health_record_state, derive_health_status, batch_derive_health_statuses

router = APIRouter()


@router.get("", response_model=List[HealthRecordSchema])
async def list_all_health_records(
    reptile_id: Optional[int] = Query(None),
    record_type: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List health records with optional filters (for dashboard Recent Activity)"""
    query = (
        select(HealthRecord)
        .options(selectinload(HealthRecord.reptile))
        .order_by(HealthRecord.date.desc())
    )

    # Filter by reptile if specified
    if reptile_id:
        await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)
        query = query.where(HealthRecord.reptile_id == reptile_id)
    else:
        # Get all reptiles user has access to
        from app.permissions import get_user_reptiles
        user_reptiles = await get_user_reptiles(db, current_user)
        reptile_ids = [r["reptile"].id for r in user_reptiles]
        query = query.where(HealthRecord.reptile_id.in_(reptile_ids))

    # Filter by record_type if specified
    if record_type:
        query = query.where(HealthRecord.record_type == record_type)

    # Apply pagination
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    return result.scalars().all()


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


@router.get("/status/{reptile_id}", response_model=HealthStatus)
async def get_reptile_health_status(
    reptile_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get derived health status for a reptile"""
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)

    status = await derive_health_status(
        db,
        reptile_id,
        user_timezone=current_user.timezone
    )
    return HealthStatus(**status)


@router.post("/status/batch", response_model=dict[int, HealthStatus])
async def get_batch_health_statuses(
    reptile_ids: List[int],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get health statuses for multiple reptiles (for dashboard)"""
    # Note: Permission checking for each reptile should be done by caller
    # This endpoint trusts that reptile_ids are already filtered to accessible ones

    statuses = await batch_derive_health_statuses(
        db,
        reptile_ids,
        user_timezone=current_user.timezone
    )
    return {rid: HealthStatus(**s) for rid, s in statuses.items()}


@router.post("", response_model=HealthRecordSchema, status_code=status.HTTP_201_CREATED)
async def create_health_record(
    record: HealthRecordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new health record"""
    await check_reptile_access(db, current_user, record.reptile_id, AccessLevel.MANAGER)

    # Validate state transition for shedding and brumation records
    if record.record_type in ['shedding', 'brumation']:
        await validate_health_record_state(
            db,
            record.reptile_id,
            record.record_type,
            record.event_type
        )

    new_record = HealthRecord(
        **record.model_dump(exclude={"date"}),
        date=record.date or datetime.now(timezone.utc),
        logged_by_user_id=current_user.id
    )
    db.add(new_record)
    await db.flush()  # Get ID before schedule matching

    # Try to match to a health schedule (bathing, shedding_check, etc.)
    from app.schedule_matcher import assign_health_record_to_schedule
    await assign_health_record_to_schedule(db, new_record)

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