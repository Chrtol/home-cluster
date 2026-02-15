"""Add weight alert cooldown settings to notification_settings (global)

Revision ID: 0094
Revises: 0093
Create Date: 2026-02-15

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0094'
down_revision = '0093'
branch_labels = None
depends_on = None


def upgrade():
    # Add cooldown toggle and days fields to notification_settings (global setting)
    op.add_column('notification_settings', sa.Column('weight_alert_cooldown_enabled', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('notification_settings', sa.Column('weight_alert_cooldown_days', sa.Integer(), nullable=False, server_default='7'))


def downgrade():
    op.drop_column('notification_settings', 'weight_alert_cooldown_days')
    op.drop_column('notification_settings', 'weight_alert_cooldown_enabled')
