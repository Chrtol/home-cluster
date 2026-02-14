"""add smart notification templates for Phase 22

Revision ID: 0083
Revises: 0082
Create Date: 2026-02-14

Adds default system templates for:
- follow_up_reminder: Sent when task still pending after initial reminder
- expiry_alert: Sent when time window is about to close
- frequency_cap_summary: Sent when notification frequency cap is reached

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0083'
down_revision = '0082'
branch_labels = None
depends_on = None


def upgrade():
    # Follow-up reminder template
    # Sent X minutes after main reminder if task still not complete
    op.execute("""
        INSERT INTO notification_templates
        (user_id, name, template_type, trigger_type, message_template, title_template, is_active, priority)
        VALUES
        (NULL, 'Follow-up Reminder (Default)', 'system', 'follow_up_reminder',
         '{emoji} **Still Pending:** {schedule_name} for **{reptile_name}** (Follow-up #{follow_up_number}){time_window}{notes}',
         'Follow-up #{follow_up_number} - {reptile_name}',
         true, 100)
    """)

    # Expiry alert template (distinct urgency)
    # Sent when time window is closing
    op.execute("""
        INSERT INTO notification_templates
        (user_id, name, template_type, trigger_type, message_template, title_template, is_active, priority)
        VALUES
        (NULL, 'Window Expiry Alert (Default)', 'system', 'expiry_alert',
         '{emoji} **Window Closing:** {schedule_name} for **{reptile_name}** - window {window_start}-{window_end} is ending soon!',
         'Window Closing - {reptile_name}',
         true, 100)
    """)

    # Frequency cap summary template
    # Sent when frequency cap is reached (instead of suppressing silently)
    op.execute("""
        INSERT INTO notification_templates
        (user_id, name, template_type, trigger_type, message_template, title_template, is_active, priority)
        VALUES
        (NULL, 'Frequency Cap Summary (Default)', 'system', 'frequency_cap_summary',
         '{reptile_name} has {notifications_suppressed} more tasks today. Notification limit reached.',
         'Tasks Remaining - {reptile_name}',
         true, 100)
    """)


def downgrade():
    # Remove the smart notification templates
    op.execute("""
        DELETE FROM notification_templates
        WHERE trigger_type IN ('follow_up_reminder', 'expiry_alert', 'frequency_cap_summary')
        AND template_type = 'system'
    """)
