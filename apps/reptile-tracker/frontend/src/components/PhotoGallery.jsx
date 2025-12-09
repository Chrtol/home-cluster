import { useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Trash2, Star, Edit2, Upload } from 'lucide-react';
import axios from 'axios';

/**
 * PhotoGallery component
 *
 * Displays a grid of photos for a reptile with filtering and management.
 *
 * Props:
 * - reptileId: ID of the reptile
 * - currentAvatarId: Current avatar photo ID
 * - onPhotoClick: Callback when photo is clicked (receives photo object)
 * - onSetAvatar: Callback when set avatar is clicked (receives photo ID)
 * - onPhotoDeleted: Callback when photo is deleted
 * - onPhotoUpdated: Callback when photo is updated
 * - className: Additional CSS classes
 */
const PhotoGallery = ({
  reptileId,
  currentAvatarId,
  onPhotoClick,
  onSetAvatar,
  onPhotoDeleted,
  onPhotoUpdated,
  className = ''
}) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingCaption, setEditingCaption] = useState(null);
  const [captionText, setCaptionText] = useState('');

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
  }, [reptileId, selectedCategory]);

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
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError('Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const handleSetAvatar = async (photoId) => {
    try {
      const formData = new FormData();
      formData.append('photo_id', photoId);

      await axios.post(`/api/photos/reptiles/${reptileId}/avatar`, formData);

      if (onSetAvatar) {
        onSetAvatar(photoId);
      }
    } catch (err) {
      console.error('Error setting avatar:', err);
      alert('Failed to set avatar');
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      await axios.delete(`/api/photos/${photoId}`);
      setPhotos(photos.filter(p => p.id !== photoId));

      if (onPhotoDeleted) {
        onPhotoDeleted(photoId);
      }
    } catch (err) {
      console.error('Error deleting photo:', err);
      alert(err.response?.data?.detail || 'Failed to delete photo');
    }
  };

  const handleStartEditCaption = (photo) => {
    setEditingCaption(photo.id);
    setCaptionText(photo.caption || '');
  };

  const handleSaveCaption = async (photoId) => {
    try {
      const response = await axios.patch(`/api/photos/${photoId}`, {
        caption: captionText
      });

      setPhotos(photos.map(p => p.id === photoId ? response.data : p));
      setEditingCaption(null);

      if (onPhotoUpdated) {
        onPhotoUpdated(response.data);
      }
    } catch (err) {
      console.error('Error updating caption:', err);
      alert('Failed to update caption');
    }
  };

  const handleCancelEdit = () => {
    setEditingCaption(null);
    setCaptionText('');
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-gray-500 dark:text-gray-400">Loading photos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`}>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <Camera className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No photos yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {selectedCategory === 'all'
            ? 'Start building your reptile\'s photo gallery!'
            : `No ${selectedCategory} photos yet.`
          }
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Category Filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === cat.value
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map(photo => (
          <div
            key={photo.id}
            className="group relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden"
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
              <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
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
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-end opacity-0 group-hover:opacity-100">
              <div className="w-full p-2 space-y-1">
                {/* Action Buttons */}
                <div className="flex gap-1">
                  {photo.id !== currentAvatarId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetAvatar(photo.id);
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
                    title="Edit caption"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePhoto(photo.id);
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
                      className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded border border-gray-300 dark:border-gray-600"
                      autoFocus
                    />
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

            {/* Uploaded Date */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-white text-xs">
                {new Date(photo.uploaded_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PhotoGallery;
