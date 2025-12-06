"""add reptile_food_favorites

Revision ID: 0061
Revises: 0060
Create Date: 2025-12-06

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0061'
down_revision = '0060'
branch_labels = None
depends_on = None


def upgrade():
    # Create reptile_food_favorites table
    op.create_table(
        'reptile_food_favorites',
        sa.Column('reptile_id', sa.Integer(), nullable=False),
        sa.Column('food_id', sa.Integer(), nullable=False),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['reptile_id'], ['reptiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['food_id'], ['foods.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('reptile_id', 'food_id')
    )

    # Add index for faster lookups
    op.create_index('ix_reptile_food_favorites_reptile_id', 'reptile_food_favorites', ['reptile_id'])
    op.create_index('ix_reptile_food_favorites_food_id', 'reptile_food_favorites', ['food_id'])

    # Add show_favorites_first to users table
    op.add_column('users', sa.Column('show_favorites_first', sa.Boolean(), nullable=False, server_default='true'))


def downgrade():
    op.drop_column('users', 'show_favorites_first')
    op.drop_index('ix_reptile_food_favorites_food_id', table_name='reptile_food_favorites')
    op.drop_index('ix_reptile_food_favorites_reptile_id', table_name='reptile_food_favorites')
    op.drop_table('reptile_food_favorites')
