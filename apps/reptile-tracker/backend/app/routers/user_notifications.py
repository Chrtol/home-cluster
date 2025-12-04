from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, update
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.models import UserNotification, User
from app.auth import get_current_user
from app.schemas import (
    UserNotification as UserNotificationSchema,
    UserNotificationCreate,
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=List[UserNotificationSchema])
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    is_read: Optional[bool] = None,
    notification_type: Optional[str] = None,
    limit: int = Query(50, le=100),
    offset: int = 0,
):
    """
    List user notifications with optional filtering.

    Query parameters:
    - is_read: Filter by read status (true/false)
    - notification_type: Filter by notification type
    - limit: Maximum number of notifications to return (default 50, max 100)
    - offset: Number of notifications to skip for pagination
    """
    query = select(UserNotification).where(
        UserNotification.user_id == current_user.id
    )

    if is_read is not None:
        query = query.where(UserNotification.is_read == is_read)

    if notification_type:
        query = query.where(UserNotification.notification_type == notification_type)

    query = query.order_by(UserNotification.created_at.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    notifications = result.scalars().all()

    return notifications


@router.get("/unread-count", response_model=dict)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the count of unread notifications for the current user."""
    result = await db.execute(
        select(func.count(UserNotification.id)).where(
            and_(
                UserNotification.user_id == current_user.id,
                UserNotification.is_read == False,
            )
        )
    )
    count = result.scalar()

    return {"unread_count": count}


@router.post("/{notification_id}/mark-read", response_model=UserNotificationSchema)
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read."""
    result = await db.execute(
        select(UserNotification).where(
            and_(
                UserNotification.id == notification_id,
                UserNotification.user_id == current_user.id,
            )
        )
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(notification)

    return notification


@router.post("/mark-all-read", response_model=dict)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all unread notifications as read for the current user."""
    await db.execute(
        update(UserNotification)
        .where(
            and_(
                UserNotification.user_id == current_user.id,
                UserNotification.is_read == False,
            )
        )
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    await db.commit()

    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a notification."""
    result = await db.execute(
        select(UserNotification).where(
            and_(
                UserNotification.id == notification_id,
                UserNotification.user_id == current_user.id,
            )
        )
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    await db.delete(notification)
    await db.commit()

    return {"message": "Notification deleted successfully"}


@router.delete("")
async def delete_all_read_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all read notifications for the current user."""
    result = await db.execute(
        select(UserNotification).where(
            and_(
                UserNotification.user_id == current_user.id,
                UserNotification.is_read == True,
            )
        )
    )
    notifications = result.scalars().all()

    for notification in notifications:
        await db.delete(notification)

    await db.commit()

    return {"message": f"Deleted {len(notifications)} read notifications"}
