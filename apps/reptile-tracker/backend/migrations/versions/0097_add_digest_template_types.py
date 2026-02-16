"""Add default digest templates for daily_planner and weekly_planner

Revision ID: 0097_add_digest_template_types
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timezone
from sqlalchemy.sql import text

revision = '0097_add_digest_template_types'
down_revision = '0096_add_reptile_cooldown_override'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    daily_template = """{% if task_count > 0 %}
{% for task in all_tasks -%}
{{ task.emoji }} **{{ task.reptile_name }}:** {{ task.schedule_name }}{% if task.time_window %} ({{ task.time_window }}){% endif %}
{% endfor %}
{% else %}
*No tasks scheduled for today*
{% endif %}
{% if overdue_count > 0 %}

**Overdue:**
{% for task in overdue_tasks -%}
  {{ task.emoji }} {{ task.reptile_name }}: {{ task.schedule_name }}
{% endfor %}
{% endif %}
{% if app_url %}

[View in app]({{ app_url }})
{% endif %}"""

    weekly_template = """{% if task_count > 0 %}
{% for day in days %}
{% if day.tasks %}
**{{ day.date }}**
{% for task in day.tasks -%}
  {{ task.emoji }} {{ task.reptile_name }}: {{ task.schedule_name }}{% if task.time_window %} ({{ task.time_window }}){% endif %}
{% endfor %}

{% endif %}
{% endfor %}
{% else %}
*No tasks scheduled for the next week*
{% endif %}
{% if app_url %}
[View in app]({{ app_url }})
{% endif %}"""

    now = datetime.now(timezone.utc).isoformat()

    conn.execute(text("""
        INSERT INTO notification_templates (
            user_id, name, template_type, trigger_type, message_template, title_template, created_at, updated_at
        ) VALUES
        (NULL, 'Daily Planner Default', 'system', 'daily_planner', :daily_msg, 'Daily Planner - {{ date }}', :now, :now),
        (NULL, 'Weekly Planner Default', 'system', 'weekly_planner', :weekly_msg, 'Weekly Planner - {{ start_date }} to {{ end_date }}', :now, :now)
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
