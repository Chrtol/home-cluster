#!/usr/bin/env python3
"""
Cleanup script to remove duplicate schedule templates from the database.
This script will identify and remove non-default templates that appear to be duplicates.
"""

import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete
from app.models import ScheduleTemplate


async def cleanup_duplicates():
    """Remove duplicate schedule templates"""

    # Get database URL from environment or use default
    database_url = os.getenv('DATABASE_URL', 'postgresql+asyncpg://postgres:postgres@localhost:5432/reptile_tracker')

    # Create async engine
    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get all templates
        result = await session.execute(select(ScheduleTemplate).order_by(ScheduleTemplate.name))
        templates = result.scalars().all()

        print(f"\n{'='*80}")
        print(f"Total templates in database: {len(templates)}")
        print(f"{'='*80}\n")

        # Templates to delete (identified duplicates and problematic sources)
        templates_to_delete = []

        # 1. Find templates with problematic sources (not in approved list)
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

            # Check for templates that start with approved source but missing dash
            # e.g., "Tropical Species Evening Misting" should be "Tropical Species - Evening Misting"
            if len(parts) < 2:
                for approved_source in approved_sources:
                    if template.name.startswith(approved_source + ' ') and approved_source in ['Tropical Species', 'The Bio Dude', 'Reptile Magazine']:
                        templates_to_delete.append(template)
                        print(f"⚠️  Found template with missing dash after source:")
                        print(f"    ID: {template.id}, Name: '{template.name}'")
                        print(f"    Should be: '{approved_source} - {template.name[len(approved_source)+1:]}'")
                        print()
                        break

            if len(parts) >= 2:
                source = parts[0].strip()

                # Check for problematic sources
                if source not in approved_sources:
                    # Flag potential duplicates like "Juvenile bearded dragon", "Juvenile leopard gecko"
                    # These are suspicious because the source contains species/age info that should be in separate fields
                    if any(keyword in source.lower() for keyword in ['juvenile', 'adult', 'hatchling', 'bearded', 'leopard', 'gecko', 'dragon', 'python', 'snake', 'skink']):
                        templates_to_delete.append(template)
                        print(f"⚠️  Found suspicious template (source contains species/age info):")
                        print(f"    ID: {template.id}, Name: '{template.name}'")
                        print(f"    Source: '{source}', Species: {template.species}, Default: {template.is_default}")
                        print()

                    # Flag supplement templates with incorrect naming (should be "ReptiFiles - ..." not "Calcium with D3 - ...")
                    elif template.schedule_type == 'supplement':
                        templates_to_delete.append(template)
                        print(f"⚠️  Found supplement template with incorrect naming:")
                        print(f"    ID: {template.id}, Name: '{template.name}'")
                        print(f"    Source: '{source}', Should be prefixed with 'ReptiFiles' or other proper source")
                        print()

        # 2. Find exact duplicate names
        name_counts = {}
        for template in templates:
            if template.name not in name_counts:
                name_counts[template.name] = []
            name_counts[template.name].append(template)

        for name, temps in name_counts.items():
            if len(temps) > 1:
                print(f"⚠️  Found {len(temps)} templates with same name: '{name}'")
                # Sort by created_at to keep the oldest one
                temps_sorted = sorted(temps, key=lambda t: t.created_at or '9999-12-31')
                for i, t in enumerate(temps_sorted):
                    print(f"    ID: {t.id}, Default: {t.is_default}, Created: {t.created_at}")
                    # Keep the first one (oldest), delete the rest
                    if i > 0 and t not in templates_to_delete:
                        templates_to_delete.append(t)
                        print(f"    ⚠️  Marking for deletion (duplicate)")
                print()

        # 3. Find semantic duplicate weighing templates
        # e.g., "Juvenile Weekly Weighing (General)" vs "Juvenile - Weekly Weighing"
        weighing_templates = [t for t in templates if t.schedule_type == 'weighing']
        weighing_groups = {}

        for template in weighing_templates:
            key = (
                template.age_category,
                template.frequency_days,
                template.days_of_week,
                template.schedule_rule,
            )

            if key not in weighing_groups:
                weighing_groups[key] = []
            weighing_groups[key].append(template)

        for key, temps in weighing_groups.items():
            if len(temps) > 1:
                age_cat, freq_days, days_of_week, rule = key
                print(f"⚠️  Found {len(temps)} similar weighing templates:")
                print(f"    Age: {age_cat}, Frequency: {freq_days} days, Rule: {rule}")

                # Prefer templates with proper source naming (e.g., "Juvenile - Weekly Weighing")
                temps_sorted = sorted(temps, key=lambda t: (
                    not t.name.startswith('Juvenile - ') and not t.name.startswith('Adult - '),  # Prefer "Juvenile - " format
                    t.created_at or '9999-12-31'
                ))

                for i, t in enumerate(temps_sorted):
                    print(f"    ID: {t.id}, Name: '{t.name}', Default: {t.is_default}")
                    # Keep the first one, delete the rest
                    if i > 0 and t not in templates_to_delete:
                        templates_to_delete.append(t)
                        print(f"    ⚠️  Marking for deletion (duplicate weighing template)")
                print()

        # 4. Find very similar templates (same source, species, age, type)
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
                template.food_category,  # Include food category to distinguish feeding vs salad
                template.time_slot,      # Include time slot to distinguish morning vs evening misting
            )

            if key in seen_combinations:
                print(f"⚠️  Found similar template (possible duplicate):")
                print(f"    Existing: '{seen_combinations[key].name}' (ID: {seen_combinations[key].id}, Default: {seen_combinations[key].is_default})")
                print(f"    Duplicate: '{template.name}' (ID: {template.id}, Default: {template.is_default})")
                if template not in templates_to_delete:
                    templates_to_delete.append(template)
                    print(f"    ⚠️  Marking for deletion (similar template)")
                print()
            else:
                seen_combinations[key] = template

        # Summary
        print(f"\n{'='*80}")
        print(f"SUMMARY")
        print(f"{'='*80}\n")
        print(f"Found {len(templates_to_delete)} templates to delete:")
        for t in templates_to_delete:
            print(f"  - ID {t.id}: {t.name}")

        if templates_to_delete:
            print(f"\n⚠️  This will DELETE {len(templates_to_delete)} templates!")
            print("Run this script with CONFIRM=yes to proceed with deletion:")
            print(f"  CONFIRM=yes python3 cleanup_duplicate_templates.py")

            # Check if user confirmed
            if os.getenv('CONFIRM') == 'yes':
                print("\n🗑️  Deleting templates...")
                for template in templates_to_delete:
                    print(f"  Deleting: {template.name} (ID: {template.id})")
                    await session.delete(template)

                await session.commit()
                print(f"\n✅ Successfully deleted {len(templates_to_delete)} duplicate templates!")
            else:
                print("\n❌ Deletion cancelled. No templates were deleted.")
        else:
            print("\n✅ No duplicate templates found!")

        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(cleanup_duplicates())
