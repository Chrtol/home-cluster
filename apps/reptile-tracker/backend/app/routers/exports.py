"""
Export/Import API endpoints for data migration and backup (Phase 34).

Provides:
- POST /exports - Create export job (returns task_id for polling)
- GET /exports/{task_id}/status - Poll export job status
- GET /exports/{task_id}/download - Download completed export file
- POST /exports/imports/preview - Upload and preview import file
- POST /exports/imports/commit - Commit previewed import
- GET /exports/transfers/pending - List pending transfer reptiles
- POST /exports/transfers/{id}/complete - Complete transfer (delete reptile)
- POST /exports/transfers/{id}/cancel - Cancel pending transfer
"""

import io
from datetime import datetime, timezone, timedelta
from typing import List, Dict

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app import models, schemas
from app.database import get_db
from app.routers.auth import get_current_user
from app.permissions import get_accessible_reptile_ids, is_owner
from app.storage import get_storage_backend
from app.celery_tasks import generate_export_task
from app.services.import_service import ImportService


router = APIRouter(prefix="/exports", tags=["exports"])

# In-memory preview cache (production should use Redis)
# Maps preview_token -> {export_data, household_id, renamed_map, created_at, user_id}
_preview_cache: Dict[str, dict] = {}


@router.post("", response_model=schemas.ExportStatusResponse)
async def create_export(
    request: schemas.ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Start export generation per D-05.
    Creates PendingExport record and queues Celery task.
    D-16: any household member can export.
    """
    # Verify reptile access per D-16
    accessible_ids = await get_accessible_reptile_ids(db, current_user)
    for rid in request.reptile_ids:
        if rid not in accessible_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No access to reptile {rid}"
            )

    # Get household_id from first reptile
    reptile = await db.get(models.Reptile, request.reptile_ids[0])
    if not reptile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reptile not found"
        )
    household_id = reptile.household_id

    # Create PendingExport per D-07 (7-day expiry)
    pending = models.PendingExport(
        user_id=current_user.id,
        household_id=household_id,
        task_id="",  # Will update after task creation
        export_type=request.export_type,
        reptile_ids=request.reptile_ids,
        is_transfer=request.is_transfer,
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(pending)
    await db.flush()

    # Start Celery task
    task = generate_export_task.delay(pending.id)
    pending.task_id = task.id
    await db.commit()

    return schemas.ExportStatusResponse(
        task_id=task.id,
        status="pending",
    )


@router.get("/{task_id}/status", response_model=schemas.ExportStatusResponse)
async def get_export_status(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get export task status for progress polling."""
    result = await db.execute(
        select(models.PendingExport).where(
            models.PendingExport.task_id == task_id,
            models.PendingExport.user_id == current_user.id,
        )
    )
    pending = result.scalar_one_or_none()

    if not pending:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export not found"
        )

    return schemas.ExportStatusResponse(
        task_id=pending.task_id,
        status=pending.status,
        step=pending.step,
        file_path=pending.file_path if pending.status == "complete" else None,
        error=pending.error,
    )


@router.get("/{task_id}/download")
async def download_export(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Download completed export file."""
    result = await db.execute(
        select(models.PendingExport).where(
            models.PendingExport.task_id == task_id,
            models.PendingExport.user_id == current_user.id,
        )
    )
    pending = result.scalar_one_or_none()

    if not pending:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export not found"
        )

    if pending.status != "complete" or not pending.file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Export not ready"
        )

    # Retrieve file from storage
    storage = get_storage_backend()
    try:
        content = await storage.get_photo(pending.file_path)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export file not found"
        )

    # Determine content type and filename
    ext = "zip" if pending.export_type == "zip" else "json"
    content_type = "application/zip" if ext == "zip" else "application/json"
    filename = f"reptile-export-{pending.id}.{ext}"

    return StreamingResponse(
        io.BytesIO(content),
        media_type=content_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/imports/preview", response_model=schemas.ImportPreview)
async def preview_import(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Upload and preview import file per D-12.
    Returns validation results and preview token.
    """
    content = await file.read()
    if len(content) > 100 * 1024 * 1024:  # 100MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large (max 100MB)"
        )

    service = ImportService()
    try:
        export_data = await service.parse_file(content, file.filename or "import.json")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # Get user's current household for preview
    result = await db.execute(
        select(models.household_members.c.household_id).where(
            models.household_members.c.user_id == current_user.id
        )
    )
    household_row = result.first()
    if not household_row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not in any household"
        )
    household_id = household_row[0]

    preview, token = await service.generate_preview(db, export_data, household_id, current_user.id)

    # Cache for commit step
    _preview_cache[token] = {
        "export_data": export_data,
        "household_id": household_id,
        "renamed_map": {r["original"]: r["new"] for r in preview.renamed_reptiles},
        "created_at": datetime.now(timezone.utc),
        "user_id": current_user.id,
    }

    # Include token in response
    preview_dict = preview.model_dump()
    preview_dict["preview_token"] = token
    return preview_dict


