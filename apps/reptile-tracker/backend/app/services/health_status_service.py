"""
Health Status Derivation Service

Derives reptile health status (in-shed, brumating, normal) from health_records
without storing redundant state. Uses LEFT JOIN pattern to detect unclosed
event pairs (start without corresponding end).
"""

from datetime import datetime
from enum import IntEnum
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from zoneinfo import ZoneInfo

from app.models import HealthRecord


class HealthStatusPriority(IntEnum):
    """Priority levels for health statuses (lower = higher priority)"""
    CRITICAL = 1  # Future: vet visit, emergency, injury
    BRUMATING = 2  # Hibernation state
    SHEDDING = 3   # Active shed cycle
    NORMAL = 4     # Default state


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
    stmt = (
        select(StartRecord)
        .outerjoin(
            EndRecord,
            and_(
                EndRecord.reptile_id == StartRecord.reptile_id,
                EndRecord.record_type == 'shedding',
                EndRecord.title.ilike('%complete%'),
                EndRecord.date > StartRecord.date
            )
        )
        .where(
            StartRecord.reptile_id == reptile_id,
            StartRecord.record_type == 'shedding',
            StartRecord.title.ilike('%start%'),
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

    stmt = (
        select(StartRecord)
        .outerjoin(
            EndRecord,
            and_(
                EndRecord.reptile_id == StartRecord.reptile_id,
                EndRecord.record_type == 'brumation',
                EndRecord.title.ilike('%end%'),
                EndRecord.date > StartRecord.date
            )
        )
        .where(
            StartRecord.reptile_id == reptile_id,
            StartRecord.record_type == 'brumation',
            StartRecord.title.ilike('%start%'),
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

    Returns highest priority active status with metadata.
    Priority hierarchy: Critical > Brumating > Shedding > Normal

    Args:
        db: Database session
        reptile_id: Reptile to check
        user_timezone: User's timezone for date calculations

    Returns:
        {
            'status': 'shedding' | 'brumating' | 'normal',
            'priority': int,
            'active_since': datetime | None,
            'days_in_state': int | None,
            'description': str
        }
    """
    tz = ZoneInfo(user_timezone)
    today = datetime.now(tz=tz).date()

    # Check for critical health issues (future: injury, illness records)
    # Phase 18: Not implemented yet

    # Check for active brumation (higher priority than shedding)
    brumation_record = await get_active_brumation_record(db, reptile_id)
    if brumation_record:
        # Convert to user's timezone for date calculation
        brumation_start_utc = brumation_record.date
        if brumation_start_utc.tzinfo is None:
            # Assume UTC if naive
            from datetime import timezone
            brumation_start_utc = brumation_start_utc.replace(tzinfo=timezone.utc)

        brumation_start_local = brumation_start_utc.astimezone(tz).date()
        days_brumating = (today - brumation_start_local).days

        return {
            'status': 'brumating',
            'priority': HealthStatusPriority.BRUMATING,
            'active_since': brumation_record.date,
            'days_in_state': max(0, days_brumating),
            'description': f'Brumating since {brumation_start_local.isoformat()}'
        }

    # Check for active shedding
    shed_record = await get_active_shed_record(db, reptile_id)
    if shed_record:
        # Convert to user's timezone for date calculation
        shed_start_utc = shed_record.date
        if shed_start_utc.tzinfo is None:
            from datetime import timezone
            shed_start_utc = shed_start_utc.replace(tzinfo=timezone.utc)

        shed_start_local = shed_start_utc.astimezone(tz).date()
        days_shedding = (today - shed_start_local).days

        return {
            'status': 'shedding',
            'priority': HealthStatusPriority.SHEDDING,
            'active_since': shed_record.date,
            'days_in_state': max(0, days_shedding),
            'description': f'Shedding since {shed_start_local.isoformat()}'
        }

    # Default: Normal state
    return {
        'status': 'normal',
        'priority': HealthStatusPriority.NORMAL,
        'active_since': None,
        'days_in_state': None,
        'description': 'No active health conditions'
    }


async def validate_health_record_state(
    db: AsyncSession,
    reptile_id: int,
    record_type: str,
    title: str
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
        title: Record title

    Raises:
        HTTPException: 400 if state transition is invalid
    """
    if record_type == 'shedding':
        if 'start' in title.lower():
            # Check for existing active shed
            active_shed = await get_active_shed_record(db, reptile_id)
            if active_shed:
                shed_date = active_shed.date.date()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Reptile is already shedding (started {shed_date}). "
                           "Complete the current shed cycle before starting a new one."
                )

        elif 'complete' in title.lower():
            # Check for active shed to complete
            active_shed = await get_active_shed_record(db, reptile_id)
            if not active_shed:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No active shed cycle to complete. Log a 'Shed started' event first."
                )

    if record_type == 'brumation':
        if 'start' in title.lower():
            # Check for existing active brumation
            active_brumation = await get_active_brumation_record(db, reptile_id)
            if active_brumation:
                brum_date = active_brumation.date.date()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Reptile is already brumating (started {brum_date}). "
                           "End the current brumation period before starting a new one."
                )

        elif 'end' in title.lower():
            # Check for active brumation to end
            active_brumation = await get_active_brumation_record(db, reptile_id)
            if not active_brumation:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No active brumation period to end. Log a 'Brumation started' event first."
                )
