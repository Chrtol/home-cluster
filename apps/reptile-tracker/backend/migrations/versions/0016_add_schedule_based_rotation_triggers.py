"""Add schedule-based rotation triggers

Revision ID: 0016
Revises: 0015
Create Date: 2025-01-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0016'
down_revision = '0015'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Check if feeding_rotations table exists
    existing_tables = inspector.get_table_names()
    if 'feeding_rotations' in existing_tables:
        existing_columns = [col['name'] for col in inspector.get_columns('feeding_rotations')]

        # Add trigger_mode column
        if 'trigger_mode' not in existing_columns:
            op.add_column('feeding_rotations',
                sa.Column('trigger_mode', sa.String(), nullable=False, server_default='feeding_count'))

        # Make every_n_feedings nullable (it's not required for schedule_based mode)
        if 'every_n_feedings' in existing_columns:
            op.alter_column('feeding_rotations', 'every_n_feedings',
                existing_type=sa.Integer(), nullable=True)

        # Make counting_mode nullable (only for feeding_count mode)
        if 'counting_mode' in existing_columns:
            op.alter_column('feeding_rotations', 'counting_mode',
                existing_type=sa.String(), nullable=True)

        # Add schedule-based columns
        if 'schedule_days_of_week' not in existing_columns:
            op.add_column('feeding_rotations',
                sa.Column('schedule_days_of_week', sa.String(), nullable=True))

        if 'schedule_frequency_days' not in existing_columns:
            op.add_column('feeding_rotations',
                sa.Column('schedule_frequency_days', sa.Integer(), nullable=True))


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'feeding_rotations' in existing_tables:
        existing_columns = [col['name'] for col in inspector.get_columns('feeding_rotations')]

        # Remove new columns
        if 'trigger_mode' in existing_columns:
            op.drop_column('feeding_rotations', 'trigger_mode')

        if 'schedule_days_of_week' in existing_columns:
            op.drop_column('feeding_rotations', 'schedule_days_of_week')

        if 'schedule_frequency_days' in existing_columns:
            op.drop_column('feeding_rotations', 'schedule_frequency_days')

        # Restore every_n_feedings as not nullable
        if 'every_n_feedings' in existing_columns:
            op.alter_column('feeding_rotations', 'every_n_feedings',
                existing_type=sa.Integer(), nullable=False)

        # Restore counting_mode as not nullable
        if 'counting_mode' in existing_columns:
            op.alter_column('feeding_rotations', 'counting_mode',
                existing_type=sa.String(), nullable=False)
