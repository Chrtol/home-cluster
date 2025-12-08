"""
Photo storage backend abstraction layer.

Supports multiple storage backends:
- LocalStorage: Ceph PVC or any local filesystem
- S3Storage: S3-compatible object storage (NAS S3, MinIO, AWS S3)
- NFSStorage: NAS NFS mount
- HybridStorage: Thumbnails on local/Ceph, full-size on S3/NFS

Configure via environment variables (see config.py).
"""

import os
import asyncio
from abc import ABC, abstractmethod
from enum import Enum
from pathlib import Path
from typing import Tuple, Optional
import boto3
from botocore.exceptions import ClientError
import logging

logger = logging.getLogger(__name__)


class StorageBackend(Enum):
    """Supported storage backend types."""
    LOCAL = "local"      # Ceph PVC or any local filesystem
    S3 = "s3"           # S3-compatible (NAS S3, MinIO, AWS S3)
    NFS = "nfs"         # NAS NFS mount
    HYBRID = "hybrid"   # Thumbnails on local, full-size on S3/NFS


class PhotoStorageBackend(ABC):
    """Abstract base class for photo storage backends."""

    @abstractmethod
    async def save_photo(self, path: str, data: bytes) -> str:
        """
        Save photo and return access URL.

        Args:
            path: Relative path within storage (e.g., "photos/household/reptile/uuid.jpg")
            data: Photo binary data

        Returns:
            URL or path for accessing the photo
        """
        pass

    @abstractmethod
    async def get_photo(self, path: str) -> bytes:
        """
        Retrieve photo data.

        Args:
            path: Relative path within storage

        Returns:
            Photo binary data

        Raises:
            FileNotFoundError: If photo doesn't exist
        """
        pass

    @abstractmethod
    async def delete_photo(self, path: str) -> bool:
        """
        Delete photo.

        Args:
            path: Relative path within storage

        Returns:
            True if deleted successfully, False otherwise
        """
        pass

    @abstractmethod
    async def exists(self, path: str) -> bool:
        """
        Check if photo exists.

        Args:
            path: Relative path within storage

        Returns:
            True if photo exists, False otherwise
        """
        pass


class LocalStorage(PhotoStorageBackend):
    """
    Local filesystem storage (Ceph PVC or any mounted filesystem).

    Pros:
    - Kubernetes-native
    - Fast access
    - Automatic Ceph backup
    - Shared across pods (RWX)
    """

    def __init__(self, base_path: str):
        """
        Initialize local storage.

        Args:
            base_path: Base directory path for photo storage
        """
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Initialized LocalStorage with base_path: {self.base_path}")

    async def save_photo(self, path: str, data: bytes) -> str:
        """Save photo to local filesystem."""
        file_path = self.base_path / path
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Run blocking I/O in executor
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, file_path.write_bytes, data)

        logger.debug(f"Saved photo to local storage: {file_path}")
        return f"/api/photos/serve/{path}"

    async def get_photo(self, path: str) -> bytes:
        """Retrieve photo from local filesystem."""
        file_path = self.base_path / path

        if not file_path.exists():
            raise FileNotFoundError(f"Photo not found: {path}")

        # Run blocking I/O in executor
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(None, file_path.read_bytes)

        return data

    async def delete_photo(self, path: str) -> bool:
        """Delete photo from local filesystem."""
        file_path = self.base_path / path

        if not file_path.exists():
            return False

        try:
            # Run blocking I/O in executor
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, file_path.unlink)
            logger.info(f"Deleted photo from local storage: {file_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete photo {file_path}: {e}")
            return False

    async def exists(self, path: str) -> bool:
        """Check if photo exists in local filesystem."""
        file_path = self.base_path / path
        # Run blocking I/O in executor
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, file_path.exists)


