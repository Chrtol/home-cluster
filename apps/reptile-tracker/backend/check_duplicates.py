#!/usr/bin/env python3
"""Check for duplicate schedule templates in the database"""

import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func
from app.models import ScheduleTemplate

async def check_duplicates():
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

        # Group by name to find duplicates
        by_name = {}
        for template in templates:
            if template.name not in by_name:
                by_name[template.name] = []
            by_name[template.name].append(template)

        # Show duplicates
        duplicates = {name: temps for name, temps in by_name.items() if len(temps) > 1}

        if duplicates:
            print(f"FOUND {len(duplicates)} DUPLICATE TEMPLATE NAMES:\n")
            for name, temps in duplicates.items():
                print(f"  '{name}' appears {len(temps)} times:")
                for t in temps:
                    print(f"    - ID: {t.id}, Species: {t.species}, Age: {t.age_category}, Type: {t.schedule_type}, Default: {t.is_default}")
                print()
        else:
            print("No duplicate names found.\n")

        # Show all templates grouped by source
        print(f"\n{'='*80}")
        print("ALL TEMPLATES GROUPED BY SOURCE:")
        print(f"{'='*80}\n")

        by_source = {}
        for template in templates:
            parts = template.name.split(' - ')
            source = parts[0] if len(parts) >= 2 else "No Source"
            if source not in by_source:
                by_source[source] = []
            by_source[source].append(template)

        for source in sorted(by_source.keys()):
            temps = by_source[source]
            print(f"{source} ({len(temps)} templates):")
            for t in temps:
                print(f"  - {t.name}")
                print(f"    Species: {t.species}, Age: {t.age_category}, Type: {t.schedule_type}")
            print()

if __name__ == "__main__":
    asyncio.run(check_duplicates())
