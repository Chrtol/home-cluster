"""add notification channels

Revision ID: 0041
Revises: 0040
Create Date: 2025-12-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0041'
down_revision: Union[str, None] = '0040'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create notification_channels table
    op.create_table(
        'notification_channels',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('notification_settings_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('webhook_type', sa.String(), nullable=False),
        sa.Column('webhook_url', sa.String(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['notification_settings_id'], ['notification_settings.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notification_channels_id'), 'notification_channels', ['id'], unique=False)
    op.create_index(op.f('ix_notification_channels_notification_settings_id'), 'notification_channels', ['notification_settings_id'], unique=False)

    # Migrate existing webhook data to channels
    # This will be done via Python code after deployment
    # We keep the old columns for backward compatibility during migration


def downgrade() -> None:
    op.drop_index(op.f('ix_notification_channels_notification_settings_id'), table_name='notification_channels')
    op.drop_index(op.f('ix_notification_channels_id'), table_name='notification_channels')
    op.drop_table('notification_channels')
