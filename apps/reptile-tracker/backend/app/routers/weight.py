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

    # Try to assign to a matching schedule
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
    await db.execute(delete(WeightLog).where(WeightLog.id == log_id))
    await db.commit()
    return None