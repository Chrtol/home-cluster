import { useState } from 'react';
import { Lizard } from 'lucide-react';

/**
 * ReptileAvatar component
 *
 * Displays a reptile's avatar photo with fallback to a default icon.
 *
 * Props:
 * - reptile: The reptile object containing avatar_photo_url
 * - size: Size variant ('sm', 'md', 'lg', 'xl') - default 'md'
 * - className: Additional CSS classes
 * - showFallbackIcon: Whether to show icon when no avatar (default true)
 */
const ReptileAvatar = ({
  reptile,
  size = 'md',
  className = '',
  showFallbackIcon = true
}) => {
  const [imageError, setImageError] = useState(false);

  // Size mappings
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48,
  };

  const hasAvatar = reptile?.avatar_photo_url && !imageError;
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const iconSize = iconSizes[size] || iconSizes.md;

  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-green-400 to-green-600 dark:from-green-600 dark:to-green-800 ${className}`}
      title={reptile?.name}
    >
      {hasAvatar ? (
        <img
          src={reptile.avatar_photo_url}
          alt={`${reptile.name} avatar`}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : showFallbackIcon ? (
        <Lizard
          className="text-white opacity-80"
          size={iconSize}
        />
      ) : null}
    </div>
  );
};

export default ReptileAvatar;
