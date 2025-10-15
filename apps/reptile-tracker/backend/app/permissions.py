from fastapi import HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import User, Reptile, AccessLevel, reptile_access, household_members


async def check_reptile_access(
    db: AsyncSession,
    user: User,
    reptile_id: int,
    required_level: AccessLevel = AccessLevel.VIEWER,
) -> Reptile:
    """Check if user has required access level to reptile (via direct access or household)"""

    # Get reptile
    result = await db.execute(select(Reptile).where(Reptile.id == reptile_id))
    reptile = result.scalar_one_or_none()

    if not reptile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reptile not found",
        )

    # Check direct access
    access_result = await db.execute(
        select(reptile_access.c.access_level).where(
            reptile_access.c.user_id == user.id,
            reptile_access.c.reptile_id == reptile_id,
        )
    )
    access_level = access_result.scalar_one_or_none()

    # If no direct access, check household membership
    if not access_level and reptile.household_id:
        household_check = await db.execute(
            select(household_members.c.user_id).where(
                household_members.c.user_id == user.id,
                household_members.c.household_id == reptile.household_id,
            )
        )
        is_household_member = household_check.scalar_one_or_none()
        if is_household_member:
            # Grant FEEDER access via household membership
            access_level = AccessLevel.CARETAKER

    if not access_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this reptile",
        )

    # Check if access level is sufficient
    level_hierarchy = {
        AccessLevel.VIEWER: 1,
        AccessLevel.CARETAKER: 2,
        AccessLevel.OWNER: 3,
        AccessLevel.ADMIN: 4,
    }

    if level_hierarchy[access_level] < level_hierarchy[required_level]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required: {required_level.value}",
        )

    return reptile


async def get_user_reptiles(
    db: AsyncSession,
    user: User,
    min_access_level: AccessLevel = AccessLevel.VIEWER,
):
    """Get all reptiles the user has access to (via direct access or household membership)"""

    level_hierarchy = {
        AccessLevel.VIEWER: 1,
        AccessLevel.CARETAKER: 2,
        AccessLevel.OWNER: 3,
        AccessLevel.ADMIN: 4,
    }

    # Query reptiles with direct access
    direct_access_query = (
        select(Reptile, reptile_access.c.access_level)
        .join(reptile_access, Reptile.id == reptile_access.c.reptile_id)
        .where(reptile_access.c.user_id == user.id)
    )
    direct_result = await db.execute(direct_access_query)
    direct_rows = direct_result.all()

    # Query reptiles via household membership
    # Users in a household get FEEDER access to all reptiles in that household
    household_query = (
        select(Reptile)
        .join(household_members, Reptile.household_id == household_members.c.household_id)
        .where(
            household_members.c.user_id == user.id,
            Reptile.household_id.isnot(None)  # Only reptiles that are in a household
        )
    )
    household_result = await db.execute(household_query)
    household_reptiles = household_result.scalars().all()

    # Combine results
    reptiles_dict = {}

    # Add direct access reptiles
    for row in direct_rows:
        reptile, access_level = row[0], row[1]
        if level_hierarchy[access_level] >= level_hierarchy[min_access_level]:
            reptiles_dict[reptile.id] = {"reptile": reptile, "access_level": access_level}

    # Add household reptiles (with FEEDER access, unless they have better direct access)
    for reptile in household_reptiles:
        if reptile.id not in reptiles_dict:
            # User doesn't have direct access, grant FEEDER via household
            if level_hierarchy[AccessLevel.CARETAKER] >= level_hierarchy[min_access_level]:
                reptiles_dict[reptile.id] = {"reptile": reptile, "access_level": AccessLevel.CARETAKER}

    return list(reptiles_dict.values())


async def is_owner(db: AsyncSession, user: User, reptile_id: int) -> bool:
    """Check if user is owner of reptile"""
    access_result = await db.execute(
        select(reptile_access.c.access_level).where(
            reptile_access.c.user_id == user.id,
            reptile_access.c.reptile_id == reptile_id,
        )
    )
    access_level = access_result.scalar_one_or_none()
    return access_level == AccessLevel.OWNER
