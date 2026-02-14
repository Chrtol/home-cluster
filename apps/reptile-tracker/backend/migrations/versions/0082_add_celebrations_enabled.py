"""add celebrations_enabled field to users

Revision ID: 0082
Revises: 0081
Create Date: 2026-02-14

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0082'
down_revision = '0081'
branch_labels = None
depends_on = None


def upgrade():
    # Add celebrations_enabled column to users table
    # Defaults to True for all existing users
    op.add_column(
        'users',
        sa.Column('celebrations_enabled', sa.Boolean(), nullable=False, server_default='true')
    )


def downgrade():
    # Remove celebrations_enabled column
    op.drop_column('users', 'celebrations_enabled')
