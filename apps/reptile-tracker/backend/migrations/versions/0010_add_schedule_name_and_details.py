"""add schedule name and details

Revision ID: 0010
Revises: 0009
Create Date: 2025-01-15

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    # Add name field to schedules
    op.add_column('schedules', sa.Column('name', sa.String(), nullable=True))

    # Add food_category for feeding schedules (insects, salad, mixed, etc.)
    op.add_column('schedules', sa.Column('food_category', sa.String(), nullable=True))

    # Add time_slot for misting schedules (morning, midday, afternoon, evening, night)
    op.add_column('schedules', sa.Column('time_slot', sa.String(), nullable=True))


def downgrade():
    op.drop_column('schedules', 'time_slot')
    op.drop_column('schedules', 'food_category')
    op.drop_column('schedules', 'name')
