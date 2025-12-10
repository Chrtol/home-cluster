import { useState, useCallback, useMemo, useEffect } from 'react';
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
  // Validate initial crop values - reject if NaN or invalid
  const validInitialCrop = initialCrop &&
    !isNaN(initialCrop.x) &&
    !isNaN(initialCrop.y) &&
    typeof initialCrop.x === 'number' &&
    typeof initialCrop.y === 'number'
      ? initialCrop
      : { x: 0, y: 0 };

  console.log('AvatarCropper initialized with:', {
    initialCrop,
    validInitialCrop,
    initialZoom,
    initialBorderColor
  });

  const [crop, setCrop] = useState(validInitialCrop);
  const [zoom, setZoom] = useState(initialZoom || 1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedArea, setCroppedArea] = useState(null);
  const [borderColor, setBorderColor] = useState(initialBorderColor || '#10b981'); // Default green
  const [imageSize, setImageSize] = useState(null);

  // Preset color options (matches backend palette)
  const colorOptions = [
    { color: '#10b981', label: 'Emerald' },
    { color: '#3b82f6', label: 'Blue' },
    { color: '#f59e0b', label: 'Amber' },
    { color: '#8b5cf6', label: 'Purple' },
    { color: '#ec4899', label: 'Pink' },
    { color: '#06b6d4', label: 'Cyan' },
    { color: '#f97316', label: 'Orange' },
    { color: '#14b8a6', label: 'Teal' },
    { color: '#a855f7', label: 'Violet' },
    { color: '#84cc16', label: 'Lime' },
    { color: '#ef4444', label: 'Red' },
    { color: '#6366f1', label: 'Indigo' },
  ];

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    console.log('onCropComplete called with full details:', {
      croppedArea,
      croppedAreaPixels,
      'croppedArea.x': croppedArea?.x,
      'croppedArea.y': croppedArea?.y,
      'croppedArea.width': croppedArea?.width,
      'croppedArea.height': croppedArea?.height,
      'croppedAreaPixels.x': croppedAreaPixels?.x,
      'croppedAreaPixels.y': croppedAreaPixels?.y,
      'croppedAreaPixels.width': croppedAreaPixels?.width,
      'croppedAreaPixels.height': croppedAreaPixels?.height,
    });
    setCroppedArea(croppedArea);
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onMediaLoaded = useCallback((mediaSize) => {
    console.log('Media loaded with size:', mediaSize);
    setImageSize(mediaSize);
  }, []);

  // Debug: Monitor zoom changes
  useEffect(() => {
    console.log('Zoom state changed to:', zoom);
  }, [zoom]);

  const handleSave = () => {
    if (!croppedAreaPixels && !croppedArea) {
      console.error('Crop data not set yet');
      alert('Please wait for the image to load completely and adjust the crop area');
      return;
    }

    // Validate croppedAreaPixels has all required properties and they're valid numbers (not NaN)
    const hasValidPixels = croppedAreaPixels &&
      typeof croppedAreaPixels.x === 'number' &&
      typeof croppedAreaPixels.y === 'number' &&
      typeof croppedAreaPixels.width === 'number' &&
      typeof croppedAreaPixels.height === 'number' &&
      !isNaN(croppedAreaPixels.x) &&
      !isNaN(croppedAreaPixels.y) &&
      !isNaN(croppedAreaPixels.width) &&
      !isNaN(croppedAreaPixels.height);

    console.log('Validation check:', {
      croppedAreaPixels,
      croppedArea,
      imageSize,
      hasValidPixels,
      xValue: croppedAreaPixels?.x,
      yValue: croppedAreaPixels?.y,
      xIsNaN: isNaN(croppedAreaPixels?.x),
      yIsNaN: isNaN(croppedAreaPixels?.y)
    });

    let finalCropData;

    if (hasValidPixels) {
      // Use pixel data directly
      finalCropData = {
        x: Math.round(croppedAreaPixels.x),
        y: Math.round(croppedAreaPixels.y),
        width: Math.round(croppedAreaPixels.width),
        height: Math.round(croppedAreaPixels.height),
        zoom,
        imagePosX: crop.x,
        imagePosY: crop.y,
        borderColor
      };
    } else if (croppedArea && imageSize) {
      // Calculate pixel coordinates from percentage-based crop area
      console.log('Calculating pixels from percentages because pixel data is invalid');
      console.log('Using naturalWidth and naturalHeight for accurate conversion');
      finalCropData = {
        x: Math.round((croppedArea.x * imageSize.naturalWidth) / 100),
        y: Math.round((croppedArea.y * imageSize.naturalHeight) / 100),
        width: Math.round((croppedArea.width * imageSize.naturalWidth) / 100),
        height: Math.round((croppedArea.height * imageSize.naturalHeight) / 100),
        zoom,
        imagePosX: crop.x,
        imagePosY: crop.y,
        borderColor
      };
    } else {
      console.error('Unable to determine crop coordinates', {
        croppedAreaPixels,
        croppedArea,
        imageSize
      });
      alert('Unable to save crop settings. Please try adjusting the crop area again.');
      return;
    }

    console.log('Saving avatar with final crop data:', finalCropData);
    onSave(finalCropData);
  };

  const handleZoomIn = () => {
    setZoom(prev => {
      const newZoom = Math.min(prev + 0.1, 3);
      console.log('Zoom increased from', prev, 'to', newZoom);
      return newZoom;
    });
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const newZoom = Math.max(prev - 0.1, 1);
      console.log('Zoom decreased from', prev, 'to', newZoom);
      return newZoom;
    });
  };

  // Memoize the cropper style to ensure it updates when borderColor changes
  const cropperStyle = useMemo(() => ({
    containerStyle: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    mediaStyle: {},
    cropAreaStyle: {
      border: `2px solid ${borderColor}`,
      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
    }
  }), [borderColor]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex flex-col">
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
          onMediaLoaded={onMediaLoaded}
          style={cropperStyle}
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
