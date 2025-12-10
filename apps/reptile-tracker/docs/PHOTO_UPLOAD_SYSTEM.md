# Photo Upload & Gallery System

## Overview

The Photo Upload & Gallery system provides comprehensive photo management for reptiles, including upload, gallery viewing, avatar management with cropping, and category organization. The system preserves original image quality while generating efficient thumbnails for gallery display.

**Status**: ✅ Phases 1 & 2 COMPLETED (2025-12-10)

---

## Architecture

### Database Schema

#### Photos Table
```sql
CREATE TABLE photos (
    id UUID PRIMARY KEY,                    -- UUID for robust identification
    household_id INTEGER NOT NULL,          -- Links to households table
    reptile_id INTEGER,                     -- Links to reptiles table (nullable)
    category VARCHAR(50) NOT NULL,          -- general, health, weight, feeding, enclosure
    file_path TEXT NOT NULL,                -- Relative path from storage root
    thumbnail_path TEXT,                    -- Path to 300px thumbnail
    mime_type VARCHAR(100) NOT NULL,        -- image/jpeg, image/png, image/webp
    file_size_bytes INTEGER NOT NULL,       -- Original file size
    width INTEGER,                          -- Image dimensions
    height INTEGER,
    caption TEXT,                           -- User-provided caption
    uploaded_by_user_id INTEGER NOT NULL,  -- Links to users table
    uploaded_at TIMESTAMP NOT NULL,         -- Upload timestamp
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

#### Reptiles Table (Avatar Fields)
```sql
ALTER TABLE reptiles ADD COLUMN avatar_photo_id UUID;
ALTER TABLE reptiles ADD COLUMN avatar_crop_x INTEGER;
ALTER TABLE reptiles ADD COLUMN avatar_crop_y INTEGER;
ALTER TABLE reptiles ADD COLUMN avatar_crop_width INTEGER;
ALTER TABLE reptiles ADD COLUMN avatar_crop_height INTEGER;
ALTER TABLE reptiles ADD COLUMN avatar_crop_zoom FLOAT;          -- Migration 0075
ALTER TABLE reptiles ADD COLUMN avatar_image_pos_x FLOAT;        -- Migration 0076
ALTER TABLE reptiles ADD COLUMN avatar_image_pos_y FLOAT;        -- Migration 0076
ALTER TABLE reptiles ADD COLUMN avatar_border_color VARCHAR(7);  -- Hex color (#10b981)
```

**Key Design Decisions:**
- **UUID Primary Keys**: Robust identification, no sequential ID exposure
- **Household Organization**: Photos belong to households for multi-user access control
- **Optional Reptile Link**: Household-wide photos don't require reptile association
- **Category System**: Flexible organization without rigid foreign keys

---

## Storage System

### Storage Backend Configuration

The system supports multiple storage backends configured via `PHOTO_STORAGE_BACKEND` environment variable:

```python
# Backend: app/config.py
PHOTO_STORAGE_BACKEND: str = "local"  # Options: local, s3, nfs, hybrid

# Local storage
PHOTO_STORAGE_PATH: str = "./photos"

# S3 storage
S3_BUCKET_NAME: Optional[str] = None
S3_ENDPOINT_URL: Optional[str] = None
S3_ACCESS_KEY: Optional[str] = None
S3_SECRET_KEY: Optional[str] = None
S3_REGION: Optional[str] = None

# NFS storage
NFS_MOUNT_PATH: Optional[str] = None
```

### Storage Organization

```
photos/
└── household_{household_id}/
    └── reptile_{reptile_id}/
        ├── {uuid}_original.jpg       # Original image (no re-encoding)
        ├── {uuid}_original.png
        ├── {uuid}_original.webp
        └── {uuid}_thumb.jpg          # 300px thumbnail (JPEG)
```

**Benefits:**
- Logical organization by household and reptile
- Easy backup and migration per household
- Simple permission scoping at directory level
- Original format preserved in filename

---

## Image Processing

### Quality Preservation Strategy

The system implements intelligent image processing to preserve maximum quality:

```python
# Backend: app/routers/photos.py (lines 90-140)

# 1. Original Image Handling
if format in ['JPEG', 'PNG'] and not has_exif_rotation:
    # Save original bytes WITHOUT re-encoding
    with open(file_path, 'wb') as f:
        f.write(image_bytes)
else:
    # Only re-encode if necessary (rotation or WebP)
    image.save(
        file_path,
        format=format,
        quality=100,              # Maximum quality for JPEG
        optimize=False,           # No optimization
        subsampling=0             # 4:4:4 chroma (best quality)
    )

# 2. Thumbnail Generation
# Always create JPEG thumbnail for consistency and efficiency
thumbnail.save(
    thumb_path,
    'JPEG',
    quality=85,                   # Good quality/size balance
    optimize=True
)
```

**Key Principles:**
1. **No Re-encoding**: JPEG and PNG files saved as-is if no rotation needed
2. **Maximum Quality**: When re-encoding required, use highest quality settings
3. **Efficient Thumbnails**: JPEG thumbnails at 300px with quality=85
4. **EXIF Awareness**: Auto-rotate based on EXIF orientation, then strip EXIF

### Supported Formats

| Format | Upload | Original Quality | Thumbnail |
|--------|--------|------------------|-----------|
| JPEG   | ✅ Yes  | 100% (no re-encode) | JPEG 85% |
| PNG    | ✅ Yes  | Lossless (no re-encode) | JPEG 85% |
| WebP   | ✅ Yes  | Lossless re-encode | JPEG 85% |

**File Size Limits:**
- Maximum upload: 10 MB per file
- Enforced at API level with 413 Payload Too Large response

---

## Avatar System

### Avatar Cropping Workflow

```
1. User uploads photo → Photo saved with UUID
2. User sets as avatar → Opens AvatarCropper modal
3. User adjusts crop area → Positions image and selects border color
4. User clicks "Set as Avatar" → Sends crop coordinates to backend
5. Backend generates circular avatar → Saves crop settings to reptile record
6. Frontend displays avatar → ReptileAvatar component renders with border
```

### Avatar Crop Data

```typescript
// Frontend: AvatarCropper.jsx saves this data
{
  x: 150,                    // Crop area X (pixels)
  y: 200,                    // Crop area Y (pixels)
  width: 500,                // Crop area width (pixels)
  height: 500,               // Crop area height (pixels)
  zoom: 1.5,                 // Zoom level (1.0-3.0)
  imagePosX: -10.5,          // Image position X (percentage)
  imagePosY: 5.2,            // Image position Y (percentage)
  borderColor: "#3b82f6"     // Hex color for border
}
```

**Backend Processing:**
```python
# Backend: app/routers/reptiles.py (lines 180-230)

# 1. Extract circular crop from photo
left = crop_x
top = crop_y
right = crop_x + crop_width
bottom = crop_y + crop_height
cropped = original_image.crop((left, top, right, bottom))

# 2. Create circular mask
mask = Image.new('L', (crop_width, crop_height), 0)
draw = ImageDraw.Draw(mask)
draw.ellipse((0, 0, crop_width, crop_height), fill=255)

# 3. Apply mask and save
output = Image.new('RGBA', (crop_width, crop_height), (0, 0, 0, 0))
output.paste(cropped, (0, 0))
output.putalpha(mask)
output.save(avatar_path, 'PNG')  # PNG for transparency
```

### Avatar Display

The `ReptileAvatar` component handles avatar display with automatic fallback:

```jsx
// Frontend: components/ReptileAvatar.jsx

const ReptileAvatar = ({ reptile, size = 'md', className = '' }) => {
  const [imageError, setImageError] = useState(false);

  const hasAvatar = reptile?.avatar_photo_url && !imageError;
  const initial = reptile?.name?.charAt(0)?.toUpperCase() || '?';
  const borderColor = reptile?.avatar_border_color || '#10b981';

  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden`}
      style={{ boxShadow: `0 0 0 2px ${borderColor}` }}
    >
      {hasAvatar ? (
        <img
          src={reptile.avatar_photo_url}
          alt={`${reptile.name} avatar`}
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="font-bold text-white">{initial}</span>
      )}
    </div>
  );
};
```

**Features:**
- Automatic fallback to initials if avatar fails to load
- Custom border color per reptile
- Responsive sizing (xs, sm, md, lg, xl)
- Error handling with `onError` callback

---

## Frontend Components

### 1. PhotoUpload Component

**Purpose**: Handle photo uploads via file selection or camera capture

```jsx
// Frontend: components/PhotoUpload.jsx

<PhotoUpload
  reptileId={reptileId}
  category="general"        // general, health, weight, feeding, enclosure
  onUploadSuccess={handleSuccess}
  onUploadError={handleError}
/>
```

**Features:**
- File selection button (desktop/mobile)
- Camera capture button (mobile only with `capture="environment"`)
- Drag-and-drop support
- Upload progress indicator
- File validation (type, size)
- Error handling with user-friendly messages

**Implementation Details:**
```jsx
const handleFileSelect = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    setError('Please select an image file');
    return;
  }

  // Validate file size (10MB)
  if (file.size > 10 * 1024 * 1024) {
    setError('File size must be less than 10MB');
    return;
  }

  // Upload via FormData
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  formData.append('reptile_id', reptileId);

  const response = await axios.post('/api/photos', formData);
  onUploadSuccess(response.data);
};
```

### 2. PhotoGallery Component

**Purpose**: Grid display of photos with filtering and actions

```jsx
// Frontend: components/PhotoGallery.jsx

<PhotoGallery
  reptileId={reptileId}
  currentAvatarId={avatarPhotoId}
  avatarCropSettings={cropSettings}    // For re-opening cropper
  onPhotoClick={handlePhotoClick}
  onSetAvatar={handleSetAvatar}
  onPhotoDeleted={handlePhotoDeleted}
  refreshTrigger={refreshTrigger}      // Increment to reload
/>
```

**Features:**
- Responsive grid layout (3-4 columns on desktop, 2 on mobile)
- Category filtering with dropdown
- Hover overlay showing:
  - Upload date (top left)
  - Download button (top right)
  - Action buttons (set avatar, edit, delete)
- Empty state with friendly messaging
- Loading states with skeleton placeholders

**Grid Layout:**
```jsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {photos.map(photo => (
    <div key={photo.id} className="relative group aspect-square">
      {/* Thumbnail */}
      <img
        src={photo.thumbnail_url}
        className="w-full h-full object-cover rounded-lg"
      />

      {/* Hover Overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100">
        {/* Upload date top-left */}
        {/* Download button top-right */}
        {/* Action buttons center */}
      </div>
    </div>
  ))}
</div>
```

### 3. PhotoLightbox Component

**Purpose**: Full-screen photo viewer with navigation and actions

```jsx
// Frontend: components/PhotoLightbox.jsx

<PhotoLightbox
  photos={allPhotos}
  initialPhotoId={selectedPhotoId}
  currentAvatarId={avatarPhotoId}
  avatarCropSettings={cropSettings}
  onClose={handleClose}
  onSetAvatar={handleSetAvatar}
  onPhotoDeleted={handleDeleted}
/>
```

**Features:**
- Full-screen overlay with dark backdrop
- Keyboard navigation (arrow keys, ESC)
- Touch/swipe gestures (mobile)
- Photo counter (e.g., "3 / 15")
- Action buttons:
  - Set as Avatar
  - Edit Caption
  - Download
  - Delete
- Caption display
- Next/Previous navigation

**Keyboard Controls:**
```jsx
useEffect(() => {
  const handleKeyDown = (e) => {
    switch(e.key) {
      case 'ArrowLeft': showPrevious(); break;
      case 'ArrowRight': showNext(); break;
      case 'Escape': onClose(); break;
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [currentIndex, photos]);
```

### 4. AvatarCropper Component

**Purpose**: Circular crop interface for selecting avatar area

```jsx
// Frontend: components/AvatarCropper.jsx

<AvatarCropper
  imageUrl={photoUrl}
  onSave={handleSave}              // Receives crop data
  onCancel={handleCancel}
  initialCrop={{ x: 0, y: 0 }}     // Restore previous crop
  initialZoom={1.0}                // Restore previous zoom
  initialBorderColor="#10b981"     // Restore previous color
/>
```

**Features:**
- Circular crop area preview
- Drag to reposition image
- Pinch/scroll to zoom (1.0x to 3.0x)
- Zoom controls (buttons and slider)
- Color picker for avatar border (12 preset colors)
- Visual blur effect outside crop area
- Responsive controls for mobile

**Library Used:**
```json
{
  "react-easy-crop": "^5.0.0"
}
```

**Crop Data Validation:**
```jsx
const handleSave = () => {
  // Validate croppedAreaPixels has valid numbers (not NaN)
  const hasValidPixels = croppedAreaPixels &&
    typeof croppedAreaPixels.x === 'number' &&
    !isNaN(croppedAreaPixels.x) &&
    !isNaN(croppedAreaPixels.y) &&
    // ... validate all fields

  if (hasValidPixels) {
    // Use pixel data directly
    finalCropData = {
      x: Math.round(croppedAreaPixels.x),
      y: Math.round(croppedAreaPixels.y),
      // ...
    };
  } else if (croppedArea && imageSize) {
    // Fallback: calculate from percentages
    finalCropData = {
      x: Math.round((croppedArea.x * imageSize.naturalWidth) / 100),
      // ...
    };
  }

  onSave(finalCropData);
};
```

---

## API Endpoints

### Photo Management

#### POST /api/photos
Upload a new photo

**Request:**
```http
POST /api/photos
Content-Type: multipart/form-data

file: <binary data>
reptile_id: 123
category: general
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "household_id": 1,
  "reptile_id": 123,
  "category": "general",
  "file_path": "photos/household_1/reptile_123/550e8400_original.jpg",
  "thumbnail_path": "photos/household_1/reptile_123/550e8400_thumb.jpg",
  "mime_type": "image/jpeg",
  "file_size_bytes": 2456789,
  "width": 3000,
  "height": 2000,
  "caption": null,
  "uploaded_at": "2025-12-10T20:15:30Z",
  "photo_url": "http://api/photos/550e8400-e29b-41d4-a716-446655440000/file",
  "thumbnail_url": "http://api/photos/550e8400-e29b-41d4-a716-446655440000/thumbnail"
}
```

#### GET /api/photos/reptile/{reptile_id}
List photos for a reptile with optional category filtering

**Query Parameters:**
- `category` (optional): Filter by category (general, health, weight, feeding, enclosure)

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "category": "general",
    "caption": "Basking after feeding",
    "uploaded_at": "2025-12-10T20:15:30Z",
    "photo_url": "...",
    "thumbnail_url": "..."
  }
]
```

#### GET /api/photos/{photo_id}/file
Get original photo file

**Response:** Binary image data with appropriate Content-Type header

#### GET /api/photos/{photo_id}/thumbnail
Get thumbnail (300px JPEG)

**Response:** Binary image data (image/jpeg)

#### PATCH /api/photos/{photo_id}
Update photo caption

**Request:**
```json
{
  "caption": "Updated caption text"
}
```

#### DELETE /api/photos/{photo_id}
Delete photo and associated files

**Response:** 204 No Content

### Avatar Management

#### POST /api/reptiles/{reptile_id}/avatar
Set reptile avatar from uploaded photo

**Request:**
```http
POST /api/reptiles/123/avatar
Content-Type: multipart/form-data

