"""Fix remaining FEEDER values (case-sensitive)

Revision ID: 0013
Revises: 0012
Create Date: 2025-01-15

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade():
    # Update any remaining 'FEEDER' values (uppercase) to 'CARETAKER'
    # PostgreSQL enum values are case-sensitive and stored as uppercase
    op.execute("""
        UPDATE household_members
        SET access_level = 'CARETAKER'::accesslevel
        WHERE access_level::text = 'FEEDER'
    """)

    op.execute("""
        UPDATE reptile_access
        SET access_level = 'CARETAKER'::accesslevel
        WHERE access_level::text = 'FEEDER'
    """)


def downgrade():
    # Revert 'CARETAKER' back to 'FEEDER' (though FEEDER is deprecated)
    op.execute("""
        UPDATE household_members
        SET access_level = 'FEEDER'
        WHERE access_level = 'CARETAKER'
    """)

    op.execute("""
        UPDATE reptile_access
        SET access_level = 'FEEDER'
        WHERE access_level = 'CARETAKER'
    """)
