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
    print("Database seeded successfully!")
