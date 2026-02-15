"""Add separate templates for weight_gain, weight_loss, growth_milestone

Revision ID: 0092
Revises: 0091
Create Date: 2026-02-15
"""
from alembic import op

revision = '0092'
down_revision = '0091'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Update existing weight_change_alert to weight_gain
    op.execute("""
        UPDATE notification_templates
        SET trigger_type = 'weight_gain',
            name = 'Weight Gain Alert',
            title_template = '{reptile_name}: Weight Gain',
            message_template = '**{reptile_name}** has gained weight.\n\n**Change:** {weight_change_percent}% ({weight_change_grams}g)\n**From:** {baseline_weight}g -> {current_weight}g'
        WHERE trigger_type = 'weight_change_alert'
        AND template_type = 'system'
        AND user_id IS NULL
    """)

    # Add weight_loss template
    op.execute("""
        INSERT INTO notification_templates (
            user_id, name, template_type, trigger_type,
            message_template, title_template, channel_type,
            priority, is_active, created_at, updated_at
        ) VALUES (
            NULL,
            'Weight Loss Alert',
            'system',
            'weight_loss',
            '**{reptile_name}** has lost weight.\n\n**Change:** {weight_change_percent}% ({weight_change_grams}g)\n**From:** {baseline_weight}g -> {current_weight}g',
            '{reptile_name}: Weight Loss',
            NULL,
            100,
            TRUE,
            NOW(),
            NOW()
        )
    """)

    # Add growth_milestone template (celebratory!)
    op.execute("""
        INSERT INTO notification_templates (
            user_id, name, template_type, trigger_type,
            message_template, title_template, channel_type,
            priority, is_active, created_at, updated_at
        ) VALUES (
            NULL,
            'Growth Milestone',
            'system',
            'growth_milestone',
            'Your {age_category} **{reptile_name}** has hit a growth milestone!\n\n**Gained:** {weight_change_percent}% ({weight_change_grams}g)\n**Now weighing:** {current_weight}g\n**Baseline (avg of last 3):** {baseline_weight}g\n\nLook how much they''ve grown!',
            '{reptile_name}: Growth Milestone!',
            NULL,
            100,
            TRUE,
            NOW(),
            NOW()
        )
    """)

def downgrade() -> None:
    # Delete new templates
    op.execute("""
        DELETE FROM notification_templates
        WHERE trigger_type IN ('weight_loss', 'growth_milestone')
        AND template_type = 'system'
        AND user_id IS NULL
    """)

    # Restore weight_gain back to weight_change_alert
    op.execute("""
        UPDATE notification_templates
        SET trigger_type = 'weight_change_alert',
            name = 'Weight Change Alert'
        WHERE trigger_type = 'weight_gain'
        AND template_type = 'system'
        AND user_id IS NULL
    """)
