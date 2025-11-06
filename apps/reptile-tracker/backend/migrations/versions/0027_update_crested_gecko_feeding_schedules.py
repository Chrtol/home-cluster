"""Update crested gecko feeding schedules with age-specific templates

Revision ID: 0027
Revises: 0026
Create Date: 2025-01-06
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0027'
down_revision = '0026'
branch_labels = None
depends_on = None


def upgrade():
    # Delete old generic crested gecko feeding templates
    op.execute("""
        DELETE FROM schedule_templates
        WHERE name IN (
            'ReptiFiles - Crested Gecko Daily CGD Feeding',
            'ReptiFiles - Crested Gecko Weekly Live Insects'
        )
        AND is_default = true
    """)

    # Insert new age-specific juvenile templates
    op.execute("""
        INSERT INTO schedule_templates (
            name, description, species, age_category, schedule_type, schedule_rule,
            frequency_days, days_of_week, food_category, time_slot,
            notes, is_default, source_name, source_url
        ) VALUES
        (
            'ReptiFiles - Juvenile Crested Gecko Daily CGD',
            'Daily crested gecko diet for juveniles (0-12 months)',
            'Crested Gecko',
            'juvenile',
            'feeding',
            'every_x_days',
            1,
            NULL,
            'prepared',
            'evening',
            'Mix the powdered diet with water to a ketchup or smoothie consistency. Offer fresh CGD daily for growing juveniles.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/crested-gecko-care/'
        ),
        (
            'ReptiFiles - Juvenile Crested Gecko Insects',
            'Live insects 1-2x weekly for juvenile crested geckos',
            'Crested Gecko',
            'juvenile',
            'feeding',
            'days_of_week',
            NULL,
            '2,5',
            'insects',
            'evening',
            'Offer appropriately sized insects 1-2 times per week as supplemental nutrition for growth.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/crested-gecko-care/'
        ),
        (
            'ReptiFiles - Adult Crested Gecko CGD',
            'CGD every 2-3 days for adult crested geckos (12+ months)',
            'Crested Gecko',
            'adult',
            'feeding',
            'every_x_days',
            2,
            NULL,
            'prepared',
            'evening',
            'Mix the powdered diet with water to a ketchup or smoothie consistency. Adults can eat every 2-3 days.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/crested-gecko-care/'
        ),
        (
            'ReptiFiles - Adult Crested Gecko Insects (Optional)',
            'Optional live insects 0-1x weekly for adults',
            'Crested Gecko',
            'adult',
            'feeding',
            'days_of_week',
            NULL,
            '3',
            'insects',
            'evening',
            'Optional: Offer appropriately sized insects 0-1 times per week. Not required for adults.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/crested-gecko-care/'
        )
    """)

    # Delete old generic care guideline
    op.execute("""
        DELETE FROM care_guidelines
        WHERE title = 'Crested Gecko Feeding Guidelines'
        AND species = 'Crested Gecko'
        AND age_category IS NULL
        AND is_default = true
    """)

    # Insert new age-specific care guidelines
    op.execute("""
        INSERT INTO care_guidelines (
            species, age_category, guideline_type, title, content,
            recommendations, source_name, source_url, is_default
        ) VALUES
        (
            'Crested Gecko',
            'juvenile',
            'feeding',
            'Juvenile Crested Gecko Feeding Guidelines (0-12 months)',
            'Juvenile crested geckos require daily feeding for proper growth:

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
- Not needed if feeding complete CGD diet
- If feeding insects regularly, use calcium without D3',
            '{"feeding_frequency": "CGD daily, insects 1-2x/week", "primary_diet": "Commercial CGD", "age_range": "0-12 months", "supplements": ["Not needed with complete CGD"]}',
            'ReptiFiles',
            'https://reptifiles.com/crested-gecko-care/',
            true
        ),
        (
            'Crested Gecko',
            'adult',
            'feeding',
            'Adult Crested Gecko Feeding Guidelines (12+ months)',
            'Adult crested geckos require less frequent feeding than juveniles:

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
- Not needed if feeding complete CGD diet
- If feeding insects regularly, use calcium without D3',
            '{"feeding_frequency": "CGD every 2-3 days, insects 0-1x/week (optional)", "primary_diet": "Commercial CGD", "age_range": "12+ months", "supplements": ["Not needed with complete CGD"]}',
            'ReptiFiles',
            'https://reptifiles.com/crested-gecko-care/',
            true
        )
    """)


def downgrade():
    # Delete age-specific templates
    op.execute("""
        DELETE FROM schedule_templates
        WHERE name IN (
            'ReptiFiles - Juvenile Crested Gecko Daily CGD',
            'ReptiFiles - Juvenile Crested Gecko Insects',
            'ReptiFiles - Adult Crested Gecko CGD',
            'ReptiFiles - Adult Crested Gecko Insects (Optional)'
        )
        AND is_default = true
    """)

    # Restore old generic templates
    op.execute("""
        INSERT INTO schedule_templates (
            name, description, species, age_category, schedule_type, schedule_rule,
            frequency_days, days_of_week, food_category, time_slot,
            notes, is_default, source_name, source_url
        ) VALUES
        (
            'ReptiFiles - Crested Gecko Daily CGD Feeding',
            'Daily crested gecko diet (powder food)',
            'Crested Gecko',
            NULL,
            'feeding',
            'every_x_days',
            1,
            NULL,
            'prepared',
            'evening',
            'Offer fresh CGD every evening. Remove uneaten food after 24 hours.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/crested-gecko-care/'
        ),
        (
            'ReptiFiles - Crested Gecko Weekly Live Insects',
            'Live insects once or twice per week as enrichment',
            'Crested Gecko',
            NULL,
            'feeding',
            'days_of_week',
            NULL,
            '3',
            'insects',
            'evening',
            'Optional treat feeding. 2-3 appropriately sized insects.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/crested-gecko-care/'
        )
    """)

    # Delete age-specific care guidelines
    op.execute("""
        DELETE FROM care_guidelines
        WHERE title IN (
            'Juvenile Crested Gecko Feeding Guidelines (0-12 months)',
            'Adult Crested Gecko Feeding Guidelines (12+ months)'
        )
        AND is_default = true
    """)

    # Restore old generic care guideline
    op.execute("""
        INSERT INTO care_guidelines (
            species, age_category, guideline_type, title, content,
            recommendations, source_name, source_url, is_default
        ) VALUES
        (
            'Crested Gecko',
            NULL,
            'feeding',
            'Crested Gecko Feeding Guidelines',
            'Crested geckos thrive on a diet of commercially prepared crested gecko diet (CGD):

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
- If feeding insects regularly, use calcium without D3',
            '{"feeding_frequency": "CGD daily, insects 1-2x/week", "primary_diet": "Commercial CGD", "insects_per_feeding": "2-3 (optional)", "supplements": ["Not needed with complete CGD"]}',
            'ReptiFiles',
            'https://reptifiles.com/crested-gecko-care/',
            true
        )
    """)
