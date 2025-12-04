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
    # Create notification_type enum (only if it doesn't exist)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE notificationtype AS ENUM (
                'schedule_reminder',
                'overdue_alert',
                'feeding_logged',
                'weight_logged',
                'health_event',
                'system'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create user_notifications table using raw SQL to avoid enum re-creation
    op.execute("""
        CREATE TABLE user_notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            notification_type notificationtype NOT NULL,
            title VARCHAR NOT NULL,
            message TEXT NOT NULL,
            link VARCHAR,
            is_read BOOLEAN NOT NULL DEFAULT false,
            read_at TIMESTAMPTZ,
            notification_metadata JSON,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

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
    # Drop enum type
    op.execute('DROP TYPE IF EXISTS notificationtype')
