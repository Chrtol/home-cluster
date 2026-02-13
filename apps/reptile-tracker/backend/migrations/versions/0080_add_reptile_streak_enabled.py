"""add streak_enabled field to reptiles

Revision ID: 0080
Revises: 0079
Create Date: 2026-02-14

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0080'
down_revision = '0079'
branch_labels = None
depends_on = None


def upgrade():
    # Add streak_enabled column to reptiles table
    # Defaults to True for all existing reptiles
    op.add_column(
        'reptiles',
        sa.Column('streak_enabled', sa.Boolean(), nullable=False, server_default='true')
    )


def downgrade():
    # Remove streak_enabled column
    op.drop_column('reptiles', 'streak_enabled')
