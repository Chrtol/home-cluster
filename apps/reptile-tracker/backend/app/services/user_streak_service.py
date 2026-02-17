"""
User Streak Calculation Service

Tracks user-level engagement across all assigned reptiles.
- Each manual task completion increments streak by 1
- Any completion resets consecutive_misses to 0
- Missing 2 tasks in a row (consecutive_misses >= 2) resets streak to 0
- Miss tracking happens when schedule instances expire without completion
- Supports shared responsibility and freeze/vacation mode
"""

import logging
from datetime import date, datetime, timezone as tz
from typing import List, Dict, Optional
from sqlalchemy import select, and_, or_, text, inspect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import event

logger = logging.getLogger(__name__)

from app.models import (
    UserStreak,
    UserStreakFreeze,
    ScheduleCompletion,
    Schedule,
    User,
    ReptileResponsibility,
    ScheduleResponsibility,
)


# Milestone rewards: streak count -> freeze days earned
# Running total: 7(start) + 1 + 2 + 4 + 7 = 21 max
MILESTONE_REWARDS = {
    7: 1,    # total: 8
    30: 2,   # total: 10
    100: 4,  # total: 14
    365: 7,  # total: 21
}


async def get_responsible_users(db: AsyncSession, schedule_id: int, reptile_id: int) -> List[int]:
    """
    Get list of user IDs responsible for a schedule/reptile.

    Priority:
    1. ScheduleResponsibility (specific override)
    2. ReptileResponsibility (reptile-level assignment)
    3. All household members (default if no assignments)

    Returns:
        List of user_id integers
    """
    # Check schedule-level responsibility first (override)
    result = await db.execute(
        select(ScheduleResponsibility.user_id)
        .where(ScheduleResponsibility.schedule_id == schedule_id)
    )
    schedule_users = result.scalars().all()

    if schedule_users:
        return list(schedule_users)

    # Fall back to reptile-level responsibility
    result = await db.execute(
        select(ReptileResponsibility.user_id)
        .where(ReptileResponsibility.reptile_id == reptile_id)
    )
    reptile_users = result.scalars().all()

    if reptile_users:
        return list(reptile_users)

    # Default: all household members are responsible
    # Get household via reptile, then all members
    from app.models import Reptile, household_members
    result = await db.execute(
        select(household_members.c.user_id)
        .join(Reptile, Reptile.household_id == household_members.c.household_id)
        .where(Reptile.id == reptile_id)
    )
    household_user_ids = [row[0] for row in result.fetchall()]

    return household_user_ids if household_user_ids else []


def is_schedule_manual(schedule: Schedule) -> bool:
    """
    Check if schedule is manual-completion (not auto-complete).

    Only manual-completion schedules count toward user streak.

    Returns:
        True if manual, False if auto-complete enabled
    """
    return not schedule.auto_complete_enabled


async def is_user_frozen(db: AsyncSession, user_id: int, check_date: date) -> bool:
    """
    Check if user has an active freeze covering the given date.

    Args:
        db: Database session
        user_id: User ID to check
        check_date: Date to check for freeze coverage

    Returns:
        True if user is frozen on check_date, False otherwise
    """
    result = await db.execute(
        select(UserStreakFreeze)
        .where(
            and_(
                UserStreakFreeze.user_id == user_id,
                UserStreakFreeze.is_active == True,
                UserStreakFreeze.start_date <= check_date,
                UserStreakFreeze.end_date >= check_date,
            )
        )
    )

    return result.first() is not None


async def check_milestone_and_award_freeze(db: AsyncSession, user_id: int, new_streak: int) -> Optional[int]:
    """
    Check if new streak hits a milestone and award freeze days.

    Args:
        db: Database session
        user_id: User ID
        new_streak: The new streak value

    Returns:
        Milestone number if reached, None otherwise
    """
    if new_streak not in MILESTONE_REWARDS:
        return None

    # Award freeze days
    freeze_days = MILESTONE_REWARDS[new_streak]

    result = await db.execute(
        select(UserStreak).where(UserStreak.user_id == user_id)
    )
    user_streak = result.scalar_one_or_none()

    if user_streak:
        user_streak.total_freeze_days += freeze_days
        await db.flush()

    return new_streak


