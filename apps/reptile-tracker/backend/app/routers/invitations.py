from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, insert, delete
from datetime import datetime, timezone
import secrets

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/api/invitations", tags=["invitations"])


@router.post("", response_model=schemas.InvitationOut)
async def create_invitation(payload: schemas.InvitationCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    # Only household owners and admins can create invites
    household = await db.get(models.Household, payload.household_id)
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")

    # Verify user is owner or admin
    member_result = await db.execute(select(models.household_members).where(models.household_members.c.household_id == household.id, models.household_members.c.user_id == user.id))
    member_row = member_result.first()
    if not member_row or member_row.access_level not in [models.AccessLevel.OWNER.value, models.AccessLevel.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Only household owners and admins can create invitations")

    code = payload.code or secrets.token_urlsafe(16)
    invitation = models.Invitation(code=code, household_id=household.id, created_by=user.id, expires_at=payload.expires_at, max_uses=payload.max_uses)
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    return invitation


@router.post("/accept")
async def accept_invitation(payload: schemas.InvitationAccept, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    # Validate invitation
    result = await db.execute(select(models.Invitation).where(models.Invitation.code == payload.code))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")

    now = datetime.now(timezone.utc)
    if inv.expires_at and inv.expires_at < now:
        raise HTTPException(status_code=400, detail="Invitation expired")
    if inv.max_uses and inv.used_count >= inv.max_uses:
        raise HTTPException(status_code=400, detail="Invitation already used")

    # Check if user is already a member
    existing_member = await db.execute(
        select(models.household_members).where(
            models.household_members.c.household_id == inv.household_id,
            models.household_members.c.user_id == user.id
        )
    )
    if existing_member.first():
        raise HTTPException(status_code=400, detail="You are already a member of this household")

    # Add user to household
    stmt = insert(models.household_members).values(household_id=inv.household_id, user_id=user.id, access_level=models.AccessLevel.CARETAKER)
    await db.execute(stmt)

    # Increment usage
    await db.execute(update(models.Invitation).where(models.Invitation.id == inv.id).values(used_count=inv.used_count + 1))
    await db.commit()

    return {"status": "joined", "household_id": inv.household_id}


@router.get("/household/{household_id}", response_model=list[schemas.InvitationOut])
async def list_invitations(household_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    # Simple permission: only members can list
    member_result = await db.execute(select(models.household_members).where(models.household_members.c.household_id == household_id, models.household_members.c.user_id == user.id))
    member = member_result.first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of household")

    result = await db.execute(select(models.Invitation).where(models.Invitation.household_id == household_id))
    rows = result.scalars().all()
    return rows


@router.delete("/{invitation_id}")
async def delete_invitation(invitation_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Delete/revoke an invitation (owner or admin only)"""
    # Get invitation
    result = await db.execute(select(models.Invitation).where(models.Invitation.id == invitation_id))
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    # Check if user is owner or admin of the household
    member_result = await db.execute(
        select(models.household_members).where(
            models.household_members.c.household_id == invitation.household_id,
            models.household_members.c.user_id == user.id
        )
    )
    member_row = member_result.first()
    if not member_row or member_row.access_level not in [models.AccessLevel.OWNER.value, models.AccessLevel.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Only household owners and admins can delete invitations")

    # Delete invitation
    await db.execute(delete(models.Invitation).where(models.Invitation.id == invitation_id))
    await db.commit()

    return {"status": "deleted", "invitation_id": invitation_id}
