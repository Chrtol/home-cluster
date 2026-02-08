import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReptileAvatar from '../ReptileAvatar';
import TaskChip from './TaskChip';

/**
 * ReptileStatusCard - Individual reptile status card for dashboard
 *
 * Shows reptile photo, name, species, age, last fed, weight trend, and today's tasks.
 * Supports full and compact modes with drag-to-reorder.
 *
 * Props:
 * - reptile: Reptile object with name, species, avatar_photo_url, date_of_birth
 * - todayTasks: Array of today's schedule instances for this reptile
 * - lastFed: Date of last feeding (or null)
 * - lastWeight: {weight, change} object (or null)
 * - isCompact: Boolean for compact mode display
 * - onReorder: Drag handlers for reordering { onDragStart, onDragOver, onDrop }
 * - onQuickLog: Handler for task chip clicks (passed to TaskChip)
 * - index: Position for drag-drop
 */
const ReptileStatusCard = ({
  reptile,
  todayTasks = [],
  lastFed = null,
  lastWeight = null,
  isCompact = false,
  onReorder = null,
  onQuickLog,
  index = 0
}) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate age from date_of_birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const birth = new Date(dateOfBirth);
    const today = new Date();
    const diffTime = Math.abs(today - birth);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);

    if (years > 0) {
      return `${years}y ${months}mo`;
    } else if (months > 0) {
      return `${months}mo`;
    } else {
      return `${diffDays}d`;
    }
  };

  // Calculate task status for ring color
  const getTaskStatus = () => {
    if (!todayTasks || todayTasks.length === 0) return 'none';

    const hasOverdue = todayTasks.some(t => t.status === 'overdue' || t.is_overdue);
    const hasDue = todayTasks.some(t => (t.status === 'due' || !t.completed) && !t.is_overdue);
    const allDone = todayTasks.every(t => t.status === 'done' || t.completed);

    if (hasOverdue) return 'overdue';
    if (hasDue) return 'due';
    if (allDone) return 'done';
    return 'none';
  };

  const taskStatus = getTaskStatus();

  // Status ring colors
  const statusRingColors = {
    done: 'ring-accent-600',
    due: 'ring-status-due',
    overdue: 'ring-status-overdue',
    none: 'ring-accent-600'
  };

  // Status dot colors
  const statusDotColors = {
    done: 'bg-accent-500',
    due: 'bg-status-due',
    overdue: 'bg-status-overdue',
    none: 'bg-accent-500'
  };

  // Border styling per user decision
  const getBorderClass = () => {
    if (taskStatus === 'overdue') return 'border-status-due';
    return 'border-surface-600/50 hover:border-accent-700/50';
  };

  // Calculate last fed display
  const getLastFedDisplay = () => {
    if (!lastFed) return '-';
    const days = differenceInDays(new Date(), new Date(lastFed));
    if (days === 0) return 'Today';
    if (days === 1) return '1d ago';
    return `${days}d ago`;
  };

  // Weight trend arrow
  const getWeightTrendIcon = () => {
    if (!lastWeight || !lastWeight.change) return null;
    const change = parseFloat(lastWeight.change);
    if (change > 0) return <TrendingUp className="w-3 h-3 text-accent-400" />;
    if (change < 0) return <TrendingDown className="w-3 h-3 text-status-overdue" />;
    return <Minus className="w-3 h-3 text-gray-400" />;
  };

  // Navigate to reptile detail page
  const handleNameClick = (e) => {
    e.stopPropagation();
    navigate(`/reptiles/${reptile.id}`);
  };

  // Card body click (expand in compact mode)
  const handleCardClick = () => {
    if (isCompact) {
      setIsExpanded(!isExpanded);
    }
  };

  // Drag handlers
  const handleDragStart = (e) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
    if (onReorder?.onDragStart) {
      onReorder.onDragStart(index);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (onReorder?.onDragOver) {
      onReorder.onDragOver(index);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (onReorder?.onDrop) {
      onReorder.onDrop(index);
    }
  };

  // Species emoji fallback map
  const getSpeciesEmoji = (species) => {
    const lowerSpecies = (species || '').toLowerCase();
    if (lowerSpecies.includes('dragon')) return '🐉';
    if (lowerSpecies.includes('gecko')) return '🦎';
    if (lowerSpecies.includes('snake')) return '🐍';
    if (lowerSpecies.includes('turtle') || lowerSpecies.includes('tortoise')) return '🐢';
    if (lowerSpecies.includes('iguana')) return '🦎';
    return '🦎'; // Default
  };

  // Show compact card or full card
  const showFull = !isCompact || isExpanded;

  return (
    <div
      className={cn(
        'bg-surface-800 rounded-xl border p-3 transition-all',
        getBorderClass(),
        isDragging && 'opacity-50',
        isCompact && !isExpanded && 'cursor-pointer',
        'group'
      )}
      draggable={!isCompact && onReorder} // Only draggable in full mode
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleCardClick}
    >
      <div className="flex gap-3">
        {/* Avatar with status indicator */}
        <div className="relative flex-shrink-0">
          <div
            className={cn(
              'rounded-xl overflow-hidden',
              statusRingColors[taskStatus],
              'ring-2',
              isCompact && !isExpanded ? 'w-12 h-12' : 'w-16 h-16'
            )}
          >
            {reptile.avatar_photo_url ? (
              <img
                src={reptile.avatar_photo_url}
                alt={reptile.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent-700 to-accent-900 flex items-center justify-center text-2xl">
                {getSpeciesEmoji(reptile.species)}
              </div>
            )}
          </div>
          {/* Status dot */}
          <span
            className={cn(
              'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-surface-800',
              statusDotColors[taskStatus]
            )}
          />
        </div>

        {/* Info section */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3
              className={cn(
                'font-semibold text-white group-hover:text-accent-400 cursor-pointer transition-colors',
                isCompact && !isExpanded ? 'text-sm' : 'text-base'
              )}
              onClick={handleNameClick}
            >
              {reptile.name}
            </h3>
            {showFull && (
              <span className="text-xs text-gray-500">
                {calculateAge(reptile.date_of_birth || reptile.hatch_date)}
              </span>
            )}
          </div>

          {showFull && (
            <>
              <p className="text-xs text-gray-400 mb-2">{reptile.species}</p>

              {/* Quick stats row */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <span className={lastFed ? 'text-accent-400' : 'text-gray-500'}>🍽️</span>
                  <span className="text-gray-400">{getLastFedDisplay()}</span>
                </div>
                {lastWeight && (
                  <div className="flex items-center gap-1">
                    <span className="text-earth-amber">⚖️</span>
                    <span className="text-gray-400">{lastWeight.weight}g</span>
                    {getWeightTrendIcon()}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Today's tasks section - only in full view */}
      {showFull && (
        <div className="mt-3 pt-3 border-t border-surface-600/50">
          {todayTasks && todayTasks.length > 0 ? (
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {todayTasks.slice(0, 3).map((task, idx) => (
                <TaskChip
                  key={task.id || idx}
                  task={task}
                  onQuickLog={onQuickLog}
                />
              ))}
              {todayTasks.length > 3 && (
                <span className="text-gray-500 italic">
                  +{todayTasks.length - 3} more
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-500 italic text-xs">No tasks today</span>
          )}
        </div>
      )}
    </div>
  );
};

export default ReptileStatusCard;
