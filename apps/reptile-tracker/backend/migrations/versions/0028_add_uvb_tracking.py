"""Add UVB lighting tracking for schedules and reptiles

Revision ID: 0028
Revises: 0027
Create Date: 2025-01-06
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0028'
down_revision = '0027'
branch_labels = None
depends_on = None


def upgrade():
    # Add uvb_lighting column to schedule_templates
    # NULL = doesn't matter, True = requires UVB, False = no UVB needed
    op.add_column('schedule_templates',
        sa.Column('uvb_lighting', sa.Boolean(), nullable=True))

    # Add has_uvb column to reptiles to track their lighting setup
    # NULL = not specified, True = has UVB, False = no UVB
    op.add_column('reptiles',
        sa.Column('has_uvb', sa.Boolean(), nullable=True))

    # Create index for faster filtering
    op.create_index('ix_schedule_templates_uvb_lighting', 'schedule_templates', ['uvb_lighting'])


def downgrade():
    op.drop_index('ix_schedule_templates_uvb_lighting', table_name='schedule_templates')
    op.drop_column('reptiles', 'has_uvb')
    op.drop_column('schedule_templates', 'uvb_lighting')
