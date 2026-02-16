"""Add per-reptile cooldown override for weight alerts

Revision ID: 0096_add_reptile_cooldown_override
Revises: 0095_add_expiry_alert_time
Create Date: 2026-02-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0096'
down_revision = '0095'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('reptiles',
        sa.Column('weight_alert_cooldown_days', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('reptiles', 'weight_alert_cooldown_days')
