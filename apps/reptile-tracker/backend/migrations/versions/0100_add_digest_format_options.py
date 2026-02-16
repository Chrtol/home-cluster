"""Add format options to digest templates

Revision ID: 0100_add_digest_format_options
"""
from alembic import op
import sqlalchemy as sa

revision = '0100'
down_revision = '0099'
branch_labels = None
depends_on = None


def upgrade():
    # Add format option columns for digest templates (idempotent)
    # These control how the digest message is built by the system
    try:
        op.add_column('notification_templates', sa.Column('group_by_reptile', sa.Boolean(), nullable=True))
    except Exception:
        pass
    try:
        op.add_column('notification_templates', sa.Column('show_time_windows', sa.Boolean(), nullable=True))
    except Exception:
        pass
    try:
        op.add_column('notification_templates', sa.Column('include_overdue', sa.Boolean(), nullable=True))
    except Exception:
        pass
    try:
        op.add_column('notification_templates', sa.Column('include_app_link', sa.Boolean(), nullable=True))
    except Exception:
        pass


def downgrade():
    op.drop_column('notification_templates', 'include_app_link')
    op.drop_column('notification_templates', 'include_overdue')
    op.drop_column('notification_templates', 'show_time_windows')
    op.drop_column('notification_templates', 'group_by_reptile')
