"""add reminder_time to schedules

Revision ID: 0049
Revises: 0048
Create Date: 2025-12-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0049'
down_revision: Union[str, None] = '0048'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add reminder_time column to schedules (nullable, takes precedence over reminder_minutes_before if set)
    op.add_column('schedules', sa.Column('reminder_time', sa.Time(), nullable=True))

    # Add reminder_time column to schedule_templates for consistency
    op.add_column('schedule_templates', sa.Column('reminder_time', sa.Time(), nullable=True))


def downgrade() -> None:
    op.drop_column('schedule_templates', 'reminder_time')
    op.drop_column('schedules', 'reminder_time')