async def update_user_streak_on_completion(
    db: AsyncSession,
    user_id: int,
    completed_by_user_id: int,
    user_lookup: Dict[int, str]
) -> Dict:
    """
    Update user streak when a task is completed.

    Logic:
    - Reset consecutive_misses to 0
    - Increment current_streak
    - Update longest_streak if needed
    - Check for milestone rewards

    Args:
        db: Database session
        user_id: User being credited
        completed_by_user_id: User who performed the completion
        user_lookup: Dict mapping user_id to user_name

    Returns:
        CompletionAttributionData dict with:
        - credited_to_user_id
        - credited_to_name
        - completed_by_user_id
        - milestone_reached (optional)
    """
    # Get or create UserStreak
    result = await db.execute(
        select(UserStreak).where(UserStreak.user_id == user_id)
    )
    user_streak = result.scalar_one_or_none()

    if not user_streak:
        user_streak = UserStreak(user_id=user_id)
        db.add(user_streak)
        await db.flush()

    # Reset consecutive misses
    user_streak.consecutive_misses = 0

    # Increment streak
    user_streak.current_streak += 1

    # Update longest streak
    if user_streak.current_streak > user_streak.longest_streak:
        user_streak.longest_streak = user_streak.current_streak

    # Update last completion timestamp
    user_streak.last_completion_at = datetime.now(tz.utc)

    # Check milestone
    milestone = await check_milestone_and_award_freeze(db, user_id, user_streak.current_streak)

    await db.flush()

    return {
        'credited_to_user_id': user_id,
        'credited_to_name': user_lookup.get(user_id, 'Unknown User'),
        'completed_by_user_id': completed_by_user_id,
        'milestone_reached': milestone,
    }


async def increment_user_miss(db: AsyncSession, user_id: int, miss_date: date):
    """
    Increment consecutive miss counter for a user.

    Logic:
    - Skip if user is frozen on miss_date
    - Increment consecutive_misses
    - If consecutive_misses >= 2: reset current_streak to 0, consecutive_misses to 0

    Args:
        db: Database session
        user_id: User ID
        miss_date: Date of the missed task
    """
    # Skip if user is frozen
    if await is_user_frozen(db, user_id, miss_date):
        return

    # Get or create UserStreak
    result = await db.execute(
        select(UserStreak).where(UserStreak.user_id == user_id)
    )
    user_streak = result.scalar_one_or_none()

    if not user_streak:
        user_streak = UserStreak(user_id=user_id)
        db.add(user_streak)
        await db.flush()

    # Increment miss counter
    user_streak.consecutive_misses += 1

    # Break streak after 2 consecutive misses
    if user_streak.consecutive_misses >= 2:
        user_streak.current_streak = 0
        user_streak.consecutive_misses = 0

    await db.flush()


async def get_user_streak(db: AsyncSession, user_id: int) -> Optional[Dict]:
    """
    Get current user streak data.

    Returns:
        UserStreakResponse dict or None
    """
    result = await db.execute(
        select(UserStreak).where(UserStreak.user_id == user_id)
    )
    user_streak = result.scalar_one_or_none()

    if not user_streak:
        return None

    # Check if frozen today
    today = date.today()
    is_frozen = await is_user_frozen(db, user_id, today)

    # Calculate available freeze days
    available_freeze = user_streak.total_freeze_days - user_streak.used_freeze_days

    # Calculate next milestone
    next_milestone = None
    days_to_milestone = None
    for milestone in sorted(MILESTONE_REWARDS.keys()):
        if milestone > user_streak.current_streak:
            next_milestone = milestone
            days_to_milestone = milestone - user_streak.current_streak
            break

    return {
        'user_id': user_id,
        'current_streak': user_streak.current_streak,
        'consecutive_misses': user_streak.consecutive_misses,
        'longest_streak': user_streak.longest_streak,
        'total_freeze_days': user_streak.total_freeze_days,
        'available_freeze_days': available_freeze,
        'last_completion_at': user_streak.last_completion_at,
        'is_frozen_today': is_frozen,
        'next_milestone': next_milestone,
        'days_to_milestone': days_to_milestone,
    }


