"""add user timezone

Revision ID: 0052
Revises: 0051
Create Date: 2025-12-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0052'
down_revision: Union[str, None] = '0051'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add timezone column to users table
    # Default to UTC, users can change in settings
    op.add_column('users', sa.Column('timezone', sa.String(length=100), nullable=False, server_default='UTC'))


def downgrade() -> None:
    op.drop_column('users', 'timezone')
