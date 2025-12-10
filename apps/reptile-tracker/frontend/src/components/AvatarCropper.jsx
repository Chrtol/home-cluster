import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, Check } from 'lucide-react';

/**
 * AvatarCropper component
 *
 * Provides a circular cropping interface for selecting avatar photos.
 * Features:
 * - Circular crop area with preview
 * - Zoom controls
 * - Visual blur effect outside crop area
 * - Returns cropped area coordinates for backend processing
 *
 * Props:
 * - imageUrl: URL of the image to crop
 * - onSave: Callback with crop data { x, y, width, height, zoom }
 * - onCancel: Callback when user cancels
 * - initialCrop: Initial crop position { x, y } (optional)
 * - initialZoom: Initial zoom level (optional)
 * - initialBorderColor: Initial border color hex (optional)
 */
const AvatarCropper = ({ imageUrl, onSave, onCancel, initialCrop, initialZoom, initialBorderColor }) => {
  const [crop, setCrop] = useState(initialCrop || { x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialZoom || 1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [borderColor, setBorderColor] = useState(initialBorderColor || '#10b981'); // Default green

  // Preset color options
  const colorOptions = [
    { color: '#10b981', label: 'Green' },
    { color: '#3b82f6', label: 'Blue' },
    { color: '#ef4444', label: 'Red' },
    { color: '#f59e0b', label: 'Orange' },
    { color: '#8b5cf6', label: 'Purple' },
    { color: '#ec4899', label: 'Pink' },
    { color: '#14b8a6', label: 'Teal' },
    { color: '#f97316', label: 'Amber' },
    { color: '#64748b', label: 'Gray' },
  ];

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = () => {
    if (croppedAreaPixels) {
      onSave({
        x: croppedAreaPixels.x,
        y: croppedAreaPixels.y,
        width: croppedAreaPixels.width,
        height: croppedAreaPixels.height,
        zoom,
        borderColor
      });
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 1));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-white">Crop Avatar</h2>
        <button
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="Close cropper"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Cropper Area */}
      <div className="flex-1 relative">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          style={{
            containerStyle: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
            },
            mediaStyle: {
              // Add a subtle filter to make the non-cropped area appear dimmer
            },
            cropAreaStyle: {
              border: '2px solid #10b981',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            }
          }}
        />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border-t border-gray-700 p-4">
        {/* Instructions */}
        <p className="text-sm text-gray-400 text-center mb-4">
          Drag to reposition • Scroll or pinch to zoom • Selected area will be your avatar
        </p>

        {/* Zoom Controls */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            className="p-2 text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>

          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-64 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            aria-label="Zoom slider"
          />

          <button
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            className="p-2 text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>

        {/* Color Picker */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-white mb-2 text-center">
            Avatar Border Color
          </label>
          <div className="flex justify-center gap-2 flex-wrap">
            {colorOptions.map(option => (
              <button
                key={option.color}
                onClick={() => setBorderColor(option.color)}
                className={`w-10 h-10 rounded-full border-4 transition-all ${
                  borderColor === option.color
                    ? 'border-white scale-110'
                    : 'border-gray-600 hover:border-gray-400'
                }`}
                style={{ backgroundColor: option.color }}
                title={option.label}
                aria-label={`Select ${option.label} border`}
              />
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-2 text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <Check className="w-5 h-5" />
            Set as Avatar
          </button>
        </div>
      </div>

      {/* Custom CSS for slider */}
      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #10b981;
          cursor: pointer;
          border-radius: 50%;
        }
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #10b981;
          cursor: pointer;
          border-radius: 50%;
          border: none;
        }
      `}</style>
    </div>
  );
};

export default AvatarCropper;
