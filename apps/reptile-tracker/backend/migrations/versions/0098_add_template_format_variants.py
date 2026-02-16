"""Add template format variants and channel notification format

Revision ID: 0098_add_template_format_variants
Revises: 0097_add_digest_template_types
Create Date: 2026-02-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0098_add_template_format_variants'
down_revision = '0097_add_digest_template_types'
branch_labels = None
depends_on = None


def upgrade():
    # Add template format variant columns
    op.add_column('notification_templates',
        sa.Column('message_template_short', sa.Text(), nullable=True))
    op.add_column('notification_templates',
        sa.Column('message_template_long', sa.Text(), nullable=True))

    # Migrate existing message_template to message_template_short
    op.execute("""
        UPDATE notification_templates
        SET message_template_short = message_template
        WHERE message_template IS NOT NULL
          AND message_template_short IS NULL
    """)

    # Add channel format preference
    op.add_column('notification_channels',
        sa.Column('notification_format', sa.String(10),
            nullable=False, server_default='short'))


def downgrade():
    op.drop_column('notification_channels', 'notification_format')
    op.drop_column('notification_templates', 'message_template_long')
    op.drop_column('notification_templates', 'message_template_short')
