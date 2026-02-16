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


def column_exists(table, column):
    """Check if a column exists in a table"""
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :table AND column_name = :column"
    ), {"table": table, "column": column})
    return result.fetchone() is not None


def upgrade():
    if not column_exists('reptiles', 'weight_alert_cooldown_days'):
        op.add_column('reptiles',
            sa.Column('weight_alert_cooldown_days', sa.Integer(), nullable=True))


def downgrade():
    if column_exists('reptiles', 'weight_alert_cooldown_days'):
        op.drop_column('reptiles', 'weight_alert_cooldown_days')
