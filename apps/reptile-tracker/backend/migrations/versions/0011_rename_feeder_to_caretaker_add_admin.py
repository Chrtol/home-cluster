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
    # Update existing 'feeder' values to 'caretaker' in household_members table
    op.execute("""
        UPDATE household_members
        SET access_level = 'caretaker'
        WHERE access_level = 'feeder'
    """)

    # Update existing 'feeder' values to 'caretaker' in reptile_access table
    op.execute("""
        UPDATE reptile_access
        SET access_level = 'caretaker'
        WHERE access_level = 'feeder'
    """)

    # Note: PostgreSQL enum types need to be updated separately
    # The new 'admin' and 'caretaker' values will be available once the app restarts with updated models


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
