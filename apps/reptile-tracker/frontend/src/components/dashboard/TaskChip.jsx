import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Utensils, Droplet, HeartPulse } from 'lucide-react';
import { useConfetti } from '../../hooks/useConfetti';
import ConfettiDismissOverlay from '../ConfettiDismissOverlay';

/**
 * TaskChip - Clickable task status chip
 *
 * Displays a task with status-based styling (done/due/overdue).
 * Click triggers quick-log form for pending tasks, or navigates to view mode for completed tasks.
 *
 * Props:
 * - task: Task object with status, name, time, completion_type, completion_id, schedule_id
 * - onQuickLog: Handler for task chip clicks (task => void)
 * - onViewSchedule: (scheduleId) => void - callback to open schedule view modal (optional)
 * - className: Additional CSS classes
 */
const TaskChip = ({ task, onQuickLog, onViewSchedule, className = '' }) => {
  const navigate = useNavigate();
  const { triggerSubtle, isActive, dismiss } = useConfetti();

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
        return HeartPulse;
      default:
        return null;
    }
  };

  // Format display text
  const getDisplayText = () => {
    const scheduleType = task.schedule_type || task.type;

    // For health schedules, prefer to show the subtype
    let taskName = task.task_name || task.name;
    if (!taskName) {
      if (scheduleType === 'health' && task.health_subtype) {
        // Map health_subtype to human-readable label
        const subtypeLabels = {
          'weight': 'Weight Check',
          'measurement': 'Measurement',
          'shedding_check': 'Shedding Check',
          'brumation_check': 'Brumation Check',
          'health_record': 'Health Record',
          'bathing': 'Bathing'
        };
        taskName = subtypeLabels[task.health_subtype] || 'Health';

        // For measurement, append the measurement_type if available
        if (task.health_subtype === 'measurement' && task.measurement_type) {
          const measurementLabels = {
            'svl': 'SVL',
            'total_length': 'Total Length',
            'shell_length': 'Shell Length',
            'humidity': 'Humidity',
            'temperature': 'Temperature',
            'custom': 'Custom'
          };
          const mtLabel = measurementLabels[task.measurement_type] || task.measurement_type.toUpperCase();
          taskName = `${taskName} (${mtLabel})`;
        }
      } else {
        taskName = scheduleType ? scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1) : 'Task';
      }
    }

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

  // Get the view URL for a completed task based on completion type
  // Uses route params pattern: /page/:id or /health-log/:type/:id
  const getCompletedTaskViewUrl = () => {
    const { completion_type, completion_id, reptile_id } = task;

    if (!completion_id) return null;

    switch (completion_type) {
      case 'feeding':
        return `/feed/${completion_id}`;
      case 'weighing':
        return `/health-log/weight/${completion_id}`;
      case 'misting':
        return `/misting/${completion_id}`;
      case 'measurement':
        return `/health-log/measurement/${completion_id}`;
      case 'bathing':
      case 'shedding_check':
      case 'brumation_check':
      case 'health_record':
        return `/health-log/health/${completion_id}`;
      default:
        // Fallback to reptile page
        return reptile_id ? `/reptiles/${reptile_id}` : null;
    }
  };

  const handleClick = () => {
    // For completed tasks, use onViewSchedule callback if available
    // This opens the schedule view modal instead of navigating
    if (status === 'done' && onViewSchedule && task.schedule_id) {
      onViewSchedule(task.schedule_id);
      return;
    }

    // Fallback: For completed tasks, navigate to view mode
    if (status === 'done' && task.completion_id) {
      const viewUrl = getCompletedTaskViewUrl();
      if (viewUrl) {
        navigate(viewUrl);
        return;
      }
    }

    // For pending/overdue tasks, open QuickLogForm
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
    <>
      <span
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-1 rounded text-xs cursor-pointer leading-snug',
          'transition-opacity hover:opacity-80',
          statusStyles[status],
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Quick log ${getDisplayText()}`}
      >
        {TaskIcon && <TaskIcon className="w-3 h-3 flex-shrink-0" />}
        <span>{getDisplayText()}</span>
      </span>
      <ConfettiDismissOverlay isActive={isActive} onDismiss={dismiss} />
    </>
  );
};

export default TaskChip;
