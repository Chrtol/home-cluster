"""add weekly quota tracking for requirement schedules

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
    # Create weekly_quotas table for tracking requirement-based schedule progress
    op.create_table(
        'weekly_quotas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('schedule_id', sa.Integer(), nullable=False),
        sa.Column('reptile_id', sa.Integer(), nullable=False),
        sa.Column('week_start_date', sa.Date(), nullable=False, comment='Monday of the week'),
        sa.Column('feedings_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_feeding_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['schedule_id'], ['schedules.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reptile_id'], ['reptiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for efficient querying
    op.create_index('ix_weekly_quotas_schedule_id', 'weekly_quotas', ['schedule_id'])
    op.create_index('ix_weekly_quotas_reptile_id', 'weekly_quotas', ['reptile_id'])
    op.create_index('ix_weekly_quotas_week_start_date', 'weekly_quotas', ['week_start_date'])

    # Create unique constraint to prevent duplicate entries for same schedule+week
    op.create_index(
        'ix_weekly_quotas_schedule_week_unique',
        'weekly_quotas',
        ['schedule_id', 'week_start_date'],
        unique=True
    )


def downgrade() -> None:
    # Drop indexes first
    op.drop_index('ix_weekly_quotas_schedule_week_unique', table_name='weekly_quotas')
    op.drop_index('ix_weekly_quotas_week_start_date', table_name='weekly_quotas')
    op.drop_index('ix_weekly_quotas_reptile_id', table_name='weekly_quotas')
    op.drop_index('ix_weekly_quotas_schedule_id', table_name='weekly_quotas')

    # Drop table
    op.drop_table('weekly_quotas')
