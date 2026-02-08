import { cn } from '@/lib/utils';

/**
 * TaskChip - Clickable task status chip
 *
 * Displays a task with status-based styling (done/due/overdue).
 * Click triggers quick-log form (wired in Plan 08-03).
 *
 * Props:
 * - task: Task object with status, name, time
 * - onQuickLog: Handler for task chip clicks (task => void)
 * - className: Additional CSS classes
 */
const TaskChip = ({ task, onQuickLog, className = '' }) => {
  if (!task) return null;

  // Determine task status for styling
  const getTaskStatus = (task) => {
    if (task.status === 'done' || task.completed) return 'done';
    if (task.status === 'overdue' || task.is_overdue) return 'overdue';
    return 'due';
  };

  const status = getTaskStatus(task);

  // Status-based styling per user decision
  const statusStyles = {
    done: 'bg-primary/20 text-primary',
    due: 'bg-muted text-muted-foreground',
    overdue: 'bg-destructive/20 text-destructive'
  };

  // Format display text
  const getDisplayText = () => {
    const taskName = task.task_name || task.name || 'Task';

    if (status === 'done') {
      return `✓ ${taskName}`;
    }

    if (status === 'overdue') {
      return `${taskName} overdue`;
    }

    // Due tasks: show time if available
    if (task.time || task.time_range_start) {
      const time = task.time || task.time_range_start;
      // Format time (assuming HH:MM:SS format from backend)
      const timeStr = time.substring(0, 5); // Get HH:MM
      return `${taskName} ${timeStr}`;
    }

    return taskName;
  };

  const handleClick = () => {
    if (onQuickLog) {
      onQuickLog(task);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <span
      className={cn(
        'inline-block px-1.5 py-0.5 rounded text-xs cursor-pointer',
        'transition-opacity hover:opacity-80',
        statusStyles[status],
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Quick log ${task.task_name || task.name}`}
    >
      {getDisplayText()}
    </span>
  );
};

export default TaskChip;
