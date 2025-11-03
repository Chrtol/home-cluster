"""
Seed database with default foods and supplements
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Food, Supplement, FoodCategory, InsectSize
from datetime import datetime


async def seed_foods(db: AsyncSession):
    """Seed default food types with nutritional data"""

    foods = [
        # New "Salad" entry
        Food(
            name="Salad",
            category=FoodCategory.PREPARED,
            is_default=True,
            nutritional_data={
                "note": "A mix of fresh vegetables and fruits.",
            },
        ),
        # Insects - Small
        Food(
            name="Crickets (Small)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.SMALL,
            is_default=True,
            nutritional_data={
                "protein_percent": 21,
                "fat_percent": 6,
                "calcium_mg_per_100g": 75,
                "phosphorus_mg_per_100g": 185,
                "calcium_phosphorus_ratio": "1:2.5",
            },
        ),
        Food(
            name="Dubia Cockroaches (Small)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.SMALL,
            is_default=True,
            nutritional_data={
                "protein_percent": 23,
                "fat_percent": 7,
                "calcium_mg_per_100g": 700,
                "phosphorus_mg_per_100g": 230,
                "calcium_phosphorus_ratio": "1:0.3",
            },
        ),
        Food(
            name="Mealworms (Small)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.SMALL,
            is_default=True,
            nutritional_data={
                "protein_percent": 20,
                "fat_percent": 13,
                "calcium_mg_per_100g": 133,
                "phosphorus_mg_per_100g": 345,
                "calcium_phosphorus_ratio": "1:2.6",
            },
        ),
        # Insects - Medium
        Food(
            name="Crickets (Medium)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.MEDIUM,
            is_default=True,
            nutritional_data={
                "protein_percent": 21,
                "fat_percent": 6,
                "calcium_mg_per_100g": 75,
                "phosphorus_mg_per_100g": 185,
                "calcium_phosphorus_ratio": "1:2.5",
            },
        ),
        Food(
            name="Dubia Cockroaches (Medium)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.MEDIUM,
            is_default=True,
            nutritional_data={
                "protein_percent": 23,
                "fat_percent": 7,
                "calcium_mg_per_100g": 700,
                "phosphorus_mg_per_100g": 230,
                "calcium_phosphorus_ratio": "1:0.3",
            },
        ),
        # Insects - Large
        Food(
            name="Crickets (Large)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.LARGE,
            is_default=True,
            nutritional_data={
                "protein_percent": 21,
                "fat_percent": 6,
                "calcium_mg_per_100g": 75,
                "phosphorus_mg_per_100g": 185,
                "calcium_phosphorus_ratio": "1:2.5",
            },
        ),
        Food(
            name="Dubia Cockroaches (Large)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.LARGE,
            is_default=True,
            nutritional_data={
                "protein_percent": 23,
                "fat_percent": 7,
                "calcium_mg_per_100g": 700,
                "phosphorus_mg_per_100g": 230,
                "calcium_phosphorus_ratio": "1:0.3",
            },
        ),
        Food(
            name="Zoophobas (Large)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.LARGE,
            is_default=True,
            nutritional_data={
                "protein_percent": 20,
                "fat_percent": 18,
                "calcium_mg_per_100g": 133,
                "phosphorus_mg_per_100g": 345,
                "calcium_phosphorus_ratio": "1:2.6",
                "note": "High fat content - use as occasional treat",
            },
        ),
        # Additional insects - Small
        Food(
            name="Black Soldier Fly Larvae (Small)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.SMALL,
            is_default=True,
            nutritional_data={
                "protein_percent": 17,
                "fat_percent": 14,
                "calcium_mg_per_100g": 934,
                "phosphorus_mg_per_100g": 497,
                "calcium_phosphorus_ratio": "1:0.5",
                "note": "Excellent calcium content, great for growing reptiles",
            },
        ),
        Food(
            name="Waxworms (Small)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.SMALL,
            is_default=True,
            nutritional_data={
                "protein_percent": 15,
                "fat_percent": 22,
                "calcium_mg_per_100g": 243,
                "phosphorus_mg_per_100g": 210,
                "calcium_phosphorus_ratio": "1:0.9",
                "note": "High fat - use sparingly as treats only",
            },
        ),
        # Additional insects - Medium
        Food(
            name="Superworms (Medium)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.MEDIUM,
            is_default=True,
            nutritional_data={
                "protein_percent": 20,
                "fat_percent": 18,
                "calcium_mg_per_100g": 177,
                "phosphorus_mg_per_100g": 283,
                "calcium_phosphorus_ratio": "1:1.6",
                "note": "Higher protein than mealworms, feed in moderation",
            },
        ),
        Food(
            name="Hornworms (Medium)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.MEDIUM,
            is_default=True,
            nutritional_data={
                "protein_percent": 9,
                "fat_percent": 3,
                "calcium_mg_per_100g": 464,
                "phosphorus_mg_per_100g": 129,
                "calcium_phosphorus_ratio": "1:0.3",
                "moisture_percent": 85,
                "note": "High moisture content, excellent for hydration",
            },
        ),
        # Additional insects - Large
        Food(
            name="Superworms (Large)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.LARGE,
            is_default=True,
            nutritional_data={
                "protein_percent": 20,
                "fat_percent": 18,
                "calcium_mg_per_100g": 177,
                "phosphorus_mg_per_100g": 283,
                "calcium_phosphorus_ratio": "1:1.6",
            },
        ),
        Food(
            name="Hornworms (Large)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.LARGE,
            is_default=True,
            nutritional_data={
                "protein_percent": 9,
                "fat_percent": 3,
                "calcium_mg_per_100g": 464,
                "phosphorus_mg_per_100g": 129,
                "moisture_percent": 85,
                "note": "Excellent for picky eaters or dehydrated reptiles",
            },
        ),
        Food(
            name="Silkworms (Large)",
            category=FoodCategory.INSECT,
            insect_size=InsectSize.LARGE,
            is_default=True,
            nutritional_data={
                "protein_percent": 64,
                "fat_percent": 10,
                "calcium_mg_per_100g": 177,
                "phosphorus_mg_per_100g": 260,
                "calcium_phosphorus_ratio": "1:1.5",
                "note": "High protein, soft-bodied, easy to digest",
            },
        ),
        # Salad components
        Food(
            name="Romaine Lettuce",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 1.2,
                "calcium_mg_per_100g": 36,
                "phosphorus_mg_per_100g": 30,
                "vitamin_a_iu": 5000,
            },
        ),
        Food(
            name="Arugula",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 2.6,
                "calcium_mg_per_100g": 160,
                "phosphorus_mg_per_100g": 52,
                "vitamin_a_iu": 2373,
                "vitamin_k_mcg": 108,
            },
        ),
        Food(
            name="Kale",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 3.3,
                "calcium_mg_per_100g": 150,
                "phosphorus_mg_per_100g": 56,
                "vitamin_a_iu": 9990,
                "vitamin_k_mcg": 704,
            },
        ),
        Food(
            name="Carrot",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 0.9,
                "calcium_mg_per_100g": 33,
                "phosphorus_mg_per_100g": 35,
                "vitamin_a_iu": 16706,
            },
        ),
        Food(
            name="Bell Pepper",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 1,
                "calcium_mg_per_100g": 7,
                "phosphorus_mg_per_100g": 26,
                "vitamin_c_mg": 127,
                "vitamin_a_iu": 3131,
            },
        ),
        Food(
            name="Mini Bell Pepper",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 1,
                "calcium_mg_per_100g": 7,
                "phosphorus_mg_per_100g": 26,
                "vitamin_c_mg": 127,
                "vitamin_a_iu": 3131,
            },
        ),
        Food(
            name="Carrot Greens",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 2.8,
                "calcium_mg_per_100g": 138,
                "phosphorus_mg_per_100g": 77,
                "vitamin_a_iu": 16000,
                "note": "Rich in calcium and vitamin A",
            },
        ),
        Food(
            name="Squash",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 1.2,
                "calcium_mg_per_100g": 16,
                "phosphorus_mg_per_100g": 38,
                "vitamin_a_iu": 600,
            },
        ),
        Food(
            name="Collard Greens",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 3.0,
                "calcium_mg_per_100g": 232,
                "phosphorus_mg_per_100g": 19,
                "calcium_phosphorus_ratio": "1:0.08",
                "vitamin_a_iu": 5019,
                "vitamin_k_mcg": 437,
                "note": "Excellent calcium to phosphorus ratio",
            },
        ),
        Food(
            name="Mustard Greens",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 2.9,
                "calcium_mg_per_100g": 115,
                "phosphorus_mg_per_100g": 58,
                "calcium_phosphorus_ratio": "1:0.5",
                "vitamin_a_iu": 3024,
                "vitamin_c_mg": 70,
            },
        ),
        Food(
            name="Turnip Greens",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 1.5,
                "calcium_mg_per_100g": 190,
                "phosphorus_mg_per_100g": 42,
                "calcium_phosphorus_ratio": "1:0.2",
                "vitamin_a_iu": 7597,
                "vitamin_k_mcg": 251,
                "note": "High in calcium and vitamin A",
            },
        ),
        Food(
            name="Dandelion Greens",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 2.7,
                "calcium_mg_per_100g": 187,
                "phosphorus_mg_per_100g": 66,
                "calcium_phosphorus_ratio": "1:0.35",
                "vitamin_a_iu": 10161,
                "vitamin_k_mcg": 778,
                "note": "Excellent staple green, high in vitamins",
            },
        ),
        Food(
            name="Endive",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 1.3,
                "calcium_mg_per_100g": 52,
                "phosphorus_mg_per_100g": 28,
                "vitamin_a_iu": 1080,
                "vitamin_k_mcg": 231,
            },
        ),
        Food(
            name="Escarole",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 1.3,
                "calcium_mg_per_100g": 52,
                "phosphorus_mg_per_100g": 28,
                "vitamin_a_iu": 1155,
                "vitamin_c_mg": 6.5,
            },
        ),
        Food(
            name="Butternut Squash",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 1.0,
                "calcium_mg_per_100g": 48,
                "phosphorus_mg_per_100g": 33,
                "vitamin_a_iu": 10630,
                "note": "High in vitamin A, good for variety",
            },
        ),
        Food(
            name="Acorn Squash",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 1.1,
                "calcium_mg_per_100g": 44,
                "phosphorus_mg_per_100g": 45,
                "vitamin_a_iu": 689,
                "vitamin_c_mg": 11,
            },
        ),
        Food(
            name="Green Beans",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 1.8,
                "calcium_mg_per_100g": 37,
                "phosphorus_mg_per_100g": 38,
                "vitamin_a_iu": 690,
                "vitamin_c_mg": 12,
            },
        ),
        Food(
            name="Zucchini",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 1.2,
                "calcium_mg_per_100g": 16,
                "phosphorus_mg_per_100g": 38,
                "vitamin_a_iu": 200,
                "moisture_percent": 94,
                "note": "High water content, good for hydration",
            },
        ),
        Food(
            name="Okra",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 2.0,
                "calcium_mg_per_100g": 81,
                "phosphorus_mg_per_100g": 63,
                "vitamin_a_iu": 375,
                "vitamin_c_mg": 21,
            },
        ),
        Food(
            name="Peas",
            category=FoodCategory.VEGETABLE,
            is_default=True,
            nutritional_data={
                "protein_percent": 5.4,
                "calcium_mg_per_100g": 25,
                "phosphorus_mg_per_100g": 108,
                "vitamin_a_iu": 765,
                "note": "Occasional treat, moderate protein",
            },
        ),
        # Fruits
        Food(
            name="Banana",
            category=FoodCategory.FRUIT,
            is_default=True,
            nutritional_data={
                "protein_percent": 1.1,
                "calcium_mg_per_100g": 5,
                "phosphorus_mg_per_100g": 22,
                "calcium_phosphorus_ratio": "1:4.4",
                "note": "High in sugar - occasional treat only",
            },
        ),
        Food(
            name="Strawberry",
            category=FoodCategory.FRUIT,
            is_default=True,
            nutritional_data={
                "protein_percent": 0.7,
                "calcium_mg_per_100g": 16,
                "phosphorus_mg_per_100g": 24,
                "vitamin_c_mg": 59,
                "note": "Occasional treat, high in vitamin C",
            },
        ),
        Food(
            name="Blueberry",
            category=FoodCategory.FRUIT,
            is_default=True,
            nutritional_data={
                "protein_percent": 0.7,
                "calcium_mg_per_100g": 6,
                "phosphorus_mg_per_100g": 12,
                "vitamin_c_mg": 9.7,
                "note": "Antioxidant-rich occasional treat",
            },
        ),
        Food(
            name="Mango",
            category=FoodCategory.FRUIT,
            is_default=True,
            nutritional_data={
                "protein_percent": 0.8,
                "calcium_mg_per_100g": 11,
                "phosphorus_mg_per_100g": 14,
                "vitamin_a_iu": 1082,
                "vitamin_c_mg": 36.4,
                "note": "High in vitamin A, occasional treat",
            },
        ),
        Food(
            name="Papaya",
            category=FoodCategory.FRUIT,
            is_default=True,
            nutritional_data={
                "protein_percent": 0.5,
                "calcium_mg_per_100g": 20,
                "phosphorus_mg_per_100g": 10,
                "vitamin_a_iu": 950,
                "vitamin_c_mg": 60.9,
                "note": "Good calcium to phosphorus ratio for a fruit",
            },
        ),
        Food(
            name="Fig",
            category=FoodCategory.FRUIT,
            is_default=True,
            nutritional_data={
                "protein_percent": 0.8,
                "calcium_mg_per_100g": 35,
                "phosphorus_mg_per_100g": 14,
                "calcium_phosphorus_ratio": "1:0.4",
                "note": "One of the better fruits for calcium content",
            },
        ),
        Food(
            name="Raspberry",
            category=FoodCategory.FRUIT,
            is_default=True,
            nutritional_data={
                "protein_percent": 1.2,
                "calcium_mg_per_100g": 25,
                "phosphorus_mg_per_100g": 29,
                "vitamin_c_mg": 26.2,
                "note": "Occasional treat, good fiber content",
            },
        ),
        Food(
            name="Apple (no seeds)",
            category=FoodCategory.FRUIT,
            is_default=True,
            nutritional_data={
                "protein_percent": 0.3,
                "calcium_mg_per_100g": 6,
                "phosphorus_mg_per_100g": 11,
                "vitamin_c_mg": 4.6,
                "note": "Remove seeds (contain cyanide). Occasional treat.",
            },
        ),
        Food(
            name="Pear",
            category=FoodCategory.FRUIT,
            is_default=True,
            nutritional_data={
                "protein_percent": 0.4,
                "calcium_mg_per_100g": 9,
                "phosphorus_mg_per_100g": 12,
                "vitamin_c_mg": 4.3,
                "note": "Occasional treat, high water content",
            },
        ),
        Food(
            name="Melon",
            category=FoodCategory.FRUIT,
            is_default=True,
            nutritional_data={
                "protein_percent": 0.8,
                "calcium_mg_per_100g": 9,
                "phosphorus_mg_per_100g": 15,
                "vitamin_a_iu": 3382,
                "moisture_percent": 90,
                "note": "High water content, good for hydration",
            },
        ),
        # Frozen/thawed rodents for snakes
        Food(
            name="Pinky Mouse (Frozen/Thawed)",
            category=FoodCategory.FROZEN_ANIMAL,
            animal_size="pinky",
            is_default=True,
            nutritional_data={
                "weight_grams": "1-3",
                "note": "For hatchling snakes and very small reptiles",
            },
        ),
        Food(
            name="Fuzzy Mouse (Frozen/Thawed)",
            category=FoodCategory.FROZEN_ANIMAL,
            animal_size="fuzzy",
            is_default=True,
            nutritional_data={
                "weight_grams": "3-6",
                "note": "For young snakes",
            },
        ),
        Food(
            name="Hopper Mouse (Frozen/Thawed)",
            category=FoodCategory.FROZEN_ANIMAL,
            animal_size="hopper",
            is_default=True,
            nutritional_data={
                "weight_grams": "6-12",
                "note": "For juvenile snakes",
            },
        ),
        Food(
            name="Weaner Mouse (Frozen/Thawed)",
            category=FoodCategory.FROZEN_ANIMAL,
            animal_size="weaner",
            is_default=True,
            nutritional_data={
                "weight_grams": "12-20",
                "note": "For growing snakes",
            },
        ),
        Food(
            name="Adult Mouse (Frozen/Thawed)",
            category=FoodCategory.FROZEN_ANIMAL,
            animal_size="adult_small",
            is_default=True,
            nutritional_data={
                "weight_grams": "20-30",
                "note": "For adult snakes - complete nutrition",
            },
        ),
        Food(
            name="Rat Pup (Frozen/Thawed)",
            category=FoodCategory.FROZEN_ANIMAL,
            animal_size="pinky",
            is_default=True,
            nutritional_data={
                "weight_grams": "5-10",
                "note": "Larger alternative to mouse pinkies",
            },
        ),
        Food(
            name="Small Rat (Frozen/Thawed)",
            category=FoodCategory.FROZEN_ANIMAL,
            animal_size="adult_small",
            is_default=True,
            nutritional_data={
                "weight_grams": "50-90",
                "note": "For medium to large snakes",
            },
        ),
        Food(
            name="Medium Rat (Frozen/Thawed)",
            category=FoodCategory.FROZEN_ANIMAL,
            animal_size="adult_medium",
            is_default=True,
            nutritional_data={
                "weight_grams": "90-170",
                "note": "For large snakes",
            },
        ),
        Food(
            name="Large Rat (Frozen/Thawed)",
            category=FoodCategory.FROZEN_ANIMAL,
            animal_size="adult_large",
            is_default=True,
            nutritional_data={
                "weight_grams": "170-300",
                "note": "For very large snakes (boas, large pythons)",
            },
        ),
        # Prepared foods
        Food(
            name="Crested Gecko Food",
            category=FoodCategory.PREPARED,
            is_default=True,
            nutritional_data={
                "protein_percent": 22,
                "fat_percent": 5,
                "calcium_mg_per_100g": 3000,
                "vitamin_d3_iu": 2000,
                "note": "Complete diet for crested geckos",
            },
        ),
    ]

    for food in foods:
        # Check if already exists
        result = await db.execute(select(Food).where(Food.name == food.name))
        if not result.scalar_one_or_none():
            db.add(food)

    await db.commit()


async def seed_supplements(db: AsyncSession):
    """Seed default supplements with nutritional data"""

    supplements = [
        Supplement(
            name="Calcium with D3",
            is_default=True,
            nutritional_data={
                "calcium_carbonate_percent": 36,
                "vitamin_d3_iu_per_tsp": 2200,
                "usage": "Use 2-3 times per week for most reptiles",
                "note": "For reptiles with UVB access",
            },
        ),
        Supplement(
            name="Calcium without D3",
            is_default=True,
            nutritional_data={
                "calcium_carbonate_percent": 36,
                "usage": "Use at every feeding for growing reptiles",
                "note": "For daily supplementation",
            },
        ),
        Supplement(
            name="Multivitamin",
            is_default=True,
            nutritional_data={
                "vitamin_a_iu_per_tsp": 10000,
                "vitamin_d3_iu_per_tsp": 1000,
                "vitamin_e_iu_per_tsp": 50,
                "vitamin_b_complex": "Yes",
                "usage": "Use 1-2 times per week",
                "note": "Comprehensive vitamin supplement",
            },
        ),
    ]

    for supplement in supplements:
        # Check if already exists
        result = await db.execute(select(Supplement).where(Supplement.name == supplement.name))
        if not result.scalar_one_or_none():
            db.add(supplement)

    await db.commit()


async def seed_database(db: AsyncSession):
    """Seed all default data"""
    await seed_foods(db)
    await seed_supplements(db)

    # Import and seed schedule templates and care guidelines
    try:
        from app.seed_schedules import seed_schedule_data
        await seed_schedule_data(db)
    except Exception as e:
        print(f"Note: Schedule seeding skipped (tables may not exist yet): {e}")

    print("Database seeded successfully!")
