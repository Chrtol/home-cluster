import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Edit2, Trash2, Loader2, ArrowLeft } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
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
import { LogViewContent } from './LogViewContent';
import { EditLogContent } from './EditLogContent';

/**
 * ViewLogModal - Right-slide modal for viewing and editing log entries
 *
 * Fetches log data based on logType and displays it in sectioned layout.
 * Supports in-place view-to-edit transformation without modal close/reopen.
 * Provides Edit and Delete actions with confirmation dialog for delete.
 * Uses Sheet component with side="right" per established pattern.
 */
export function ViewLogModal({
  logId,
  logType,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}) {
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('view'); // 'view' | 'edit'
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch log data when modal opens or logId/logType changes
  useEffect(() => {
    if (!open || !logId || !logType) {
      setLog(null);
      setError(null);
      setMode('view'); // Reset to view mode when closing
      return;
    }

    const fetchLog = async () => {
      setLoading(true);
      setError(null);

      try {
        const endpoint = getEndpoint(logType, logId);
        const response = await axios.get(endpoint);
        setLog(response.data);
      } catch (err) {
        console.error(`Failed to fetch ${logType} log:`, err);
        setError(
          err.response?.data?.detail ||
          `Failed to load ${getLogTypeName(logType)} log. It may not exist or you may not have permission.`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLog();
  }, [open, logId, logType]);

  // Reset mode when modal closes
  useEffect(() => {
    if (!open) {
      setMode('view');
      setShowDeleteConfirm(false);
    }
  }, [open]);

  // Get API endpoint based on log type
  const getEndpoint = (type, id) => {
    const endpoints = {
      feeding: `/api/feedings/${id}`,
      misting: `/api/misting/${id}`,
      health: `/api/health/${id}`,
      weight: `/api/weight/${id}`,
      measurement: `/api/measurements/${id}`,
    };
    return endpoints[type];
  };

  // Get human-readable log type name
  const getLogTypeName = (type) => {
    const names = {
      feeding: 'Feeding',
      misting: 'Misting',
      health: 'Health',
      weight: 'Weight',
      measurement: 'Measurement',
    };
    return names[type] || type || 'Log';
  };

  // Handle edit button click - transform in place (don't close/reopen modal)
  const handleEditClick = () => {
    setMode('edit');
  };

  // Handle cancel from edit mode - return to view
  const handleEditCancel = () => {
    setMode('view');
  };

  // Handle save from edit mode - update log and return to view
  const handleEditSave = (updatedLog) => {
    setLog(updatedLog);
    setMode('view');
    toast.success('Log updated successfully');
    // Also notify parent if callback provided
    if (onEdit) {
      onEdit(logId, logType, updatedLog);
    }
  };

  // Handle delete button click - show confirmation dialog
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  // Handle confirmed delete
  const handleDeleteConfirm = async () => {
    setDeleting(true);

    try {
      const endpoint = getEndpoint(logType, logId);
      await axios.delete(endpoint);

      // Store deleted log data for potential undo
      const deletedLog = { ...log };

      // Close confirmation dialog and modal
      setShowDeleteConfirm(false);
      onOpenChange(false);

      // Show success toast with undo action
      toast.success(`${getLogTypeName(logType)} log deleted`, {
        action: {
          label: 'Undo',
          onClick: () => {
            // Undo would need to re-create the log
            // For MVP, just show a message that undo would restore
            toast.info('Undo functionality coming soon');
          },
        },
      });

      // Notify parent of deletion
      if (onDelete) {
        onDelete(logId, logType, deletedLog);
      }
    } catch (err) {
      console.error('Failed to delete log:', err);
      toast.error(
        err.response?.data?.detail || 'Failed to delete log. Please try again.'
      );
    } finally {
      setDeleting(false);
    }
  };

  // Get header title based on mode
  const getHeaderTitle = () => {
    if (mode === 'edit') {
      return `Edit ${getLogTypeName(logType)} Log`;
    }
    return `${getLogTypeName(logType)} Log`;
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex flex-col p-0">
          {/* Header with title and actions */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-2">
                {mode === 'edit' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleEditCancel}
                    className="h-8 w-8 -ml-2"
                    title="Back to view"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <SheetTitle>{getHeaderTitle()}</SheetTitle>
              </div>
              {mode === 'view' && !loading && !error && log && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleEditClick}
                    className="h-8 w-8"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDeleteClick}
                    className="h-8 w-8 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <SheetDescription className="sr-only">
              {mode === 'edit'
                ? `Edit this ${getLogTypeName(logType).toLowerCase()} log entry`
                : `View details for this ${getLogTypeName(logType).toLowerCase()} log entry`}
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

          {!loading && !error && log && (
            <>
              {mode === 'view' ? (
                <>
                  <LogViewContent log={log} logType={logType} />

                  {/* Footer with close button (view mode only) */}
                  <SheetFooter className="px-6 py-4 border-t border-border">
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      className="w-full sm:w-auto"
                    >
                      Close
                    </Button>
                  </SheetFooter>
                </>
              ) : (
                <EditLogContent
                  log={log}
                  logType={logType}
                  onSave={handleEditSave}
                  onCancel={handleEditCancel}
                />
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {getLogTypeName(logType)} Log?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this log entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
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

export default ViewLogModal;
