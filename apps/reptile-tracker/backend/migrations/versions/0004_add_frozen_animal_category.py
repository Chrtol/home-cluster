"""add frozen_animal category and animal_size field

Revision ID: 0004
Revises: 0003
Create Date: 2025-10-14 00:00:00.000003
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    # Add frozen_animal to foodcategory enum
    op.execute("ALTER TYPE foodcategory ADD VALUE IF NOT EXISTS 'frozen_animal'")

    # Create animalsize enum
    animal_size_enum = postgresql.ENUM(
        'pinky', 'fuzzy', 'hopper', 'weaner',
        'adult_small', 'adult_medium', 'adult_large', 'jumbo',
        name='animalsize',
        create_type=False
    )
    animal_size_enum.create(op.get_bind(), checkfirst=True)

    # Add animal_size column to foods table
    op.add_column('foods', sa.Column('animal_size', sa.Enum(
        'pinky', 'fuzzy', 'hopper', 'weaner',
        'adult_small', 'adult_medium', 'adult_large', 'jumbo',
        name='animalsize'
    ), nullable=True))


def downgrade():
    # Remove animal_size column
    op.drop_column('foods', 'animal_size')

    # Drop animalsize enum
    op.execute('DROP TYPE IF EXISTS animalsize')

    # Note: Cannot remove enum value from foodcategory in PostgreSQL
    # You would need to recreate the enum without 'frozen_animal'
    # For safety, we're leaving it in place
