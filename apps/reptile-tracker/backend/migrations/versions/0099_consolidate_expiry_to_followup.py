"""Consolidate expiry_alert into follow_up timing

Per CONTEXT.md: Merge follow-up reminder and window expiry alert into single "follow-up nudge".
Final alert sequence: Main reminder -> Follow-up nudge -> Overdue alert (3 concepts, not 4)

Migration strategy:
1. For schedules with expiry_alert but no follow_up, calculate follow_up_delay_minutes
2. Drop expiry_alert columns after migration

Revision ID: 0099_consolidate_expiry_to_followup
Revises: 0098_add_template_format_variants
Create Date: 2026-02-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0099'
down_revision = '0098'
branch_labels = None
depends_on = None


def upgrade():
    # Migrate expiry_alert to follow_up for schedules that have expiry but not follow-up
    # Calculate delay as time between reminder_time and expiry_alert_time
    # Only run if expiry_alert_enabled column exists
    try:
        op.execute("""
            UPDATE schedules
            SET
                follow_up_enabled = TRUE,
                follow_up_delay_minutes = CASE
                    WHEN reminder_time IS NOT NULL AND expiry_alert_time IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (expiry_alert_time::time - reminder_time::time)) / 60
                    WHEN expiry_alert_offset_minutes IS NOT NULL THEN
                        expiry_alert_offset_minutes
                    ELSE
                        30
                END
            WHERE
                expiry_alert_enabled = TRUE
                AND (follow_up_enabled = FALSE OR follow_up_enabled IS NULL)
        """)
    except Exception:
        pass  # Columns don't exist, skip migration

    # Drop expiry_alert columns (no longer needed) - idempotent
    try:
        op.drop_column('schedules', 'expiry_alert_enabled')
    except Exception:
        pass
    try:
        op.drop_column('schedules', 'expiry_alert_offset_minutes')
    except Exception:
        pass
    try:
        op.drop_column('schedules', 'expiry_alert_time')
    except Exception:
        pass


def downgrade():
    # Re-add expiry_alert columns
    op.add_column('schedules',
        sa.Column('expiry_alert_enabled', sa.Boolean(),
            nullable=False, server_default='false'))
    op.add_column('schedules',
        sa.Column('expiry_alert_offset_minutes', sa.Integer(), nullable=True))
    op.add_column('schedules',
        sa.Column('expiry_alert_time', sa.Time(), nullable=True))

    # Note: We can't perfectly reverse the data migration
    # Schedules that had their expiry_alert migrated to follow_up will remain as follow_up
