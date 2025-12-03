"""add notification preferences

Revision ID: 0040
Revises: 0039
Create Date: 2025-12-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0040'
down_revision: Union[str, None] = '0039'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add notification type preferences to notification_settings
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    columns = [col['name'] for col in inspector.get_columns('notification_settings')]

    if 'notify_schedule_reminders' not in columns:
        op.add_column('notification_settings', sa.Column('notify_schedule_reminders', sa.Boolean(), nullable=False, server_default='true'))

    if 'notify_overdue_alerts' not in columns:
        op.add_column('notification_settings', sa.Column('notify_overdue_alerts', sa.Boolean(), nullable=False, server_default='true'))

    # Add notifications_enabled to schedules
    schedules_columns = [col['name'] for col in inspector.get_columns('schedules')]

    if 'notifications_enabled' not in schedules_columns:
        op.add_column('schedules', sa.Column('notifications_enabled', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    op.drop_column('schedules', 'notifications_enabled')
    op.drop_column('notification_settings', 'notify_overdue_alerts')
    op.drop_column('notification_settings', 'notify_schedule_reminders')
