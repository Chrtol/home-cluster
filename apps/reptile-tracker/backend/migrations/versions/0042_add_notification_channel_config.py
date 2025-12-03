"""add notification channel config

Revision ID: 0042
Revises: 0041
Create Date: 2025-12-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0042'
down_revision: Union[str, None] = '0041'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make webhook_url nullable (for pushover which doesn't use webhook URLs)
    op.alter_column('notification_channels', 'webhook_url',
                    existing_type=sa.String(),
                    nullable=True)

    # Add config JSON column for channel-specific settings (pushover api_key, user_key, etc.)
    op.add_column('notification_channels', sa.Column('config', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('notification_channels', 'config')
    op.alter_column('notification_channels', 'webhook_url',
                    existing_type=sa.String(),
                    nullable=False)
