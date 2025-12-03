"""add notification settings

Revision ID: 0039
Revises: 0038
Create Date: 2025-12-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0039'
down_revision: Union[str, None] = '0038'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create notification_settings table if it doesn't exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if 'notification_settings' not in inspector.get_table_names():
        op.create_table(
            'notification_settings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('webhook_enabled', sa.Boolean(), nullable=True),
            sa.Column('webhook_url', sa.String(), nullable=True),
            sa.Column('webhook_type', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id')
        )
        op.create_index(op.f('ix_notification_settings_id'), 'notification_settings', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_notification_settings_id'), table_name='notification_settings')
    op.drop_table('notification_settings')
