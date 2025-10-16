"""Add feeding rotations table

Revision ID: 0015
Revises: 0014
Create Date: 2025-01-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0015'
down_revision = '0014'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Create feeding_rotations table (if it doesn't exist)
    existing_tables = inspector.get_table_names()
    if 'feeding_rotations' not in existing_tables:
        op.create_table(
            'feeding_rotations',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('reptile_id', sa.Integer(), nullable=False),
            sa.Column('rotation_type', sa.String(), nullable=False),
            sa.Column('supplement_id', sa.Integer(), nullable=True),
            sa.Column('replacement_food_category', sa.String(), nullable=True),
            sa.Column('replacement_note', sa.String(), nullable=True),
            sa.Column('every_n_feedings', sa.Integer(), nullable=False),
            sa.Column('applies_to_category', sa.String(), nullable=True),
            sa.Column('counting_mode', sa.String(), nullable=False, server_default='category_only'),
            sa.Column('application_mode', sa.String(), nullable=False, server_default='any_feeding'),
            sa.Column('priority', sa.Integer(), nullable=False, server_default='10'),
            sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['reptile_id'], ['reptiles.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['supplement_id'], ['supplements.id'], ondelete='CASCADE')
        )

        # Create indexes
        op.create_index('ix_feeding_rotations_reptile_id', 'feeding_rotations', ['reptile_id'])


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'feeding_rotations' in existing_tables:
        op.drop_index('ix_feeding_rotations_reptile_id', table_name='feeding_rotations')
        op.drop_table('feeding_rotations')
