"""Add event_type column to health_records for explicit state tracking

Revision ID: 0079
Revises: 0078
Create Date: 2026-02-12

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0079'
down_revision = '0078'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add event_type column (nullable for backward compatibility)
    op.add_column('health_records', sa.Column('event_type', sa.String(length=20), nullable=True))

    # Backfill existing records based on title patterns
    # This ensures existing data continues to work with new query logic
    connection = op.get_bind()

    # START events: title contains 'start' (case-insensitive)
    connection.execute(sa.text("""
        UPDATE health_records
        SET event_type = 'start'
        WHERE event_type IS NULL
          AND LOWER(title) LIKE '%start%'
    """))

    # COMPLETE events: title contains 'complete' (for shedding)
    connection.execute(sa.text("""
        UPDATE health_records
        SET event_type = 'complete'
        WHERE event_type IS NULL
          AND LOWER(title) LIKE '%complete%'
    """))

    # END events: title contains 'end' but not 'started' (for brumation)
    connection.execute(sa.text("""
        UPDATE health_records
        SET event_type = 'end'
        WHERE event_type IS NULL
          AND LOWER(title) LIKE '%end%'
          AND LOWER(title) NOT LIKE '%started%'
    """))

    # OBSERVATION: everything else that wasn't matched
    connection.execute(sa.text("""
        UPDATE health_records
        SET event_type = 'observation'
        WHERE event_type IS NULL
    """))


def downgrade() -> None:
    op.drop_column('health_records', 'event_type')
