"""add reptile sex field

Revision ID: 0078
Revises: 0077
Create Date: 2025-12-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0078'
down_revision = '0077'
branch_labels = None
depends_on = None


def upgrade():
    # Add sex column to reptiles table
    # Options: male, female, unknown
    # Nullable to allow existing reptiles to have NULL (can be updated later)
    op.add_column(
        'reptiles',
        sa.Column('sex', sa.String(), nullable=True)
    )


def downgrade():
    # Remove sex column
    op.drop_column('reptiles', 'sex')
