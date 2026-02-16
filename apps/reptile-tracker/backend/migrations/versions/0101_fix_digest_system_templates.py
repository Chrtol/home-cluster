"""Fix digest system templates with proper task line content

Migration 0086 created templates with placeholder {message} content.
Migration 0097 attempted to fix but used ON CONFLICT DO NOTHING.
This migration updates the existing templates with the correct format.

Revision ID: 0101
Revises: 0095
Create Date: 2026-02-16
"""
from alembic import op
from sqlalchemy.sql import text
from datetime import datetime, timezone

revision = '0101'
down_revision = '0100'
branch_labels = None
depends_on = None


def upgrade():
    import sqlalchemy as sa
    conn = op.get_bind()

    # Step 1: Add template format variant columns if they don't exist
    # These columns were added in migration 0098, but we need them here too
    try:
        op.add_column('notification_templates', sa.Column('message_template_short', sa.Text(), nullable=True))
    except Exception:
        pass  # Column already exists

    try:
        op.add_column('notification_templates', sa.Column('message_template_long', sa.Text(), nullable=True))
    except Exception:
        pass  # Column already exists

    # Step 2: Add digest format columns if they don't exist
    # These columns were added in migration 0100, but we need them here too
    try:
        op.add_column('notification_templates', sa.Column('group_by_reptile', sa.Boolean(), nullable=True))
    except Exception:
        pass  # Column already exists

    try:
        op.add_column('notification_templates', sa.Column('show_time_windows', sa.Boolean(), nullable=True))
    except Exception:
        pass  # Column already exists

    try:
        op.add_column('notification_templates', sa.Column('include_overdue', sa.Boolean(), nullable=True))
    except Exception:
        pass  # Column already exists

    try:
        op.add_column('notification_templates', sa.Column('include_app_link', sa.Boolean(), nullable=True))
    except Exception:
        pass  # Column already exists

    # Step 3: Task line format used by digest.py
    # System handles iteration, grouping, and sections - this is the per-task line format
    task_template = "{emoji} {reptile_name}: {schedule_name}{time_window_display}"

    now = datetime.now(timezone.utc).isoformat()

    # Step 4: Update daily_planner system template
    conn.execute(text("""
        UPDATE notification_templates
        SET message_template = :msg,
            message_template_short = :msg,
            message_template_long = :msg,
            name = 'Daily Planner Default',
            title_template = 'Daily Planner - {date}',
            updated_at = :now,
            group_by_reptile = true,
            show_time_windows = true,
            include_overdue = true,
            include_app_link = true
        WHERE trigger_type = 'daily_planner'
          AND template_type = 'system'
          AND user_id IS NULL
    """), {'msg': task_template, 'now': now})

    # Step 5: Update weekly_planner system template
    conn.execute(text("""
        UPDATE notification_templates
        SET message_template = :msg,
            message_template_short = :msg,
            message_template_long = :msg,
            name = 'Weekly Planner Default',
            title_template = 'Weekly Planner - {week_start} to {week_end}',
            updated_at = :now,
            group_by_reptile = true,
            show_time_windows = true,
            include_overdue = true,
            include_app_link = true
        WHERE trigger_type = 'weekly_planner'
          AND template_type = 'system'
          AND user_id IS NULL
    """), {'msg': task_template, 'now': now})


def downgrade():
    # Revert to placeholder content
    conn = op.get_bind()
    conn.execute(text("""
        UPDATE notification_templates
        SET message_template = '{message}',
            message_template_short = NULL,
            message_template_long = NULL,
            group_by_reptile = NULL,
            show_time_windows = NULL,
            include_overdue = NULL,
            include_app_link = NULL
        WHERE trigger_type IN ('daily_planner', 'weekly_planner')
          AND template_type = 'system'
          AND user_id IS NULL
    """))

    # Drop columns (only if this migration added them)
    # Note: This is safe because we catch the exception if columns don't exist
    try:
        op.drop_column('notification_templates', 'include_app_link')
    except Exception:
        pass

    try:
        op.drop_column('notification_templates', 'include_overdue')
    except Exception:
        pass

    try:
        op.drop_column('notification_templates', 'show_time_windows')
    except Exception:
        pass

    try:
        op.drop_column('notification_templates', 'group_by_reptile')
    except Exception:
        pass

    try:
        op.drop_column('notification_templates', 'message_template_long')
    except Exception:
        pass

    try:
        op.drop_column('notification_templates', 'message_template_short')
    except Exception:
        pass
