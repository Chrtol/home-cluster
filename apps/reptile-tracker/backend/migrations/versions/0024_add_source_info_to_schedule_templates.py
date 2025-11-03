"""add source info to schedule templates

Revision ID: 0024
Revises: 0023
Create Date: 2025-01-26

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0024'
down_revision = '0023'
branch_labels = None
depends_on = None


def upgrade():
    # Add source_name and source_url columns to schedule_templates table
    op.add_column('schedule_templates', sa.Column('source_name', sa.String(), nullable=True))
    op.add_column('schedule_templates', sa.Column('source_url', sa.String(), nullable=True))


def downgrade():
    # Remove source_name and source_url columns
    op.drop_column('schedule_templates', 'source_url')
    op.drop_column('schedule_templates', 'source_name')
