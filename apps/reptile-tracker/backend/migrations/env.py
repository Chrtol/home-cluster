import asyncio
import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from app.config import settings
from app.database import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# Provide 'sys' to the logging config defaults so expressions like
# "args = (sys.stderr,)" in alembic.ini can be evaluated.
fileConfig(config.config_file_name, defaults={"sys": sys})

# Set the SQLAlchemy URL from settings
# Alembic expects a sync driver, convert async url if necessary
sqlalchemy_url = settings.database_url
if sqlalchemy_url.startswith('postgresql+asyncpg'):
    sqlalchemy_url = sqlalchemy_url.replace('+asyncpg', '')

config.set_main_option('sqlalchemy.url', sqlalchemy_url)


def run_migrations_offline():
    context.configure(url=sqlalchemy_url, target_metadata=Base.metadata, literal_binds=True)

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
