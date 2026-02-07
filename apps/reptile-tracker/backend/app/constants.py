"""
Shared constants for the reptile tracker application.

This module centralizes display mappings and emoji definitions used across
multiple modules to ensure consistency and avoid duplication.
"""

# Schedule type to emoji mapping
# Used in: scheduler/notifications.py, celery_tasks.py
SCHEDULE_TYPE_EMOJI: dict[str, str] = {
    "feeding": "\U0001F37D\uFE0F",  # Fork and knife with plate (renders as: plate emoji)
    "misting": "\U0001F4A7",        # Droplet
    "weighing": "\u2696\uFE0F",     # Balance scale
    "supplement": "\U0001F48A",     # Pill
}

# Default emoji for unknown schedule types
DEFAULT_SCHEDULE_EMOJI: str = "\U0001F4C5"  # Calendar

# Food category to display name mapping
# Used in: scheduler/notifications.py, celery_tasks.py
FOOD_CATEGORY_DISPLAY: dict[str, str] = {
    "insects": "Insects/Worms",
    "salad": "Salad/Vegetables",
    "frozen": "Frozen Prey (Rodents)",
    "prepared": "Prepared Diet (CGD, Repashy, etc.)",
    "mixed": "Mixed (Multiple Types)",
    "other": "Other",
}


def get_schedule_type_emoji(schedule_type: str) -> str:
    """Get emoji for a schedule type, with fallback to default."""
    return SCHEDULE_TYPE_EMOJI.get(schedule_type, DEFAULT_SCHEDULE_EMOJI)


def get_food_category_display(category: str) -> str:
    """Get display name for a food category, with fallback to title case."""
    return FOOD_CATEGORY_DISPLAY.get(category, category.title() if category else "Unknown")
