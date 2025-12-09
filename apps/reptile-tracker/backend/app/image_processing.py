"""
Image processing utilities for photo uploads.

Provides functions for:
- Image compression and downscaling
- Thumbnail generation
- EXIF data handling
- Format conversion
"""

import io
import os
from typing import Tuple, Optional
from PIL import Image, ImageOps
import logging

logger = logging.getLogger(__name__)


def get_config_int(key: str, default: int) -> int:
    """Get integer config value from environment."""
    try:
        return int(os.getenv(key, str(default)))
    except ValueError:
        return default


# Configuration (from environment variables)
MAX_PHOTO_WIDTH = get_config_int("MAX_PHOTO_WIDTH", 2000)
JPEG_QUALITY = get_config_int("JPEG_QUALITY", 85)
THUMBNAIL_SIZE = get_config_int("THUMBNAIL_SIZE", 300)


def compress_image(
    image_bytes: bytes,
    max_width: Optional[int] = None,
    quality: Optional[int] = None
) -> Tuple[bytes, int, int]:
    """
    Process image while preserving original quality and format.

    For JPEG images that don't need rotation, returns original bytes to avoid
    quality loss from re-encoding. For other cases, processes with maximum quality.

    Process:
    1. Load image from bytes
    2. Check if rotation needed (EXIF orientation)
    3. If JPEG and no rotation needed: return original bytes
    4. Otherwise: process and save in original format with maximum quality
    5. Keep original size (no resizing)

    Args:
        image_bytes: Original image binary data
        max_width: Maximum width in pixels (ignored, kept for compatibility)
        quality: JPEG quality 1-100 (only used for JPEG, default: 100)

    Returns:
        Tuple of (image_bytes, width, height)

    Raises:
        ValueError: If image cannot be processed
    """
    try:
        # Load image
        img = Image.open(io.BytesIO(image_bytes))
        original_format = img.format  # Preserve original format (JPEG, PNG, WEBP)
        width, height = img.size

        # Check if image needs rotation
        exif = img.getexif()
        orientation = exif.get(274) if exif else 1  # 274 is the orientation tag
        needs_rotation = orientation and orientation != 1

        # For JPEG images that don't need rotation, return original bytes
        # This avoids quality loss from re-encoding
        if original_format == 'JPEG' and not needs_rotation:
            logger.debug(
                f"Preserved original JPEG: {len(image_bytes)} bytes (size={width}x{height})"
            )
            return image_bytes, width, height

        # For PNG images that don't need rotation, return original bytes
        if original_format == 'PNG' and not needs_rotation:
            logger.debug(
                f"Preserved original PNG: {len(image_bytes)} bytes (size={width}x{height})"
            )
            return image_bytes, width, height

        # Auto-rotate based on EXIF orientation if needed
        if needs_rotation:
            img = ImageOps.exif_transpose(img)
            width, height = img.size  # Update dimensions after rotation

        # Save in original format with maximum quality
        output = io.BytesIO()

        if original_format == 'JPEG':
            # For JPEG, use maximum quality with minimal subsampling
            if quality is None:
                quality = 100
            img.save(output, format='JPEG', quality=quality, optimize=False, subsampling=0)
        elif original_format == 'PNG':
            # For PNG, use lossless compression
            img.save(output, format='PNG', compress_level=0)  # 0 = no compression for max quality
        elif original_format == 'WEBP':
            # For WebP, use lossless mode
            img.save(output, format='WEBP', lossless=True, quality=100)
        else:
            # Fallback to JPEG for other formats
            if img.mode == 'RGBA':
                # Create white background for transparency
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            img.save(output, format='JPEG', quality=100, optimize=False, subsampling=0)

        processed_bytes = output.getvalue()

        logger.debug(
            f"Processed image: {len(image_bytes)} bytes → {len(processed_bytes)} bytes "
            f"(format={original_format}, size={width}x{height}, rotation={needs_rotation})"
        )

        return processed_bytes, width, height

    except Exception as e:
        logger.error(f"Failed to process image: {e}")
        raise ValueError(f"Invalid image file: {e}")


