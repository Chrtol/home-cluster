"""
Notification frequency cap tracking for smart notification system.

Provides atomic operations for tracking and enforcing per-reptile daily notification limits.
"""
import logging
from datetime import datetime, timezone, timedelta, date as py_date
from sqlalchemy import select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import NotificationFrequencyTracking, NotificationSettings

logger = logging.getLogger(__name__)


async def is_frequency_cap_reached(
    db: AsyncSession,
    user_id: int,
    reptile_id: int,
    date: py_date
) -> bool:
    """
    Check if frequency cap reached for today.

    Args:
        db: Database session
        user_id: User ID
        reptile_id: Reptile ID
        date: Date to check (user's local date)

    Returns:
        True if cap reached and notification should be suppressed
    """
    # Get user's frequency cap settings
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if not settings or not settings.frequency_cap_enabled:
        return False

    if settings.frequency_cap_per_reptile == 0:
        return False  # 0 = unlimited

    # Get current count for this (user, reptile, date)
    result = await db.execute(
        select(NotificationFrequencyTracking.notification_count).where(
            and_(
                NotificationFrequencyTracking.user_id == user_id,
                NotificationFrequencyTracking.reptile_id == reptile_id,
                NotificationFrequencyTracking.date == date
            )
        )
    )
    count = result.scalar_one_or_none() or 0

    return count >= settings.frequency_cap_per_reptile


async def get_frequency_cap_mode(
    db: AsyncSession,
    user_id: int
) -> str:
    """Get the frequency cap mode for a user ('silent' or 'summary')"""
    result = await db.execute(
        select(NotificationSettings.frequency_cap_mode).where(
            NotificationSettings.user_id == user_id
        )
    )
    mode = result.scalar_one_or_none()
    return mode or "silent"


async def increment_notification_count(
    db: AsyncSession,
    user_id: int,
    reptile_id: int,
    date: py_date
) -> int:
    """
    Atomically increment notification count for (user, reptile, date).
    Uses FOR UPDATE lock to prevent race conditions.

    Returns new count.
    """
    # Try to get existing record with lock
    result = await db.execute(
        select(NotificationFrequencyTracking).where(
            and_(
                NotificationFrequencyTracking.user_id == user_id,
                NotificationFrequencyTracking.reptile_id == reptile_id,
                NotificationFrequencyTracking.date == date
            )
        ).with_for_update()
    )
    record = result.scalar_one_or_none()

    if record:
        record.notification_count += 1
        record.last_notification_at = datetime.now(timezone.utc)
    else:
        record = NotificationFrequencyTracking(
            user_id=user_id,
            reptile_id=reptile_id,
            date=date,
            notification_count=1,
            last_notification_at=datetime.now(timezone.utc)
        )
        db.add(record)

    await db.flush()
    return record.notification_count


async def cleanup_old_frequency_tracking(days_to_keep: int = 7):
    """
    Clean up frequency tracking records older than N days.
    Called by daily maintenance job.
    """
    from app.database import async_session_maker

    async with async_session_maker() as db:
        cutoff_date = datetime.now(timezone.utc).date() - timedelta(days=days_to_keep)

        result = await db.execute(
            delete(NotificationFrequencyTracking).where(
                NotificationFrequencyTracking.date < cutoff_date
            )
        )

        await db.commit()

        deleted = result.rowcount if hasattr(result, 'rowcount') else 0
        logger.info(f"Cleaned up {deleted} old frequency tracking records")
        return deleted
