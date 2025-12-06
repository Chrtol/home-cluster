"""add default foods to reptiles

Revision ID: 0062
Revises: 0061
Create Date: 2025-12-06

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0062'
down_revision = '0061'
branch_labels = None
depends_on = None


def upgrade():
    # Add default food columns for auto-selection when logging feedings
    op.add_column('reptiles', sa.Column('default_insect_id', sa.Integer(), nullable=True))
    op.add_column('reptiles', sa.Column('default_prepared_id', sa.Integer(), nullable=True))

    # Add foreign key constraints
    op.create_foreign_key('fk_reptiles_default_insect', 'reptiles', 'foods', ['default_insect_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_reptiles_default_prepared', 'reptiles', 'foods', ['default_prepared_id'], ['id'], ondelete='SET NULL')


def downgrade():
    op.drop_constraint('fk_reptiles_default_prepared', 'reptiles', type_='foreignkey')
    op.drop_constraint('fk_reptiles_default_insect', 'reptiles', type_='foreignkey')
    op.drop_column('reptiles', 'default_prepared_id')
    op.drop_column('reptiles', 'default_insect_id')
