"""
Photos router for photo upload, retrieval, and management.
"""

import uuid
import os
import logging
from typing import List, Optional
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
    Query
)
from fastapi.responses import Response, FileResponse
from sqlalchemy import select, delete, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.auth import get_current_user
from app.database import get_db
from app.models import User, Photo, Reptile, AccessLevel
from app.permissions import check_reptile_access
from app.schemas import (
    Photo as PhotoSchema,
    PhotoWithUrls,
    PhotoUpdate,
    PhotoUploadResponse
)
from app.storage import get_storage_backend
from app.image_processing import (
    compress_image,
    create_thumbnail,
    validate_image,
    get_image_info
)
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


# Initialize storage backend (singleton)
_storage_backend = None


def get_storage():
    """Get or create storage backend instance."""
    global _storage_backend
    if _storage_backend is None:
        _storage_backend = get_storage_backend()
    return _storage_backend


@router.post("/upload", response_model=PhotoUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_photos(
    files: List[UploadFile] = File(...),
    reptile_id: int = Form(...),
    category: str = Form("general"),
    caption: Optional[str] = Form(None),
    health_record_id: Optional[int] = Form(None),
    feeding_log_id: Optional[int] = Form(None),
    weight_log_id: Optional[int] = Form(None),
    misting_log_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload 1-3 photos at once.

    Steps:
    1. Validate file types and sizes
    2. Check user has CARETAKER+ access to reptile
    3. Process images (compress, create thumbnails)
    4. Save to storage backend
    5. Create database records
    6. Return photo metadata
    """
    # Check access (CARETAKER+ can upload)
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.CARETAKER)

    # Validate number of files
    if len(files) > settings.max_photos_per_log:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {settings.max_photos_per_log} photos allowed per upload"
        )

    # Get reptile and household
    result = await db.execute(
        select(Reptile)
        .options(selectinload(Reptile.household))
        .where(Reptile.id == reptile_id)
    )
    reptile = result.scalar_one_or_none()
    if not reptile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reptile not found"
        )

    if not reptile.household_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reptile must belong to a household"
        )

    storage = get_storage()
    created_photos = []

    for file in files:
        try:
            # Read file
            contents = await file.read()

            # Validate image
            is_valid, error_msg = validate_image(contents, settings.max_photo_size_mb)
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error_msg
                )

            # Get image info
            image_info = get_image_info(contents)

            # Determine file extension and mime type from original format
            original_format = image_info.get('format', 'JPEG').upper()
            if original_format == 'JPEG':
                file_ext = 'jpg'
                mime_type = 'image/jpeg'
            elif original_format == 'PNG':
                file_ext = 'png'
                mime_type = 'image/png'
            elif original_format == 'WEBP':
                file_ext = 'webp'
                mime_type = 'image/webp'
            else:
                # Default to JPEG for unknown formats
                file_ext = 'jpg'
                mime_type = 'image/jpeg'

            # Process image (preserves original format and quality)
            compressed_data, width, height = compress_image(
                contents,
                max_width=settings.max_photo_width,
                quality=settings.jpeg_quality
            )

            # Create thumbnail (always JPEG for consistency)
            # Gallery thumbnails maintain aspect ratio with longest side at configured size
            thumbnail_data = create_thumbnail(
                compressed_data,
                size=settings.thumbnail_longest_side
            )

            # Generate UUID for photo
            photo_id = uuid.uuid4()

            # Define storage paths with correct extension
            file_path = f"photos/household_{reptile.household_id}/reptile_{reptile_id}/{str(photo_id)}.{file_ext}"
            thumbnail_path = f"photos/household_{reptile.household_id}/reptile_{reptile_id}/{str(photo_id)}_thumb.jpg"

            # Save to storage
            await storage.save_photo(file_path, compressed_data)
            await storage.save_photo(thumbnail_path, thumbnail_data)

            # Create database record
            photo = Photo(
                id=photo_id,
                household_id=reptile.household_id,
                reptile_id=reptile_id,
                uploaded_by_user_id=current_user.id,
                file_path=file_path,
                thumbnail_path=thumbnail_path,
                file_size_bytes=len(compressed_data),
                mime_type="image/jpeg",
                category=category,
                caption=caption,
                taken_at=None,  # Could extract from EXIF if needed
                uploaded_at=datetime.now(timezone.utc),
                health_record_id=health_record_id,
                feeding_log_id=feeding_log_id,
                weight_log_id=weight_log_id,
                misting_log_id=misting_log_id,
            )

            db.add(photo)
            created_photos.append(photo)

            logger.info(
                f"Uploaded photo {photo_id} for reptile {reptile_id} "
                f"by user {current_user.id} ({len(compressed_data)} bytes)"
            )

        except HTTPException:
            # Re-raise HTTP exceptions
            raise
        except Exception as e:
            logger.error(f"Failed to process photo: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process photo: {str(e)}"
            )

    # Commit all photos
    await db.commit()

    # Refresh to get relationships
    for photo in created_photos:
        await db.refresh(photo)

    return PhotoUploadResponse(
        photos=created_photos,
        count=len(created_photos)
    )


@router.get("/reptile/{reptile_id}", response_model=List[PhotoSchema])
async def list_reptile_photos(
    reptile_id: int,
    category: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all photos for a reptile with optional filtering.

    Query params:
    - category: Filter by category (health, weight, feeding, enclosure, general)
    - limit: Maximum photos to return (default 50, max 200)
    - offset: Pagination offset
    """
    # Check access (VIEWER can view photos)
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)

    # Build query
    query = select(Photo).where(Photo.reptile_id == reptile_id)

    if category:
        query = query.where(Photo.category == category)

    query = query.order_by(Photo.uploaded_at.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    photos = result.scalars().all()

    return photos


@router.get("/{photo_id}", response_model=PhotoWithUrls)
async def get_photo(
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get photo metadata with serving URLs."""
    result = await db.execute(
        select(Photo)
        .options(selectinload(Photo.reptile))
        .where(Photo.id == photo_id)
    )
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found"
        )

    # Check access
    await check_reptile_access(db, current_user, photo.reptile_id, AccessLevel.VIEWER)

    # Add serving URLs
    photo_dict = PhotoSchema.model_validate(photo).model_dump()
    photo_dict["file_url"] = f"/api/photos/{photo_id}/file"
    photo_dict["thumbnail_url"] = f"/api/photos/{photo_id}/thumbnail"

    return PhotoWithUrls(**photo_dict)


@router.get("/{photo_id}/file")
async def serve_photo_file(
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve full-size photo file."""
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id)
    )
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found"
        )

    # Check access
    await check_reptile_access(db, current_user, photo.reptile_id, AccessLevel.VIEWER)

    storage = get_storage()

    try:
        file_data = await storage.get_photo(photo.file_path)
        return Response(
            content=file_data,
            media_type=photo.mime_type or "image/jpeg",
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",
                "Content-Disposition": f'inline; filename="{photo_id}.jpg"'
            }
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo file not found in storage"
        )


