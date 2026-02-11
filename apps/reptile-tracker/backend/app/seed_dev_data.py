"""
Seed realistic test data for development environment

Only runs when:
1. settings.environment == "development"
2. No reptiles exist in the database (idempotent)

Creates:
- Dev user (dev@local.dev) and household - matches auth.py dev bypass
- 4 reptiles with different species
- 60-90 days of activity history per reptile
- Schedules with instances (including 1 overdue)
- Edge cases: 1 reptile in shed, 1 with overdue task
"""
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from faker import Faker

from app.config import settings
from app.models import (
    User, Household, Reptile, Feeding, WeightLog, HealthRecord,
    Schedule, ScheduleInstance, Food, Supplement,
    household_members, reptile_access, feeding_foods,
    AccessLevel, ScheduleMode, InstanceStatus
)

logger = logging.getLogger(__name__)

# Initialize Faker with seed for reproducible data
fake = Faker()
Faker.seed(42)

# Reptile configurations
reptile_configs = [
    {
        "name": "Spike",
        "species": "Bearded Dragon",
        "age_category": "adult",
        "sex": "male",
        "avatar_border_color": "#F59E0B",  # Amber
        "base_weight": 450,
        "current_weight": 480,
        "feeding_interval_days": 2,  # Adult beardies eat every other day
        "is_overdue": True,  # Edge case: has overdue feeding task
    },
    {
        "name": "Luna",
        "species": "Leopard Gecko",
        "age_category": "adult",
        "sex": "female",
        "avatar_border_color": "#8B5CF6",  # Purple
        "base_weight": 55,
        "current_weight": 62,
        "feeding_interval_days": 3,  # Adult leos eat every 3 days
    },
    {
        "name": "Monty",
        "species": "Ball Python",
        "age_category": "juvenile",
        "sex": "male",
        "avatar_border_color": "#10B981",  # Green
        "base_weight": 350,
        "current_weight": 420,
        "feeding_interval_days": 7,  # Weekly for juvenile ball pythons
    },
    {
        "name": "Cleo",
        "species": "Crested Gecko",
        "age_category": "adult",
        "sex": "female",
        "avatar_border_color": "#EC4899",  # Pink
        "base_weight": 38,
        "current_weight": 42,
        "feeding_interval_days": 2,  # CGD every 2-3 days
        "is_in_shed": True,  # Edge case: currently shedding
    },
]


async def create_dev_user_and_household(db: AsyncSession) -> tuple[User, Household]:
    """Create dev household and user"""
    # Create household
    household = Household(name="Dev Household")
    db.add(household)
    await db.flush()

    # Create user - must match auth.py dev bypass credentials
    # auth.py looks for email="dev@local.dev" and creates oidc_sub="dev-bypass-local"
    user = User(
        oidc_sub="dev-bypass-local",
        email="dev@local.dev",
        name="Local Developer",
        timezone="America/New_York"
    )
    db.add(user)
    await db.flush()

    # Add user to household with owner access
    await db.execute(
        household_members.insert().values(
            household_id=household.id,
            user_id=user.id,
            access_level=AccessLevel.OWNER
        )
    )

    return user, household


async def get_foods_by_category(db: AsyncSession) -> dict[str, list[Food]]:
    """Query all foods from database and group by category"""
    result = await db.execute(select(Food))
    all_foods = result.scalars().all()

    # Group by category
    foods_by_category = {
        "insects": [],
        "vegetables": [],
        "frozen_animal": [],
        "prepared": [],
    }

    for food in all_foods:
        if food.category.value == "insect":
            foods_by_category["insects"].append(food)
        elif food.category.value in ["vegetable", "fruit"]:
            foods_by_category["vegetables"].append(food)
        elif food.category.value == "frozen_animal":
            foods_by_category["frozen_animal"].append(food)
        elif food.category.value == "prepared":
            foods_by_category["prepared"].append(food)

    return foods_by_category