async def get_completion_attribution(
    db: AsyncSession,
    schedule_id: int,
    reptile_id: int,
    completed_by_user_id: int
) -> Optional[Dict]:
    """
    Return attribution data only if task was completed for someone else.

    Args:
        db: Database session
        schedule_id: Schedule ID
        reptile_id: Reptile ID
        completed_by_user_id: User who performed the completion

    Returns:
        CompletionAttributionResponse dict or None if no attribution needed
    """
    responsible_users = await get_responsible_users(db, schedule_id, reptile_id)

    # If completer is the only responsible user, no attribution needed
    if completed_by_user_id in responsible_users and len(responsible_users) == 1:
        return None

    # Get credited users (all responsible users except completer)
    credited_users = [u for u in responsible_users if u != completed_by_user_id]
    if not credited_users:
        return None

    # Return attribution for first credited user (primary display)
    result = await db.execute(
        select(User).where(User.id == credited_users[0])
    )
    credited_user = result.scalar_one_or_none()

    if not credited_user:
        return None

    return {
        'credited_to_user_id': credited_user.id,
        'credited_to_name': credited_user.name,
        'completed_by_user_id': completed_by_user_id,
        'message': f"Completed for {credited_user.name} - their streak continues!",
        'milestone_reached': None,  # Milestone checked separately in event listener
    }


# Event-driven user streak updates
# Note: Event listeners use sync connection (not async) since they run in after_insert/after_update


def _process_completion_for_streak(connection, target):
    """
    Core logic for updating user streaks on completion.

    Called by both after_insert and after_update event listeners.
    Only triggers for manual schedules (auto-complete excluded).
    Credits all responsible users.
    """
    from app.models import CompletionStatus

    logger.info(f"_process_completion_for_streak called for completion {target.id}, status={target.status}")

    # Only process actual completions
    if target.status not in (CompletionStatus.COMPLETED_ON_TIME, CompletionStatus.COMPLETED_LATE):
        logger.debug(f"Completion {target.id}: status {target.status} is not a completed status, skipping")
        return

    # Get schedule to check if manual
    schedule_result = connection.execute(
        text("SELECT auto_complete_enabled FROM schedules WHERE id = :schedule_id"),
        {"schedule_id": target.schedule_id}
    )
    schedule_row = schedule_result.fetchone()

    if not schedule_row or schedule_row[0]:  # auto_complete_enabled = True
        logger.debug(f"Completion {target.id}: schedule {target.schedule_id} is auto-complete, skipping streak update")
        return  # Skip auto-complete schedules

    logger.info(f"Completion {target.id}: processing streak update for manual schedule {target.schedule_id}")

    # Get responsible users
    # Check schedule-level responsibility first
    schedule_users_result = connection.execute(
        text("SELECT user_id FROM schedule_responsibility WHERE schedule_id = :schedule_id"),
        {"schedule_id": target.schedule_id}
    )
    schedule_users = [row[0] for row in schedule_users_result.fetchall()]

    if not schedule_users:
        # Fall back to reptile-level responsibility
        reptile_users_result = connection.execute(
            text("SELECT user_id FROM reptile_responsibility WHERE reptile_id = :reptile_id"),
            {"reptile_id": target.reptile_id}
        )
        schedule_users = [row[0] for row in reptile_users_result.fetchall()]

    if not schedule_users:
        # Default: all household members
        household_users_result = connection.execute(
            text("""
                SELECT hm.user_id FROM household_members hm
                JOIN reptiles r ON r.household_id = hm.household_id
                WHERE r.id = :reptile_id
            """),
            {"reptile_id": target.reptile_id}
        )
        schedule_users = [row[0] for row in household_users_result.fetchall()]

    if not schedule_users:
        logger.warning(f"Completion {target.id}: no responsible users found, skipping streak update")
        return  # No responsible users found

    logger.info(f"Completion {target.id}: found responsible users: {schedule_users}")

    # Build user lookup dict
    users_result = connection.execute(
        text("SELECT id, name FROM users WHERE id = ANY(:user_ids)"),
        {"user_ids": schedule_users}
    )
    user_lookup = {row[0]: row[1] for row in users_result.fetchall()}

    # Update streak for each responsible user
    # Per spec: each task completion increments streak and resets consecutive_misses
    # Streak breaks after 2 consecutive MISSED TASKS (tracked separately when tasks expire)
    for user_id in schedule_users:
        # Get or create UserStreak
        streak_result = connection.execute(
            text("SELECT id, current_streak, longest_streak, consecutive_misses FROM user_streaks WHERE user_id = :user_id"),
            {"user_id": user_id}
        )
        streak_row = streak_result.fetchone()

        if streak_row:
            # Each completion: increment streak, reset consecutive_misses
            old_streak = streak_row[1]
            old_misses = streak_row[3]
            new_streak = streak_row[1] + 1
            new_longest = max(streak_row[2], new_streak)

            logger.info(
                f"Completion {target.id}: updating streak for user {user_id} "
                f"(old: streak={old_streak}, misses={old_misses}) -> "
                f"(new: streak={new_streak}, misses=0)"
            )

            connection.execute(
                text("""
                    UPDATE user_streaks SET
                        current_streak = :current_streak,
                        consecutive_misses = 0,
                        longest_streak = :longest_streak,
                        last_completion_at = NOW(),
                        updated_at = NOW()
                    WHERE user_id = :user_id
                """),
                {
                    "user_id": user_id,
                    "current_streak": new_streak,
                    "longest_streak": new_longest,
                }
            )

            # Check milestone and award freeze days
            if new_streak in MILESTONE_REWARDS:
                freeze_days = MILESTONE_REWARDS[new_streak]
                logger.info(f"User {user_id} reached milestone {new_streak}! Awarding {freeze_days} freeze days")
                connection.execute(
                    text("""
                        UPDATE user_streaks SET
                            total_freeze_days = total_freeze_days + :freeze_days
                        WHERE user_id = :user_id
                    """),
                    {"user_id": user_id, "freeze_days": freeze_days}
                )
        else:
            # Insert new - first completion ever
            logger.info(f"Completion {target.id}: creating new streak record for user {user_id} (streak=1, misses=0)")
            connection.execute(
                text("""
                    INSERT INTO user_streaks
                    (user_id, current_streak, consecutive_misses, longest_streak, total_freeze_days, used_freeze_days, last_completion_at, created_at, updated_at)
                    VALUES (:user_id, 1, 0, 1, 7, 0, NOW(), NOW(), NOW())
                """),
                {"user_id": user_id}
            )

            # Check if streak 1 is a milestone (it's not in our current rewards)
            if 1 in MILESTONE_REWARDS:
                freeze_days = MILESTONE_REWARDS[1]
                connection.execute(
                    text("""
                        UPDATE user_streaks SET
                            total_freeze_days = total_freeze_days + :freeze_days
                        WHERE user_id = :user_id
                    """),
                    {"user_id": user_id, "freeze_days": freeze_days}
                )


