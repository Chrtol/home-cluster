"""Add weight_change_alert default notification template

Revision ID: 0090
Revises: 0089
Create Date: 2026-02-15
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timezone

revision = '0090'
down_revision = '0089'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Insert default system template for weight_change_alert
    op.execute("""
        INSERT INTO notification_templates (
            user_id, name, template_type, trigger_type,
            message_template, title_template, channel_type,
            priority, is_active, created_at, updated_at
        ) VALUES (
            NULL,
            'Weight Change Alert',
            'system',
            'weight_change_alert',
            '{reptile_name} has had a significant weight {change_direction}.\n\n**Change:** {weight_change_percent}% ({weight_change_grams}g)\n**From:** {baseline_weight}g to {current_weight}g\n**Over:** {time_span_days} days',
            'Weight Alert - {reptile_name}',
            NULL,
            100,
            TRUE,
            NOW(),
            NOW()
        )
    """)

def downgrade() -> None:
    op.execute("""
        DELETE FROM notification_templates
        WHERE trigger_type = 'weight_change_alert'
        AND template_type = 'system'
        AND user_id IS NULL
    """)