def generate_weight_progression(start_weight: float, end_weight: float, days_back: int = 90, measurements: int = 12) -> list[tuple[datetime, float]]:
    """
    Generate weight measurements over time with linear progression and variation

    Returns list of (date, weight) tuples
    """
    weight_data = []
    weight_increment = (end_weight - start_weight) / measurements

    for i in range(measurements):
        # Calculate days back for this measurement
        days_offset = days_back - (i * (days_back // measurements))
        measurement_date = datetime.now(timezone.utc) - timedelta(days=days_offset)

        # Calculate weight with linear progression + random variation
        base_weight = start_weight + (weight_increment * i)
        variation = fake.random_int(-5, 5) / 10  # +/- 0.5g variation
        weight = base_weight + variation

        weight_data.append((measurement_date, weight))

    return weight_data


async def create_reptile_with_access(db: AsyncSession, config: dict, user: User, household: Household) -> Reptile:
    """Create reptile and grant user access"""
    reptile = Reptile(
        name=config["name"],
        species=config["species"],
        age_category=config["age_category"],
        sex=config["sex"],
        avatar_border_color=config["avatar_border_color"],
        household_id=household.id,
        is_active=True
    )
    db.add(reptile)
    await db.flush()

    # Grant user owner access
    await db.execute(
        reptile_access.insert().values(
            user_id=user.id,
            reptile_id=reptile.id,
            access_level=AccessLevel.OWNER
        )
    )

    return reptile


async def create_feedings_history(db: AsyncSession, reptile: Reptile, user: User, foods: dict, days_back: int = 90):
    """Generate realistic feeding history based on species"""
    feeding_interval = None
    food_selection = None

    # Determine feeding pattern by species
    if reptile.species == "Bearded Dragon":
        feeding_interval = 2  # Every other day
        # Mix of insects and vegetables
        food_selection = {
            "insects": foods["insects"][:3] if foods["insects"] else [],
            "vegetables": foods["vegetables"][:5] if foods["vegetables"] else [],
        }
    elif reptile.species == "Leopard Gecko":
        feeding_interval = 3  # Every 3 days
        # Insects only
        food_selection = {
            "insects": foods["insects"][:3] if foods["insects"] else [],
        }
    elif reptile.species == "Ball Python":
        feeding_interval = 7  # Weekly
        # Frozen rodents
        food_selection = {
            "frozen_animal": foods["frozen_animal"][:2] if foods["frozen_animal"] else [],
        }
    elif reptile.species == "Crested Gecko":
        feeding_interval = 2  # Every 2-3 days
        # CGD (prepared) with occasional insects
        food_selection = {
            "prepared": [f for f in foods["prepared"] if "Crested Gecko" in f.name],
            "insects": foods["insects"][:2] if foods["insects"] else [],
        }

    if not feeding_interval or not food_selection:
        return

    # Generate feedings
    current_date = datetime.now(timezone.utc) - timedelta(days=days_back)
    end_date = datetime.now(timezone.utc)

    while current_date < end_date:
        # Random time between 8:00 and 20:00
        hour = fake.random_int(8, 20)
        minute = fake.random_int(0, 59)
        feeding_time = current_date.replace(hour=hour, minute=minute, second=0, microsecond=0)

        # Create feeding
        feeding = Feeding(
            reptile_id=reptile.id,
            user_id=user.id,
            fed_at=feeding_time,
            is_salad=False,
            notes=None
        )
        db.add(feeding)
        await db.flush()

        # Add food items - track added foods to avoid duplicates (composite PK)
        added_food_ids = set()

        if reptile.species == "Bearded Dragon":
            # Mix: insects and vegetables
            if food_selection.get("insects"):
                insect = fake.random_element(food_selection["insects"])
                if insect.id not in added_food_ids:
                    added_food_ids.add(insect.id)
                    await db.execute(
                        feeding_foods.insert().values(
                            feeding_id=feeding.id,
                            food_id=insect.id,
                            quantity=fake.random_int(5, 10)
                        )
                    )
            if food_selection.get("vegetables"):
                # Pick unique vegetables
                num_veggies = min(fake.random_int(2, 4), len(food_selection["vegetables"]))
                selected_veggies = fake.random_elements(food_selection["vegetables"], length=num_veggies, unique=True)
                for veg in selected_veggies:
                    if veg.id not in added_food_ids:
                        added_food_ids.add(veg.id)
                        await db.execute(
                            feeding_foods.insert().values(
                                feeding_id=feeding.id,
                                food_id=veg.id,
                                quantity=1
                            )
                        )
        elif reptile.species == "Leopard Gecko":
            # Insects only
            if food_selection.get("insects"):
                insect = fake.random_element(food_selection["insects"])
                await db.execute(
                    feeding_foods.insert().values(
                        feeding_id=feeding.id,
                        food_id=insect.id,
                        quantity=fake.random_int(3, 6)
                    )
                )
        elif reptile.species == "Ball Python":
            # Frozen rodent
            if food_selection.get("frozen_animal"):
                rodent = fake.random_element(food_selection["frozen_animal"])
                await db.execute(
                    feeding_foods.insert().values(
                        feeding_id=feeding.id,
                        food_id=rodent.id,
                        quantity=1
                    )
                )
        elif reptile.species == "Crested Gecko":
            # CGD most of the time, occasional insects
            if fake.random_int(1, 10) <= 8 and food_selection.get("prepared"):
                # 80% CGD
                cgd = food_selection["prepared"][0]
                await db.execute(
                    feeding_foods.insert().values(
                        feeding_id=feeding.id,
                        food_id=cgd.id,
                        quantity=1
                    )
                )
            elif food_selection.get("insects"):
                # 20% insects
                insect = fake.random_element(food_selection["insects"])
                await db.execute(
                    feeding_foods.insert().values(
                        feeding_id=feeding.id,
                        food_id=insect.id,
                        quantity=fake.random_int(2, 4)
                    )
                )

        # Move to next feeding
        current_date += timedelta(days=feeding_interval)


async def create_weight_history(db: AsyncSession, reptile: Reptile, user: User, config: dict):
    """Create weight log history with progression"""
    weight_progression = generate_weight_progression(
        config["base_weight"],
        config["current_weight"],
        days_back=90,
        measurements=12
    )

    for measured_at, weight in weight_progression:
        weight_log = WeightLog(
            reptile_id=reptile.id,
            logged_by_user_id=user.id,
            weight_grams=weight,
            measured_at=measured_at,
            notes=None
        )
        db.add(weight_log)


async def create_shed_record(db: AsyncSession, reptile: Reptile, user: User):
    """Create an ongoing shed health record"""
    shed_date = datetime.now(timezone.utc) - timedelta(days=2)

    health_record = HealthRecord(
        reptile_id=reptile.id,
        logged_by_user_id=user.id,
        record_type="shedding",
        title="Shedding",
        description="Currently in shed - reduced appetite expected",
        date=shed_date
    )
    db.add(health_record)


async def create_schedule_with_overdue_instance(db: AsyncSession, reptile: Reptile):
    """Create schedule with an overdue instance"""
    schedule = Schedule(
        reptile_id=reptile.id,
        name="Feeding Schedule",
        schedule_type="feeding",
        schedule_mode=ScheduleMode.INTERVAL,
        min_days_between=2,
        max_days_between=4,
        enabled=True,
        notifications_enabled=True
    )
    db.add(schedule)
    await db.flush()

    # Create overdue instance (3 days ago)
    overdue_date = (datetime.now(timezone.utc) - timedelta(days=3)).date()
    instance = ScheduleInstance(
        schedule_id=schedule.id,
        scheduled_date=overdue_date,
        status=InstanceStatus.PENDING.value
    )
    db.add(instance)


async def create_schedule_due_today(db: AsyncSession, reptile: Reptile):
    """Create schedule with instance due today"""
    schedule = Schedule(
        reptile_id=reptile.id,
        name="Daily Check",
        schedule_type="misting",
        schedule_mode=ScheduleMode.INTERVAL,
        min_days_between=1,
        max_days_between=1,
        enabled=True,
        notifications_enabled=True
    )
    db.add(schedule)
    await db.flush()

    # Create instance due today
    today = datetime.now(timezone.utc).date()
    instance = ScheduleInstance(
        schedule_id=schedule.id,
        scheduled_date=today,
        status=InstanceStatus.PENDING.value
    )
    db.add(instance)


async def seed_dev_test_data(db: AsyncSession):
    """
    Seed realistic test data for development environment.

    Only runs when:
    1. settings.environment == "development"
    2. No reptiles exist in the database (idempotent)

    Creates:
    - Dev user (dev@local.dev) and household - matches auth.py dev bypass
    - 4 reptiles with different species
    - 60-90 days of activity history per reptile
    - Schedules with instances (including 1 overdue)
    - Edge cases: 1 reptile in shed, 1 with overdue task
    """
    # Double-check environment (defensive)
    if settings.environment != "development":
        logger.warning("seed_dev_test_data called outside development - skipping")
        return

    # Check idempotency
    result = await db.execute(select(Reptile).limit(1))
    if result.scalar_one_or_none() is not None:
        logger.info("Reptiles already exist - skipping dev test data seeding")
        return

    logger.info("Seeding development test data...")

    # 1. Create dev user and household
    user, household = await create_dev_user_and_household(db)
    logger.info(f"Created dev user: {user.email}")

    # 2. Get seeded foods for feeding records
    foods = await get_foods_by_category(db)

    # 3. Create reptiles with activity history
    for config in reptile_configs:
        reptile = await create_reptile_with_access(db, config, user, household)

        # Create feeding history
        await create_feedings_history(db, reptile, user, foods)

        # Create weight history
        await create_weight_history(db, reptile, user, config)

        # Edge case: shed status
        if config.get("is_in_shed"):
            await create_shed_record(db, reptile, user)

        # Edge case: overdue task
        if config.get("is_overdue"):
            await create_schedule_with_overdue_instance(db, reptile)

        # Create a schedule due today for testing
        await create_schedule_due_today(db, reptile)

        logger.info(f"Created reptile: {reptile.name} ({reptile.species})")

    await db.commit()
    logger.info("Development test data seeding complete!")
