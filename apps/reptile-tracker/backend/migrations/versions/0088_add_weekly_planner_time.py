"""Add weekly_planner_time to notification_settings

Revision ID: 0088
Revises: 0087
Create Date: 2026-02-15

Adds weekly_planner_time column so weekly planner can have
an independent delivery time from daily planner.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '0088'
down_revision = '0087'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'notification_settings',
        sa.Column('weekly_planner_time', sa.Time(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('notification_settings', 'weekly_planner_time')
