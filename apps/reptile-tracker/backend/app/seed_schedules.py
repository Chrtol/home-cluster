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
        ScheduleTemplate(
            name="Juvenile Bearded Dragon - Daily Feeding",
            description="Daily insects for growing juvenile bearded dragons (3-12 months)",
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
            notes="Feed after basking for 1-2 hours. Offer as many insects as they can eat in 10-15 minutes.",
            is_default=True,
        ),
        ScheduleTemplate(
            name="Juvenile Bearded Dragon - Daily Salad",
            description="Fresh vegetables daily for juvenile bearded dragons",
            species="Bearded Dragon",
            age_category="juvenile",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=1,
            food_category="salad",
            time_slot="afternoon",
            notes="Offer fresh greens daily. Common choices: collard greens, mustard greens, turnip greens.",
            is_default=True,
        ),
        ScheduleTemplate(
            name="Adult Bearded Dragon - Insects (Every Other Day)",
            description="Insects every other day for adult bearded dragons (12+ months)",
            species="Bearded Dragon",
            age_category="adult",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=2,
            food_category="insects",
            time_slot="morning",
            earliest_time=time(9, 0),
            latest_time=time(12, 0),
            time_window_enabled=True,
            notes="Adults need fewer insects to prevent obesity. 10-15 insects per feeding.",
            is_default=True,
        ),
        ScheduleTemplate(
            name="Adult Bearded Dragon - Daily Salad",
            description="Fresh vegetables daily for adult bearded dragons",
            species="Bearded Dragon",
            age_category="adult",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=1,
            food_category="salad",
            notes="Adults should eat 80% vegetables, 20% insects. Offer salad daily.",
            is_default=True,
        ),

        # ========== LEOPARD GECKO SCHEDULES ==========
        ScheduleTemplate(
            name="Juvenile Leopard Gecko - Daily Feeding",
            description="Daily insects for growing juvenile leopard geckos (0-12 months)",
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
            notes="Feed in evening as leopard geckos are nocturnal. Offer 5-8 appropriately sized insects.",
            is_default=True,
        ),
        ScheduleTemplate(
            name="Adult Leopard Gecko - Every Other Day Feeding",
            description="Insects every other day for adult leopard geckos (12+ months)",
            species="Leopard Gecko",
            age_category="adult",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=2,
            food_category="insects",
            time_slot="evening",
            earliest_time=time(18, 0),
            latest_time=time(21, 0),
            time_window_enabled=True,
            notes="Adults should eat 6-8 insects every other day. Adjust based on body condition.",
            is_default=True,
        ),

        # ========== CRESTED GECKO SCHEDULES ==========
        ScheduleTemplate(
            name="Crested Gecko - Daily CGD Feeding",
            description="Daily crested gecko diet (powder food)",
            species="Crested Gecko",
            age_category=None,  # All ages
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=1,
            food_category="prepared",
            time_slot="evening",
            notes="Offer fresh CGD every evening. Remove uneaten food after 24 hours.",
            is_default=True,
        ),
        ScheduleTemplate(
            name="Crested Gecko - Weekly Live Insects",
            description="Live insects once or twice per week as enrichment",
            species="Crested Gecko",
            age_category=None,
            schedule_type="feeding",
            schedule_rule="days_of_week",
            days_of_week="3",  # Wednesday
            food_category="insects",
            time_slot="evening",
            notes="Optional treat feeding. 2-3 appropriately sized insects.",
            is_default=True,
        ),

        # ========== BALL PYTHON SCHEDULES ==========
        ScheduleTemplate(
            name="Juvenile Ball Python - Weekly Feeding",
            description="Weekly rodent feeding for juvenile ball pythons (0-2 years)",
            species="Ball Python",
            age_category="juvenile",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=7,
            food_category="frozen_animal",
            time_slot="evening",
            notes="Feed appropriately sized prey (10-15% of body weight). Frozen/thawed recommended.",
            is_default=True,
        ),
        ScheduleTemplate(
            name="Adult Ball Python - Bi-Weekly Feeding",
            description="Every 10-14 days for adult ball pythons (2+ years)",
            species="Ball Python",
            age_category="adult",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=10,
            food_category="frozen_animal",
            notes="Feed every 10-14 days. Prey should be same width as widest part of snake.",
            is_default=True,
        ),

        # ========== CORN SNAKE SCHEDULES ==========
        ScheduleTemplate(
            name="Juvenile Corn Snake - Weekly Feeding",
            description="Weekly feeding for juvenile corn snakes (0-2 years)",
            species="Corn Snake",
            age_category="juvenile",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=5,
            food_category="frozen_animal",
            notes="Feed every 5-7 days. Appropriately sized prey (slightly larger than snake's widest point).",
            is_default=True,
        ),
        ScheduleTemplate(
            name="Adult Corn Snake - Weekly Feeding",
            description="Weekly feeding for adult corn snakes (2+ years)",
            species="Corn Snake",
            age_category="adult",
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=7,
            food_category="frozen_animal",
            notes="Feed every 7-10 days. Adult mice or small rats depending on size.",
            is_default=True,
        ),

        # ========== BLUE TONGUE SKINK SCHEDULES ==========
        ScheduleTemplate(
            name="Blue Tongue Skink - Every Other Day Feeding",
            description="Varied diet every other day for blue tongue skinks",
            species="Blue Tongue Skink",
            age_category=None,
            schedule_type="feeding",
            schedule_rule="every_x_days",
            frequency_days=2,
            food_category="salad",
            notes="Omnivorous diet: 50% vegetables, 40% protein, 10% fruit. Rotate food types.",
            is_default=True,
        ),

        # ========== GENERAL SUPPLEMENT SCHEDULES ==========
        ScheduleTemplate(
            name="Calcium with D3 - Twice Weekly",
            description="Standard calcium with D3 supplementation schedule",
            species=None,  # All species
            age_category=None,
            schedule_type="supplement",
            schedule_rule="days_of_week",
            days_of_week="2,5",  # Tuesday and Friday
            notes="For reptiles with UVB lighting. Dust insects before feeding.",
            is_default=True,
        ),
        ScheduleTemplate(
            name="Multivitamin - Weekly",
            description="Weekly multivitamin supplementation",
            species=None,
            age_category=None,
            schedule_type="supplement",
            schedule_rule="days_of_week",
            days_of_week="6",  # Saturday
            notes="Use a quality reptile multivitamin. Dust insects lightly.",
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
            name="Tropical Species - Twice Daily Misting",
            description="Morning and evening misting for tropical species",
            species="Crested Gecko",
            age_category=None,
            schedule_type="misting",
            schedule_rule="every_x_days",
            frequency_days=1,
            time_slot="morning",
            earliest_time=time(8, 0),
            latest_time=time(10, 0),
            time_window_enabled=True,
            notes="Mist enclosure to maintain 60-80% humidity. Allow to dry between mistings.",
            is_default=True,
        ),
        ScheduleTemplate(
            name="Tropical Species - Evening Misting",
            description="Evening misting for tropical species",
            species="Crested Gecko",
            age_category=None,
            schedule_type="misting",
            schedule_rule="every_x_days",
            frequency_days=1,
            time_slot="evening",
            earliest_time=time(18, 0),
            latest_time=time(20, 0),
            time_window_enabled=True,
            notes="Evening mist to maintain overnight humidity.",
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
            age_category="juvenile",
            guideline_type="feeding",
            title="Juvenile Bearded Dragon Feeding Guidelines",
            content="""Juvenile bearded dragons (0-12 months) require daily feeding of both insects and vegetables:

**Insects (Daily):**
- Offer 2-3 times per day
- Feed as many appropriately sized insects as they can eat in 10-15 minutes
- Insects should be no larger than the space between the dragon's eyes
- Best choices: dubia roaches, crickets, black soldier fly larvae

**Vegetables (Daily):**
- Fresh salad should be available daily
- Best choices: collard greens, mustard greens, turnip greens, dandelion greens
- Avoid: iceberg lettuce, spinach (in excess)
- Chop finely for easier eating

**Supplementation:**
- Calcium without D3: Daily on insects
- Calcium with D3: 2-3 times per week
- Multivitamin: 1-2 times per week""",
            recommendations={
                "feeding_frequency": "daily",
                "insect_percentage": 80,
                "vegetable_percentage": 20,
                "insects_per_feeding": "10-15 minutes worth",
                "supplements": ["Calcium without D3 (daily)", "Calcium with D3 (2-3x/week)", "Multivitamin (1-2x/week)"]
            },
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            is_default=True,
        ),
        CareGuideline(
            species="Bearded Dragon",
            age_category="adult",
            guideline_type="feeding",
            title="Adult Bearded Dragon Feeding Guidelines",
            content="""Adult bearded dragons (12+ months) require a diet higher in vegetables:

**Diet Ratio:**
- 80% vegetables, 20% insects
- This prevents obesity which is common in adult bearded dragons

**Insects:**
- Feed every other day or 3-4 times per week
- 10-15 appropriately sized insects per feeding
- Variety is important: dubia roaches, crickets, superworms, hornworms

**Vegetables (Daily):**
- Fresh salad daily
- Staples: collard greens, mustard greens, turnip greens, endive, escarole
- Occasional additions: bell peppers, squash, carrots (shredded)
- Fruits: Occasional treats only (too much sugar)

**Supplementation:**
- Calcium with D3: 2-3 times per week
- Multivitamin: 1-2 times per week""",
            recommendations={
                "feeding_frequency": "insects every 2 days, salad daily",
                "insect_percentage": 20,
                "vegetable_percentage": 80,
                "insects_per_feeding": "10-15",
                "supplements": ["Calcium with D3 (2-3x/week)", "Multivitamin (1-2x/week)"]
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
            content="""Juvenile leopard geckos (0-12 months) are in rapid growth and require frequent feeding:

**Feeding Schedule:**
- Daily feeding
- Offer 5-8 appropriately sized insects
- Feed in the evening (leopard geckos are nocturnal)

**Best Feeder Insects:**
- Crickets
- Dubia roaches
- Mealworms (occasional)
- Small hornworms (treats)

**Insect Sizing:**
- No larger than the space between the gecko's eyes
- Smaller is safer than too large

**Supplementation:**
- Calcium with D3: Every feeding (dust insects)
- Multivitamin: Once per week

**Water:**
- Fresh water in shallow dish daily
- Mist occasionally for humidity""",
            recommendations={
                "feeding_frequency": "daily",
                "insects_per_feeding": "5-8",
                "feeding_time": "evening",
                "supplements": ["Calcium with D3 (every feeding)", "Multivitamin (weekly)"]
            },
            source_name="The Bio Dude",
            source_url="https://www.thebiodude.com/blogs/bio-activity-with-your-pets/leopard-gecko-care-guide",
            is_default=True,
        ),
        CareGuideline(
            species="Leopard Gecko",
            age_category="adult",
            guideline_type="feeding",
            title="Adult Leopard Gecko Feeding Guidelines",
            content="""Adult leopard geckos (12+ months) require less frequent feeding:

**Feeding Schedule:**
- Every other day, or 3-4 times per week
- 6-8 appropriately sized insects per feeding
- Feed in the evening

**Best Feeder Insects:**
- Variety is key: crickets, dubia roaches, mealworms, superworms
- Occasional treats: hornworms, waxworms (high fat)

**Supplementation:**
- Calcium with D3: Every feeding (dust insects)
- Multivitamin: Once per week

**Body Condition:**
- Monitor tail thickness - should be plump but not bulbous
- Avoid overfeeding as obesity is common in adults
- Adjust feeding frequency based on body condition""",
            recommendations={
                "feeding_frequency": "every other day",
                "insects_per_feeding": "6-8",
                "feeding_time": "evening",
                "supplements": ["Calcium with D3 (every feeding)", "Multivitamin (weekly)"]
            },
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            is_default=True,
        ),

        # ========== CRESTED GECKO CARE ==========
        CareGuideline(
            species="Crested Gecko",
            age_category=None,
            guideline_type="feeding",
            title="Crested Gecko Feeding Guidelines",
            content="""Crested geckos thrive on a diet of commercially prepared crested gecko diet (CGD):

**Primary Diet:**
- Commercial CGD (powder mixed with water)
- Offer fresh every evening
- Remove uneaten food after 24 hours
- Popular brands: Pangea, Repashy, Lugarti

**Live Insects (Optional):**
- 1-2 times per week as enrichment
- Small crickets, dubia roaches, or black soldier fly larvae
- 2-3 appropriately sized insects
- Dust with calcium (CGD already contains vitamins)

**Fruits (Occasional):**
- Small amounts of mashed fruit as treats
- Banana, mango, papaya, or fig
- Not necessary if feeding quality CGD

**Supplementation:**
- Not needed if feeding complete CGD diet
- If feeding insects regularly, use calcium without D3""",
            recommendations={
                "feeding_frequency": "CGD daily, insects 1-2x/week",
                "primary_diet": "Commercial CGD",
                "insects_per_feeding": "2-3 (optional)",
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
