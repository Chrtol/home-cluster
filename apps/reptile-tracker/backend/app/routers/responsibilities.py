from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from app.auth import get_current_user
from app.database import get_db
from app.models import (
    User, Reptile, Schedule, ReptileResponsibility, ScheduleResponsibility,
    household_members, AccessLevel
)
from app.schemas import (
    ReptileResponsibilityResponse, ScheduleResponsibilityResponse,
    ResponsibilityUpdate, HouseholdResponsibilityOverview,
    ResponsibilityAssignment
)

router = APIRouter()


async def check_household_member(db: AsyncSession, user: User, reptile_id: int = None, schedule_id: int = None):
    """Check if user is in the household that owns the reptile/schedule"""
    if reptile_id:
        result = await db.execute(
            select(Reptile).where(Reptile.id == reptile_id)
        )
        reptile = result.scalar_one_or_none()
        if not reptile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reptile not found")

        household_id = reptile.household_id
    elif schedule_id:
        result = await db.execute(
            select(Schedule, Reptile)
            .join(Reptile, Schedule.reptile_id == Reptile.id)
            .where(Schedule.id == schedule_id)
        )
        row = result.first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

        household_id = row[1].household_id
    else:
        raise ValueError("Must provide reptile_id or schedule_id")

    # Check household membership
    if household_id:
        member_check = await db.execute(
            select(household_members).where(
                household_members.c.household_id == household_id,
                household_members.c.user_id == user.id
            )
        )
        if not member_check.first():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this household")

    return household_id


@router.get("/reptiles/{reptile_id}", response_model=ReptileResponsibilityResponse)
async def get_reptile_responsibilities(
    reptile_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get responsibility assignments for a reptile"""
    await check_household_member(db, current_user, reptile_id=reptile_id)

    # Get assignments
    result = await db.execute(
        select(ReptileResponsibility)
        .where(ReptileResponsibility.reptile_id == reptile_id)
        .order_by(ReptileResponsibility.assigned_at)
    )
    assignments = result.scalars().all()

    return ReptileResponsibilityResponse(
        reptile_id=reptile_id,
        assignments=[
            ResponsibilityAssignment(
                user_id=a.user_id,
                assigned_at=a.assigned_at,
                assigned_by_user_id=a.assigned_by_user_id
            ) for a in assignments
        ],
        is_unassigned=len(assignments) == 0
    )


@router.put("/reptiles/{reptile_id}", response_model=ReptileResponsibilityResponse)
async def update_reptile_responsibilities(
    reptile_id: int,
    update: ResponsibilityUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update responsibility assignments for a reptile (replaces all)"""
    household_id = await check_household_member(db, current_user, reptile_id=reptile_id)

    # Verify all user_ids are in the household
    if household_id:
        for user_id in update.user_ids:
            member_check = await db.execute(
                select(household_members).where(
                    household_members.c.household_id == household_id,
                    household_members.c.user_id == user_id
                )
            )
            if not member_check.first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User {user_id} is not in the household"
                )

    # Delete all existing assignments
    await db.execute(
        delete(ReptileResponsibility).where(ReptileResponsibility.reptile_id == reptile_id)
    )

    # Create new assignments
    new_assignments = []
    for user_id in update.user_ids:
        assignment = ReptileResponsibility(
            reptile_id=reptile_id,
            user_id=user_id,
            assigned_by_user_id=current_user.id
        )
        db.add(assignment)
        new_assignments.append(assignment)

    await db.commit()

    # Refresh all to get assigned_at timestamps
    for assignment in new_assignments:
        await db.refresh(assignment)

    return ReptileResponsibilityResponse(
        reptile_id=reptile_id,
        assignments=[
            ResponsibilityAssignment(
                user_id=a.user_id,
                assigned_at=a.assigned_at,
                assigned_by_user_id=a.assigned_by_user_id
            ) for a in new_assignments
        ],
        is_unassigned=len(new_assignments) == 0
    )