photo_id: 550e8400-e29b-41d4-a716-446655440000
crop_x: 150
crop_y: 200
crop_width: 500
crop_height: 500
zoom: 1.5
image_pos_x: -10.5
image_pos_y: 5.2
border_color: #3b82f6
```

**Response:**
```json
{
  "id": 123,
  "name": "Spyro",
  "avatar_photo_id": "550e8400-e29b-41d4-a716-446655440000",
  "avatar_photo_url": "http://api/reptiles/123/avatar",
  "avatar_crop_x": 150,
  "avatar_crop_y": 200,
  "avatar_crop_width": 500,
  "avatar_crop_height": 500,
  "avatar_crop_zoom": 1.5,
  "avatar_image_pos_x": -10.5,
  "avatar_image_pos_y": 5.2,
  "avatar_border_color": "#3b82f6"
}
```

#### GET /api/reptiles/{reptile_id}/avatar
Get reptile's circular avatar image

**Response:** PNG image with transparency (circular crop applied)

---

## Error Handling

### Frontend Error Scenarios

```jsx
// PhotoUpload.jsx
const [error, setError] = useState(null);

try {
  // Upload logic
} catch (err) {
  if (err.response?.status === 413) {
    setError('File size exceeds 10MB limit');
  } else if (err.response?.status === 400) {
    setError(err.response.data.detail || 'Invalid file');
  } else if (err.response?.status === 403) {
    setError('Permission denied');
  } else {
    setError('Upload failed. Please try again.');
  }
}
```

### Backend Error Responses

```python
# Backend: app/routers/photos.py

