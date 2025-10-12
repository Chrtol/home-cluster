from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert
from app.database import get_db
from app import models, schemas
from app.permissions import require_authenticated_user

router = APIRouter(prefix="/api/households", tags=["households"])


@router.post("/", response_model=schemas.HouseholdOut)
async def create_household(payload: schemas.HouseholdCreate, db: AsyncSession = Depends(get_db), user=Depends(require_authenticated_user)):
    # Create household and add creator as owner
    household = models.Household(name=payload.name)
    db.add(household)
    await db.flush()

    # add membership
    stmt = insert(models.household_members).values(household_id=household.id, user_id=user.id, access_level=models.AccessLevel.OWNER)
    await db.execute(stmt)
    await db.commit()
    await db.refresh(household)
    return household


@router.get("/me", response_model=list[schemas.HouseholdOut])
async def get_my_households(db: AsyncSession = Depends(get_db), user=Depends(require_authenticated_user)):
    # Return households the user belongs to (need to eagerly load)
    result = await db.execute(
        select(models.User).where(models.User.id == user.id)
    )
    user_with_households = result.scalar_one()
    return user_with_households.households
