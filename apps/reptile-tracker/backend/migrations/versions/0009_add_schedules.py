"""Add schedules table

Revision ID: 0009
Revises: 0008
Create Date: 2025-10-15

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('reptile_id', sa.Integer(), nullable=False),
        sa.Column('schedule_type', sa.String(), nullable=False),  # 'feeding', 'misting', 'weighing'
        sa.Column('frequency_days', sa.Integer(), nullable=False),  # Repeat every X days
        sa.Column('enabled', sa.Boolean(), default=True, nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['reptile_id'], ['reptiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_schedules_id'), 'schedules', ['id'], unique=False)
    op.create_index(op.f('ix_schedules_reptile_id'), 'schedules', ['reptile_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_schedules_reptile_id'), table_name='schedules')
    op.drop_index(op.f('ix_schedules_id'), table_name='schedules')
    op.drop_table('schedules')