# File too large
raise HTTPException(status_code=413, detail="File size exceeds 10MB limit")

# Invalid file type
raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are supported")

# Permission denied
raise HTTPException(status_code=403, detail="You don't have permission to upload photos for this reptile")

# Photo not found
raise HTTPException(status_code=404, detail="Photo not found")
```

---

## Performance Considerations

### 1. Image Loading Optimization

```jsx
// Lazy loading with intersection observer
const [isVisible, setIsVisible] = useState(false);
const imageRef = useRef();

useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      setIsVisible(true);
      observer.disconnect();
    }
  });

  if (imageRef.current) {
    observer.observe(imageRef.current);
  }

  return () => observer.disconnect();
}, []);

return (
  <div ref={imageRef}>
    {isVisible && <img src={photo.thumbnail_url} />}
  </div>
);
```

### 2. Thumbnail Strategy

- **Size**: 300px on longest side
- **Format**: Always JPEG (efficient, universally supported)
- **Quality**: 85% (good balance of quality and size)
- **Result**: ~20-50KB per thumbnail vs 1-5MB originals

### 3. Batch Loading

```jsx
// PhotoGallery.jsx loads photos in batches
const [page, setPage] = useState(1);
const PHOTOS_PER_PAGE = 20;

const loadMore = () => {
  setPage(prev => prev + 1);
};

