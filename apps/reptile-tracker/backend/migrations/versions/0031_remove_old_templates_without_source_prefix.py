"""Remove old templates with outdated naming conventions

Revision ID: 0031
Revises: 0030
Create Date: 2025-01-06
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0031'
down_revision = '0030'
branch_labels = None
depends_on = None


def upgrade():
    # Delete old template names that have been replaced with better naming
    # These old templates used inconsistent naming like "Daily Salad" instead of "Daily Vegetables"
    # or "Every Other Day Feeding" instead of just "Feeding"

    # First, verify that replacement templates exist before deleting old ones
    # This ensures we don't accidentally remove templates without replacements
    op.execute("""
        DO $$
        DECLARE
            missing_replacements TEXT[];
        BEGIN
            -- Check for missing replacement templates
            SELECT ARRAY_AGG(replacement)
            INTO missing_replacements
            FROM (VALUES
                ('ReptiFiles - Adult Bearded Dragon Insects'),
                ('ReptiFiles - Adult Bearded Dragon Vegetables'),
                ('ReptiFiles - Juvenile Bearded Dragon Daily Insects'),
                ('ReptiFiles - Juvenile Bearded Dragon Daily Vegetables'),
                ('ReptiFiles - Adult Leopard Gecko Feeding'),
                ('Juvenile - Weekly Weighing'),
                ('Adult - Monthly Weighing')
            ) AS replacements(replacement)
            WHERE NOT EXISTS (
                SELECT 1 FROM schedule_templates
                WHERE name = replacements.replacement
                AND is_default = true
            );

            -- Raise error if any replacements are missing
            IF array_length(missing_replacements, 1) > 0 THEN
                RAISE EXCEPTION 'Cannot delete old templates - missing replacements: %',
                    array_to_string(missing_replacements, ', ');
            END IF;
        END $$;
    """)

    # Now safe to delete old templates since we verified replacements exist
    op.execute("""
        DELETE FROM schedule_templates
        WHERE is_default = true
        AND name IN (
            -- Old Bearded Dragon templates (replaced by better naming)
            'ReptiFiles - Adult Bearded Dragon Insects (Every Other Day)',  -- replaced by: Insects
            'ReptiFiles - Adult Bearded Dragon Daily Salad',                 -- replaced by: Vegetables
            'ReptiFiles - Juvenile Bearded Dragon Daily Feeding',            -- replaced by: Daily Insects
            'ReptiFiles - Juvenile Bearded Dragon Daily Salad',              -- replaced by: Daily Vegetables

            -- Even older templates without ReptiFiles prefix
            'Juvenile Bearded Dragon Daily Feeding',                         -- replaced by: ReptiFiles - Juvenile Bearded Dragon Daily Insects
            'Juvenile Bearded Dragon Daily Salad',                           -- replaced by: ReptiFiles - Juvenile Bearded Dragon Daily Vegetables
            'Adult Bearded Dragon Insects',                                  -- replaced by: ReptiFiles - Adult Bearded Dragon Insects
            'Adult Bearded Dragon Daily Salad',                              -- replaced by: ReptiFiles - Adult Bearded Dragon Vegetables

            -- Old Leopard Gecko templates (replaced by simpler naming)
            'ReptiFiles - Adult Leopard Gecko Every Other Day Feeding',      -- replaced by: Feeding

            -- Old general weighing templates (replaced by dash format)
            'Juvenile Weekly Weighing (General)',                            -- replaced by: Juvenile - Weekly Weighing
            'Adult Monthly Weighing (General)'                               -- replaced by: Adult - Monthly Weighing
        )
    """)


def downgrade():
    # No downgrade path - the old templates with outdated naming were duplicates
    # and should not be restored
    pass
