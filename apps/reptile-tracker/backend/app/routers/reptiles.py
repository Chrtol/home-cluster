from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, insert, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime
from app.auth import get_current_user
from app.database import get_db
from app.models import User, Reptile, AccessLevel, reptile_access, household_members, Feeding, Household
from app.permissions import check_reptile_access, get_user_reptiles, is_owner
from app.schemas import (
    Reptile as ReptileSchema,
    ReptileCreate,
    ReptileUpdate,
    ReptileWithAccess,
    ReptileWithHousehold,
    GrantAccess,
    Food as FoodSchema,
)

router = APIRouter()


def populate_avatar_url(reptile: Reptile) -> None:
    """
    Populate avatar_photo_url on a reptile instance.

    If reptile has an avatar_photo_id, sets avatar_photo_url to the thumbnail URL.
    Modifies the reptile object in-place by setting the computed field.
    """
    if hasattr(reptile, 'avatar_photo_id') and reptile.avatar_photo_id:
        # Set the computed field directly on the object
        reptile.avatar_photo_url = f"/api/photos/{reptile.avatar_photo_id}/thumbnail"
    else:
        reptile.avatar_photo_url = None


@router.get("/species", response_model=List[str])
async def list_species(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get list of unique species from all reptiles"""
    result = await db.execute(
        select(Reptile.species)
        .distinct()
        .where(Reptile.species.isnot(None))
        .order_by(Reptile.species)
    )
    species_list = [row[0] for row in result.all()]
    return species_list


@router.get("", response_model=List[ReptileWithHousehold])
async def list_reptiles(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all reptiles the current user has access to with household information

    By default, only active reptiles are returned. Set include_inactive=true to see all reptiles.
    """
    reptiles_with_access = await get_user_reptiles(db, current_user)

    response_data = []
    for item in reptiles_with_access:
        reptile = item["reptile"]

        # Filter inactive reptiles unless explicitly requested
        if not include_inactive and not reptile.is_active:
            continue

        # Populate avatar URL
        populate_avatar_url(reptile)

        # Load household relationship if not already loaded
        # Use __dict__ to avoid triggering lazy load via hasattr
        household = None
        if reptile.household_id:
            if 'household' in reptile.__dict__:
                household = reptile.__dict__['household']
            else:
                household_result = await db.execute(
                    select(Household).where(Household.id == reptile.household_id)
                )
                household = household_result.scalar_one_or_none()

        # Build dict without SQLAlchemy internal attributes
        reptile_dict = {k: v for k, v in reptile.__dict__.items() if not k.startswith('_')}

        response_data.append(
            ReptileWithHousehold(
                **reptile_dict,
                household=household,
            )
        )

    return response_data


@router.post("", response_model=ReptileSchema, status_code=status.HTTP_201_CREATED)
async def create_reptile(
    reptile: ReptileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new reptile (requires household membership)"""

    # Get user's primary household (first household they're a member of)
    household_result = await db.execute(
        select(household_members.c.household_id)
        .where(household_members.c.user_id == current_user.id)
        .limit(1)
    )
    household_id = household_result.scalar_one_or_none()

    # Require household membership
    if not household_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must be a member of a household to create reptiles. Please create or join a household first.",
        )

    new_reptile = Reptile(
        **reptile.model_dump(),
        household_id=household_id,  # Automatically assign to user's household
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(new_reptile)
    await db.flush()

    # Grant owner access to creator
    await db.execute(
        insert(reptile_access).values(
            user_id=current_user.id,
            reptile_id=new_reptile.id,
            access_level=AccessLevel.OWNER,
            granted_at=datetime.utcnow(),
        )
    )

    await db.commit()
    await db.refresh(new_reptile)

    # Populate avatar URL before returning
    populate_avatar_url(new_reptile)

    return new_reptile


@router.get("/{reptile_id}", response_model=ReptileSchema)
async def get_reptile(
    reptile_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific reptile"""
    reptile = await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)

    # Populate avatar URL before returning
    populate_avatar_url(reptile)

    return reptile


@router.patch("/{reptile_id}", response_model=ReptileSchema)
async def update_reptile(
    reptile_id: int,
    reptile_update: ReptileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a reptile (requires MANAGER access or higher)"""
    reptile = await check_reptile_access(db, current_user, reptile_id, AccessLevel.MANAGER)

    # Update only provided fields
    update_data = reptile_update.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.execute(
            update(Reptile).where(Reptile.id == reptile_id).values(**update_data)
        )
        await db.commit()
        await db.refresh(reptile)

    # Populate avatar URL before returning
    populate_avatar_url(reptile)

    return reptile


@router.delete("/{reptile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reptile(
    reptile_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a reptile (requires MANAGER access or higher)"""
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.MANAGER)

    await db.execute(delete(Reptile).where(Reptile.id == reptile_id))
    await db.commit()

    return None


@router.post("/{reptile_id}/grant-access", status_code=status.HTTP_201_CREATED)
async def grant_access(
    reptile_id: int,
    grant: GrantAccess,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Grant access to a reptile (requires OWNER access)"""
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.OWNER)

    # Find user by email
    result = await db.execute(select(User).where(User.email == grant.user_email))
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email {grant.user_email} not found",
        )

    # Check if access already exists
    existing = await db.execute(
        select(reptile_access).where(
            reptile_access.c.user_id == target_user.id,
            reptile_access.c.reptile_id == reptile_id,
        )
    )

    if existing.first():
        # Update existing access
        await db.execute(
            update(reptile_access)
            .where(
                reptile_access.c.user_id == target_user.id,
                reptile_access.c.reptile_id == reptile_id,
            )
            .values(access_level=grant.access_level, granted_at=datetime.utcnow())
        )
    else:
        # Insert new access
        await db.execute(
            insert(reptile_access).values(
                user_id=target_user.id,
                reptile_id=reptile_id,
                access_level=grant.access_level,
                granted_at=datetime.utcnow(),
            )
        )

    await db.commit()

    return {"message": f"Access granted to {grant.user_email}"}


@router.delete("/{reptile_id}/revoke-access/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_access(
    reptile_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke access to a reptile (requires OWNER access)"""
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.OWNER)

    # Don't allow revoking own access if last owner
    if user_id == current_user.id:
        # Check if there are other owners
        owners = await db.execute(
            select(reptile_access).where(
                reptile_access.c.reptile_id == reptile_id,
                reptile_access.c.access_level == AccessLevel.OWNER,
            )
        )
        if len(owners.all()) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot revoke own access as the last owner",
            )

    await db.execute(
        delete(reptile_access).where(
            reptile_access.c.user_id == user_id,
            reptile_access.c.reptile_id == reptile_id,
        )
    )
    await db.commit()


