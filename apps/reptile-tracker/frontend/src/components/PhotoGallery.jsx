import { useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Trash2, Star, Edit2, Upload, Download } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import AvatarCropper from './AvatarCropper';
import { formatDate } from '../utils/dateFormatting';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * PhotoGallery component
 *
 * Displays a grid of photos for a reptile with filtering and management.
 *
 * Props:
 * - reptileId: ID of the reptile
 * - currentAvatarId: Current avatar photo ID
 * - avatarCropSettings: Object with crop and borderColor for avatar
 * - onPhotoClick: Callback when photo is clicked (receives photo object)
 * - onSetAvatar: Callback when set avatar is clicked (receives photo ID)
 * - onPhotoDeleted: Callback when photo is deleted
 * - onPhotoUpdated: Callback when photo is updated
 * - onPhotosLoaded: Callback when photos are loaded (receives photos array)
 * - refreshTrigger: Number that triggers refetch when changed
 * - className: Additional CSS classes
 */
const PhotoGallery = ({
  reptileId,
  currentAvatarId,
  avatarCropSettings,
  onPhotoClick,
  onSetAvatar,
  onPhotoDeleted,
  onPhotoUpdated,
  onPhotosLoaded,
  refreshTrigger = 0,
  className = ''
}) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingCaption, setEditingCaption] = useState(null);
  const [captionText, setCaptionText] = useState('');
  const [editingCategory, setEditingCategory] = useState('general');
  const [cropperPhoto, setCropperPhoto] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeletePhoto, setPendingDeletePhoto] = useState(null);

  const categories = [
    { value: 'all', label: 'All Photos' },
    { value: 'general', label: 'General' },
    { value: 'health', label: 'Health' },
    { value: 'weight', label: 'Weight' },
    { value: 'feeding', label: 'Feeding' },
    { value: 'enclosure', label: 'Enclosure' },
  ];

  useEffect(() => {
    if (reptileId) {
      fetchPhotos();
    }
  }, [reptileId, selectedCategory, refreshTrigger]);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }

      const response = await axios.get(`/api/photos/reptile/${reptileId}`, { params });
      setPhotos(response.data);

      // Also fetch all photos for lightbox navigation (parent needs full array)
      if (onPhotosLoaded) {
        if (selectedCategory === 'all') {
          // Already have all photos
          onPhotosLoaded(response.data);
        } else {
          // Fetch all photos separately for lightbox
          const allPhotosResponse = await axios.get(`/api/photos/reptile/${reptileId}`);
          onPhotosLoaded(allPhotosResponse.data);
        }
      }
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError('Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCropper = (photo) => {
    setCropperPhoto(photo);
  };

  const handleCloseCropper = () => {
    setCropperPhoto(null);
  };

  const handleSaveCroppedAvatar = async (cropData) => {
    try {
      console.log('PhotoGallery sending crop data:', cropData);

      const formData = new FormData();
      formData.append('photo_id', cropperPhoto.id);
      formData.append('crop_x', cropData.x);
      formData.append('crop_y', cropData.y);
      formData.append('crop_width', cropData.width);
      formData.append('crop_height', cropData.height);
      formData.append('zoom', cropData.zoom);
      formData.append('image_pos_x', cropData.imagePosX);
      formData.append('image_pos_y', cropData.imagePosY);
      formData.append('border_color', cropData.borderColor);

      await axios.post(`/api/photos/reptiles/${reptileId}/avatar`, formData);

      if (onSetAvatar) {
        onSetAvatar(cropperPhoto.id);
      }

      handleCloseCropper();
    } catch (err) {
      console.error('Error setting avatar:', err);
      console.error('Backend error details:', err.response?.data);
      toast.error(`Failed to set avatar: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleDeletePhotoClick = (photoId) => {
    setPendingDeletePhoto(photoId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeletePhoto) return;

    try {
      await axios.delete(`/api/photos/${pendingDeletePhoto}`);
      setPhotos(photos.filter(p => p.id !== pendingDeletePhoto));

      if (onPhotoDeleted) {
        onPhotoDeleted(pendingDeletePhoto);
      }
      toast.success('Photo deleted');
    } catch (err) {
      console.error('Error deleting photo:', err);
      toast.error(err.response?.data?.detail || 'Failed to delete photo');
    } finally {
      setDeleteDialogOpen(false);
      setPendingDeletePhoto(null);
    }
  };

  const handleStartEditCaption = (photo) => {
    setEditingCaption(photo.id);
    setCaptionText(photo.caption || '');
    setEditingCategory(photo.category || 'general');
  };

  const handleSaveCaption = async (photoId) => {
    try {
      const response = await axios.patch(`/api/photos/${photoId}`, {
        caption: captionText,
        category: editingCategory
      });

      setPhotos(photos.map(p => p.id === photoId ? response.data : p));
      setEditingCaption(null);

      if (onPhotoUpdated) {
        onPhotoUpdated(response.data);
      }
      toast.success('Photo updated');
    } catch (err) {
      console.error('Error updating photo:', err);
      toast.error('Failed to update photo');
    }
  };

  const handleCancelEdit = () => {
    setEditingCaption(null);
    setCaptionText('');
    setEditingCategory('general');
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-muted-foreground">Loading photos...</div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Category Filter */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {categories.map(cat => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className="group"
          >
            <Badge
              variant={selectedCategory === cat.value ? 'default' : 'secondary'}
              className={cn(
                'cursor-pointer transition-colors px-2 py-0.5',
                selectedCategory === cat.value && 'bg-primary hover:bg-primary/80',
                selectedCategory !== cat.value && 'hover:bg-secondary/80'
              )}
            >
              {cat.label}
            </Badge>
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!error && photos.length === 0 && (
        <div className="text-center py-12">
          <Camera className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No photos yet
          </h3>
          <p className="text-muted-foreground mb-4">
            {selectedCategory === 'all'
              ? 'Start building your reptile\'s photo gallery!'
              : `No ${selectedCategory} photos yet.`
            }
          </p>
        </div>
      )}

      {/* Photo Grid */}
      {!error && photos.length > 0 && (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {photos.map(photo => (
          <div
            key={photo.id}
            className="group relative bg-secondary rounded-lg overflow-hidden"
          >
            {/* Photo Image */}
            <div
              className="aspect-square cursor-pointer"
              onClick={() => onPhotoClick && onPhotoClick(photo)}
            >
              <img
                src={`/api/photos/${photo.id}/thumbnail`}
                alt={photo.caption || 'Photo'}
                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
              />
            </div>

            {/* Avatar Badge */}
            {photo.id === currentAvatarId && (
              <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 z-20">
                <Star size={12} fill="currentColor" />
                Avatar
              </div>
            )}

            {/* Category Badge */}
            {photo.category && photo.category !== 'general' && (
              <div className="absolute top-2 right-2 bg-gray-900/75 text-white text-xs px-2 py-1 rounded">
                {photo.category}
              </div>
            )}

            {/* Actions Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-end opacity-0 group-hover:opacity-100 pointer-events-none">
              <div className="w-full p-2 space-y-1 pointer-events-auto">
                {/* Action Buttons */}
                <div className="flex gap-1">
                  {photo.id !== currentAvatarId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCropper(photo);
                      }}
                      className="flex-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded flex items-center justify-center gap-1 transition-colors"
                      title="Set as avatar"
                    >
                      <Star size={12} />
                      Set Avatar
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEditCaption(photo);
                    }}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded flex items-center justify-center gap-1 transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePhotoClick(photo.id);
                    }}
                    className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded flex items-center justify-center gap-1 transition-colors"
                    title="Delete photo"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Caption */}
                {editingCaption === photo.id ? (
                  <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={captionText}
                      onChange={(e) => setCaptionText(e.target.value)}
                      placeholder="Add caption..."
                      className="w-full px-2 py-1 text-xs bg-card text-foreground rounded border border-border"
                      autoFocus
                    />
                    <select
                      value={editingCategory}
                      onChange={(e) => setEditingCategory(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-card text-foreground rounded border border-border"
                    >
                      {categories.filter(c => c.value !== 'all').map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleSaveCaption(photo.id)}
                        className="flex-1 px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : photo.caption ? (
                  <p className="text-white text-xs line-clamp-2 bg-black/50 rounded px-2 py-1">
                    {photo.caption}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Uploaded Date - Top Center */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/75 rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-white text-xs">
                {formatDate(photo.uploaded_at)}
              </p>
            </div>

            {/* Download Button - Top Right */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const link = document.createElement('a');
                link.href = `/api/photos/${photo.id}/file`;
                link.download = `photo-${photo.id}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="absolute top-2 right-2 bg-black/75 hover:bg-black/90 text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Download photo"
            >
              <Download size={16} />
            </button>
          </div>
        ))}
      </div>
      )}

      {/* Avatar Cropper Modal */}
      {cropperPhoto && (
        <AvatarCropper
          imageUrl={`/api/photos/${cropperPhoto.id}/file`}
          onSave={handleSaveCroppedAvatar}
          onCancel={handleCloseCropper}
          initialCrop={
            cropperPhoto.id === currentAvatarId && avatarCropSettings?.crop
              ? avatarCropSettings.crop
              : undefined
          }
          initialZoom={
            cropperPhoto.id === currentAvatarId && avatarCropSettings?.zoom
              ? avatarCropSettings.zoom
              : undefined
          }
          initialBorderColor={
            cropperPhoto.id === currentAvatarId && avatarCropSettings?.borderColor
              ? avatarCropSettings.borderColor
              : undefined
          }
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The photo will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeletePhoto(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PhotoGallery;
