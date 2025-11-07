"""
Supplement Rotation Templates API Router

Provides operations for browsing and applying supplement rotation templates.
Templates can be filtered by species, age category, and UVB lighting.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.auth import get_current_user
from app.models import User, SupplementRotationTemplate, FeedingRotation, Reptile
from app.schemas import (
    SupplementRotationTemplate as SupplementRotationTemplateSchema,
    SupplementRotationTemplateWithDetails,
    FeedingRotation as FeedingRotationSchema,
)
from app.permissions import check_reptile_access, AccessLevel


router = APIRouter(prefix="/api/supplement-rotation-templates", tags=["supplement-rotation-templates"])


@router.get("", response_model=List[SupplementRotationTemplateWithDetails])
async def list_supplement_rotation_templates(
    species: Optional[str] = None,
    age_category: Optional[str] = None,
    uvb_lighting: Optional[bool] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all supplement rotation templates with optional filtering.
    Only returns default templates (user-created templates not supported yet).
    """
    conditions = [SupplementRotationTemplate.is_default == True]

    if species:
        # Match species or templates that apply to all species (null)
        conditions.append(
            or_(
                SupplementRotationTemplate.species == species,
                SupplementRotationTemplate.species.is_(None)
            )
        )

    if age_category:
        # Match age category or templates that apply to all ages (null)
        conditions.append(
            or_(
                SupplementRotationTemplate.age_category == age_category,
                SupplementRotationTemplate.age_category.is_(None)
            )
        )

    if uvb_lighting is not None:
        # Match UVB requirement or templates that work with either (null)
        conditions.append(
            or_(
                SupplementRotationTemplate.uvb_lighting == uvb_lighting,
                SupplementRotationTemplate.uvb_lighting.is_(None)
            )
        )

    query = select(SupplementRotationTemplate).where(
        and_(*conditions)
    ).options(
        selectinload(SupplementRotationTemplate.supplement)
    ).order_by(
        SupplementRotationTemplate.species,
        SupplementRotationTemplate.age_category,
        SupplementRotationTemplate.priority
    )

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{template_id}", response_model=SupplementRotationTemplateWithDetails)
async def get_supplement_rotation_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific supplement rotation template by ID."""
    result = await db.execute(
        select(SupplementRotationTemplate)
        .where(SupplementRotationTemplate.id == template_id)
        .options(selectinload(SupplementRotationTemplate.supplement))
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplement rotation template not found"
        )

    return template


@router.post("/apply", response_model=List[FeedingRotationSchema])
async def apply_supplement_rotation_templates(
    reptile_id: int,
    template_ids: List[int],
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Apply supplement rotation templates to a reptile.
    Creates FeedingRotation records based on the templates.
    """
    # Check reptile access
    await check_reptile_access(db, user, reptile_id, AccessLevel.CARETAKER)

    # Verify reptile exists
    reptile_result = await db.execute(
        select(Reptile).where(Reptile.id == reptile_id)
    )
    reptile = reptile_result.scalar_one_or_none()
    if not reptile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reptile not found"
        )

    # Fetch templates
    templates_result = await db.execute(
        select(SupplementRotationTemplate).where(
            SupplementRotationTemplate.id.in_(template_ids)
        )
    )
    templates = templates_result.scalars().all()

    if len(templates) != len(template_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more templates not found"
        )

    # Check if rotations already exist for this reptile and supplements
    existing_rotations_result = await db.execute(
        select(FeedingRotation).where(
            and_(
                FeedingRotation.reptile_id == reptile_id,
                FeedingRotation.supplement_id.in_([t.supplement_id for t in templates])
            )
        )
    )
    existing_rotations = existing_rotations_result.scalars().all()
    existing_supplement_ids = {r.supplement_id for r in existing_rotations}

    # Create new rotations from templates
    created_rotations = []
    for template in templates:
        # Skip if rotation already exists for this supplement
        if template.supplement_id in existing_supplement_ids:
            continue

        new_rotation = FeedingRotation(
            reptile_id=reptile_id,
            rotation_type="supplement",
            supplement_id=template.supplement_id,
            trigger_mode=template.trigger_mode,
            every_n_feedings=template.every_n_feedings,
            counting_mode=template.counting_mode,
            schedule_days_of_week=template.schedule_days_of_week,
            schedule_frequency_days=template.schedule_frequency_days,
            applies_to_category=template.applies_to_category,
            application_mode=template.application_mode,
            priority=template.priority,
            is_exclusive=template.is_exclusive,
            enabled=True,
            notes=template.notes,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(new_rotation)
        created_rotations.append(new_rotation)

    await db.commit()

    # Refresh to get IDs
    for rotation in created_rotations:
        await db.refresh(rotation)

    return created_rotations


@router.get("/match/{reptile_id}", response_model=List[SupplementRotationTemplateWithDetails])
async def get_matching_templates_for_reptile(
    reptile_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get supplement rotation templates that match a specific reptile's
    species, age category, and UVB lighting setup.
    """
    # Check reptile access
    await check_reptile_access(db, user, reptile_id, AccessLevel.VIEWER)

    # Get reptile details
    reptile_result = await db.execute(
        select(Reptile).where(Reptile.id == reptile_id)
    )
    reptile = reptile_result.scalar_one_or_none()

    if not reptile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reptile not found"
        )

    # Build conditions
    conditions = [SupplementRotationTemplate.is_default == True]

    # Match species or null (applies to all)
    if reptile.species:
        conditions.append(
            or_(
                SupplementRotationTemplate.species == reptile.species,
                SupplementRotationTemplate.species.is_(None)
            )
        )

    # Match age category or null (applies to all)
    if reptile.age_category:
        conditions.append(
            or_(
                SupplementRotationTemplate.age_category == reptile.age_category,
                SupplementRotationTemplate.age_category.is_(None)
            )
        )

    # Match UVB lighting or null (works with either)
    if reptile.has_uvb is not None:
        conditions.append(
            or_(
                SupplementRotationTemplate.uvb_lighting == reptile.has_uvb,
                SupplementRotationTemplate.uvb_lighting.is_(None)
            )
        )

    query = select(SupplementRotationTemplate).where(
        and_(*conditions)
    ).options(
        selectinload(SupplementRotationTemplate.supplement)
    ).order_by(
        SupplementRotationTemplate.priority,
        SupplementRotationTemplate.name
    )

    result = await db.execute(query)
    return result.scalars().all()
