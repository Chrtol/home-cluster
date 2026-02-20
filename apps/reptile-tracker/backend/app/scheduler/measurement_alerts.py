"""
Measurement change alert detection for Phase 28.

Key concepts:
- Compare new measurement against rolling average of last N measurements
- Support both percentage and absolute thresholds (per CONTEXT.md)
- Default to percentage thresholds
- User selects which measurement types to alert on
- Alerts are neutral observations (increase/decrease, no value judgment)
- Rolling average window configurable (default 3, set to 1 for "previous only")
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Reptile, Measurement, ChangeAlertConfig, ChangeAlertTracking,
    User, reptile_access, AccessLevel
)

logger = logging.getLogger(__name__)

# Standard measurement types the system knows about
STANDARD_MEASUREMENT_TYPES = [
    "svl",           # Snout-vent length
    "total_length",  # Head to tail
    "shell_length",  # For tortoises
    "head_width",
    "body_girth",
    "tail_length",
    "humidity",      # Environmental
    "temperature",   # Environmental
    "weight",        # Note: Weight has its own system but can be tracked here too
]

# Default thresholds by measurement type (Claude's discretion)
DEFAULT_THRESHOLDS: Dict[str, Dict[str, Any]] = {
    "svl": {"type": "percentage", "increase": 10, "decrease": 5},
    "total_length": {"type": "percentage", "increase": 10, "decrease": 5},
    "shell_length": {"type": "percentage", "increase": 10, "decrease": 5},
    "head_width": {"type": "percentage", "increase": 15, "decrease": 10},
    "body_girth": {"type": "percentage", "increase": 15, "decrease": 15},
    "tail_length": {"type": "percentage", "increase": 10, "decrease": 10},
    "humidity": {"type": "absolute", "increase": 15, "decrease": 15},  # 15% humidity points
    "temperature": {"type": "absolute", "increase": 3, "decrease": 3},  # 3 degrees
    "weight": {"type": "percentage", "increase": 10, "decrease": 5},
    # Default for custom/unknown types
    "_default": {"type": "percentage", "increase": 15, "decrease": 15},
}


def get_default_threshold(measurement_type: str) -> Dict[str, Any]:
    """Get default threshold configuration for a measurement type."""
    return DEFAULT_THRESHOLDS.get(measurement_type, DEFAULT_THRESHOLDS["_default"])


async def get_measurement_rolling_average(
    db: AsyncSession,
    reptile_id: int,
    measurement_type: str,
    current_measurement: Measurement,
    window_size: int = 3
) -> tuple[Optional[float], int]:
    """
    Calculate rolling average of last N measurements as baseline.

    Args:
        reptile_id: ID of the reptile
        measurement_type: Type of measurement (svl, total_length, etc.)
        current_measurement: The current measurement being evaluated
        window_size: How many historical points to average (default 3, set to 1 for "previous only")

    Returns:
        Tuple of (average_value, num_measurements_used)
        Returns (None, 0) if no prior measurements exist.
    """
    result = await db.execute(
        select(Measurement.value)
        .where(
            and_(
                Measurement.reptile_id == reptile_id,
                Measurement.measurement_type == measurement_type,
                Measurement.measured_at < current_measurement.measured_at
            )
        )
        .order_by(Measurement.measured_at.desc())
        .limit(window_size)
    )
    values = [row[0] for row in result.fetchall()]

    if not values:
        return None, 0

    return sum(values) / len(values), len(values)


async def get_measurement_alert_config(
    db: AsyncSession,
    reptile_id: int,
    measurement_type: str,
    user_id: int
) -> Dict[str, Any]:
    """
    Get effective measurement alert configuration for a reptile and measurement type.

    ChangeAlertConfig is the ONLY source of truth.
    Returns disabled config if no ChangeAlertConfig exists.
    """
    alert_type = f"measurement_{measurement_type}"

    # Check per-reptile config - this is the ONLY source of truth
    config_result = await db.execute(
        select(ChangeAlertConfig)
        .where(
            and_(
                ChangeAlertConfig.reptile_id == reptile_id,
                ChangeAlertConfig.alert_type == alert_type
            )
        )
    )
    reptile_config = config_result.scalar_one_or_none()

    # Get default thresholds for this type
    defaults = get_default_threshold(measurement_type)

    # Build effective config
    if reptile_config:
        return {
            "enabled": reptile_config.enabled,
            "threshold_type": reptile_config.threshold_type or defaults["type"],
            "threshold_increase": reptile_config.threshold_increase or defaults["increase"],
            "threshold_decrease": reptile_config.threshold_decrease or defaults["decrease"],
            "rolling_window": reptile_config.rolling_average_window if reptile_config.rolling_average_window is not None else 3,
            "cooldown_days": reptile_config.cooldown_days if reptile_config.cooldown_days is not None else 14,
        }
    else:
        # No config = alerts not enabled for this reptile/measurement type
        return {
            "enabled": False,
            "threshold_type": defaults["type"],
            "threshold_increase": defaults["increase"],
            "threshold_decrease": defaults["decrease"],
            "rolling_window": 3,
            "cooldown_days": 14,
        }


async def is_measurement_alert_cap_reached(
    db: AsyncSession,
    reptile_id: int,
    measurement_type: str,
    cooldown_days: int
) -> bool:
    """Check if measurement alert was sent within the cooldown period."""
    if cooldown_days == 0:
        return False  # No cooldown

    alert_type = f"measurement_{measurement_type}"

    result = await db.execute(
        select(ChangeAlertTracking.last_alert_at)
        .where(
            and_(
                ChangeAlertTracking.reptile_id == reptile_id,
                ChangeAlertTracking.alert_type == alert_type
            )
        )
    )
    last_alert = result.scalar_one_or_none()

    if not last_alert:
        return False

    cooldown_cutoff = datetime.now(timezone.utc) - timedelta(days=cooldown_days)
    return last_alert > cooldown_cutoff


async def update_measurement_alert_tracking(
    db: AsyncSession,
    reptile_id: int,
    measurement_type: str,
    context: Dict[str, Any]
) -> None:
    """Update tracking record with new measurement alert timestamp."""
    alert_type = f"measurement_{measurement_type}"

    result = await db.execute(
        select(ChangeAlertTracking)
        .where(
            and_(
                ChangeAlertTracking.reptile_id == reptile_id,
                ChangeAlertTracking.alert_type == alert_type
            )
        )
        .with_for_update()
    )
    record = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if record:
        record.last_alert_at = now
        record.last_alert_context = context
        record.updated_at = now
    else:
        record = ChangeAlertTracking(
            reptile_id=reptile_id,
            alert_type=alert_type,
            last_alert_at=now,
            last_alert_context=context
        )
        db.add(record)

    await db.flush()


def calculate_change(
    baseline: float,
    current: float
) -> Dict[str, Any]:
    """
    Calculate change metrics between baseline and current value.

    Returns:
        {
            "change_absolute": 5.2,
            "change_percent": 8.5,
            "direction": "increase" | "decrease" | "stable"
        }
    """
    if baseline == 0:
        return {
            "change_absolute": current,
            "change_percent": 100.0 if current > 0 else 0.0,
            "direction": "increase" if current > 0 else "stable"
        }

    change = current - baseline
    change_absolute = abs(change)
    change_percent = (change_absolute / baseline) * 100

    if change > 0:
        direction = "increase"
    elif change < 0:
        direction = "decrease"
    else:
        direction = "stable"

    return {
        "change_absolute": round(change_absolute, 2),
        "change_percent": round(change_percent, 1),
        "direction": direction
    }


async def check_measurement_alert(
    db: AsyncSession,
    measurement: Measurement
) -> Optional[Dict[str, Any]]:
    """
    Check if measurement change alert should be sent.

    Returns alert context dict if alert should be sent, None otherwise.
    Does NOT send the alert - caller is responsible for delivery.

    Supports both percentage and absolute thresholds per CONTEXT.md.
    """
    reptile = await db.get(Reptile, measurement.reptile_id)
    if not reptile:
        logger.warning(f"Reptile {measurement.reptile_id} not found for measurement alert check")
        return None

    # Get owner for global settings lookup
    owner_result = await db.execute(
        select(User.id)
        .select_from(reptile_access)
        .join(User, User.id == reptile_access.c.user_id)
        .where(reptile_access.c.reptile_id == measurement.reptile_id)
        .where(reptile_access.c.access_level == AccessLevel.OWNER)
        .limit(1)
    )
    owner_id = owner_result.scalar_one_or_none()

    if not owner_id:
        logger.debug(f"No owner found for reptile {measurement.reptile_id}")
        return None

    # Get effective config for this measurement type
    config = await get_measurement_alert_config(
        db, measurement.reptile_id, measurement.measurement_type, owner_id
    )

    if not config["enabled"]:
        logger.debug(
            f"Measurement alerts disabled for reptile {measurement.reptile_id}, "
            f"type {measurement.measurement_type}"
        )
        return None

    # Check cooldown
    if await is_measurement_alert_cap_reached(
        db, measurement.reptile_id, measurement.measurement_type, config["cooldown_days"]
    ):
        logger.debug(
            f"Measurement alert cooldown active for reptile {measurement.reptile_id}, "
            f"type {measurement.measurement_type}"
        )
        return None

    # Get rolling average baseline
    baseline, num_measurements = await get_measurement_rolling_average(
        db=db,
        reptile_id=measurement.reptile_id,
        measurement_type=measurement.measurement_type,
        current_measurement=measurement,
        window_size=config["rolling_window"]
    )

    if baseline is None:
        logger.debug(
            f"First measurement of type {measurement.measurement_type} for reptile "
            f"{measurement.reptile_id}, no baseline for comparison"
        )
        return None

    # Calculate change
    change = calculate_change(baseline, measurement.value)

    if change["direction"] == "stable":
        return None

    # Check threshold based on type (percentage or absolute)
    threshold_key = "threshold_increase" if change["direction"] == "increase" else "threshold_decrease"
    threshold = config[threshold_key]

    if config["threshold_type"] == "percentage":
        exceeds_threshold = change["change_percent"] >= threshold
        threshold_unit = "%"
        change_value_for_message = f"{change['change_percent']}%"
    else:  # absolute
        exceeds_threshold = change["change_absolute"] >= threshold
        threshold_unit = measurement.unit
        change_value_for_message = f"{change['change_absolute']} {measurement.unit}"

    if not exceeds_threshold:
        logger.debug(
            f"Measurement {change['direction']} below threshold for reptile "
            f"{measurement.reptile_id}, type {measurement.measurement_type}"
        )
        return None

    # Format measurement type for display
    display_type = measurement.measurement_type.replace("_", " ").title()
    if measurement.custom_label:
        display_type = measurement.custom_label

    # Build neutral alert message (per CONTEXT.md)
    direction_word = "above" if change["direction"] == "increase" else "below"
    trigger_type = f"measurement_{change['direction']}"

    return {
        "reptile_id": measurement.reptile_id,
        "reptile_name": reptile.name,
        "trigger_type": trigger_type,
        "measurement_type": measurement.measurement_type,
        "measurement_type_display": display_type,
        "baseline_value": round(baseline, 2),
        "current_value": measurement.value,
        "change_absolute": change["change_absolute"],
        "change_percent": change["change_percent"],
        "direction": change["direction"],
        "threshold_type": config["threshold_type"],
        "threshold_value": threshold,
        "measurements_in_baseline": num_measurements,
        "unit": measurement.unit,
        "measurement_id": measurement.id,
        # Neutral message per CONTEXT.md
        "message": (
            f"{display_type} changed {change_value_for_message} {direction_word} "
            f"rolling average ({measurement.value} {measurement.unit} vs "
            f"{round(baseline, 2)} {measurement.unit} average from {num_measurements} measurements)"
        ),
    }


async def check_all_measurement_alerts_for_reptile(
    db: AsyncSession,
    reptile_id: int,
    measurement_types: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Check all configured measurement types for a reptile (used by daily sweep).

    Args:
        reptile_id: ID of the reptile to check
        measurement_types: Optional list of types to check (defaults to all enabled)

    Returns:
        List of alert contexts for alerts that should be sent.
    """
    alerts = []

    # Get the most recent measurement for each enabled type
    # This is for the daily sweep - checking if recent measurements triggered alerts

    # First, find which types have recent measurements (last 24 hours)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    result = await db.execute(
        select(Measurement)
        .where(
            and_(
                Measurement.reptile_id == reptile_id,
                Measurement.measured_at >= cutoff
            )
        )
        .order_by(Measurement.measured_at.desc())
    )
    recent_measurements = result.scalars().all()

    for measurement in recent_measurements:
        if measurement_types and measurement.measurement_type not in measurement_types:
            continue

        alert_context = await check_measurement_alert(db, measurement)
        if alert_context:
            alerts.append(alert_context)

    return alerts
