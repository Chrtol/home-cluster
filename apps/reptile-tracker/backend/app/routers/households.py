from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete
from sqlalchemy.orm import selectinload
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/api/households", tags=["households"])


@router.post("", response_model=schemas.HouseholdOut)
async def create_household(payload: schemas.HouseholdCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    # Create household and add creator as owner
    household = models.Household(name=payload.name)
    db.add(household)
    await db.flush()

    # add membership - creator gets owner role to manage household
    stmt = insert(models.household_members).values(household_id=household.id, user_id=user.id, access_level=models.AccessLevel.OWNER)
    await db.execute(stmt)
    await db.commit()
    await db.refresh(household)
    return household


@router.get("/me", response_model=list[schemas.HouseholdOut])
async def get_my_households(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    # Query households directly via the association table
    result = await db.execute(
        select(models.Household)
        .join(models.household_members)
        .where(models.household_members.c.user_id == user.id)
    )
    households = result.scalars().all()
    return households


@router.get("/{household_id}/members")
async def get_household_members(household_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Get all members of a household"""
    # Check if user is a member
    member_check = await db.execute(
        select(models.household_members).where(
            models.household_members.c.household_id == household_id,
            models.household_members.c.user_id == user.id
        )
    )
    if not member_check.first():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this household")

    # Get all members with user info
    result = await db.execute(
        select(models.User, models.household_members.c.access_level, models.household_members.c.joined_at)
        .join(models.household_members, models.User.id == models.household_members.c.user_id)
        .where(models.household_members.c.household_id == household_id)
    )
    members = result.all()

    return [
        {
            "user_id": member[0].id,
            "name": member[0].name,
            "email": member[0].email,
            "access_level": member[1].value if hasattr(member[1], 'value') else str(member[1]),
            "joined_at": member[2]
        }
        for member in members
    ]


@router.put("/{household_id}")
async def update_household(household_id: int, payload: schemas.HouseholdCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Update household name (owner only)"""
    # Check if user is owner
    member_check = await db.execute(
        select(models.household_members.c.access_level).where(
            models.household_members.c.household_id == household_id,
            models.household_members.c.user_id == user.id
        )
    )
    access_level = member_check.scalar_one_or_none()
    if not access_level or access_level != models.AccessLevel.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can edit household")

    # Update household
    await db.execute(
        update(models.Household)
        .where(models.Household.id == household_id)
        .values(name=payload.name)
    )
    await db.commit()

    # Return updated household
    result = await db.execute(select(models.Household).where(models.Household.id == household_id))
    household = result.scalar_one()
    return household


@router.patch("/{household_id}/members/{user_id}/role")
async def update_member_role(
    household_id: int,
    user_id: int,
    new_role: schemas.MemberRoleUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    """Update a member's role in the household (owner or admin only)"""
    # Check if requester is owner or admin
    requester_check = await db.execute(
        select(models.household_members.c.access_level).where(
            models.household_members.c.household_id == household_id,
            models.household_members.c.user_id == user.id
        )
    )
    requester_access = requester_check.scalar_one_or_none()
    if not requester_access or requester_access not in [models.AccessLevel.OWNER, models.AccessLevel.ADMIN]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners and admins can change member roles")

    # Can't change your own role
    if user_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own role")

    # Check if target member exists
    target_check = await db.execute(
        select(models.household_members.c.access_level).where(
            models.household_members.c.household_id == household_id,
            models.household_members.c.user_id == user_id
        )
    )
    target_access = target_check.scalar_one_or_none()
    if not target_access:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in household")

    # Update role
    await db.execute(
        update(models.household_members)
        .where(
            models.household_members.c.household_id == household_id,
            models.household_members.c.user_id == user_id
        )
        .values(access_level=new_role.access_level)
    )
    await db.commit()

    return {"status": "updated", "user_id": user_id, "new_role": new_role.access_level}


@router.delete("/{household_id}/members/{user_id}")
async def remove_member(household_id: int, user_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Remove a member from household (owner or admin only)"""
    # Check if requester is owner or admin
    requester_check = await db.execute(
        select(models.household_members.c.access_level).where(
            models.household_members.c.household_id == household_id,
            models.household_members.c.user_id == user.id
        )
    )
    requester_access = requester_check.scalar_one_or_none()
    if not requester_access or requester_access not in [models.AccessLevel.OWNER, models.AccessLevel.ADMIN]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners and admins can remove members")

    # Can't remove yourself (use leave endpoint instead)
    if user_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove yourself. Use leave endpoint instead.")

    # Check if target member exists
    target_check = await db.execute(
        select(models.household_members.c.access_level).where(
            models.household_members.c.household_id == household_id,
            models.household_members.c.user_id == user_id
        )
    )
    target_access = target_check.scalar_one_or_none()
    if not target_access:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in household")

    # Remove member
    await db.execute(
        delete(models.household_members).where(
            models.household_members.c.household_id == household_id,
            models.household_members.c.user_id == user_id
        )
    )
    await db.commit()

    return {"status": "removed", "user_id": user_id}


@router.post("/{household_id}/leave")
async def leave_household(household_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Leave a household"""
    # Check if user is a member
    member_check = await db.execute(
        select(models.household_members.c.access_level).where(
            models.household_members.c.household_id == household_id,
            models.household_members.c.user_id == user.id
        )
    )
    access_level = member_check.scalar_one_or_none()
    if not access_level:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not a member of this household")

    # Check if they're the last owner
    if access_level == models.AccessLevel.OWNER:
        owner_count_result = await db.execute(
            select(models.household_members.c.user_id).where(
                models.household_members.c.household_id == household_id,
                models.household_members.c.access_level == models.AccessLevel.OWNER
            )
        )
        owner_count = len(owner_count_result.all())
        if owner_count == 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot leave as the last owner. Transfer ownership or delete household first.")

    # Remove membership
    await db.execute(
        delete(models.household_members).where(
            models.household_members.c.household_id == household_id,
            models.household_members.c.user_id == user.id
        )
    )
    await db.commit()

    return {"status": "left", "household_id": household_id}
