"""
Streak Calculation Service

Task-based streak tracking per reptile.
- Each task completion increments streak by 1
- Any completion resets consecutive_misses to 0
- Missing 2 tasks in a row (consecutive_misses >= 2) resets streak to 0
- Days without scheduled tasks don't affect streak
"""

from datetime import date, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from zoneinfo import ZoneInfo

from app.models import (
    ReptileStreak,
    ScheduleCompletion,
    CompletionStatus,
    Reptile,
    User,
)


async def get_user_timezone(db: AsyncSession, reptile_id: int) -> str:
    """
    Get timezone for streak calculation from reptile's owner.
    Falls back to UTC if no user/timezone found.
    """
    # Get reptile to find household, then user
    result = await db.execute(
        select(User.timezone)
        .join(Reptile.users)
        .where(Reptile.id == reptile_id)
        .limit(1)
    )
    timezone_str = result.scalar_one_or_none()
    return timezone_str or "UTC"


async def increment_reptile_streak(db: AsyncSession, reptile_id: int) -> ReptileStreak:
    """
    Increment streak for a reptile on task completion.

    Logic:
    - Reset consecutive_misses to 0
    - Increment current_streak by 1
    - Update longest_streak if needed
    """
    from datetime import datetime, timezone as tz

    # Get or create streak record
    result = await db.execute(
        select(ReptileStreak).where(ReptileStreak.reptile_id == reptile_id)
    )
    streak = result.scalar_one_or_none()

    if not streak:
        streak = ReptileStreak(reptile_id=reptile_id)
        db.add(streak)
        await db.flush()

    # Reset consecutive misses on any completion
    streak.consecutive_misses = 0

    # Increment streak
    streak.current_streak += 1

    # Update longest streak
    if streak.current_streak > streak.longest_streak:
        streak.longest_streak = streak.current_streak

    # Update last completion date
    streak.last_completion_date = date.today()

    await db.flush()
    return streak


async def increment_reptile_miss(db: AsyncSession, reptile_id: int) -> None:
    """
    Increment consecutive miss counter for a reptile.

    Logic:
    - Increment consecutive_misses
    - If consecutive_misses >= 2: reset current_streak to 0, consecutive_misses to 0

    Called from overdue.py when a schedule instance is marked as MISSED.
    """
    # Get or create streak record
    result = await db.execute(
        select(ReptileStreak).where(ReptileStreak.reptile_id == reptile_id)
    )
    streak = result.scalar_one_or_none()

    if not streak:
        streak = ReptileStreak(reptile_id=reptile_id)
        db.add(streak)
        await db.flush()

    # Increment miss counter
    streak.consecutive_misses += 1

    # Break streak after 2 consecutive misses
    if streak.consecutive_misses >= 2:
        streak.current_streak = 0
        streak.consecutive_misses = 0

    await db.flush()


async def get_streak_for_reptile(
    db: AsyncSession,
    reptile_id: int,
) -> Optional[ReptileStreak]:
    """Get current streak record for a reptile."""
    result = await db.execute(
        select(ReptileStreak).where(ReptileStreak.reptile_id == reptile_id)
    )
    return result.scalar_one_or_none()


async def get_streaks_for_reptiles(
    db: AsyncSession,
    reptile_ids: list[int],
) -> dict[int, ReptileStreak]:
    """Get streak records for multiple reptiles (for dashboard)."""
    result = await db.execute(
        select(ReptileStreak).where(ReptileStreak.reptile_id.in_(reptile_ids))
    )
    streaks = result.scalars().all()
    return {s.reptile_id: s for s in streaks}


async def update_streak_for_reptile(
    db: AsyncSession,
    reptile_id: int,
    user_timezone: Optional[str] = None,
) -> ReptileStreak:
    """
    Get or create streak record for a reptile.

    With task-based streaks, this doesn't recalculate from history.
    Streaks are updated incrementally via event listeners.
    This function is mainly for initialization or cache refresh.
    """
    # Get or create streak record
    result = await db.execute(
        select(ReptileStreak).where(ReptileStreak.reptile_id == reptile_id)
    )
    streak = result.scalar_one_or_none()

    if not streak:
        streak = ReptileStreak(reptile_id=reptile_id)
        db.add(streak)
        await db.flush()

    return streak


# Event-driven streak updates
from sqlalchemy import event
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.celery_app import REDIS_URL


def _increment_streak_sync(connection, reptile_id: int):
    """
    Synchronous streak increment for use in event listener.

    Event listeners run in sync context during flush, so we use raw SQL
    rather than async session operations.
    """
    from datetime import datetime

    # Get or create streak record
    streak_result = connection.execute(
        text("SELECT id, current_streak, longest_streak, consecutive_misses FROM reptile_streaks WHERE reptile_id = :reptile_id"),
        {"reptile_id": reptile_id}
    )
    streak_row = streak_result.fetchone()

    if streak_row:
        # Each completion: increment streak, reset consecutive_misses
        new_streak = streak_row[1] + 1
        new_longest = max(streak_row[2], new_streak)

        connection.execute(
            text("""
                UPDATE reptile_streaks SET
                    current_streak = :current_streak,
                    consecutive_misses = 0,
                    longest_streak = :longest_streak,
                    last_completion_date = :last_completion_date,
                    updated_at = NOW()
                WHERE reptile_id = :reptile_id
            """),
            {
                "reptile_id": reptile_id,
                "current_streak": new_streak,
                "longest_streak": new_longest,
                "last_completion_date": datetime.now().date(),
            }
        )
    else:
        # Insert new - first completion ever
        connection.execute(
            text("""
                INSERT INTO reptile_streaks
                (reptile_id, current_streak, consecutive_misses, longest_streak, last_completion_date, grace_days_remaining, grace_period_days, created_at, updated_at)
                VALUES (:reptile_id, 1, 0, 1, :last_completion_date, 0, 1, NOW(), NOW())
            """),
            {
                "reptile_id": reptile_id,
                "last_completion_date": datetime.now().date(),
            }
        )


def _invalidate_streak_cache_sync(reptile_id: int):
    """
    Synchronous cache invalidation for use in event listener.
    """
    import redis as sync_redis
    try:
        r = sync_redis.from_url(REDIS_URL)
        r.delete(f"streak:reptile:{reptile_id}")
    except Exception:
        # Cache invalidation failure is non-fatal
        pass


@event.listens_for(ScheduleCompletion, 'after_insert')
def on_schedule_completion_created(mapper, connection, target):
    """
    Trigger streak increment when a ScheduleCompletion is created.

    Runs in same transaction as completion insert for consistency.
    """
    # Only increment for actual completions, not pending/missed
    if target.status in (CompletionStatus.COMPLETED_ON_TIME, CompletionStatus.COMPLETED_LATE):
        _increment_streak_sync(connection, target.reptile_id)
        _invalidate_streak_cache_sync(target.reptile_id)
