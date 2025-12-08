"""add template groups

Revision ID: 0071
Revises: 0070
Create Date: 2025-12-08

Changes:
1. Create template_groups table for custom user-defined template organization
2. Add group_id column to notification_templates table
3. Add foreign key constraint with SET NULL on delete (deleting group doesn't delete templates)
4. Add index on group_id for query performance

This enables users to create custom groups (e.g., "Luna's Alerts", "Critical Reminders")
and organize their notification templates into these groups for better management.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0071'
down_revision: Union[str, None] = '0070'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create template_groups table
    op.create_table(
        'template_groups',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('color', sa.String(20), nullable=True),  # For UI color coding (e.g., "blue", "green", "#FF5733")
        sa.Column('icon', sa.String(50), nullable=True),  # Optional emoji or icon identifier
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),  # For custom ordering

        # Group-level settings
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),  # Master on/off switch
        sa.Column('default_priority', sa.Integer(), nullable=False, server_default='0'),  # Priority modifier for all templates
        sa.Column('ignore_quiet_hours', sa.Boolean(), nullable=False, server_default='false'),  # Bypass quiet hours
        sa.Column('default_channel_ids', sa.JSON(), nullable=True),  # Array of default channel IDs for this group

        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now())
    )

    # Add unique constraint: user cannot have duplicate group names
    op.create_unique_constraint(
        'uq_template_groups_user_name',
        'template_groups',
        ['user_id', 'name']
    )

    # Add index on user_id for faster lookups
    op.create_index('idx_template_groups_user', 'template_groups', ['user_id'])

    # Add group_id column to notification_templates
    op.add_column('notification_templates',
        sa.Column('group_id', sa.Integer(), nullable=True))

    # Add foreign key (SET NULL on delete - deleting group doesn't delete templates)
    op.create_foreign_key(
        'fk_notification_templates_group',
        'notification_templates', 'template_groups',
        ['group_id'], ['id'],
        ondelete='SET NULL'
    )

    # Add index for performance
    op.execute("""
        CREATE INDEX idx_notification_templates_group
        ON notification_templates(group_id)
        WHERE group_id IS NOT NULL
    """)


def downgrade() -> None:
    # Drop index
    op.execute("DROP INDEX IF EXISTS idx_notification_templates_group")

    # Drop foreign key
    op.drop_constraint('fk_notification_templates_group', 'notification_templates', type_='foreignkey')

    # Drop column
    op.drop_column('notification_templates', 'group_id')

    # Drop indexes and constraints from template_groups table
    op.drop_index('idx_template_groups_user', 'template_groups')
    op.drop_constraint('uq_template_groups_user_name', 'template_groups', type_='unique')

    # Drop template_groups table
    op.drop_table('template_groups')
