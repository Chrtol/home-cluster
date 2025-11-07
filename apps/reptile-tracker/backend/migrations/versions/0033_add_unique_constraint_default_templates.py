"""Add unique constraint for default template names

Revision ID: 0033
Revises: 0032
Create Date: 2025-01-07
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0033'
down_revision = '0032'
branch_labels = None
depends_on = None


def upgrade():
    # First, clean up any existing duplicate default templates
    # Keep the oldest one, delete the rest
    connection = op.get_bind()

    # Find duplicate default template names
    result = connection.execute(sa.text("""
        SELECT name, COUNT(*) as count, ARRAY_AGG(id ORDER BY created_at) as ids
        FROM schedule_templates
        WHERE is_default = true
        GROUP BY name
        HAVING COUNT(*) > 1
    """))

    duplicates = result.fetchall()

    # For each duplicate group, keep the first (oldest) and delete the rest
    for row in duplicates:
        name = row[0]
        ids = row[2]  # Array of IDs sorted by created_at
        ids_to_delete = ids[1:]  # All except the first one

        if ids_to_delete:
            connection.execute(
                sa.text("DELETE FROM schedule_templates WHERE id = ANY(:ids)"),
                {"ids": ids_to_delete}
            )
            print(f"Cleaned up {len(ids_to_delete)} duplicate(s) for template: {name}")

    # Now create a partial unique index that only applies to default templates
    # This prevents duplicate default templates while allowing users to create
    # templates with any name they want
    op.create_index(
        'idx_unique_default_template_name',
        'schedule_templates',
        ['name'],
        unique=True,
        postgresql_where=sa.text('is_default = true')
    )


def downgrade():
    op.drop_index('idx_unique_default_template_name', table_name='schedule_templates')
