"""add auto complete schedules

Revision ID: 0056
Revises: 0055
Create Date: 2025-12-05

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0056'
down_revision = '0055'
branch_labels = None
depends_on = None


def upgrade():
    # Add auto-complete fields to schedules table
    op.add_column('schedules', sa.Column('auto_complete_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('schedules', sa.Column('auto_complete_hours_after', sa.Integer(), nullable=False, server_default='2'))

    # Add auto_completed flag to schedule_completions table
    op.add_column('schedule_completions', sa.Column('auto_completed', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    # Remove columns from schedule_completions
    op.drop_column('schedule_completions', 'auto_completed')

    # Remove columns from schedules
    op.drop_column('schedules', 'auto_complete_hours_after')
    op.drop_column('schedules', 'auto_complete_enabled')
