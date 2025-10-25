"""add schedule templates and care guidelines

Revision ID: 0021
Revises: 0020
Create Date: 2025-01-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision = '0021'
down_revision = '0020'
branch_labels = None
depends_on = None


def upgrade():
    # Create schedule_templates table
    op.create_table(
        'schedule_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),

        # Species and age targeting
        sa.Column('species', sa.String(), nullable=True),  # null = applies to all species
        sa.Column('age_category', sa.String(), nullable=True),  # "hatchling", "juvenile", "adult", "senior", null = all ages

        # Template metadata
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),  # Protected default templates
        sa.Column('created_by_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('source_template_id', sa.Integer(), sa.ForeignKey('schedule_templates.id', ondelete='SET NULL'), nullable=True),  # Track duplications

        # Schedule configuration (similar to Schedule model)
        sa.Column('schedule_type', sa.String(), nullable=False),  # "feeding", "misting", "weighing", "supplement"
        sa.Column('schedule_rule', sa.String(), nullable=False),  # "every_x_days", "days_of_week", "monthly"
        sa.Column('food_category', sa.String(), nullable=True),
        sa.Column('time_slot', sa.String(), nullable=True),
        sa.Column('health_category', sa.String(), nullable=True),

        # Rule parameters
        sa.Column('frequency_days', sa.Integer(), nullable=True),
        sa.Column('days_of_week', sa.String(), nullable=True),
        sa.Column('day_of_month', sa.Integer(), nullable=True),

        # Time window settings
        sa.Column('earliest_time', sa.Time(), nullable=True),
        sa.Column('latest_time', sa.Time(), nullable=True),
        sa.Column('time_window_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('reminder_minutes_before', sa.Integer(), nullable=True),

        # Supplement reference (optional)
        sa.Column('supplement_id', sa.Integer(), sa.ForeignKey('supplements.id', ondelete='SET NULL'), nullable=True),

        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),

        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_schedule_templates_species', 'schedule_templates', ['species'])
    op.create_index('ix_schedule_templates_age_category', 'schedule_templates', ['age_category'])
    op.create_index('ix_schedule_templates_created_by_user_id', 'schedule_templates', ['created_by_user_id'])

    # Create care_guidelines table
    op.create_table(
        'care_guidelines',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('species', sa.String(), nullable=False),
        sa.Column('age_category', sa.String(), nullable=True),  # "hatchling", "juvenile", "adult", "senior", null = general

        # Guideline content
        sa.Column('guideline_type', sa.String(), nullable=False),  # "feeding", "supplements", "environment", "handling", "general"
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),

        # Structured recommendations (JSON)
        sa.Column('recommendations', JSON(), nullable=True),  # Structured data for automated suggestions

        # Source attribution
        sa.Column('source_name', sa.String(), nullable=True),  # e.g., "ReptiFiles", "Morphmarket Care Guides"
        sa.Column('source_url', sa.String(), nullable=True),

        # User contributions
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_by_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),

        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),

        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_care_guidelines_species', 'care_guidelines', ['species'])
    op.create_index('ix_care_guidelines_age_category', 'care_guidelines', ['age_category'])
    op.create_index('ix_care_guidelines_guideline_type', 'care_guidelines', ['guideline_type'])


def downgrade():
    op.drop_index('ix_care_guidelines_guideline_type', table_name='care_guidelines')
    op.drop_index('ix_care_guidelines_age_category', table_name='care_guidelines')
    op.drop_index('ix_care_guidelines_species', table_name='care_guidelines')
    op.drop_table('care_guidelines')

    op.drop_index('ix_schedule_templates_created_by_user_id', table_name='schedule_templates')
    op.drop_index('ix_schedule_templates_age_category', table_name='schedule_templates')
    op.drop_index('ix_schedule_templates_species', table_name='schedule_templates')
    op.drop_table('schedule_templates')
