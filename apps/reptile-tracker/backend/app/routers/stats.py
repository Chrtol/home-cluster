from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.auth import get_current_user
from app.database import get_db
from app.models import User, Feeding, WeightLog, AccessLevel, HealthRecord, MistingLog, Reptile, Food, feeding_foods
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


@router.get("/comprehensive/{reptile_id}")
async def get_comprehensive_stats(
    reptile_id: int,
    days: int = Query(90, le=730),  # Default 90 days, max 2 years
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get comprehensive statistics for charts including weight, feeding, misting, and health events"""

    reptile = await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)

    start_date = datetime.utcnow() - timedelta(days=days)

    # Weight data - all weight logs in period
    result = await db.execute(
        select(WeightLog)
        .where(
            WeightLog.reptile_id == reptile_id,
            WeightLog.measured_at >= start_date
        )
        .order_by(WeightLog.measured_at)
    )
    weight_logs = result.scalars().all()
    weight_data = [
        {
            "date": log.measured_at.isoformat(),
            "weight": float(log.weight_grams),
            "notes": log.notes
        }
        for log in weight_logs
    ]

    # Feeding data - grouped by day
    result = await db.execute(
        select(
            func.date(Feeding.fed_at).label('date'),
            func.count(Feeding.id).label('count')
        )
        .where(
            Feeding.reptile_id == reptile_id,
            Feeding.fed_at >= start_date
        )
        .group_by(func.date(Feeding.fed_at))
        .order_by(func.date(Feeding.fed_at))
    )
    feeding_by_day = result.all()
    feeding_data = [
        {
            "date": row.date.isoformat(),
            "count": row.count
        }
        for row in feeding_by_day
    ]

    # Food-specific feeding data - count of each food item by day
    result = await db.execute(
        select(
            func.date(Feeding.fed_at).label('date'),
            Food.name.label('food_name'),
            func.sum(feeding_foods.c.quantity).label('quantity')
        )
        .join(feeding_foods, Feeding.id == feeding_foods.c.feeding_id)
        .join(Food, feeding_foods.c.food_id == Food.id)
        .where(
            Feeding.reptile_id == reptile_id,
            Feeding.fed_at >= start_date
        )
        .group_by(func.date(Feeding.fed_at), Food.name)
        .order_by(func.date(Feeding.fed_at), Food.name)
    )
    food_by_day = result.all()

    # Group by date
    food_data = {}
    for row in food_by_day:
        date_str = row.date.isoformat()
        if date_str not in food_data:
            food_data[date_str] = {}
        food_data[date_str][row.food_name] = row.quantity

    # Convert to list format
    food_data_list = [
        {
            "date": date,
            "foods": foods
        }
        for date, foods in sorted(food_data.items())
    ]

    # Misting data - grouped by day
    result = await db.execute(
        select(
            func.date(MistingLog.misted_at).label('date'),
            func.count(MistingLog.id).label('count')
        )
        .where(
            MistingLog.reptile_id == reptile_id,
            MistingLog.misted_at >= start_date
        )
        .group_by(func.date(MistingLog.misted_at))
        .order_by(func.date(MistingLog.misted_at))
    )
    misting_by_day = result.all()
    misting_data = [
        {
            "date": row.date.isoformat(),
            "count": row.count
        }
        for row in misting_by_day
    ]

    # Health events - all health records in period
    result = await db.execute(
        select(HealthRecord)
        .where(
            HealthRecord.reptile_id == reptile_id,
            HealthRecord.date >= start_date
        )
        .order_by(HealthRecord.date)
    )
    health_records = result.scalars().all()
    health_data = [
        {
            "date": record.date.isoformat(),
            "type": record.record_type,
            "title": record.title,
            "description": record.description
        }
        for record in health_records
    ]

    # Summary statistics
    total_feedings = len(feeding_by_day)
    total_mistings = len(misting_by_day)
    total_health_events = len(health_records)

    # Weight change
    weight_change = None
    weight_change_percent = None
    if len(weight_logs) >= 2:
        first_weight = float(weight_logs[0].weight_grams)
        last_weight = float(weight_logs[-1].weight_grams)
        weight_change = last_weight - first_weight
        if first_weight > 0:
            weight_change_percent = (weight_change / first_weight) * 100

    return {
        "reptile_id": reptile_id,
        "reptile_name": reptile.name,
        "period_days": days,
        "start_date": start_date.isoformat(),
        "weight_data": weight_data,
        "feeding_data": feeding_data,
        "food_data": food_data_list,
        "misting_data": misting_data,
        "health_data": health_data,
        "summary": {
            "total_feedings": total_feedings,
            "total_mistings": total_mistings,
            "total_health_events": total_health_events,
            "weight_change": weight_change,
            "weight_change_percent": weight_change_percent,
            "current_weight": float(weight_logs[-1].weight_grams) if weight_logs else None,
            "weight_logs_count": len(weight_logs)
        }
    }
