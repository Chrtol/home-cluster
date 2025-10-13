from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, insert, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.auth import get_current_user
from app.database import get_db
from app.models import (
    User,
    Feeding,
    Food,
    Supplement,
    AccessLevel,
    feeding_foods,
    feeding_supplements,
    feeding_salad_components,
    NotificationSettings,
)
from app.permissions import check_reptile_access
from app.schemas import FeedingCreate, Feeding as FeedingSchema, FeedingWithUser
from app.notifications import notify_feeding_logged

router = APIRouter()


@router.get("", response_model=List[FeedingWithUser])
async def list_feedings(
    reptile_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List feedings with optional filters"""

    query = (
        select(Feeding)
        .options(
            selectinload(Feeding.supplements),
            selectinload(Feeding.salad_components),
            selectinload(Feeding.user),
            selectinload(Feeding.reptile),
        )
    )

    # Filter by reptile if specified
    if reptile_id:
        await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)
        query = query.where(Feeding.reptile_id == reptile_id)
    else:
        # Get all reptiles user has access to
        from app.permissions import get_user_reptiles
        user_reptiles = await get_user_reptiles(db, current_user)
        reptile_ids = [item["reptile"].id for item in user_reptiles]
        query = query.where(Feeding.reptile_id.in_(reptile_ids))

    # Date filters
    if start_date:
        query = query.where(Feeding.fed_at >= start_date)
    if end_date:
        query = query.where(Feeding.fed_at <= end_date)

    # Order by most recent first
    query = query.order_by(Feeding.fed_at.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    feedings = result.scalars().all()

    # For each feeding, manually load foods with quantities
    feedings_list = []
    for feeding in feedings:
        # Load foods with quantities from association table
        foods_result = await db.execute(
            select(Food, feeding_foods.c.quantity)
            .join(feeding_foods, Food.id == feeding_foods.c.food_id)
            .where(feeding_foods.c.feeding_id == feeding.id)
        )
        foods_with_qty = []
        for food, quantity in foods_result:
            food_dict = {
                "id": food.id,
                "name": food.name,
                "category": food.category,
                "insect_size": food.insect_size,
                "nutritional_data": food.nutritional_data,
                "is_default": food.is_default,
                "created_at": food.created_at,
                "quantity": quantity,
            }
            foods_with_qty.append(food_dict)

        # Convert feeding to dict with all data
        feeding_dict = {
            "id": feeding.id,
            "reptile_id": feeding.reptile_id,
            "user_id": feeding.user_id,
            "fed_at": feeding.fed_at,
            "notes": feeding.notes,
            "is_salad": feeding.is_salad,
            "foods": foods_with_qty,
            "supplements": [
                {
                    "id": s.id,
                    "name": s.name,
                    "nutritional_data": s.nutritional_data,
                    "is_default": s.is_default,
                    "created_at": s.created_at,
                }
                for s in feeding.supplements
            ],
            "salad_components": [
                {
                    "id": f.id,
                    "name": f.name,
                    "category": f.category,
                    "insect_size": f.insect_size,
                    "nutritional_data": f.nutritional_data,
                    "is_default": f.is_default,
                    "created_at": f.created_at,
                }
                for f in feeding.salad_components
            ],
            "created_at": feeding.created_at,
            "user": {
                "id": feeding.user.id,
                "email": feeding.user.email,
                "name": feeding.user.name,
                "oidc_sub": feeding.user.oidc_sub,
                "created_at": feeding.user.created_at,
                "last_login": feeding.user.last_login,
            } if feeding.user else None,
            "reptile": {
                "id": feeding.reptile.id,
                "name": feeding.reptile.name,
                "species": feeding.reptile.species,
                "date_of_birth": feeding.reptile.date_of_birth,
                "notes": feeding.reptile.notes,
                "photo_url": feeding.reptile.photo_url,
                "feeding_schedule_enabled": feeding.reptile.feeding_schedule_enabled,
                "feeding_frequency_days": feeding.reptile.feeding_frequency_days,
                "reminder_enabled": feeding.reptile.reminder_enabled,
                "reminder_hours_before": feeding.reptile.reminder_hours_before,
                "created_at": feeding.reptile.created_at,
                "updated_at": feeding.reptile.updated_at,
            } if feeding.reptile else None,
        }
        feedings_list.append(feeding_dict)

    return feedings_list


@router.post("", response_model=FeedingSchema, status_code=status.HTTP_201_CREATED)
async def create_feeding(
    feeding: FeedingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log a feeding"""

    # Check access
    reptile = await check_reptile_access(
        db, current_user, feeding.reptile_id, AccessLevel.FEEDER
    )

    # Create feeding
    new_feeding = Feeding(
        reptile_id=feeding.reptile_id,
        user_id=current_user.id,
        fed_at=feeding.fed_at or datetime.utcnow(),
        notes=feeding.notes,
        is_salad=feeding.is_salad,
        created_at=datetime.utcnow(),
    )
    db.add(new_feeding)
    await db.flush()

    # Add foods with quantities
    for food_item in feeding.foods:
        await db.execute(
            insert(feeding_foods).values(
                feeding_id=new_feeding.id,
                food_id=food_item.food_id,
                quantity=food_item.quantity,
            )
        )

    # Add supplements
    for supplement_id in feeding.supplements:
        await db.execute(
            insert(feeding_supplements).values(
                feeding_id=new_feeding.id,
                supplement_id=supplement_id,
            )
        )

    # Add salad components if salad
    if feeding.is_salad and feeding.salad_components:
        for food_id in feeding.salad_components:
            await db.execute(
                insert(feeding_salad_components).values(
                    feeding_id=new_feeding.id,
                    food_id=food_id,
                )
            )

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Feeding)
        .where(Feeding.id == new_feeding.id)
        .options(
            selectinload(Feeding.supplements),
            selectinload(Feeding.salad_components),
        )
    )
    new_feeding = result.scalar_one()

    # Manually load foods with quantities from association table
    foods_result = await db.execute(
        select(Food, feeding_foods.c.quantity)
        .join(feeding_foods, Food.id == feeding_foods.c.food_id)
        .where(feeding_foods.c.feeding_id == new_feeding.id)
    )
    foods_with_qty = []
    for food, quantity in foods_result:
        food_dict = {
            "id": food.id,
            "name": food.name,
            "category": food.category,
            "insect_size": food.insect_size,
            "nutritional_data": food.nutritional_data,
            "is_default": food.is_default,
            "created_at": food.created_at,
            "quantity": quantity,
        }
        foods_with_qty.append(food_dict)

    # Convert feeding to dict with all data
    feeding_dict = {
        "id": new_feeding.id,
        "reptile_id": new_feeding.reptile_id,
        "user_id": new_feeding.user_id,
        "fed_at": new_feeding.fed_at,
        "notes": new_feeding.notes,
        "is_salad": new_feeding.is_salad,
        "foods": foods_with_qty,
        "supplements": [
            {
                "id": s.id,
                "name": s.name,
                "nutritional_data": s.nutritional_data,
                "is_default": s.is_default,
                "created_at": s.created_at,
            }
            for s in new_feeding.supplements
        ],
        "salad_components": [
            {
                "id": f.id,
                "name": f.name,
                "category": f.category,
                "insect_size": f.insect_size,
                "nutritional_data": f.nutritional_data,
                "is_default": f.is_default,
                "created_at": f.created_at,
            }
            for f in new_feeding.salad_components
        ],
        "created_at": new_feeding.created_at,
    }

    # Send notification if configured
    notif_result = await db.execute(
        select(NotificationSettings).where(
            NotificationSettings.user_id == current_user.id
        )
    )
    notif_settings = notif_result.scalar_one_or_none()

    if notif_settings and notif_settings.webhook_enabled and notif_settings.webhook_url:
        await notify_feeding_logged(
            reptile=reptile,
            user=current_user,
            feeding=new_feeding,
            webhook_url=notif_settings.webhook_url,
            webhook_type=notif_settings.webhook_type,
        )

    return feeding_dict


