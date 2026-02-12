"""
Streak API Router

Provides endpoints for retrieving streak data with Redis caching.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Reptile, ReptileStreak
from app.schemas import StreakResponse, StreaksListResponse
from app.services.streak_service import (
    get_streak_for_reptile,
    get_streaks_for_reptiles,
    update_streak_for_reptile,
)

import redis.asyncio as redis
from app.celery_app import REDIS_URL
import json


router = APIRouter(prefix="/streaks", tags=["streaks"])

# Redis client for caching
redis_client: Optional[redis.Redis] = None

CACHE_TTL_SECONDS = 3600  # 1 hour cache TTL


async def get_redis():
    """Get or create Redis client."""
    global redis_client
    if redis_client is None:
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return redis_client


def streak_cache_key(reptile_id: int) -> str:
    """Generate cache key for reptile streak."""
    return f"streak:reptile:{reptile_id}"


async def get_cached_streak(reptile_id: int) -> Optional[dict]:
    """Get streak from cache."""
    try:
        r = await get_redis()
        cached = await r.get(streak_cache_key(reptile_id))
        if cached:
            return json.loads(cached)
    except Exception:
        # Cache failure should not break the API
        pass
    return None


async def set_cached_streak(reptile_id: int, streak_data: dict):
    """Set streak in cache."""
    try:
        r = await get_redis()
        await r.setex(
            streak_cache_key(reptile_id),
            CACHE_TTL_SECONDS,
            json.dumps(streak_data, default=str),  # Handle date serialization
        )
    except Exception:
        # Cache failure should not break the API
        pass


async def invalidate_streak_cache(reptile_id: int):
    """Invalidate streak cache for a reptile."""
    try:
        r = await get_redis()
        await r.delete(streak_cache_key(reptile_id))
    except Exception:
        pass


@router.get("/{reptile_id}", response_model=StreakResponse)
async def get_streak(
    reptile_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get current streak for a reptile.

    Uses Redis cache for performance, falls back to database.
    """
    # Verify user has access to this reptile
    from sqlalchemy import select
    result = await db.execute(
        select(Reptile).where(Reptile.id == reptile_id)
    )
    reptile = result.scalar_one_or_none()

    if not reptile:
        raise HTTPException(status_code=404, detail="Reptile not found")

    # TODO: Add permission check (user must have access to reptile)

    # Try cache first
    cached = await get_cached_streak(reptile_id)
    if cached:
        return StreakResponse(**cached)

    # Cache miss - get from database
    streak = await get_streak_for_reptile(db, reptile_id)

    if not streak:
        # No streak record yet - create one
        streak = await update_streak_for_reptile(db, reptile_id)
        await db.commit()

    streak_data = {
        "reptile_id": streak.reptile_id,
        "current_streak": streak.current_streak,
        "last_completion_date": streak.last_completion_date,
        "grace_days_remaining": streak.grace_days_remaining,
        "grace_period_days": streak.grace_period_days,
        "longest_streak": streak.longest_streak,
    }

    # Populate cache
    await set_cached_streak(reptile_id, streak_data)

    return StreakResponse(**streak_data)


@router.get("/", response_model=StreaksListResponse)
async def get_streaks_batch(
    reptile_ids: str,  # Comma-separated list of IDs
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get streaks for multiple reptiles (for dashboard).

    Accepts comma-separated reptile IDs, returns dict of reptile_id -> streak.
    """
    try:
        ids = [int(x.strip()) for x in reptile_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid reptile_ids format")

    if not ids:
        return StreaksListResponse(streaks={})

    if len(ids) > 100:
        raise HTTPException(status_code=400, detail="Too many reptile IDs (max 100)")

    # TODO: Filter to only reptiles user has access to

    # Get from database (batch query)
    streaks_dict = await get_streaks_for_reptiles(db, ids)

    result = {}
    for reptile_id in ids:
        if reptile_id in streaks_dict:
            s = streaks_dict[reptile_id]
            result[reptile_id] = StreakResponse(
                reptile_id=s.reptile_id,
                current_streak=s.current_streak,
                last_completion_date=s.last_completion_date,
                grace_days_remaining=s.grace_days_remaining,
                grace_period_days=s.grace_period_days,
                longest_streak=s.longest_streak,
            )
        else:
            # No streak record - return zeros
            result[reptile_id] = StreakResponse(
                reptile_id=reptile_id,
                current_streak=0,
                last_completion_date=None,
                grace_days_remaining=1,  # Default grace period
                grace_period_days=1,
                longest_streak=0,
            )

    return StreaksListResponse(streaks=result)


@router.post("/{reptile_id}/recalculate", response_model=StreakResponse)
async def recalculate_streak(
    reptile_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Force recalculate streak for a reptile.

    Useful for debugging or after manual data fixes.
    """
    # Verify reptile exists
    from sqlalchemy import select
    result = await db.execute(
        select(Reptile).where(Reptile.id == reptile_id)
    )
    reptile = result.scalar_one_or_none()

    if not reptile:
        raise HTTPException(status_code=404, detail="Reptile not found")

    # Recalculate
    streak = await update_streak_for_reptile(db, reptile_id)
    await db.commit()

    # Invalidate cache
    await invalidate_streak_cache(reptile_id)

    return StreakResponse(
        reptile_id=streak.reptile_id,
        current_streak=streak.current_streak,
        last_completion_date=streak.last_completion_date,
        grace_days_remaining=streak.grace_days_remaining,
        grace_period_days=streak.grace_period_days,
        longest_streak=streak.longest_streak,
    )
