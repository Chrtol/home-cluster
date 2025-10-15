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
    # Get connection to execute outside transaction for enum alterations
    connection = op.get_bind()

    # Add new enum values - these must be committed before use
    # We need to use execute_outside_transaction for this
    # PostgreSQL enum values are uppercase in this schema
    connection.execute(sa.text("COMMIT"))
    connection.execute(sa.text("ALTER TYPE accesslevel ADD VALUE IF NOT EXISTS 'ADMIN'"))
    connection.execute(sa.text("ALTER TYPE accesslevel ADD VALUE IF NOT EXISTS 'CARETAKER'"))
    connection.execute(sa.text("BEGIN"))

    # Now update existing 'feeder'/'FEEDER' values to 'caretaker'/'CARETAKER' in household_members table
    # Use text casting to bypass enum validation
    # PostgreSQL enums are case-sensitive, check both cases
    op.execute("""
        UPDATE household_members
        SET access_level = 'CARETAKER'::accesslevel
        WHERE access_level::text IN ('feeder', 'FEEDER')
    """)

    # Update existing 'feeder'/'FEEDER' values to 'caretaker'/'CARETAKER' in reptile_access table
    op.execute("""
        UPDATE reptile_access
        SET access_level = 'CARETAKER'::accesslevel
        WHERE access_level::text IN ('feeder', 'FEEDER')
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
