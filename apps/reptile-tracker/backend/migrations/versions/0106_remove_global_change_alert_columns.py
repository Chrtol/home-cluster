"""Remove global change alert columns from notification_settings

Revision ID: 0106
Revises: 0105
Create Date: 2026-02-20 12:33:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0106'
down_revision = '0105'
branch_labels = None
depends_on = None


def upgrade():
    # Remove change alert columns from notification_settings
    op.drop_column('notification_settings', 'feeding_alert_enabled')
    op.drop_column('notification_settings', 'feeding_alert_window_days')
    op.drop_column('notification_settings', 'feeding_alert_threshold_percent')
    op.drop_column('notification_settings', 'feeding_alert_cooldown_days')
    op.drop_column('notification_settings', 'measurement_alert_enabled')
    op.drop_column('notification_settings', 'measurement_alert_rolling_window')
    op.drop_column('notification_settings', 'measurement_alert_threshold_percent')
    op.drop_column('notification_settings', 'measurement_alert_cooldown_days')
    op.drop_column('notification_settings', 'measurement_alert_types')


def downgrade():
    # Re-add columns if needed (with defaults)
    op.add_column('notification_settings', sa.Column('feeding_alert_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('notification_settings', sa.Column('feeding_alert_window_days', sa.Integer(), nullable=False, server_default='14'))
    op.add_column('notification_settings', sa.Column('feeding_alert_threshold_percent', sa.Integer(), nullable=False, server_default='30'))
    op.add_column('notification_settings', sa.Column('feeding_alert_cooldown_days', sa.Integer(), nullable=False, server_default='7'))
    op.add_column('notification_settings', sa.Column('measurement_alert_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('notification_settings', sa.Column('measurement_alert_rolling_window', sa.Integer(), nullable=False, server_default='3'))
    op.add_column('notification_settings', sa.Column('measurement_alert_threshold_percent', sa.Integer(), nullable=False, server_default='10'))
    op.add_column('notification_settings', sa.Column('measurement_alert_cooldown_days', sa.Integer(), nullable=False, server_default='14'))
    op.add_column('notification_settings', sa.Column('measurement_alert_types', postgresql.JSON(), nullable=True))
