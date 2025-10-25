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
)

router = APIRouter()


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

    return new_reptile


@router.get("/{reptile_id}", response_model=ReptileSchema)
async def get_reptile(
    reptile_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific reptile"""
    reptile = await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)
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

    return None