@router.get("/{feeding_id}", response_model=FeedingWithUser)
async def get_feeding(
    feeding_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific feeding"""

    result = await db.execute(
        select(Feeding)
        .where(Feeding.id == feeding_id)
        .options(
            selectinload(Feeding.supplements),
            selectinload(Feeding.salad_components),
            selectinload(Feeding.user),
            selectinload(Feeding.reptile),
        )
    )
    feeding = result.scalar_one_or_none()

    if not feeding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feeding not found",
        )

    # Check access to reptile
    await check_reptile_access(db, current_user, feeding.reptile_id, AccessLevel.VIEWER)

    # Manually load foods with quantities from association table
    foods_result = await db.execute(
        select(Food, feeding_foods.c.quantity)
        .join(feeding_foods, Food.id == feeding_foods.c.food_id)
        .where(feeding_foods.c.feeding_id == feeding_id)
    )
    foods_with_qty = []
    for food, quantity in foods_result:
        food_dict = {
            "id": food.id,
            "name": food.name,
            "category": food.category,
            "insect_size": food.insect_size,
            "nutritional_data": food.nutritional_data,
            "is_default": food.is_default,
            "created_at": food.created_at,
            "quantity": quantity,
        }
        foods_with_qty.append(food_dict)

    # Convert feeding to dict and add foods with quantities
    feeding_dict = {
        "id": feeding.id,
        "reptile_id": feeding.reptile_id,
        "user_id": feeding.user_id,
        "fed_at": feeding.fed_at,
        "notes": feeding.notes,
        "is_salad": feeding.is_salad,
        "foods": foods_with_qty,
        "supplements": [
            {
                "id": s.id,
                "name": s.name,
                "nutritional_data": s.nutritional_data,
                "is_default": s.is_default,
                "created_at": s.created_at,
            }
            for s in feeding.supplements
        ],
        "salad_components": [
            {
                "id": f.id,
                "name": f.name,
                "category": f.category,
                "insect_size": f.insect_size,
                "nutritional_data": f.nutritional_data,
                "is_default": f.is_default,
                "created_at": f.created_at,
            }
            for f in feeding.salad_components
        ],
        "created_at": feeding.created_at,
        "user": {
            "id": feeding.user.id,
            "email": feeding.user.email,
            "name": feeding.user.name,
            "oidc_sub": feeding.user.oidc_sub,
            "created_at": feeding.user.created_at,
            "last_login": feeding.user.last_login,
        } if feeding.user else None,
        "reptile": {
            "id": feeding.reptile.id,
            "name": feeding.reptile.name,
            "species": feeding.reptile.species,
            "date_of_birth": feeding.reptile.date_of_birth,
            "notes": feeding.reptile.notes,
            "photo_url": feeding.reptile.photo_url,
            "feeding_schedule_enabled": feeding.reptile.feeding_schedule_enabled,
            "feeding_frequency_days": feeding.reptile.feeding_frequency_days,
            "reminder_enabled": feeding.reptile.reminder_enabled,
            "reminder_hours_before": feeding.reptile.reminder_hours_before,
            "created_at": feeding.reptile.created_at,
            "updated_at": feeding.reptile.updated_at,
        } if feeding.reptile else None,
    }

    return feeding_dict


@router.put("/{feeding_id}", response_model=FeedingSchema)
async def update_feeding(
    feeding_id: int,
    feeding_update: FeedingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a feeding (must be owner or the user who logged it)"""

    result = await db.execute(select(Feeding).where(Feeding.id == feeding_id))
    feeding = result.scalar_one_or_none()

    if not feeding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feeding not found",
        )

    # Check if user is either the feeder or has owner access to reptile
    from app.permissions import is_owner
    is_reptile_owner = await is_owner(db, current_user, feeding.reptile_id)

    if feeding.user_id != current_user.id and not is_reptile_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own feedings unless you're the reptile owner",
        )

    # Update basic fields
    feeding.fed_at = feeding_update.fed_at or feeding.fed_at
    feeding.notes = feeding_update.notes
    feeding.is_salad = feeding_update.is_salad

    # Delete existing associations
    await db.execute(delete(feeding_foods).where(feeding_foods.c.feeding_id == feeding_id))
    await db.execute(delete(feeding_supplements).where(feeding_supplements.c.feeding_id == feeding_id))
    await db.execute(delete(feeding_salad_components).where(feeding_salad_components.c.feeding_id == feeding_id))

    # Add new foods
    for food_item in feeding_update.foods:
        await db.execute(
            insert(feeding_foods).values(
                feeding_id=feeding_id,
                food_id=food_item.food_id,
                quantity=food_item.quantity,
            )
        )

    # Add new supplements
    for supplement_id in feeding_update.supplements:
        await db.execute(
            insert(feeding_supplements).values(
                feeding_id=feeding_id,
                supplement_id=supplement_id,
            )
        )

    # Add new salad components
    if feeding_update.is_salad and feeding_update.salad_components:
        for food_id in feeding_update.salad_components:
            await db.execute(
                insert(feeding_salad_components).values(
                    feeding_id=feeding_id,
                    food_id=food_id,
                )
            )

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Feeding)
        .where(Feeding.id == feeding_id)
        .options(
            selectinload(Feeding.supplements),
            selectinload(Feeding.salad_components),
        )
    )
    updated_feeding = result.scalar_one()

    # Manually load foods with quantities from association table
    foods_result = await db.execute(
        select(Food, feeding_foods.c.quantity)
        .join(feeding_foods, Food.id == feeding_foods.c.food_id)
        .where(feeding_foods.c.feeding_id == feeding_id)
    )
    foods_with_qty = []
    for food, quantity in foods_result:
        food_dict = {
            "id": food.id,
            "name": food.name,
            "category": food.category,
            "insect_size": food.insect_size,
            "nutritional_data": food.nutritional_data,
            "is_default": food.is_default,
            "created_at": food.created_at,
            "quantity": quantity,
        }
        foods_with_qty.append(food_dict)

    # Convert feeding to dict with all data
    feeding_dict = {
        "id": updated_feeding.id,
        "reptile_id": updated_feeding.reptile_id,
        "user_id": updated_feeding.user_id,
        "fed_at": updated_feeding.fed_at,
        "notes": updated_feeding.notes,
        "is_salad": updated_feeding.is_salad,
        "foods": foods_with_qty,
        "supplements": [
            {
                "id": s.id,
                "name": s.name,
                "nutritional_data": s.nutritional_data,
                "is_default": s.is_default,
                "created_at": s.created_at,
            }
            for s in updated_feeding.supplements
        ],
        "salad_components": [
            {
                "id": f.id,
                "name": f.name,
                "category": f.category,
                "insect_size": f.insect_size,
                "nutritional_data": f.nutritional_data,
                "is_default": f.is_default,
                "created_at": f.created_at,
            }
            for f in updated_feeding.salad_components
        ],
        "created_at": updated_feeding.created_at,
    }

    return feeding_dict


@router.delete("/{feeding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feeding(
    feeding_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a feeding (must be owner or the user who logged it)"""

    result = await db.execute(select(Feeding).where(Feeding.id == feeding_id))
    feeding = result.scalar_one_or_none()

    if not feeding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feeding not found",
        )

    # Check if user is either the feeder or has owner access to reptile
    from app.permissions import is_owner
    is_reptile_owner = await is_owner(db, current_user, feeding.reptile_id)

    if feeding.user_id != current_user.id and not is_reptile_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own feedings unless you're the reptile owner",
        )

    await db.execute(delete(Feeding).where(Feeding.id == feeding_id))
    await db.commit()

    return None


@router.get("/reptile/{reptile_id}/last-feeding")
async def get_last_feeding(
    reptile_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the last feeding for a reptile"""

    await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)

    result = await db.execute(
        select(Feeding)
        .where(Feeding.reptile_id == reptile_id)
        .order_by(Feeding.fed_at.desc())
        .limit(1)
    )
    feeding = result.scalar_one_or_none()

    if not feeding:
        return None

    return {
        "last_feeding_date": feeding.fed_at,
        "days_since_feeding": (datetime.utcnow() - feeding.fed_at).days,
    }
