"""add comprehensive food categories (worms, fish, eggs, live prey)

Revision ID: 0005
Revises: 0004
Create Date: 2025-10-14 00:00:00.000004
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade():
    # Add new categories to foodcategory enum
    op.execute("ALTER TYPE foodcategory ADD VALUE IF NOT EXISTS 'worms'")
    op.execute("ALTER TYPE foodcategory ADD VALUE IF NOT EXISTS 'live_rodent'")
    op.execute("ALTER TYPE foodcategory ADD VALUE IF NOT EXISTS 'fish_seafood'")
    op.execute("ALTER TYPE foodcategory ADD VALUE IF NOT EXISTS 'eggs'")


def downgrade():
    # Note: Cannot remove enum values from PostgreSQL enums
    # You would need to recreate the enum without these values
    # For safety, we're leaving them in place
    pass
