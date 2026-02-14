"""Add planner digest settings to notification_settings

Revision ID: 0085
Revises: 0084
Create Date: 2026-02-14

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '0085'
down_revision = '0084'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add planner digest columns
    op.add_column('notification_settings', sa.Column('daily_planner_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('notification_settings', sa.Column('daily_planner_time', sa.Time(), nullable=True))
    op.add_column('notification_settings', sa.Column('weekly_planner_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('notification_settings', sa.Column('weekly_planner_day', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('notification_settings', sa.Column('digest_format', sa.String(length=20), nullable=False, server_default='grouped'))


def downgrade() -> None:
    op.drop_column('notification_settings', 'digest_format')
    op.drop_column('notification_settings', 'weekly_planner_day')
    op.drop_column('notification_settings', 'weekly_planner_enabled')
    op.drop_column('notification_settings', 'daily_planner_time')
    op.drop_column('notification_settings', 'daily_planner_enabled')
