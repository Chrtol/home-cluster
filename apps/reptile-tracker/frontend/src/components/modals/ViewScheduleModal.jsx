import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Edit2, Trash2, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ScheduleViewContent } from './ScheduleViewContent';

/**
 * ViewScheduleModal - Right-slide modal for viewing schedule details
 *
 * Fetches schedule data and displays it in sectioned layout.
 * Provides Edit and Delete actions in header.
 * Uses Sheet component with side="right" per established pattern.
 */
export function ViewScheduleModal({
  scheduleId,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}) {
  const [schedule, setSchedule] = useState(null);
  const [reptile, setReptile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch schedule data when modal opens or scheduleId changes
  useEffect(() => {
    if (!open || !scheduleId) {
      setSchedule(null);
      setReptile(null);
      setError(null);
      return;
    }

    const fetchSchedule = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch schedule data
        const scheduleResponse = await axios.get(`/api/schedules/${scheduleId}`);
        const scheduleData = scheduleResponse.data;
        setSchedule(scheduleData);

        // Fetch reptile data if schedule has reptile_id
        if (scheduleData.reptile_id) {
          try {
            const reptileResponse = await axios.get(`/api/reptiles/${scheduleData.reptile_id}`);
            setReptile(reptileResponse.data);
          } catch (reptileErr) {
            console.error('Failed to fetch reptile:', reptileErr);
            // Don't fail the whole modal if reptile fetch fails
          }
        }
      } catch (err) {
        console.error('Failed to fetch schedule:', err);
        setError(
          err.response?.data?.detail ||
          'Failed to load schedule. It may not exist or you may not have permission.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [open, scheduleId]);

  // Get schedule display name
  const getScheduleTitle = () => {
    if (!schedule) return 'Schedule Details';
    if (schedule.name) return schedule.name;

    // Generate title from schedule type
    const typeNames = {
      feeding: 'Feeding Schedule',
      misting: 'Misting Schedule',
      health: 'Health Schedule',
      supplement: 'Supplement Schedule',
    };
    return typeNames[schedule.schedule_type] || 'Schedule Details';
  };

  // Handle edit button click
  const handleEdit = () => {
    if (onEdit) {
      onEdit(scheduleId, schedule);
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    setDeleting(true);

    try {
      await axios.delete(`/api/schedules/${scheduleId}`);
      toast.success('Schedule deleted successfully');

      // Close delete dialog and modal
      setShowDeleteConfirm(false);
      onOpenChange(false);

      // Notify parent
      if (onDelete) {
        onDelete(scheduleId);
      }
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      toast.error(
        err.response?.data?.detail ||
        'Failed to delete schedule. Please try again.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex flex-col p-0">
          {/* Header with title and actions */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center justify-between pr-8">
              <SheetTitle>{getScheduleTitle()}</SheetTitle>
              {!loading && !error && schedule && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleEdit}
                    className="h-8 w-8"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="h-8 w-8 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <SheetDescription className="sr-only">
              View details for this schedule
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

          {!loading && !error && schedule && (
            <ScheduleViewContent schedule={schedule} reptile={reptile} />
          )}

          {/* Footer with close button */}
          <SheetFooter className="px-6 py-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{getScheduleTitle()}"?
              This action cannot be undone. All future occurrences of this schedule
              will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              variant="destructive"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ViewScheduleModal;
