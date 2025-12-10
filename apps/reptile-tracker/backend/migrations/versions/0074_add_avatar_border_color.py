"""add avatar border color

Revision ID: 0074
Revises: 0073
Create Date: 2025-12-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0074'
down_revision = '0073'
branch_labels = None
depends_on = None


def upgrade():
    # Add avatar border color column if it doesn't exist
    # Using batch mode to handle potential existing column gracefully
    from sqlalchemy import inspect
    from alembic import context

    conn = context.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('reptiles')]

    if 'avatar_border_color' not in columns:
        op.add_column('reptiles', sa.Column('avatar_border_color', sa.String(7), nullable=True))


def downgrade():
    op.drop_column('reptiles', 'avatar_border_color')
