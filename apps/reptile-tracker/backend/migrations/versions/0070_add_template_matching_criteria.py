"""add template matching criteria

Revision ID: 0070
Revises: 0069
Create Date: 2025-12-08

Changes:
1. Add optional matching criteria columns to notification_templates table:
   - reptile_id: Filter templates by specific reptile
   - schedule_id: Filter templates by specific schedule
   - schedule_type_filter: Filter by schedule type (feeding, misting, weighing, health)
   - food_category_filter: Filter by food category (insects, salad, prepared, supplements)
2. Add priority column for conflict resolution (lower number = higher priority)
3. Add applies_to_description for user-friendly filtering description
4. Add foreign keys and partial indexes for performance

This enables users to create multiple templates for the same trigger type,
with automatic selection of the most specific matching template.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0070'
down_revision: Union[str, None] = '0069'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns for template matching criteria
    op.add_column('notification_templates',
        sa.Column('reptile_id', sa.Integer(), nullable=True))
    op.add_column('notification_templates',
        sa.Column('schedule_id', sa.Integer(), nullable=True))
    op.add_column('notification_templates',
        sa.Column('schedule_type_filter', sa.String(50), nullable=True))
    op.add_column('notification_templates',
        sa.Column('food_category_filter', sa.String(50), nullable=True))
    op.add_column('notification_templates',
        sa.Column('priority', sa.Integer(), nullable=False, server_default='100'))
    op.add_column('notification_templates',
        sa.Column('applies_to_description', sa.Text(), nullable=True))

    # Add foreign keys
    op.create_foreign_key(
        'fk_notification_templates_reptile',
        'notification_templates', 'reptiles',
        ['reptile_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_notification_templates_schedule',
        'notification_templates', 'schedules',
        ['schedule_id'], ['id'],
        ondelete='CASCADE'
    )

    # Add partial indexes for performance (only index non-NULL values)
    op.execute("""
        CREATE INDEX idx_notification_templates_reptile
        ON notification_templates(reptile_id)
        WHERE reptile_id IS NOT NULL
    """)
    op.execute("""
        CREATE INDEX idx_notification_templates_schedule
        ON notification_templates(schedule_id)
        WHERE schedule_id IS NOT NULL
    """)
    op.execute("""
        CREATE INDEX idx_notification_templates_type_filter
        ON notification_templates(schedule_type_filter)
        WHERE schedule_type_filter IS NOT NULL
    """)
    op.execute("""
        CREATE INDEX idx_notification_templates_food_filter
        ON notification_templates(food_category_filter)
        WHERE food_category_filter IS NOT NULL
    """)


def downgrade() -> None:
    # Drop indexes
    op.execute("DROP INDEX IF EXISTS idx_notification_templates_food_filter")
    op.execute("DROP INDEX IF EXISTS idx_notification_templates_type_filter")
    op.execute("DROP INDEX IF EXISTS idx_notification_templates_schedule")
    op.execute("DROP INDEX IF EXISTS idx_notification_templates_reptile")

    # Drop foreign keys
    op.drop_constraint('fk_notification_templates_schedule', 'notification_templates', type_='foreignkey')
    op.drop_constraint('fk_notification_templates_reptile', 'notification_templates', type_='foreignkey')

    # Drop columns
    op.drop_column('notification_templates', 'applies_to_description')
    op.drop_column('notification_templates', 'priority')
    op.drop_column('notification_templates', 'food_category_filter')
    op.drop_column('notification_templates', 'schedule_type_filter')
    op.drop_column('notification_templates', 'schedule_id')
    op.drop_column('notification_templates', 'reptile_id')
