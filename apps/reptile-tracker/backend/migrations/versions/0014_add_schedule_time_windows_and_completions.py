"""Add schedule time windows and completion tracking

Revision ID: 0014
Revises: 0013
Create Date: 2025-01-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade():
    # NOTE: Enum types are created automatically by SQLAlchemy during table creation
    # No need to explicitly create them here - they will be created with checkfirst=True

    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Add time window fields to schedules table (if they don't exist)
    existing_columns = [col['name'] for col in inspector.get_columns('schedules')]
    if 'earliest_time' not in existing_columns:
        op.add_column('schedules', sa.Column('earliest_time', sa.Time(), nullable=True))
    if 'latest_time' not in existing_columns:
        op.add_column('schedules', sa.Column('latest_time', sa.Time(), nullable=True))
    if 'time_window_enabled' not in existing_columns:
        op.add_column('schedules', sa.Column('time_window_enabled', sa.Boolean(), nullable=False, server_default='false'))
    if 'reminder_minutes_before' not in existing_columns:
        op.add_column('schedules', sa.Column('reminder_minutes_before', sa.Integer(), nullable=True))

    # Create schedule_completions table (if it doesn't exist)
    existing_tables = inspector.get_table_names()
    if 'schedule_completions' not in existing_tables:
        op.create_table(
        'schedule_completions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('schedule_id', sa.Integer(), nullable=False),
        sa.Column('scheduled_date', sa.Date(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completion_type', sa.Enum('feeding', 'misting', 'weighing', 'manual', name='completiontype'), nullable=True),
        sa.Column('completion_id', sa.Integer(), nullable=True),
        sa.Column('within_time_window', sa.Boolean(), nullable=True),
        sa.Column('status', sa.Enum('completed_on_time', 'completed_early', 'completed_late', 'missed', 'pending', name='completionstatus'), nullable=False),
        sa.Column('reptile_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['schedule_id'], ['schedules.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reptile_id'], ['reptiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_schedule_completions_schedule_id', 'schedule_completions', ['schedule_id'])
        op.create_index('ix_schedule_completions_reptile_id', 'schedule_completions', ['reptile_id'])
        op.create_index('ix_schedule_completions_scheduled_date', 'schedule_completions', ['scheduled_date'])
        op.create_index('ix_schedule_completions_status', 'schedule_completions', ['status'])

    # Add schedule_completion_id to feedings table (if it doesn't exist)
    existing_feedings_columns = [col['name'] for col in inspector.get_columns('feedings')]
    if 'schedule_completion_id' not in existing_feedings_columns:
        op.add_column('feedings', sa.Column('schedule_completion_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            'fk_feedings_schedule_completion',
            'feedings', 'schedule_completions',
            ['schedule_completion_id'], ['id'],
            ondelete='SET NULL'
        )
        op.create_index('ix_feedings_schedule_completion_id', 'feedings', ['schedule_completion_id'])

    # Add schedule_completion_id to misting_logs table (if it doesn't exist)
    existing_misting_columns = [col['name'] for col in inspector.get_columns('misting_logs')]
    if 'schedule_completion_id' not in existing_misting_columns:
        op.add_column('misting_logs', sa.Column('schedule_completion_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            'fk_misting_logs_schedule_completion',
            'misting_logs', 'schedule_completions',
            ['schedule_completion_id'], ['id'],
            ondelete='SET NULL'
        )
        op.create_index('ix_misting_logs_schedule_completion_id', 'misting_logs', ['schedule_completion_id'])

    # Add schedule_completion_id to weight_logs table (if it doesn't exist)
    existing_weight_columns = [col['name'] for col in inspector.get_columns('weight_logs')]
    if 'schedule_completion_id' not in existing_weight_columns:
        op.add_column('weight_logs', sa.Column('schedule_completion_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            'fk_weight_logs_schedule_completion',
            'weight_logs', 'schedule_completions',
            ['schedule_completion_id'], ['id'],
            ondelete='SET NULL'
        )
        op.create_index('ix_weight_logs_schedule_completion_id', 'weight_logs', ['schedule_completion_id'])


def downgrade():
    # Drop indexes and foreign keys from weight_logs
    op.drop_index('ix_weight_logs_schedule_completion_id', table_name='weight_logs')
    op.drop_constraint('fk_weight_logs_schedule_completion', 'weight_logs', type_='foreignkey')
    op.drop_column('weight_logs', 'schedule_completion_id')

    # Drop indexes and foreign keys from misting_logs
    op.drop_index('ix_misting_logs_schedule_completion_id', table_name='misting_logs')
    op.drop_constraint('fk_misting_logs_schedule_completion', 'misting_logs', type_='foreignkey')
    op.drop_column('misting_logs', 'schedule_completion_id')

    # Drop indexes and foreign keys from feedings
    op.drop_index('ix_feedings_schedule_completion_id', table_name='feedings')
    op.drop_constraint('fk_feedings_schedule_completion', 'feedings', type_='foreignkey')
    op.drop_column('feedings', 'schedule_completion_id')

    # Drop schedule_completions table
    op.drop_index('ix_schedule_completions_status', table_name='schedule_completions')
    op.drop_index('ix_schedule_completions_scheduled_date', table_name='schedule_completions')
    op.drop_index('ix_schedule_completions_reptile_id', table_name='schedule_completions')
    op.drop_index('ix_schedule_completions_schedule_id', table_name='schedule_completions')
    op.drop_table('schedule_completions')

    # Drop columns from schedules table
    op.drop_column('schedules', 'reminder_minutes_before')
    op.drop_column('schedules', 'time_window_enabled')
    op.drop_column('schedules', 'latest_time')
    op.drop_column('schedules', 'earliest_time')

    # Drop enums
    sa.Enum(name='completiontype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='completionstatus').drop(op.get_bind(), checkfirst=True)
