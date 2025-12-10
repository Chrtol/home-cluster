# Photo Upload Feature - Implementation Plan

**Status**: Ready for Implementation
**Priority**: Tier 2 - High Priority
**Estimated Duration**: 3 weeks

## Configuration Decisions ✅

### Storage Backend
- **Multi-backend support**: Ceph PVC + S3 + NAS NFS (all three from the start)
- **Strategy**: Configurable per deployment, with hybrid option for thumbnails vs full-size
- **Initial allocation**: 50Gi Ceph PVC (sufficient for ~120,000 photos)

### File Limits & Processing
- **Max upload size**: 10MB per photo
- **Max width**: 2000px (downscaled automatically)
- **JPEG quality**: 85% (visually lossless)
- **Thumbnail size**: 300x300px
- **Photos per household**: Unlimited
- **Photos per log entry**: 3 maximum

### Permissions
- **Upload**: CARETAKER+ role can upload
- **Delete**: Uploader OR ADMIN+ (Caretakers cannot delete others' photos)
- **Privacy**: Household-only (future: configurable public sharing)

### Mobile Camera
- **Default**: Rear camera (`capture="environment"`)
- **User control**: Native phone UI allows easy camera switching

### Image Quality
- **Compression**: Automatic downscaling and compression on upload
- **EXIF data**: Preserved (stored with metadata)
- **Format support**: JPEG, PNG, WebP

---

## Overview

This document outlines the implementation plan for adding comprehensive photo support to the Reptile Tracker application. The feature includes standalone photo management, avatar system, photo galleries, and integration with existing log types.

## Use Cases

### High Value Use Cases

1. **Profile Picture/Avatar**
   - Rounded avatar displayed everywhere the reptile is referenced
   - Reptile cards, dropdowns, navigation
   - Makes multi-reptile households much easier to navigate

2. **Custom Photo Gallery**
   - Browse all photos for a reptile
   - Filter by type, date range
   - Lightbox viewer

3. **Growth Timeline/Comparison View**
   - Side-by-side comparisons from different dates
   - "Then vs Now" slider view
   - Automatically suggest comparisons (e.g., "6 months ago vs today")
   - Critical for juveniles - visual proof of growth

4. **Shed Cycle Documentation**
   - Before/after shed pairs
   - Track shed quality (complete vs incomplete)
   - Document stuck shed locations
   - Colors often brighten after shed - visual comparison

5. **Health Condition Tracking**
   - Visual proof for vet visits
   - Track healing progress (injuries, scale rot, mouth rot)
   - Document symptoms for telemedicine consultations
   - Compare "before treatment" vs "after treatment"
   - Insurance/breeding records if selling offspring

6. **Enclosure/Habitat Documentation**
   - Document setup and layout changes
   - Reference photos when cleaning/rearranging
   - Show temperature gradients, hide spots, enrichment
   - Useful when asking for advice (Facebook groups, Reddit)

### Medium Value Use Cases

7. **Feeding Documentation**
   - Photo of prey size for reference (especially for snakes)
   - Food presentation for herbivores (salad bowl setup)
   - Proof of eating for picky eaters (timestamp evidence)

8. **Weight Chart Integration**
   - Attach photo to weight measurement
   - Hover over weight chart point → see photo
   - Visual correlation: weight + body condition

9. **Dashboard Photo Display**
   - "Latest photo" widget on dashboard
   - Recent photos from all reptiles
   - Quick visual check-in

10. **Calendar Event Thumbnails**
    - Show small thumbnail on calendar events with photos
    - Visual indicators for photo-documented activities

---

## Phase 1 Features

### Core Features:
1. ✅ **Profile Picture (Avatar)** - Single photo per reptile
2. ✅ **Photo Gallery** - All photos for a reptile in one place
3. ✅ **Health Log Photos** - Document injuries, vet visits (2-3 photos per log)
4. ✅ **Weight Log Photos** - Body condition documentation (2-3 photos per log)
5. ✅ **Feeding Log Photos** - Prey size, food presentation (2-3 photos per log)

### UI Enhancements:
6. ✅ **Weight Chart Integration** - Click chart point → see photo from that day
7. ✅ **Dashboard Latest Photo** - Quick visual widget
8. ✅ **Calendar Thumbnails** - Visual event indicators

### Phase 2 (Deferred):
- Growth timeline comparisons (requires more UI complexity)
- Before/after shed pairing system
- Enclosure documentation (separate feature area)
- Breeding records (if requested)

---

## Database Schema Design

### New `photos` Table

```sql
CREATE TABLE photos (
    id UUID PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    reptile_id UUID NOT NULL REFERENCES reptiles(id) ON DELETE CASCADE,
    uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

    -- Storage
    file_path VARCHAR NOT NULL,  -- e.g., "photos/household_id/reptile_id/uuid.jpg"
    thumbnail_path VARCHAR,       -- e.g., "photos/household_id/reptile_id/uuid_thumb.jpg"
    file_size_bytes INTEGER,
    mime_type VARCHAR(50),

    -- Categorization
    category VARCHAR(50) NOT NULL,  -- 'health', 'weight', 'feeding', 'enclosure', 'general'
    tags TEXT[],                     -- Optional tags for future use

    -- Metadata
    caption TEXT,
    taken_at TIMESTAMP,              -- When photo was taken (can differ from upload time)
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Relationships (nullable - photos can exist standalone)
    health_record_id UUID REFERENCES health_records(id) ON DELETE SET NULL,
    feeding_log_id UUID REFERENCES feeding_logs(id) ON DELETE SET NULL,
    weight_log_id UUID REFERENCES weight_logs(id) ON DELETE SET NULL,
    misting_log_id UUID REFERENCES misting_logs(id) ON DELETE SET NULL,

    CONSTRAINT photos_household_check
        CHECK (household_id = (SELECT household_id FROM reptiles WHERE id = reptile_id))
);

-- Indexes
CREATE INDEX idx_photos_reptile ON photos(reptile_id);
CREATE INDEX idx_photos_category ON photos(category);
CREATE INDEX idx_photos_uploaded_at ON photos(uploaded_at);
CREATE INDEX idx_photos_health_record ON photos(health_record_id);
CREATE INDEX idx_photos_feeding_log ON photos(feeding_log_id);
CREATE INDEX idx_photos_weight_log ON photos(weight_log_id);
```

### Update `reptiles` Table

```sql
ALTER TABLE reptiles
ADD COLUMN avatar_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL;
```

### Key Design Decisions:
- ✅ Photos are standalone entities
- ✅ Optional relationships to log entries (nullable foreign keys)
- ✅ Category field for filtering (health, weight, feeding, enclosure, general)
- ✅ Tags array for future extensibility
- ✅ Separate thumbnail path for performance
- ✅ Household-level organization for data isolation
- ✅ Photos can exist without being attached to a log entry
- ✅ Support for 2-3 photos per log entry

---

## Storage Backend Architecture

### Multi-Backend Storage Abstraction ⭐ Implemented

The application supports **all three storage backends** from the start with a unified abstraction layer. This provides maximum flexibility and allows choosing the best storage for different use cases.

### Supported Backends:

#### 1. Ceph PVC (Local Filesystem)
**Use Case**: Fast access for thumbnails, general-purpose storage

```yaml
# kubernetes/apps/default/reptile-tracker/app/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: reptile-tracker-photos
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: ceph-filesystem
  resources:
    requests:
      storage: 50Gi
```

**Pros:**
- Kubernetes-native
- Fast access (local filesystem)
- Automatic Ceph backup
- Shared across pods (RWX)

#### 2. S3-Compatible (NAS S3)
**Use Case**: Cheap bulk storage for full-size images

```python
# S3 configuration
S3_ENDPOINT=https://your-nas-s3.local
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=reptile-photos
```

**Pros:**
- Cheap storage on NAS
- Object storage semantics
- Built-in HTTP serving
- Industry standard (portable)

#### 3. NAS NFS Mount
**Use Case**: Direct NAS access for maximum storage capacity

```yaml
# kubernetes/apps/default/reptile-tracker/app/pv-nfs.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nas-photos
spec:
  capacity:
    storage: 500Gi
  accessModes:
    - ReadWriteMany
  nfs:
    server: your-nas-ip
    path: /mnt/reptile-photos
```

**Pros:**
- Massive capacity on NAS
- Direct file access
- No object storage overhead
- Can be accessed outside k8s

### Unified Storage Abstraction Layer

```python
# backend/app/storage.py
from abc import ABC, abstractmethod
from enum import Enum
from pathlib import Path
import boto3
from typing import Tuple, Optional

class StorageBackend(Enum):
    LOCAL = "local"      # Ceph PVC or any local filesystem
    S3 = "s3"           # S3-compatible (NAS S3, MinIO, AWS S3)
    NFS = "nfs"         # NAS NFS mount
    HYBRID = "hybrid"   # Thumbnails on local, full-size on S3/NFS

class PhotoStorageBackend(ABC):
    @abstractmethod
    async def save_photo(self, path: str, data: bytes) -> str:
        """Save photo and return access URL"""
        pass

    @abstractmethod
    async def get_photo(self, path: str) -> bytes:
        """Retrieve photo data"""
        pass

    @abstractmethod
    async def delete_photo(self, path: str) -> bool:
        """Delete photo"""
        pass

class LocalStorage(PhotoStorageBackend):
    """Ceph PVC or local filesystem"""
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)

    async def save_photo(self, path: str, data: bytes) -> str:
        file_path = self.base_path / path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)
        return f"/api/photos/serve/{path}"

class S3Storage(PhotoStorageBackend):
    """S3-compatible storage (NAS, MinIO, AWS)"""
    def __init__(self, endpoint: str, access_key: str, secret_key: str, bucket: str):
        self.s3_client = boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key
        )
        self.bucket = bucket

    async def save_photo(self, path: str, data: bytes) -> str:
        self.s3_client.put_object(
            Bucket=self.bucket,
            Key=path,
            Body=data,
            ContentType='image/jpeg'
        )
        return f"{self.endpoint}/{self.bucket}/{path}"

class NFSStorage(PhotoStorageBackend):
    """NAS NFS mount (behaves like local filesystem)"""
    def __init__(self, mount_path: str):
        self.mount_path = Path(mount_path)

    async def save_photo(self, path: str, data: bytes) -> str:
        file_path = self.mount_path / path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)
        return f"/api/photos/serve/{path}"

class HybridStorage:
    """Thumbnails on local/Ceph, full-size on S3/NFS"""
    def __init__(self, thumbnail_backend: PhotoStorageBackend, fullsize_backend: PhotoStorageBackend):
        self.thumbnail_backend = thumbnail_backend
        self.fullsize_backend = fullsize_backend

    async def save_photo(self, photo_id: str, full_data: bytes, thumb_data: bytes) -> Tuple[str, str]:
        # Save full-size to cheap storage (S3 or NFS)
        full_path = f"photos/full/{photo_id}.jpg"
        full_url = await self.fullsize_backend.save_photo(full_path, full_data)

        # Save thumbnail to fast storage (Ceph PVC)
        thumb_path = f"photos/thumbs/{photo_id}_thumb.jpg"
        thumb_url = await self.thumbnail_backend.save_photo(thumb_path, thumb_data)

        return full_url, thumb_url

# Factory function
def get_storage_backend() -> PhotoStorageBackend:
    backend_type = os.getenv("PHOTO_STORAGE_BACKEND", "local")

    if backend_type == "local":
        return LocalStorage(os.getenv("LOCAL_STORAGE_PATH", "/app/photos"))

    elif backend_type == "s3":
        return S3Storage(
            endpoint=os.getenv("S3_ENDPOINT"),
            access_key=os.getenv("S3_ACCESS_KEY"),
            secret_key=os.getenv("S3_SECRET_KEY"),
            bucket=os.getenv("S3_BUCKET", "reptile-photos")
        )

    elif backend_type == "nfs":
        return NFSStorage(os.getenv("NFS_MOUNT_PATH", "/mnt/nas-photos"))

    elif backend_type == "hybrid":
        local = LocalStorage(os.getenv("LOCAL_STORAGE_PATH", "/app/photos"))
        s3 = S3Storage(...)  # or NFS
        return HybridStorage(local, s3)

    else:
        raise ValueError(f"Unknown storage backend: {backend_type}")
```

### Deployment Flexibility

With this architecture, you can:
- ✅ Start with **Ceph PVC only** (set `PHOTO_STORAGE_BACKEND=local`)
- ✅ Switch to **S3 only** (set `PHOTO_STORAGE_BACKEND=s3`)
- ✅ Use **NFS only** (set `PHOTO_STORAGE_BACKEND=nfs`)
- ✅ Use **Hybrid** (thumbnails on Ceph, full-size on S3/NFS)
- ✅ Change backends **without code changes** (just env vars)

---

## Backend API Design

### Photo Endpoints

```python
# POST /api/photos/upload
# - Multipart form data with file(s)
# - Optional: category, caption, taken_at, reptile_id, log_type, log_id
# - Returns: Photo[] (2-3 photos uploaded at once)

# GET /api/photos/reptile/{reptile_id}
# - Query params: category, start_date, end_date, limit, offset
# - Returns: Paginated photos

# GET /api/photos/{photo_id}
# - Returns: Photo metadata + signed URL

# GET /api/photos/{photo_id}/file
# - Returns: Actual file (with caching headers)

# GET /api/photos/{photo_id}/thumbnail
# - Returns: Thumbnail file

# DELETE /api/photos/{photo_id}
# - Soft delete or hard delete with file cleanup

# PATCH /api/photos/{photo_id}
# - Update caption, category, tags, taken_at

# POST /api/reptiles/{reptile_id}/avatar
# - Set avatar from existing photo_id or upload new
# - Body: { "photo_id": "uuid" } OR multipart file upload

# GET /api/reptiles/{reptile_id}/avatar
# - Returns avatar photo or default avatar
```

### Photo Upload Logic

```python
# backend/app/routers/photos.py
from fastapi import UploadFile, File
from PIL import Image
import uuid

async def upload_photos(
    files: List[UploadFile] = File(...),
    reptile_id: UUID,
    category: str = "general",
    caption: Optional[str] = None,
    health_record_id: Optional[UUID] = None,
    feeding_log_id: Optional[UUID] = None,
    weight_log_id: Optional[UUID] = None,
    misting_log_id: Optional[UUID] = None,
):
    """
    Upload 1-3 photos at once

    Steps:
    1. Validate file types (JPEG, PNG, WebP)
    2. Validate file sizes (max 10MB each)
    3. Check user has access to reptile
    4. Generate UUID for each photo
    5. Save original to storage
    6. Generate thumbnail (300x300, preserving aspect ratio)
    7. Create database records
    8. Return photo metadata
    """
    pass
```

### Image Processing

```python
from PIL import Image, ImageOps
import io

def create_thumbnail(image_bytes: bytes, max_size: tuple = (300, 300)) -> bytes:
    """Create thumbnail preserving aspect ratio"""
    img = Image.open(io.BytesIO(image_bytes))

    # Auto-rotate based on EXIF
    img = ImageOps.exif_transpose(img)

    # Resize maintaining aspect ratio
    img.thumbnail(max_size, Image.Lanczos)

    # Save as JPEG (smaller size)
    output = io.BytesIO()
    img.save(output, format='JPEG', quality=85, optimize=True)
    return output.getvalue()

def compress_image(image_bytes: bytes, max_width: int = 2000) -> bytes:
    """Compress and resize image to reasonable size"""
    img = Image.open(io.BytesIO(image_bytes))

    # Auto-rotate based on EXIF
    img = ImageOps.exif_transpose(img)

    # Resize if too large
    if img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.Lanczos)

    # Save as JPEG with compression
    output = io.BytesIO()
    img.save(output, format='JPEG', quality=85, optimize=True)
    return output.getvalue()
```

---

## Frontend Components

### PhotoUpload Component

```jsx
// src/components/PhotoUpload.jsx
import { Camera, Upload, X } from 'lucide-react';

const PhotoUpload = ({
  reptileId,
  category = 'general',
  maxPhotos = 3,
  onUploadComplete,
  existingPhotos = []
}) => {
  const [previews, setPreviews] = useState([]);
  const fileInputRef = useRef();
  const cameraInputRef = useRef();

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);

    // Validate count
    if (previews.length + files.length > maxPhotos) {
      alert(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    // Generate previews
    const newPreviews = files.map(file => ({
      file,
      url: URL.createObjectURL(file),
      caption: ''
    }));

    setPreviews([...previews, ...newPreviews]);
  };

  const removePreview = (index) => {
    const newPreviews = [...previews];
    URL.revokeObjectURL(newPreviews[index].url);
    newPreviews.splice(index, 1);
    setPreviews(newPreviews);
  };

  const uploadPhotos = async () => {
    const formData = new FormData();
    previews.forEach(preview => {
      formData.append('files', preview.file);
    });
    formData.append('reptile_id', reptileId);
    formData.append('category', category);

    const response = await fetch('/api/photos/upload', {
      method: 'POST',
      body: formData
    });

    const photos = await response.json();
    onUploadComplete(photos);
    setPreviews([]);
  };

  return (
    <div className="space-y-4">
      {/* Preview Grid */}
      <div className="grid grid-cols-3 gap-2">
        {previews.map((preview, idx) => (
          <div key={idx} className="relative aspect-square">
            <img
              src={preview.url}
              className="w-full h-full object-cover rounded-lg"
              alt={`Preview ${idx + 1}`}
            />
            <button
              onClick={() => removePreview(idx)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Upload Buttons */}
      {previews.length < maxPhotos && (
        <div className="flex gap-2">
          {/* Desktop: File picker */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <Upload size={18} /> Choose Photos
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Mobile: Camera */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            <Camera size={18} /> Take Photo
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"  {/* Use rear camera */}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Upload Button */}
      {previews.length > 0 && (
        <button
          onClick={uploadPhotos}
          className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Upload {previews.length} Photo{previews.length > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
};
```

### ReptileAvatar Component

```jsx
// src/components/ReptileAvatar.jsx
const ReptileAvatar = ({ reptile, size = 'md', className = '' }) => {
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl'
  };

  return (
    <div className={`${sizeClasses[size]} ${className} relative flex-shrink-0`}>
      {reptile.avatar_photo_url ? (
        <img
          src={reptile.avatar_photo_url}
          alt={reptile.name}
          className="w-full h-full rounded-full object-cover ring-2 ring-green-500"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold">
          {reptile.name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
};
```

**Avatar Integration Points:**
- ✅ Reptile cards on dashboard
- ✅ Reptile list page
- ✅ Reptile detail page (larger avatar)
- ✅ Dropdowns (feeding log, schedule forms)
- ✅ Calendar events
- ✅ Recent activity feed
- ✅ Navigation breadcrumbs
- ✅ Settings household member list

### Photo Gallery Page

```jsx
// src/pages/PhotoGallery.jsx
import { useState } from 'react';
import PhotoLightbox from '../components/PhotoLightbox';

const PhotoGallery = ({ reptileId }) => {
  const [category, setCategory] = useState('all');
  const [photos, setPhotos] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const categories = [
    { value: 'all', label: 'All Photos' },
    { value: 'health', label: 'Health' },
    { value: 'weight', label: 'Weight' },
    { value: 'feeding', label: 'Feeding' },
    { value: 'enclosure', label: 'Enclosure' },
    { value: 'general', label: 'General' }
  ];

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Photo Gallery</h1>
        <button className="px-4 py-2 bg-green-500 text-white rounded">
          Upload Photos
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {categories.map(cat => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`px-4 py-2 rounded ${
              category === cat.value
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {photos.map((photo, idx) => (
          <div
            key={photo.id}
            onClick={() => setLightboxIndex(idx)}
            className="aspect-square cursor-pointer hover:opacity-75 transition-opacity"
          >
            <img
              src={photo.thumbnail_url}
              alt={photo.caption || `Photo ${idx + 1}`}
              className="w-full h-full object-cover rounded-lg"
            />
            {photo.caption && (
              <p className="text-xs mt-1 truncate text-gray-600 dark:text-gray-400">
                {photo.caption}
              </p>
            )}
            <p className="text-xs text-gray-500">
              {new Date(photo.uploaded_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {photos.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No photos yet. Upload your first photo!</p>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDelete={(photoId) => {/* handle delete */}}
        />
      )}
    </div>
  );
};
```

### Photo Lightbox Component

```jsx
// src/components/PhotoLightbox.jsx
import { X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

const PhotoLightbox = ({ photos, currentIndex, onClose, onDelete }) => {
  const [index, setIndex] = useState(currentIndex);
  const photo = photos[index];

  const handlePrevious = () => {
    setIndex(index > 0 ? index - 1 : photos.length - 1);
  };

  const handleNext = () => {
    setIndex(index < photos.length - 1 ? index + 1 : 0);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300"
      >
        <X size={32} />
      </button>

      {/* Previous Button */}
      <button
        onClick={handlePrevious}
        className="absolute left-4 text-white hover:text-gray-300"
      >
        <ChevronLeft size={48} />
      button>

      {/* Next Button */}
      <button
        onClick={handleNext}
        className="absolute right-4 text-white hover:text-gray-300"
      >
        <ChevronRight size={48} />
      </button>

      {/* Image */}
      <div className="max-w-7xl max-h-screen p-4">
        <img
          src={photo.file_url}
          alt={photo.caption}
          className="max-w-full max-h-full object-contain"
        />

        {/* Caption */}
        {photo.caption && (
          <div className="text-center text-white mt-4">
            <p className="text-lg">{photo.caption}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="text-center text-gray-400 mt-2">
          <p className="text-sm">
            {new Date(photo.uploaded_at).toLocaleString()} • {photo.category}
          </p>
          <p className="text-sm">
            {index + 1} of {photos.length}
          </p>
        </div>

        {/* Delete Button */}
        <div className="text-center mt-4">
          <button
            onClick={() => onDelete(photo.id)}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-2 mx-auto"
          >
            <Trash2 size={16} /> Delete Photo
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## Implementation Phases

### Phase 1A: Core Infrastructure (Week 1)
- [ ] Create Alembic migration for `photos` table
- [ ] Set up storage backend (Ceph PVC)
- [ ] Backend: Photo upload endpoint with image processing (PIL)
- [ ] Backend: Photo retrieval endpoints (file serving with caching)
- [ ] Backend: Photo deletion with file cleanup
- [ ] Backend: Dependencies (pillow, python-multipart)

**Deliverables:**
- Working photo upload API
- Image compression and thumbnail generation
- File storage on Ceph

### Phase 1B: Avatar System (Week 1-2)
- [ ] Migration: Add `avatar_photo_id` to reptiles table
- [ ] Backend: Endpoint to set avatar (select existing OR upload new)
- [ ] Backend: Include avatar_photo_url in reptile responses
- [ ] Frontend: ReptileAvatar component
- [ ] Frontend: Integrate avatars into all UI locations:
  - [ ] Dashboard reptile cards
  - [ ] Reptile list page
  - [ ] Reptile detail page header
  - [ ] Feeding log reptile dropdown
  - [ ] Schedule form reptile dropdown
  - [ ] Calendar event displays
  - [ ] Recent activity feed
  - [ ] Settings household members

**Deliverables:**
- Avatar system fully integrated across UI
- Fallback to letter avatars for reptiles without photos

### Phase 1C: Photo Upload in Logs (Week 2)
- [ ] Frontend: PhotoUpload component with camera support
- [ ] Frontend: Integrate into Health Log form (2-3 photos)
- [ ] Frontend: Integrate into Weight Log form (2-3 photos)
- [ ] Frontend: Integrate into Feeding Log form (2-3 photos)
- [ ] Frontend: Display photos in log detail views
- [ ] Frontend: Photo thumbnail grid in log listings
- [ ] Backend: Update log endpoints to include photo relationships

**Deliverables:**
- All log types support photo uploads
- Mobile camera integration working
- Photos displayed in log views

### Phase 1D: Photo Gallery (Week 2-3)
- [ ] Frontend: Photo Gallery page with category filtering
- [ ] Frontend: PhotoLightbox component for full-size viewing
- [ ] Frontend: Standalone photo upload (not tied to logs)
- [ ] Frontend: Photo management UI:
  - [ ] Edit caption
  - [ ] Change category
  - [ ] Delete photo
  - [ ] Move to different log (optional)
- [ ] Backend: Photo update endpoint (caption, category, tags)
- [ ] Backend: Paginated photo list endpoint

**Deliverables:**
- Full photo gallery with filtering
- Standalone photo management
- Photo editing capabilities

### Phase 1E: Dashboard Integration (Week 3)
- [ ] Frontend: Latest Photo widget on dashboard
  - Show most recent 3-6 photos across all reptiles
  - Click to open lightbox
- [ ] Frontend: Weight chart photo integration
  - Display photo icon on chart points with photos
  - Hover/click to preview photo
  - Link to full-size view
- [ ] Frontend: Calendar event thumbnails
  - Small thumbnail on events with photos
  - Tooltip preview
- [ ] Backend: Optimize photo queries for dashboard

**Deliverables:**
- Dashboard photo widget
- Weight chart photo markers
- Calendar thumbnails

---

## Technical Considerations

### File Size & Compression
- **Max file size per upload**: 10MB (configurable)
- **Automatic compression**: Resize to max 2000px width, 85% JPEG quality
- **Thumbnail size**: 300x300px (preserving aspect ratio)
- **Supported formats**: JPEG, PNG, WebP
- **EXIF orientation**: Auto-rotate based on EXIF data

### Permissions
- **Upload**: Any household member with CARETAKER+ role
- **Delete**: Photo uploader OR household ADMIN+
- **View**: Any household member with access to reptile

### Mobile Considerations
- Use `capture="environment"` for rear camera by default
- Support direct camera capture on mobile
- Optimize image size before upload on slow connections
- Progressive image loading in galleries
- Touch-friendly lightbox controls

### Performance Optimization
- Lazy loading for photo galleries
- Thumbnail serving for list views
- HTTP caching headers for static images
- Consider CDN for future scaling
- Pagination for large photo collections

### Storage Path Structure
```
/photos/
  ├── {household_id}/
  │   ├── {reptile_id}/
  │   │   ├── {photo_uuid}.jpg         # Original
  │   │   ├── {photo_uuid}_thumb.jpg   # Thumbnail
  │   │   └── ...
```

---

## Configuration Requirements

### Backend Environment Variables
```env
# Storage Backend Selection
PHOTO_STORAGE_BACKEND=local  # Options: local, s3, nfs, hybrid

# Local/Ceph PVC Storage
LOCAL_STORAGE_PATH=/app/photos

# S3 Storage (NAS S3, MinIO, AWS)
S3_ENDPOINT=https://your-nas-s3.local:9000
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_BUCKET=reptile-photos
S3_REGION=us-east-1  # Optional, defaults to us-east-1

# NFS Storage
NFS_MOUNT_PATH=/mnt/nas-photos

# Image Processing
MAX_PHOTO_SIZE_MB=10
MAX_PHOTO_WIDTH=2000
JPEG_QUALITY=85
THUMBNAIL_SIZE=300

# Limits
MAX_PHOTOS_PER_LOG=3
ALLOW_CARETAKER_DELETE_OTHERS=false
```

### Kubernetes Resources

**Note**: Existing PVC already configured in helmrelease at 5Gi.

#### Option A: Use Existing 5Gi PVC (for initial testing)
- **Capacity**: ~12,000 photos (sufficient for most users)
- **No changes needed**: Use existing PVC mount
- **Upgrade later**: Expand PVC to 50Gi when needed

#### Option B: Expand Existing PVC to 50Gi
```yaml
# In kubernetes/apps/default/reptile-tracker/app/helmrelease.yaml
# Update existing PVC size:
spec:
  resources:
    requests:
      storage: 50Gi  # Increase from 5Gi
```

#### Option C: Add Additional PVCs for Multi-Backend
```yaml
# Add to helmrelease for S3 or NFS storage if using hybrid mode
volumes:
  - name: photos-local  # Existing 5Gi for thumbnails
    persistentVolumeClaim:
      claimName: reptile-tracker-pvc

  - name: photos-nas    # Optional: NAS NFS for full-size
    nfs:
      server: your-nas-ip
      path: /mnt/reptile-photos

volumeMounts:
  - name: photos-local
    mountPath: /app/photos

  - name: photos-nas
    mountPath: /mnt/nas-photos
```

**Recommendation**: Start with **Option A** (use existing 5Gi), then expand to 50Gi or add S3/NFS when needed.

### Python Dependencies
```txt
# Add to backend/requirements.txt
Pillow==10.2.0
python-multipart==0.0.6
```

---

## Python Dependencies

Add to `backend/requirements.txt`:
```txt
Pillow==10.2.0
python-multipart==0.0.6
boto3==1.34.34  # For S3 storage
```

---

## Storage Capacity Estimates

With the decided configuration (10MB upload → ~400KB stored):

### Per Photo Storage:
- **Upload size**: 3-8MB (typical phone photo)
- **Stored full-size**: ~400KB (after compression to 2000px @ 85% quality)
- **Stored thumbnail**: ~20KB (300x300px)
- **Total per photo**: ~420KB

### 50Gi Ceph PVC Capacity:
- **Full-size + thumbnails**: ~120,000 photos
- **Thumbnails only** (with S3/NFS for full-size): ~2.5 million photos

### Usage Projections:
- **Light use** (10 reptiles, 10 photos/year each): 100 photos/year = ~42MB/year
- **Medium use** (20 reptiles, 20 photos/year each): 400 photos/year = ~168MB/year
- **Heavy use** (50 reptiles, 50 photos/year each): 2,500 photos/year = ~1GB/year

**Conclusion**: 50Gi Ceph PVC provides ample storage for years of usage, even for large households.

---

## Success Metrics

### Technical Metrics
- Photo upload success rate > 95%
- Average upload time < 3 seconds (on average connection)
- Thumbnail generation < 500ms
- Gallery page load time < 2 seconds (for 100 photos)

### User Experience Metrics
- Mobile camera capture works reliably
- Avatar display on all reptile references
- Photo gallery accessible within 2 clicks from any page
- Responsive design works on mobile and desktop

### Storage Metrics
- Monitor storage usage growth
- Average photo size after compression
- Thumbnail storage efficiency

---

## Future Enhancements (Phase 2+)

### Growth Timeline Comparisons
- Side-by-side photo comparison UI
- "Then vs Now" slider widget
- Automatic milestone suggestions (1 month, 3 months, 6 months, 1 year)

### Before/After Shed Pairing
- Tag photos as "pre-shed" or "post-shed"
- Automatic pairing by date proximity
- Side-by-side shed comparison view

### Enclosure Documentation System
- Separate "Enclosure" category
- Track setup changes over time
- Equipment tracking integration
- Temperature gradient photo annotation

### Breeding Records Integration
- Pre-breeding condition photos
- Gravid documentation
- Egg/clutch photos
- Hatchling photos with genetics tracking

### Advanced Gallery Features
- Smart albums (auto-organize by event type, date)
- Slideshow mode
- Bulk photo operations (select multiple, batch delete/edit)
- Photo sharing (generate shareable links)

### AI/ML Features (Far Future)
- Auto-detect reptile in photo (for tagging)
- Body condition scoring assistance
- Pattern/morph identification
- Anomaly detection (health issues)

---

## Implementation Summary

### Decisions Finalized ✅

All key decisions have been made and documented:

1. **Storage**: Multi-backend support (Ceph PVC + S3 + NFS) with flexible configuration
2. **File Limits**: 10MB upload, 2000px max width, 85% JPEG quality, 3 photos per log
3. **Permissions**: CARETAKER+ can upload, only uploader/ADMIN+ can delete
4. **Mobile**: Rear camera default with native phone switching
5. **Capacity**: Existing 5Gi PVC sufficient for ~12,000 photos (expandable to 50Gi)

### Architecture Highlights

- ✅ **Standalone photos** not tied to log entries
- ✅ **Avatar system** integrated throughout UI
- ✅ **Multi-category support** (health, weight, feeding, enclosure, general)
- ✅ **Storage abstraction** allows switching backends via env vars
- ✅ **Automatic image processing** (compression, thumbnails, EXIF handling)
- ✅ **Mobile-first** photo capture workflow

### Ready to Implement

The plan is complete and ready for Phase 1A implementation:
1. Database migration for `photos` table
2. Storage abstraction layer (local/S3/NFS)
3. Backend upload/retrieval endpoints
4. Frontend photo upload components
5. Avatar integration across UI

---

## Next Steps

**Start with Phase 1A**: Core infrastructure (Week 1)
- Create Alembic migration for photos table
- Implement storage abstraction layer
- Build image processing pipeline
- Create upload/retrieval API endpoints

See **Implementation Phases** section above for detailed breakdown.

---

## Notes

- All photos are household-scoped for data isolation
- Photos can exist independently of log entries
- Soft delete recommended for photo retention (allow recovery)
- EXIF data preserved for metadata (taken_at, orientation)
- Mobile-first design for photo capture workflow
- Avatar system provides visual hierarchy throughout app
- Storage backend configurable via environment variables only (no code changes)
- Image processing is computationally cheap (~100-300ms per photo)
- Unlimited photos per household with automatic compression

**Document Version**: 2.0
**Last Updated**: 2025-12-09
**Status**: Ready for Implementation
