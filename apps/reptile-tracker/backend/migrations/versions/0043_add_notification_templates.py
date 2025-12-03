"""add notification templates

Revision ID: 0043
Revises: 0042
Create Date: 2025-12-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0043'
down_revision: Union[str, None] = '0042'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create notification_templates table
    op.create_table(
        'notification_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('template_type', sa.String(), nullable=False),
        sa.Column('trigger_type', sa.String(), nullable=False),
        sa.Column('message_template', sa.Text(), nullable=False),
        sa.Column('title_template', sa.String(), nullable=True),
        sa.Column('channel_type', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notification_templates_id'), 'notification_templates', ['id'], unique=False)
    op.create_index(op.f('ix_notification_templates_user_id'), 'notification_templates', ['user_id'], unique=False)

    # Insert default system templates
    op.execute("""
        INSERT INTO notification_templates (user_id, name, template_type, trigger_type, message_template, title_template, channel_type, is_active)
        VALUES
        (NULL, 'Schedule Reminder - Default', 'system', 'schedule_reminder',
         '{emoji} **Reminder:** {schedule_name} for **{reptile_name}**\n{time_window}{notes}',
         'Schedule Reminder - {reptile_name}', NULL, true),
        (NULL, 'Overdue Alert - Default', 'system', 'overdue_alert',
         '⚠️ **Overdue Alert:** {schedule_name} for **{reptile_name}** was not completed on {missed_date}',
         'Overdue Schedule - {reptile_name}', NULL, true),
        (NULL, 'Schedule Reminder - Detailed', 'system', 'schedule_reminder',
         '{emoji} **Reminder:** {schedule_name} for **{reptile_name}**\nSchedule Type: {schedule_type}\n{time_window}Due Date: {due_date}\n{notes}',
         'Schedule Reminder - {reptile_name}', NULL, true),
        (NULL, 'Schedule Reminder - Simple', 'system', 'schedule_reminder',
         '{emoji} Time to {schedule_type} {reptile_name}!',
         '{reptile_name} - {schedule_type}', NULL, true)
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_notification_templates_user_id'), table_name='notification_templates')
    op.drop_index(op.f('ix_notification_templates_id'), table_name='notification_templates')
    op.drop_table('notification_templates')
