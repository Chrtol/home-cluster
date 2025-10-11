from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from app.auth import get_current_user
from app.database import get_db
from app.models import User, Food
from app.schemas import Food as FoodSchema, FoodCreate

router = APIRouter()


@router.get("", response_model=List[FoodSchema])
async def list_foods(
    category: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all foods"""
    query = select(Food).order_by(Food.name)

    if category:
        query = query.where(Food.category == category)

    result = await db.execute(query)
    foods = result.scalars().all()

    return foods


@router.post("", response_model=FoodSchema, status_code=status.HTTP_201_CREATED)
async def create_food(
    food: FoodCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new food type"""

    # Check if food already exists
    result = await db.execute(select(Food).where(Food.name == food.name))
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Food '{food.name}' already exists",
        )

    new_food = Food(
        **food.model_dump(),
        is_default=False,
        created_at=datetime.utcnow(),
    )
    db.add(new_food)
    await db.commit()
    await db.refresh(new_food)

    return new_food


@router.get("/{food_id}", response_model=FoodSchema)
async def get_food(
    food_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific food"""
    result = await db.execute(select(Food).where(Food.id == food_id))
    food = result.scalar_one_or_none()

    if not food:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food not found",
        )

    return food
