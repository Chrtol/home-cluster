import { isToday, isTomorrow, format } from 'date-fns';
import { Utensils } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * NextFeedingIndicator - Shows next scheduled feeding time
 *
 * Handles both API schedule instances (with scheduled_date string and status)
 * and calculated weekly events (with date object, no status).
 */
const NextFeedingIndicator = ({ scheduleInstances, reptileId, isHidden }) => {
  if (isHidden) return null;
  if (!scheduleInstances || scheduleInstances.length === 0) return null;

  const now = new Date();
  // Set to start of today for date comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find next feeding - handle both data formats
  const nextFeeding = scheduleInstances
    .filter(inst => {
      // Must be a feeding schedule
      if (inst.schedule_type !== 'feeding') return false;

      // Get the date (could be Date object or string)
      const eventDate = inst.date instanceof Date
        ? inst.date
        : inst.scheduled_date
          ? new Date(inst.scheduled_date)
          : null;

      if (!eventDate) return false;

      // Must be today or in the future
      const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      if (eventDay < today) return false;

      // If status exists, must be pending (not completed/missed)
      // If no status (calculated events), assume it's upcoming
      if (inst.status && inst.status !== 'pending') return false;

      return true;
    })
    .sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.scheduled_date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.scheduled_date);
      return dateA - dateB;
    })[0];

  if (!nextFeeding) return null;

  // Format the next feeding time
  const formatNextFeeding = (instance) => {
    const date = instance.date instanceof Date
      ? instance.date
      : new Date(instance.scheduled_date);

    // Date part
    let dateStr;
    if (isToday(date)) {
      dateStr = 'Today';
    } else if (isTomorrow(date)) {
      dateStr = 'Tomorrow';
    } else {
      dateStr = format(date, 'EEE');
    }

    // Time part - use earliest_time or time_range_start
    const timeStr = instance.earliest_time || instance.time_range_start;
    if (timeStr) {
      const [hours] = timeStr.split(':').map(Number);
      const timeDate = new Date(2000, 0, 1, hours, 0);
      return `${dateStr} ${format(timeDate, 'ha').toLowerCase()}`;
    }

    return dateStr;
  };

  // Color based on urgency
  const getColors = () => {
    const date = nextFeeding.date instanceof Date
      ? nextFeeding.date
      : new Date(nextFeeding.scheduled_date);

    if (isToday(date)) {
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-400' };
    }
    if (isTomorrow(date)) {
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-400/80' };
    }
    return { bg: 'bg-slate-500/15', text: 'text-slate-400' };
  };

  const colors = getColors();

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 h-6 rounded-full text-xs font-medium",
        colors.bg, colors.text
      )}
      title="Next feeding"
    >
      <Utensils className="w-3 h-3" />
      <span>{formatNextFeeding(nextFeeding)}</span>
    </div>
  );
};

export default NextFeedingIndicator;
