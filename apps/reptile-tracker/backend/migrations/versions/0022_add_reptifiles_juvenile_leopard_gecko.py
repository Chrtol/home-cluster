"""add reptifiles juvenile leopard gecko

Revision ID: 0022
Revises: 0021
Create Date: 2025-01-26

"""
from alembic import op
import sqlalchemy as sa
from datetime import time


# revision identifiers, used by Alembic.
revision = '0022'
down_revision = '0021'
branch_labels = None
depends_on = None


def upgrade():
    # Add ReptiFiles juvenile leopard gecko template if it doesn't exist
    op.execute("""
        INSERT INTO schedule_templates (
            name,
            description,
            species,
            age_category,
            schedule_type,
            schedule_rule,
            frequency_days,
            food_category,
            time_slot,
            earliest_time,
            latest_time,
            time_window_enabled,
            notes,
            is_default,
            created_at,
            updated_at
        )
        SELECT
            'ReptiFiles - Juvenile Leopard Gecko Daily Feeding',
            'Daily insects for growing juvenile leopard geckos (0-12 months)',
            'Leopard Gecko',
            'juvenile',
            'feeding',
            'every_x_days',
            1,
            'insects',
            'evening',
            '18:00:00'::time,
            '21:00:00'::time,
            true,
            'Feed in evening as leopard geckos are nocturnal. Offer 5-8 appropriately sized insects daily.',
            true,
            NOW(),
            NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM schedule_templates
            WHERE name = 'ReptiFiles - Juvenile Leopard Gecko Daily Feeding'
            AND species = 'Leopard Gecko'
            AND age_category = 'juvenile'
        );
    """)


def downgrade():
    # Remove the ReptiFiles juvenile leopard gecko template
    op.execute("""
        DELETE FROM schedule_templates
        WHERE name = 'ReptiFiles - Juvenile Leopard Gecko Daily Feeding'
        AND species = 'Leopard Gecko'
        AND age_category = 'juvenile'
        AND is_default = true;
    """)
