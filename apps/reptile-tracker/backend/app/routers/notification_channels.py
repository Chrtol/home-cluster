from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models import User, NotificationSettings, NotificationChannel
from app.schemas import (
    NotificationChannel as NotificationChannelSchema,
    NotificationChannelCreate,
    NotificationChannelUpdate,
)
from app.auth import get_current_user

router = APIRouter()


@router.get("/me", response_model=List[NotificationChannelSchema])
async def get_my_channels(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all notification channels for the current user"""
    # Get or create notification settings
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    settings = result.scalars().first()

    if not settings:
        # Return empty list if no settings exist
        return []

    # Get all channels for this settings
    result = await db.execute(
        select(NotificationChannel)
        .where(NotificationChannel.notification_settings_id == settings.id)
        .order_by(NotificationChannel.created_at)
    )
    channels = result.scalars().all()

    return channels


@router.post("", response_model=NotificationChannelSchema, status_code=201)
async def create_channel(
    channel_data: NotificationChannelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new notification channel"""
    # Get or create notification settings
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    settings = result.scalars().first()

    if not settings:
        # Create settings if they don't exist
        settings = NotificationSettings(user_id=current_user.id)
        db.add(settings)
        await db.flush()

    # Create the channel
    channel = NotificationChannel(
        notification_settings_id=settings.id,
        **channel_data.dict()
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)

    return channel


@router.patch("/{channel_id}", response_model=NotificationChannelSchema)
async def update_channel(
    channel_id: int,
    channel_data: NotificationChannelUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a notification channel"""
    # Get the channel and verify ownership
    result = await db.execute(
        select(NotificationChannel)
        .join(NotificationSettings)
        .where(
            NotificationChannel.id == channel_id,
            NotificationSettings.user_id == current_user.id
        )
    )
    channel = result.scalars().first()

    if not channel:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    # Update fields
    for field, value in channel_data.dict(exclude_unset=True).items():
        setattr(channel, field, value)

    await db.commit()
    await db.refresh(channel)

    return channel


@router.delete("/{channel_id}", status_code=204)
async def delete_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a notification channel"""
    # Get the channel and verify ownership
    result = await db.execute(
        select(NotificationChannel)
        .join(NotificationSettings)
        .where(
            NotificationChannel.id == channel_id,
            NotificationSettings.user_id == current_user.id
        )
    )
    channel = result.scalars().first()

    if not channel:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    await db.delete(channel)
    await db.commit()

    return None
