"""add requirement-based schedules

Revision ID: 0063
Revises: 0062
Create Date: 2025-12-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0063'
down_revision: Union[str, None] = '0062'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum type for schedule_mode
    schedule_mode_enum = postgresql.ENUM('fixed', 'requirement', name='schedule_mode', create_type=True)
    schedule_mode_enum.create(op.get_bind(), checkfirst=True)

    # Create enum type for quota_period
    quota_period_enum = postgresql.ENUM('week', 'month', name='quota_period', create_type=True)
    quota_period_enum.create(op.get_bind(), checkfirst=True)

    # Add schedule_mode column (default 'fixed' to maintain current behavior for existing schedules)
    op.add_column(
        'schedules',
        sa.Column('schedule_mode', sa.Enum('fixed', 'requirement', name='schedule_mode'), nullable=False, server_default='fixed')
    )

    # Add quota_period column (week or month)
    op.add_column(
        'schedules',
        sa.Column('quota_period', sa.Enum('week', 'month', name='quota_period'), nullable=True)
    )

    # Add quota_frequency column (how many times per period)
    op.add_column(
        'schedules',
        sa.Column('quota_frequency', sa.Integer(), nullable=True)
    )

    # Add min_days_between column (nullable for fixed mode schedules)
    op.add_column(
        'schedules',
        sa.Column('min_days_between', sa.Integer(), nullable=True)
    )

    # Add max_days_between column (optional even for requirement mode)
    op.add_column(
        'schedules',
        sa.Column('max_days_between', sa.Integer(), nullable=True)
    )

    # Add suggested_days column (JSON array of day numbers: 0-6 for Sunday-Saturday)
    op.add_column(
        'schedules',
        sa.Column('suggested_days', sa.JSON(), nullable=True)
    )


def downgrade() -> None:
    # Drop columns
    op.drop_column('schedules', 'suggested_days')
    op.drop_column('schedules', 'max_days_between')
    op.drop_column('schedules', 'min_days_between')
    op.drop_column('schedules', 'quota_frequency')
    op.drop_column('schedules', 'quota_period')
    op.drop_column('schedules', 'schedule_mode')

    # Drop enum types
    quota_period_enum = postgresql.ENUM('week', 'month', name='quota_period')
    quota_period_enum.drop(op.get_bind(), checkfirst=True)

    schedule_mode_enum = postgresql.ENUM('fixed', 'requirement', name='schedule_mode')
    schedule_mode_enum.drop(op.get_bind(), checkfirst=True)
