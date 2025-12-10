import { useState } from 'react';
import { Circle } from 'lucide-react';

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
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base',
    xl: 'w-24 h-24 text-2xl',
  };

  const hasAvatar = reptile?.avatar_photo_url && !imageError;
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  // Get first letter of reptile name for fallback
  const initial = reptile?.name?.charAt(0)?.toUpperCase() || '?';

  // Get border color if available
  const borderColor = reptile?.avatar_border_color || '#10b981'; // Default green

  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-green-400 to-green-600 dark:from-green-600 dark:to-green-800 ${className}`}
      style={hasAvatar ? {
        boxShadow: `0 0 0 2px ${borderColor}`
      } : undefined}
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
        <span className="font-bold text-white select-none">
          {initial}
        </span>
      ) : null}
    </div>
  );
};

export default ReptileAvatar;
