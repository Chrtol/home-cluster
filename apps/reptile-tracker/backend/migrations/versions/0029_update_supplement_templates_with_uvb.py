"""Update supplement templates with UVB-specific variants

Revision ID: 0029
Revises: 0028
Create Date: 2025-01-06
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0029'
down_revision = '0028'
branch_labels = None
depends_on = None


def upgrade():
    # Delete old generic supplement templates
    op.execute("""
        DELETE FROM schedule_templates
        WHERE name IN (
            'ReptiFiles - Calcium with D3 Twice Weekly',
            'ReptiFiles - Multivitamin Weekly'
        )
        AND is_default = true
    """)

    # Insert new UVB-specific supplement templates
    op.execute("""
        INSERT INTO schedule_templates (
            name, description, species, age_category, schedule_type, schedule_rule,
            frequency_days, days_of_week, uvb_lighting,
            notes, is_default, source_name, source_url
        ) VALUES
        -- With UVB lighting
        (
            'ReptiFiles - Calcium with D3 (With UVB)',
            'Calcium with D3 supplementation for reptiles with UVB lighting',
            NULL,
            NULL,
            'supplement',
            'days_of_week',
            NULL,
            '2,5',
            true,
            'For reptiles WITH UVB lighting. Dust insects before feeding 2-3x per week.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/'
        ),
        (
            'ReptiFiles - Calcium without D3 (With UVB)',
            'Daily calcium without D3 for reptiles with UVB lighting',
            NULL,
            NULL,
            'supplement',
            'every_x_days',
            1,
            NULL,
            true,
            'For reptiles WITH UVB lighting. Dust insects daily. The reptile synthesizes D3 from UVB exposure.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/'
        ),
        (
            'ReptiFiles - Multivitamin Weekly (With UVB)',
            'Weekly multivitamin supplementation for reptiles with UVB',
            NULL,
            NULL,
            'supplement',
            'days_of_week',
            NULL,
            '6',
            true,
            'For reptiles WITH UVB lighting. Use a quality reptile multivitamin. Dust insects lightly.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/'
        ),
        -- Without UVB lighting
        (
            'ReptiFiles - Calcium with D3 (No UVB)',
            'Calcium with D3 supplementation for reptiles without UVB lighting',
            NULL,
            NULL,
            'supplement',
            'every_x_days',
            1,
            NULL,
            false,
            'For reptiles WITHOUT UVB lighting. Dust insects at every feeding. D3 supplementation is critical without UVB.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/'
        ),
        (
            'ReptiFiles - Multivitamin Weekly (No UVB)',
            'Weekly multivitamin supplementation for reptiles without UVB',
            NULL,
            NULL,
            'supplement',
            'days_of_week',
            NULL,
            '6',
            false,
            'For reptiles WITHOUT UVB lighting. Use a quality reptile multivitamin. Dust insects lightly.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/'
        )
    """)


def downgrade():
    # Delete UVB-specific supplement templates
    op.execute("""
        DELETE FROM schedule_templates
        WHERE name IN (
            'ReptiFiles - Calcium with D3 (With UVB)',
            'ReptiFiles - Calcium without D3 (With UVB)',
            'ReptiFiles - Multivitamin Weekly (With UVB)',
            'ReptiFiles - Calcium with D3 (No UVB)',
            'ReptiFiles - Multivitamin Weekly (No UVB)'
        )
        AND is_default = true
    """)

    # Restore old generic templates
    op.execute("""
        INSERT INTO schedule_templates (
            name, description, species, age_category, schedule_type, schedule_rule,
            days_of_week, notes, is_default, source_name, source_url
        ) VALUES
        (
            'ReptiFiles - Calcium with D3 Twice Weekly',
            'Standard calcium with D3 supplementation schedule',
            NULL,
            NULL,
            'supplement',
            'days_of_week',
            '2,5',
            'For reptiles with UVB lighting. Dust insects before feeding.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/'
        ),
        (
            'ReptiFiles - Multivitamin Weekly',
            'Weekly multivitamin supplementation',
            NULL,
            NULL,
            'supplement',
            'days_of_week',
            '6',
            'Use a quality reptile multivitamin. Dust insects lightly.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/'
        )
    """)
