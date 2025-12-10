"""add avatar image position

Revision ID: 0076
Revises: 0075
Create Date: 2025-12-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0076'
down_revision = '0075'
branch_labels = None
depends_on = None


def upgrade():
    # Add columns to store the image position (for re-initializing the cropper UI)
    # These are percentage-based coordinates representing where the image is positioned
    op.add_column('reptiles', sa.Column('avatar_image_pos_x', sa.Float(), nullable=True))
    op.add_column('reptiles', sa.Column('avatar_image_pos_y', sa.Float(), nullable=True))


def downgrade():
    # Remove avatar image position columns
    op.drop_column('reptiles', 'avatar_image_pos_y')
    op.drop_column('reptiles', 'avatar_image_pos_x')
