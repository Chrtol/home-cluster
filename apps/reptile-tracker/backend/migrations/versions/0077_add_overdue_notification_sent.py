"""add overdue notification sent tracking

Revision ID: 0077
Revises: 0076
Create Date: 2025-12-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0077'
down_revision = '0076'
branch_labels = None
depends_on = None


def upgrade():
    # Add column to track whether overdue notification was sent for MISSED completions
    # This prevents duplicate notifications if webhook fails after marking as MISSED
    # Default to True for existing records (don't re-send old notifications)
    op.add_column(
        'schedule_completions',
        sa.Column('overdue_notification_sent', sa.Boolean(), nullable=False, server_default='true')
    )

    # Remove server default after backfilling (new records will get False by default)
    op.alter_column('schedule_completions', 'overdue_notification_sent', server_default=None)


def downgrade():
    # Remove overdue notification tracking
    op.drop_column('schedule_completions', 'overdue_notification_sent')
