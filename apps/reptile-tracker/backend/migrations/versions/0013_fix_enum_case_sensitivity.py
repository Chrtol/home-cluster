"""Fix enum case sensitivity by converting uppercase to lowercase values

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
    # Get connection to execute outside transaction for enum alterations
    connection = op.get_bind()

    # Add missing lowercase enum values for backwards compatibility
    connection.execute(sa.text("COMMIT"))
    connection.execute(sa.text("ALTER TYPE accesslevel ADD VALUE IF NOT EXISTS 'owner'"))
    connection.execute(sa.text("ALTER TYPE accesslevel ADD VALUE IF NOT EXISTS 'feeder'"))
    connection.execute(sa.text("ALTER TYPE accesslevel ADD VALUE IF NOT EXISTS 'viewer'"))
    connection.execute(sa.text("BEGIN"))

    # Convert uppercase FEEDER to lowercase caretaker (new role name)
    op.execute("""
        UPDATE household_members
        SET access_level = 'caretaker'::accesslevel
        WHERE access_level::text = 'FEEDER'
    """)

    op.execute("""
        UPDATE reptile_access
        SET access_level = 'caretaker'::accesslevel
        WHERE access_level::text = 'FEEDER'
    """)

    # Convert uppercase OWNER to lowercase owner
    op.execute("""
        UPDATE household_members
        SET access_level = 'owner'::accesslevel
        WHERE access_level::text = 'OWNER'
    """)

    op.execute("""
        UPDATE reptile_access
        SET access_level = 'owner'::accesslevel
        WHERE access_level::text = 'OWNER'
    """)

    # Convert uppercase VIEWER to lowercase viewer
    op.execute("""
        UPDATE household_members
        SET access_level = 'viewer'::accesslevel
        WHERE access_level::text = 'VIEWER'
    """)

    op.execute("""
        UPDATE reptile_access
        SET access_level = 'viewer'::accesslevel
        WHERE access_level::text = 'VIEWER'
    """)


def downgrade():
    # Revert to uppercase values
    op.execute("""
        UPDATE household_members
        SET access_level = 'OWNER'
        WHERE access_level::text = 'owner'
    """)

    op.execute("""
        UPDATE household_members
        SET access_level = 'FEEDER'
        WHERE access_level::text = 'caretaker'
    """)

    op.execute("""
        UPDATE household_members
        SET access_level = 'VIEWER'
        WHERE access_level::text = 'viewer'
    """)

    op.execute("""
        UPDATE reptile_access
        SET access_level = 'OWNER'
        WHERE access_level::text = 'owner'
    """)

    op.execute("""
        UPDATE reptile_access
        SET access_level = 'FEEDER'
        WHERE access_level::text = 'caretaker'
    """)

    op.execute("""
        UPDATE reptile_access
        SET access_level = 'VIEWER'
        WHERE access_level::text = 'viewer'
    """)
