"""
Export service for data collection and serialization.

Provides:
- DataCollector: Collects reptile data with efficient eager loading
- JSONExportSerializer: Produces JSON with photo URLs
- ZIPExportSerializer: Bundles photos at original quality

Per D-21: Shared data collection layer reusable for future vet export.
"""

import io
import json
import logging
import zipfile
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models
from app.schemas import ExportData, ExportedReptile
from app.storage import PhotoStorageBackend

logger = logging.getLogger(__name__)


class DataCollector:
    """
    Collect reptile data for export with efficient eager loading.

    Per D-21: Shared layer for backup exports and future vet export.
    """

    def __init__(self):
        """Initialize DataCollector. No args needed."""
        pass

    async def collect(
        self,
        db: AsyncSession,
        reptile_ids: List[int],
        household_id: int,
    ) -> ExportData:
        """
        Collect all data for specified reptiles.

        Args:
            db: Database session
            reptile_ids: List of reptile IDs to export
            household_id: Household ID for permission verification

        Returns:
            ExportData instance with all reptile data
        """
        # Query reptiles with all relationships using selectinload
        result = await db.execute(
            select(models.Reptile)
            .where(
                models.Reptile.id.in_(reptile_ids),
                models.Reptile.household_id == household_id,
            )
            .options(
                # Feedings with foods and supplements
                selectinload(models.Reptile.feedings).selectinload(models.Feeding.foods),
                selectinload(models.Reptile.feedings).selectinload(models.Feeding.supplements),
                # Weight logs
                selectinload(models.Reptile.weight_logs),
                # Health records
                selectinload(models.Reptile.health_records),
                # Misting logs
                selectinload(models.Reptile.misting_logs),
                # Schedules with notification channels
                selectinload(models.Reptile.schedules).selectinload(models.Schedule.notification_channels),
                # Photos
                selectinload(models.Reptile.photos),
            )
        )
        reptiles = result.scalars().all()

        # Get household name for source_household field
        household = await db.get(models.Household, household_id)
        source_household = household.name if household else f"Household {household_id}"

        # Collect household-level data
        foods = await self._collect_foods(db)
        supplements = await self._collect_supplements(db)
        notification_templates = await self._collect_notification_templates(db, household_id)

        # Serialize reptiles
        exported_reptiles = []
        for reptile in reptiles:
            exported_reptile = self._serialize_reptile(reptile)
            exported_reptiles.append(exported_reptile)

        return ExportData(
            version="1.0",
            exported_at=datetime.now(timezone.utc),
            source_household=source_household,
            reptiles=exported_reptiles,
            foods=foods,
            supplements=supplements,
            notification_templates=notification_templates,
        )

    def _serialize_reptile(self, reptile: models.Reptile) -> ExportedReptile:
        """Serialize a single reptile with all related data."""
        # Serialize feedings
        feedings = []
        for feeding in reptile.feedings:
            feeding_dict = {
                "fed_at": feeding.fed_at.isoformat() if feeding.fed_at else None,
                "notes": feeding.notes,
                "is_salad": feeding.is_salad,
                "foods": [
                    {"id": f.id, "name": f.name, "category": f.category.value if f.category else None}
                    for f in feeding.foods
                ],
                "supplements": [s.name for s in feeding.supplements],
            }
            feedings.append(feeding_dict)

        # Serialize weight logs
        weight_logs = []
        for log in reptile.weight_logs:
            weight_logs.append({
                "weight_grams": log.weight_grams,
                "measured_at": log.measured_at.isoformat() if log.measured_at else None,
                "notes": log.notes,
            })

        # Serialize health records
        health_records = []
        for record in reptile.health_records:
            health_records.append({
                "record_type": record.record_type,
                "title": record.title,
                "description": record.description,
                "event_type": record.event_type,
                "date": record.date.isoformat() if record.date else None,
            })

        # Serialize misting logs
        misting_logs = []
        for log in reptile.misting_logs:
            misting_logs.append({
                "misted_at": log.misted_at.isoformat() if log.misted_at else None,
                "notes": log.notes,
            })

        # Serialize schedules
        schedules = []
        for schedule in reptile.schedules:
            schedule_dict = {
                "name": schedule.name,
                "schedule_type": schedule.schedule_type,
                "schedule_mode": schedule.schedule_mode.value if hasattr(schedule.schedule_mode, 'value') else schedule.schedule_mode,
                "schedule_rule": schedule.schedule_rule,
                "frequency_days": schedule.frequency_days,
                "days_of_week": schedule.days_of_week,
                "earliest_time": schedule.earliest_time.isoformat() if schedule.earliest_time else None,
                "latest_time": schedule.latest_time.isoformat() if schedule.latest_time else None,
                "time_window_enabled": schedule.time_window_enabled,
                "enabled": schedule.enabled,
                "notes": schedule.notes,
            }
            schedules.append(schedule_dict)

        # Serialize photos
        photos = []
        for photo in reptile.photos:
            photos.append({
                "id": str(photo.id),
                "category": photo.category,
                "caption": photo.caption,
                "taken_at": photo.taken_at.isoformat() if photo.taken_at else None,
                "file_path": photo.file_path,
                "url": f"/api/photos/serve/{photo.file_path}" if photo.file_path else None,
            })

        return ExportedReptile(
            name=reptile.name,
            species=reptile.species,
            date_of_birth=reptile.date_of_birth,
            notes=reptile.notes,
            feeding_schedule_enabled=reptile.feeding_schedule_enabled,
            is_active=reptile.is_active,
            feedings=feedings,
            weight_logs=weight_logs,
            health_records=health_records,
            misting_logs=misting_logs,
            schedules=schedules,
            photos=photos,
        )

    async def _collect_foods(self, db: AsyncSession) -> List[dict]:
        """Collect all custom foods (non-default)."""
        result = await db.execute(
            select(models.Food).where(models.Food.is_default == False)
        )
        foods = result.scalars().all()
        return [
            {
                "name": f.name,
                "category": f.category.value if f.category else None,
                "insect_size": f.insect_size.value if f.insect_size else None,
                "nutritional_data": f.nutritional_data,
            }
            for f in foods
        ]

    async def _collect_supplements(self, db: AsyncSession) -> List[dict]:
        """Collect all custom supplements (non-default)."""
        result = await db.execute(
            select(models.Supplement).where(models.Supplement.is_default == False)
        )
        supplements = result.scalars().all()
        return [
            {
                "name": s.name,
                "nutritional_data": s.nutritional_data,
            }
            for s in supplements
        ]

    async def _collect_notification_templates(
        self, db: AsyncSession, household_id: int
    ) -> Optional[List[dict]]:
        """
        Collect notification templates for users in this household.

        Per D-11: Only custom templates, not system defaults.
        """
        # Get user IDs in household
        result = await db.execute(
            select(models.household_members.c.user_id).where(
                models.household_members.c.household_id == household_id
            )
        )
        user_ids = [row[0] for row in result.fetchall()]

        if not user_ids:
            return None

        # Get custom templates for these users
        result = await db.execute(
            select(models.NotificationTemplate).where(
                models.NotificationTemplate.user_id.in_(user_ids),
                models.NotificationTemplate.template_type == "custom",
            )
        )
        templates = result.scalars().all()

        if not templates:
            return None

        return [
            {
                "name": t.name,
                "trigger_type": t.trigger_type,
                "message_template_short": t.message_template_short,
                "message_template_long": t.message_template_long,
                "title_template": t.title_template,
                "priority": t.priority,
            }
            for t in templates
        ]


