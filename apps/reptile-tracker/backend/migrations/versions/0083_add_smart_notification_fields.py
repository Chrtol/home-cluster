"""add smart notification fields for Phase 22

Revision ID: 0083
Revises: 0082
Create Date: 2026-02-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '0083'
down_revision = '0082'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table."""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [c['name'] for c in inspector.get_columns(table_name)]
    return column_name in columns


def table_exists(table_name):
    """Check if a table exists."""
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade():
    # Add smart notification fields to schedules table (idempotent)
    if not column_exists('schedules', 'follow_up_enabled'):
        op.add_column(
            'schedules',
            sa.Column('follow_up_enabled', sa.Boolean(), nullable=False, server_default='false')
        )
    if not column_exists('schedules', 'follow_up_delay_minutes'):
        op.add_column(
            'schedules',
            sa.Column('follow_up_delay_minutes', sa.Integer(), nullable=True)
        )
    if not column_exists('schedules', 'expiry_alert_enabled'):
        op.add_column(
            'schedules',
            sa.Column('expiry_alert_enabled', sa.Boolean(), nullable=False, server_default='false')
        )
    if not column_exists('schedules', 'expiry_alert_offset_minutes'):
        op.add_column(
            'schedules',
            sa.Column('expiry_alert_offset_minutes', sa.Integer(), nullable=True)
        )

    # Add frequency cap fields to notification_settings table (idempotent)
    if not column_exists('notification_settings', 'frequency_cap_enabled'):
        op.add_column(
            'notification_settings',
            sa.Column('frequency_cap_enabled', sa.Boolean(), nullable=False, server_default='true')
        )
    if not column_exists('notification_settings', 'frequency_cap_per_reptile'):
        op.add_column(
            'notification_settings',
            sa.Column('frequency_cap_per_reptile', sa.Integer(), nullable=False, server_default='5')
        )
    if not column_exists('notification_settings', 'frequency_cap_mode'):
        op.add_column(
            'notification_settings',
            sa.Column('frequency_cap_mode', sa.String(20), nullable=False, server_default='silent')
        )

    # Create notification_frequency_tracking table (idempotent)
    if not table_exists('notification_frequency_tracking'):
        op.create_table(
            'notification_frequency_tracking',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('reptile_id', sa.Integer(), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('notification_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('last_notification_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
            sa.ForeignKeyConstraint(['reptile_id'], ['reptiles.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_notification_frequency_tracking_id', 'notification_frequency_tracking', ['id'], unique=False)
        op.create_index('ix_notification_frequency_tracking_user_id', 'notification_frequency_tracking', ['user_id'], unique=False)
        op.create_index('ix_notification_frequency_tracking_reptile_id', 'notification_frequency_tracking', ['reptile_id'], unique=False)
        op.create_index('ix_notification_frequency_tracking_date', 'notification_frequency_tracking', ['date'], unique=False)
        op.create_index('ix_freq_tracking_lookup', 'notification_frequency_tracking', ['user_id', 'reptile_id', 'date'], unique=False)


def downgrade():
    # Drop notification_frequency_tracking table and indexes
    op.drop_index('ix_freq_tracking_lookup', table_name='notification_frequency_tracking')
    op.drop_index('ix_notification_frequency_tracking_date', table_name='notification_frequency_tracking')
    op.drop_index('ix_notification_frequency_tracking_reptile_id', table_name='notification_frequency_tracking')
    op.drop_index('ix_notification_frequency_tracking_user_id', table_name='notification_frequency_tracking')
    op.drop_index('ix_notification_frequency_tracking_id', table_name='notification_frequency_tracking')
    op.drop_table('notification_frequency_tracking')

    # Drop frequency cap fields from notification_settings
    op.drop_column('notification_settings', 'frequency_cap_mode')
    op.drop_column('notification_settings', 'frequency_cap_per_reptile')
    op.drop_column('notification_settings', 'frequency_cap_enabled')

    # Drop smart notification fields from schedules
    op.drop_column('schedules', 'expiry_alert_offset_minutes')
    op.drop_column('schedules', 'expiry_alert_enabled')
    op.drop_column('schedules', 'follow_up_delay_minutes')
    op.drop_column('schedules', 'follow_up_enabled')
