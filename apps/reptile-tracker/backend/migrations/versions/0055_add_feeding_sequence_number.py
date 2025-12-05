"""add feeding_sequence_number to schedule_instances

Revision ID: 0055
Revises: 0054
Create Date: 2025-12-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0055'
down_revision: Union[str, None] = '0054'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add feeding_sequence_number column to schedule_instances
    op.add_column('schedule_instances', sa.Column('feeding_sequence_number', sa.Integer(), nullable=True))

    # Create index for efficient querying
    op.create_index('ix_schedule_instances_feeding_sequence', 'schedule_instances', ['schedule_id', 'feeding_sequence_number'])


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_schedule_instances_feeding_sequence', table_name='schedule_instances')

    # Drop feeding_sequence_number column
    op.drop_column('schedule_instances', 'feeding_sequence_number')
