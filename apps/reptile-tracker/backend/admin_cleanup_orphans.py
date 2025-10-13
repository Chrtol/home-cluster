#!/usr/bin/env python3
"""
Admin script to clean up orphaned reptiles (reptiles without households)
This should be run once to clean up legacy data before enforcing household requirement.
"""
import asyncio
from sqlalchemy import select, delete
from app.database import get_db
from app.models import Reptile, reptile_access


async def cleanup_orphaned_reptiles(dry_run=True):
    """Delete reptiles that don't belong to any household"""
    async for db in get_db():
        # Find orphaned reptiles
        result = await db.execute(
            select(Reptile).where(Reptile.household_id == None)
        )
        orphans = result.scalars().all()

        print(f"\nFound {len(orphans)} orphaned reptiles (no household):")
        for r in orphans:
            print(f"  - ID {r.id}: {r.name} ({r.species})")

        if len(orphans) == 0:
            print("\n✓ No orphaned reptiles found. Database is clean!")
            return

        if dry_run:
            print(f"\n[DRY RUN] Would delete {len(orphans)} reptiles")
            print("Run with dry_run=False to actually delete them")
            return

        # Delete orphaned reptiles
        print(f"\n🗑️  Deleting {len(orphans)} orphaned reptiles...")
        for reptile in orphans:
            # Delete associated access records first
            await db.execute(
                delete(reptile_access).where(reptile_access.c.reptile_id == reptile.id)
            )
            # Delete the reptile
            await db.execute(
                delete(Reptile).where(Reptile.id == reptile.id)
            )

        await db.commit()
        print(f"✓ Successfully deleted {len(orphans)} orphaned reptiles")
        break  # Only use first db session


if __name__ == "__main__":
    import sys

    dry_run = True
    if len(sys.argv) > 1 and sys.argv[1] == "--delete":
        dry_run = False
        print("⚠️  RUNNING IN DELETE MODE - This will permanently delete data!")
    else:
        print("Running in DRY RUN mode (no changes will be made)")
        print("Use --delete flag to actually delete orphaned reptiles")

    asyncio.run(cleanup_orphaned_reptiles(dry_run=dry_run))
