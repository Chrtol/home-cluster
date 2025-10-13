from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from app.auth import get_current_user
from app.database import get_db
from app.models import User, Supplement
from app.schemas import Supplement as SupplementSchema, SupplementCreate

router = APIRouter()


@router.get("", response_model=List[SupplementSchema])
async def list_supplements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all supplements"""
    result = await db.execute(select(Supplement).order_by(Supplement.name))
    supplements = result.scalars().all()

    return supplements


@router.post("", response_model=SupplementSchema, status_code=status.HTTP_201_CREATED)
async def create_supplement(
    supplement: SupplementCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new supplement"""

    # Check if supplement already exists
    result = await db.execute(select(Supplement).where(Supplement.name == supplement.name))
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Supplement '{supplement.name}' already exists",
        )

    new_supplement = Supplement(
        **supplement.model_dump(),
        is_default=False,
        created_at=datetime.utcnow(),
    )
    db.add(new_supplement)
    await db.commit()
    await db.refresh(new_supplement)

    return new_supplement


@router.get("/{supplement_id}", response_model=SupplementSchema)
async def get_supplement(
    supplement_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific supplement"""
    result = await db.execute(select(Supplement).where(Supplement.id == supplement_id))
    supplement = result.scalar_one_or_none()

    if not supplement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplement not found",
        )

    return supplement


@router.put("/{supplement_id}", response_model=SupplementSchema)
async def update_supplement(
    supplement_id: int,
    supplement_update: SupplementCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a supplement"""
    result = await db.execute(select(Supplement).where(Supplement.id == supplement_id))
    supplement = result.scalar_one_or_none()

    if not supplement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplement not found",
        )

    # Check if name is being changed to an existing name
    if supplement_update.name != supplement.name:
        existing_result = await db.execute(
            select(Supplement).where(Supplement.name == supplement_update.name)
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supplement '{supplement_update.name}' already exists",
            )

    # Update fields
    supplement.name = supplement_update.name
    supplement.nutritional_data = supplement_update.nutritional_data

    await db.commit()
    await db.refresh(supplement)

    return supplement


@router.delete("/{supplement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplement(
    supplement_id: int,
    force: bool = Query(False, description="Force delete even if it's a default supplement"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a supplement"""
    result = await db.execute(select(Supplement).where(Supplement.id == supplement_id))
    supplement = result.scalar_one_or_none()

    if not supplement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplement not found",
        )

    # Protect default supplements unless force is used
    if supplement.is_default and not force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete default supplement. Use force=true to override.",
        )

    await db.execute(delete(Supplement).where(Supplement.id == supplement_id))
    await db.commit()

    return None
