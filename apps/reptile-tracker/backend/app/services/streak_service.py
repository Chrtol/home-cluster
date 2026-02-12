"""
Streak Calculation Service

Calculates consecutive completion days per reptile with grace period forgiveness.
Uses "any completion counts" rule - a day with at least one completed schedule counts.
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


def calculate_streak_from_completions(
    completion_dates: list[date],
    today: date,
    grace_period_days: int = 1,
) -> dict:
    """
    Calculate current streak from completion history.

    Uses "any completion counts" rule - a day with at least one completion counts.

    Args:
        completion_dates: List of dates with completions, ordered DESC (most recent first)
        today: Current date in user's timezone
        grace_period_days: Number of forgiveness days allowed

    Returns:
        {
            'current_streak': int,
            'last_completion_date': date | None,
            'grace_days_remaining': int,
            'longest_streak': int,
        }
    """
    if not completion_dates:
        return {
            'current_streak': 0,
            'last_completion_date': None,
            'grace_days_remaining': grace_period_days,
            'longest_streak': 0,
        }

    # Deduplicate and sort DESC (multiple completions per day count as one)
    unique_dates = sorted(set(completion_dates), reverse=True)
    last_completion = unique_dates[0]

    # Check if streak is still active
    days_since_last = (today - last_completion).days

    # Streak breaks if more than grace_period + 1 days have passed
    # (grace_period = 1 means: complete yesterday, skip today, still active tomorrow)
    if days_since_last > grace_period_days + 1:
        return {
            'current_streak': 0,
            'last_completion_date': last_completion,
            'grace_days_remaining': 0,
            'longest_streak': _calculate_longest_streak(unique_dates, grace_period_days),
        }

    # Calculate grace days remaining
    if days_since_last == 0:
        # Completed today - full grace restored
        grace_remaining = grace_period_days
    else:
        # Each day without completion uses one grace day
        grace_remaining = max(0, grace_period_days - (days_since_last - 1))

    # Count consecutive days backwards
    current_streak = 1
    expected_date = last_completion - timedelta(days=1)

    for comp_date in unique_dates[1:]:
        days_gap = (expected_date - comp_date).days

        if days_gap == 0:
            # Consecutive day
            current_streak += 1
            expected_date -= timedelta(days=1)
        elif days_gap <= grace_period_days:
            # Within grace period - streak continues
            current_streak += 1
            expected_date = comp_date - timedelta(days=1)
        else:
            # Gap too large - streak ends here
            break

    longest = _calculate_longest_streak(unique_dates, grace_period_days)

    return {
        'current_streak': current_streak,
        'last_completion_date': last_completion,
        'grace_days_remaining': grace_remaining,
        'longest_streak': max(longest, current_streak),
    }


def _calculate_longest_streak(dates: list[date], grace_days: int) -> int:
    """Calculate longest historical streak from completion dates."""
    if not dates:
        return 0

    longest = 1
    current = 1

    for i in range(1, len(dates)):
        gap = (dates[i-1] - dates[i]).days

        if gap <= grace_days + 1:
            current += 1
            longest = max(longest, current)
        else:
            current = 1

    return longest


async def get_completion_dates(
    db: AsyncSession,
    reptile_id: int,
    limit_days: int = 365,
) -> list[date]:
    """
    Get completion dates for a reptile.

    Only counts COMPLETED_ON_TIME and COMPLETED_LATE (not MISSED, not PENDING).
    """
    cutoff_date = date.today() - timedelta(days=limit_days)

    result = await db.execute(
        select(ScheduleCompletion.scheduled_date)
        .where(
            and_(
                ScheduleCompletion.reptile_id == reptile_id,
                ScheduleCompletion.status.in_([
                    CompletionStatus.COMPLETED_ON_TIME,
                    CompletionStatus.COMPLETED_LATE,
                ]),
                ScheduleCompletion.scheduled_date >= cutoff_date,
            )
        )
        .order_by(ScheduleCompletion.scheduled_date.desc())
    )

    return [row[0] for row in result.fetchall()]


async def update_streak_for_reptile(
    db: AsyncSession,
    reptile_id: int,
    user_timezone: Optional[str] = None,
) -> ReptileStreak:
    """
    Recalculate and update streak for a reptile.

    Call this after a ScheduleCompletion is created.
    """
    # Get user timezone if not provided
    if not user_timezone:
        user_timezone = await get_user_timezone(db, reptile_id)

    # Get "today" in user's timezone
    from datetime import datetime
    tz = ZoneInfo(user_timezone)
    user_today = datetime.now(tz=tz).date()

    # Get completion dates
    completion_dates = await get_completion_dates(db, reptile_id)

    # Get or create streak record
    result = await db.execute(
        select(ReptileStreak).where(ReptileStreak.reptile_id == reptile_id)
    )
    streak = result.scalar_one_or_none()

    if not streak:
        streak = ReptileStreak(reptile_id=reptile_id)
        db.add(streak)

    # Calculate new streak
    streak_data = calculate_streak_from_completions(
        completion_dates,
        user_today,
        streak.grace_period_days,
    )

    # Update streak record
    streak.current_streak = streak_data['current_streak']
    streak.last_completion_date = streak_data['last_completion_date']
    streak.grace_days_remaining = streak_data['grace_days_remaining']
    streak.longest_streak = max(streak.longest_streak, streak_data['longest_streak'])

    await db.flush()
    return streak


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


# Event-driven streak updates
from sqlalchemy import event
from sqlalchemy.orm import Session
from app.celery_app import REDIS_URL


def _recalculate_streak_sync(connection, reptile_id: int):
    """
    Synchronous streak recalculation for use in event listener.

    Event listeners run in sync context during flush, so we use raw SQL
    rather than async session operations.
    """
    from datetime import datetime
    from sqlalchemy import text

    # Get user timezone (simplified - get from first user associated with reptile)
    timezone_result = connection.execute(
        text("""
            SELECT u.timezone FROM users u
            JOIN reptile_access ra ON ra.user_id = u.id
            WHERE ra.reptile_id = :reptile_id
            LIMIT 1
        """),
        {"reptile_id": reptile_id}
    )
    row = timezone_result.fetchone()
    user_timezone = row[0] if row else "UTC"

    # Get "today" in user's timezone
    tz = ZoneInfo(user_timezone)
    user_today = datetime.now(tz=tz).date()

    # Get completion dates (last 365 days)
    cutoff_date = user_today - timedelta(days=365)
    completions_result = connection.execute(
        text("""
            SELECT DISTINCT scheduled_date FROM schedule_completions
            WHERE reptile_id = :reptile_id
            AND status IN ('completed_on_time', 'completed_late')
            AND scheduled_date >= :cutoff_date
            ORDER BY scheduled_date DESC
        """),
        {"reptile_id": reptile_id, "cutoff_date": cutoff_date}
    )
    completion_dates = [row[0] for row in completions_result.fetchall()]

    # Get or create streak record
    streak_result = connection.execute(
        text("SELECT id, grace_period_days, longest_streak FROM reptile_streaks WHERE reptile_id = :reptile_id"),
        {"reptile_id": reptile_id}
    )
    streak_row = streak_result.fetchone()

    grace_period_days = streak_row[1] if streak_row else 1
    existing_longest = streak_row[2] if streak_row else 0

    # Calculate streak
    streak_data = calculate_streak_from_completions(
        completion_dates,
        user_today,
        grace_period_days,
    )

    new_longest = max(existing_longest, streak_data['longest_streak'])

    if streak_row:
        # Update existing
        connection.execute(
            text("""
                UPDATE reptile_streaks SET
                    current_streak = :current_streak,
                    last_completion_date = :last_completion_date,
                    grace_days_remaining = :grace_days_remaining,
                    longest_streak = :longest_streak,
                    updated_at = NOW()
                WHERE reptile_id = :reptile_id
            """),
            {
                "reptile_id": reptile_id,
                "current_streak": streak_data['current_streak'],
                "last_completion_date": streak_data['last_completion_date'],
                "grace_days_remaining": streak_data['grace_days_remaining'],
                "longest_streak": new_longest,
            }
        )
    else:
        # Insert new
        connection.execute(
            text("""
                INSERT INTO reptile_streaks
                (reptile_id, current_streak, last_completion_date, grace_days_remaining, grace_period_days, longest_streak, created_at, updated_at)
                VALUES (:reptile_id, :current_streak, :last_completion_date, :grace_days_remaining, :grace_period_days, :longest_streak, NOW(), NOW())
            """),
            {
                "reptile_id": reptile_id,
                "current_streak": streak_data['current_streak'],
                "last_completion_date": streak_data['last_completion_date'],
                "grace_days_remaining": streak_data['grace_days_remaining'],
                "grace_period_days": grace_period_days,
                "longest_streak": new_longest,
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
    Trigger streak recalculation when a ScheduleCompletion is created.

    Runs in same transaction as completion insert for consistency.
    """
    # Only recalculate for actual completions, not pending/missed
    if target.status in (CompletionStatus.COMPLETED_ON_TIME, CompletionStatus.COMPLETED_LATE):
        _recalculate_streak_sync(connection, target.reptile_id)
        _invalidate_streak_cache_sync(target.reptile_id)
