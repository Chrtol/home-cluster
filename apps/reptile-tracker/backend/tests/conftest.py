"""
Test configuration and fixtures for reptile-tracker backend tests.

Provides async database session fixtures with transaction rollback for test isolation.
"""
import pytest
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.database import Base
from app.models import User, Reptile, Schedule, ScheduleInstance, ScheduleMode


# Test database URL - uses in-memory SQLite for fast tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
async def engine():
    """Create async engine for tests."""
    test_engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True,
    )

    # Create all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield test_engine

    # Cleanup
    await test_engine.dispose()


@pytest.fixture
async def db_session(engine):
    """
    Provide a transactional database session for each test.

    Uses savepoint pattern to rollback all changes after test completes.
    This ensures test isolation without recreating the entire database.
    """
    # Create session factory with savepoint support
    async_session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint"
    )

    async with async_session_factory() as session:
        async with session.begin():
            # Yield session to test
            yield session
            # Automatic rollback happens when context exits


@pytest.fixture
async def user(db_session):
    """Create a test user."""
    test_user = User(
        oidc_sub="test_user_123",
        email="test@example.com",
        name="Test User",
        timezone="America/New_York",
    )
    db_session.add(test_user)
    await db_session.flush()
    await db_session.refresh(test_user)
    return test_user


@pytest.fixture
async def reptile(db_session, user):
    """Create a test reptile."""
    test_reptile = Reptile(
        name="Smaug",
        species="Bearded Dragon",
        date_of_birth=datetime(2023, 1, 15, tzinfo=timezone.utc),
        is_active=True,
    )
    db_session.add(test_reptile)
    await db_session.flush()
    await db_session.refresh(test_reptile)
    return test_reptile


@pytest.fixture
async def interval_schedule(db_session, reptile):
    """Create an interval-mode feeding schedule."""
    schedule = Schedule(
        reptile_id=reptile.id,
        name="Every 3 days feeding",
        schedule_type="feeding",
        schedule_mode=ScheduleMode.INTERVAL,
        min_days_between=2,
        max_days_between=4,
        notifications_enabled=True,
    )
    db_session.add(schedule)
    await db_session.flush()
    await db_session.refresh(schedule)
    return schedule
