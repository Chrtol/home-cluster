"""add household_id to reptiles

Revision ID: 0002_add_household_id_to_reptiles
Revises: 0001_initial
Create Date: 2025-10-12 00:00:00.000001
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002_add_household_id_to_reptiles'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('reptiles', sa.Column('household_id', sa.Integer(), nullable=True))
    op.create_foreign_key('reptiles_household_id_fkey', 'reptiles', 'households', ['household_id'], ['id'], ondelete='SET NULL')


def downgrade():
    op.drop_constraint('reptiles_household_id_fkey', 'reptiles', type_='foreignkey')
    op.drop_column('reptiles', 'household_id')
