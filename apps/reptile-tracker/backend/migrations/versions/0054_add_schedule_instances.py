"""add schedule instances table

Revision ID: 0054
Revises: 0053
Create Date: 2025-12-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0054'
down_revision: Union[str, None] = '0053'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create schedule_instances table
    op.create_table(
        'schedule_instances',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('schedule_id', sa.Integer(), nullable=False),
        sa.Column('scheduled_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('supplements', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['schedule_id'], ['schedules.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('schedule_id', 'scheduled_date', name='uq_schedule_instance_date')
    )

    # Create indexes for efficient querying
    op.create_index('ix_schedule_instances_schedule_id', 'schedule_instances', ['schedule_id'])
    op.create_index('ix_schedule_instances_scheduled_date', 'schedule_instances', ['scheduled_date'])
    op.create_index('ix_schedule_instances_status', 'schedule_instances', ['status'])
    op.create_index('ix_schedule_instances_schedule_date', 'schedule_instances', ['schedule_id', 'scheduled_date'])

    # Add instance_id to schedule_completions to link completions to instances
    op.add_column('schedule_completions', sa.Column('instance_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_schedule_completions_instance_id', 'schedule_completions', 'schedule_instances', ['instance_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_schedule_completions_instance_id', 'schedule_completions', ['instance_id'])


def downgrade() -> None:
    # Remove instance_id from schedule_completions
    op.drop_index('ix_schedule_completions_instance_id', table_name='schedule_completions')
    op.drop_constraint('fk_schedule_completions_instance_id', 'schedule_completions', type_='foreignkey')
    op.drop_column('schedule_completions', 'instance_id')

    # Drop schedule_instances indexes
    op.drop_index('ix_schedule_instances_schedule_date', table_name='schedule_instances')
    op.drop_index('ix_schedule_instances_status', table_name='schedule_instances')
    op.drop_index('ix_schedule_instances_scheduled_date', table_name='schedule_instances')
    op.drop_index('ix_schedule_instances_schedule_id', table_name='schedule_instances')

    # Drop schedule_instances table
    op.drop_table('schedule_instances')
