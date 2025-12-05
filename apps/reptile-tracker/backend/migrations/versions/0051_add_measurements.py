"""add measurements table

Revision ID: 0051
Revises: 0050
Create Date: 2025-12-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0051'
down_revision: Union[str, None] = '0050'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create measurements table
    op.create_table(
        'measurements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('reptile_id', sa.Integer(), nullable=False),
        sa.Column('measurement_type', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(length=20), nullable=False),
        sa.Column('measured_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('custom_label', sa.String(length=100), nullable=True),
        sa.Column('schedule_completion_id', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['reptile_id'], ['reptiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['schedule_completion_id'], ['schedule_completions.id'], ondelete='SET NULL'),
    )
    op.create_index(op.f('ix_measurements_id'), 'measurements', ['id'], unique=False)
    op.create_index(op.f('ix_measurements_reptile_id'), 'measurements', ['reptile_id'], unique=False)
    op.create_index(op.f('ix_measurements_schedule_completion_id'), 'measurements', ['schedule_completion_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_measurements_schedule_completion_id'), table_name='measurements')
    op.drop_index(op.f('ix_measurements_reptile_id'), table_name='measurements')
    op.drop_index(op.f('ix_measurements_id'), table_name='measurements')
    op.drop_table('measurements')
