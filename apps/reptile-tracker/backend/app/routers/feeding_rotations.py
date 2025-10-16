from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from app.auth import get_current_user
from app.database import get_db
from app.models import User, FeedingRotation, AccessLevel
from app.permissions import check_reptile_access
from app.schemas import (
    FeedingRotation as FeedingRotationSchema,
    FeedingRotationCreate,
    FeedingRotationUpdate,
    FeedingRotationWithDetails,
)

router = APIRouter()


@router.get("/reptile/{reptile_id}", response_model=List[FeedingRotationWithDetails])
async def list_feeding_rotations(
    reptile_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all feeding rotations for a reptile"""
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)
    result = await db.execute(
        select(FeedingRotation)
        .where(FeedingRotation.reptile_id == reptile_id)
        .options(selectinload(FeedingRotation.supplement))
        .order_by(FeedingRotation.priority, FeedingRotation.created_at)
    )
    return result.scalars().all()


@router.get("/{rotation_id}", response_model=FeedingRotationWithDetails)
async def get_feeding_rotation(
    rotation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific feeding rotation"""
    result = await db.execute(
        select(FeedingRotation)
        .where(FeedingRotation.id == rotation_id)
        .options(selectinload(FeedingRotation.supplement))
    )
    rotation = result.scalar_one_or_none()
    if not rotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Feeding rotation not found"
        )
    await check_reptile_access(db, current_user, rotation.reptile_id, AccessLevel.VIEWER)
    return rotation


@router.post("", response_model=FeedingRotationSchema, status_code=status.HTTP_201_CREATED)
async def create_feeding_rotation(
    rotation: FeedingRotationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new feeding rotation"""
    await check_reptile_access(db, current_user, rotation.reptile_id, AccessLevel.CARETAKER)

    # Validate rotation data
    if rotation.rotation_type == "supplement" and not rotation.supplement_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="supplement_id is required for supplement rotations"
        )
    elif rotation.rotation_type == "food_replacement" and not rotation.replacement_food_category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="replacement_food_category is required for food replacement rotations"
        )

    if rotation.every_n_feedings < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="every_n_feedings must be at least 1"
        )

    new_rotation = FeedingRotation(
        **rotation.model_dump(),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(new_rotation)
    await db.commit()
    await db.refresh(new_rotation)
    return new_rotation


@router.patch("/{rotation_id}", response_model=FeedingRotationSchema)
async def update_feeding_rotation(
    rotation_id: int,
    rotation_update: FeedingRotationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a feeding rotation"""
    result = await db.execute(select(FeedingRotation).where(FeedingRotation.id == rotation_id))
    rotation = result.scalar_one_or_none()
    if not rotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Feeding rotation not found"
        )

    await check_reptile_access(db, current_user, rotation.reptile_id, AccessLevel.CARETAKER)

    update_data = rotation_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rotation, field, value)

    rotation.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(rotation)
    return rotation


@router.delete("/{rotation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feeding_rotation(
    rotation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a feeding rotation"""
    result = await db.execute(select(FeedingRotation).where(FeedingRotation.id == rotation_id))
    rotation = result.scalar_one_or_none()
    if not rotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Feeding rotation not found"
        )
    await check_reptile_access(db, current_user, rotation.reptile_id, AccessLevel.CARETAKER)
    await db.execute(delete(FeedingRotation).where(FeedingRotation.id == rotation_id))
    await db.commit()
    return None
