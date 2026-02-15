"""
Weight change alert detection and frequency cap tracking for Phase 24.

Key concepts:
- Alerts fire when weight change exceeds threshold percentage
- Separate thresholds for gain vs loss
- Age-aware defaults (juveniles vs adults)
- Weekly frequency cap (max 1 alert per reptile per 7 days)
- Baseline = most recent previous weight log
- First weight log skips alert (no baseline to compare)
- Only triggers on creation, not updates
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Reptile, WeightLog, WeightAlertTracking, User

logger = logging.getLogger(__name__)

# Age-aware default thresholds (from CONTEXT.md)
# Juveniles grow fast - high gain threshold, but any loss is concerning
# Adults are more stable - moderate thresholds for both directions
AGE_AWARE_DEFAULTS: Dict[str, Dict[str, int]] = {
    "hatchling": {"gain": 25, "loss": 0},  # Any loss is concerning for babies
    "juvenile": {"gain": 25, "loss": 0},   # Babies grow fast, any loss alarming
    "adult": {"gain": 10, "loss": 5},      # Loss is more concerning for adults
}


def get_age_category(date_of_birth: Optional[datetime]) -> str:
    """
    Calculate age category from date of birth.
    Matches frontend calculateAgeCategory function.

    Returns:
        "hatchling" (< 6 months), "juvenile" (6-18 months), or "adult" (> 18 months)
    """
    if not date_of_birth:
        return "adult"  # Default to adult if unknown

    now = datetime.now(timezone.utc)
    birth_date = date_of_birth if date_of_birth.tzinfo else date_of_birth.replace(tzinfo=timezone.utc)
    age_in_months = (now - birth_date).days / 30.44

    if age_in_months < 6:
        return "hatchling"
    elif age_in_months < 18:
        return "juvenile"
    return "adult"


def get_age_aware_defaults(date_of_birth: Optional[datetime]) -> Dict[str, int]:
    """Get age-aware default thresholds for a reptile."""
    age_category = get_age_category(date_of_birth)
    return AGE_AWARE_DEFAULTS.get(age_category, AGE_AWARE_DEFAULTS["adult"])


def get_threshold_for_direction(reptile: Reptile, direction: str) -> int:
    """
    Get threshold for specific direction (gain or loss) using age-aware defaults.

    Args:
        reptile: Reptile model instance
        direction: "gain" or "loss"

    Returns:
        Threshold percentage (0 means any change triggers alert)
    """
    # Check for custom threshold first
    if direction == "gain" and reptile.weight_alert_gain_threshold_percent is not None:
        return reptile.weight_alert_gain_threshold_percent
    if direction == "loss" and reptile.weight_alert_loss_threshold_percent is not None:
        return reptile.weight_alert_loss_threshold_percent

    # Fall back to age-aware defaults
    age_category = get_age_category(reptile.date_of_birth)
    return AGE_AWARE_DEFAULTS[age_category][direction]


async def get_rolling_average_baseline(
    db: AsyncSession,
    reptile_id: int,
    current_log: WeightLog
) -> tuple[Optional[float], int]:
    """
    Calculate rolling average of last 3 weights as baseline.

    Per CONTEXT.md:
    - Use rolling average of last 3 weights
    - If fewer than 3 exist, average whatever is available
    - No time limit — always use the 3 most recent regardless of age
    - Current weight is NOT included in baseline

    Returns:
        Tuple of (average_weight_grams, num_weights_used)
        Returns (None, 0) if no prior weights exist.
    """
    result = await db.execute(
        select(WeightLog.weight_grams)
        .where(
            and_(
                WeightLog.reptile_id == reptile_id,
                WeightLog.measured_at < current_log.measured_at
            )
        )
        .order_by(WeightLog.measured_at.desc())
        .limit(3)
    )
    weights = [row[0] for row in result.fetchall()]

    if not weights:
        return None, 0

    return sum(weights) / len(weights), len(weights)


# Legacy function name for backwards compatibility
async def get_baseline_weight(
    db: AsyncSession,
    reptile_id: int,
    current_log: WeightLog
) -> Optional[float]:
    """Get baseline weight (rolling average). Returns weight in grams or None."""
    baseline, _ = await get_rolling_average_baseline(db, reptile_id, current_log)
    return baseline


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

    # Get baseline (rolling average of last 3 weights)
    baseline_weight, num_weights_in_baseline = await get_rolling_average_baseline(db, reptile.id, weight_log)
    if baseline_weight is None:
        logger.info(f"First weight log for reptile {reptile.id}, no baseline for comparison")
        return None

    # Calculate change against rolling average baseline
    change = calculate_weight_change(
        baseline_weight,
        weight_log.weight_grams
    )

    # Get direction-specific threshold (uses age-aware defaults)
    direction = change["direction"]
    threshold = get_threshold_for_direction(reptile, direction)

    # Check if change exceeds threshold
    # Special case: threshold 0 means any change triggers alert
    if threshold == 0:
        should_alert = change["change_percent"] > 0
    else:
        should_alert = change["change_percent"] >= threshold

    if not should_alert:
        logger.debug(
            f"Weight {direction} {change['change_percent']}% below threshold {threshold}% "
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

    # Determine age category and if this is a growth milestone
    age_category = get_age_category(reptile.date_of_birth)
    is_growth_milestone = direction == "gain" and age_category in ["hatchling", "juvenile"]

    # Determine trigger type for notification templates
    if is_growth_milestone:
        trigger_type = "growth_milestone"
    elif direction == "gain":
        trigger_type = "weight_gain"
    else:
        trigger_type = "weight_loss"

    # Build alert context
    context = {
        "reptile_id": reptile.id,
        "reptile_name": reptile.name,
        "baseline_weight": round(baseline_weight, 1),
        "baseline_type": "rolling_average",
        "weights_in_baseline": num_weights_in_baseline,
        "current_weight": weight_log.weight_grams,
        "weight_change_grams": change["change_grams"],
        "weight_change_percent": change["change_percent"],
        "change_direction": direction,
        "threshold_percent": threshold,
        "weight_log_id": weight_log.id,
        "age_category": age_category,
        "is_growth_milestone": is_growth_milestone,
        "trigger_type": trigger_type,
    }

    logger.info(
        f"Weight alert triggered for reptile {reptile.name}: "
        f"{change['change_percent']}% {direction} (trigger: {trigger_type})"
    )

    return context
