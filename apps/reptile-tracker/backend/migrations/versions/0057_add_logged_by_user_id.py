"""add logged_by_user_id to tracking tables

Revision ID: 0057
Revises: 0056
Create Date: 2025-12-06

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0057'
down_revision = '0056'
branch_labels = None
depends_on = None


def upgrade():
    # Add logged_by_user_id to weight_logs
    op.add_column('weight_logs', sa.Column('logged_by_user_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'weight_logs', 'users', ['logged_by_user_id'], ['id'], ondelete='SET NULL')

    # Add logged_by_user_id to health_records
    op.add_column('health_records', sa.Column('logged_by_user_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'health_records', 'users', ['logged_by_user_id'], ['id'], ondelete='SET NULL')

    # Add logged_by_user_id to misting_logs
    op.add_column('misting_logs', sa.Column('logged_by_user_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'misting_logs', 'users', ['logged_by_user_id'], ['id'], ondelete='SET NULL')

    # Add logged_by_user_id to measurements
    op.add_column('measurements', sa.Column('logged_by_user_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'measurements', 'users', ['logged_by_user_id'], ['id'], ondelete='SET NULL')


def downgrade():
    # Remove logged_by_user_id from measurements
    op.drop_constraint(None, 'measurements', type_='foreignkey')
    op.drop_column('measurements', 'logged_by_user_id')

    # Remove logged_by_user_id from misting_logs
    op.drop_constraint(None, 'misting_logs', type_='foreignkey')
    op.drop_column('misting_logs', 'logged_by_user_id')

    # Remove logged_by_user_id from health_records
    op.drop_constraint(None, 'health_records', type_='foreignkey')
    op.drop_column('health_records', 'logged_by_user_id')

    # Remove logged_by_user_id from weight_logs
    op.drop_constraint(None, 'weight_logs', type_='foreignkey')
    op.drop_column('weight_logs', 'logged_by_user_id')
