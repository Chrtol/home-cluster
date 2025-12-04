"""Utility functions for notification management"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.models import NotificationChannel


async def ensure_in_app_channel(db: AsyncSession, settings_id: int):
    """Ensure in-app notification channel exists for the given notification settings

    Args:
        db: Database session
        settings_id: ID of the NotificationSettings record
    """
    # Check if in-app channel already exists
    result = await db.execute(
        select(NotificationChannel).where(
            NotificationChannel.notification_settings_id == settings_id,
            NotificationChannel.webhook_type == "in_app"
        )
    )
    existing_channel = result.scalars().first()

    if not existing_channel:
        # Create in-app channel
        in_app_channel = NotificationChannel(
            notification_settings_id=settings_id,
            name="In-App Notifications",
            webhook_type="in_app",
            enabled=True,
            household_wide=False,
            is_system=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(in_app_channel)
        await db.flush()
