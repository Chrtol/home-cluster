import { isToday, isTomorrow, format, parseISO } from 'date-fns';
import { Clock } from 'lucide-react';

/**
 * NextFeedingIndicator displays next scheduled feeding time
 *
 * Shows absolute time format (Today 6pm, Tomorrow 10am, Mon 6pm) for
 * the next pending feeding schedule instance. Hidden when no pending
 * feeding or when explicitly hidden (e.g., reptile is brumating).
 *
 * @param {Object} props
 * @param {Array} props.scheduleInstances - Array of schedule instances from dashboard data
 * @param {number} props.reptileId - Reptile ID to filter instances
 * @param {boolean} props.isHidden - When true, hide the indicator (caller decides when)
 * @returns {JSX.Element|null} Time display or null if no feeding or hidden
 */
const NextFeedingIndicator = ({ scheduleInstances, reptileId, isHidden }) => {
  // Hide indicator when explicitly requested (e.g., brumating)
  if (isHidden) return null;

  // Hide when no schedule instances available
  if (!scheduleInstances || scheduleInstances.length === 0) return null;

  // Find next pending feeding instance
  const now = new Date();
  const nextFeeding = scheduleInstances
    .filter(inst =>
      inst.reptile_id === reptileId &&
      inst.schedule_type === 'feeding' &&
      inst.status === 'pending' &&
      new Date(inst.scheduled_date) >= now
    )
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))[0];

  // Hide when no upcoming feeding found
  if (!nextFeeding) return null;

  /**
   * Format next feeding as absolute time
   * Returns format: "Today 6pm", "Tomorrow 10am", "Mon 2pm"
   */
  const formatNextFeeding = (instance) => {
    const date = parseISO(instance.scheduled_date);
    const time = instance.time_range_start || '12:00:00'; // Default noon if no time

    // Determine date label
    let dateStr;
    if (isToday(date)) {
      dateStr = 'Today';
    } else if (isTomorrow(date)) {
      dateStr = 'Tomorrow';
    } else {
      dateStr = format(date, 'EEE'); // Mon, Tue, etc.
    }

    // Format time as "6pm" or "10am"
    const [hours, minutes] = time.split(':').map(Number);
    const timeDate = new Date(2000, 0, 1, hours, minutes);
    const timeStr = format(timeDate, 'ha').toLowerCase(); // 6pm, 10am

    return `${dateStr} ${timeStr}`;
  };

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="w-3 h-3" />
      <span>{formatNextFeeding(nextFeeding)}</span>
    </div>
  );
};

export default NextFeedingIndicator;
