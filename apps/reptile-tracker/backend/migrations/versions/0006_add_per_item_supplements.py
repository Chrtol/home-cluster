"""add per-item supplements support

Revision ID: 0006
Revises: 0005
Create Date: 2025-10-14 00:00:00.000006
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade():
    # Create new association table for feeding_food_supplements
    # This links supplements to specific food items within a feeding
    op.create_table(
        'feeding_food_supplements',
        sa.Column('feeding_id', sa.Integer(), nullable=False),
        sa.Column('food_id', sa.Integer(), nullable=False),
        sa.Column('supplement_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['feeding_id', 'food_id'], ['feeding_foods.feeding_id', 'feeding_foods.food_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['supplement_id'], ['supplements.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('feeding_id', 'food_id', 'supplement_id')
    )


def downgrade():
    op.drop_table('feeding_food_supplements')
