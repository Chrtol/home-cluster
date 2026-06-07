"""Add transfer status columns and pending_exports table for import/export system

Revision ID: 0107
Revises: 0106
Create Date: 2026-06-07 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0107'
down_revision = '0106'
branch_labels = None
depends_on = None


def upgrade():
    # Create TransferStatus enum type
    transfer_status_enum = sa.Enum('none', 'pending', 'completed', 'cancelled', name='transferstatus')
    transfer_status_enum.create(op.get_bind(), checkfirst=True)

    # Add transfer columns to reptiles table
    with op.batch_alter_table('reptiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('transfer_status', sa.Enum('none', 'pending', 'completed', 'cancelled', name='transferstatus'), nullable=False, server_default='none'))
        batch_op.add_column(sa.Column('transfer_exported_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('transfer_export_file', sa.String(), nullable=True))

    # Create pending_exports table
    op.create_table(
        'pending_exports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('household_id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.String(100), nullable=False),
        sa.Column('export_type', sa.String(10), nullable=False),
        sa.Column('reptile_ids', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('is_transfer', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('step', sa.String(50), nullable=True),
        sa.Column('file_path', sa.String(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for pending_exports
    op.create_index('ix_pending_exports_id', 'pending_exports', ['id'], unique=False)
    op.create_index('ix_pending_exports_user_id', 'pending_exports', ['user_id'], unique=False)
    op.create_index('ix_pending_exports_household_id', 'pending_exports', ['household_id'], unique=False)
    op.create_index('ix_pending_exports_task_id', 'pending_exports', ['task_id'], unique=False)
    op.create_index('ix_pending_exports_expires_at', 'pending_exports', ['expires_at'], unique=False)


def downgrade():
    # Drop indexes
    op.drop_index('ix_pending_exports_expires_at', table_name='pending_exports')
    op.drop_index('ix_pending_exports_task_id', table_name='pending_exports')
    op.drop_index('ix_pending_exports_household_id', table_name='pending_exports')
    op.drop_index('ix_pending_exports_user_id', table_name='pending_exports')
    op.drop_index('ix_pending_exports_id', table_name='pending_exports')

    # Drop pending_exports table
    op.drop_table('pending_exports')

    # Remove transfer columns from reptiles table
    with op.batch_alter_table('reptiles', schema=None) as batch_op:
        batch_op.drop_column('transfer_export_file')
        batch_op.drop_column('transfer_exported_at')
        batch_op.drop_column('transfer_status')

    # Drop enum type
    transfer_status_enum = sa.Enum('none', 'pending', 'completed', 'cancelled', name='transferstatus')
    transfer_status_enum.drop(op.get_bind(), checkfirst=True)