class S3Storage(PhotoStorageBackend):
    """
    S3-compatible object storage (NAS S3, MinIO, AWS S3).

    Pros:
    - Cheap storage on NAS
    - Object storage semantics
    - Built-in HTTP serving
    - Industry standard (portable)
    """

    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        region: str = "us-east-1"
    ):
        """
        Initialize S3 storage.

        Args:
            endpoint: S3 endpoint URL
            access_key: AWS access key ID
            secret_key: AWS secret access key
            bucket: S3 bucket name
            region: AWS region
        """
        self.endpoint = endpoint
        self.bucket = bucket
        self.region = region

        self.s3_client = boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )

        # Ensure bucket exists
        try:
            self.s3_client.head_bucket(Bucket=bucket)
            logger.info(f"Initialized S3Storage with bucket: {bucket}")
        except ClientError:
            logger.warning(f"Bucket {bucket} not found, attempting to create...")
            self.s3_client.create_bucket(Bucket=bucket)
            logger.info(f"Created S3 bucket: {bucket}")

    async def save_photo(self, path: str, data: bytes) -> str:
        """Save photo to S3."""
        loop = asyncio.get_event_loop()

        await loop.run_in_executor(
            None,
            lambda: self.s3_client.put_object(
                Bucket=self.bucket,
                Key=path,
                Body=data,
                ContentType='image/jpeg'
            )
        )

        logger.debug(f"Saved photo to S3: {path}")

        # Return presigned URL or public URL
        # For simplicity, return API path (backend will proxy S3 requests)
        return f"/api/photos/serve/{path}"

    async def get_photo(self, path: str) -> bytes:
        """Retrieve photo from S3."""
        loop = asyncio.get_event_loop()

        try:
            response = await loop.run_in_executor(
                None,
                lambda: self.s3_client.get_object(Bucket=self.bucket, Key=path)
            )
            return response['Body'].read()
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                raise FileNotFoundError(f"Photo not found: {path}")
            raise

    async def delete_photo(self, path: str) -> bool:
        """Delete photo from S3."""
        loop = asyncio.get_event_loop()

        try:
            await loop.run_in_executor(
                None,
                lambda: self.s3_client.delete_object(Bucket=self.bucket, Key=path)
            )
            logger.info(f"Deleted photo from S3: {path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete photo from S3 {path}: {e}")
            return False

    async def exists(self, path: str) -> bool:
        """Check if photo exists in S3."""
        loop = asyncio.get_event_loop()

        try:
            await loop.run_in_executor(
                None,
                lambda: self.s3_client.head_object(Bucket=self.bucket, Key=path)
            )
            return True
        except ClientError:
            return False


class NFSStorage(PhotoStorageBackend):
    """
    NAS NFS mount storage (behaves like local filesystem).

    Pros:
    - Massive capacity on NAS
    - Direct file access
    - No object storage overhead
    - Can be accessed outside k8s
    """

    def __init__(self, mount_path: str):
        """
        Initialize NFS storage.

        Args:
            mount_path: NFS mount point path
        """
        self.mount_path = Path(mount_path)

        if not self.mount_path.exists():
            raise ValueError(f"NFS mount path does not exist: {mount_path}")

        logger.info(f"Initialized NFSStorage with mount_path: {self.mount_path}")

    async def save_photo(self, path: str, data: bytes) -> str:
        """Save photo to NFS."""
        file_path = self.mount_path / path
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Run blocking I/O in executor
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, file_path.write_bytes, data)

        logger.debug(f"Saved photo to NFS storage: {file_path}")
        return f"/api/photos/serve/{path}"

    async def get_photo(self, path: str) -> bytes:
        """Retrieve photo from NFS."""
        file_path = self.mount_path / path

        if not file_path.exists():
            raise FileNotFoundError(f"Photo not found: {path}")

        # Run blocking I/O in executor
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(None, file_path.read_bytes)

        return data

    async def delete_photo(self, path: str) -> bool:
        """Delete photo from NFS."""
        file_path = self.mount_path / path

        if not file_path.exists():
            return False

        try:
            # Run blocking I/O in executor
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, file_path.unlink)
            logger.info(f"Deleted photo from NFS storage: {file_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete photo {file_path}: {e}")
            return False

    async def exists(self, path: str) -> bool:
        """Check if photo exists in NFS."""
        file_path = self.mount_path / path
        # Run blocking I/O in executor
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, file_path.exists)


