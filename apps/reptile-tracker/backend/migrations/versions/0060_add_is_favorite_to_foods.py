"""add is_favorite to foods

Revision ID: 0060
Revises: 0059
Create Date: 2025-12-06

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0060'
down_revision = '0059'
branch_labels = None
depends_on = None


def upgrade():
    # Add is_favorite column with default False
    op.add_column('foods', sa.Column('is_favorite', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('foods', 'is_favorite')
