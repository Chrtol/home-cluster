import { useState, useEffect } from 'react';
import axios from 'axios';
import { Edit2, Trash2, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { LogViewContent } from './LogViewContent';

/**
 * ViewLogModal - Right-slide modal for viewing log entries
 *
 * Fetches log data based on logType and displays it in sectioned layout.
 * Provides Edit and Delete actions in header.
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

  // Fetch log data when modal opens or logId/logType changes
  useEffect(() => {
    if (!open || !logId || !logType) {
      setLog(null);
      setError(null);
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
    return names[type] || type;
  };

  // Handle edit button click
  const handleEdit = () => {
    if (onEdit) {
      onEdit(logId, logType, log);
    }
  };

  // Handle delete button click
  const handleDelete = () => {
    if (onDelete) {
      onDelete(logId, logType, log);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0">
        {/* Header with title and actions */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between pr-8">
            <SheetTitle>{getLogTypeName(logType)} Log</SheetTitle>
            {!loading && !error && log && (
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
                  onClick={handleDelete}
                  className="h-8 w-8 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <SheetDescription className="sr-only">
            View details for this {getLogTypeName(logType).toLowerCase()} log entry
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
          <LogViewContent log={log} logType={logType} />
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
  );
}

export default ViewLogModal;