@router.get("/{reptile_id}/favorite-foods", response_model=List[FoodSchema])
async def get_reptile_favorite_foods(
    reptile_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get list of favorite foods for a reptile"""
    from app.models import Reptile, reptile_food_favorites, Food
    from sqlalchemy.orm import selectinload

    await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)

    # Get reptile with favorite foods
    result = await db.execute(
        select(Reptile)
        .options(selectinload(Reptile.favorite_foods))
        .where(Reptile.id == reptile_id)
    )
    reptile = result.scalar_one_or_none()

    if not reptile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reptile not found",
        )

    return reptile.favorite_foods


@router.post("/{reptile_id}/favorite-foods/{food_id}", response_model=dict)
async def add_reptile_favorite_food(
    reptile_id: int,
    food_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a food to reptile's favorites"""
    from app.models import Reptile, reptile_food_favorites, Food
    from sqlalchemy import insert

    await check_reptile_access(db, current_user, reptile_id, AccessLevel.CARETAKER)

    # Check if reptile exists
    reptile_result = await db.execute(select(Reptile).where(Reptile.id == reptile_id))
    if not reptile_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reptile not found",
        )

    # Check if food exists
    food_result = await db.execute(select(Food).where(Food.id == food_id))
    if not food_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food not found",
        )

    # Check if already favorited
    existing = await db.execute(
        select(reptile_food_favorites).where(
            reptile_food_favorites.c.reptile_id == reptile_id,
            reptile_food_favorites.c.food_id == food_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"message": "Food is already in favorites"}

    # Add to favorites
    await db.execute(
        insert(reptile_food_favorites).values(
            reptile_id=reptile_id,
            food_id=food_id,
        )
    )
    await db.commit()

    return {"message": "Food added to favorites"}


@router.delete("/{reptile_id}/favorite-foods/{food_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_reptile_favorite_food(
    reptile_id: int,
    food_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a food from reptile's favorites"""
    from app.models import reptile_food_favorites

    await check_reptile_access(db, current_user, reptile_id, AccessLevel.CARETAKER)

    await db.execute(
        delete(reptile_food_favorites).where(
            reptile_food_favorites.c.reptile_id == reptile_id,
            reptile_food_favorites.c.food_id == food_id,
        )
    )
    await db.commit()

    return None
