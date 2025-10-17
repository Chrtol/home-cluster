"""add exclusive mode to rotations

Revision ID: 0018
Revises: 0017
Create Date: 2025-01-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0018'
down_revision = '0017'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_exclusive column to feeding_rotations table
    op.add_column('feeding_rotations', sa.Column('is_exclusive', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # Remove is_exclusive column
    op.drop_column('feeding_rotations', 'is_exclusive')
