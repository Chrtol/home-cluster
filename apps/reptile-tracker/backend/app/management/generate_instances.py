#!/usr/bin/env python3
"""
Management script to generate schedule instances for all schedules.
This can be run manually to populate instances immediately.
"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.instance_generator import generate_instances_for_all_schedules


async def main():
    from app.config import settings

    print("Generating schedule instances for all schedules...")
    print(f"This will create instances for the next {settings.instance_generation_days_ahead} days.")
    print()

    try:
        result = await generate_instances_for_all_schedules()

        print(f"✓ Successfully generated instances!")
        print(f"  - Schedules processed: {result['schedules_processed']}")
        print(f"  - Instances created: {result['instances_created']}")

        return 0
    except Exception as e:
        print(f"✗ Error generating instances: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
