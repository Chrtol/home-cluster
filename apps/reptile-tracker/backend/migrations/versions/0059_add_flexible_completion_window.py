"""add flexible completion window to schedules

Revision ID: 0059
Revises: 0058
Create Date: 2025-12-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0059'
down_revision: Union[str, None] = '0058'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add flexible_completion_enabled column (default False to maintain current behavior)
    op.add_column(
        'schedules',
        sa.Column('flexible_completion_enabled', sa.Boolean(), nullable=False, server_default='false')
    )

    # Add flexible_completion_days column (default 2 to match current DATE_WINDOW_DAYS constant)
    op.add_column(
        'schedules',
        sa.Column('flexible_completion_days', sa.Integer(), nullable=False, server_default='2')
    )


def downgrade() -> None:
    # Drop columns
    op.drop_column('schedules', 'flexible_completion_days')
    op.drop_column('schedules', 'flexible_completion_enabled')
