"""allow null species in care_guidelines

Revision ID: 0023
Revises: 0022
Create Date: 2025-01-26

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0023'
down_revision = '0022'
branch_labels = None
depends_on = None


def upgrade():
    # Allow NULL values in species column for general guidelines
    op.alter_column('care_guidelines', 'species',
                    existing_type=sa.String(),
                    nullable=True)


def downgrade():
    # Revert to NOT NULL (note: this will fail if there are NULL values)
    op.alter_column('care_guidelines', 'species',
                    existing_type=sa.String(),
                    nullable=False)
