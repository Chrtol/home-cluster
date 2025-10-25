"""
Schedule Templates API Router

Provides CRUD operations for reusable schedule templates and care guidelines.
Templates can be species-specific, age-specific, and can be duplicated/customized.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.auth import get_current_user
from app.models import User, ScheduleTemplate, CareGuideline, Schedule, Reptile
from app.schemas import (
    ScheduleTemplateCreate,
    ScheduleTemplateUpdate,
    ScheduleTemplate as ScheduleTemplateSchema,
    ScheduleTemplateWithDetails,
    ScheduleTemplateExport,
    CareGuidelineCreate,
    CareGuidelineUpdate,
    CareGuideline as CareGuidelineSchema,
    CareGuidelineExport,
    ScheduleCreate,
)
from app.permissions import check_reptile_access, AccessLevel


router = APIRouter(prefix="/api/schedule-templates", tags=["schedule-templates"])
guidelines_router = APIRouter(prefix="/api/care-guidelines", tags=["care-guidelines"])


# ============================================================================
# SCHEDULE TEMPLATES ENDPOINTS
# ============================================================================

@router.get("", response_model=List[ScheduleTemplateWithDetails])
async def list_schedule_templates(
    species: Optional[str] = None,
    age_category: Optional[str] = None,
    schedule_type: Optional[str] = None,
    include_defaults: bool = True,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all schedule templates with optional filtering.
    Returns both default templates and user-created templates.
    """
    query = select(ScheduleTemplate).options(selectinload(ScheduleTemplate.supplement))

    filters = []

    # Filter by species (null species means "applies to all")
    if species:
        filters.append(or_(ScheduleTemplate.species == species, ScheduleTemplate.species.is_(None)))

    # Filter by age category
    if age_category:
        filters.append(or_(ScheduleTemplate.age_category == age_category, ScheduleTemplate.age_category.is_(None)))

    # Filter by schedule type
    if schedule_type:
        filters.append(ScheduleTemplate.schedule_type == schedule_type)

    # Filter defaults
    if include_defaults:
        # Show defaults OR user's own templates
        filters.append(or_(
            ScheduleTemplate.is_default == True,
            ScheduleTemplate.created_by_user_id == user.id
        ))
    else:
        # Only user's templates
        filters.append(ScheduleTemplate.created_by_user_id == user.id)

    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(
        ScheduleTemplate.is_default.desc(),  # Defaults first
        ScheduleTemplate.species.asc(),
        ScheduleTemplate.age_category.asc(),
        ScheduleTemplate.name.asc()
    )

    result = await db.execute(query)
    templates = result.scalars().all()
    return templates


@router.get("/{template_id}", response_model=ScheduleTemplateWithDetails)
async def get_schedule_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific schedule template by ID."""
    query = select(ScheduleTemplate).options(
        selectinload(ScheduleTemplate.supplement)
    ).where(ScheduleTemplate.id == template_id)

    result = await db.execute(query)
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Schedule template not found")

    # Check access: must be default template or created by user
    if not template.is_default and template.created_by_user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied to this template")

    return template


@router.post("", response_model=ScheduleTemplateSchema, status_code=status.HTTP_201_CREATED)
async def create_schedule_template(
    template: ScheduleTemplateCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new schedule template."""
    db_template = ScheduleTemplate(
        **template.model_dump(),
        created_by_user_id=user.id,
        is_default=False  # User templates are never default
    )

    db.add(db_template)
    await db.commit()
    await db.refresh(db_template)
    return db_template


