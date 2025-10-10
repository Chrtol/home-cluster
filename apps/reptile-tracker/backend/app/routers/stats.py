from typing import List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth import get_current_user
from app.database import get_db
from app.models import User, Feeding, WeightLog, AccessLevel
from app.permissions import check_reptile_access, get_user_reptiles
from app.schemas import DailySummary, WeeklySummary, ReptileStats

router = APIRouter()


@router.get("/daily-summary", response_model=List[DailySummary])
async def get_daily_summary(
    days: int = Query(7, le=90),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get daily feeding summary for the last N days"""

    # Get reptiles user has access to
    user_reptiles = await get_user_reptiles(db, current_user)
    reptile_ids = [item["reptile"].id for item in user_reptiles]
    total_reptiles = len(reptile_ids)

    summaries = []
    for i in range(days):
        date = datetime.utcnow().date() - timedelta(days=i)
        start = datetime.combine(date, datetime.min.time())
        end = datetime.combine(date, datetime.max.time())

        # Count feedings for the day
        result = await db.execute(
            select(func.count(Feeding.id))
            .where(
                Feeding.reptile_id.in_(reptile_ids),
                Feeding.fed_at >= start,
                Feeding.fed_at <= end,
            )
        )
        total_feedings = result.scalar() or 0

        # Count unique reptiles fed
        result = await db.execute(
            select(func.count(func.distinct(Feeding.reptile_id)))
            .where(
                Feeding.reptile_id.in_(reptile_ids),
                Feeding.fed_at >= start,
                Feeding.fed_at <= end,
            )
        )
        reptiles_fed = result.scalar() or 0

        summaries.append(
            DailySummary(
                date=date.isoformat(),
                total_feedings=total_feedings,
                reptiles_fed=reptiles_fed,
                total_reptiles=total_reptiles,
            )
        )

    return summaries


@router.get("/weekly-summary", response_model=WeeklySummary)
async def get_weekly_summary(
    weeks_ago: int = Query(0, le=52),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get weekly feeding summary"""

    # Calculate week boundaries
    today = datetime.utcnow().date()
    week_start = today - timedelta(days=today.weekday() + (weeks_ago * 7))
    week_end = week_start + timedelta(days=6)

    start = datetime.combine(week_start, datetime.min.time())
    end = datetime.combine(week_end, datetime.max.time())

    # Get reptiles user has access to
    user_reptiles = await get_user_reptiles(db, current_user)
    reptile_ids = [item["reptile"].id for item in user_reptiles]

    # Total feedings
    result = await db.execute(
        select(func.count(Feeding.id))
        .where(
            Feeding.reptile_id.in_(reptile_ids),
            Feeding.fed_at >= start,
            Feeding.fed_at <= end,
        )
    )
    total_feedings = result.scalar() or 0

    # Feedings by reptile
    feedings_by_reptile = {}
    for reptile_item in user_reptiles:
        reptile = reptile_item["reptile"]
        result = await db.execute(
            select(func.count(Feeding.id))
            .where(
                Feeding.reptile_id == reptile.id,
                Feeding.fed_at >= start,
                Feeding.fed_at <= end,
            )
        )
        count = result.scalar() or 0
        feedings_by_reptile[reptile.name] = count

    # Average daily feedings
    average_daily = total_feedings / 7 if total_feedings > 0 else 0

    return WeeklySummary(
        week_start=week_start.isoformat(),
        week_end=week_end.isoformat(),
        total_feedings=total_feedings,
        feedings_by_reptile=feedings_by_reptile,
        average_daily_feedings=round(average_daily, 2),
    )


@router.get("/reptile/{reptile_id}", response_model=ReptileStats)
async def get_reptile_stats(
    reptile_id: int,
    days: int = Query(30, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get comprehensive stats for a reptile"""

    reptile = await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)

    # Calculate date range
    start_date = datetime.utcnow() - timedelta(days=days)

    # Total feedings
    result = await db.execute(
        select(func.count(Feeding.id))
        .where(
            Feeding.reptile_id == reptile_id,
            Feeding.fed_at >= start_date,
        )
    )
    total_feedings = result.scalar() or 0

    # Last feeding
    result = await db.execute(
        select(Feeding.fed_at)
        .where(Feeding.reptile_id == reptile_id)
        .order_by(Feeding.fed_at.desc())
        .limit(1)
    )
    last_feeding = result.scalar_one_or_none()

    # Weight trend
    result = await db.execute(
        select(WeightLog)
        .where(WeightLog.reptile_id == reptile_id)
        .order_by(WeightLog.measured_at.desc())
        .limit(20)
    )
    weight_logs = result.scalars().all()

    # Nutritional summary (simplified)
    nutritional_summary = {
        "total_feedings": total_feedings,
        "period_days": days,
        "average_feedings_per_week": round((total_feedings / days) * 7, 2) if days > 0 else 0,
    }

    return ReptileStats(
        reptile_id=reptile_id,
        reptile_name=reptile.name,
        total_feedings=total_feedings,
        last_feeding=last_feeding,
        weight_trend=weight_logs,
        nutritional_summary=nutritional_summary,
    )
