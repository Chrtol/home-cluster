"""add schedule notification channels

Revision ID: 0045
Revises: 0044
Create Date: 2025-12-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0045'
down_revision: Union[str, None] = '0044'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add household_wide field to notification_channels
    op.add_column('notification_channels', sa.Column('household_wide', sa.Boolean(), nullable=False, server_default='false'))

    # Create schedule_notification_channels association table
    op.create_table(
        'schedule_notification_channels',
        sa.Column('schedule_id', sa.Integer(), nullable=False),
        sa.Column('channel_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['schedule_id'], ['schedules.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['channel_id'], ['notification_channels.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('schedule_id', 'channel_id')
    )

    # Set notifications_enabled to False by default for existing and new schedules
    # This ensures notifications are opt-in
    op.execute("UPDATE schedules SET notifications_enabled = false WHERE notifications_enabled IS NULL")


def downgrade() -> None:
    op.drop_table('schedule_notification_channels')
    op.drop_column('notification_channels', 'household_wide')
