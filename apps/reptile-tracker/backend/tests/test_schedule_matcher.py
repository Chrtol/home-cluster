"""
Regression tests for schedule matcher instance drift bug (BUG-01).

These tests verify that all three activity handlers (feeding, misting, weighing)
correctly update ScheduleInstance.scheduled_date when a user completes an
interval schedule on a different date than originally scheduled.

Bug history: The feeding handler initially did not update scheduled_date,
causing instance drift where historical displays showed wrong dates.
The misting and weighing handlers had the correct behavior from the start.

This test suite prevents regression by testing all three handlers.
"""
from datetime import datetime, date, timezone
from app.models import (
    ScheduleInstance,
    Feeding,
    MistingLog,
    WeightLog,
    Schedule,
    ScheduleMode,
)
from app.schedule_matcher import (
    assign_feeding_to_schedule,
    assign_misting_to_schedule,
    assign_weighing_to_schedule,
)


async def test_interval_feeding_updates_instance_date(db_session, reptile, user):
    """
    REGRESSION TEST for BUG-01: Feeding handler must update instance date.

    When a user completes an interval schedule feeding on a different date
    than the pending instance was scheduled for, the instance's scheduled_date
    must be updated to the actual completion date.

    This prevents historical displays from showing the wrong date.
    """
    # Create interval feeding schedule
    schedule = Schedule(
        reptile_id=reptile.id,
        name="Interval feeding",
        schedule_type="feeding",
        schedule_mode=ScheduleMode.INTERVAL,
        min_days_between=2,
        max_days_between=4,
    )
    db_session.add(schedule)
    await db_session.flush()

    # Create pending instance for Feb 5
    original_date = date(2026, 2, 5)
    instance = ScheduleInstance(
        schedule_id=schedule.id,
        scheduled_date=original_date,
        status="pending",
    )
    db_session.add(instance)
    await db_session.flush()
    instance_id_before = instance.id

    # User completes feeding on Feb 7 (different from scheduled date)
    actual_date = date(2026, 2, 7)
    feeding = Feeding(
        reptile_id=reptile.id,
        user_id=user.id,
        fed_at=datetime(2026, 2, 7, 14, 30, tzinfo=timezone.utc),
    )
    db_session.add(feeding)
    await db_session.flush()

    # Assign feeding to schedule
    completion = await assign_feeding_to_schedule(db_session, feeding)

    # Verify completion was created
    assert completion is not None
    assert completion.schedule_id == schedule.id

    # CRITICAL: Verify instance date was updated to actual completion date
    await db_session.refresh(instance)
    assert instance.scheduled_date == actual_date, (
        f"Instance scheduled_date should be updated to actual completion date {actual_date}, "
        f"but got {instance.scheduled_date}"
    )
    assert instance.status == "completed"
    assert instance.id == instance_id_before  # Same instance, not a new one


async def test_interval_misting_updates_instance_date(db_session, reptile, user):
    """
    Reference test: Misting handler correctly updates instance date.

    This test documents the CORRECT behavior that the feeding handler
    was updated to match. The misting handler had this behavior from the start.
    """
    # Create interval misting schedule
    schedule = Schedule(
        reptile_id=reptile.id,
        name="Interval misting",
        schedule_type="misting",
        schedule_mode=ScheduleMode.INTERVAL,
        min_days_between=1,
        max_days_between=2,
    )
    db_session.add(schedule)
    await db_session.flush()

    # Create pending instance for Feb 5
    original_date = date(2026, 2, 5)
    instance = ScheduleInstance(
        schedule_id=schedule.id,
        scheduled_date=original_date,
        status="pending",
    )
    db_session.add(instance)
    await db_session.flush()
    instance_id_before = instance.id

    # User completes misting on Feb 6 (different from scheduled date)
    actual_date = date(2026, 2, 6)
    misting = MistingLog(
        reptile_id=reptile.id,
        logged_by_user_id=user.id,
        misted_at=datetime(2026, 2, 6, 9, 15, tzinfo=timezone.utc),
    )
    db_session.add(misting)
    await db_session.flush()

    # Assign misting to schedule
    completion = await assign_misting_to_schedule(db_session, misting)

    # Verify completion was created
    assert completion is not None
    assert completion.schedule_id == schedule.id

    # Verify instance date was updated to actual completion date
    await db_session.refresh(instance)
    assert instance.scheduled_date == actual_date, (
        f"Instance scheduled_date should be updated to actual completion date {actual_date}, "
        f"but got {instance.scheduled_date}"
    )
    assert instance.status == "completed"
    assert instance.id == instance_id_before


async def test_interval_weighing_updates_instance_date(db_session, reptile, user):
    """
    Reference test: Weighing handler correctly updates instance date.

    This test documents the CORRECT behavior that the feeding handler
    was updated to match. The weighing handler had this behavior from the start.
    """
    # Create interval weighing schedule
    schedule = Schedule(
        reptile_id=reptile.id,
        name="Interval weighing",
        schedule_type="weighing",
        schedule_mode=ScheduleMode.INTERVAL,
        min_days_between=5,
        max_days_between=9,
    )
    db_session.add(schedule)
    await db_session.flush()

    # Create pending instance for Feb 5
    original_date = date(2026, 2, 5)
    instance = ScheduleInstance(
        schedule_id=schedule.id,
        scheduled_date=original_date,
        status="pending",
    )
    db_session.add(instance)
    await db_session.flush()
    instance_id_before = instance.id

    # User completes weighing on Feb 8 (different from scheduled date)
    actual_date = date(2026, 2, 8)
    weight_log = WeightLog(
        reptile_id=reptile.id,
        logged_by_user_id=user.id,
        weight_grams=450.5,
        measured_at=datetime(2026, 2, 8, 16, 45, tzinfo=timezone.utc),
    )
    db_session.add(weight_log)
    await db_session.flush()

    # Assign weighing to schedule
    completion = await assign_weighing_to_schedule(db_session, weight_log)

    # Verify completion was created
    assert completion is not None
    assert completion.schedule_id == schedule.id

    # Verify instance date was updated to actual completion date
    await db_session.refresh(instance)
    assert instance.scheduled_date == actual_date, (
        f"Instance scheduled_date should be updated to actual completion date {actual_date}, "
        f"but got {instance.scheduled_date}"
    )
    assert instance.status == "completed"
    assert instance.id == instance_id_before
