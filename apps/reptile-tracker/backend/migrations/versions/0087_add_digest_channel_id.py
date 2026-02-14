"""Add digest_channel_id to notification_settings

Revision ID: 0087
Revises: 0086
Create Date: 2026-02-14

Adds digest_channel_id column to notification_settings table.
This allows users to specify which notification channel receives digest notifications.
If null, digests are sent to all enabled channels.

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '0087'
down_revision = '0086'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add digest_channel_id column with FK to notification_channels
    op.add_column(
        'notification_settings',
        sa.Column('digest_channel_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_notification_settings_digest_channel',
        'notification_settings',
        'notification_channels',
        ['digest_channel_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_notification_settings_digest_channel', 'notification_settings', type_='foreignkey')
    op.drop_column('notification_settings', 'digest_channel_id')
