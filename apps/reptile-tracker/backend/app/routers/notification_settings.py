from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import NotificationSettings, User, NotificationType
from app.auth import get_current_user
from app.schemas import NotificationSettingsSchema, NotificationSettingsUpdate
from app.notifications import validate_webhook_url, send_webhook_notification
from app.notification_utils import ensure_in_app_channel
from app.scheduler import create_in_app_notification

router = APIRouter(prefix="/api/notification-settings", tags=["notification-settings"])


@router.get("/me", response_model=Optional[NotificationSettingsSchema])
async def get_my_notification_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's notification settings"""
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    settings = result.scalars().first()
    return settings


@router.post("/me", response_model=NotificationSettingsSchema)
async def create_or_update_notification_settings(
    settings_data: NotificationSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create or update current user's notification settings"""

    # Validate webhook URL if enabled
    if settings_data.webhook_enabled and settings_data.webhook_url:
        if not validate_webhook_url(settings_data.webhook_url):
            raise HTTPException(
                status_code=400,
                detail="Invalid webhook URL. URL must use HTTP/HTTPS and cannot target private networks."
            )

    # Check if settings already exist
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    settings = result.scalars().first()

    if settings:
        # Update existing settings
        for key, value in settings_data.model_dump(exclude_unset=True).items():
            setattr(settings, key, value)
    else:
        # Create new settings
        settings = NotificationSettings(
            user_id=current_user.id,
            **settings_data.model_dump(exclude_unset=True)
        )
        db.add(settings)
        await db.flush()
        # Ensure in-app channel exists for new settings
        await ensure_in_app_channel(db, settings.id)

    await db.commit()
    await db.refresh(settings)
    return settings


@router.delete("/me")
async def delete_notification_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete current user's notification settings"""
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    settings = result.scalars().first()

    if not settings:
        raise HTTPException(status_code=404, detail="Notification settings not found")

    await db.delete(settings)
    await db.commit()
    return {"message": "Notification settings deleted successfully"}


class TestNotificationRequest(BaseModel):
    webhook_url: Optional[str] = None
    webhook_type: str
    config: Optional[dict] = None


@router.post("/test")
async def test_notification(
    test_data: TestNotificationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a test notification to verify webhook configuration"""
    # Validate webhook URL for discord/generic
    if test_data.webhook_type in ["discord", "generic"]:
        if not test_data.webhook_url or not validate_webhook_url(test_data.webhook_url):
            raise HTTPException(
                status_code=400,
                detail="Invalid webhook URL. URL must use HTTP/HTTPS and cannot target private networks."
            )

    # Validate config for pushover
    if test_data.webhook_type == "pushover":
        if not test_data.config:
            raise HTTPException(
                status_code=400,
                detail="Pushover requires config with api_key and user_key"
            )
        if not test_data.config.get("api_key") or not test_data.config.get("user_key"):
            raise HTTPException(
                status_code=400,
                detail="Pushover config must include api_key and user_key"
            )

    # Send test notification with sample data to show what a real notification looks like
    try:
        # Create sample context that mimics a real schedule reminder
        from datetime import datetime, timezone

        sample_context = {
            "reptile_name": "Example Reptile",
            "schedule_name": "Morning Feeding",
            "schedule_type": "feeding",
            "emoji": "🍽️",
            "time_window_display": "09:00 - 18:00",
            "food_category": "Insects/Worms",
            "supplement_name": "Calcium with D3",  # Shows for supplement schedules
            "notes": "This is a test notification sent by " + current_user.name,
            "scheduled_date": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
            "due_date": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        }

        # Handle in-app notifications separately
        if test_data.webhook_type == "in_app":
            await create_in_app_notification(
                db=db,
                user=current_user,
                notification_type=NotificationType.SCHEDULE_REMINDER,
                title="Test Notification - Example Reptile",
                message=f"Test notification from Reptile Tracker! This is an example of a schedule reminder for Morning Feeding. Sent by {current_user.name}.",
                link="/calendar",
                notification_metadata=sample_context
            )
        else:
            await send_webhook_notification(
                webhook_url=test_data.webhook_url,
                webhook_type=test_data.webhook_type,
                message=f"Test notification from Reptile Tracker! Sent by {current_user.name}.",
                title="Schedule Reminder - Example Reptile",
                config=test_data.config,
                context=sample_context,
                trigger_type="schedule_reminder"
            )
        return {"message": "Test notification sent successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send test notification: {str(e)}"
        )