@router.get("/{photo_id}/thumbnail")
async def serve_photo_thumbnail(
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve photo thumbnail."""
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id)
    )
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found"
        )

    # Check access
    await check_reptile_access(db, current_user, photo.reptile_id, AccessLevel.VIEWER)

    storage = get_storage()

    try:
        thumbnail_path = photo.thumbnail_path or photo.file_path
        file_data = await storage.get_photo(thumbnail_path)
        return Response(
            content=file_data,
            media_type="image/jpeg",
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",
                "Content-Disposition": f'inline; filename="{photo_id}_thumb.jpg"'
            }
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thumbnail not found in storage"
        )


@router.patch("/{photo_id}", response_model=PhotoSchema)
async def update_photo(
    photo_id: str,
    photo_update: PhotoUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update photo metadata (caption, category, tags, taken_at)."""
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id)
    )
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found"
        )

    # Check access (CARETAKER+ can edit)
    await check_reptile_access(db, current_user, photo.reptile_id, AccessLevel.CARETAKER)

    # Update fields
    update_data = photo_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(photo, field, value)

    await db.commit()
    await db.refresh(photo)

    logger.info(f"Updated photo {photo_id} metadata by user {current_user.id}")

    return photo


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete photo.

    Permissions:
    - Uploader can delete their own photos
    - ADMIN+ can delete any photos in household
    - CARETAKER cannot delete others' photos (unless allow_caretaker_delete_others is enabled)
    """
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id)
    )
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found"
        )

    # Check if user is uploader
    is_uploader = photo.uploaded_by_user_id == current_user.id

    # Check household access level (if user is not uploader)
    household_access = None
    if not is_uploader and photo.household_id:
        from app.models import household_members
        household_check = await db.execute(
            select(household_members.c.access_level).where(
                household_members.c.user_id == current_user.id,
                household_members.c.household_id == photo.household_id,
            )
        )
        household_access = household_check.scalar_one_or_none()

    # Determine if user can delete
    can_delete = False

    if is_uploader:
        can_delete = True
    elif household_access and household_access in [AccessLevel.OWNER, AccessLevel.ADMIN]:
        can_delete = True
    elif settings.allow_caretaker_delete_others and household_access == AccessLevel.CARETAKER:
        can_delete = True

    if not can_delete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this photo"
        )

    # Delete from storage
    storage = get_storage()
    try:
        await storage.delete_photo(photo.file_path)
        if photo.thumbnail_path:
            await storage.delete_photo(photo.thumbnail_path)
    except Exception as e:
        logger.warning(f"Failed to delete photo files from storage: {e}")

    # Delete from database
    await db.delete(photo)
    await db.commit()

    logger.info(f"Deleted photo {photo_id} by user {current_user.id}")


@router.post("/reptiles/{reptile_id}/avatar", response_model=PhotoSchema)
async def set_reptile_avatar(
    reptile_id: int,
    photo_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    crop_x: Optional[int] = Form(None),
    crop_y: Optional[int] = Form(None),
    crop_width: Optional[int] = Form(None),
    crop_height: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Set reptile avatar (profile picture) with optional cropping.

    Can either:
    - Select existing photo by photo_id (Form field)
    - Upload new photo (File field)

    Optional crop parameters:
    - crop_x, crop_y, crop_width, crop_height: Crop coordinates in pixels
    """
    # Check access (CARETAKER+ can set avatar)
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.CARETAKER)

    # Get reptile
    result = await db.execute(
        select(Reptile).where(Reptile.id == reptile_id)
    )
    reptile = result.scalar_one_or_none()

    if not reptile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reptile not found"
        )

    # If photo_id provided, use existing photo
    if photo_id:
        # Convert photo_id string to UUID
        try:
            photo_uuid = uuid.UUID(photo_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid photo ID format"
            )

        result = await db.execute(
            select(Photo).where(
                and_(
                    Photo.id == photo_uuid,
                    Photo.reptile_id == reptile_id
                )
            )
        )
        photo = result.scalar_one_or_none()

        if not photo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo not found for this reptile"
            )

        reptile.avatar_photo_id = photo_uuid

        # Save crop coordinates if provided (check hasattr for backwards compatibility)
        if hasattr(reptile, 'avatar_crop_x'):
            if crop_x is not None and crop_y is not None and crop_width is not None and crop_height is not None:
                reptile.avatar_crop_x = crop_x
                reptile.avatar_crop_y = crop_y
                reptile.avatar_crop_width = crop_width
                reptile.avatar_crop_height = crop_height
                logger.info(f"Applied crop: ({crop_x}, {crop_y}, {crop_width}, {crop_height})")
            else:
                # Clear crop coordinates if none provided
                reptile.avatar_crop_x = None
                reptile.avatar_crop_y = None
                reptile.avatar_crop_width = None
                reptile.avatar_crop_height = None
        elif crop_x is not None:
            # Crop requested but database not migrated yet
            logger.warning("Avatar crop coordinates provided but database columns don't exist yet. Run migration 0073.")

        await db.commit()
        await db.refresh(photo)

        logger.info(f"Set avatar for reptile {reptile_id} to photo {photo_uuid}")
        return photo

    # If file provided, upload new photo
    elif file:
        # Use upload_photos endpoint logic
        upload_response = await upload_photos(
            files=[file],
            reptile_id=reptile_id,
            category="general",
            caption="Avatar photo",
            current_user=current_user,
            db=db
        )

        new_photo = upload_response.photos[0]

        # Set as avatar
        reptile.avatar_photo_id = new_photo.id
        await db.commit()

        logger.info(f"Uploaded and set avatar for reptile {reptile_id} to photo {new_photo.id}")
        return new_photo

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either photo_id or file must be provided"
        )


