"""
Seed database with default schedule templates and care guidelines from reputable sources.

Sources:
- ReptiFiles (reptifiles.com)
- The Bio Dude
- Reptile Magazine
- Various species-specific care guides
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import ScheduleTemplate, CareGuideline
from datetime import time


async def seed_schedule_templates(db: AsyncSession):
    """Seed default schedule templates for common reptile species"""

    templates = [
        # ========== BEARDED DRAGON SCHEDULES ==========
        # Hatchling feeding (0-3 months)
        ScheduleTemplate(
            name="ReptiFiles - Hatchling Bearded Dragon Daily Insects",
            description="Daily unlimited insects for hatchling bearded dragons (0-3 months)",
            species="Bearded Dragon",
            age_category="hatchling",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=1,
            food_category="insects",
            time_slot="morning",
            earliest_time=time(9, 0),
            latest_time=time(12, 0),
            time_window_enabled=True,
            notes="Insects 1x/day, as many as the dragon will eat. Insects should be no bigger than the space between the dragon's eyes.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Hatchling Bearded Dragon Daily Vegetables",
            description="Daily vegetables for hatchling bearded dragons (0-3 months)",
            species="Bearded Dragon",
            age_category="hatchling",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=1,
            food_category="salad",
            time_slot="afternoon",
            notes="Vegetables daily, as much as the dragon will eat. Best choices: collard greens, mustard greens, turnip greens.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),

        # Juvenile feeding (<12" / 25cm long)
        ScheduleTemplate(
            name="ReptiFiles - Juvenile Bearded Dragon Daily Insects",
            description="Daily insects for juvenile bearded dragons (<12 inches)",
            species="Bearded Dragon",
            age_category="juvenile",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=1,
            food_category="insects",
            time_slot="morning",
            earliest_time=time(9, 0),
            latest_time=time(12, 0),
            time_window_enabled=True,
            notes="5-6 head-sized insects daily. Insects should be no bigger than the space between the dragon's eyes.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Juvenile Bearded Dragon Daily Vegetables",
            description="Daily vegetables for juvenile bearded dragons (<12 inches)",
            species="Bearded Dragon",
            age_category="juvenile",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=1,
            food_category="salad",
            time_slot="afternoon",
            notes="Vegetables daily (3x larger than insect volume). Best choices: collard greens, mustard greens, turnip greens.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),

        # Adult/Subadult feeding (>12" / 25cm long)
        ScheduleTemplate(
            name="ReptiFiles - Adult Bearded Dragon Insects",
            description="Insects 2x per week for adult bearded dragons (>12 inches)",
            species="Bearded Dragon",
            age_category="adult",
            schedule_type="feeding",
            schedule_rule="days_of_week",
            days_of_week="2,5",  # Tuesday and Friday
            food_category="insects",
            time_slot="morning",
            earliest_time=time(9, 0),
            latest_time=time(12, 0),
            time_window_enabled=True,
            notes="3-4 head-sized insects 2x/week. Insects should be no bigger than the space between the dragon's eyes.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Adult Bearded Dragon Vegetables",
            description="Vegetables 3x per week for adult bearded dragons (>12 inches)",
            species="Bearded Dragon",
            age_category="adult",
            schedule_type="feeding",
            schedule_rule="days_of_week",
            days_of_week="1,3,5",  # Monday, Wednesday, Friday
            food_category="salad",
            notes="Vegetables 3x/week (one portion = size of dragon's head). Best choices: collard greens, mustard greens, turnip greens.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),

        # Bearded dragon supplements
        # Bearded dragons require UVB lighting, so calcium without D3 is appropriate
        ScheduleTemplate(
            name="ReptiFiles - Hatchling Bearded Dragon Calcium without D3",
            description="Daily calcium without D3 for hatchling bearded dragons",
            species="Bearded Dragon",
            age_category="hatchling",
            schedule_type="supplement",
            schedule_rule="every_x_days",
            frequency_days=1,
            uvb_lighting=True,
            notes="Calcium without D3 on all insects and salads. Bearded dragons require UVB lighting.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Hatchling Bearded Dragon Multivitamin",
            description="Multivitamin powder 2x per week for hatchling bearded dragons",
            species="Bearded Dragon",
            age_category="hatchling",
            schedule_type="supplement",
            schedule_rule="days_of_week",
            days_of_week="2,5",  # Tuesday and Friday
            uvb_lighting=None,
            notes="Multivitamin powder on salads 2x/week.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Juvenile Bearded Dragon Calcium without D3",
            description="Daily calcium without D3 for juvenile bearded dragons",
            species="Bearded Dragon",
            age_category="juvenile",
            schedule_type="supplement",
            schedule_rule="every_x_days",
            frequency_days=1,
            uvb_lighting=True,
            notes="Calcium without D3 on all insects and salads. Bearded dragons require UVB lighting.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Juvenile Bearded Dragon Multivitamin",
            description="Multivitamin powder 2x per week for juvenile bearded dragons",
            species="Bearded Dragon",
            age_category="juvenile",
            schedule_type="supplement",
            schedule_rule="days_of_week",
            days_of_week="2,5",  # Tuesday and Friday
            uvb_lighting=None,
            notes="Multivitamin powder on salads 2x/week.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Adult Bearded Dragon Calcium without D3",
            description="Daily calcium without D3 for adult bearded dragons",
            species="Bearded Dragon",
            age_category="adult",
            schedule_type="supplement",
            schedule_rule="every_x_days",
            frequency_days=1,
            uvb_lighting=True,
            notes="Calcium without D3 on all insects and salads. Bearded dragons require UVB lighting.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Adult Bearded Dragon Multivitamin",
            description="Multivitamin powder 1x per week for adult bearded dragons",
            species="Bearded Dragon",
            age_category="adult",
            schedule_type="supplement",
            schedule_rule="days_of_week",
            days_of_week="6",  # Saturday
            uvb_lighting=None,
            notes="Multivitamin powder on salads 1x/week.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),

        # Gravid (pregnant) female bearded dragons
        ScheduleTemplate(
            name="ReptiFiles - Gravid Female Bearded Dragon Insects",
            description="Insects 2x per week for gravid female bearded dragons",
            species="Bearded Dragon",
            age_category="gravid",
            schedule_type="feeding",
            schedule_rule="days_of_week",
            days_of_week="2,5",  # Tuesday and Friday
            food_category="insects",
            time_slot="morning",
            earliest_time=time(9, 0),
            latest_time=time(12, 0),
            time_window_enabled=True,
            notes="4-5 head-sized insects 2x/week. Gravid females need extra calcium for egg development.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Gravid Female Bearded Dragon Vegetables",
            description="Vegetables 3x per week for gravid female bearded dragons",
            species="Bearded Dragon",
            age_category="gravid",
            schedule_type="feeding",
            schedule_rule="days_of_week",
            days_of_week="1,3,5",  # Monday, Wednesday, Friday
            food_category="salad",
            notes="Vegetables 3x/week (one portion = size of dragon's head). Focus on calcium-rich greens.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Gravid Female Bearded Dragon Calcium without D3",
            description="Daily calcium without D3 for gravid female bearded dragons",
            species="Bearded Dragon",
            age_category="gravid",
            schedule_type="supplement",
            schedule_rule="every_x_days",
            frequency_days=1,
            uvb_lighting=True,
            notes="Calcium without D3 on all insects and salads. Critical for egg development and preventing calcium depletion.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Gravid Female Bearded Dragon Multivitamin",
            description="Multivitamin powder 2x per week for gravid female bearded dragons",
            species="Bearded Dragon",
            age_category="gravid",
            schedule_type="supplement",
            schedule_rule="days_of_week",
            days_of_week="2,5",  # Tuesday and Friday
            uvb_lighting=None,
            notes="Multivitamin powder on salads 2x/week. Increased vitamin needs during egg production.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),

        # ========== LEOPARD GECKO SCHEDULES ==========
        ScheduleTemplate(
            name="ReptiFiles - Juvenile Leopard Gecko Daily Feeding",
            description="Daily insects for growing juvenile leopard geckos",
            species="Leopard Gecko",
            age_category="juvenile",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=1,
            food_category="insects",
            time_slot="evening",
            earliest_time=time(18, 0),
            latest_time=time(21, 0),
            time_window_enabled=True,
            notes="Feed daily. Offer 2 appropriately-sized bugs per 1 inch of gecko length, or as much as they can eat in 15 minutes.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Adult Leopard Gecko Feeding",
            description="Insects every 2-3 days for adult leopard geckos (12+ months)",
            species="Leopard Gecko",
            age_category="adult",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=3,
            food_category="insects",
            time_slot="evening",
            earliest_time=time(18, 0),
            latest_time=time(21, 0),
            time_window_enabled=True,
            notes="Young adults: every 2-3 days. Adults whose tail is fatter than their neck can be fed every 5 days. Offer 2 bugs per inch of length or 15 minutes worth.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            is_default=True,
        ),

        # Leopard gecko supplements
        ScheduleTemplate(
            name="ReptiFiles - Juvenile Leopard Gecko Calcium (With UVB)",
            description="Calcium powder for all juvenile leopard gecko feedings (with UVB)",
            species="Leopard Gecko",
            age_category="juvenile",
            schedule_type="supplement",
            schedule_rule="every_x_days",
            frequency_days=1,
            uvb_lighting=True,
            notes="Dust all insects with calcium powder. With UVB lighting, the gecko synthesizes vitamin D3 naturally.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Juvenile Leopard Gecko Calcium (No UVB)",
            description="Calcium with D3 for all juvenile leopard gecko feedings (no UVB)",
            species="Leopard Gecko",
            age_category="juvenile",
            schedule_type="supplement",
            schedule_rule="every_x_days",
            frequency_days=1,
            uvb_lighting=False,
            notes="Dust all insects with calcium powder including vitamin D3. D3 supplementation is critical without UVB lighting.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Juvenile Leopard Gecko Multivitamin",
            description="Weekly multivitamin for juvenile leopard geckos",
            species="Leopard Gecko",
            age_category="juvenile",
            schedule_type="supplement",
            schedule_rule="days_of_week",
            days_of_week="6",  # Saturday
            uvb_lighting=None,  # Applies regardless of UVB
            notes="Dust insects with multivitamin once per week. If using Repashy CalciumPlus, no additional multivitamin is necessary.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Adult Leopard Gecko Calcium (With UVB)",
            description="Calcium powder for all adult leopard gecko feedings (with UVB)",
            species="Leopard Gecko",
            age_category="adult",
            schedule_type="supplement",
            schedule_rule="every_x_days",
            frequency_days=1,
            uvb_lighting=True,
            notes="Dust all insects with calcium powder. With UVB lighting, the gecko synthesizes vitamin D3 naturally.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Adult Leopard Gecko Calcium (No UVB)",
            description="Calcium with D3 for all adult leopard gecko feedings (no UVB)",
            species="Leopard Gecko",
            age_category="adult",
            schedule_type="supplement",
            schedule_rule="every_x_days",
            frequency_days=1,
            uvb_lighting=False,
            notes="Dust all insects with calcium powder including vitamin D3. D3 supplementation is critical without UVB lighting.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Adult Leopard Gecko Multivitamin",
            description="Bi-weekly multivitamin for adult leopard geckos",
            species="Leopard Gecko",
            age_category="adult",
            schedule_type="supplement",
            schedule_rule="days_of_week",
            days_of_week="6",  # Every other Saturday (user will need to adjust)
            uvb_lighting=None,  # Applies regardless of UVB
            notes="Dust insects with multivitamin once every other week. If using Repashy CalciumPlus, no additional multivitamin is necessary.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            is_default=True,
        ),

        # ========== CRESTED GECKO SCHEDULES ==========
        # Juvenile schedules (0-12 months)
        ScheduleTemplate(
            name="ReptiFiles - Juvenile Crested Gecko Daily CGD",
            description="Daily crested gecko diet for juveniles (0-12 months)",
            species="Crested Gecko",
            age_category="juvenile",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=1,
            food_category="prepared",
            time_slot="evening",
            notes="Mix the powdered diet with water to a ketchup or smoothie consistency. Offer fresh CGD daily for growing juveniles.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/crested-gecko-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Juvenile Crested Gecko Insects",
            description="Live insects 1-2x weekly for juvenile crested geckos",
            species="Crested Gecko",
            age_category="juvenile",
            schedule_type="feeding",
            schedule_rule="days_of_week",
            days_of_week="2,5",  # Tuesday and Friday
            food_category="insects",
            time_slot="evening",
            notes="Offer appropriately sized insects 1-2 times per week as supplemental nutrition for growth.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/crested-gecko-care/",
            is_default=True,
        ),

        # Adult schedules (12+ months)
        ScheduleTemplate(
            name="ReptiFiles - Adult Crested Gecko CGD",
            description="CGD every 2-3 days for adult crested geckos (12+ months)",
            species="Crested Gecko",
            age_category="adult",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=3,
            food_category="prepared",
            time_slot="evening",
            notes="Mix the powdered diet with water to a ketchup or smoothie consistency. Adults can eat every 2-3 days.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/crested-gecko-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Adult Crested Gecko Insects (Optional)",
            description="Optional live insects 0-1x weekly for adults",
            species="Crested Gecko",
            age_category="adult",
            schedule_type="feeding",
            schedule_rule="days_of_week",
            days_of_week="3",  # Wednesday
            food_category="insects",
            time_slot="evening",
            notes="Optional: Offer appropriately sized insects 0-1 times per week. Not required for adults.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/crested-gecko-care/",
            is_default=True,
        ),

        # Crested gecko supplements (CGD contains vitamins, only calcium needed for insects)
        ScheduleTemplate(
            name="ReptiFiles - Crested Gecko Calcium (With UVB)",
            description="Calcium without D3 for crested gecko insects (with UVB)",
            species="Crested Gecko",
            age_category=None,
            schedule_type="supplement",
            schedule_rule="every_x_days",
            frequency_days=1,
            uvb_lighting=True,
            notes="For crested geckos WITH UVB. Dust insects with calcium without D3. No multivitamin needed - CGD contains all vitamins.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/crested-gecko-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Crested Gecko Calcium (No UVB)",
            description="Calcium with D3 for crested gecko insects (no UVB)",
            species="Crested Gecko",
            age_category=None,
            schedule_type="supplement",
            schedule_rule="every_x_days",
            frequency_days=1,
            uvb_lighting=False,
            notes="For crested geckos WITHOUT UVB. Dust insects with calcium WITH D3. No multivitamin needed - CGD contains all vitamins.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/crested-gecko-care/",
            is_default=True,
        ),

        # ========== BALL PYTHON SCHEDULES ==========
        ScheduleTemplate(
            name="Reptile Magazine - Juvenile Ball Python Weekly Feeding",
            description="Weekly rodent feeding for juvenile ball pythons (0-2 years)",
            species="Ball Python",
            age_category="juvenile",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=7,
            food_category="frozen_animal",
            time_slot="evening",
            notes="Feed appropriately sized prey (10-15% of body weight). Frozen/thawed recommended.",
            source_name="Reptile Magazine",
            source_url="https://reptilemag.com/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Adult Ball Python Bi-Weekly Feeding",
            description="Every 10-14 days for adult ball pythons (2+ years)",
            species="Ball Python",
            age_category="adult",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=10,
            food_category="frozen_animal",
            notes="Feed every 10-14 days. Prey should be same width as widest part of snake.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/ball-python-care/",
            is_default=True,
        ),

        # ========== CORN SNAKE SCHEDULES ==========
        ScheduleTemplate(
            name="ReptiFiles - Juvenile Corn Snake Weekly Feeding",
            description="Weekly feeding for juvenile corn snakes (0-2 years)",
            species="Corn Snake",
            age_category="juvenile",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=5,
            food_category="frozen_animal",
            notes="Feed every 5-7 days. Appropriately sized prey (slightly larger than snake's widest point).",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/corn-snake-care/",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Adult Corn Snake Weekly Feeding",
            description="Weekly feeding for adult corn snakes (2+ years)",
            species="Corn Snake",
            age_category="adult",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=7,
            food_category="frozen_animal",
            notes="Feed every 7-10 days. Adult mice or small rats depending on size.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/corn-snake-care/",
            is_default=True,
        ),

        # ========== BLUE TONGUE SKINK SCHEDULES ==========
        ScheduleTemplate(
            name="ReptiFiles - Blue Tongue Skink Every Other Day Feeding",
            description="Varied diet every other day for blue tongue skinks",
            species="Blue Tongue Skink",
            age_category=None,
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=2,
            food_category="salad",
            notes="Omnivorous diet: 50% vegetables, 40% protein, 10% fruit. Rotate food types.",
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/blue-tongue-skink-care/",
            is_default=True,
        ),

        # ========== WEIGHING SCHEDULES ==========
        ScheduleTemplate(
            name="Juvenile - Weekly Weighing",
            description="Weekly weight checks for growing juveniles",
            species=None,
            age_category="juvenile",
            schedule_type="weighing",
            schedule_rule="days_of_week",
            days_of_week="0",  # Sunday
            health_category="weight_check",
            notes="Track growth rate weekly during rapid growth phase.",
            is_default=True,
        ),
        ScheduleTemplate(
            name="Adult - Monthly Weighing",
            description="Monthly weight checks for adult reptiles",
            species=None,
            age_category="adult",
            schedule_type="weighing",
            schedule_rule="monthly",
            day_of_month=1,
            health_category="weight_check",
            notes="Monitor weight monthly to track health and prevent obesity.",
            is_default=True,
        ),

        # ========== MISTING SCHEDULES ==========
        ScheduleTemplate(
            name="ReptiFiles - Evening Misting",
            description="Evening misting for crested geckos",
            species="Crested Gecko",
            age_category=None,
            schedule_type="misting",
            schedule_rule="every_x_days",
            frequency_days=1,
            time_slot="evening",
            earliest_time=time(18, 0),
            latest_time=time(21, 0),
            time_window_enabled=True,
            notes="Mist at least once in the evening. Your gecko will drink the droplets off the terrarium walls and decorations.",
            is_default=True,
        ),
        ScheduleTemplate(
            name="ReptiFiles - Morning Misting (Optional)",
            description="Morning misting for crested geckos if needed",
            species="Crested Gecko",
            age_category=None,
            schedule_type="misting",
            schedule_rule="every_x_days",
            frequency_days=1,
            time_slot="morning",
            earliest_time=time(7, 0),
            latest_time=time(10, 0),
            time_window_enabled=True,
            notes="Mist again in the morning if needed, depending on how well your terrarium holds humidity.",
            is_default=True,
        ),
    ]

    for template in templates:
        # Check if already exists
        result = await db.execute(
            select(ScheduleTemplate).where(
                ScheduleTemplate.name == template.name,
                ScheduleTemplate.is_default == True
            )
        )
        if not result.scalar_one_or_none():
            db.add(template)

    await db.commit()


async def seed_care_guidelines(db: AsyncSession):
    """Seed default care guidelines from reputable sources"""

    guidelines = [
        # ========== BEARDED DRAGON CARE ==========
        CareGuideline(
            species="Bearded Dragon",
            age_category="hatchling",
            guideline_type="feeding",
            title="Hatchling Bearded Dragon Feeding Guidelines (0-3 months)",
            content="""Hatchling bearded dragons (0-3 months) require unlimited daily feeding:

