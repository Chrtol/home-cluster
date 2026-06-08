"""Add feeding status and local auth fields

Revision ID: 0108
Revises: 0107
Create Date: 2026-06-08 13:15:00.000000

Phase 35 Foundation Migration:
- Adds FeedingStatus enum and status/retry fields to feedings table
- Adds password_hash and temp password fields to users table
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0108'
down_revision = '0107'
branch_labels = None
depends_on = None


def upgrade():
    # Create FeedingStatus enum type
    op.execute("CREATE TYPE feedingstatus AS ENUM ('eaten', 'refused')")

    # Add status field to feedings table (with server_default so existing rows get 'eaten')
    op.add_column('feedings', sa.Column(
        'status',
        sa.Enum('eaten', 'refused', name='feedingstatus', create_type=False),
        nullable=False,
        server_default='eaten'
    ))

    # Add retry scheduling fields to feedings table
    op.add_column('feedings', sa.Column(
        'retry_scheduled_for',
        sa.DateTime(timezone=True),
        nullable=True
    ))
    op.add_column('feedings', sa.Column(
        'retry_instance_id',
        sa.Integer(),
        nullable=True
    ))

    # Add foreign key constraint for retry_instance_id
    op.create_foreign_key(
        'fk_feedings_retry_instance_id',
        'feedings', 'schedule_instances',
        ['retry_instance_id'], ['id'],
        ondelete='SET NULL'
    )

    # Add local auth fields to users table (nullable - D-12: NULL for OIDC-only users)
    op.add_column('users', sa.Column(
        'password_hash',
        sa.String(255),
        nullable=True
    ))
    op.add_column('users', sa.Column(
        'temp_password_hash',
        sa.String(255),
        nullable=True
    ))
    op.add_column('users', sa.Column(
        'temp_password_expires',
        sa.DateTime(timezone=True),
        nullable=True
    ))


def downgrade():
    # Remove local auth fields from users table
    op.drop_column('users', 'temp_password_expires')
    op.drop_column('users', 'temp_password_hash')
    op.drop_column('users', 'password_hash')

    # Remove foreign key constraint for retry_instance_id
    op.drop_constraint('fk_feedings_retry_instance_id', 'feedings', type_='foreignkey')

    # Remove feeding status fields from feedings table
    op.drop_column('feedings', 'retry_instance_id')
    op.drop_column('feedings', 'retry_scheduled_for')
    op.drop_column('feedings', 'status')

    # Drop FeedingStatus enum type
    op.execute("DROP TYPE feedingstatus")
