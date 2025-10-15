"""Fix household creator roles to be admin

Revision ID: 0012
Revises: 0011
Create Date: 2025-01-15

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade():
    # Update the first member of each household (the creator) to be an admin
    # This assumes the first member is the creator
    op.execute("""
        WITH first_members AS (
            SELECT DISTINCT ON (household_id)
                household_id,
                user_id
            FROM household_members
            ORDER BY household_id, joined_at ASC
        )
        UPDATE household_members hm
        SET access_level = 'admin'::accesslevel
        FROM first_members fm
        WHERE hm.household_id = fm.household_id
        AND hm.user_id = fm.user_id
        AND hm.access_level::text = 'owner'
    """)


def downgrade():
    # Revert admins back to owners for first members
    op.execute("""
        WITH first_members AS (
            SELECT DISTINCT ON (household_id)
                household_id,
                user_id
            FROM household_members
            ORDER BY household_id, joined_at ASC
        )
        UPDATE household_members hm
        SET access_level = 'owner'::accesslevel
        FROM first_members fm
        WHERE hm.household_id = fm.household_id
        AND hm.user_id = fm.user_id
        AND hm.access_level::text = 'admin'
    """)
