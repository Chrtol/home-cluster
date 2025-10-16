"""
Helper functions for calculating feeding rotations (supplements and food replacements)
"""
from typing import Optional, List, Dict, Any
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
    food_category: Optional[str] = None
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

    applicable_rotations = []

    # Check each rotation to see if it triggers on the next feeding
    for rotation in rotations:
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
            # This rotation triggers! Add it to results
            result = {
                "rotation_id": rotation.id,
                "rotation_type": rotation.rotation_type,
                "priority": rotation.priority,
                "notes": rotation.notes,
                "feeding_number": next_feeding_number,
                "every_n_feedings": rotation.every_n_feedings,
            }

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
    Preview upcoming feeding rotations for the next N feedings.

    Args:
        db: Database session
        reptile_id: ID of the reptile
        food_category: Category of food to preview
        preview_count: Number of future feedings to preview

    Returns:
        List of dictionaries with feeding number and applicable rotation:
        [
            {
                "feeding_number": 16,
                "rotation": {...} or None
            },
            ...
        ]
    """
    # Get current feeding count
    rotations = await get_applicable_rotations(db, reptile_id, food_category)
    if not rotations:
        return []

    # For preview, we'll use the first rotation's counting mode
    # (ideally all rotations for same category should use same mode)
    counting_mode = rotations[0].counting_mode
    category_filter = food_category if counting_mode == "category_only" else None

    current_count = await count_feedings_for_reptile(
        db, reptile_id, category_filter, counting_mode
    )

    preview = []
    for i in range(1, preview_count + 1):
        feeding_number = current_count + i

        # Find which rotation (if any) triggers on this feeding
        applicable_rotation = None
        for rotation in rotations:
            if feeding_number % rotation.every_n_feedings == 0:
                if applicable_rotation is None or rotation.priority < applicable_rotation["priority"]:
                    applicable_rotation = {
                        "rotation_id": rotation.id,
                        "rotation_type": rotation.rotation_type,
                        "supplement_id": rotation.supplement_id,
                        "priority": rotation.priority,
                        "every_n_feedings": rotation.every_n_feedings,
                    }

        preview.append({
            "feeding_number": feeding_number,
            "rotation": applicable_rotation
        })

    return preview
