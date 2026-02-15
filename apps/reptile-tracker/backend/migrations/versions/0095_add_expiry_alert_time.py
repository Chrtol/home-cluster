"""Add expiry_alert_time field to schedules

Change window expiry alert from offset-based to specific time.
The old expiry_alert_offset_minutes field is deprecated but kept for
backward compatibility during migration.

Revision ID: 0095
Revises: 0094
Create Date: 2026-02-15

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0095'
down_revision = '0094'
branch_labels = None
depends_on = None


def upgrade():
    # Add expiry_alert_time field for specific time configuration
    op.add_column('schedules', sa.Column('expiry_alert_time', sa.Time(), nullable=True))


def downgrade():
    op.drop_column('schedules', 'expiry_alert_time')