**Insects (Daily):**
- Insects 1x/day, as many as the dragon will eat
- Insects should be no bigger than the space between the dragon's eyes
- Best choices: dubia roaches, crickets, black soldier fly larvae

**Vegetables (Daily):**
- Fresh vegetables daily, as much as the dragon will eat
- Best choices: collard greens, mustard greens, turnip greens, dandelion greens
- Chop finely for easier eating

**Supplementation:**
- Calcium powder on all insects and salads
- Multivitamin powder on salads 2x/week
- Bearded dragons require UVB lighting""",
            recommendations={
                "feeding_frequency": "Insects 1x/day unlimited, vegetables daily unlimited",
                "age_range": "0-3 months",
                "insects": ["dubia roaches", "crickets", "black soldier fly larvae"],
                "vegetables": ["collard greens", "mustard greens", "turnip greens"],
                "supplements": ["Calcium (daily on all foods)", "Multivitamin (2x/week on salads)"]
            },
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        CareGuideline(
            species="Bearded Dragon",
            age_category="juvenile",
            guideline_type="feeding",
            title="Juvenile Bearded Dragon Feeding Guidelines (<12 inches)",
            content="""Juvenile bearded dragons (<12" / 25cm long) require daily feeding:

**Insects (Daily):**
- 5-6 head-sized insects daily
- Insects should be no bigger than the space between the dragon's eyes
- Best choices: dubia roaches, crickets, black soldier fly larvae

**Vegetables (Daily):**
- Fresh vegetables daily (3x larger than insect volume)
- Best choices: collard greens, mustard greens, turnip greens, dandelion greens
- Chop into bite-sized pieces

**Supplementation:**
- Calcium powder on all insects and salads
- Multivitamin powder on salads 2x/week
- Bearded dragons require UVB lighting""",
            recommendations={
                "feeding_frequency": "5-6 insects daily, vegetables daily (3x larger)",
                "age_range": "<12 inches / 25cm",
                "insects": ["dubia roaches", "crickets", "black soldier fly larvae"],
                "vegetables": ["collard greens", "mustard greens", "turnip greens"],
                "supplements": ["Calcium (daily on all foods)", "Multivitamin (2x/week on salads)"]
            },
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        CareGuideline(
            species="Bearded Dragon",
            age_category="adult",
            guideline_type="feeding",
            title="Adult Bearded Dragon Feeding Guidelines (>12 inches)",
            content="""Adult and subadult bearded dragons (>12" / 25cm long) require less frequent feeding:

**Insects:**
- 3-4 head-sized insects 2x/week
- Insects should be no bigger than the space between the dragon's eyes
- Variety is important: dubia roaches, crickets, superworms, hornworms

**Vegetables:**
- Vegetables 3x/week (one portion = size of dragon's head)
- Staples: collard greens, mustard greens, turnip greens, endive, escarole
- Occasional additions: bell peppers, squash, carrots (shredded)

**Supplementation:**
- Calcium powder on all insects and salads
- Multivitamin powder on salads 1x/week
- Bearded dragons require UVB lighting

**Body Condition:**
- Monitor weight and body condition regularly
- Adjust feeding frequency if dragon becomes overweight or underweight""",
            recommendations={
                "feeding_frequency": "Insects 2x/week, vegetables 3x/week",
                "age_range": ">12 inches / 25cm",
                "insects_per_feeding": "3-4 head-sized",
                "vegetable_portion": "Size of dragon's head",
                "insects": ["dubia roaches", "crickets", "superworms", "hornworms"],
                "vegetables": ["collard greens", "mustard greens", "turnip greens", "endive", "escarole"],
                "supplements": ["Calcium (daily on all foods)", "Multivitamin (1x/week on salads)"]
            },
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        CareGuideline(
            species="Bearded Dragon",
            age_category="gravid",
            guideline_type="feeding",
            title="Gravid Female Bearded Dragon Feeding Guidelines",
            content="""Gravid (pregnant) female bearded dragons require increased nutrition for egg development:

**Insects:**
- 4-5 head-sized insects 2x/week
- Insects should be no bigger than the space between the dragon's eyes
- Focus on nutrient-rich feeders: dubia roaches, black soldier fly larvae

**Vegetables:**
- Vegetables 3x/week (one portion = size of dragon's head)
- Focus on calcium-rich greens: collard greens, mustard greens, turnip greens, dandelion greens
- These provide essential nutrients for egg shell formation

**Supplementation:**
- Calcium powder on ALL insects and salads (daily)
- Multivitamin powder on salads 2x/week
- Calcium is critical during egg production to prevent metabolic bone disease

**Important Notes:**
- Monitor body condition closely during gravidity
- Ensure proper UVB lighting for vitamin D3 synthesis
- Provide a lay box when gravid
- Watch for signs of egg binding (lethargy, straining, loss of appetite)""",
            recommendations={
                "feeding_frequency": "Insects 2x/week, vegetables 3x/week",
                "insects_per_feeding": "4-5 head-sized",
                "vegetable_portion": "Size of dragon's head",
                "insects": ["dubia roaches", "black soldier fly larvae", "crickets"],
                "vegetables": ["collard greens", "mustard greens", "turnip greens", "dandelion greens"],
                "supplements": ["Calcium (daily on all foods)", "Multivitamin (2x/week on salads)"],
                "special_care": ["Monitor for egg binding", "Provide lay box", "Extra calcium critical"]
            },
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),

        # ========== LEOPARD GECKO CARE ==========
        CareGuideline(
            species="Leopard Gecko",
            age_category="juvenile",
            guideline_type="feeding",
            title="Juvenile Leopard Gecko Feeding Guidelines",
            content="""Juvenile leopard geckos require daily feeding for proper growth:

**Feeding Schedule:**
- Daily feeding
- Offer 2 appropriately-sized bugs per 1 inch of gecko length, OR as much as they can eat in 15 minutes
- Feed in the evening (leopard geckos are nocturnal)

**Best Feeder Insects:**
- Crickets
- Dubia roaches
- Mealworms
- Small hornworms (treats)

**Supplementation:**
- All insect feeders should be dusted with calcium powder
- WITH UVB: Use calcium without D3. Multivitamin 1x per week
- WITHOUT UVB: Use calcium WITH D3. Multivitamin 1x per week
- If using Repashy CalciumPlus, no additional multivitamin is necessary

**Water:**
- Fresh water in shallow dish daily""",
            recommendations={
                "feeding_frequency": "daily",
                "amount": "2 bugs per inch of length OR 15 minutes worth",
                "feeding_time": "evening",
                "supplements": ["Calcium (every feeding)", "Multivitamin (weekly)"]
            },
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            is_default=True,
        ),
        CareGuideline(
            species="Leopard Gecko",
            age_category="adult",
            guideline_type="feeding",
            title="Adult Leopard Gecko Feeding Guidelines",
            content="""Adult leopard geckos require less frequent feeding:

**Feeding Schedule:**
- Juveniles: Daily
- Young adults: Every other day / every 3 days
- Adults whose tail is fatter than their neck: Every 5 days
- Offer 2 appropriately-sized bugs per 1 inch of gecko length, OR as much as they can eat in 15 minutes

**Best Feeder Insects:**
- Variety is key: crickets, dubia roaches, mealworms, superworms
- Occasional treats: hornworms, waxworms (high fat)

**Supplementation:**
- All insect feeders should be dusted with calcium powder
- WITH UVB: Use calcium without D3. Multivitamin 1x every other week
- WITHOUT UVB: Use calcium WITH D3. Multivitamin 1x every other week
- If using Repashy CalciumPlus, no additional multivitamin is necessary

**Body Condition:**
- Monitor tail thickness - should be plump but not bulbous
- Avoid overfeeding as obesity is common in adults
- Adjust feeding frequency based on body condition""",
            recommendations={
                "feeding_frequency": "every 2-3 days (young adults) to every 5 days (mature adults)",
                "amount": "2 bugs per inch of length OR 15 minutes worth",
                "feeding_time": "evening",
                "supplements": ["Calcium (every feeding)", "Multivitamin (bi-weekly)"]
            },
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            is_default=True,
        ),

        # ========== CRESTED GECKO CARE ==========
        CareGuideline(
            species="Crested Gecko",
            age_category="juvenile",
            guideline_type="feeding",
            title="Juvenile Crested Gecko Feeding Guidelines (0-12 months)",
            content="""Juvenile crested geckos require daily feeding for proper growth:

**How to Feed:**
- Mix the powdered diet with water to a ketchup or smoothie consistency
- Offer in a biodegradable condiment cup
- Most cresties prefer eating up off the ground, so use a wall-mounted feeding ledge

**Juvenile Feeding Schedule (0-12 months):**
- CGD: Daily
- Insects: 1-2x per week

**Crested Gecko Diet (CGD):**
- Commercial CGD powder mixed with water
- Offer fresh every evening
- Remove uneaten food after 24 hours
- Popular brands: Pangea, Repashy, Lugarti

**Live Insects:**
- 1-2 times per week for growth
- Small crickets, dubia roaches, or black soldier fly larvae
- Appropriately sized insects
- Dust with calcium (CGD already contains vitamins)

**Supplementation:**
- Not needed if feeding complete CGD diet (CGD contains all vitamins)
- If feeding insects: use calcium WITHOUT D3 if you have UVB lighting, or calcium WITH D3 if no UVB
- No multivitamin needed - CGD provides complete nutrition""",
            recommendations={
                "feeding_frequency": "CGD daily, insects 1-2x/week",
                "primary_diet": "Commercial CGD",
                "age_range": "0-12 months",
                "supplements": ["Not needed with complete CGD"]
            },
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/crested-gecko-care/",
            is_default=True,
        ),
        CareGuideline(
            species="Crested Gecko",
            age_category="adult",
            guideline_type="feeding",
            title="Adult Crested Gecko Feeding Guidelines (12+ months)",
            content="""Adult crested geckos require less frequent feeding than juveniles:

**How to Feed:**
- Mix the powdered diet with water to a ketchup or smoothie consistency
- Offer in a biodegradable condiment cup
- Most cresties prefer eating up off the ground, so use a wall-mounted feeding ledge

**Adult Feeding Schedule (12+ months):**
- CGD: Every 2-3 days
- Insects: 0-1x per week (optional)

**Crested Gecko Diet (CGD):**
- Commercial CGD powder mixed with water
- Offer fresh every 2-3 days
- Remove uneaten food after 24 hours
- Popular brands: Pangea, Repashy, Lugarti

**Live Insects (Optional):**
- 0-1 times per week as optional enrichment
- Small crickets, dubia roaches, or black soldier fly larvae
- Not required for adults
- Dust with calcium if offering insects

**Supplementation:**
- Not needed if feeding complete CGD diet (CGD contains all vitamins)
- If feeding insects: use calcium WITHOUT D3 if you have UVB lighting, or calcium WITH D3 if no UVB
- No multivitamin needed - CGD provides complete nutrition""",
            recommendations={
                "feeding_frequency": "CGD every 2-3 days, insects 0-1x/week (optional)",
                "primary_diet": "Commercial CGD",
                "age_range": "12+ months",
                "supplements": ["Not needed with complete CGD"]
            },
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/crested-gecko-care/",
            is_default=True,
        ),

        # ========== BALL PYTHON CARE ==========
        CareGuideline(
            species="Ball Python",
            age_category="juvenile",
            guideline_type="feeding",
            title="Juvenile Ball Python Feeding Guidelines",
            content="""Juvenile ball pythons (0-2 years) require regular feeding for proper growth:

**Feeding Schedule:**
- Every 5-7 days
- Prey should be 10-15% of snake's body weight
- Frozen/thawed rodents recommended (safer than live)

**Prey Sizing:**
- Fuzzy mice for hatchlings
- Hopper mice for growing juveniles
- Adult mice or small rats as they grow
- Prey should be about the same width as the snake's widest point

**Feeding Tips:**
- Feed in evening when they're most active
- Use separate feeding container or feed in enclosure
- Wait 48 hours after feeding before handling
- If snake refuses food, check temperatures and reduce stress

**Common Issues:**
- Ball pythons can be picky eaters
- Maintain proper temperatures (88-92°F hot spot, 78-80°F cool side)
- Provide hiding spots for security""",
            recommendations={
                "feeding_frequency": "every 5-7 days",
                "prey_size": "10-15% of body weight",
                "prey_type": "frozen/thawed rodents",
                "supplements": ["None needed"]
            },
            source_name="Reptile Magazine",
            source_url="https://reptilesmagazine.com/ball-python-care-sheet/",
            is_default=True,
        ),
        CareGuideline(
            species="Ball Python",
            age_category="adult",
            guideline_type="feeding",
            title="Adult Ball Python Feeding Guidelines",
            content="""Adult ball pythons (2+ years) require less frequent feeding:

**Feeding Schedule:**
- Every 10-14 days
- Prey should be similar to or slightly larger than snake's widest point
- Frozen/thawed rats or large mice

**Prey Sizing:**
- Small to medium rats for most adults
- Prey should leave a small, barely visible lump
- Avoid overfeeding as obesity can cause health issues

**Feeding Tips:**
- Adults can be fed less frequently during winter months
- Monitor body condition - should be rounded, not thin or obese
- Ball pythons naturally eat less during breeding season (winter)

**Weight Management:**
- Adult females: 1200-1800g typically
- Adult males: 800-1200g typically
- Weigh monthly to track health""",
            recommendations={
                "feeding_frequency": "every 10-14 days",
                "prey_size": "same width as snake's widest point",
                "prey_type": "frozen/thawed rats",
                "supplements": ["None needed"]
            },
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/ball-python-care/",
            is_default=True,
        ),

        # ========== GENERAL SUPPLEMENT GUIDELINES ==========
        CareGuideline(
            species=None,  # General for all species
            age_category=None,
            guideline_type="supplements",
            title="Reptile Supplement Guidelines",
            content="""Proper supplementation is critical for captive reptile health:

**Calcium:**
- Most important supplement for insect-eating reptiles
- Two types: with D3 and without D3
- **With D3:** For reptiles without UVB lighting, or 2-3x per week for those with UVB
- **Without D3:** For daily dusting when reptile has UVB exposure

**Multivitamins:**
- Contains vitamin A, B complex, E, and other essential vitamins
- Use 1-2 times per week
- Don't overdo - hypervitaminosis can occur

**Vitamin D3:**
- Essential for calcium absorption
- Obtained from UVB lighting OR dietary supplementation
- Never use both high-output UVB and heavy D3 supplementation

**Application:**
- "Dust" feeder insects before feeding
- Place insects in bag/container with supplement and shake gently
- Gut-load insects 24-48 hours before feeding for extra nutrition

**Species-Specific Notes:**
- Herbivorous reptiles: May need different supplement schedules
- Snakes: Get all nutrition from whole prey, no supplements needed
- Crested geckos: Complete diet powders contain all needed vitamins""",
            recommendations={
                "calcium_without_d3": "Daily (with UVB) or 3-4x/week (without UVB)",
                "calcium_with_d3": "2-3x/week (with UVB) or every feeding (no UVB)",
                "multivitamin": "1-2x/week",
                "application": "Dust insects before feeding"
            },
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/reptile-supplements/",
            is_default=True,
        ),
    ]

    for guideline in guidelines:
        # Check if already exists
        result = await db.execute(
            select(CareGuideline).where(
                CareGuideline.title == guideline.title,
                CareGuideline.is_default == True
            )
        )
        if not result.scalar_one_or_none():
            db.add(guideline)

    await db.commit()


async def seed_schedule_data(db: AsyncSession):
    """Seed all schedule-related default data"""
    await seed_schedule_templates(db)
    await seed_care_guidelines(db)
    print("Schedule templates and care guidelines seeded successfully!")
