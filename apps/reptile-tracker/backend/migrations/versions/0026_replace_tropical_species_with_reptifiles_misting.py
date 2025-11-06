"""Replace Tropical Species misting templates with ReptiFiles templates

Revision ID: 0026
Revises: 0025
Create Date: 2025-01-05
"""
from alembic import op
import sqlalchemy as sa
from datetime import time

# revision identifiers, used by Alembic.
revision = '0026'
down_revision = '0025'
branch_labels = None
depends_on = None


def upgrade():
    # Delete old Tropical Species misting templates
    op.execute("""
        DELETE FROM schedule_templates
        WHERE name IN ('Tropical Species - Twice Daily Misting', 'Tropical Species - Evening Misting')
        AND is_default = true
    """)

    # Insert new ReptiFiles misting templates
    op.execute("""
        INSERT INTO schedule_templates (
            name, description, species, age_category, schedule_type, schedule_rule,
            frequency_days, time_slot, earliest_time, latest_time, time_window_enabled,
            notes, is_default, source_name, source_url
        ) VALUES
        (
            'ReptiFiles - Evening Misting',
            'Evening misting for crested geckos',
            'Crested Gecko',
            NULL,
            'misting',
            'every_x_days',
            1,
            'evening',
            '18:00:00',
            '21:00:00',
            true,
            'Mist at least once in the evening. Your gecko will drink the droplets off the terrarium walls and decorations.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/crested-gecko-care/'
        ),
        (
            'ReptiFiles - Morning Misting (Optional)',
            'Morning misting for crested geckos if needed',
            'Crested Gecko',
            NULL,
            'misting',
            'every_x_days',
            1,
            'morning',
            '07:00:00',
            '10:00:00',
            true,
            'Mist again in the morning if needed, depending on how well your terrarium holds humidity.',
            true,
            'ReptiFiles',
            'https://reptifiles.com/crested-gecko-care/'
        )
    """)


def downgrade():
    # Delete ReptiFiles templates
    op.execute("""
        DELETE FROM schedule_templates
        WHERE name IN ('ReptiFiles - Evening Misting', 'ReptiFiles - Morning Misting (Optional)')
        AND is_default = true
    """)

    # Restore old Tropical Species templates
    op.execute("""
        INSERT INTO schedule_templates (
            name, description, species, age_category, schedule_type, schedule_rule,
            frequency_days, time_slot, earliest_time, latest_time, time_window_enabled,
            notes, is_default
        ) VALUES
        (
            'Tropical Species - Twice Daily Misting',
            'Morning and evening misting for tropical species',
            'Crested Gecko',
            NULL,
            'misting',
            'every_x_days',
            1,
            'morning',
            '08:00:00',
            '10:00:00',
            true,
            'Mist enclosure to maintain 60-80% humidity. Allow to dry between mistings.',
            true
        ),
        (
            'Tropical Species - Evening Misting',
            'Evening misting for tropical species',
            'Crested Gecko',
            NULL,
            'misting',
            'every_x_days',
            1,
            'evening',
            '18:00:00',
            '20:00:00',
            true,
            'Evening mist to maintain overnight humidity.',
            true
        )
    """)
