"""Migrate weighing schedule type to health with sub-types

Phase 26: Align schedule types with health logging types.
- Rename schedule_type 'weighing' to 'health'
- Add health_subtype column for sub-type selection
- Add measurement_type column for measurement schedules
- Migrate existing weighing schedules to health with appropriate subtype

Health subtypes:
- weight: Direct weight logging
- measurement: Other measurements (SVL, length, humidity, etc.)
- shedding_check: Check if shedding, prompts yes/no
- brumation_check: Reminder to review brumation status
- health_record: General health record (medication, vet_visit, etc.)
- bathing: Bath schedule

Revision ID: 0102
Revises: 0101
Create Date: 2026-02-17
"""
from alembic import op
import sqlalchemy as sa

revision = '0102'
down_revision = '0101'
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to schedules table
    op.add_column('schedules',
        sa.Column('health_subtype', sa.String(50), nullable=True))
    op.add_column('schedules',
        sa.Column('measurement_type', sa.String(50), nullable=True))

    # Add same columns to schedule_templates table
    op.add_column('schedule_templates',
        sa.Column('health_subtype', sa.String(50), nullable=True))
    op.add_column('schedule_templates',
        sa.Column('measurement_type', sa.String(50), nullable=True))

    # Migrate existing weighing schedules:
    # 1. Set health_subtype based on health_category
    # 2. Change schedule_type from 'weighing' to 'health'
    op.execute("""
        UPDATE schedules
        SET health_subtype = CASE
            WHEN health_category = 'weight_check' THEN 'weight'
            WHEN health_category = 'bathing' THEN 'bathing'
            WHEN health_category = 'shedding_check' THEN 'shedding_check'
            WHEN health_category = 'health_inspection' THEN 'health_record'
            ELSE 'weight'
        END
        WHERE schedule_type = 'weighing'
    """)

    op.execute("""
        UPDATE schedules
        SET schedule_type = 'health'
        WHERE schedule_type = 'weighing'
    """)

    # Same for schedule_templates
    op.execute("""
        UPDATE schedule_templates
        SET health_subtype = CASE
            WHEN health_category = 'weight_check' THEN 'weight'
            WHEN health_category = 'bathing' THEN 'bathing'
            WHEN health_category = 'shedding_check' THEN 'shedding_check'
            WHEN health_category = 'health_inspection' THEN 'health_record'
            ELSE 'weight'
        END
        WHERE schedule_type = 'weighing'
    """)

    op.execute("""
        UPDATE schedule_templates
        SET schedule_type = 'health'
        WHERE schedule_type = 'weighing'
    """)

    # Update notification templates that reference 'weighing' schedule type
    op.execute("""
        UPDATE notification_templates
        SET schedule_type_filter = 'health'
        WHERE schedule_type_filter = 'weighing'
    """)


def downgrade():
    # Revert schedule_type back to weighing
    op.execute("""
        UPDATE schedules
        SET schedule_type = 'weighing'
        WHERE schedule_type = 'health'
    """)

    op.execute("""
        UPDATE schedule_templates
        SET schedule_type = 'weighing'
        WHERE schedule_type = 'health'
    """)

    op.execute("""
        UPDATE notification_templates
        SET schedule_type_filter = 'weighing'
        WHERE schedule_type_filter = 'health'
    """)

    # Drop new columns
    op.drop_column('schedules', 'measurement_type')
    op.drop_column('schedules', 'health_subtype')
    op.drop_column('schedule_templates', 'measurement_type')
    op.drop_column('schedule_templates', 'health_subtype')
