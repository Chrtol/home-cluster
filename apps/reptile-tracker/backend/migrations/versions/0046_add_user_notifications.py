"""add user notifications

Revision ID: 0046
Revises: 0045
Create Date: 2025-12-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0046'
down_revision: Union[str, None] = '0045'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create notification_type enum
    op.execute("""
        CREATE TYPE notificationtype AS ENUM (
            'schedule_reminder',
            'overdue_alert',
            'feeding_logged',
            'weight_logged',
            'health_event',
            'system'
        )
    """)

    # Create user_notifications table
    op.create_table(
        'user_notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('notification_type', sa.Enum('schedule_reminder', 'overdue_alert', 'feeding_logged', 'weight_logged', 'health_event', 'system', name='notificationtype'), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('link', sa.String(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes
    op.create_index(op.f('ix_user_notifications_id'), 'user_notifications', ['id'], unique=False)
    op.create_index(op.f('ix_user_notifications_user_id'), 'user_notifications', ['user_id'], unique=False)
    op.create_index(op.f('ix_user_notifications_notification_type'), 'user_notifications', ['notification_type'], unique=False)
    op.create_index(op.f('ix_user_notifications_is_read'), 'user_notifications', ['is_read'], unique=False)
    op.create_index(op.f('ix_user_notifications_created_at'), 'user_notifications', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_notifications_created_at'), table_name='user_notifications')
    op.drop_index(op.f('ix_user_notifications_is_read'), table_name='user_notifications')
    op.drop_index(op.f('ix_user_notifications_notification_type'), table_name='user_notifications')
    op.drop_index(op.f('ix_user_notifications_user_id'), table_name='user_notifications')
    op.drop_index(op.f('ix_user_notifications_id'), table_name='user_notifications')
    op.drop_table('user_notifications')
    op.execute('DROP TYPE notificationtype')
