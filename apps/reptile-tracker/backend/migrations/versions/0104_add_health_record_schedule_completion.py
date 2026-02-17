"""Add schedule_completion_id to health_records

Allows health records (bathing, shedding_check, etc.) to complete
health schedules, similar to how feedings, mistings, and weights
complete their respective schedules.

Revision ID: 0104
Revises: 0103
Create Date: 2026-02-17
"""
from alembic import op
import sqlalchemy as sa

revision = '0104'
down_revision = '0103'
branch_labels = None
depends_on = None


def upgrade():
    # Add schedule_completion_id to health_records table
    op.add_column('health_records',
        sa.Column('schedule_completion_id', sa.Integer(), nullable=True))

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_health_records_schedule_completion',
        'health_records', 'schedule_completions',
        ['schedule_completion_id'], ['id'],
        ondelete='SET NULL'
    )

    # Add index for faster lookups
    op.create_index(
        'ix_health_records_schedule_completion_id',
        'health_records', ['schedule_completion_id']
    )


def downgrade():
    op.drop_index('ix_health_records_schedule_completion_id', 'health_records')
    op.drop_constraint('fk_health_records_schedule_completion', 'health_records', type_='foreignkey')
    op.drop_column('health_records', 'schedule_completion_id')
