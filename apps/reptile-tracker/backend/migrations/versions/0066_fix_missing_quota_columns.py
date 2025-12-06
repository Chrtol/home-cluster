"""fix missing quota columns from incomplete migration 0063

Revision ID: 0066
Revises: 0065
Create Date: 2025-12-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '0066'
down_revision: Union[str, None] = '0065'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    # Check if quota_period enum type exists
    result = conn.execute(sa.text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quota_period')"))
    enum_exists = result.scalar()

    if not enum_exists:
        # Create enum type for quota_period
        quota_period_enum = postgresql.ENUM('week', 'month', name='quota_period', create_type=True)
        quota_period_enum.create(conn, checkfirst=True)

    # Get existing columns
    columns = [c['name'] for c in inspector.get_columns('schedules')]

    # Add quota_period column if it doesn't exist
    if 'quota_period' not in columns:
        op.add_column(
            'schedules',
            sa.Column('quota_period', sa.Enum('week', 'month', name='quota_period'), nullable=True)
        )

    # Add quota_frequency column if it doesn't exist
    if 'quota_frequency' not in columns:
        op.add_column(
            'schedules',
            sa.Column('quota_frequency', sa.Integer(), nullable=True)
        )


def downgrade() -> None:
    # Only drop if they exist
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('schedules')]

    if 'quota_frequency' in columns:
        op.drop_column('schedules', 'quota_frequency')

    if 'quota_period' in columns:
        op.drop_column('schedules', 'quota_period')

    # Check if enum is used by any other columns before dropping
    result = conn.execute(sa.text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE udt_name = 'quota_period'
        )
    """))
    enum_in_use = result.scalar()

    if not enum_in_use:
        quota_period_enum = postgresql.ENUM('week', 'month', name='quota_period')
        quota_period_enum.drop(conn, checkfirst=True)
