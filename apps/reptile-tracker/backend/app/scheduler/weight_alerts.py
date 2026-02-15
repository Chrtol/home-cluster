"""
Weight change alert detection and frequency cap tracking for Phase 24.

Key concepts:
- Alerts fire when weight change exceeds threshold percentage
- Weekly frequency cap (max 1 alert per reptile per 7 days)
- Baseline = most recent previous weight log
- First weight log skips alert (no baseline to compare)
- Only triggers on creation, not updates

Species defaults for threshold:
- Crested Gecko: 5%
- Ball Python: 15%
- Default: 10%
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Reptile, WeightLog, WeightAlertTracking, User

logger = logging.getLogger(__name__)

# Species-specific default thresholds
SPECIES_THRESHOLD_DEFAULTS: Dict[str, int] = {
    "crested gecko": 5,
    "ball python": 15,
    "leopard gecko": 8,
    "bearded dragon": 10,
    "corn snake": 12,
}
DEFAULT_THRESHOLD_PERCENT = 10


def get_threshold_for_reptile(reptile: Reptile) -> int:
    """
    Get the weight change threshold for a reptile.

    Returns reptile's custom threshold if set, otherwise species default.
    """
    if reptile.weight_alert_threshold_percent is not None:
        return reptile.weight_alert_threshold_percent

    # Look up species default (case-insensitive)
    species_lower = reptile.species.lower() if reptile.species else ""
    for species_key, threshold in SPECIES_THRESHOLD_DEFAULTS.items():
        if species_key in species_lower:
            return threshold

    return DEFAULT_THRESHOLD_PERCENT


async def get_baseline_weight(
    db: AsyncSession,
    reptile_id: int,
    current_log: WeightLog
) -> Optional[WeightLog]:
    """
    Get the most recent weight log before the current one for comparison.

    Returns None if this is the first weight log (no baseline exists).
    """
    result = await db.execute(
        select(WeightLog)
        .where(
            and_(
                WeightLog.reptile_id == reptile_id,
                WeightLog.measured_at < current_log.measured_at
            )
        )
        .order_by(WeightLog.measured_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def is_weight_alert_cap_reached(
    db: AsyncSession,
    reptile_id: int
) -> bool:
    """
    Check if weight alert was sent within last 7 days.

    Weekly cap prevents notification spam while allowing
    timely alerts for significant changes.
    """
    result = await db.execute(
        select(WeightAlertTracking.last_alert_at)
        .where(WeightAlertTracking.reptile_id == reptile_id)
    )
    last_alert = result.scalar_one_or_none()

    if not last_alert:
        return False

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    return last_alert > week_ago


async def update_weight_alert_tracking(
    db: AsyncSession,
    reptile_id: int,
    weight_log_id: int
) -> None:
    """
    Update tracking record with new alert timestamp.
    Uses FOR UPDATE lock to prevent race conditions.
    """
    result = await db.execute(
        select(WeightAlertTracking)
        .where(WeightAlertTracking.reptile_id == reptile_id)
        .with_for_update()
    )
    record = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if record:
        record.last_alert_at = now
        record.last_alert_weight_log_id = weight_log_id
        record.updated_at = now
    else:
        record = WeightAlertTracking(
            reptile_id=reptile_id,
            last_alert_at=now,
            last_alert_weight_log_id=weight_log_id
        )
        db.add(record)

    await db.flush()


def calculate_weight_change(
    baseline_weight: float,
    current_weight: float
) -> Dict[str, Any]:
    """
    Calculate weight change metrics.

    Returns dict with:
    - change_grams: Absolute change in grams
    - change_percent: Percentage change (always positive)
    - direction: "gain" or "loss"
    """
    if baseline_weight == 0:
        # Prevent division by zero
        return {
            "change_grams": current_weight,
            "change_percent": 100.0 if current_weight > 0 else 0.0,
            "direction": "gain" if current_weight > 0 else "loss"
        }

    change_grams = current_weight - baseline_weight
    change_percent = abs(change_grams / baseline_weight) * 100
    direction = "gain" if change_grams > 0 else "loss"

    return {
        "change_grams": abs(change_grams),
        "change_percent": round(change_percent, 1),
        "direction": direction
    }


async def check_weight_change_alert(
    db: AsyncSession,
    weight_log: WeightLog,
    is_sweep: bool = False
) -> Optional[Dict[str, Any]]:
    """
    Check if weight change exceeds threshold and alert should be sent.

    Args:
        db: Database session
        weight_log: The newly created weight log
        is_sweep: True if called from daily sweep (for logging)

    Returns:
        Alert context dict if alert should be sent, None otherwise.
        Does NOT send the alert - caller is responsible for delivery.

    Suppression reasons:
        - Weight alerts disabled for reptile
        - First weight log (no baseline)
        - Change below threshold
        - Frequency cap reached (alert sent within 7 days)
    """
    reptile = await db.get(Reptile, weight_log.reptile_id)
    if not reptile:
        logger.warning(f"Reptile {weight_log.reptile_id} not found for weight alert check")
        return None

    # Check if alerts enabled for this reptile
    if not reptile.weight_alerts_enabled:
        logger.debug(f"Weight alerts disabled for reptile {reptile.id}")
        return None

    # Get baseline weight (previous measurement)
    baseline_log = await get_baseline_weight(db, reptile.id, weight_log)
    if not baseline_log:
        logger.info(f"First weight log for reptile {reptile.id}, no baseline for comparison")
        return None

    # Calculate change
    change = calculate_weight_change(
        baseline_log.weight_grams,
        weight_log.weight_grams
    )

    # Check if change exceeds threshold
    threshold = get_threshold_for_reptile(reptile)
    if change["change_percent"] < threshold:
        logger.debug(
            f"Weight change {change['change_percent']}% below threshold {threshold}% "
            f"for reptile {reptile.id}"
        )
        return None

    # Check frequency cap
    if await is_weight_alert_cap_reached(db, reptile.id):
        logger.info(
            f"Weight alert frequency cap reached for reptile {reptile.id} "
            f"(alert sent within 7 days)"
        )
        return None

    # Calculate time span between measurements
    time_span = (weight_log.measured_at - baseline_log.measured_at).days

    # Build alert context
    context = {
        "reptile_id": reptile.id,
        "reptile_name": reptile.name,
        "baseline_weight": baseline_log.weight_grams,
        "current_weight": weight_log.weight_grams,
        "weight_change_grams": change["change_grams"],
        "weight_change_percent": change["change_percent"],
        "change_direction": change["direction"],
        "time_span_days": time_span,
        "threshold_percent": threshold,
        "weight_log_id": weight_log.id,
        "baseline_log_id": baseline_log.id,
    }

    logger.info(
        f"Weight alert triggered for reptile {reptile.name}: "
        f"{change['change_percent']}% {change['direction']} over {time_span} days"
    )

    return context
