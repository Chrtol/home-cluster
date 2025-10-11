from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from app.auth import get_current_user
from app.database import get_db
from app.models import User, WeightLog, AccessLevel
from app.permissions import check_reptile_access
from app.schemas import WeightLog as WeightLogSchema, WeightLogCreate

router = APIRouter()


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
    logs = result.scalars().all()

    return logs


@router.post("", response_model=WeightLogSchema, status_code=status.HTTP_201_CREATED)
async def create_weight_log(
    log: WeightLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log a weight measurement"""

    await check_reptile_access(db, current_user, log.reptile_id, AccessLevel.FEEDER)

    new_log = WeightLog(
        **log.model_dump(),
        measured_at=log.measured_at or datetime.utcnow(),
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)

    return new_log


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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weight log not found",
        )

    await check_reptile_access(db, current_user, log.reptile_id, AccessLevel.OWNER)

    await db.execute(delete(WeightLog).where(WeightLog.id == log_id))
    await db.commit()

    return None
