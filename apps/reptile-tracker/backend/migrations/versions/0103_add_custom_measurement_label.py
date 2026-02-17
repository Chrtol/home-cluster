"""Add custom_measurement_label to schedules and schedule_templates

Allows schedules with measurement_type='custom' to specify what custom
measurement should be taken. This label is used for:
- Display on calendar and task lists
- Pre-filling the measurement form when completing the schedule

Revision ID: 0103
Revises: 0102
Create Date: 2026-02-17
"""
from alembic import op
import sqlalchemy as sa

revision = '0103'
down_revision = '0102'
branch_labels = None
depends_on = None


def upgrade():
    # Add custom_measurement_label to schedules table
    op.add_column('schedules',
        sa.Column('custom_measurement_label', sa.String(100), nullable=True))

    # Add same column to schedule_templates table
    op.add_column('schedule_templates',
        sa.Column('custom_measurement_label', sa.String(100), nullable=True))


def downgrade():
    op.drop_column('schedules', 'custom_measurement_label')
    op.drop_column('schedule_templates', 'custom_measurement_label')
