"""Add misting logs table

Revision ID: 0008
Revises: 0007
Create Date: 2025-10-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'misting_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('reptile_id', sa.Integer(), nullable=False),
        sa.Column('misted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['reptile_id'], ['reptiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_misting_logs_id'), 'misting_logs', ['id'], unique=False)
    op.create_index(op.f('ix_misting_logs_reptile_id'), 'misting_logs', ['reptile_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_misting_logs_reptile_id'), table_name='misting_logs')
    op.drop_index(op.f('ix_misting_logs_id'), table_name='misting_logs')
    op.drop_table('misting_logs')
