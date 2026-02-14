"""Add default templates for planner digest notifications

Revision ID: 0086
Revises: 0085
Create Date: 2026-02-14

Adds default system templates for:
- daily_planner: Daily digest of tasks for the day
- weekly_planner: Weekly digest of tasks for the next 7 days

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '0086'
down_revision = '0085'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Daily planner template
    # Sent each morning with tasks for the day
    op.execute("""
        INSERT INTO notification_templates
        (user_id, name, template_type, trigger_type, message_template, title_template, is_active, priority)
        VALUES
        (NULL, 'Daily Planner (Default)', 'system', 'daily_planner',
         '{message}',
         'Daily Planner - {date}',
         true, 100)
    """)

    # Weekly planner template
    # Sent on configured day with tasks for the next week
    op.execute("""
        INSERT INTO notification_templates
        (user_id, name, template_type, trigger_type, message_template, title_template, is_active, priority)
        VALUES
        (NULL, 'Weekly Planner (Default)', 'system', 'weekly_planner',
         '{message}',
         'Weekly Planner - {start_date} to {end_date}',
         true, 100)
    """)


def downgrade() -> None:
    # Remove the planner digest templates
    op.execute("""
        DELETE FROM notification_templates
        WHERE trigger_type IN ('daily_planner', 'weekly_planner')
        AND template_type = 'system'
        AND user_id IS NULL
    """)
