"""Add generalized change alert system

Revision ID: 0105
Revises: 0104
Create Date: 2026-02-19

Adds:
- change_alert_configs table for per-reptile alert configuration
- change_alert_tracking table for cooldown tracking
- NotificationSettings fields for feeding and measurement alerts
- Migrates existing WeightAlertTracking data to new system

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0105'
down_revision = '0104'
branch_labels = None
depends_on = None


def table_exists(table_name):
    """Check if a table exists"""
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = :table"
    ), {"table": table_name})
    return result.fetchone() is not None


def column_exists(table, column):
    """Check if a column exists in a table"""
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :table AND column_name = :column"
    ), {"table": table, "column": column})
    return result.fetchone() is not None


def upgrade():
    # Create change_alert_configs table
    if not table_exists('change_alert_configs'):
        op.create_table('change_alert_configs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('reptile_id', sa.Integer(), nullable=False),
            sa.Column('alert_type', sa.String(length=50), nullable=False),
            sa.Column('enabled', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('cooldown_days', sa.Integer(), nullable=True),
            sa.Column('threshold_type', sa.String(length=20), nullable=False, server_default='percentage'),
            sa.Column('threshold_increase', sa.Float(), nullable=True),
            sa.Column('threshold_decrease', sa.Float(), nullable=True),
            sa.Column('window_days', sa.Integer(), nullable=True),
            sa.Column('rolling_average_window', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['reptile_id'], ['reptiles.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('reptile_id', 'alert_type', name='uq_reptile_change_alert_type')
        )
        op.create_index('ix_change_alert_config_lookup', 'change_alert_configs', ['reptile_id', 'alert_type'])
        op.create_index(op.f('ix_change_alert_configs_id'), 'change_alert_configs', ['id'])
        op.create_index(op.f('ix_change_alert_configs_reptile_id'), 'change_alert_configs', ['reptile_id'])

    # Create change_alert_tracking table
    if not table_exists('change_alert_tracking'):
        op.create_table('change_alert_tracking',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('reptile_id', sa.Integer(), nullable=False),
            sa.Column('alert_type', sa.String(length=50), nullable=False),
            sa.Column('last_alert_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('last_alert_context', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['reptile_id'], ['reptiles.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('reptile_id', 'alert_type', name='uq_reptile_alert_tracking_type')
        )
        op.create_index('ix_change_alert_tracking_lookup', 'change_alert_tracking', ['reptile_id', 'alert_type'])
        op.create_index(op.f('ix_change_alert_tracking_id'), 'change_alert_tracking', ['id'])
        op.create_index(op.f('ix_change_alert_tracking_reptile_id'), 'change_alert_tracking', ['reptile_id'])

    # Add NotificationSettings columns for feeding alerts
    if not column_exists('notification_settings', 'feeding_alert_enabled'):
        op.add_column('notification_settings',
            sa.Column('feeding_alert_enabled', sa.Boolean(), nullable=False, server_default='false'))
    if not column_exists('notification_settings', 'feeding_alert_window_days'):
        op.add_column('notification_settings',
            sa.Column('feeding_alert_window_days', sa.Integer(), nullable=False, server_default='14'))
    if not column_exists('notification_settings', 'feeding_alert_threshold_percent'):
        op.add_column('notification_settings',
            sa.Column('feeding_alert_threshold_percent', sa.Integer(), nullable=False, server_default='30'))
    if not column_exists('notification_settings', 'feeding_alert_cooldown_days'):
        op.add_column('notification_settings',
            sa.Column('feeding_alert_cooldown_days', sa.Integer(), nullable=False, server_default='7'))

    # Add NotificationSettings columns for measurement alerts
    if not column_exists('notification_settings', 'measurement_alert_enabled'):
        op.add_column('notification_settings',
            sa.Column('measurement_alert_enabled', sa.Boolean(), nullable=False, server_default='false'))
    if not column_exists('notification_settings', 'measurement_alert_rolling_window'):
        op.add_column('notification_settings',
            sa.Column('measurement_alert_rolling_window', sa.Integer(), nullable=False, server_default='3'))
    if not column_exists('notification_settings', 'measurement_alert_threshold_percent'):
        op.add_column('notification_settings',
            sa.Column('measurement_alert_threshold_percent', sa.Integer(), nullable=False, server_default='10'))
    if not column_exists('notification_settings', 'measurement_alert_cooldown_days'):
        op.add_column('notification_settings',
            sa.Column('measurement_alert_cooldown_days', sa.Integer(), nullable=False, server_default='14'))
    if not column_exists('notification_settings', 'measurement_alert_types'):
        op.add_column('notification_settings',
            sa.Column('measurement_alert_types', postgresql.JSON(astext_type=sa.Text()), nullable=True))

    # Migrate existing WeightAlertTracking data to ChangeAlertTracking
    # Only migrate if weight_alert_tracking table exists and has data
    if table_exists('weight_alert_tracking'):
        op.execute("""
            INSERT INTO change_alert_tracking (reptile_id, alert_type, last_alert_at, last_alert_context, created_at, updated_at)
            SELECT
                reptile_id,
                'weight' as alert_type,
                last_alert_at,
                json_build_object('weight_log_id', last_alert_weight_log_id) as last_alert_context,
                created_at,
                updated_at
            FROM weight_alert_tracking
            ON CONFLICT (reptile_id, alert_type) DO NOTHING
        """)

    # Migrate per-reptile weight alert settings to ChangeAlertConfig
    # Only create configs for reptiles that have non-default settings
    op.execute("""
        INSERT INTO change_alert_configs (reptile_id, alert_type, enabled, cooldown_days, threshold_type, threshold_increase, threshold_decrease, created_at, updated_at)
        SELECT
            id as reptile_id,
            'weight' as alert_type,
            weight_alerts_enabled as enabled,
            weight_alert_cooldown_days as cooldown_days,
            'percentage' as threshold_type,
            weight_alert_gain_threshold_percent as threshold_increase,
            weight_alert_loss_threshold_percent as threshold_decrease,
            NOW() as created_at,
            NOW() as updated_at
        FROM reptiles
        WHERE weight_alerts_enabled = true
           OR weight_alert_gain_threshold_percent IS NOT NULL
           OR weight_alert_loss_threshold_percent IS NOT NULL
           OR weight_alert_cooldown_days IS NOT NULL
        ON CONFLICT (reptile_id, alert_type) DO NOTHING
    """)


def downgrade():
    # Remove NotificationSettings columns
    if column_exists('notification_settings', 'measurement_alert_types'):
        op.drop_column('notification_settings', 'measurement_alert_types')
    if column_exists('notification_settings', 'measurement_alert_cooldown_days'):
        op.drop_column('notification_settings', 'measurement_alert_cooldown_days')
    if column_exists('notification_settings', 'measurement_alert_threshold_percent'):
        op.drop_column('notification_settings', 'measurement_alert_threshold_percent')
    if column_exists('notification_settings', 'measurement_alert_rolling_window'):
        op.drop_column('notification_settings', 'measurement_alert_rolling_window')
    if column_exists('notification_settings', 'measurement_alert_enabled'):
        op.drop_column('notification_settings', 'measurement_alert_enabled')
    if column_exists('notification_settings', 'feeding_alert_cooldown_days'):
        op.drop_column('notification_settings', 'feeding_alert_cooldown_days')
    if column_exists('notification_settings', 'feeding_alert_threshold_percent'):
        op.drop_column('notification_settings', 'feeding_alert_threshold_percent')
    if column_exists('notification_settings', 'feeding_alert_window_days'):
        op.drop_column('notification_settings', 'feeding_alert_window_days')
    if column_exists('notification_settings', 'feeding_alert_enabled'):
        op.drop_column('notification_settings', 'feeding_alert_enabled')

    # Drop change_alert_tracking table
    if table_exists('change_alert_tracking'):
        op.drop_index('ix_change_alert_tracking_reptile_id', table_name='change_alert_tracking')
        op.drop_index('ix_change_alert_tracking_id', table_name='change_alert_tracking')
        op.drop_index('ix_change_alert_tracking_lookup', table_name='change_alert_tracking')
        op.drop_table('change_alert_tracking')

    # Drop change_alert_configs table
    if table_exists('change_alert_configs'):
        op.drop_index('ix_change_alert_configs_reptile_id', table_name='change_alert_configs')
        op.drop_index('ix_change_alert_configs_id', table_name='change_alert_configs')
        op.drop_index('ix_change_alert_config_lookup', table_name='change_alert_configs')
        op.drop_table('change_alert_configs')