@router.post("/imports/commit")
async def commit_import(
    request: schemas.ImportCommitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Commit import after preview confirmation per D-12.
    D-14: Owner or Admin permission required.
    """
    # Get preview data from cache
    if request.preview_token not in _preview_cache:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Preview expired or invalid"
        )

    cache = _preview_cache[request.preview_token]

    # Verify same user
    if cache["user_id"] != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Preview belongs to different user"
        )

    export_data = cache["export_data"]
    renamed_map = cache["renamed_map"]

    # Determine destination household per D-13
    if request.create_new_household:
        # Create new household
        household = models.Household(
            name=request.new_household_name or f"{current_user.name}'s Household",
        )
        db.add(household)
        await db.flush()

        # Add user as owner
        await db.execute(
            models.household_members.insert().values(
                user_id=current_user.id,
                household_id=household.id,
                access_level=models.AccessLevel.OWNER,
            )
        )
        household_id = household.id
    elif request.household_id:
        # Use specified household, check permissions per D-14
        result = await db.execute(
            select(models.household_members.c.access_level)
            .where(
                models.household_members.c.user_id == current_user.id,
                models.household_members.c.household_id == request.household_id
            )
        )
        row = result.first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this household"
            )

        access_level = row[0]
        if access_level not in (models.AccessLevel.OWNER, models.AccessLevel.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners and admins can import into this household"
            )
        household_id = request.household_id
    else:
        # Fallback: Use user's first household
        result = await db.execute(
            select(models.household_members.c.household_id, models.household_members.c.access_level)
            .where(models.household_members.c.user_id == current_user.id)
            .limit(1)
        )
        row = result.first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not in any household"
            )

        household_id, access_level = row
        if access_level not in (models.AccessLevel.OWNER, models.AccessLevel.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners and admins can import into existing household"
            )

    # Commit import
    service = ImportService()
    try:
        result = await service.commit(
            db, export_data, current_user.id, household_id, renamed_map
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # Clean up cache
    del _preview_cache[request.preview_token]

    return {
        "success": True,
        "reptiles_created": result["reptiles_created"],
        "logs_created": result["logs_created"],
        "templates_created": result.get("templates_created", 0),
    }


@router.get("/transfers/pending")
async def list_pending_transfers(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    List reptiles with pending transfers per D-18.
    Returns reptiles in PENDING transfer status for user's household.
    """
    accessible_ids = await get_accessible_reptile_ids(db, current_user)

    result = await db.execute(
        select(models.Reptile).where(
            models.Reptile.id.in_(accessible_ids),
            models.Reptile.transfer_status == models.TransferStatus.PENDING,
        )
    )
    reptiles = result.scalars().all()

    return [
        {
            "id": r.id,
            "name": r.name,
            "species": r.species,
            "transfer_exported_at": r.transfer_exported_at.isoformat() if r.transfer_exported_at else None,
        }
        for r in reptiles
    ]


@router.post("/transfers/{reptile_id}/complete")
async def complete_transfer(
    reptile_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Complete transfer: permanently delete reptile per D-17.
    Requires Owner/Admin access.
    """
    # Check ownership
    if not await is_owner(db, current_user, reptile_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and admins can complete transfers"
        )

    reptile = await db.get(models.Reptile, reptile_id)
    if not reptile:
        raise HTTPException(status_code=404, detail="Reptile not found")

    if reptile.transfer_status != models.TransferStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reptile is not in pending transfer status"
        )

    reptile_name = reptile.name

    # Delete reptile and all related data
    # SQLAlchemy cascade should handle related records
    await db.delete(reptile)
    await db.commit()

    return {"success": True, "message": f"{reptile_name} has been removed"}


@router.post("/transfers/{reptile_id}/cancel")
async def cancel_transfer(
    reptile_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Cancel transfer: remove pending status per D-19.
    Requires Owner/Admin access.
    """
    if not await is_owner(db, current_user, reptile_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and admins can cancel transfers"
        )

    reptile = await db.get(models.Reptile, reptile_id)
    if not reptile:
        raise HTTPException(status_code=404, detail="Reptile not found")

    if reptile.transfer_status != models.TransferStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reptile is not in pending transfer status"
        )

    # Reset transfer status
    reptile.transfer_status = models.TransferStatus.NONE
    reptile.transfer_exported_at = None
    reptile.transfer_export_file = None
    await db.commit()

    return {"success": True, "message": f"Transfer cancelled for {reptile.name}"}
