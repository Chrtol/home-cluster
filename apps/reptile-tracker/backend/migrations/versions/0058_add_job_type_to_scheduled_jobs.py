"""add job_type and instance_id to scheduled notification jobs

Revision ID: 0058
Revises: 0057
Create Date: 2025-12-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0058'
down_revision: Union[str, None] = '0057'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add job_type column (notification_reminder or auto_complete)
    # Default existing jobs to 'notification_reminder'
    op.add_column(
        'scheduled_notification_jobs',
        sa.Column('job_type', sa.String(length=50), nullable=False, server_default='notification_reminder')
    )

    # Add instance_id column for auto_complete jobs
    # NULL for notification_reminder jobs (they use schedule_id + scheduled_date)
    # NOT NULL for auto_complete jobs (they track specific instances)
    op.add_column(
        'scheduled_notification_jobs',
        sa.Column('instance_id', sa.Integer(), nullable=True)
    )

    # Add foreign key constraint for instance_id
    op.create_foreign_key(
        'fk_scheduled_notification_jobs_instance_id',
        'scheduled_notification_jobs',
        'schedule_instances',
        ['instance_id'],
        ['id'],
        ondelete='CASCADE'
    )

    # Add index for efficient querying by instance_id
    op.create_index(
        'ix_scheduled_notification_jobs_instance_id',
        'scheduled_notification_jobs',
        ['instance_id']
    )

    # Add composite index for job_type + status for efficient job queries
    op.create_index(
        'ix_scheduled_notification_jobs_type_status',
        'scheduled_notification_jobs',
        ['job_type', 'status']
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_scheduled_notification_jobs_type_status', table_name='scheduled_notification_jobs')
    op.drop_index('ix_scheduled_notification_jobs_instance_id', table_name='scheduled_notification_jobs')

    # Drop foreign key constraint
    op.drop_constraint('fk_scheduled_notification_jobs_instance_id', 'scheduled_notification_jobs', type_='foreignkey')

    # Drop columns
    op.drop_column('scheduled_notification_jobs', 'instance_id')
    op.drop_column('scheduled_notification_jobs', 'job_type')
