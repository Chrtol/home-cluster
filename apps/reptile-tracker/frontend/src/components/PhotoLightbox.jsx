import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Star, Edit2, Trash2, Download } from 'lucide-react';
import axios from 'axios';
import AvatarCropper from './AvatarCropper';

/**
 * PhotoLightbox component
 *
 * Full-screen photo viewer with navigation and actions.
 *
 * Props:
 * - photos: Array of photo objects
 * - initialPhotoId: ID of photo to show initially
 * - currentAvatarId: Current avatar photo ID
 * - onClose: Callback when lightbox is closed
 * - onSetAvatar: Callback when set avatar is clicked
 * - onPhotoDeleted: Callback when photo is deleted
 * - onPhotoUpdated: Callback when photo is updated
 */
const PhotoLightbox = ({
  photos,
  initialPhotoId,
  currentAvatarId,
  onClose,
  onSetAvatar,
  onPhotoDeleted,
  onPhotoUpdated,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [imageLoading, setImageLoading] = useState(true);
  const [showCropper, setShowCropper] = useState(false);

  const currentPhoto = photos[currentIndex];

  useEffect(() => {
    // Find initial photo index
    const index = photos.findIndex(p => p.id === initialPhotoId);
    if (index !== -1) {
      setCurrentIndex(index);
    }
  }, [initialPhotoId, photos]);

  useEffect(() => {
    // Handle keyboard navigation
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, photos]);

  useEffect(() => {
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    // Reset image loading state when photo changes
    setImageLoading(true);
  }, [currentIndex]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const handleOpenCropper = () => {
    setShowCropper(true);
  };

  const handleCloseCropper = () => {
    setShowCropper(false);
  };

  const handleSaveCroppedAvatar = async (cropData) => {
    if (!currentPhoto) return;

    try {
      const formData = new FormData();
      formData.append('photo_id', currentPhoto.id);
      formData.append('crop_x', cropData.x);
      formData.append('crop_y', cropData.y);
      formData.append('crop_width', cropData.width);
      formData.append('crop_height', cropData.height);
      formData.append('border_color', cropData.borderColor);

      await axios.post(`/api/photos/reptiles/${currentPhoto.reptile_id}/avatar`, formData);

      if (onSetAvatar) {
        onSetAvatar(currentPhoto.id);
      }

      handleCloseCropper();
    } catch (err) {
      console.error('Error setting avatar:', err);
      alert('Failed to set avatar');
    }
  };

  const handleDeletePhoto = async () => {
    if (!currentPhoto) return;

    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      await axios.delete(`/api/photos/${currentPhoto.id}`);

      if (onPhotoDeleted) {
        onPhotoDeleted(currentPhoto.id);
      }

      // Close lightbox if this was the last photo
      if (photos.length === 1) {
        onClose();
      } else {
        // Move to next photo or previous if at end
        if (currentIndex >= photos.length - 1) {
          setCurrentIndex(Math.max(0, currentIndex - 1));
        }
      }
    } catch (err) {
      console.error('Error deleting photo:', err);
      alert(err.response?.data?.detail || 'Failed to delete photo');
    }
  };

  const handleStartEditCaption = () => {
    setEditingCaption(true);
    setCaptionText(currentPhoto?.caption || '');
  };

  const handleSaveCaption = async () => {
    if (!currentPhoto) return;

    try {
      const response = await axios.patch(`/api/photos/${currentPhoto.id}`, {
        caption: captionText
      });

      setEditingCaption(false);

      if (onPhotoUpdated) {
        onPhotoUpdated(response.data);
      }
    } catch (err) {
      console.error('Error updating caption:', err);
      alert('Failed to update caption');
    }
  };

  const handleDownload = () => {
    if (!currentPhoto) return;

    const link = document.createElement('a');
    link.href = `/api/photos/${currentPhoto.id}/file`;
    link.download = `photo-${currentPhoto.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!currentPhoto) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <div className="flex items-center gap-4">
          <h2 className="text-white font-semibold">
            {currentIndex + 1} / {photos.length}
          </h2>
          {currentPhoto.id === currentAvatarId && (
            <div className="bg-blue-500 text-white text-sm font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <Star size={14} fill="currentColor" />
              Avatar
            </div>
          )}
          {currentPhoto.category && currentPhoto.category !== 'general' && (
            <div className="bg-gray-700 text-white text-sm px-3 py-1 rounded">
              {currentPhoto.category}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="text-white hover:text-gray-300 p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X size={24} />
        </button>
      </div>

      {/* Main Image Area */}
      <div
        className="flex-1 flex items-center justify-center p-4 relative overflow-hidden"
        onClick={(e) => {
          // Close on background click
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        {/* Previous Button */}
        {photos.length > 1 && (
          <button
            onClick={handlePrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors z-10"
            aria-label="Previous photo"
          >
            <ChevronLeft size={32} />
          </button>
        )}

        {/* Image */}
        <div className="relative w-full h-full flex items-center justify-center">
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white text-lg">Loading...</div>
            </div>
          )}
          <img
            src={`/api/photos/${currentPhoto.id}/file`}
            alt={currentPhoto.caption || 'Photo'}
            className="max-w-full max-h-full w-auto h-auto object-contain"
            onLoad={() => setImageLoading(false)}
          />
        </div>

        {/* Next Button */}
        {photos.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors z-10"
            aria-label="Next photo"
          >
            <ChevronRight size={32} />
          </button>
        )}
      </div>

      {/* Footer with Info and Actions */}
      <div className="bg-black/50 p-4 space-y-3">
        {/* Caption */}
        {editingCaption ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={captionText}
              onChange={(e) => setCaptionText(e.target.value)}
              placeholder="Add caption..."
              className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={handleSaveCaption}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setEditingCaption(false)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="text-white">
            {currentPhoto.caption ? (
              <p className="text-lg">{currentPhoto.caption}</p>
            ) : (
              <p className="text-gray-400 italic">No caption</p>
            )}
          </div>
        )}

        {/* Metadata and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Metadata */}
          <div className="text-gray-300 text-sm space-y-1">
            <p>Uploaded: {new Date(currentPhoto.uploaded_at).toLocaleString()}</p>
            {currentPhoto.taken_at && (
              <p>Taken: {new Date(currentPhoto.taken_at).toLocaleString()}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {currentPhoto.id !== currentAvatarId && (
              <button
                onClick={handleOpenCropper}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                <Star size={16} />
                Set as Avatar
              </button>
            )}
            <button
              onClick={handleStartEditCaption}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <Edit2 size={16} />
              Edit Caption
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <Download size={16} />
              Download
            </button>
            <button
              onClick={handleDeletePhoto}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Avatar Cropper Modal */}
      {showCropper && currentPhoto && (
        <AvatarCropper
          imageUrl={`/api/photos/${currentPhoto.id}/file`}
          onSave={handleSaveCroppedAvatar}
          onCancel={handleCloseCropper}
        />
      )}
    </div>
  );
};

export default PhotoLightbox;
