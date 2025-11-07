"""
Cleanup function to remove duplicate and malformed schedule templates.
Can be imported and called from startup or run as a standalone script.
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models import ScheduleTemplate


async def cleanup_duplicate_templates(session: AsyncSession) -> int:
    """
    Remove duplicate and malformed schedule templates.
    Returns the number of templates deleted.
    """
    deleted_count = 0

    # Get all templates
    result = await session.execute(
        select(ScheduleTemplate).where(ScheduleTemplate.is_default == True).order_by(ScheduleTemplate.name)
    )
    templates = result.scalars().all()

    templates_to_delete = []

    # Approved sources
    approved_sources = [
        'ReptiFiles',
        'The Bio Dude',
        'Reptile Magazine',
        'Tropical Species',
        'Juvenile Weekly Weighing (General)',
        'Adult Monthly Weighing (General)',
        'Juvenile',  # For weighing templates like "Juvenile - Weekly Weighing"
        'Adult',     # For weighing templates like "Adult - Monthly Weighing"
    ]

    for template in templates:
        # Extract source from name
        parts = template.name.split(' - ')

        # Check for templates without proper source prefix (no dash at all)
        if len(parts) < 2:
            # Check if it starts with an approved source but is missing dash
            found_approved = False
            for approved_source in approved_sources:
                if template.name.startswith(approved_source + ' ') and approved_source in ['Tropical Species', 'The Bio Dude', 'Reptile Magazine']:
                    templates_to_delete.append(template)
                    found_approved = True
                    break

            # If it doesn't start with approved source at all, it's an old template
            if not found_approved:
                templates_to_delete.append(template)
            continue

        if len(parts) >= 2:
            source = parts[0].strip()

            # Check for problematic sources
            if source not in approved_sources:
                # Flag potential duplicates like "Juvenile bearded dragon", "Juvenile leopard gecko"
                if any(keyword in source.lower() for keyword in ['juvenile', 'adult', 'hatchling', 'bearded', 'leopard', 'gecko', 'dragon', 'python', 'snake', 'skink']):
                    templates_to_delete.append(template)
                # Flag supplement templates with incorrect naming
                elif template.schedule_type == 'supplement':
                    templates_to_delete.append(template)

    # Find exact duplicate names
    name_counts = {}
    for template in templates:
        if template.name not in name_counts:
            name_counts[template.name] = []
        name_counts[template.name].append(template)

    for name, temps in name_counts.items():
        if len(temps) > 1:
            # Sort by created_at to keep the oldest one
            temps_sorted = sorted(temps, key=lambda t: t.created_at or '9999-12-31')
            for i, t in enumerate(temps_sorted):
                # Keep the first one (oldest), delete the rest
                if i > 0 and t not in templates_to_delete:
                    templates_to_delete.append(t)

    # Find semantic duplicates (same configuration, different names)
    seen_combinations = {}
    for template in templates:
        parts = template.name.split(' - ')
        source = parts[0].strip() if len(parts) >= 2 else 'Unknown'

        key = (
            source,
            template.species,
            template.age_category,
            template.schedule_type,
            template.schedule_rule,
            template.frequency_days,
            template.days_of_week,
            template.food_category,
            template.time_slot,
        )

        if key in seen_combinations:
            if template not in templates_to_delete:
                templates_to_delete.append(template)
        else:
            seen_combinations[key] = template

    # Delete all identified templates
    if templates_to_delete:
        for template in templates_to_delete:
            await session.delete(template)
        await session.commit()
        deleted_count = len(templates_to_delete)

    return deleted_count
