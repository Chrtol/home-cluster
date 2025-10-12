from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.permissions import require_authenticated_user

router = APIRouter(prefix="/api/households", tags=["households"])


@router.post("/", response_model=schemas.HouseholdOut)
async def create_household(payload: schemas.HouseholdCreate, db: Session = Depends(get_db), user=Depends(require_authenticated_user)):
    # Create household and add creator as owner
    household = models.Household(name=payload.name)
    db.add(household)
    db.flush()

    # add membership
    stmt = models.household_members.insert().values(household_id=household.id, user_id=user.id, access_level=models.AccessLevel.OWNER)
    db.execute(stmt)
    db.commit()
    db.refresh(household)
    return household


@router.get("/me", response_model=list[schemas.HouseholdOut])
async def get_my_households(db: Session = Depends(get_db), user=Depends(require_authenticated_user)):
    # Return households the user belongs to
    return user.households
