import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader } from 'lucide-react';
import axios from 'axios';

/**
 * PhotoUpload component
 *
 * Handles photo uploads with support for:
 * - File selection from device
 * - Camera capture on mobile devices
 * - Image preview before upload
 * - Upload to backend with metadata
 *
 * Props:
 * - reptileId: ID of the reptile for the photo
 * - category: Photo category (e.g., 'general', 'health', 'weight')
 * - onUploadSuccess: Callback when upload completes (receives photo data)
 * - onCancel: Callback when user cancels
 * - allowCamera: Enable camera capture button (default true)
 * - className: Additional CSS classes
 */
const PhotoUpload = ({
  reptileId,
  category = 'general',
  onUploadSuccess,
  onCancel,
  allowCamera = true,
  className = ''
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(category);
  const [error, setError] = useState(null);

  const categories = [
    { value: 'general', label: 'General' },
    { value: 'health', label: 'Health' },
    { value: 'weight', label: 'Weight' },
    { value: 'feeding', label: 'Feeding' },
    { value: 'enclosure', label: 'Enclosure' },
  ];

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('File is too large. Maximum size is 10MB.');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a photo first');
      return;
    }

    // Validate reptileId
    if (!reptileId || isNaN(reptileId)) {
      console.error('Invalid reptileId:', reptileId);
      setError(`Invalid reptile ID: ${reptileId}`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('files', selectedFile);
      formData.append('reptile_id', reptileId);
      formData.append('category', selectedCategory);
      if (caption) {
        formData.append('caption', caption);
      }

      console.log('Uploading photo:', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        reptileId,
        category: selectedCategory,
        caption
      });

      // Upload to backend
      const response = await axios.post('/api/photos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Upload successful:', response.data);

      // Call success callback with the uploaded photo data
      if (onUploadSuccess && response.data.photos.length > 0) {
        onUploadSuccess(response.data.photos[0]);
      }

      // Reset state
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption('');
    } catch (err) {
      console.error('Upload error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      console.error('Error message:', err.message);
      setError(err.response?.data?.detail || err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption('');
    setSelectedCategory(category);
    setError(null);
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`}>
      {/* Upload buttons */}
      {!selectedFile && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <Upload size={20} />
              Choose Photo
            </button>

            {allowCamera && (
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                <Camera size={20} />
                Take Photo
              </button>
            )}

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Cancel button */}
          {onCancel && (
            <button
              type="button"
              onClick={handleCancel}
              className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Preview and upload */}
      {selectedFile && previewUrl && (
        <div className="space-y-3">
          {/* Image preview */}
          <div className="relative">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full max-h-64 object-contain rounded-lg bg-gray-100 dark:bg-gray-700"
            />
            <button
              type="button"
              onClick={handleCancel}
              className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
              aria-label="Remove photo"
            >
              <X size={20} />
            </button>
          </div>

          {/* Category selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Caption input */}
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption (optional)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
            >
              {uploading ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Upload
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={uploading}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;
