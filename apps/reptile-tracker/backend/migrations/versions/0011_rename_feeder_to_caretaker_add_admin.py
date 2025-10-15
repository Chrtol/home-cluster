"""Rename feeder to caretaker and add admin role

Revision ID: 0011
Revises: 0010
Create Date: 2025-01-15

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade():
    # First, add new enum values to the accesslevel type
    op.execute("ALTER TYPE accesslevel ADD VALUE IF NOT EXISTS 'admin'")
    op.execute("ALTER TYPE accesslevel ADD VALUE IF NOT EXISTS 'caretaker'")

    # Now update existing 'feeder' values to 'caretaker' in household_members table
    # Use text casting to bypass enum validation
    op.execute("""
        UPDATE household_members
        SET access_level = 'caretaker'::accesslevel
        WHERE access_level::text = 'feeder'
    """)

    # Update existing 'feeder' values to 'caretaker' in reptile_access table
    op.execute("""
        UPDATE reptile_access
        SET access_level = 'caretaker'::accesslevel
        WHERE access_level::text = 'feeder'
    """)

    # Note: We cannot remove 'feeder' from the enum without recreating it,
    # but it won't be used anymore


def downgrade():
    # Revert 'caretaker' back to 'feeder'
    op.execute("""
        UPDATE household_members
        SET access_level = 'feeder'
        WHERE access_level = 'caretaker'
    """)

    op.execute("""
        UPDATE reptile_access
        SET access_level = 'feeder'
        WHERE access_level = 'caretaker'
    """)

    # Note: Admin roles will need to be manually handled if downgrading
