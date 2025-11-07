"""Cleanup all templates without proper source prefix (ReptiFiles, The Bio Dude, etc.)

Revision ID: 0035
Revises: 0034
Create Date: 2025-01-07
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0035'
down_revision = '0034'
branch_labels = None
depends_on = None


def upgrade():
    # Delete ALL default templates that don't start with an approved source prefix
    # This is a one-time cleanup of legacy templates from before we standardized naming
    op.execute("""
        DELETE FROM schedule_templates
        WHERE is_default = true
        AND name NOT LIKE 'ReptiFiles - %'
        AND name NOT LIKE 'The Bio Dude - %'
        AND name NOT LIKE 'Reptile Magazine - %'
        AND name NOT LIKE 'Tropical Species - %'
        AND name NOT LIKE 'Juvenile - %'
        AND name NOT LIKE 'Adult - %'
    """)


def downgrade():
    # No downgrade - these are legacy templates that should be removed
    pass
