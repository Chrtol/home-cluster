"""populate template source urls

Revision ID: 0025
Revises: 0024
Create Date: 2025-01-26

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0025'
down_revision = '0024'
branch_labels = None
depends_on = None


def upgrade():
    # Update ReptiFiles templates with species-specific URLs
    op.execute("""
        UPDATE schedule_templates
        SET
            source_name = 'ReptiFiles',
            source_url = CASE
                WHEN species = 'Bearded Dragon' THEN 'https://reptifiles.com/bearded-dragon-care/'
                WHEN species = 'Leopard Gecko' THEN 'https://reptifiles.com/leopard-gecko-care/'
                WHEN species = 'Crested Gecko' THEN 'https://reptifiles.com/crested-gecko-care/'
                WHEN species = 'Ball Python' THEN 'https://reptifiles.com/ball-python-care/'
                WHEN species = 'Corn Snake' THEN 'https://reptifiles.com/corn-snake-care/'
                WHEN species = 'Blue Tongue Skink' THEN 'https://reptifiles.com/blue-tongue-skink-care/'
                ELSE 'https://reptifiles.com/'
            END
        WHERE name LIKE 'ReptiFiles %'
        AND is_default = true;
    """)

    # Update The Bio Dude templates
    op.execute("""
        UPDATE schedule_templates
        SET
            source_name = 'The Bio Dude',
            source_url = 'https://www.thebiodude.com/blogs/reptile-care-guides'
        WHERE name LIKE 'The Bio Dude %'
        AND is_default = true;
    """)

    # Update Reptile Magazine templates
    op.execute("""
        UPDATE schedule_templates
        SET
            source_name = 'Reptile Magazine',
            source_url = 'https://reptilemag.com/'
        WHERE name LIKE 'Reptile Magazine %'
        AND is_default = true;
    """)


def downgrade():
    # Clear source URLs
    op.execute("""
        UPDATE schedule_templates
        SET source_name = NULL, source_url = NULL
        WHERE is_default = true;
    """)
