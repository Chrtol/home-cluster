import { cn } from '@/lib/utils';
import { Utensils, Droplet, HeartPulse } from 'lucide-react';

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
    // Check for completed status - API returns 'completed' not 'done'
    if (task.status === 'done' || task.status === 'completed' || task.completed || task.completed_at) return 'done';
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

  // Get task type icon
  const getTaskIcon = () => {
    const scheduleType = task.schedule_type || task.type;

    switch (scheduleType) {
      case 'feeding':
        return Utensils;
      case 'misting':
        return Droplet;
      case 'health':
      case 'weighing':
        return HeartPulse;
      default:
        return null;
    }
  };

  // Format display text
  const getDisplayText = () => {
    // Get task name from schedule data or fall back to capitalized schedule_type
    const scheduleType = task.schedule_type || task.type;
    const taskName = task.task_name || task.name ||
      (scheduleType ? scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1) : 'Task');

    if (status === 'done') {
      return `\u2713 ${taskName}`;
    }

    if (status === 'overdue') {
      return `${taskName} overdue`;
    }

    // Due tasks: show time if available
    if (task.time || task.time_range_start || task.scheduled_time) {
      const time = task.time || task.time_range_start || task.scheduled_time;
      // Format time (assuming HH:MM:SS format from backend)
      const timeStr = typeof time === 'string' && time.length >= 5 ? time.substring(0, 5) : time;
      return `${taskName} ${timeStr}`;
    }

    return taskName;
  };

  const TaskIcon = getTaskIcon();

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
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs cursor-pointer',
        'transition-opacity hover:opacity-80',
        statusStyles[status],
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Quick log ${task.task_name || task.name || task.schedule_type || 'task'}`}
    >
      {TaskIcon && <TaskIcon className="w-3 h-3" />}
      <span>{getDisplayText()}</span>
    </span>
  );
};

export default TaskChip;
