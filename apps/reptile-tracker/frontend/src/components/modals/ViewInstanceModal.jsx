import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, ClipboardList, SkipForward, Calendar, Eye } from 'lucide-react';
import { useCreateLogModal } from '@/contexts/CreateLogModalContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { InstanceViewContent } from './InstanceViewContent';

/**
 * ViewInstanceModal - Right-slide modal for viewing schedule instance details
 *
 * Fetches schedule instance data and displays it with instance-specific info:
 * - Scheduled date and status
 * - Pre-calculated supplements
 * - Completion info if completed
 *
 * Actions: Track/Log Now, Skip, View Schedule Definition
 */
export function ViewInstanceModal({
  instanceId,
  open,
  onOpenChange,
  onViewSchedule, // Optional: callback to open ViewScheduleModal for the parent schedule
  onRefresh, // Optional: callback to refresh dashboard data after status change
}) {
  const [instance, setInstance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [skipping, setSkipping] = useState(false);

  // Access the CreateLogModal context
  const { openCreateLog, isRegistered } = useCreateLogModal();

  // Fetch instance data when modal opens or instanceId changes
  useEffect(() => {
    if (!open || !instanceId) {
      setInstance(null);
      setError(null);
      return;
    }

    const fetchInstance = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(`/api/schedule-instances/${instanceId}`);
        setInstance(response.data);
      } catch (err) {
        console.error('Failed to fetch instance:', err);
        setError(
          err.response?.data?.detail ||
          'Failed to load schedule instance. It may not exist or you may not have permission.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchInstance();
  }, [open, instanceId]);

  // Get modal title
  const getTitle = () => {
    if (!instance) return 'Schedule Instance';

    const schedule = instance.schedule;
    if (!schedule) return 'Schedule Instance';

    // Use schedule name if available
    if (schedule.name) return schedule.name;

    // Generate title from schedule type
    const typeNames = {
      feeding: 'Feeding',
      misting: 'Misting',
      health: 'Health Check',
      supplement: 'Supplement',
    };
    return typeNames[schedule.schedule_type] || 'Task';
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'missed':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'skipped':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  // Handle "Log Now" / "Track" - opens CreateLogModal with prefill
  const handleLogNow = () => {
    if (!instance || !instance.schedule) return;

    const schedule = instance.schedule;

    // Map schedule_type to log type
    let logType = schedule.schedule_type;
    const prefill = {
      instance_id: instance.id, // Pass instance_id for supplement pre-fill
      supplements: instance.supplements || [], // Instance-specific supplements
    };

    // For health schedules, map health_subtype to the specific log type
    if (schedule.schedule_type === 'health') {
      switch (schedule.health_subtype) {
        case 'weight':
          logType = 'weight';
          break;
        case 'measurement':
          logType = 'measurement';
          if (schedule.measurement_type) {
            prefill.measurement_type = schedule.measurement_type;
          }
          if (schedule.custom_measurement_label) {
            prefill.custom_label = schedule.custom_measurement_label;
          }
          break;
        case 'shedding_check':
        case 'brumation_check':
        case 'bathing':
        case 'health_record':
        default:
          logType = 'health';
          if (schedule.health_subtype) {
            prefill.record_type = schedule.health_subtype;
          }
          break;
      }
    }

    // Add schedule notes as prefill notes
    if (schedule.notes) {
      prefill.notes = schedule.notes;
    }

    // Close the view modal first
    onOpenChange(false);

    // Open the CreateLogModal after URL state settles
    setTimeout(() => {
      const opened = openCreateLog(logType, schedule.reptile_id, prefill);
      if (!opened) {
        toast.info('Navigate to Dashboard to log this task');
      }
    }, 0);
  };

  // Handle "Skip" - mark instance as skipped
  const handleSkip = async () => {
    if (!instance) return;

    setSkipping(true);
    try {
      await axios.patch(`/api/schedule-instances/${instanceId}`, {
        status: 'skipped',
      });
      toast.success('Task skipped');

      // Refresh instance data
      const response = await axios.get(`/api/schedule-instances/${instanceId}`);
      setInstance(response.data);

      // Notify parent to refresh
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to skip instance:', err);
      toast.error(err.response?.data?.detail || 'Failed to skip task');
    } finally {
      setSkipping(false);
    }
  };

  // Handle "View Schedule" - open schedule definition modal
  const handleViewSchedule = () => {
    if (!instance || !instance.schedule_id) return;

    // Close this modal first
    onOpenChange(false);

    // Open schedule modal if callback provided
    if (onViewSchedule) {
      setTimeout(() => {
        onViewSchedule(instance.schedule_id);
      }, 0);
    }
  };

  const isPending = instance?.status === 'pending';
  const canTrack = isPending && isRegistered;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0 w-full sm:max-w-lg">
        {/* Header with title and status */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between pr-8">
            <SheetTitle>{getTitle()}</SheetTitle>
            {!loading && !error && instance && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(instance.status)}`}>
                {instance.status}
              </span>
            )}
          </div>
          <SheetDescription className="sr-only">
            View details for this scheduled task
          </SheetDescription>
        </SheetHeader>

        {/* Content area */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex-1 p-6">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && instance && (
          <InstanceViewContent instance={instance} />
        )}

        {/* Footer with actions */}
        <SheetFooter className="px-6 py-4 border-t border-border">
          <div className="flex flex-wrap gap-2 w-full">
            {/* Primary action: Track/Log Now (only for pending) */}
            {canTrack && (
              <Button onClick={handleLogNow} className="flex-1 sm:flex-none">
                <ClipboardList className="h-4 w-4 mr-2" />
                Track
              </Button>
            )}

            {/* Skip action (only for pending) */}
            {isPending && (
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={skipping}
                className="flex-1 sm:flex-none"
              >
                {skipping ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <SkipForward className="h-4 w-4 mr-2" />
                )}
                Skip
              </Button>
            )}

            {/* View Schedule (always available) */}
            {onViewSchedule && instance?.schedule_id && (
              <Button
                variant="ghost"
                onClick={handleViewSchedule}
                className="flex-1 sm:flex-none"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Schedule
              </Button>
            )}

            {/* Close button */}
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none sm:ml-auto"
            >
              Close
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default ViewInstanceModal;
