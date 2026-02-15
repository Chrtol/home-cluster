"""Separate weight alert thresholds for gain and loss

Revision ID: 0091
Revises: 0090
Create Date: 2026-02-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0091'
down_revision = '0090'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add new separate threshold columns
    op.add_column('reptiles', sa.Column('weight_alert_gain_threshold_percent', sa.Integer(), nullable=True))
    op.add_column('reptiles', sa.Column('weight_alert_loss_threshold_percent', sa.Integer(), nullable=True))

    # Migrate existing data: copy old threshold to both new columns
    op.execute("""
        UPDATE reptiles
        SET weight_alert_gain_threshold_percent = weight_alert_threshold_percent,
            weight_alert_loss_threshold_percent = weight_alert_threshold_percent
        WHERE weight_alert_threshold_percent IS NOT NULL
    """)

    # Drop old column
    op.drop_column('reptiles', 'weight_alert_threshold_percent')

def downgrade() -> None:
    # Add back old column
    op.add_column('reptiles', sa.Column('weight_alert_threshold_percent', sa.Integer(), nullable=True))

    # Migrate: use gain threshold as the single threshold
    op.execute("""
        UPDATE reptiles
        SET weight_alert_threshold_percent = weight_alert_gain_threshold_percent
        WHERE weight_alert_gain_threshold_percent IS NOT NULL
    """)

    # Drop new columns
    op.drop_column('reptiles', 'weight_alert_loss_threshold_percent')
    op.drop_column('reptiles', 'weight_alert_gain_threshold_percent')