@router.delete("/reptiles/{reptile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def clear_reptile_responsibilities(
    reptile_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear all responsibility assignments for a reptile (makes everyone responsible)"""
    await check_household_member(db, current_user, reptile_id=reptile_id)

    await db.execute(
        delete(ReptileResponsibility).where(ReptileResponsibility.reptile_id == reptile_id)
    )
    await db.commit()
    return None


@router.get("/schedules/{schedule_id}", response_model=ScheduleResponsibilityResponse)
async def get_schedule_responsibilities(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get responsibility assignments for a schedule"""
    await check_household_member(db, current_user, schedule_id=schedule_id)

    # Get assignments
    result = await db.execute(
        select(ScheduleResponsibility)
        .where(ScheduleResponsibility.schedule_id == schedule_id)
        .order_by(ScheduleResponsibility.assigned_at)
    )
    assignments = result.scalars().all()

    return ScheduleResponsibilityResponse(
        schedule_id=schedule_id,
        assignments=[
            ResponsibilityAssignment(
                user_id=a.user_id,
                assigned_at=a.assigned_at,
                assigned_by_user_id=a.assigned_by_user_id
            ) for a in assignments
        ],
        inherits_from_reptile=len(assignments) == 0
    )


@router.put("/schedules/{schedule_id}", response_model=ScheduleResponsibilityResponse)
async def update_schedule_responsibilities(
    schedule_id: int,
    update: ResponsibilityUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update responsibility assignments for a schedule (replaces all)"""
    household_id = await check_household_member(db, current_user, schedule_id=schedule_id)

    # Verify all user_ids are in the household
    if household_id:
        for user_id in update.user_ids:
            member_check = await db.execute(
                select(household_members).where(
                    household_members.c.household_id == household_id,
                    household_members.c.user_id == user_id
                )
            )
            if not member_check.first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User {user_id} is not in the household"
                )

    # Delete all existing assignments
    await db.execute(
        delete(ScheduleResponsibility).where(ScheduleResponsibility.schedule_id == schedule_id)
    )

    # Create new assignments
    new_assignments = []
    for user_id in update.user_ids:
        assignment = ScheduleResponsibility(
            schedule_id=schedule_id,
            user_id=user_id,
            assigned_by_user_id=current_user.id
        )
        db.add(assignment)
        new_assignments.append(assignment)

    await db.commit()

    # Refresh all to get assigned_at timestamps
    for assignment in new_assignments:
        await db.refresh(assignment)

    return ScheduleResponsibilityResponse(
        schedule_id=schedule_id,
        assignments=[
            ResponsibilityAssignment(
                user_id=a.user_id,
                assigned_at=a.assigned_at,
                assigned_by_user_id=a.assigned_by_user_id
            ) for a in new_assignments
        ],
        inherits_from_reptile=len(new_assignments) == 0
    )


@router.delete("/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def clear_schedule_responsibilities(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear all responsibility assignments for a schedule (inherit from reptile)"""
    await check_household_member(db, current_user, schedule_id=schedule_id)

    await db.execute(
        delete(ScheduleResponsibility).where(ScheduleResponsibility.schedule_id == schedule_id)
    )
    await db.commit()
    return None


@router.get("/overview", response_model=HouseholdResponsibilityOverview)
async def get_household_responsibility_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get overview of responsibility assignments for current household"""
    # Get user's household(s)
    household_result = await db.execute(
        select(household_members.c.household_id)
        .where(household_members.c.user_id == current_user.id)
    )
    household_ids = [row[0] for row in household_result.all()]

    if not household_ids:
        # User not in any household
        return HouseholdResponsibilityOverview(
            is_single_user=True,
            reptiles={}
        )

    # For simplicity, use first household (most users have one)
    household_id = household_ids[0]

    # Count household members
    member_count_result = await db.execute(
        select(household_members)
        .where(household_members.c.household_id == household_id)
    )
    member_count = len(member_count_result.all())

    # Get all reptiles in household
    reptiles_result = await db.execute(
        select(Reptile.id)
        .where(Reptile.household_id == household_id)
    )
    reptile_ids = [row[0] for row in reptiles_result.all()]

    # Get all responsibility assignments for these reptiles
    responsibilities_result = await db.execute(
        select(ReptileResponsibility)
        .where(ReptileResponsibility.reptile_id.in_(reptile_ids))
    )
    all_responsibilities = responsibilities_result.scalars().all()

    # Group by reptile_id
    reptiles_dict: Dict[int, ReptileResponsibilityResponse] = {}
    for reptile_id in reptile_ids:
        assignments = [r for r in all_responsibilities if r.reptile_id == reptile_id]
        reptiles_dict[reptile_id] = ReptileResponsibilityResponse(
            reptile_id=reptile_id,
            assignments=[
                ResponsibilityAssignment(
                    user_id=a.user_id,
                    assigned_at=a.assigned_at,
                    assigned_by_user_id=a.assigned_by_user_id
                ) for a in assignments
            ],
            is_unassigned=len(assignments) == 0
        )

    return HouseholdResponsibilityOverview(
        is_single_user=(member_count == 1),
        reptiles=reptiles_dict
    )


@router.delete("/reptiles/{reptile_id}/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def self_remove_from_reptile(
    reptile_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Self-remove from shared responsibility for a reptile"""
    # User can only remove themselves
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only remove yourself from responsibilities"
        )

    await check_household_member(db, current_user, reptile_id=reptile_id)

    # Delete the assignment
    result = await db.execute(
        delete(ReptileResponsibility).where(
            ReptileResponsibility.reptile_id == reptile_id,
            ReptileResponsibility.user_id == user_id
        )
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    await db.commit()
    return None
