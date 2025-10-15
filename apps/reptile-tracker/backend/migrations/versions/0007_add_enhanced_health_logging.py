"""Add enhanced health logging fields

Revision ID: 0007
Revises: 0006
Create Date: 2025-10-15

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to health_records table
    op.add_column('health_records', sa.Column('consistency', sa.String(), nullable=True))
    op.add_column('health_records', sa.Column('photo_url', sa.String(), nullable=True))


def downgrade():
    op.drop_column('health_records', 'photo_url')
    op.drop_column('health_records', 'consistency')