@event.listens_for(ScheduleCompletion, 'after_insert')
def on_schedule_completion_created(mapper, connection, target):
    """
    Trigger user streak update when a new ScheduleCompletion is created.

    Handles completions that are created directly as completed (rare case).
    """
    _process_completion_for_streak(connection, target)


@event.listens_for(ScheduleCompletion, 'before_update')
def on_schedule_completion_before_update(mapper, connection, target):
    """
    Capture old status before update for use in after_update listener.

    The after_update listener cannot reliably access attribute history,
    so we capture the old status here and store it on the target.
    """
    from app.models import CompletionStatus

    # Use inspect to get attribute history before the flush
    state = inspect(target)
    hist = state.attrs.status.history

    if hist.deleted:
        # Status is being changed, store the old value
        target._pre_update_status = hist.deleted[0]
        logger.debug(f"ScheduleCompletion {target.id}: status changing from {hist.deleted[0]} to {target.status}")
    else:
        # No change to status
        target._pre_update_status = None


@event.listens_for(ScheduleCompletion, 'after_update')
def on_schedule_completion_updated(mapper, connection, target):
    """
    Trigger user streak update when a ScheduleCompletion is updated.

    This handles the common case where a PENDING completion is updated to COMPLETED.
    Only triggers when status changes to a completed state.
    """
    from app.models import CompletionStatus

    # Get the old status captured by before_update listener
    old_status = getattr(target, '_pre_update_status', None)

    if old_status is None:
        logger.debug(f"ScheduleCompletion {target.id}: no status change detected, skipping streak update")
        return

    new_status = target.status
    logger.info(f"ScheduleCompletion {target.id}: status changed from {old_status} to {new_status}")

    # Only trigger if transitioning TO a completed status FROM a non-completed status
    completed_statuses = (CompletionStatus.COMPLETED_ON_TIME, CompletionStatus.COMPLETED_LATE)
    if old_status not in completed_statuses and new_status in completed_statuses:
        logger.info(f"ScheduleCompletion {target.id}: triggering streak update for completion transition")
        _process_completion_for_streak(connection, target)
    else:
        logger.debug(f"ScheduleCompletion {target.id}: not a completion transition, skipping streak update")
