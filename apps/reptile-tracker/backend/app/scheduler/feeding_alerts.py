"""
Feeding change alert detection using insect nutritional multipliers.

Normalizes all insect quantities to cricket-equivalents for accurate trend comparison.
Detects both "eating less" (quantity decline) and "no feedings logged" (absence of data).
Respects cooldowns via ChangeAlertTracking.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.models import (
    Feeding,
    feeding_foods,
    Food,
    Reptile,
    ChangeAlertConfig,
    ChangeAlertTracking,
)


# Cricket-equivalent multipliers for insect nutritional value
# Based on nutritional density (protein + fat content relative to crickets)
# Source: https://entomofarms.com/comparing-nutritional-value-feeder-insects-nutritional-breakdown/
INSECT_NUTRITIONAL_MULTIPLIERS = {
    # Crickets are the baseline
    "cricket": 1.0,
    "house cricket": 1.0,
    "banded cricket": 1.0,

    # Dubia roaches (high protein, moderate fat)
    "dubia": 5.6,  # 3 large dubias = ~16.8 cricket-equivalents
    "dubia roach": 5.6,

    # Other roaches
    "discoid roach": 5.5,
    "red runner": 5.2,
    "hissing roach": 5.8,

    # Worms (high fat, lower protein than roaches)
    "superworm": 2.8,
    "super worm": 2.8,
    "mealworm": 1.4,
    "hornworm": 0.8,
    "waxworm": 0.7,
    "silkworm": 1.2,
    "butterworm": 0.9,

    # Flies
    "black soldier fly larvae": 1.5,
    "bsfl": 1.5,
    "fruit fly": 0.1,

    # Other feeders
    "grasshopper": 1.8,
    "locust": 2.0,
}


def extract_species(food_name: str) -> Optional[str]:
    """
    Extract insect species from food name for multiplier lookup.

    Examples:
        "Small Dubia" -> "dubia"
        "Large Cricket" -> "cricket"
        "Mealworm" -> "mealworm"

    Returns:
        Lowercase species key if found in INSECT_NUTRITIONAL_MULTIPLIERS, else None
    """
    if not food_name:
        return None

    food_lower = food_name.lower()

    # Check for exact matches first
    if food_lower in INSECT_NUTRITIONAL_MULTIPLIERS:
        return food_lower

    # Check for partial matches (e.g., "Large Dubia" contains "dubia")
    for species in INSECT_NUTRITIONAL_MULTIPLIERS.keys():
        if species in food_lower:
            return species

    return None


def normalize_insect_quantity(food_name: str, quantity: int) -> float:
    """
    Convert insect quantity to cricket-equivalents using nutritional multipliers.

    Args:
        food_name: Name of the food item
        quantity: Number of insects fed

    Returns:
        Cricket-equivalent quantity (0.0 if not an insect or species unknown)

    Example:
        normalize_insect_quantity("Large Dubia", 3) -> 16.8
    """
    species = extract_species(food_name)
    if not species:
        return 0.0

    multiplier = INSECT_NUTRITIONAL_MULTIPLIERS.get(species, 0.0)
    return quantity * multiplier


def get_insect_feedings_in_period(
    db: Session,
    reptile_id: int,
    start_date: datetime,
    end_date: datetime
) -> float:
    """
    Get total cricket-equivalent insects fed in a time period.

    Excludes salad/vegetable feedings (only counts insects/worms).

    Args:
        db: Database session
        reptile_id: Reptile ID
        start_date: Period start (inclusive)
        end_date: Period end (inclusive)

    Returns:
        Total cricket-equivalents fed in period
    """
    # Query all feedings in period
    feedings = db.query(Feeding).filter(
        and_(
            Feeding.reptile_id == reptile_id,
            Feeding.fed_at >= start_date,
            Feeding.fed_at <= end_date
        )
    ).all()

    total_cricket_equivalents = 0.0

    for feeding in feedings:
        # Get foods for this feeding via the association table
        foods = db.query(Food, feeding_foods.c.quantity).join(
            feeding_foods, Food.id == feeding_foods.c.food_id
        ).filter(
            feeding_foods.c.feeding_id == feeding.id
        ).all()

        for food, quantity in foods:
            # Skip non-insect foods (salad, vegetables, prepared foods)
            if food.food_type not in ["insect", "worms"]:
                continue

            # Normalize to cricket-equivalents
            cricket_equiv = normalize_insect_quantity(food.name, quantity)
            total_cricket_equivalents += cricket_equiv

    return total_cricket_equivalents


def calculate_feeding_trend(
    db: Session,
    reptile_id: int,
    window_days: int = 14
) -> Tuple[float, float, bool]:
    """
    Compare current period feeding quantity vs previous period.

    Args:
        db: Database session
        reptile_id: Reptile ID
        window_days: Number of days in each period (default 14)

    Returns:
        Tuple of (current_period_quantity, previous_period_quantity, has_current_feedings)

    Example:
        (42.0, 56.0, True) -> Currently eating 42 cricket-equiv, previously 56
        (0.0, 0.0, False) -> No feedings logged in current period
    """
    now = datetime.now(timezone.utc)

    # Current period: last window_days
    current_end = now
    current_start = now - timedelta(days=window_days)

    # Previous period: window_days before current period
    previous_end = current_start
    previous_start = current_start - timedelta(days=window_days)

    current_quantity = get_insect_feedings_in_period(db, reptile_id, current_start, current_end)
    previous_quantity = get_insect_feedings_in_period(db, reptile_id, previous_start, previous_end)

    # Check if there are ANY feedings in current period (not just insects)
    has_current_feedings = db.query(Feeding).filter(
        and_(
            Feeding.reptile_id == reptile_id,
            Feeding.fed_at >= current_start,
            Feeding.fed_at <= current_end
        )
    ).count() > 0

    return (current_quantity, previous_quantity, has_current_feedings)


def check_feeding_alert(
    db: Session,
    reptile_id: int,
    user_id: int
) -> Optional[dict]:
    """
    Check if feeding alert should be triggered for a reptile.

    Returns alert details if triggered, None if no alert needed.

    Alert conditions:
    1. "No feedings logged" - No feeding logs in current period
    2. "Eating less" - Insect quantity decreased by threshold %

    Respects:
    - Per-reptile config (ChangeAlertConfig) - ONLY source of truth
    - Cooldown period (ChangeAlertTracking)

    Returns:
        dict with keys: alert_type, message, current_quantity, previous_quantity, threshold_percent
        None if no alert needed
    """
    # Get per-reptile config - this is the ONLY source of truth
    config = db.query(ChangeAlertConfig).filter(
        and_(
            ChangeAlertConfig.reptile_id == reptile_id,
            ChangeAlertConfig.alert_type == "feeding"
        )
    ).first()

    # If no config exists or disabled, alerts not enabled for this reptile
    if not config or not config.enabled:
        return None

    # Use config values with hardcoded fallbacks
    window_days = config.window_days if config.window_days is not None else 14
    threshold_percent = config.threshold_decrease if config.threshold_decrease is not None else 30
    cooldown_days = config.cooldown_days if config.cooldown_days is not None else 7

    # Check cooldown
    tracking = db.query(ChangeAlertTracking).filter(
        and_(
            ChangeAlertTracking.reptile_id == reptile_id,
            ChangeAlertTracking.alert_type == "feeding"
        )
    ).first()

    if tracking and tracking.last_alert_at:
        time_since_alert = datetime.now(timezone.utc) - tracking.last_alert_at
        if time_since_alert.days < cooldown_days:
            return None  # Still in cooldown

    # Calculate trend
    current_qty, previous_qty, has_current_feedings = calculate_feeding_trend(db, reptile_id, window_days)

    # Alert 1: No feedings logged at all
    if not has_current_feedings:
        reptile = db.query(Reptile).filter(Reptile.id == reptile_id).first()
        if not reptile:
            return None

        return {
            "trigger_type": "feeding_none_logged",
            "message": f"{reptile.name} has no feeding logs in the last {window_days} days.",
            "current_quantity": 0.0,
            "previous_quantity": previous_qty,
            "threshold_percent": None,
            "window_days": window_days,
        }

    # Alert 2: Eating less (only if there was previous data)
    if previous_qty > 0:
        percent_change = ((current_qty - previous_qty) / previous_qty) * 100

        # Negative change means eating less
        if percent_change < 0 and abs(percent_change) >= threshold_percent:
            reptile = db.query(Reptile).filter(Reptile.id == reptile_id).first()
            if not reptile:
                return None

            return {
                "trigger_type": "feeding_decrease",
                "message": f"{reptile.name} is eating {abs(percent_change):.1f}% less insects than the previous {window_days}-day period (current: {current_qty:.1f} cricket-equiv, previous: {previous_qty:.1f} cricket-equiv).",
                "current_quantity": current_qty,
                "previous_quantity": previous_qty,
                "threshold_percent": threshold_percent,
                "percent_change": percent_change,
                "window_days": window_days,
            }

    return None


def update_feeding_alert_tracking(
    db: Session,
    reptile_id: int,
    context: dict
) -> None:
    """
    Update tracking record with new feeding alert timestamp.

    Args:
        db: Database session
        reptile_id: Reptile ID
        context: Alert context dict containing alert details
    """
    tracking = db.query(ChangeAlertTracking).filter(
        and_(
            ChangeAlertTracking.reptile_id == reptile_id,
            ChangeAlertTracking.alert_type == "feeding"
        )
    ).first()

    now = datetime.now(timezone.utc)

    if tracking:
        tracking.last_alert_at = now
        tracking.last_alert_context = context
        tracking.updated_at = now
    else:
        tracking = ChangeAlertTracking(
            reptile_id=reptile_id,
            alert_type="feeding",
            last_alert_at=now,
            last_alert_context=context
        )
        db.add(tracking)

    db.flush()
