"""
Helper functions for calculating feeding rotations (supplements and food replacements)
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models import FeedingRotation, Feeding


async def count_feedings_for_reptile(
    db: AsyncSession,
    reptile_id: int,
    category_filter: Optional[str] = None,
    counting_mode: str = "category_only"
) -> int:
    """
    Count feedings for a reptile based on filtering criteria.

    Args:
        db: Database session
        reptile_id: ID of the reptile
        category_filter: Food category to filter by (e.g., "insects", "salad")
                        If None or "all", counts all feedings
        counting_mode: "category_only" or "all_feedings"
                      - category_only: Count only feedings matching category_filter
                      - all_feedings: Count all feedings regardless of category

    Returns:
        Number of feedings that match the criteria
    """
    query = select(func.count(Feeding.id)).where(Feeding.reptile_id == reptile_id)

    # Apply category filter if in category_only mode and filter is specified
    if counting_mode == "category_only" and category_filter and category_filter != "all":
        # Note: This is a simplified check. In reality, we'd need to join with
        # feeding_foods table to check the actual food category of what was fed.
        # For now, we'll count all feedings and let the frontend/user be responsible
        # for proper categorization. This can be enhanced later.
        pass  # TODO: Implement proper category filtering with join

    result = await db.execute(query)
    return result.scalar() or 0


async def get_applicable_rotations(
    db: AsyncSession,
    reptile_id: int,
    food_category: Optional[str] = None
) -> List[FeedingRotation]:
    """
    Get all enabled feeding rotations for a reptile that apply to the given food category.

    Args:
        db: Database session
        reptile_id: ID of the reptile
        food_category: Category of food being fed (e.g., "insects", "salad")

    Returns:
        List of applicable FeedingRotation objects, sorted by priority
    """
    query = (
        select(FeedingRotation)
        .where(
            FeedingRotation.reptile_id == reptile_id,
            FeedingRotation.enabled == True
        )
    )

    result = await db.execute(query)
    all_rotations = result.scalars().all()

    # Filter rotations by category applicability
    applicable = []
    for rotation in all_rotations:
        applies_to = rotation.applies_to_category

        # Rotation applies if:
        # 1. applies_to_category is None or "all" (applies to everything)
        # 2. applies_to_category matches the food_category
        if not applies_to or applies_to == "all" or applies_to == food_category:
            applicable.append(rotation)

    # Sort by priority (lower number = higher priority)
    applicable.sort(key=lambda r: r.priority)

    return applicable


async def calculate_rotation_for_feeding(
    db: AsyncSession,
    reptile_id: int,
    food_category: Optional[str] = None,
    feeding_date: Optional[date] = None
) -> List[Dict[str, Any]]:
    """
    Calculate which rotations (supplements or food replacements) should apply to the next feeding.
    Returns ALL applicable rotations, not just the highest priority one.

    Args:
        db: Database session
        reptile_id: ID of the reptile
        food_category: Category of food being fed (e.g., "insects", "salad")

    Returns:
        List of dictionaries with rotation details (empty list if none apply):
        [
            {
                "rotation_id": int,
                "rotation_type": "supplement" or "food_replacement",
                "supplement_id": int (if supplement rotation),
                "replacement_food_category": str (if food replacement),
                "replacement_note": str (if food replacement),
                "priority": int,
                "notes": str,
                "feeding_number": int,
                "every_n_feedings": int
            },
            ...
        ]
    """
    # Get all applicable rotations for this reptile and food category
    rotations = await get_applicable_rotations(db, reptile_id, food_category)

    if not rotations:
        return []

    # Use today if no date provided
    if feeding_date is None:
        feeding_date = date.today()

    # Get the day of week (0 = Monday, 6 = Sunday in Python, but we'll use 0 = Sunday like JS)
    # Convert Python's Monday=0 to Sunday=0 format
    day_of_week = (feeding_date.weekday() + 1) % 7  # 0 = Sunday, 1 = Monday, etc.

    applicable_rotations = []

    # Check each rotation to see if it triggers on the next feeding
    for rotation in rotations:
        should_trigger = False
        result = {
            "rotation_id": rotation.id,
            "rotation_type": rotation.rotation_type,
            "priority": rotation.priority,
            "notes": rotation.notes,
            "trigger_mode": rotation.trigger_mode,
        }

        # Handle feeding_count trigger mode
        if rotation.trigger_mode == "feeding_count":
            # Determine the category filter for counting
            if rotation.counting_mode == "all_feedings":
                category_filter = None  # Count all feedings
            else:
                # Count only feedings matching the rotation's category filter
                category_filter = rotation.applies_to_category

            # Get current feeding count
            feeding_count = await count_feedings_for_reptile(
                db, reptile_id, category_filter, rotation.counting_mode
            )

            # Next feeding will be feeding_count + 1
            next_feeding_number = feeding_count + 1

            # Check if this rotation should trigger on the next feeding
            if next_feeding_number % rotation.every_n_feedings == 0:
                should_trigger = True
                result["feeding_number"] = next_feeding_number
                result["every_n_feedings"] = rotation.every_n_feedings

        # Handle schedule_based trigger mode
        elif rotation.trigger_mode == "schedule_based":
            if rotation.schedule_days_of_week:
                # Check if today's day of week matches
                configured_days = [int(d) for d in rotation.schedule_days_of_week.split(",")]
                if day_of_week in configured_days:
                    should_trigger = True
                    result["schedule_days_of_week"] = rotation.schedule_days_of_week

        if should_trigger:
            # Add supplement or food replacement info
            if rotation.rotation_type == "supplement":
                result["supplement_id"] = rotation.supplement_id
            elif rotation.rotation_type == "food_replacement":
                result["replacement_food_category"] = rotation.replacement_food_category
                result["replacement_note"] = rotation.replacement_note

            applicable_rotations.append(result)

    # Sort by priority (lower number = higher priority) before returning
    applicable_rotations.sort(key=lambda r: r["priority"])

    return applicable_rotations


async def get_rotation_preview(
    db: AsyncSession,
    reptile_id: int,
    food_category: Optional[str] = None,
    preview_count: int = 10
) -> List[Dict[str, Any]]:
    """
    Preview upcoming feeding rotations showing a realistic schedule.
    Shows all food categories with their applicable supplements for the next N days.

    Args:
        db: Database session
        reptile_id: ID of the reptile
        food_category: If specified, only preview this category. If None, show all categories.
        preview_count: Number of future days to preview

    Returns:
        List of dictionaries with date and feedings:
        [
            {
                "date": "2025-01-20",
                "date_display": "Mon, Jan 20",
                "feedings": [
                    {
                        "food_category": "insects",
                        "supplements": [
                            {"id": 1, "name": "Calcium powder"},
                            {"id": 2, "name": "Multivitamin"}
                        ]
                    },
                    {
                        "food_category": "salad",
                        "supplements": [...]
                    }
                ]
            },
            ...
        ]
    """
    from datetime import timedelta
    from sqlalchemy.orm import selectinload

    # Get all rotations for this reptile
    query = (
        select(FeedingRotation)
        .where(
            FeedingRotation.reptile_id == reptile_id,
            FeedingRotation.enabled == True
        )
        .options(selectinload(FeedingRotation.supplement))
    )
    result = await db.execute(query)
    all_rotations = result.scalars().all()

    if not all_rotations:
        return []

    # Determine which food categories to show
    if food_category and food_category != "all":
        categories = [food_category]
    else:
        # Show all categories that have rotations
        categories_set = set()
        for rotation in all_rotations:
            if rotation.applies_to_category:
                categories_set.add(rotation.applies_to_category)
        # Default to insects and salad if no specific categories
        categories = list(categories_set) if categories_set else ["insects", "salad"]

    # Get feeding counts for each category
    feeding_counts = {}
    for category in categories:
        count = await count_feedings_for_reptile(db, reptile_id, category, "category_only")
        feeding_counts[category] = count

    # Generate preview for next N days
    preview = []
    today = date.today()

    for i in range(preview_count):
        preview_date = today + timedelta(days=i)
        day_of_week = (preview_date.weekday() + 1) % 7  # 0 = Sunday

        feedings = []

        for category in categories:
            # Increment feeding count for this preview
            feeding_counts[category] += 1
            next_feeding_number = feeding_counts[category]

            # Find applicable supplements for this category and date
            supplements = []

            for rotation in all_rotations:
                # Check if rotation applies to this category
                applies = (
                    rotation.rotation_type == "supplement" and
                    (not rotation.applies_to_category or
                     rotation.applies_to_category == "all" or
                     rotation.applies_to_category == category)
                )

                if not applies:
                    continue

                # Check trigger conditions
                should_trigger = False

                if rotation.trigger_mode == "feeding_count":
                    if next_feeding_number % rotation.every_n_feedings == 0:
                        should_trigger = True

                elif rotation.trigger_mode == "schedule_based":
                    if rotation.schedule_days_of_week:
                        configured_days = [int(d) for d in rotation.schedule_days_of_week.split(",")]
                        if day_of_week in configured_days:
                            should_trigger = True

                if should_trigger and rotation.supplement:
                    supplements.append({
                        "id": rotation.supplement.id,
                        "name": rotation.supplement.name,
                        "priority": rotation.priority
                    })

            # Sort supplements by priority
            supplements.sort(key=lambda s: s["priority"])

            if supplements:  # Only add feeding if there are supplements
                feedings.append({
                    "food_category": category,
                    "feeding_number": next_feeding_number,
                    "supplements": supplements
                })

        if feedings:  # Only add day if there are feedings
            preview.append({
                "date": preview_date.isoformat(),
                "date_display": preview_date.strftime("%a, %b %d"),
                "day_of_week": day_of_week,
                "feedings": feedings
            })

    return preview