class HybridStorage:
    """
    Hybrid storage: thumbnails on local/Ceph, full-size on S3/NFS.

    Strategy:
    - Thumbnails: Fast local storage (Ceph PVC) for quick gallery loading
    - Full-size: Cheap bulk storage (S3 or NFS) for archive

    Note: This is not a PhotoStorageBackend subclass because it has different
    save_photo signature (returns tuple of URLs).
    """

    def __init__(
        self,
        thumbnail_backend: PhotoStorageBackend,
        fullsize_backend: PhotoStorageBackend
    ):
        """
        Initialize hybrid storage.

        Args:
            thumbnail_backend: Backend for thumbnails (typically LocalStorage)
            fullsize_backend: Backend for full-size photos (typically S3Storage or NFSStorage)
        """
        self.thumbnail_backend = thumbnail_backend
        self.fullsize_backend = fullsize_backend
        logger.info("Initialized HybridStorage")

    async def save_photo(
        self,
        photo_id: str,
        full_data: bytes,
        thumb_data: bytes
    ) -> Tuple[str, str]:
        """
        Save both full-size and thumbnail.

        Args:
            photo_id: Unique photo identifier (UUID)
            full_data: Full-size photo binary data
            thumb_data: Thumbnail photo binary data

        Returns:
            Tuple of (full_url, thumb_url)
        """
        # Save in parallel for performance
        full_path = f"photos/full/{photo_id}.jpg"
        thumb_path = f"photos/thumbs/{photo_id}_thumb.jpg"

        full_url_task = self.fullsize_backend.save_photo(full_path, full_data)
        thumb_url_task = self.thumbnail_backend.save_photo(thumb_path, thumb_data)

        full_url, thumb_url = await asyncio.gather(full_url_task, thumb_url_task)

        return full_url, thumb_url

    async def get_photo(self, path: str) -> bytes:
        """Retrieve photo (tries fullsize backend first, then thumbnail)."""
        # Determine backend based on path
        if "thumbs" in path:
            return await self.thumbnail_backend.get_photo(path)
        else:
            return await self.fullsize_backend.get_photo(path)

    async def delete_photo(self, full_path: str, thumb_path: str) -> bool:
        """Delete both full-size and thumbnail."""
        results = await asyncio.gather(
            self.fullsize_backend.delete_photo(full_path),
            self.thumbnail_backend.delete_photo(thumb_path),
            return_exceptions=True
        )

        return all(isinstance(r, bool) and r for r in results)

    async def exists(self, path: str) -> bool:
        """Check if photo exists."""
        if "thumbs" in path:
            return await self.thumbnail_backend.exists(path)
        else:
            return await self.fullsize_backend.exists(path)


def get_storage_backend() -> PhotoStorageBackend:
    """
    Factory function to create storage backend based on environment variables.

    Returns:
        Configured storage backend instance

    Raises:
        ValueError: If backend type is unknown or configuration is invalid
    """
    backend_type = os.getenv("PHOTO_STORAGE_BACKEND", "local").lower()

    if backend_type == "local":
        base_path = os.getenv("LOCAL_STORAGE_PATH", "/app/photos")
        return LocalStorage(base_path)

    elif backend_type == "s3":
        endpoint = os.getenv("S3_ENDPOINT")
        access_key = os.getenv("S3_ACCESS_KEY")
        secret_key = os.getenv("S3_SECRET_KEY")
        bucket = os.getenv("S3_BUCKET", "reptile-photos")
        region = os.getenv("S3_REGION", "us-east-1")

        if not all([endpoint, access_key, secret_key]):
            raise ValueError(
                "S3 storage requires S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY"
            )

        return S3Storage(endpoint, access_key, secret_key, bucket, region)

    elif backend_type == "nfs":
        mount_path = os.getenv("NFS_MOUNT_PATH", "/mnt/nas-photos")
        return NFSStorage(mount_path)

    elif backend_type == "hybrid":
        # Thumbnails on local/Ceph
        local_path = os.getenv("LOCAL_STORAGE_PATH", "/app/photos")
        thumbnail_backend = LocalStorage(local_path)

        # Full-size on S3 or NFS
        fullsize_type = os.getenv("HYBRID_FULLSIZE_BACKEND", "s3").lower()

        if fullsize_type == "s3":
            endpoint = os.getenv("S3_ENDPOINT")
            access_key = os.getenv("S3_ACCESS_KEY")
            secret_key = os.getenv("S3_SECRET_KEY")
            bucket = os.getenv("S3_BUCKET", "reptile-photos")
            region = os.getenv("S3_REGION", "us-east-1")

            if not all([endpoint, access_key, secret_key]):
                raise ValueError(
                    "Hybrid S3 storage requires S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY"
                )

            fullsize_backend = S3Storage(endpoint, access_key, secret_key, bucket, region)

        elif fullsize_type == "nfs":
            mount_path = os.getenv("NFS_MOUNT_PATH", "/mnt/nas-photos")
            fullsize_backend = NFSStorage(mount_path)

        else:
            raise ValueError(f"Unknown hybrid fullsize backend: {fullsize_type}")

        return HybridStorage(thumbnail_backend, fullsize_backend)

    else:
        raise ValueError(f"Unknown storage backend: {backend_type}")
