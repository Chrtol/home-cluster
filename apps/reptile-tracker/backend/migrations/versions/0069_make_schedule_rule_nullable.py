"""make schedule_rule nullable for interval schedules

Revision ID: 0069
Revises: 0068
Create Date: 2025-12-07

Changes:
1. Make schedule_rule column nullable (interval schedules don't use schedule rules)

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0069'
down_revision: Union[str, None] = '0068'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make schedule_rule nullable
    op.alter_column('schedules', 'schedule_rule',
                    existing_type=sa.String(),
                    nullable=True)


def downgrade() -> None:
    # Make schedule_rule not nullable (but this could fail if there are NULL values)
    # Set a default value for any NULL schedule_rule before making it NOT NULL
    op.execute("UPDATE schedules SET schedule_rule = 'days_of_week' WHERE schedule_rule IS NULL")
    op.alter_column('schedules', 'schedule_rule',
                    existing_type=sa.String(),
                    nullable=False)
