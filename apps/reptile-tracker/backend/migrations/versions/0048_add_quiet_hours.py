"""add quiet hours

Revision ID: 0048
Revises: 0047
Create Date: 2025-12-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0048'
down_revision: Union[str, None] = '0047'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add quiet hours fields to notification_settings
    op.add_column('notification_settings', sa.Column('quiet_hours_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('notification_settings', sa.Column('quiet_hours_start', sa.Time(), nullable=True))
    op.add_column('notification_settings', sa.Column('quiet_hours_end', sa.Time(), nullable=True))


def downgrade() -> None:
    op.drop_column('notification_settings', 'quiet_hours_end')
    op.drop_column('notification_settings', 'quiet_hours_start')
    op.drop_column('notification_settings', 'quiet_hours_enabled')
