"""fix template timestamps

Revision ID: 0044
Revises: 0043
Create Date: 2025-12-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0044'
down_revision: Union[str, None] = '0043'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update any existing templates with NULL timestamps
    op.execute("""
        UPDATE notification_templates
        SET created_at = NOW(), updated_at = NOW()
        WHERE created_at IS NULL OR updated_at IS NULL
    """)


def downgrade() -> None:
    # No downgrade needed - we don't want to remove timestamps
    pass
