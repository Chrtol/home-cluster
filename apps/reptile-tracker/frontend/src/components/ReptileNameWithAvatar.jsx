import { motion } from 'framer-motion';
import ReptileAvatar from './ReptileAvatar';
import { cn } from '@/lib/utils';

/**
 * ReptileNameWithAvatar - The standard way to display a reptile reference
 *
 * Addresses HIGH PRIORITY locked decision: "Reptile photo/avatar MUST appear
 * next to the reptile name every time it's mentioned."
 *
 * Use this component everywhere a reptile is referenced:
 * - Dashboard cards
 * - Calendar event modals
 * - List views
 * - Detail page headers
 * - Dropdowns/selectors
 * - Notification items
 * - Activity feeds
 *
 * Props:
 * - reptile: Reptile object with name, avatar_photo_url, species
 * - size: Avatar size ('sm', 'md', 'lg', 'xl') - default 'md'
 * - showSpecies: Show species below name - default false
 * - animate: Enable Framer Motion spring animation - default false
 * - asLink: Style as clickable link - default false
 * - onClick: Click handler (makes component clickable)
 * - className: Additional CSS classes
 */
const ReptileNameWithAvatar = ({
  reptile,
  size = 'md',
  showSpecies = false,
  animate = false,
  asLink = false,
  onClick,
  className = '',
}) => {
  // Size-based spacing and text classes
  const sizeConfig = {
    sm: {
      gap: 'gap-2',
      nameSize: 'text-sm',
      speciesSize: 'text-xs',
    },
    md: {
      gap: 'gap-3',
      nameSize: 'text-base',
      speciesSize: 'text-sm',
    },
    lg: {
      gap: 'gap-3',
      nameSize: 'text-lg',
      speciesSize: 'text-sm',
    },
    xl: {
      gap: 'gap-4',
      nameSize: 'text-xl',
      speciesSize: 'text-base',
    },
  };

  const config = sizeConfig[size] || sizeConfig.md;

  const containerClasses = cn(
    'inline-flex items-center',
    config.gap,
    asLink && 'cursor-pointer hover:opacity-80 transition-opacity',
    onClick && 'cursor-pointer',
    className
  );

  const nameClasses = cn(
    config.nameSize,
    'font-medium truncate',
    'text-foreground'
  );

  const speciesClasses = cn(
    config.speciesSize,
    'text-muted-foreground truncate'
  );

  // Spring animation config (per CONTEXT.md - stiffness: 100, damping: 14)
  const springConfig = {
    type: 'spring',
    stiffness: 100,
    damping: 14,
  };

  const content = (
    <>
      <ReptileAvatar reptile={reptile} size={size} />
      <div className="flex flex-col min-w-0">
        <span className={nameClasses}>
          {reptile?.name || 'Unknown Reptile'}
        </span>
        {showSpecies && reptile?.species && (
          <span className={speciesClasses}>
            {reptile.species}
          </span>
        )}
      </div>
    </>
  );

  // Wrap with motion if animate is enabled
  if (animate) {
    return (
      <motion.div
        className={containerClasses}
        onClick={onClick}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springConfig}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(e);
          }
        } : undefined}
      >
        {content}
      </motion.div>
    );
  }

  // Static version
  return (
    <div
      className={containerClasses}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      } : undefined}
    >
      {content}
    </div>
  );
};

export default ReptileNameWithAvatar;
