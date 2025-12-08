"""add photos table

Revision ID: 0072
Revises: 0071
Create Date: 2025-12-09

Changes:
1. Create photos table for storing reptile photos
2. Add avatar_photo_id column to reptiles table
3. Add indexes for performance

This enables comprehensive photo support including:
- Standalone photo management
- Avatar system for reptiles
- Photo galleries with category filtering
- Photo attachments to health/feeding/weight/misting logs
- Multi-backend storage support (Ceph PVC, S3, NFS)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0072'
down_revision: Union[str, None] = '0071'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create photos table
    op.create_table(
        'photos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('household_id', sa.Integer(), sa.ForeignKey('households.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reptile_id', sa.Integer(), sa.ForeignKey('reptiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('uploaded_by_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),

        # Storage paths
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('thumbnail_path', sa.String(), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(50), nullable=True),

        # Categorization
        sa.Column('category', sa.String(50), nullable=False),  # 'health', 'weight', 'feeding', 'enclosure', 'general'
        sa.Column('tags', postgresql.ARRAY(sa.Text()), nullable=True),

        # Metadata
        sa.Column('caption', sa.Text(), nullable=True),
        sa.Column('taken_at', sa.DateTime(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),

        # Relationships to logs (nullable - photos can exist standalone)
        sa.Column('health_record_id', sa.Integer(), sa.ForeignKey('health_records.id', ondelete='SET NULL'), nullable=True),
        sa.Column('feeding_log_id', sa.Integer(), sa.ForeignKey('feeding_logs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('weight_log_id', sa.Integer(), sa.ForeignKey('weight_logs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('misting_log_id', sa.Integer(), sa.ForeignKey('misting_logs.id', ondelete='SET NULL'), nullable=True),
    )

    # Create indexes for performance
    op.create_index('idx_photos_reptile', 'photos', ['reptile_id'])
    op.create_index('idx_photos_household', 'photos', ['household_id'])
    op.create_index('idx_photos_category', 'photos', ['category'])
    op.create_index('idx_photos_uploaded_at', 'photos', ['uploaded_at'])
    op.create_index('idx_photos_health_record', 'photos', ['health_record_id'], postgresql_where=sa.text('health_record_id IS NOT NULL'))
    op.create_index('idx_photos_feeding_log', 'photos', ['feeding_log_id'], postgresql_where=sa.text('feeding_log_id IS NOT NULL'))
    op.create_index('idx_photos_weight_log', 'photos', ['weight_log_id'], postgresql_where=sa.text('weight_log_id IS NOT NULL'))
    op.create_index('idx_photos_misting_log', 'photos', ['misting_log_id'], postgresql_where=sa.text('misting_log_id IS NOT NULL'))

    # Add avatar_photo_id column to reptiles table
    op.add_column('reptiles',
        sa.Column('avatar_photo_id', postgresql.UUID(as_uuid=True), nullable=True))

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_reptiles_avatar_photo',
        'reptiles', 'photos',
        ['avatar_photo_id'], ['id'],
        ondelete='SET NULL'
    )

    # Add index for avatar lookups
    op.create_index('idx_reptiles_avatar_photo', 'reptiles', ['avatar_photo_id'], postgresql_where=sa.text('avatar_photo_id IS NOT NULL'))


def downgrade() -> None:
    # Drop reptiles avatar index and constraint
    op.drop_index('idx_reptiles_avatar_photo', 'reptiles')
    op.drop_constraint('fk_reptiles_avatar_photo', 'reptiles', type_='foreignkey')
    op.drop_column('reptiles', 'avatar_photo_id')

    # Drop photos indexes
    op.drop_index('idx_photos_misting_log', 'photos')
    op.drop_index('idx_photos_weight_log', 'photos')
    op.drop_index('idx_photos_feeding_log', 'photos')
    op.drop_index('idx_photos_health_record', 'photos')
    op.drop_index('idx_photos_uploaded_at', 'photos')
    op.drop_index('idx_photos_category', 'photos')
    op.drop_index('idx_photos_household', 'photos')
    op.drop_index('idx_photos_reptile', 'photos')

    # Drop photos table
    op.drop_table('photos')