@router.put("/{template_id}", response_model=ScheduleTemplateSchema)
async def update_schedule_template(
    template_id: int,
    template: ScheduleTemplateUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a schedule template. Only creator can edit non-default templates."""
    query = select(ScheduleTemplate).where(ScheduleTemplate.id == template_id)
    result = await db.execute(query)
    db_template = result.scalar_one_or_none()

    if not db_template:
        raise HTTPException(status_code=404, detail="Schedule template not found")

    # Check permissions: creator can edit, or default templates can be edited by anyone (creates copy)
    if db_template.is_default:
        raise HTTPException(
            status_code=403,
            detail="Cannot modify default templates. Use duplicate endpoint to create a customized copy."
        )

    if db_template.created_by_user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied to this template")

    # Update fields
    update_data = template.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_template, field, value)

    db_template.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(db_template)
    return db_template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a schedule template. Only creator can delete non-default templates."""
    query = select(ScheduleTemplate).where(ScheduleTemplate.id == template_id)
    result = await db.execute(query)
    db_template = result.scalar_one_or_none()

    if not db_template:
        raise HTTPException(status_code=404, detail="Schedule template not found")

    if db_template.is_default:
        raise HTTPException(status_code=403, detail="Cannot delete default templates")

    if db_template.created_by_user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied to this template")

    await db.delete(db_template)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{template_id}/duplicate", response_model=ScheduleTemplateSchema, status_code=status.HTTP_201_CREATED)
async def duplicate_schedule_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Duplicate a schedule template to create a customizable copy.
    This is the recommended way to customize default templates.
    """
    # Get source template
    query = select(ScheduleTemplate).where(ScheduleTemplate.id == template_id)
    result = await db.execute(query)
    source_template = result.scalar_one_or_none()

    if not source_template:
        raise HTTPException(status_code=404, detail="Schedule template not found")

    # Check access
    if not source_template.is_default and source_template.created_by_user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied to this template")

    # Create duplicate
    new_template = ScheduleTemplate(
        name=f"{source_template.name} (Copy)",
        description=source_template.description,
        species=source_template.species,
        age_category=source_template.age_category,
        schedule_type=source_template.schedule_type,
        schedule_rule=source_template.schedule_rule,
        food_category=source_template.food_category,
        time_slot=source_template.time_slot,
        health_category=source_template.health_category,
        frequency_days=source_template.frequency_days,
        days_of_week=source_template.days_of_week,
        day_of_month=source_template.day_of_month,
        earliest_time=source_template.earliest_time,
        latest_time=source_template.latest_time,
        time_window_enabled=source_template.time_window_enabled,
        reminder_minutes_before=source_template.reminder_minutes_before,
        supplement_id=source_template.supplement_id,
        notes=source_template.notes,
        is_default=False,
        created_by_user_id=user.id,
        source_template_id=template_id,
    )

    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)
    return new_template


@router.post("/{template_id}/apply/{reptile_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def apply_template_to_reptile(
    template_id: int,
    reptile_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Apply a schedule template to a specific reptile.
    Creates a new Schedule instance from the template.
    """
    # Get template
    query = select(ScheduleTemplate).where(ScheduleTemplate.id == template_id)
    result = await db.execute(query)
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Schedule template not found")

    # Check template access
    if not template.is_default and template.created_by_user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied to this template")

    # Check reptile access
    access_level = await check_reptile_access(db, reptile_id, user.id)
    if access_level is None or access_level.value < AccessLevel.CARETAKER.value:
        raise HTTPException(status_code=403, detail="Insufficient permissions for this reptile")

    # Create schedule from template
    new_schedule = Schedule(
        reptile_id=reptile_id,
        name=template.name,
        schedule_type=template.schedule_type,
        schedule_rule=template.schedule_rule,
        food_category=template.food_category,
        time_slot=template.time_slot,
        health_category=template.health_category,
        frequency_days=template.frequency_days,
        days_of_week=template.days_of_week,
        day_of_month=template.day_of_month,
        earliest_time=template.earliest_time,
        latest_time=template.latest_time,
        time_window_enabled=template.time_window_enabled,
        reminder_minutes_before=template.reminder_minutes_before,
        supplement_id=template.supplement_id,
        notes=template.notes,
        enabled=True,
    )

    db.add(new_schedule)
    await db.commit()
    await db.refresh(new_schedule)

    return {
        "message": "Template applied successfully",
        "schedule_id": new_schedule.id,
        "template_id": template_id,
        "reptile_id": reptile_id,
    }


@router.get("/export", response_model=ScheduleTemplateExport)
async def export_schedule_templates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export all user's schedule templates as JSON."""
    query = select(ScheduleTemplate).where(
        ScheduleTemplate.created_by_user_id == user.id
    ).order_by(ScheduleTemplate.name)

    result = await db.execute(query)
    templates = result.scalars().all()

    return ScheduleTemplateExport(
        version="1.0",
        exported_at=datetime.now(timezone.utc),
        templates=templates
    )


@router.post("/import", response_model=dict)
async def import_schedule_templates(
    data: ScheduleTemplateExport,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Import schedule templates from JSON export.
    Creates new templates owned by the current user.
    """
    imported_count = 0

    for template_data in data.templates:
        # Create new template (strip ID to create new records)
        new_template = ScheduleTemplate(
            name=template_data.name,
            description=template_data.description,
            species=template_data.species,
            age_category=template_data.age_category,
            schedule_type=template_data.schedule_type,
            schedule_rule=template_data.schedule_rule,
            food_category=template_data.food_category,
            time_slot=template_data.time_slot,
            health_category=template_data.health_category,
            frequency_days=template_data.frequency_days,
            days_of_week=template_data.days_of_week,
            day_of_month=template_data.day_of_month,
            earliest_time=template_data.earliest_time,
            latest_time=template_data.latest_time,
            time_window_enabled=template_data.time_window_enabled,
            reminder_minutes_before=template_data.reminder_minutes_before,
            supplement_id=template_data.supplement_id,
            notes=template_data.notes,
            is_default=False,
            created_by_user_id=user.id,
        )

        db.add(new_template)
        imported_count += 1

    await db.commit()

    return {
        "message": f"Successfully imported {imported_count} schedule templates",
        "count": imported_count
    }


# ============================================================================
# CARE GUIDELINES ENDPOINTS
# ============================================================================

@guidelines_router.get("", response_model=List[CareGuidelineSchema])
async def list_care_guidelines(
    species: Optional[str] = None,
    age_category: Optional[str] = None,
    guideline_type: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all care guidelines with optional filtering."""
    query = select(CareGuideline)

    filters = []

    if species:
        filters.append(CareGuideline.species == species)

    if age_category:
        filters.append(or_(CareGuideline.age_category == age_category, CareGuideline.age_category.is_(None)))

    if guideline_type:
        filters.append(CareGuideline.guideline_type == guideline_type)

    # Show defaults OR user's own guidelines
    filters.append(or_(
        CareGuideline.is_default == True,
        CareGuideline.created_by_user_id == user.id
    ))

    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(
        CareGuideline.is_default.desc(),
        CareGuideline.species.asc(),
        CareGuideline.guideline_type.asc()
    )

    result = await db.execute(query)
    guidelines = result.scalars().all()
    return guidelines


@guidelines_router.get("/{guideline_id}", response_model=CareGuidelineSchema)
async def get_care_guideline(
    guideline_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific care guideline by ID."""
    query = select(CareGuideline).where(CareGuideline.id == guideline_id)
    result = await db.execute(query)
    guideline = result.scalar_one_or_none()

    if not guideline:
        raise HTTPException(status_code=404, detail="Care guideline not found")

    if not guideline.is_default and guideline.created_by_user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied to this guideline")

    return guideline


@guidelines_router.post("", response_model=CareGuidelineSchema, status_code=status.HTTP_201_CREATED)
async def create_care_guideline(
    guideline: CareGuidelineCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new care guideline."""
    db_guideline = CareGuideline(
        **guideline.model_dump(),
        created_by_user_id=user.id,
        is_default=False
    )

    db.add(db_guideline)
    await db.commit()
    await db.refresh(db_guideline)
    return db_guideline


@guidelines_router.put("/{guideline_id}", response_model=CareGuidelineSchema)
async def update_care_guideline(
    guideline_id: int,
    guideline: CareGuidelineUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a care guideline. Only creator can edit."""
    query = select(CareGuideline).where(CareGuideline.id == guideline_id)
    result = await db.execute(query)
    db_guideline = result.scalar_one_or_none()

    if not db_guideline:
        raise HTTPException(status_code=404, detail="Care guideline not found")

    if db_guideline.is_default:
        raise HTTPException(status_code=403, detail="Cannot modify default guidelines")

    if db_guideline.created_by_user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied to this guideline")

    update_data = guideline.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_guideline, field, value)

    db_guideline.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(db_guideline)
    return db_guideline


@guidelines_router.delete("/{guideline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_care_guideline(
    guideline_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a care guideline. Only creator can delete."""
    query = select(CareGuideline).where(CareGuideline.id == guideline_id)
    result = await db.execute(query)
    db_guideline = result.scalar_one_or_none()

    if not db_guideline:
        raise HTTPException(status_code=404, detail="Care guideline not found")

    if db_guideline.is_default:
        raise HTTPException(status_code=403, detail="Cannot delete default guidelines")

    if db_guideline.created_by_user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied to this guideline")

    await db.delete(db_guideline)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@guidelines_router.get("/export", response_model=CareGuidelineExport)
async def export_care_guidelines(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export all user's care guidelines as JSON."""
    query = select(CareGuideline).where(
        CareGuideline.created_by_user_id == user.id
    ).order_by(CareGuideline.species, CareGuideline.guideline_type)

    result = await db.execute(query)
    guidelines = result.scalars().all()

    return CareGuidelineExport(
        version="1.0",
        exported_at=datetime.now(timezone.utc),
        guidelines=guidelines
    )


@guidelines_router.post("/import", response_model=dict)
async def import_care_guidelines(
    data: CareGuidelineExport,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import care guidelines from JSON export."""
    imported_count = 0

    for guideline_data in data.guidelines:
        new_guideline = CareGuideline(
            species=guideline_data.species,
            age_category=guideline_data.age_category,
            guideline_type=guideline_data.guideline_type,
            title=guideline_data.title,
            content=guideline_data.content,
            recommendations=guideline_data.recommendations,
            source_name=guideline_data.source_name,
            source_url=guideline_data.source_url,
            is_default=False,
            created_by_user_id=user.id,
        )

        db.add(new_guideline)
        imported_count += 1

    await db.commit()

    return {
        "message": f"Successfully imported {imported_count} care guidelines",
        "count": imported_count
    }
