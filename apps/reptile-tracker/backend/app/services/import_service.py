"""
Import Service for parsing, previewing, and committing imports.

Handles:
- JSON and ZIP file parsing with validation
- Preview generation with conflict detection (D-08: auto-rename duplicates)
- Template merge strategy (D-11: only import for new trigger types)
- Atomic commit with transaction rollback (D-12)
"""

import json
import zipfile
import io
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app import models, schemas


class ImportService:
    """Service for parsing, previewing, and committing imports."""

    async def parse_file(self, file_content: bytes, filename: str) -> schemas.ExportData:
        """
        Parse export file (JSON or ZIP) into ExportData structure.
        Raises ValueError if format invalid.
        """
        if filename.endswith('.zip'):
            return self._parse_zip(file_content)
        elif filename.endswith('.json'):
            return self._parse_json(file_content)
        else:
            raise ValueError("Unsupported file format. Use .json or .zip")

    def _parse_json(self, content: bytes) -> schemas.ExportData:
        """Parse JSON export file."""
        try:
            data = json.loads(content.decode('utf-8'))
            return schemas.ExportData(**data)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON: {e}")
        except Exception as e:
            raise ValueError(f"Invalid export data structure: {e}")

    def _parse_zip(self, content: bytes) -> schemas.ExportData:
        """Parse ZIP bundle, extract manifest.json."""
        try:
            buffer = io.BytesIO(content)
            with zipfile.ZipFile(buffer, 'r') as zf:
                # Check for zip bomb per RESEARCH.md security (T-34-06)
                total_size = sum(info.file_size for info in zf.infolist())
                if total_size > 1024 * 1024 * 1024:  # 1GB limit
                    raise ValueError("Export file too large (>1GB uncompressed)")

                # Check for path traversal (T-34-07)
                for info in zf.infolist():
                    if '..' in info.filename or info.filename.startswith('/'):
                        raise ValueError("Invalid file path in archive")

                if 'manifest.json' not in zf.namelist():
                    raise ValueError("Invalid ZIP bundle: missing manifest.json")

                manifest_bytes = zf.read('manifest.json')
                data = json.loads(manifest_bytes.decode('utf-8'))
                # Store photos zip content for commit step
                data['_photos_zip'] = content
                return schemas.ExportData(**data)
        except zipfile.BadZipFile:
            raise ValueError("Invalid ZIP file")

    async def generate_preview(
        self,
        db: AsyncSession,
        export_data: schemas.ExportData,
        household_id: int,
        user_id: int,
    ) -> tuple[schemas.ImportPreview, str]:
        """
        Generate preview with conflict detection per D-08, D-11, D-12.
        Returns (preview, preview_token) tuple.
        """
        preview_items = []
        warnings = []
        errors = []
        renamed_reptiles = []

        # Get existing reptile names in household
        result = await db.execute(
            select(models.Reptile.name).where(
                models.Reptile.household_id == household_id
            )
        )
        existing_names = {row[0] for row in result.all()}

        # Check each reptile for conflicts
        for reptile_data in export_data.reptiles:
            original_name = reptile_data.name
            new_name = original_name
            status = "ok"
            message = None

            # Auto-rename duplicates per D-08
            if original_name in existing_names:
                new_name = f"{original_name} (imported)"
                # Keep incrementing if still duplicate
                counter = 2
                while new_name in existing_names:
                    new_name = f"{original_name} (imported {counter})"
                    counter += 1

                renamed_reptiles.append({
                    "original": original_name,
                    "new": new_name
                })
                status = "warning"
                message = f"Will be renamed to '{new_name}'"
                warnings.append(f"Reptile '{original_name}' renamed to '{new_name}'")

            preview_items.append(schemas.ImportPreviewItem(
                type="reptile",
                name=new_name,
                status=status,
                message=message
            ))
            # Add to existing names for subsequent conflict detection
            existing_names.add(new_name)

        # D-11: Check template merge - get user's existing trigger_types
        templates_to_import = 0
        templates_skipped = 0
        if export_data.notification_templates:
            existing_trigger_types = await db.execute(
                select(models.NotificationTemplate.trigger_type).where(
                    models.NotificationTemplate.user_id == user_id
                ).distinct()
            )
            existing_triggers = {row[0] for row in existing_trigger_types.all()}

            for template_data in export_data.notification_templates:
                trigger_type = template_data.get('trigger_type')
                if trigger_type and trigger_type not in existing_triggers:
                    templates_to_import += 1
                else:
                    templates_skipped += 1

            if templates_skipped > 0:
                warnings.append(f"{templates_skipped} templates skipped (trigger types already exist)")

        # Count related records
        schedules_count = sum(len(r.schedules) for r in export_data.reptiles)
        logs_count = sum(
            len(r.feedings) + len(r.weight_logs) + len(r.health_records) + len(r.misting_logs)
            for r in export_data.reptiles
        )
        photos_count = sum(len(r.photos) for r in export_data.reptiles)

        # Generate preview token (UUID to identify this preview session)
        preview_token = str(uuid.uuid4())

        preview = schemas.ImportPreview(
            valid=len(errors) == 0,
            reptiles=preview_items,
            schedules_count=schedules_count,
            logs_count=logs_count,
            photos_count=photos_count,
            templates_to_import=templates_to_import,
            templates_skipped=templates_skipped,
            warnings=warnings,
            errors=errors,
            renamed_reptiles=renamed_reptiles
        )

        return preview, preview_token

    async def commit(
        self,
        db: AsyncSession,
        export_data: schemas.ExportData,
        user_id: int,
        household_id: int,
        renamed_map: dict[str, str],  # original -> new name
    ) -> dict:
        """
        Commit import with atomic transaction per D-12.
        Creates all records, applying name renames.
        Sets notification_pause_until per D-10 (1 hour pause).
        Imports templates per D-11 (only for trigger types user doesn't have).

        Returns: {"reptiles_created": N, "logs_created": N, "templates_created": N}
        """
        from app.storage import get_storage_backend

        reptiles_created = 0
        logs_created = 0
        templates_created = 0

        try:
            # Create reptiles with renamed names
            reptile_id_map = {}  # old_name -> new_id

            for reptile_data in export_data.reptiles:
                # Apply rename if in map
                name = renamed_map.get(reptile_data.name, reptile_data.name)

                reptile = models.Reptile(
                    name=name,
                    species=reptile_data.species,
                    date_of_birth=reptile_data.date_of_birth,
                    notes=reptile_data.notes,
                    feeding_schedule_enabled=reptile_data.feeding_schedule_enabled,
                    is_active=reptile_data.is_active,
                    household_id=household_id,
                    # D-10: pause notifications for 1 hour
                    notification_pause_until=datetime.now(timezone.utc) + timedelta(hours=1),
                )
                db.add(reptile)
                await db.flush()  # Get ID

                reptile_id_map[reptile_data.name] = reptile.id
                reptiles_created += 1

                # Create related logs with user attribution per D-15
                for feeding_data in reptile_data.feedings:
                    feeding = models.Feeding(
                        reptile_id=reptile.id,
                        user_id=user_id,  # D-15: map to importer
                        fed_at=feeding_data.get('fed_at'),
                        notes=feeding_data.get('notes'),
                        is_salad=feeding_data.get('is_salad', False),
                    )
                    db.add(feeding)
                    logs_created += 1

                for weight_data in reptile_data.weight_logs:
                    weight = models.WeightLog(
                        reptile_id=reptile.id,
                        logged_by_user_id=user_id,
                        weight_grams=weight_data.get('weight_grams'),
                        measured_at=weight_data.get('measured_at'),
                        notes=weight_data.get('notes'),
                    )
                    db.add(weight)
                    logs_created += 1

                for health_data in reptile_data.health_records:
                    health = models.HealthRecord(
                        reptile_id=reptile.id,
                        logged_by_user_id=user_id,
                        date=health_data.get('date'),
                        record_type=health_data.get('record_type'),
                        title=health_data.get('title', 'Imported health record'),
                        description=health_data.get('description'),
                    )
                    db.add(health)
                    logs_created += 1

                for misting_data in reptile_data.misting_logs:
                    misting = models.MistingLog(
                        reptile_id=reptile.id,
                        logged_by_user_id=user_id,
                        misted_at=misting_data.get('misted_at'),
                        notes=misting_data.get('notes'),
                    )
                    db.add(misting)
                    logs_created += 1

                # Create schedules (D-09: import times as-is, timezone-agnostic)
                for schedule_data in reptile_data.schedules:
                    schedule = models.Schedule(
                        reptile_id=reptile.id,
                        name=schedule_data.get('name'),
                        schedule_type=schedule_data.get('schedule_type'),
                        schedule_mode=schedule_data.get('schedule_mode', 'fixed'),
                        schedule_rule=schedule_data.get('schedule_rule'),
                        enabled=schedule_data.get('enabled', True),
                        # D-09: import times as-is (timezone-agnostic)
                        earliest_time=schedule_data.get('earliest_time'),
                        latest_time=schedule_data.get('latest_time'),
                        time_window_enabled=schedule_data.get('time_window_enabled', False),
                        frequency_days=schedule_data.get('frequency_days'),
                        days_of_week=schedule_data.get('days_of_week'),
                    )
                    db.add(schedule)

                # Handle photos if from ZIP bundle
                if hasattr(export_data, '_photos_zip') and export_data._photos_zip:
                    storage = get_storage_backend()
                    buffer = io.BytesIO(export_data._photos_zip)
                    with zipfile.ZipFile(buffer, 'r') as zf:
                        for photo_data in reptile_data.photos:
                            bundle_path = photo_data.get('bundle_path')
                            if bundle_path and bundle_path in zf.namelist():
                                photo_bytes = zf.read(bundle_path)
                                new_path = f"photos/{household_id}/{reptile.id}/{uuid.uuid4()}.jpg"
                                await storage.save_photo(new_path, photo_bytes)

                                photo = models.Photo(
                                    id=uuid.uuid4(),
                                    household_id=household_id,
                                    reptile_id=reptile.id,
                                    uploaded_by_user_id=user_id,
                                    file_path=new_path,
                                    category=photo_data.get('category', 'general'),
                                    caption=photo_data.get('caption'),
                                    taken_at=photo_data.get('taken_at'),
                                )
                                db.add(photo)

            # D-11: Import notification templates for trigger types user doesn't have
            if export_data.notification_templates:
                # Get user's existing trigger_types
                existing_trigger_types_result = await db.execute(
                    select(models.NotificationTemplate.trigger_type).where(
                        models.NotificationTemplate.user_id == user_id
                    ).distinct()
                )
                existing_triggers = {row[0] for row in existing_trigger_types_result.all()}

                for template_data in export_data.notification_templates:
                    trigger_type = template_data.get('trigger_type')
                    # Only import if user doesn't have a template for this trigger_type
                    if trigger_type and trigger_type not in existing_triggers:
                        template = models.NotificationTemplate(
                            user_id=user_id,  # Assign to importing user
                            name=template_data.get('name'),
                            template_type='custom',  # Imported templates are always custom (T-34-10)
                            trigger_type=trigger_type,
                            message_template_short=template_data.get('message_template_short'),
                            message_template_long=template_data.get('message_template_long'),
                            title_template=template_data.get('title_template'),
                            channel_type=template_data.get('channel_type'),
                            discord_config=template_data.get('discord_config'),
                            schedule_type_filter=template_data.get('schedule_type_filter'),
                            food_category_filter=template_data.get('food_category_filter'),
                            priority=template_data.get('priority', 100),
                            applies_to_description=template_data.get('applies_to_description'),
                            is_active=template_data.get('is_active', True),
                        )
                        db.add(template)
                        templates_created += 1
                        # Track this trigger_type as now existing to avoid duplicates within import
                        existing_triggers.add(trigger_type)

            await db.commit()
            return {
                "reptiles_created": reptiles_created,
                "logs_created": logs_created,
                "templates_created": templates_created,
            }

        except Exception as e:
            await db.rollback()
            raise ValueError(f"Import failed: {str(e)}")
