"""Remove remaining old templates that weren't caught by previous migrations

Revision ID: 0034
Revises: 0033
Create Date: 2025-01-07
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0034'
down_revision = '0033'
branch_labels = None
depends_on = None


def upgrade():
    # Delete specific old templates that weren't caught by migration 0031
    # These are templates without the ReptiFiles prefix or with outdated naming
    op.execute("""
        DELETE FROM schedule_templates
        WHERE is_default = true
        AND name IN (
            -- Old templates without any source prefix
            'Juvenile Bearded Dragon Daily Feeding',
            'Juvenile Bearded Dragon Daily Insects',
            'Juvenile Bearded Dragon Daily Salad',
            'Juvenile Bearded Dragon Daily Vegetables',
            'Adult Bearded Dragon Insects',
            'Adult Bearded Dragon Daily Salad',
            'Adult Bearded Dragon Daily Vegetables',
            'Hatchling Bearded Dragon Daily Feeding',
            'Hatchling Bearded Dragon Daily Insects',
            'Hatchling Bearded Dragon Daily Salad',
            'Hatchling Bearded Dragon Daily Vegetables',

            -- Old templates with ReptiFiles prefix but outdated names
            'ReptiFiles - Juvenile Bearded Dragon Daily Feeding',
            'ReptiFiles - Juvenile Bearded Dragon Daily Salad',
            'ReptiFiles - Adult Bearded Dragon Daily Salad',
            'ReptiFiles - Hatchling Bearded Dragon Daily Salad',
            'ReptiFiles - Adult Leopard Gecko Calcium (With UVB)',
            'ReptiFiles - Juvenile Leopard Gecko Calcium (With UVB)',
            'ReptiFiles - Hatchling Leopard Gecko Calcium (With UVB)',
            'ReptiFiles - Crested Gecko Calcium (With UVB)',
            'ReptiFiles - Adult Bearded Dragon Calcium',
            'ReptiFiles - Juvenile Bearded Dragon Calcium',
            'ReptiFiles - Hatchling Bearded Dragon Calcium',
            'ReptiFiles - Gravid Female Bearded Dragon Calcium',

            -- Old Leopard Gecko templates with outdated naming
            'ReptiFiles - Adult Leopard Gecko Every Other Day Feeding',
            'Adult Leopard Gecko Every Other Day Feeding',
            'Adult Leopard Gecko Feeding',
            'Juvenile Leopard Gecko Feeding',
            'Hatchling Leopard Gecko Feeding'
        )
    """)


def downgrade():
    # No downgrade - these are duplicate/outdated templates
    pass
