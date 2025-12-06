"""add quota warning template examples for requirement schedules

Revision ID: 0065
Revises: 0064
Create Date: 2025-12-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0065'
down_revision: Union[str, None] = '0064'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add example system templates that demonstrate quota warning template variables
    # These templates show users what variables are available for quota warnings
    # Users can copy these and customize them, or create their own from scratch

    # Note: These templates reuse the "schedule_reminder" trigger_type
    # The warning_type context variable allows templates to differentiate between:
    # - max_days_approaching
    # - max_days_exceeded
    # - period_ending_soon
    # - quota_exceeded

    op.execute("""
        INSERT INTO notification_templates
        (user_id, name, template_type, trigger_type, message_template, title_template, channel_type, is_active)
        VALUES
        -- Example template for max_days quota warnings
        (NULL, 'Quota Warning - Max Days (Example)', 'system', 'schedule_reminder',
         '⏰ **Feeding Reminder for {reptile_name}**\n\nIt has been **{days_since_last} days** since last feeding.\nMaximum allowed: **{max_days_between} days**\n\n📊 Quota Status: {quota_count}/{quota_frequency} this {period_label}',
         'Feeding Reminder - {reptile_name}',
         NULL,
         false),

        -- Example template for period ending reminders
        (NULL, 'Quota Warning - Period Ending (Example)', 'system', 'schedule_reminder',
         '📊 **Quota Reminder for {reptile_name}**\n\n**{reptile_name}** still needs **{remaining_feedings} more feeding(s)** {period_label}.\n\nCurrent progress: {quota_count}/{quota_frequency}',
         'Quota Reminder - {reptile_name}',
         NULL,
         false),

        -- Example template for quota exceeded
        (NULL, 'Quota Warning - Exceeded (Example)', 'system', 'schedule_reminder',
         '⚠️ **Quota Notice for {reptile_name}**\n\n**{reptile_name}** has been fed **{quota_count} times** {period_label}.\nTarget quota: **{quota_frequency} times** {period_label}',
         'Quota Exceeded - {reptile_name}',
         NULL,
         false)
    """)


def downgrade() -> None:
    # Remove the example templates
    op.execute("""
        DELETE FROM notification_templates
        WHERE template_type = 'system'
        AND trigger_type = 'schedule_reminder'
        AND name IN (
            'Quota Warning - Max Days (Example)',
            'Quota Warning - Period Ending (Example)',
            'Quota Warning - Exceeded (Example)'
        )
    """)
