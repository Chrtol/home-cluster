"""refactor requirement schedules to interval mode

Revision ID: 0067
Revises: 0066
Create Date: 2025-12-07

Changes:
1. Add 'interval' value to schedule_mode enum
2. Update existing 'requirement' schedules to 'interval' mode
3. Drop quota_frequency column (redundant with min/max days)
4. Keep quota_period for display grouping only

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '0067'
down_revision: Union[str, None] = '0066'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    # 1. Add new enum value 'interval' to schedule_mode
    # PostgreSQL doesn't allow adding enum values in a transaction, so we use ALTER TYPE
    conn.execute(sa.text("ALTER TYPE schedule_mode ADD VALUE IF NOT EXISTS 'interval'"))

    # 2. Update existing 'requirement' schedules to 'interval' mode
    conn.execute(sa.text("""
        UPDATE schedules
        SET schedule_mode = 'interval'
        WHERE schedule_mode = 'requirement'
    """))

    # 3. Drop quota_frequency column (it's redundant with min/max days)
    columns = [c['name'] for c in inspector.get_columns('schedules')]
    if 'quota_frequency' in columns:
        op.drop_column('schedules', 'quota_frequency')


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    # 1. Add quota_frequency column back
    columns = [c['name'] for c in inspector.get_columns('schedules')]
    if 'quota_frequency' not in columns:
        op.add_column(
            'schedules',
            sa.Column('quota_frequency', sa.Integer(), nullable=True)
        )

    # 2. Revert 'interval' schedules back to 'requirement'
    conn.execute(sa.text("""
        UPDATE schedules
        SET schedule_mode = 'requirement'
        WHERE schedule_mode = 'interval'
    """))

    # Note: We cannot remove the 'interval' enum value in PostgreSQL without recreating
    # the entire enum type. Since it's not causing harm, we leave it in place.
