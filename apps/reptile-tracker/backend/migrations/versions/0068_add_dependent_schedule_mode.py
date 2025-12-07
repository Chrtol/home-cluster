"""add dependent schedule mode

Revision ID: 0068
Revises: 0067
Create Date: 2025-12-07

Changes:
1. Add 'dependent' value to schedule_mode enum

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0068'
down_revision: Union[str, None] = '0067'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Add new enum value 'dependent' to schedule_mode
    # PostgreSQL doesn't allow adding enum values in a transaction, so we use ALTER TYPE
    conn.execute(sa.text("ALTER TYPE schedule_mode ADD VALUE IF NOT EXISTS 'dependent'"))


def downgrade() -> None:
    # Note: We cannot remove the 'dependent' enum value in PostgreSQL without recreating
    # the entire enum type. Since it's not causing harm, we leave it in place.
    pass
