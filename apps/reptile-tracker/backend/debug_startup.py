#!/usr/bin/env python3
import asyncio
import traceback
import sys

from app.database import init_db, async_session_maker
from app.seed_data import seed_database


async def debug_start():
    try:
        print("Running debug startup: init_db()")
        await init_db()
        print("init_db() completed successfully")

        print("Seeding database")
        async with async_session_maker() as session:
            await seed_database(session)
        print("Seeding completed successfully")

    except Exception:
        print("Startup exception:")
        traceback.print_exc()
        # Ensure a non-zero exit code so the pod logs show the failure
        sys.exit(2)


if __name__ == '__main__':
    asyncio.run(debug_start())
