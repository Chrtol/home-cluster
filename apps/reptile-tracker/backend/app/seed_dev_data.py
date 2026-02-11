"""
Seed realistic test data for development environment

Only runs when:
1. settings.environment == "development"
2. No reptiles exist in the database (idempotent)

Creates:
- Dev user (dev@local.dev) and household - matches auth.py dev bypass
- 4 reptiles with different species
- 60-90 days of activity history per reptile
- Feeding schedules with completed instances
- Daily Check schedules with proper instance history
- Edge cases: 1 reptile in shed, 1 with overdue task
"""
import logging
from datetime import datetime, timedelta, timezone, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from faker import Faker

from app.config import settings
from datetime import time
from app.models import (
    User, Household, Reptile, Feeding, WeightLog, HealthRecord,
    Schedule, ScheduleInstance, ScheduleCompletion, Food, Supplement,
    FeedingRotation,
    household_members, reptile_access, feeding_foods, feeding_supplements,
    AccessLevel, ScheduleMode, InstanceStatus, CompletionStatus, CompletionType
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

    Returns list of (date, weight) tuples with 1 decimal precision
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
        weight = round(base_weight + variation, 1)  # Round to 1 decimal place

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


async def create_feeding_schedule(db: AsyncSession, reptile: Reptile, config: dict) -> Schedule:
    """Create a feeding schedule for the reptile with time windows"""
    interval = config["feeding_interval_days"]

    # Set reasonable feeding windows based on species
    if reptile.species == "Ball Python":
        # Snakes often eat in evening
        earliest = time(18, 0)  # 6 PM
        latest = time(22, 0)    # 10 PM
    elif reptile.species in ["Bearded Dragon", "Leopard Gecko"]:
        # Diurnal/crepuscular - morning to evening
        earliest = time(8, 0)   # 8 AM
        latest = time(20, 0)    # 8 PM
    else:
        # Default - daytime feeding
        earliest = time(9, 0)   # 9 AM
        latest = time(21, 0)    # 9 PM

    schedule = Schedule(
        reptile_id=reptile.id,
        name="Feeding Schedule",
        schedule_type="feeding",
        schedule_mode=ScheduleMode.INTERVAL,
        min_days_between=interval,
        max_days_between=interval + 1,  # Allow 1 day flexibility
        earliest_time=earliest,
        latest_time=latest,
        time_window_enabled=True,
        enabled=True,
        notifications_enabled=True
    )
    db.add(schedule)
    await db.flush()

    return schedule


async def create_feedings_with_schedule_instances(
    db: AsyncSession,
    reptile: Reptile,
    user: User,
    schedule: Schedule,
    foods: dict,
    supplements_by_id: dict[int, Supplement],
    config: dict,
    days_back: int = 90
):
    """
    Generate realistic feeding history with proper schedule instances.

    Creates:
    - Feeding records with supplements attached
    - ScheduleInstance records (status=completed) with supplements JSON
    - ScheduleCompletion records linking instances to feedings
    """
    feeding_interval = config["feeding_interval_days"]
    food_selection = None

    # Get rotations for this reptile (they were just created)
    result = await db.execute(
        select(FeedingRotation).where(
            FeedingRotation.reptile_id == reptile.id,
            FeedingRotation.enabled == True
        ).order_by(FeedingRotation.priority)
    )
    rotations = list(result.scalars().all())

    # Determine feeding pattern by species
    if reptile.species == "Bearded Dragon":
        # Mix of insects and vegetables
        food_selection = {
            "insects": foods["insects"][:3] if foods["insects"] else [],
            "vegetables": foods["vegetables"][:5] if foods["vegetables"] else [],
        }
    elif reptile.species == "Leopard Gecko":
        # Insects only
        food_selection = {
            "insects": foods["insects"][:3] if foods["insects"] else [],
        }
    elif reptile.species == "Ball Python":
        # Frozen rodents
        food_selection = {
            "frozen_animal": foods["frozen_animal"][:2] if foods["frozen_animal"] else [],
        }
    elif reptile.species == "Crested Gecko":
        # CGD (prepared) with occasional insects
        food_selection = {
            "prepared": [f for f in foods["prepared"] if "Crested Gecko" in f.name],
            "insects": foods["insects"][:2] if foods["insects"] else [],
        }

    if not food_selection:
        return

    # Generate feedings
    current_date = datetime.now(timezone.utc) - timedelta(days=days_back)
    end_date = datetime.now(timezone.utc) - timedelta(days=1)  # Stop at yesterday

    # Track feeding sequence number for supplement rotations
    feeding_sequence = 0

    while current_date < end_date:
        feeding_sequence += 1

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

        # Calculate supplements for this feeding sequence
        supplement_info = calculate_supplements_for_sequence(
            rotations, feeding_sequence, supplements_by_id
        )

        # Add supplements to the feeding via junction table
        for supp in supplement_info:
            await db.execute(
                feeding_supplements.insert().values(
                    feeding_id=feeding.id,
                    supplement_id=supp["id"]
                )
            )

        # Create completed ScheduleInstance for this feeding
        feeding_date = feeding_time.date()
        instance = ScheduleInstance(
            schedule_id=schedule.id,
            scheduled_date=feeding_date,
            status=InstanceStatus.COMPLETED.value,
            feeding_sequence_number=feeding_sequence,
            supplements=supplement_info if supplement_info else None
        )
        db.add(instance)
        await db.flush()

        # Create ScheduleCompletion linking instance to feeding
        completion = ScheduleCompletion(
            schedule_id=schedule.id,
            instance_id=instance.id,
            scheduled_date=feeding_date,
            completed_at=feeding_time,
            completion_type=CompletionType.FEEDING,
            completion_id=feeding.id,
            within_time_window=True,
            status=CompletionStatus.COMPLETED_ON_TIME,
            auto_completed=False,
            overdue_notification_sent=False,
            reptile_id=reptile.id
        )
        db.add(completion)

        # Move to next feeding
        current_date += timedelta(days=feeding_interval)

    return feeding_sequence


async def create_future_instances(
    db: AsyncSession,
    schedule: Schedule,
    reptile: Reptile,
    supplements_by_id: dict[int, Supplement],
    config: dict,
    last_sequence: int,
    days_ahead: int = 60
):
    """
    Create future pending instances for a schedule with pre-calculated supplements.

    This simulates what the scheduler would do - creating instances for the
    next N days based on the schedule's interval.
    """
    interval = config["feeding_interval_days"]
    today = datetime.now(timezone.utc).date()
    current_sequence = last_sequence

    # Get rotations for this reptile
    result = await db.execute(
        select(FeedingRotation).where(
            FeedingRotation.reptile_id == reptile.id,
            FeedingRotation.enabled == True
        ).order_by(FeedingRotation.priority)
    )
    rotations = list(result.scalars().all())

    # Start from today or tomorrow depending on whether today already has an instance
    current_date = today

    while current_date <= today + timedelta(days=days_ahead):
        current_sequence += 1

        # Calculate supplements for this future instance
        supplement_info = None
        if schedule.schedule_type == "feeding" and rotations:
            supplement_info = calculate_supplements_for_sequence(
                rotations, current_sequence, supplements_by_id
            )
            if not supplement_info:
                supplement_info = None

        instance = ScheduleInstance(
            schedule_id=schedule.id,
            scheduled_date=current_date,
            status=InstanceStatus.PENDING.value,
            feeding_sequence_number=current_sequence if schedule.schedule_type == "feeding" else None,
            supplements=supplement_info
        )
        db.add(instance)

        # Move to next occurrence
        current_date += timedelta(days=interval)

    await db.flush()
    return current_sequence


async def create_pending_feeding_instance(db: AsyncSession, schedule: Schedule, reptile: Reptile, days_from_now: int = 0, sequence_number: int = 1):
    """Create a pending schedule instance for future or current feeding"""
    scheduled_date = (datetime.now(timezone.utc) + timedelta(days=days_from_now)).date()

    instance = ScheduleInstance(
        schedule_id=schedule.id,
        scheduled_date=scheduled_date,
        status=InstanceStatus.PENDING.value,
        feeding_sequence_number=sequence_number,
        supplements=None
    )
    db.add(instance)
    await db.flush()

    return instance


async def create_overdue_feeding_instance(
    db: AsyncSession,
    schedule: Schedule,
    reptile: Reptile,
    supplements_by_id: dict[int, Supplement],
    days_ago: int = 3,
    sequence_number: int = 1
):
    """Create an overdue schedule instance (pending but in the past) with supplements"""
    scheduled_date = (datetime.now(timezone.utc) - timedelta(days=days_ago)).date()

    # Get rotations and calculate supplements
    result = await db.execute(
        select(FeedingRotation).where(
            FeedingRotation.reptile_id == reptile.id,
            FeedingRotation.enabled == True
        ).order_by(FeedingRotation.priority)
    )
    rotations = list(result.scalars().all())

    supplement_info = None
    if rotations:
        supplement_info = calculate_supplements_for_sequence(
            rotations, sequence_number, supplements_by_id
        )
        if not supplement_info:
            supplement_info = None

    instance = ScheduleInstance(
        schedule_id=schedule.id,
        scheduled_date=scheduled_date,
        status=InstanceStatus.PENDING.value,  # Still pending = overdue
        feeding_sequence_number=sequence_number,
        supplements=supplement_info
    )
    db.add(instance)
    await db.flush()

    return instance


async def create_daily_check_schedule_with_history(db: AsyncSession, reptile: Reptile, days_back: int = 30):
    """Create Daily Check schedule with proper completed history"""
    schedule = Schedule(
        reptile_id=reptile.id,
        name="Daily Check",
        schedule_type="misting",  # Using misting type for general check
        schedule_mode=ScheduleMode.INTERVAL,
        min_days_between=1,
        max_days_between=1,
        earliest_time=time(7, 0),   # 7 AM - morning check
        latest_time=time(10, 0),    # 10 AM - complete by mid-morning
        time_window_enabled=True,
        enabled=True,
        notifications_enabled=True
    )
    db.add(schedule)
    await db.flush()

    # Create completed instances for past days
    for days_ago in range(days_back, 0, -1):
        scheduled_date = (datetime.now(timezone.utc) - timedelta(days=days_ago)).date()
        completed_time = datetime.combine(
            scheduled_date,
            datetime.min.time().replace(hour=fake.random_int(8, 12), minute=fake.random_int(0, 59))
        ).replace(tzinfo=timezone.utc)

        instance = ScheduleInstance(
            schedule_id=schedule.id,
            scheduled_date=scheduled_date,
            status=InstanceStatus.COMPLETED.value,
            feeding_sequence_number=None,  # Not a feeding schedule
            supplements=None
        )
        db.add(instance)
        await db.flush()

        # Create completion record (manual completion, not tied to a specific activity)
        completion = ScheduleCompletion(
            schedule_id=schedule.id,
            instance_id=instance.id,
            scheduled_date=scheduled_date,
            completed_at=completed_time,
            completion_type=CompletionType.MANUAL,
            completion_id=None,  # Manual completion
            within_time_window=True,
            status=CompletionStatus.COMPLETED_ON_TIME,
            auto_completed=False,
            overdue_notification_sent=False,
            reptile_id=reptile.id
        )
        db.add(completion)

    # Create pending instances for today and future (60 days ahead)
    today = datetime.now(timezone.utc).date()
    for days_offset in range(61):  # Today + 60 days
        future_date = today + timedelta(days=days_offset)
        instance = ScheduleInstance(
            schedule_id=schedule.id,
            scheduled_date=future_date,
            status=InstanceStatus.PENDING.value,
            feeding_sequence_number=None,
            supplements=None
        )
        db.add(instance)

    return schedule


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


async def get_supplements(db: AsyncSession) -> dict[str, Supplement]:
    """Get supplements by name for rotation creation"""
    result = await db.execute(select(Supplement))
    supplements = result.scalars().all()
    return {s.name: s for s in supplements}


def calculate_supplements_for_sequence(
    rotations: list[FeedingRotation],
    sequence_number: int,
    supplements_by_id: dict[int, Supplement]
) -> list[dict]:
    """
    Calculate which supplements apply for a given feeding sequence number.

    Returns a list of supplement info dicts sorted by priority.
    Respects is_exclusive flag - if a higher priority rotation is exclusive,
    lower priority rotations are excluded.
    """
    applicable = []

    # Sort rotations by priority (lower number = higher priority)
    sorted_rotations = sorted(rotations, key=lambda r: r.priority)

    for rotation in sorted_rotations:
        if not rotation.enabled or not rotation.supplement_id:
            continue

        # Check if this rotation triggers on this sequence number
        if rotation.trigger_mode == "feeding_count" and rotation.every_n_feedings:
            if sequence_number % rotation.every_n_feedings == 0:
                supplement = supplements_by_id.get(rotation.supplement_id)
                if supplement:
                    applicable.append({
                        "id": supplement.id,
                        "name": supplement.name,
                        "priority": rotation.priority,
                        "rotation_id": rotation.id
                    })

                    # If this rotation is exclusive, stop here
                    if rotation.is_exclusive:
                        break

    return applicable


async def create_supplement_rotations(db: AsyncSession, reptile: Reptile, supplements: dict):
    """
    Create realistic supplement rotation rules for a reptile.

    Common patterns:
    - Calcium without D3: Every feeding (for reptiles with UVB)
    - Calcium with D3: Every 2-3 feedings (for reptiles without UVB, or alternating)
    - Multivitamin: Every 3-4 feedings or once/twice per week
    """
    calcium_d3 = supplements.get("Calcium with D3")
    calcium_no_d3 = supplements.get("Calcium without D3")
    multivitamin = supplements.get("Multivitamin")

    if reptile.species == "Bearded Dragon":
        # Adult beardies: multivitamin highest priority (exclusive), then D3, then plain calcium
        # Priority order: multivitamin > calcium D3 > calcium no D3
        # When multivitamin triggers, use only that; when D3 triggers, use only that; otherwise plain calcium
        if multivitamin:
            rotation = FeedingRotation(
                reptile_id=reptile.id,
                rotation_type="supplement",
                supplement_id=multivitamin.id,
                trigger_mode="feeding_count",
                every_n_feedings=4,  # Every 4th feeding (~weekly for adult)
                counting_mode="all_feedings",
                applies_to_category=None,
                application_mode="any_feeding",
                priority=1,  # Highest priority
                is_exclusive=True,  # Exclusive - don't stack with others
                enabled=True,
                notes="Multivitamin once per week (replaces calcium on this feeding)"
            )
            db.add(rotation)

        if calcium_d3:
            rotation = FeedingRotation(
                reptile_id=reptile.id,
                rotation_type="supplement",
                supplement_id=calcium_d3.id,
                trigger_mode="feeding_count",
                every_n_feedings=3,  # Every 3rd feeding
                counting_mode="all_feedings",
                applies_to_category=None,
                application_mode="any_feeding",
                priority=2,  # Second priority
                is_exclusive=True,  # Exclusive - don't stack with plain calcium
                enabled=True,
                notes="Calcium with D3 every 3rd feeding"
            )
            db.add(rotation)

        if calcium_no_d3:
            rotation = FeedingRotation(
                reptile_id=reptile.id,
                rotation_type="supplement",
                supplement_id=calcium_no_d3.id,
                trigger_mode="feeding_count",
                every_n_feedings=1,  # Every feeding (fallback)
                counting_mode="all_feedings",
                applies_to_category=None,
                application_mode="any_feeding",
                priority=3,  # Lowest priority - fallback
                is_exclusive=False,  # Not exclusive (but won't matter, it's lowest)
                enabled=True,
                notes="Calcium (no D3) - default for feedings without other supplements"
            )
            db.add(rotation)

    elif reptile.species == "Leopard Gecko":
        # Leo supplement schedule: multivitamin highest priority, then calcium
        if multivitamin:
            rotation = FeedingRotation(
                reptile_id=reptile.id,
                rotation_type="supplement",
                supplement_id=multivitamin.id,
                trigger_mode="feeding_count",
                every_n_feedings=4,  # Every 4th feeding (~2 weeks for adult leo)
                counting_mode="all_feedings",
                applies_to_category=None,
                application_mode="any_feeding",
                priority=1,  # Highest priority
                is_exclusive=True,  # Exclusive - replaces calcium on this feeding
                enabled=True,
                notes="Multivitamin every other week (replaces calcium)"
            )
            db.add(rotation)

        if calcium_no_d3:
            rotation = FeedingRotation(
                reptile_id=reptile.id,
                rotation_type="supplement",
                supplement_id=calcium_no_d3.id,
                trigger_mode="feeding_count",
                every_n_feedings=1,
                counting_mode="all_feedings",
                applies_to_category=None,
                application_mode="any_feeding",
                priority=2,  # Lower priority - fallback
                is_exclusive=False,
                enabled=True,
                notes="Calcium at every feeding (default)"
            )
            db.add(rotation)

    elif reptile.species == "Ball Python":
        # Snakes typically don't need supplementation for whole prey
        # But we can add calcium with D3 occasionally for juveniles
        if calcium_d3:
            rotation = FeedingRotation(
                reptile_id=reptile.id,
                rotation_type="supplement",
                supplement_id=calcium_d3.id,
                trigger_mode="feeding_count",
                every_n_feedings=4,  # Monthly (every 4 weekly feedings)
                counting_mode="all_feedings",
                applies_to_category=None,
                application_mode="any_feeding",
                priority=1,
                is_exclusive=False,
                enabled=True,
                notes="Light calcium dusting monthly for growing juvenile"
            )
            db.add(rotation)

    elif reptile.species == "Crested Gecko":
        # CGD already contains supplements, but add calcium for insect feedings
        if calcium_no_d3:
            rotation = FeedingRotation(
                reptile_id=reptile.id,
                rotation_type="supplement",
                supplement_id=calcium_no_d3.id,
                trigger_mode="feeding_count",
                every_n_feedings=1,
                counting_mode="category_only",
                applies_to_category="insects",  # Only when feeding insects
                application_mode="any_feeding",
                priority=1,
                is_exclusive=False,
                enabled=True,
                notes="Dust insects with calcium"
            )
            db.add(rotation)

    await db.flush()


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
    - Feeding schedules with completed instances
    - Daily Check schedules with proper instance history
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

    # 2. Get seeded foods and supplements for feeding records
    foods = await get_foods_by_category(db)
    supplements = await get_supplements(db)
    supplements_by_id = {s.id: s for s in supplements.values()}

    # 3. Create reptiles with activity history
    for config in reptile_configs:
        reptile = await create_reptile_with_access(db, config, user, household)

        # Create feeding schedule
        feeding_schedule = await create_feeding_schedule(db, reptile, config)

        # Create supplement rotations for this reptile
        await create_supplement_rotations(db, reptile, supplements)

        # Create feeding history with schedule instances and supplements
        last_sequence = await create_feedings_with_schedule_instances(
            db, reptile, user, feeding_schedule, foods, supplements_by_id, config
        )
        last_sequence = last_sequence or 0

        # Create future instances for feeding schedule
        if config.get("is_overdue"):
            # For overdue reptile: create overdue instance + future instances
            await create_overdue_feeding_instance(
                db, feeding_schedule, reptile, supplements_by_id,
                days_ago=3,
                sequence_number=last_sequence + 1
            )
            # Then create future instances starting from today+interval
            await create_future_instances(
                db, feeding_schedule, reptile, supplements_by_id, config,
                last_sequence=last_sequence + 1,
                days_ahead=60
            )
        else:
            # Create future instances starting from today
            await create_future_instances(
                db, feeding_schedule, reptile, supplements_by_id, config,
                last_sequence=last_sequence,
                days_ahead=60
            )

        # Create Daily Check schedule with proper history
        await create_daily_check_schedule_with_history(db, reptile, days_back=30)

        # Create weight history
        await create_weight_history(db, reptile, user, config)

        # Edge case: shed status
        if config.get("is_in_shed"):
            await create_shed_record(db, reptile, user)

        logger.info(f"Created reptile: {reptile.name} ({reptile.species})")

    await db.commit()
    logger.info("Development test data seeding complete!")
