"""add avatar crop zoom

Revision ID: 0075
Revises: 0074
Create Date: 2025-12-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0075'
down_revision = '0074'
branch_labels = None
depends_on = None


def upgrade():
    # Add avatar crop zoom column to reptiles table
    op.add_column('reptiles', sa.Column('avatar_crop_zoom', sa.Float(), nullable=True))

    # Set default zoom of 1.0 for existing avatars (where crop coordinates exist but zoom is NULL)
    op.execute("""
        UPDATE reptiles
        SET avatar_crop_zoom = 1.0
        WHERE avatar_crop_x IS NOT NULL
        AND avatar_crop_zoom IS NULL
    """)


def downgrade():
    # Remove avatar crop zoom column from reptiles table
    op.drop_column('reptiles', 'avatar_crop_zoom')
