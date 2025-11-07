"""Add supplement rotation templates table

Revision ID: 0037
Revises: 0034
Create Date: 2025-01-07
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0037'
down_revision = '0034'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'supplement_rotation_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('species', sa.String(), nullable=True),
        sa.Column('age_category', sa.String(), nullable=True),
        sa.Column('uvb_lighting', sa.Boolean(), nullable=True),
        sa.Column('supplement_id', sa.Integer(), nullable=False),
        sa.Column('trigger_mode', sa.String(), nullable=False, server_default='feeding_count'),
        sa.Column('every_n_feedings', sa.Integer(), nullable=True),
        sa.Column('counting_mode', sa.String(), nullable=True, server_default='all_feedings'),
        sa.Column('schedule_days_of_week', sa.String(), nullable=True),
        sa.Column('schedule_frequency_days', sa.Integer(), nullable=True),
        sa.Column('applies_to_category', sa.String(), nullable=True),
        sa.Column('application_mode', sa.String(), nullable=False, server_default='any_feeding'),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('is_exclusive', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('source_name', sa.String(), nullable=True),
        sa.Column('source_url', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['supplement_id'], ['supplements.id'], ondelete='CASCADE')
    )
    op.create_index(op.f('ix_supplement_rotation_templates_id'), 'supplement_rotation_templates', ['id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_supplement_rotation_templates_id'), table_name='supplement_rotation_templates')
    op.drop_table('supplement_rotation_templates')
