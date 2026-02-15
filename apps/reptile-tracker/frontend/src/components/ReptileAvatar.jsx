import { useState } from 'react';
import { Circle } from 'lucide-react';
import { startOfDay } from 'date-fns';
import { useCelebrations } from '../contexts/CelebrationContext';
import PartyHatIcon from './PartyHatIcon';

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
 * - dateOfBirth: Pass date_of_birth for birthday detection (optional, falls back to reptile.date_of_birth)
 */
const ReptileAvatar = ({
  reptile,
  size = 'md',
  className = '',
  showFallbackIcon = true,
  dateOfBirth = null,
}) => {
  const [imageError, setImageError] = useState(false);
  const { celebrationsEnabled } = useCelebrations();

  // Check if today is the reptile's birthday
  const isBirthday = () => {
    const dob = dateOfBirth || reptile?.date_of_birth || reptile?.hatch_date;
    if (!dob) return false;
    const today = startOfDay(new Date());
    const birthDate = new Date(dob);
    return today.getMonth() === birthDate.getMonth() &&
           today.getDate() === birthDate.getDate();
  };

  const showBirthdayHat = celebrationsEnabled && isBirthday();

  // Size mappings
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base',
    xl: 'w-24 h-24 text-2xl',
  };

  // Party hat size config based on avatar size
  // Using inline styles for precise positioning at top-left corner
  const hatConfig = {
    sm: { width: 20, height: 20, top: -8, left: -10 },
    md: { width: 28, height: 28, top: -12, left: -12 },
    lg: { width: 36, height: 36, top: -16, left: -14 },
    xl: { width: 56, height: 56, top: -26, left: -24 },
  };

  const hasAvatar = reptile?.avatar_photo_url && !imageError;
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const hat = hatConfig[size] || hatConfig.md;

  // Get first letter of reptile name for fallback
  const initial = reptile?.name?.charAt(0)?.toUpperCase() || '?';

  // Get border color if available
  const borderColor = reptile?.avatar_border_color || '#10b981'; // Default green

  return (
    <div className="relative w-fit">
      <div
        className={`${sizeClass} rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-green-400 to-green-600 dark:from-green-600 dark:to-green-800 ${className}`}
        style={{ boxShadow: `0 0 0 2px ${borderColor}` }}
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

      {/* Birthday hat overlay - positioned top-left corner, angled toward top-left */}
      {showBirthdayHat && (
        <PartyHatIcon
          className="absolute pointer-events-none drop-shadow-md"
          style={{
            width: hat.width,
            height: hat.height,
            top: hat.top,
            left: hat.left,
            transform: 'rotate(-40deg)',
          }}
        />
      )}
    </div>
  );
};

export default ReptileAvatar;