@router.get("/reptiles/{reptile_id}/avatar")
async def get_reptile_avatar(
    reptile_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get reptile avatar (returns photo file or 404)."""
    # Check access
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.VIEWER)

    result = await db.execute(
        select(Reptile)
        .options(selectinload(Reptile.avatar_photo))
        .where(Reptile.id == reptile_id)
    )
    reptile = result.scalar_one_or_none()

    if not reptile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reptile not found"
        )

    if not reptile.avatar_photo_id or not reptile.avatar_photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No avatar set for this reptile"
        )

    # Serve avatar thumbnail with cropping if specified
    storage = get_storage()

    try:
        photo = reptile.avatar_photo

        # Always regenerate avatar from original image for best quality
        # Avatars are separate from gallery thumbnails (300px square vs 600px aspect-ratio)
        from app.image_processing import create_thumbnail, AVATAR_SIZE

        # Get the original full-size image
        original_file_data = await storage.get_photo(photo.file_path)

        # Check if custom crop coordinates are set
        has_crop_coords = (
            hasattr(reptile, 'avatar_crop_x') and
            hasattr(reptile, 'avatar_crop_y') and
            hasattr(reptile, 'avatar_crop_width') and
            hasattr(reptile, 'avatar_crop_height')
        )

        if (has_crop_coords and
            reptile.avatar_crop_x is not None and
            reptile.avatar_crop_y is not None and
            reptile.avatar_crop_width is not None and
            reptile.avatar_crop_height is not None):

            # Apply custom crop coordinates from user selection
            crop_box = (
                reptile.avatar_crop_x,
                reptile.avatar_crop_y,
                reptile.avatar_crop_x + reptile.avatar_crop_width,
                reptile.avatar_crop_y + reptile.avatar_crop_height
            )

            # Create avatar with custom crop + square crop
            file_data = create_thumbnail(
                original_file_data,
                size=AVATAR_SIZE,  # Use avatar size (300px) not gallery thumbnail size (600px)
                crop_box=crop_box,
                square_crop=True  # Ensure avatar is square for circular display
            )

            logger.debug(f"Created custom avatar crop for reptile {reptile_id}: {crop_box}")
        else:
            # No custom crop - create square avatar from center of image
            file_data = create_thumbnail(
                original_file_data,
                size=AVATAR_SIZE,  # Use avatar size (300px)
                square_crop=True  # Center-crop to square
            )

            logger.debug(f"Created center-cropped square avatar for reptile {reptile_id}")

        return Response(
            content=file_data,
            media_type="image/jpeg",
            headers={
                "Cache-Control": "public, max-age=86400",  # Cache for 1 day
                "Content-Disposition": f'inline; filename="reptile_{reptile_id}_avatar.jpg"'
            }
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Avatar photo file not found in storage"
        )
