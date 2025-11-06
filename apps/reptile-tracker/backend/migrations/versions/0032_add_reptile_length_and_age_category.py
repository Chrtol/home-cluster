"""Add length and age_category fields to reptiles

Revision ID: 0032
Revises: 0031
Create Date: 2025-01-06
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0032'
down_revision = '0031'
branch_labels = None
depends_on = None


def upgrade():
    # Add length field (in centimeters) for tracking size-based age categories
    op.add_column('reptiles', sa.Column('length', sa.Integer(), nullable=True))

    # Add age_category field for storing life stage (hatchling, juvenile, adult, gravid)
    # This can be set automatically based on age or manually by user for size-based species
    op.add_column('reptiles', sa.Column('age_category', sa.String(), nullable=True))


def downgrade():
    op.drop_column('reptiles', 'age_category')
    op.drop_column('reptiles', 'length')