def create_thumbnail(
    image_bytes: bytes,
    size: Optional[int] = None
) -> bytes:
    """
    Create square thumbnail preserving aspect ratio.

    Process:
    1. Load image from bytes
    2. Auto-rotate based on EXIF orientation
    3. Resize to fit within size x size box (maintaining aspect ratio)
    4. Convert to JPEG with high quality
    5. Optimize for smaller file size

    Args:
        image_bytes: Original image binary data
        size: Thumbnail size in pixels (default: from config)

    Returns:
        Thumbnail image binary data (JPEG)

    Raises:
        ValueError: If image cannot be processed
    """
    if size is None:
        size = THUMBNAIL_SIZE

    try:
        # Load image
        img = Image.open(io.BytesIO(image_bytes))

        # Auto-rotate based on EXIF orientation
        img = ImageOps.exif_transpose(img)

        # Convert RGBA to RGB if necessary
        if img.mode == 'RGBA':
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        # Resize maintaining aspect ratio (fit within size x size box)
        img.thumbnail((size, size), Image.Resampling.LANCZOS)

        # Save as JPEG
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=85, optimize=True)
        thumbnail_bytes = output.getvalue()

        logger.debug(
            f"Created {img.width}x{img.height} thumbnail "
            f"({len(thumbnail_bytes)} bytes)"
        )

        return thumbnail_bytes

    except Exception as e:
        logger.error(f"Failed to create thumbnail: {e}")
        raise ValueError(f"Invalid image file: {e}")


def extract_exif_data(image_bytes: bytes) -> dict:
    """
    Extract EXIF metadata from image.

    Args:
        image_bytes: Image binary data

    Returns:
        Dictionary of EXIF data (simplified)

    Example:
        {
            'datetime': '2025:12:09 10:30:00',
            'orientation': 1,
            'make': 'Apple',
            'model': 'iPhone 12',
            'software': 'iOS 15.0',
            'gps_latitude': 37.7749,
            'gps_longitude': -122.4194
        }
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        exif = img.getexif()

        if not exif:
            return {}

        # Common EXIF tags
        exif_data = {}

        # DateTime
        if 306 in exif:  # DateTime
            exif_data['datetime'] = exif[306]

        # Orientation
        if 274 in exif:  # Orientation
            exif_data['orientation'] = exif[274]

        # Camera make/model
        if 271 in exif:  # Make
            exif_data['make'] = exif[271]
        if 272 in exif:  # Model
            exif_data['model'] = exif[272]

        # Software
        if 305 in exif:  # Software
            exif_data['software'] = exif[305]

        # GPS data (if available)
        gps_info = exif.get_ifd(0x8825)  # GPS IFD
        if gps_info:
            # Simplified GPS extraction
            if 2 in gps_info and 4 in gps_info:  # Latitude and Longitude
                exif_data['has_gps'] = True

        return exif_data

    except Exception as e:
        logger.warning(f"Failed to extract EXIF data: {e}")
        return {}


def validate_image(image_bytes: bytes, max_size_mb: int = 10) -> Tuple[bool, str]:
    """
    Validate image file.

    Checks:
    - File size within limit
    - Valid image format
    - Can be opened by PIL

    Args:
        image_bytes: Image binary data
        max_size_mb: Maximum file size in MB

    Returns:
        Tuple of (is_valid, error_message)
        If valid, error_message is empty string
    """
    # Check file size
    size_mb = len(image_bytes) / (1024 * 1024)
    if size_mb > max_size_mb:
        return False, f"Image too large: {size_mb:.1f}MB (max {max_size_mb}MB)"

    # Try to open image
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.verify()  # Verify it's a valid image

        # Check format
        if img.format not in ['JPEG', 'PNG', 'WEBP']:
            return False, f"Unsupported format: {img.format} (allowed: JPEG, PNG, WebP)"

        return True, ""

    except Exception as e:
        return False, f"Invalid image file: {str(e)}"


def get_image_info(image_bytes: bytes) -> dict:
    """
    Get basic image information.

    Args:
        image_bytes: Image binary data

    Returns:
        Dictionary with image metadata

    Example:
        {
            'format': 'JPEG',
            'mode': 'RGB',
            'width': 4032,
            'height': 3024,
            'size_bytes': 2458123,
            'exif': {...}
        }
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))

        return {
            'format': img.format,
            'mode': img.mode,
            'width': img.width,
            'height': img.height,
            'size_bytes': len(image_bytes),
            'exif': extract_exif_data(image_bytes)
        }

    except Exception as e:
        logger.error(f"Failed to get image info: {e}")
        return {}
