"""baseline schema

Revision ID: 0001
Revises:
Create Date: 2025-10-12 00:00:00.000000

This is a baseline migration representing the existing database schema before household functionality was added.
All tables (users, reptiles, foods, supplements, feedings, etc.) already exist in the database.
This migration exists only to establish a baseline for Alembic version tracking.

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # All tables already exist in the database from Base.metadata.create_all()
    # This migration is a no-op to establish the baseline
    pass


def downgrade():
    # Cannot downgrade past baseline - would need to drop all tables
    pass
