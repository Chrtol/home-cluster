"""add consecutive_misses to reptile_streaks

Revision ID: 0081
Revises: 0080
Create Date: 2026-02-14

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0081'
down_revision = '0080'
branch_labels = None
depends_on = None


def upgrade():
    # Add consecutive_misses column to reptile_streaks table
    # Defaults to 0 for all existing streaks
    op.add_column(
        'reptile_streaks',
        sa.Column('consecutive_misses', sa.Integer(), nullable=False, server_default='0')
    )


def downgrade():
    # Remove consecutive_misses column
    op.drop_column('reptile_streaks', 'consecutive_misses')
