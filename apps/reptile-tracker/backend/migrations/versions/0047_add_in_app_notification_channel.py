"""add in-app notification channel

Revision ID: 0047
Revises: 0046
Create Date: 2025-12-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0047'
down_revision: Union[str, None] = '0046'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_system column to notification_channels
    op.add_column('notification_channels', sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'))

    # Create in-app notification channel for all existing users with notification settings
    op.execute("""
        INSERT INTO notification_channels (notification_settings_id, name, webhook_type, enabled, household_wide, is_system, created_at, updated_at)
        SELECT
            ns.id,
            'In-App Notifications',
            'in_app',
            true,
            false,
            true,
            NOW(),
            NOW()
        FROM notification_settings ns
        WHERE NOT EXISTS (
            SELECT 1 FROM notification_channels nc
            WHERE nc.notification_settings_id = ns.id
            AND nc.webhook_type = 'in_app'
        );
    """)


def downgrade() -> None:
    # Remove all in-app notification channels
    op.execute("DELETE FROM notification_channels WHERE webhook_type = 'in_app'")

    # Drop is_system column
    op.drop_column('notification_channels', 'is_system')
