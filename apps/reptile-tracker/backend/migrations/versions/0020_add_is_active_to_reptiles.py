"""add is_active to reptiles

Revision ID: 0020
Revises: 0019
Create Date: 2025-01-25

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0020'
down_revision = '0019'
branch_labels = None
depends_on = None


def upgrade():
    # Add is_active column with default True
    op.add_column('reptiles', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))


def downgrade():
    op.drop_column('reptiles', 'is_active')
