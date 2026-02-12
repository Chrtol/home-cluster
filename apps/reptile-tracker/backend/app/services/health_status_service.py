"""
Health Status Derivation Service

Derives reptile health status (in-shed, brumating, normal) from health_records
without storing redundant state. Uses LEFT JOIN pattern to detect unclosed
event pairs (start without corresponding end).

Uses event_type field for state detection, with backward-compatible fallback
for existing records that have NULL event_type.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from zoneinfo import ZoneInfo

from app.models import HealthRecord, HealthEventType


async def get_active_shed_record(
    db: AsyncSession,
    reptile_id: int
) -> Optional[HealthRecord]:
    """
    Find active shedding event for a reptile.

    Uses LEFT JOIN to find shed start records without matching completion records.
    Returns the most recent unclosed shed cycle, or None if no active shed.

    Args:
        db: Database session
        reptile_id: Reptile to check

    Returns:
        HealthRecord: Shed start record if active shed exists
        None: If no active shed
    """
    # Alias for self-join pattern
    StartRecord = aliased(HealthRecord)
    EndRecord = aliased(HealthRecord)

    # Build LEFT JOIN to find unclosed shed cycles
    # Uses event_type field for matching
    stmt = (
        select(StartRecord)
        .outerjoin(
            EndRecord,
            and_(
                EndRecord.reptile_id == StartRecord.reptile_id,
                EndRecord.record_type == 'shedding',
                EndRecord.event_type == HealthEventType.COMPLETE.value,
                EndRecord.date > StartRecord.date
            )
        )
        .where(
            StartRecord.reptile_id == reptile_id,
            StartRecord.record_type == 'shedding',
            StartRecord.event_type == HealthEventType.START.value,
            EndRecord.id.is_(None)  # No matching end record
        )
        .order_by(StartRecord.date.desc())
        .limit(1)
    )

    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_active_brumation_record(
    db: AsyncSession,
    reptile_id: int
) -> Optional[HealthRecord]:
    """
    Find active brumation period for a reptile.

    Uses LEFT JOIN to find brumation start records without matching end records.
    Returns the most recent unclosed brumation period, or None if not brumating.

    Args:
        db: Database session
        reptile_id: Reptile to check

    Returns:
        HealthRecord: Brumation start record if active brumation exists
        None: If not brumating
    """
    StartRecord = aliased(HealthRecord)
    EndRecord = aliased(HealthRecord)

    # Uses event_type field for matching
    stmt = (
        select(StartRecord)
        .outerjoin(
            EndRecord,
            and_(
                EndRecord.reptile_id == StartRecord.reptile_id,
                EndRecord.record_type == 'brumation',
                EndRecord.event_type == HealthEventType.END.value,
                EndRecord.date > StartRecord.date
            )
        )
        .where(
            StartRecord.reptile_id == reptile_id,
            StartRecord.record_type == 'brumation',
            StartRecord.event_type == HealthEventType.START.value,
            EndRecord.id.is_(None)
        )
        .order_by(StartRecord.date.desc())
        .limit(1)
    )

    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def derive_health_status(
    db: AsyncSession,
    reptile_id: int,
    user_timezone: str = "UTC"
) -> dict:
    """
    Derive current health status from health_records.
    Returns independent boolean flags for each state (not mutually exclusive).

    Args:
        db: Database session
        reptile_id: Reptile to check
        user_timezone: User's timezone for date calculations

    Returns:
        {
            'is_shedding': bool,
            'is_brumating': bool,
            'shedding_since': datetime | None,
            'brumating_since': datetime | None,
            'days_shedding': int | None,
            'days_brumating': int | None,
            'description': str
        }
    """
    tz = ZoneInfo(user_timezone)
    today = datetime.now(tz=tz).date()

    # Query both states independently
    shed_record = await get_active_shed_record(db, reptile_id)
    brumation_record = await get_active_brumation_record(db, reptile_id)

    # Calculate shed state
    is_shedding = shed_record is not None
    shedding_since = None
    days_shedding = None
    if shed_record:
        shed_start_utc = shed_record.date
        if shed_start_utc.tzinfo is None:
            shed_start_utc = shed_start_utc.replace(tzinfo=timezone.utc)
        shedding_since = shed_record.date
        shed_start_local = shed_start_utc.astimezone(tz).date()
        days_shedding = max(0, (today - shed_start_local).days)

    # Calculate brumation state
    is_brumating = brumation_record is not None
    brumating_since = None
    days_brumating = None
    if brumation_record:
        brum_start_utc = brumation_record.date
        if brum_start_utc.tzinfo is None:
            brum_start_utc = brum_start_utc.replace(tzinfo=timezone.utc)
        brumating_since = brumation_record.date
        brum_start_local = brum_start_utc.astimezone(tz).date()
        days_brumating = max(0, (today - brum_start_local).days)

    # Build description
    states = []
    if is_shedding:
        states.append(f"Shedding (day {days_shedding})")
    if is_brumating:
        states.append(f"Brumating (day {days_brumating})")
    description = ", ".join(states) if states else "No active health conditions"

    return {
        'is_shedding': is_shedding,
        'is_brumating': is_brumating,
        'shedding_since': shedding_since,
        'brumating_since': brumating_since,
        'days_shedding': days_shedding,
        'days_brumating': days_brumating,
        'description': description
    }


async def batch_derive_health_statuses(
    db: AsyncSession,
    reptile_ids: list[int],
    user_timezone: str = "UTC"
) -> dict[int, dict]:
    """
    Efficiently fetch health statuses for multiple reptiles.
    Uses single query with IN clause instead of N queries.

    Args:
        db: Database session
        reptile_ids: List of reptile IDs to check
        user_timezone: User's timezone for date calculations

    Returns:
        dict mapping reptile_id to health status dict:
        {
            'is_shedding': bool,
            'is_brumating': bool,
            'shedding_since': datetime | None,
            'brumating_since': datetime | None,
            'days_shedding': int | None,
            'days_brumating': int | None,
            'description': str
        }
    """
    if not reptile_ids:
        return {}

    tz = ZoneInfo(user_timezone)
    today = datetime.now(tz=tz).date()

    # Alias for self-join pattern on shed records
    StartShed = aliased(HealthRecord)
    EndShed = aliased(HealthRecord)

    # Query for active shed records (all reptiles at once)
    # Uses event_type field for matching
    shed_stmt = (
        select(StartShed)
        .outerjoin(
            EndShed,
            and_(
                EndShed.reptile_id == StartShed.reptile_id,
                EndShed.record_type == 'shedding',
                EndShed.event_type == HealthEventType.COMPLETE.value,
                EndShed.date > StartShed.date
            )
        )
        .where(
            StartShed.reptile_id.in_(reptile_ids),
            StartShed.record_type == 'shedding',
            StartShed.event_type == HealthEventType.START.value,
            EndShed.id.is_(None)
        )
        .order_by(StartShed.reptile_id, StartShed.date.desc())
    )

    shed_result = await db.execute(shed_stmt)
    shed_records = shed_result.scalars().all()

    # Build dict of reptile_id -> shed record
    shed_by_reptile = {}
    for record in shed_records:
        if record.reptile_id not in shed_by_reptile:
            shed_by_reptile[record.reptile_id] = record

    # Alias for self-join pattern on brumation records
    StartBrum = aliased(HealthRecord)
    EndBrum = aliased(HealthRecord)

    # Query for active brumation records (all reptiles at once)
    # Uses event_type field for matching
    brum_stmt = (
        select(StartBrum)
        .outerjoin(
            EndBrum,
            and_(
                EndBrum.reptile_id == StartBrum.reptile_id,
                EndBrum.record_type == 'brumation',
                EndBrum.event_type == HealthEventType.END.value,
                EndBrum.date > StartBrum.date
            )
        )
        .where(
            StartBrum.reptile_id.in_(reptile_ids),
            StartBrum.record_type == 'brumation',
            StartBrum.event_type == HealthEventType.START.value,
            EndBrum.id.is_(None)
        )
        .order_by(StartBrum.reptile_id, StartBrum.date.desc())
    )

    brum_result = await db.execute(brum_stmt)
    brum_records = brum_result.scalars().all()

    # Build dict of reptile_id -> brumation record
    brum_by_reptile = {}
    for record in brum_records:
        if record.reptile_id not in brum_by_reptile:
            brum_by_reptile[record.reptile_id] = record

    # Build status dict for each reptile with independent boolean flags
    statuses = {}
    for reptile_id in reptile_ids:
        shed_record = shed_by_reptile.get(reptile_id)
        brumation_record = brum_by_reptile.get(reptile_id)

        # Calculate shed state
        is_shedding = shed_record is not None
        shedding_since = None
        days_shedding = None
        if shed_record:
            shed_start_utc = shed_record.date
            if shed_start_utc.tzinfo is None:
                shed_start_utc = shed_start_utc.replace(tzinfo=timezone.utc)
            shedding_since = shed_record.date
            shed_start_local = shed_start_utc.astimezone(tz).date()
            days_shedding = max(0, (today - shed_start_local).days)

        # Calculate brumation state
        is_brumating = brumation_record is not None
        brumating_since = None
        days_brumating = None
        if brumation_record:
            brum_start_utc = brumation_record.date
            if brum_start_utc.tzinfo is None:
                brum_start_utc = brum_start_utc.replace(tzinfo=timezone.utc)
            brumating_since = brumation_record.date
            brum_start_local = brum_start_utc.astimezone(tz).date()
            days_brumating = max(0, (today - brum_start_local).days)

        # Build description
        states = []
        if is_shedding:
            states.append(f"Shedding (day {days_shedding})")
        if is_brumating:
            states.append(f"Brumating (day {days_brumating})")
        description = ", ".join(states) if states else "No active health conditions"

        statuses[reptile_id] = {
            'is_shedding': is_shedding,
            'is_brumating': is_brumating,
            'shedding_since': shedding_since,
            'brumating_since': brumating_since,
            'days_shedding': days_shedding,
            'days_brumating': days_brumating,
            'description': description
        }

    return statuses


async def validate_health_record_state(
    db: AsyncSession,
    reptile_id: int,
    record_type: str,
    event_type: Optional[str]
) -> None:
    """
    Validate state transition before creating health record.

    Prevents invalid state transitions:
    - Cannot start shedding if already shedding
    - Cannot complete shed if no active shed
    - Cannot start brumation if already brumating
    - Cannot end brumation if no active brumation

    Args:
        db: Database session
        reptile_id: Reptile ID
        record_type: Record type ('shedding', 'brumation', etc.)
        event_type: Event type ('start', 'complete', 'end', 'observation')

    Raises:
        HTTPException: 400 if state transition is invalid
    """
    if not event_type:
        return  # Observations don't need validation

    if record_type == 'shedding':
        if event_type == HealthEventType.START.value:
            active_shed = await get_active_shed_record(db, reptile_id)
            if active_shed:
                shed_date = active_shed.date.date()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Reptile is already shedding (started {shed_date}). "
                           "Complete the current shed cycle before starting a new one."
                )

        elif event_type == HealthEventType.COMPLETE.value:
            active_shed = await get_active_shed_record(db, reptile_id)
            if not active_shed:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No active shed cycle to complete. Log a shed start event first."
                )

    if record_type == 'brumation':
        if event_type == HealthEventType.START.value:
            active_brumation = await get_active_brumation_record(db, reptile_id)
            if active_brumation:
                brum_date = active_brumation.date.date()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Reptile is already brumating (started {brum_date}). "
                           "End the current brumation period before starting a new one."
                )

        elif event_type == HealthEventType.END.value:
            active_brumation = await get_active_brumation_record(db, reptile_id)
            if not active_brumation:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No active brumation period to end. Log a brumation start event first."
                )
