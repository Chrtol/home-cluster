"""add scheduled notification jobs table

Revision ID: 0053
Revises: 0052
Create Date: 2025-12-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0053'
down_revision: Union[str, None] = '0052'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create scheduled_notification_jobs table to track APScheduler jobs
    op.create_table(
        'scheduled_notification_jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.String(length=255), nullable=False, unique=True, index=True),
        sa.Column('schedule_id', sa.Integer(), nullable=False, index=True),
        sa.Column('user_id', sa.Integer(), nullable=False, index=True),
        sa.Column('channel_id', sa.Integer(), nullable=False),
        sa.Column('scheduled_date', sa.Date(), nullable=False),
        sa.Column('scheduled_time_utc', sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),  # pending, sent, failed, cancelled
        sa.ForeignKeyConstraint(['schedule_id'], ['schedules.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['channel_id'], ['notification_channels.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Index for cleanup queries (finding old jobs)
    op.create_index('ix_scheduled_notification_jobs_status_time', 'scheduled_notification_jobs', ['status', 'scheduled_time_utc'])


def downgrade() -> None:
    op.drop_index('ix_scheduled_notification_jobs_status_time', table_name='scheduled_notification_jobs')
    op.drop_table('scheduled_notification_jobs')
