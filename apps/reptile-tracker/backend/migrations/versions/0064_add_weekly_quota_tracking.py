"""add quota tracking for requirement schedules (weekly and monthly)

Revision ID: 0064
Revises: 0063
Create Date: 2025-12-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0064'
down_revision: Union[str, None] = '0063'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create quota_tracking table for tracking requirement-based schedule progress (weekly and monthly)
    op.create_table(
        'quota_tracking',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('schedule_id', sa.Integer(), nullable=False),
        sa.Column('reptile_id', sa.Integer(), nullable=False),
        sa.Column('period_start_date', sa.Date(), nullable=False, comment='Start of the period (Monday for week, 1st for month)'),
        sa.Column('period_type', sa.String(10), nullable=False, comment='week or month'),
        sa.Column('count', sa.Integer(), nullable=False, server_default='0', comment='Number of completions this period'),
        sa.Column('last_completion_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['schedule_id'], ['schedules.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reptile_id'], ['reptiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for efficient querying
    op.create_index('ix_quota_tracking_schedule_id', 'quota_tracking', ['schedule_id'])
    op.create_index('ix_quota_tracking_reptile_id', 'quota_tracking', ['reptile_id'])
    op.create_index('ix_quota_tracking_period_start_date', 'quota_tracking', ['period_start_date'])

    # Create unique constraint to prevent duplicate entries for same schedule+period
    op.create_index(
        'ix_quota_tracking_schedule_period_unique',
        'quota_tracking',
        ['schedule_id', 'period_start_date'],
        unique=True
    )


def downgrade() -> None:
    # Drop indexes first
    op.drop_index('ix_quota_tracking_schedule_period_unique', table_name='quota_tracking')
    op.drop_index('ix_quota_tracking_period_start_date', table_name='quota_tracking')
    op.drop_index('ix_quota_tracking_reptile_id', table_name='quota_tracking')
    op.drop_index('ix_quota_tracking_schedule_id', table_name='quota_tracking')

    # Drop table
    op.drop_table('quota_tracking')
