"""add health category to schedules

Revision ID: 0019
Revises: 0018
Create Date: 2025-01-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add health_category column to schedules table
    # Used for weighing schedules to specify subcategory: "weight_check", "bathing", "shedding_check", etc.
    op.add_column('schedules', sa.Column('health_category', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove health_category column
    op.drop_column('schedules', 'health_category')
