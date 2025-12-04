"""add discord_config to notification templates

Revision ID: 0050
Revises: 0049
Create Date: 2025-12-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision = '0050'
down_revision = '0049'
branch_labels = None
depends_on = None


def upgrade():
    # Add discord_config JSON column to notification_templates
    op.add_column('notification_templates', sa.Column('discord_config', JSON, nullable=True))

    # Update existing system templates with sensible Discord defaults
    # Schedule reminder template - blue color, include key fields
    op.execute("""
        UPDATE notification_templates
        SET discord_config = '{"color": 3447003, "include_fields": ["scheduled_date", "schedule_type", "notes"], "footer_text": "Reptile Tracker"}'::jsonb
        WHERE trigger_type = 'schedule_reminder'
        AND template_type = 'system'
        AND user_id IS NULL
    """)

    # Overdue alert template - red color, warning fields
    op.execute("""
        UPDATE notification_templates
        SET discord_config = '{"color": 15158332, "include_fields": ["schedule_type"], "footer_text": "Reptile Tracker"}'::jsonb
        WHERE trigger_type = 'overdue_alert'
        AND template_type = 'system'
        AND user_id IS NULL
    """)


def downgrade():
    op.drop_column('notification_templates', 'discord_config')
