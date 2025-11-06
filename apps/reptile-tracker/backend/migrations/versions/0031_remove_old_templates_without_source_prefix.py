"""Remove old templates without source prefix (ReptiFiles -)

Revision ID: 0031
Revises: 0030
Create Date: 2025-01-06
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0031'
down_revision = '0030'
branch_labels = None
depends_on = None


def upgrade():
    # Delete old Bearded Dragon templates without "ReptiFiles -" prefix
    # These are duplicates of the current templates which have proper source attribution
    op.execute("""
        DELETE FROM schedule_templates
        WHERE species = 'Bearded Dragon'
        AND is_default = true
        AND (
            name LIKE '%Bearded Dragon%'
            AND name NOT LIKE 'ReptiFiles -%'
            AND name NOT LIKE 'Reptile Magazine -%'
        )
    """)

    # Delete old Leopard Gecko templates without "ReptiFiles -" prefix
    op.execute("""
        DELETE FROM schedule_templates
        WHERE species = 'Leopard Gecko'
        AND is_default = true
        AND (
            name LIKE '%Leopard Gecko%'
            AND name NOT LIKE 'ReptiFiles -%'
            AND name NOT LIKE 'Reptile Magazine -%'
        )
    """)

    # Delete old Crested Gecko templates without "ReptiFiles -" prefix
    op.execute("""
        DELETE FROM schedule_templates
        WHERE species = 'Crested Gecko'
        AND is_default = true
        AND (
            name LIKE '%Crested Gecko%'
            AND name NOT LIKE 'ReptiFiles -%'
            AND name NOT LIKE 'Reptile Magazine -%'
        )
    """)

    # Delete old Ball Python templates without "ReptiFiles -" or "Reptile Magazine -" prefix
    op.execute("""
        DELETE FROM schedule_templates
        WHERE species = 'Ball Python'
        AND is_default = true
        AND (
            name LIKE '%Ball Python%'
            AND name NOT LIKE 'ReptiFiles -%'
            AND name NOT LIKE 'Reptile Magazine -%'
        )
    """)


def downgrade():
    # No downgrade path - the old templates without source prefixes were duplicates
    # and should not be restored
    pass
