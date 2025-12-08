from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models import TemplateGroup, User, NotificationTemplate
from app.auth import get_current_user
from app.schemas import (
    TemplateGroup as TemplateGroupSchema,
    TemplateGroupCreate,
    TemplateGroupUpdate
)

router = APIRouter(prefix="/api/template-groups", tags=["template-groups"])


@router.get("/", response_model=List[TemplateGroupSchema])
async def list_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all template groups for the current user
    """
    result = await db.execute(
        select(TemplateGroup)
        .where(TemplateGroup.user_id == current_user.id)
        .order_by(TemplateGroup.sort_order, TemplateGroup.name)
    )
    groups = result.scalars().all()
    return groups


@router.get("/{group_id}", response_model=TemplateGroupSchema)
async def get_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific template group"""
    result = await db.execute(
        select(TemplateGroup).where(TemplateGroup.id == group_id)
    )
    group = result.scalars().first()

    if not group:
        raise HTTPException(status_code=404, detail="Template group not found")

    # Check access: user can only access their own groups
    if group.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return group


@router.post("/", response_model=TemplateGroupSchema)
async def create_group(
    group_data: TemplateGroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new template group"""
    # Check for duplicate group name for this user
    existing = await db.execute(
        select(TemplateGroup).where(
            TemplateGroup.user_id == current_user.id,
            TemplateGroup.name == group_data.name
        )
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=400,
            detail=f"You already have a template group named '{group_data.name}'"
        )

    # Validate default_channel_ids if provided
    if group_data.default_channel_ids:
        from app.models import NotificationChannel
        result = await db.execute(
            select(NotificationChannel).where(
                NotificationChannel.id.in_(group_data.default_channel_ids)
            )
        )
        channels = result.scalars().all()
        if len(channels) != len(group_data.default_channel_ids):
            raise HTTPException(
                status_code=400,
                detail="One or more channel IDs are invalid"
            )

    # Create the group
    new_group = TemplateGroup(
        user_id=current_user.id,
        **group_data.model_dump()
    )
    db.add(new_group)
    await db.commit()
    await db.refresh(new_group)

    return new_group


@router.put("/{group_id}", response_model=TemplateGroupSchema)
async def update_group(
    group_id: int,
    group_data: TemplateGroupUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an existing template group"""
    # Get the group
    result = await db.execute(
        select(TemplateGroup).where(TemplateGroup.id == group_id)
    )
    group = result.scalars().first()

    if not group:
        raise HTTPException(status_code=404, detail="Template group not found")

    # Check access
    if group.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check for duplicate name if name is being changed
    if group_data.name and group_data.name != group.name:
        existing = await db.execute(
            select(TemplateGroup).where(
                TemplateGroup.user_id == current_user.id,
                TemplateGroup.name == group_data.name,
                TemplateGroup.id != group_id
            )
        )
        if existing.scalars().first():
            raise HTTPException(
                status_code=400,
                detail=f"You already have a template group named '{group_data.name}'"
            )

    # Validate default_channel_ids if provided
    if group_data.default_channel_ids is not None:
        from app.models import NotificationChannel
        result = await db.execute(
            select(NotificationChannel).where(
                NotificationChannel.id.in_(group_data.default_channel_ids)
            )
        )
        channels = result.scalars().all()
        if len(channels) != len(group_data.default_channel_ids):
            raise HTTPException(
                status_code=400,
                detail="One or more channel IDs are invalid"
            )

    # Update fields
    update_data = group_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)

    await db.commit()
    await db.refresh(group)

    return group


@router.delete("/{group_id}")
async def delete_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a template group (templates in group will have group_id set to NULL)"""
    # Get the group
    result = await db.execute(
        select(TemplateGroup).where(TemplateGroup.id == group_id)
    )
    group = result.scalars().first()

    if not group:
        raise HTTPException(status_code=404, detail="Template group not found")

    # Check access
    if group.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Delete the group (templates will have group_id set to NULL due to ondelete='SET NULL')
    await db.delete(group)
    await db.commit()

    return {"message": "Template group deleted successfully"}


@router.get("/{group_id}/templates", response_model=List)
async def get_group_templates(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all templates in a specific group"""
    # Get the group
    result = await db.execute(
        select(TemplateGroup).where(TemplateGroup.id == group_id)
    )
    group = result.scalars().first()

    if not group:
        raise HTTPException(status_code=404, detail="Template group not found")

    # Check access
    if group.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get templates
    from app.schemas import NotificationTemplate as NotificationTemplateSchema
    result = await db.execute(
        select(NotificationTemplate)
        .where(NotificationTemplate.group_id == group_id)
        .order_by(NotificationTemplate.name)
    )
    templates = result.scalars().all()

    return templates
