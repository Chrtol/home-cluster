"""
Seed database with default supplement rotation templates from reputable sources.

Sources:
- ReptiFiles (reptifiles.com)
- The Bio Dude
- Reptile Magazine
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import SupplementRotationTemplate, Supplement


async def seed_supplement_rotation_templates(db: AsyncSession):
    """Seed default supplement rotation templates for common reptile species"""

    # First, get supplement IDs
    calcium_without_d3_result = await db.execute(
        select(Supplement).where(Supplement.name == "Calcium without D3")
    )
    calcium_without_d3 = calcium_without_d3_result.scalar_one_or_none()

    calcium_with_d3_result = await db.execute(
        select(Supplement).where(Supplement.name == "Calcium with D3")
    )
    calcium_with_d3 = calcium_with_d3_result.scalar_one_or_none()

    multivitamin_result = await db.execute(
        select(Supplement).where(Supplement.name == "Multivitamin")
    )
    multivitamin = multivitamin_result.scalar_one_or_none()

    if not calcium_without_d3 or not calcium_with_d3 or not multivitamin:
        print("Warning: Required supplements not found. Skipping supplement rotation template seeding.")
        return

    templates = [
        # ========== BEARDED DRAGON SUPPLEMENT ROTATIONS ==========
        # Bearded dragons REQUIRE UVB lighting

        # Hatchling (0-3 months)
        SupplementRotationTemplate(
            name="ReptiFiles - Hatchling Bearded Dragon Calcium without D3",
            description="Calcium without D3 on every feeding for hatchling bearded dragons",
            species="Bearded Dragon",
            age_category="hatchling",
            uvb_lighting=True,
            supplement_id=calcium_without_d3.id,
            trigger_mode="feeding_count",
            every_n_feedings=1,
            counting_mode="all_feedings",
            applies_to_category=None,  # Apply to all feedings (insects and salads)
            application_mode="any_feeding",
            priority=10,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            notes="Dust all insects and salads with calcium without D3. Bearded dragons require UVB lighting.",
            is_default=True,
        ),
        SupplementRotationTemplate(
            name="ReptiFiles - Hatchling Bearded Dragon Multivitamin",
            description="Multivitamin 2x per week for hatchling bearded dragons",
            species="Bearded Dragon",
            age_category="hatchling",
            uvb_lighting=True,
            supplement_id=multivitamin.id,
            trigger_mode="schedule_based",
            schedule_days_of_week="2,5",  # Tuesday and Friday
            schedule_frequency_days=7,
            applies_to_category="salad",
            application_mode="any_feeding",
            priority=5,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            notes="Multivitamin on salads 2x/week (Tuesday and Friday).",
            is_default=True,
        ),

        # Juvenile (3-12 months)
        SupplementRotationTemplate(
            name="ReptiFiles - Juvenile Bearded Dragon Calcium without D3",
            description="Calcium without D3 on every feeding for juvenile bearded dragons",
            species="Bearded Dragon",
            age_category="juvenile",
            uvb_lighting=True,
            supplement_id=calcium_without_d3.id,
            trigger_mode="feeding_count",
            every_n_feedings=1,
            counting_mode="all_feedings",
            applies_to_category=None,
            application_mode="any_feeding",
            priority=10,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            notes="Dust all insects and salads with calcium without D3. Bearded dragons require UVB lighting.",
            is_default=True,
        ),
        SupplementRotationTemplate(
            name="ReptiFiles - Juvenile Bearded Dragon Multivitamin",
            description="Multivitamin 2x per week for juvenile bearded dragons",
            species="Bearded Dragon",
            age_category="juvenile",
            uvb_lighting=True,
            supplement_id=multivitamin.id,
            trigger_mode="schedule_based",
            schedule_days_of_week="2,5",
            schedule_frequency_days=7,
            applies_to_category="salad",
            application_mode="any_feeding",
            priority=5,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            notes="Multivitamin on salads 2x/week (Tuesday and Friday).",
            is_default=True,
        ),

        # Adult (12+ months)
        SupplementRotationTemplate(
            name="ReptiFiles - Adult Bearded Dragon Calcium without D3",
            description="Calcium without D3 on every feeding for adult bearded dragons",
            species="Bearded Dragon",
            age_category="adult",
            uvb_lighting=True,
            supplement_id=calcium_without_d3.id,
            trigger_mode="feeding_count",
            every_n_feedings=1,
            counting_mode="all_feedings",
            applies_to_category=None,
            application_mode="any_feeding",
            priority=10,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            notes="Dust all insects and salads with calcium without D3. Bearded dragons require UVB lighting.",
            is_default=True,
        ),
        SupplementRotationTemplate(
            name="ReptiFiles - Adult Bearded Dragon Multivitamin",
            description="Multivitamin 2x per week for adult bearded dragons",
            species="Bearded Dragon",
            age_category="adult",
            uvb_lighting=True,
            supplement_id=multivitamin.id,
            trigger_mode="schedule_based",
            schedule_days_of_week="2,5",
            schedule_frequency_days=7,
            applies_to_category="salad",
            application_mode="any_feeding",
            priority=5,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            notes="Multivitamin on salads 2x/week (Tuesday and Friday).",
            is_default=True,
        ),

        # Gravid Female
        SupplementRotationTemplate(
            name="ReptiFiles - Gravid Female Bearded Dragon Calcium without D3",
            description="Calcium without D3 on every feeding for gravid bearded dragons",
            species="Bearded Dragon",
            age_category="gravid",
            uvb_lighting=True,
            supplement_id=calcium_without_d3.id,
            trigger_mode="feeding_count",
            every_n_feedings=1,
            counting_mode="all_feedings",
            applies_to_category=None,
            application_mode="any_feeding",
            priority=10,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            notes="Increased calcium for gravid females. Dust all insects and salads.",
            is_default=True,
        ),
        SupplementRotationTemplate(
            name="ReptiFiles - Gravid Female Bearded Dragon Multivitamin",
            description="Multivitamin 2x per week for gravid bearded dragons",
            species="Bearded Dragon",
            age_category="gravid",
            uvb_lighting=True,
            supplement_id=multivitamin.id,
            trigger_mode="schedule_based",
            schedule_days_of_week="2,5",
            schedule_frequency_days=7,
            applies_to_category="salad",
            application_mode="any_feeding",
            priority=5,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/bearded-dragon-care/",
            notes="Multivitamin on salads 2x/week (Tuesday and Friday).",
            is_default=True,
        ),

        # ========== LEOPARD GECKO SUPPLEMENT ROTATIONS ==========

        # Juvenile Leopard Gecko - With UVB
        SupplementRotationTemplate(
            name="ReptiFiles - Juvenile Leopard Gecko Calcium without D3 (With UVB)",
            description="Calcium without D3 on every feeding for juvenile leopard geckos with UVB",
            species="Leopard Gecko",
            age_category="juvenile",
            uvb_lighting=True,
            supplement_id=calcium_without_d3.id,
            trigger_mode="feeding_count",
            every_n_feedings=1,
            counting_mode="all_feedings",
            applies_to_category=None,
            application_mode="any_feeding",
            priority=10,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            notes="Dust all insects with calcium without D3. Gecko has UVB lighting and synthesizes D3 naturally.",
            is_default=True,
        ),
        SupplementRotationTemplate(
            name="ReptiFiles - Juvenile Leopard Gecko Multivitamin (With UVB)",
            description="Multivitamin 1x per week for juvenile leopard geckos with UVB",
            species="Leopard Gecko",
            age_category="juvenile",
            uvb_lighting=True,
            supplement_id=multivitamin.id,
            trigger_mode="schedule_based",
            schedule_days_of_week="3",  # Wednesday
            schedule_frequency_days=7,
            applies_to_category=None,
            application_mode="any_feeding",
            priority=5,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            notes="Multivitamin on insects 1x/week (Wednesday).",
            is_default=True,
        ),

        # Juvenile Leopard Gecko - Without UVB
        SupplementRotationTemplate(
            name="ReptiFiles - Juvenile Leopard Gecko Calcium with D3 (No UVB)",
            description="Calcium with D3 on every feeding for juvenile leopard geckos without UVB",
            species="Leopard Gecko",
            age_category="juvenile",
            uvb_lighting=False,
            supplement_id=calcium_with_d3.id,
            trigger_mode="feeding_count",
            every_n_feedings=1,
            counting_mode="all_feedings",
            applies_to_category=None,
            application_mode="any_feeding",
            priority=10,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            notes="Dust all insects with calcium with D3. D3 supplementation is critical without UVB lighting.",
            is_default=True,
        ),
        SupplementRotationTemplate(
            name="ReptiFiles - Juvenile Leopard Gecko Multivitamin (No UVB)",
            description="Multivitamin 1x per week for juvenile leopard geckos without UVB",
            species="Leopard Gecko",
            age_category="juvenile",
            uvb_lighting=False,
            supplement_id=multivitamin.id,
            trigger_mode="schedule_based",
            schedule_days_of_week="3",
            schedule_frequency_days=7,
            applies_to_category=None,
            application_mode="any_feeding",
            priority=5,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            notes="Multivitamin on insects 1x/week (Wednesday).",
            is_default=True,
        ),

        # Adult Leopard Gecko - With UVB
        SupplementRotationTemplate(
            name="ReptiFiles - Adult Leopard Gecko Calcium without D3 (With UVB)",
            description="Calcium without D3 on every feeding for adult leopard geckos with UVB",
            species="Leopard Gecko",
            age_category="adult",
            uvb_lighting=True,
            supplement_id=calcium_without_d3.id,
            trigger_mode="feeding_count",
            every_n_feedings=1,
            counting_mode="all_feedings",
            applies_to_category=None,
            application_mode="any_feeding",
            priority=10,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            notes="Dust all insects with calcium without D3. Gecko has UVB lighting and synthesizes D3 naturally.",
            is_default=True,
        ),
        SupplementRotationTemplate(
            name="ReptiFiles - Adult Leopard Gecko Multivitamin (With UVB)",
            description="Multivitamin 1x per week for adult leopard geckos with UVB",
            species="Leopard Gecko",
            age_category="adult",
            uvb_lighting=True,
            supplement_id=multivitamin.id,
            trigger_mode="schedule_based",
            schedule_days_of_week="3",
            schedule_frequency_days=7,
            applies_to_category=None,
            application_mode="any_feeding",
            priority=5,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            notes="Multivitamin on insects 1x/week (Wednesday).",
            is_default=True,
        ),

        # Adult Leopard Gecko - Without UVB
        SupplementRotationTemplate(
            name="ReptiFiles - Adult Leopard Gecko Calcium with D3 (No UVB)",
            description="Calcium with D3 on every feeding for adult leopard geckos without UVB",
            species="Leopard Gecko",
            age_category="adult",
            uvb_lighting=False,
            supplement_id=calcium_with_d3.id,
            trigger_mode="feeding_count",
            every_n_feedings=1,
            counting_mode="all_feedings",
            applies_to_category=None,
            application_mode="any_feeding",
            priority=10,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            notes="Dust all insects with calcium with D3. D3 supplementation is critical without UVB lighting.",
            is_default=True,
        ),
        SupplementRotationTemplate(
            name="ReptiFiles - Adult Leopard Gecko Multivitamin (No UVB)",
            description="Multivitamin 1x per week for adult leopard geckos without UVB",
            species="Leopard Gecko",
            age_category="adult",
            uvb_lighting=False,
            supplement_id=multivitamin.id,
            trigger_mode="schedule_based",
            schedule_days_of_week="3",
            schedule_frequency_days=7,
            applies_to_category=None,
            application_mode="any_feeding",
            priority=5,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/leopard-gecko-care/",
            notes="Multivitamin on insects 1x/week (Wednesday).",
            is_default=True,
        ),

        # ========== CRESTED GECKO SUPPLEMENT ROTATIONS ==========
        # Crested geckos eat prepared food (Crested Gecko Diet) which contains vitamins
        # Only need calcium supplementation occasionally

        # Juvenile Crested Gecko
        SupplementRotationTemplate(
            name="ReptiFiles - Juvenile Crested Gecko Calcium with D3",
            description="Calcium with D3 1x per week for juvenile crested geckos",
            species="Crested Gecko",
            age_category="juvenile",
            uvb_lighting=None,  # Can work with or without UVB
            supplement_id=calcium_with_d3.id,
            trigger_mode="schedule_based",
            schedule_days_of_week="1",  # Monday
            schedule_frequency_days=7,
            applies_to_category=None,
            application_mode="any_feeding",
            priority=10,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/crested-gecko-care/",
            notes="Crested gecko prepared foods contain multivitamins. Only calcium supplementation needed 1x/week.",
            is_default=True,
        ),

        # Adult Crested Gecko
        SupplementRotationTemplate(
            name="ReptiFiles - Adult Crested Gecko Calcium with D3",
            description="Calcium with D3 1x per week for adult crested geckos",
            species="Crested Gecko",
            age_category="adult",
            uvb_lighting=None,
            supplement_id=calcium_with_d3.id,
            trigger_mode="schedule_based",
            schedule_days_of_week="1",
            schedule_frequency_days=7,
            applies_to_category=None,
            application_mode="any_feeding",
            priority=10,
            is_exclusive=True,
            source_name="ReptiFiles",
            source_url="https://reptifiles.com/crested-gecko-care/",
            notes="Crested gecko prepared foods contain multivitamins. Only calcium supplementation needed 1x/week.",
            is_default=True,
        ),
    ]

    for template in templates:
        # Check if already exists by name
        result = await db.execute(
            select(SupplementRotationTemplate).where(
                SupplementRotationTemplate.name == template.name,
                SupplementRotationTemplate.is_default == True
            )
        )
        if not result.scalar_one_or_none():
            db.add(template)

    await db.commit()


async def seed_supplement_rotation_data(db: AsyncSession):
    """Seed all supplement rotation template data"""
    await seed_supplement_rotation_templates(db)
    print("Supplement rotation templates seeded successfully!")
