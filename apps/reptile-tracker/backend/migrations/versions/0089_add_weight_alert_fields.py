"""Add weight alert fields to Reptile model and WeightAlertTracking table

Revision ID: 0089
Revises: 0088
Create Date: 2026-02-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0089'
down_revision = '0088'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add weight alert fields to reptiles table
    op.add_column('reptiles', sa.Column('weight_alerts_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('reptiles', sa.Column('weight_alert_threshold_percent', sa.Integer(), nullable=True))

    # Create weight_alert_tracking table
    op.create_table(
        'weight_alert_tracking',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('reptile_id', sa.Integer(), nullable=False),
        sa.Column('last_alert_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_alert_weight_log_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['reptile_id'], ['reptiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['last_alert_weight_log_id'], ['weight_logs.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('reptile_id')
    )
    op.create_index(op.f('ix_weight_alert_tracking_id'), 'weight_alert_tracking', ['id'], unique=False)
    op.create_index(op.f('ix_weight_alert_tracking_reptile_id'), 'weight_alert_tracking', ['reptile_id'], unique=True)

def downgrade() -> None:
    op.drop_index(op.f('ix_weight_alert_tracking_reptile_id'), table_name='weight_alert_tracking')
    op.drop_index(op.f('ix_weight_alert_tracking_id'), table_name='weight_alert_tracking')
    op.drop_table('weight_alert_tracking')
    op.drop_column('reptiles', 'weight_alert_threshold_percent')
    op.drop_column('reptiles', 'weight_alerts_enabled')