// Infinite scroll or "Load More" button
```

---

## Security Considerations

### 1. Access Control

```python
# Backend: app/routers/photos.py

@router.post("")
async def upload_photo(
    reptile_id: int,
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check reptile access BEFORE allowing upload
    await check_reptile_access(db, current_user, reptile_id, AccessLevel.CARETAKER)

    # Proceed with upload...
```

**Access Levels:**
- **VIEWER**: Can view photos
- **CARETAKER**: Can upload and manage photos
- **MANAGER**: Can upload, manage, and set avatars
- **OWNER/ADMIN**: Full control

### 2. File Validation

```python
# Validate file type via mime type
if not content_type.startswith('image/'):
    raise HTTPException(status_code=400, detail="Only image files are allowed")

# Validate specific formats
allowed_types = ['image/jpeg', 'image/png', 'image/webp']
if content_type not in allowed_types:
    raise HTTPException(status_code=400, detail="Unsupported image format")

# Validate file size
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
if len(image_bytes) > MAX_FILE_SIZE:
    raise HTTPException(status_code=413, detail="File size exceeds 10MB limit")
```

### 3. Path Traversal Prevention

```python
# Use UUIDs for filenames (no user input)
filename = f"{photo.id}_{suffix}.{extension}"

# Construct path safely
file_path = os.path.join(
    config.PHOTO_STORAGE_PATH,
    f"household_{household_id}",
    f"reptile_{reptile_id}",
    filename
)

# Resolve to absolute path and validate
abs_path = os.path.abspath(file_path)
storage_root = os.path.abspath(config.PHOTO_STORAGE_PATH)
if not abs_path.startswith(storage_root):
    raise SecurityError("Invalid file path")
```

---

## Testing

### Manual Testing Checklist

**Photo Upload:**
- [ ] Upload JPEG photo (< 10MB)
- [ ] Upload PNG photo (< 10MB)
- [ ] Upload WebP photo
- [ ] Upload photo > 10MB (should fail with 413)
- [ ] Upload non-image file (should fail with 400)
- [ ] Upload via file selection (desktop)
- [ ] Upload via camera capture (mobile)
- [ ] Upload without reptile permission (should fail with 403)

**Gallery:**
- [ ] View photo grid
- [ ] Filter by category (All, General, Health, Weight, Feeding, Enclosure)
- [ ] Click photo to open lightbox
- [ ] Hover to see upload date and download button
- [ ] Set photo as avatar
- [ ] Edit photo caption
- [ ] Delete photo
- [ ] Empty state displays correctly

**Lightbox:**
- [ ] Navigate with arrow keys
- [ ] Navigate with prev/next buttons
- [ ] Close with ESC key
- [ ] Close with X button
- [ ] Download photo
- [ ] Set as avatar from lightbox
- [ ] Delete from lightbox

**Avatar:**
- [ ] Open avatar cropper
- [ ] Drag to reposition
- [ ] Scroll/pinch to zoom
- [ ] Use zoom controls (buttons, slider)
- [ ] Select border color (12 preset colors)
- [ ] Save avatar crop
- [ ] Avatar displays in ReptileAvatar component
- [ ] Border color applies correctly
- [ ] Fallback to initials when no avatar
- [ ] Re-open cropper shows previous crop/zoom/color

**Quality:**
- [ ] Original JPEG preserved without re-encoding
- [ ] Original PNG preserved without re-encoding
- [ ] WebP converted to lossless format
- [ ] Thumbnails generated at 300px
- [ ] EXIF rotation applied correctly
- [ ] Avatar is circular with transparency

---

## Future Enhancements (Phase 3)

### Planned Features (Not Yet Implemented)

1. **Event Linking**
   - Link photos to specific events (feedings, weight logs, health records)
   - Thumbnail previews in activity logs
   - Before/after shed comparison view

2. **Growth Timeline**
   - Visual progression slider showing photos over time
   - Weight overlay on photo timeline
   - Morphological changes tracking

3. **Advanced Features**
   - Zoom functionality in lightbox (pan and zoom)
   - Batch operations (multi-select delete, category change)
   - Photo annotations (draw on photos to highlight features)
   - Photo sharing (generate public links)

4. **Search & Organization**
   - Tag system for photos
   - Search by caption text
   - Date range filtering
   - Smart albums (e.g., "Last 30 days", "Shed events")

---

## Troubleshooting

### Common Issues

**1. Avatar shows initials instead of photo**

**Cause**: Frontend only updated `avatar_photo_id` but not `avatar_photo_url`

**Fix**: Update both fields when setting avatar:
```jsx
setReptile({
  ...reptile,
  avatar_photo_id: photoId,
  avatar_photo_url: `/api/reptiles/${reptile.id}/avatar`
});
```

**2. Cropper shows NaN coordinates**

**Cause**: Invalid initial crop values passed to AvatarCropper

**Fix**: Validate crop values before passing:
```jsx
const validCrop = reptile.avatar_image_pos_x != null &&
  !isNaN(reptile.avatar_image_pos_x) &&
  !isNaN(reptile.avatar_image_pos_y)
    ? { x: reptile.avatar_image_pos_x, y: reptile.avatar_image_pos_y }
    : { x: 0, y: 0 };
```

**3. Photos not appearing after upload**

**Cause**: Gallery not refreshing after upload

**Fix**: Increment refresh trigger:
```jsx
const [refreshTrigger, setRefreshTrigger] = useState(0);

const handleUploadSuccess = () => {
  setRefreshTrigger(prev => prev + 1);  // Forces gallery reload
};
```

**4. Image quality loss**

**Cause**: Re-encoding JPEG/PNG when not necessary

**Fix**: Check format and EXIF before saving:
```python
if format in ['JPEG', 'PNG'] and not has_exif_rotation:
    # Save original bytes directly
    with open(file_path, 'wb') as f:
        f.write(image_bytes)
```

---

## Migration History

### Migration 0075: Add Avatar Crop Zoom
```python
def upgrade():
    op.add_column('reptiles', sa.Column('avatar_crop_zoom', sa.Float(), nullable=True))

    # Set default zoom of 1.0 for existing avatars
    op.execute("""
        UPDATE reptiles
        SET avatar_crop_zoom = 1.0
        WHERE avatar_crop_x IS NOT NULL
        AND avatar_crop_zoom IS NULL
    """)
```

### Migration 0076: Add Avatar Image Position
```python
def upgrade():
    # Store image position for re-initializing cropper UI
    op.add_column('reptiles', sa.Column('avatar_image_pos_x', sa.Float(), nullable=True))
    op.add_column('reptiles', sa.Column('avatar_image_pos_y', sa.Float(), nullable=True))
```

### Migration 0077: Add Avatar Border Color
```python
def upgrade():
    # Add border color column (hex color code)
    op.add_column('reptiles', sa.Column('avatar_border_color', sa.String(7), nullable=True))

    # Set default green color for existing avatars
    op.execute("""
        UPDATE reptiles
        SET avatar_border_color = '#10b981'
        WHERE avatar_photo_id IS NOT NULL
        AND avatar_border_color IS NULL
    """)
```

---

## Related Documentation

- **Backend Models**: `/backend/app/models.py` - Photo and Reptile models
- **Backend Routes**: `/backend/app/routers/photos.py` - Photo API endpoints
- **Frontend Components**: `/frontend/src/components/Photo*.jsx` - Photo UI components
- **Planning Document**: `/docs/PHOTO_UPLOAD_IMPLEMENTATION_PLAN.md` - Original planning (not all features implemented)

---

## Contributors

- Initial implementation: December 2025
- Photo quality preservation strategy
- Avatar cropping system
- Gallery and lightbox UI
