from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import User, Reptile, AccessLevel, reptile_access


async def check_reptile_access(
    db: AsyncSession,
    user: User,
    reptile_id: int,
    required_level: AccessLevel = AccessLevel.VIEWER,
) -> Reptile:
    """Check if user has required access level to reptile"""

    # Get reptile
    result = await db.execute(select(Reptile).where(Reptile.id == reptile_id))
    reptile = result.scalar_one_or_none()

    if not reptile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reptile not found",
        )

    # Check access
    access_result = await db.execute(
        select(reptile_access.c.access_level).where(
            reptile_access.c.user_id == user.id,
            reptile_access.c.reptile_id == reptile_id,
        )
    )
    access_level = access_result.scalar_one_or_none()

    if not access_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this reptile",
        )

    # Check if access level is sufficient
    level_hierarchy = {
        AccessLevel.VIEWER: 1,
        AccessLevel.FEEDER: 2,
        AccessLevel.OWNER: 3,
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
    """Get all reptiles the user has access to"""

    level_hierarchy = {
        AccessLevel.VIEWER: 1,
        AccessLevel.FEEDER: 2,
        AccessLevel.OWNER: 3,
    }

    query = (
        select(Reptile, reptile_access.c.access_level)
        .join(reptile_access, Reptile.id == reptile_access.c.reptile_id)
        .where(reptile_access.c.user_id == user.id)
    )

    result = await db.execute(query)
    rows = result.all()

    # Filter by access level
    reptiles_with_access = [
        {"reptile": row[0], "access_level": row[1]}
        for row in rows
        if level_hierarchy[row[1]] >= level_hierarchy[min_access_level]
    ]

    return reptiles_with_access


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
