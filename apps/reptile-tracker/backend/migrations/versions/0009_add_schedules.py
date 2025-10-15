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
        sa.Column('schedule_type', sa.String(), nullable=False),  # 'feeding', 'misting', 'weighing', 'supplement'
        sa.Column('schedule_rule', sa.String(), nullable=False),  # 'every_x_days', 'days_of_week', 'monthly', 'dependent'

        # For every_x_days
        sa.Column('frequency_days', sa.Integer(), nullable=True),

        # For days_of_week (comma-separated: '1,3,5' for Mon,Wed,Fri - 0=Sunday, 6=Saturday)
        sa.Column('days_of_week', sa.String(), nullable=True),

        # For monthly (day of month: 1-31)
        sa.Column('day_of_month', sa.Integer(), nullable=True),

        # For dependent schedules
        sa.Column('parent_schedule_id', sa.Integer(), nullable=True),  # Links to parent schedule
        sa.Column('dependent_rule', sa.String(), nullable=True),  # 'every_occurrence', 'every_nth', 'specific_days'
        sa.Column('dependent_frequency', sa.Integer(), nullable=True),  # For every_nth (e.g., every 2nd feeding)
        sa.Column('dependent_days', sa.String(), nullable=True),  # For specific_days (e.g., '1,3' for Mon,Wed)

        # For supplement schedules
        sa.Column('supplement_id', sa.Integer(), nullable=True),

        sa.Column('enabled', sa.Boolean(), default=True, nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['reptile_id'], ['reptiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_schedule_id'], ['schedules.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['supplement_id'], ['supplements.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_schedules_id'), 'schedules', ['id'], unique=False)
    op.create_index(op.f('ix_schedules_reptile_id'), 'schedules', ['reptile_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_schedules_reptile_id'), table_name='schedules')
    op.drop_index(op.f('ix_schedules_id'), table_name='schedules')
    op.drop_table('schedules')
