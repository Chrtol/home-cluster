"""Remove supplement schedule templates (replaced by supplement rotation templates)

Revision ID: 0038
Revises: 0037
Create Date: 2025-01-07
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0038'
down_revision = '0037'
branch_labels = None
depends_on = None


def upgrade():
    # Delete all supplement schedule templates
    # These have been replaced by supplement rotation templates
    op.execute("""
        DELETE FROM schedule_templates
        WHERE schedule_type = 'supplement'
        AND is_default = true
    """)


def downgrade():
    # No downgrade - supplement templates are now in supplement_rotation_templates table
    pass
