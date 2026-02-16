"""Add default digest templates for daily_planner and weekly_planner

Revision ID: 0097_add_digest_template_types
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timezone
from sqlalchemy.sql import text

revision = '0097'
down_revision = '0096'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Simple per-task line format (no loops)
    # System handles iteration, grouping, and sections based on format options
    daily_template = "{emoji} {reptile_name}: {schedule_name}{time_window_display}"

    # Weekly uses same format - system handles day grouping
    weekly_template = "{emoji} {reptile_name}: {schedule_name}{time_window_display}"

    now = datetime.now(timezone.utc).isoformat()

    conn.execute(text("""
        INSERT INTO notification_templates (
            user_id, name, template_type, trigger_type, message_template, title_template, created_at, updated_at
        ) VALUES
        (NULL, 'Daily Planner Default', 'system', 'daily_planner', :daily_msg, 'Daily Planner - {date}', :now, :now),
        (NULL, 'Weekly Planner Default', 'system', 'weekly_planner', :weekly_msg, 'Weekly Planner - {start_date} to {end_date}', :now, :now)
        ON CONFLICT DO NOTHING
    """), {
        'daily_msg': daily_template,
        'weekly_msg': weekly_template,
        'now': now
    })


def downgrade():
    op.execute(
        "DELETE FROM notification_templates WHERE trigger_type IN ('daily_planner', 'weekly_planner') AND user_id IS NULL"
    )
