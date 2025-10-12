from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, update
from datetime import datetime, timezone
import secrets

from app.database import get_db
from app import models, schemas
from app.permissions import require_authenticated_user

router = APIRouter(prefix="/api/invitations", tags=["invitations"])


@router.post("/", response_model=schemas.InvitationOut)
async def create_invitation(payload: schemas.InvitationCreate, db: Session = Depends(get_db), user=Depends(require_authenticated_user)):
    # Only household owners can create invites - simple check
    household = db.get(models.Household, payload.household_id)
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")

    # Verify user is owner
    owner_row = db.execute(select(models.household_members).where(models.household_members.c.household_id == household.id, models.household_members.c.user_id == user.id)).first()
    if not owner_row or owner_row[0].access_level != models.AccessLevel.OWNER:
        raise HTTPException(status_code=403, detail="Only household owners can create invitations")

    code = payload.code or secrets.token_urlsafe(16)
    invitation = models.Invitation(code=code, household_id=household.id, created_by=user.id, expires_at=payload.expires_at, max_uses=payload.max_uses)
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation


@router.post("/accept")
async def accept_invitation(payload: schemas.InvitationAccept, db: Session = Depends(get_db), user=Depends(require_authenticated_user)):
    # Validate invitation
    inv = db.execute(select(models.Invitation).where(models.Invitation.code == payload.code)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")

    now = datetime.now(timezone.utc)
    if inv.expires_at and inv.expires_at < now:
        raise HTTPException(status_code=400, detail="Invitation expired")
    if inv.max_uses and inv.used_count >= inv.max_uses:
        raise HTTPException(status_code=400, detail="Invitation already used")

    # Add user to household
    stmt = models.household_members.insert().values(household_id=inv.household_id, user_id=user.id, access_level=models.AccessLevel.FEEDER)
    db.execute(stmt)

    # Increment usage
    db.execute(update(models.Invitation).where(models.Invitation.id == inv.id).values(used_count=inv.used_count + 1))
    db.commit()

    return {"status": "joined", "household_id": inv.household_id}


@router.get("/household/{household_id}", response_model=list[schemas.InvitationOut])
async def list_invitations(household_id: int, db: Session = Depends(get_db), user=Depends(require_authenticated_user)):
    # Simple permission: only members can list
    member = db.execute(select(models.household_members).where(models.household_members.c.household_id == household_id, models.household_members.c.user_id == user.id)).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of household")

    rows = db.execute(select(models.Invitation).where(models.Invitation.household_id == household_id)).scalars().all()
    return rows
