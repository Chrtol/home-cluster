"""Add weight_alert_channel_id to notification_settings

Revision ID: 0093
Revises: 0092
Create Date: 2026-02-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0093'
down_revision = '0092'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('notification_settings', sa.Column(
        'weight_alert_channel_id',
        sa.Integer(),
        sa.ForeignKey('notification_channels.id', ondelete='SET NULL'),
        nullable=True
    ))

def downgrade() -> None:
    op.drop_column('notification_settings', 'weight_alert_channel_id')
