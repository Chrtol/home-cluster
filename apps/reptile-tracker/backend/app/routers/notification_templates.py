from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List

from app.database import get_db
from app.models import NotificationTemplate, User
from app.auth import get_current_user
from app.schemas import (
    NotificationTemplate as NotificationTemplateSchema,
    NotificationTemplateCreate,
    NotificationTemplateUpdate
)

router = APIRouter(prefix="/api/notification-templates", tags=["notification-templates"])


@router.get("/", response_model=List[NotificationTemplateSchema])
async def list_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all available templates (system templates + user's custom templates)
    """
    result = await db.execute(
        select(NotificationTemplate).where(
            or_(
                NotificationTemplate.user_id == current_user.id,
                NotificationTemplate.user_id.is_(None)  # System templates
            )
        ).order_by(
            NotificationTemplate.template_type.desc(),  # System templates first
            NotificationTemplate.trigger_type,
            NotificationTemplate.name
        )
    )
    templates = result.scalars().all()
    return templates


@router.get("/{template_id}", response_model=NotificationTemplateSchema)
async def get_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific template"""
    result = await db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id
        )
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Check access: user can only access their own templates or system templates
    if template.user_id is not None and template.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return template


@router.post("/", response_model=NotificationTemplateSchema)
async def create_template(
    template_data: NotificationTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new custom template"""
    # Create new template (always custom type for user-created templates)
    template = NotificationTemplate(
        user_id=current_user.id,
        template_type="custom",
        **template_data.model_dump()
    )

    db.add(template)
    await db.commit()
    await db.refresh(template)

    return template


@router.patch("/{template_id}", response_model=NotificationTemplateSchema)
async def update_template(
    template_id: int,
    template_data: NotificationTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a custom template"""
    result = await db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id
        )
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Only allow updating user's own custom templates
    if template.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Cannot modify system templates or other users' templates"
        )

    # Update fields
    for key, value in template_data.model_dump(exclude_unset=True).items():
        setattr(template, key, value)

    await db.commit()
    await db.refresh(template)

    return template


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a custom template"""
    result = await db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id
        )
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Only allow deleting user's own custom templates
    if template.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Cannot delete system templates or other users' templates"
        )

    await db.delete(template)
    await db.commit()

    return {"message": "Template deleted successfully"}
