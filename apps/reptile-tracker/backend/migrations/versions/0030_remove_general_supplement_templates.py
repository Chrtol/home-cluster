"""Remove general supplement templates in favor of species-specific ones

Revision ID: 0030
Revises: 0029
Create Date: 2025-01-06
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0030'
down_revision = '0029'
branch_labels = None
depends_on = None


def upgrade():
    # Delete general supplement templates (species=NULL) that were created in migration 0029
    # These are being replaced by species-specific supplement templates
    op.execute("""
        DELETE FROM schedule_templates
        WHERE species IS NULL
        AND schedule_type = 'supplement'
        AND name IN (
            'ReptiFiles - Calcium with D3 (With UVB)',
            'ReptiFiles - Calcium without D3 (With UVB)',
            'ReptiFiles - Multivitamin Weekly (With UVB)',
            'ReptiFiles - Calcium with D3 (No UVB)',
            'ReptiFiles - Multivitamin Weekly (No UVB)'
        )
        AND is_default = true
    """)


def downgrade():
    # Restore general supplement templates from migration 0029
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
