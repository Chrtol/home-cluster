"""add avatar crop coordinates

Revision ID: 0073
Revises: 0072
Create Date: 2025-12-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0073'
down_revision = '0072'
branch_labels = None
depends_on = None


def upgrade():
    # Add avatar crop coordinate columns to reptiles table
    op.add_column('reptiles', sa.Column('avatar_crop_x', sa.Integer(), nullable=True))
    op.add_column('reptiles', sa.Column('avatar_crop_y', sa.Integer(), nullable=True))
    op.add_column('reptiles', sa.Column('avatar_crop_width', sa.Integer(), nullable=True))
    op.add_column('reptiles', sa.Column('avatar_crop_height', sa.Integer(), nullable=True))


def downgrade():
    # Remove avatar crop coordinate columns from reptiles table
    op.drop_column('reptiles', 'avatar_crop_height')
    op.drop_column('reptiles', 'avatar_crop_width')
    op.drop_column('reptiles', 'avatar_crop_y')
    op.drop_column('reptiles', 'avatar_crop_x')
