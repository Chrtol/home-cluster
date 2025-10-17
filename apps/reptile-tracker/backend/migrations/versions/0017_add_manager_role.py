"""add manager role

Revision ID: 0017
Revises: 0016
Create Date: 2025-01-17

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '0017'
down_revision = '0016'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'manager' value to accesslevel enum
    # PostgreSQL requires explicit enum modification
    op.execute("ALTER TYPE accesslevel ADD VALUE IF NOT EXISTS 'manager'")


def downgrade() -> None:
    # Note: PostgreSQL does not support removing enum values
    # To downgrade, you would need to:
    # 1. Create a new enum without 'manager'
    # 2. Update all columns to use new enum
    # 3. Drop old enum
    # This is complex and rarely needed, so we'll leave it as a no-op
    pass