class JSONExportSerializer:
    """
    Serialize export data to JSON with photo URLs.

    Per D-01: JSON + photo links format for same-instance restore.
    """

    def __init__(self):
        """Initialize JSONExportSerializer. No args needed."""
        pass

    def serialize(self, data: ExportData) -> bytes:
        """
        Return JSON bytes with photo URLs (not embedded).

        Args:
            data: ExportData instance to serialize

        Returns:
            UTF-8 encoded JSON bytes
        """
        return data.model_dump_json(indent=2).encode('utf-8')


class ZIPExportSerializer:
    """
    Serialize export data to ZIP bundle with embedded photos.

    Per D-01, D-03: ZIP bundle with photos at original quality for
    external migration/backup.
    """

    def __init__(self, storage: PhotoStorageBackend):
        """
        Initialize ZIPExportSerializer.

        Args:
            storage: Storage backend for retrieving photos
        """
        self.storage = storage

    async def serialize(self, data: ExportData) -> bytes:
        """
        Return ZIP bytes with photos and manifest.

        Args:
            data: ExportData instance to serialize

        Returns:
            ZIP file bytes containing manifest.json and photos/
        """
        buffer = io.BytesIO()

        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Deep copy data for modification
            export_dict = data.model_dump()

            # Collect all photos and update references to bundle paths
            for reptile in export_dict["reptiles"]:
                for photo in reptile["photos"]:
                    if photo.get("file_path"):
                        original_path = photo["file_path"]
                        photo_id = photo.get("id", "unknown")
                        # Determine extension from file path
                        ext = original_path.rsplit(".", 1)[-1] if "." in original_path else "jpg"
                        bundle_path = f"photos/{photo_id}.{ext}"

                        try:
                            # Retrieve photo from storage (original quality per D-03)
                            photo_bytes = await self.storage.get_photo(original_path)
                            zf.writestr(bundle_path, photo_bytes)
                            logger.debug(f"Added photo to ZIP: {bundle_path}")
                        except FileNotFoundError:
                            logger.warning(f"Photo not found during export: {original_path}")
                            bundle_path = None
                        except Exception as e:
                            logger.error(f"Error retrieving photo {original_path}: {e}")
                            bundle_path = None

                        # Update photo reference to bundle path
                        photo["bundle_path"] = bundle_path
                        # Remove URL since photos are embedded
                        photo["url"] = None

            # Write manifest.json
            manifest_json = json.dumps(export_dict, indent=2, default=str)
            zf.writestr("manifest.json", manifest_json)
            logger.debug("Added manifest.json to ZIP")

        return buffer.getvalue()
