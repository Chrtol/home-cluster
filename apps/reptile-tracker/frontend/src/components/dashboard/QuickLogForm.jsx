import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { X, ExternalLink } from 'lucide-react';

/**
 * QuickLogForm - Inline quick-log form for logging tasks from the dashboard
 *
 * Displays auto-filled data from schedule instance and provides minimal input
 * for quick task completion. Offers option to open full form for detailed logging.
 *
 * Props:
 * - task: Schedule instance object with auto-fill data (from ReptileStatusCards or Timeline)
 * - onClose: Handler to close the form
 * - onSubmit: Handler for successful submission (triggers widget refresh)
 * - onOpenFull: Handler to navigate to full log view with scheduleId
 */
const QuickLogForm = ({ task, onClose, onSubmit }) => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Determine task type for navigation
  const getFullFormPath = () => {
    if (!task) return '/';

    const scheduleType = task.schedule_type || task.type;
    const reptileId = task.reptile_id || task.reptile?.id;
    const instanceId = task.instance_id || task.id;

    // Build query params - prefer instance_id, fall back to reptile_id
    const queryParam = instanceId ? `instance_id=${instanceId}` : (reptileId ? `reptile_id=${reptileId}` : '');

    if (scheduleType === 'feeding') {
      return `/feeding${queryParam ? `?${queryParam}` : ''}`;
    } else if (scheduleType === 'misting') {
      return `/misting${queryParam ? `?${queryParam}` : ''}`;
    } else if (scheduleType === 'health' || scheduleType === 'weighing') {
      return `/health-log${queryParam ? `?${queryParam}` : ''}`;
    }

    // Default to reptile page if no specific form
    return reptileId ? `/reptiles/${reptileId}` : '/';
  };

  const handleOpenFull = () => {
    navigate(getFullFormPath());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!task) return;

    setSubmitting(true);
    setError('');

    try {
      const scheduleType = task.schedule_type || task.type;
      const reptileId = task.reptile_id || task.reptile?.id;

      if (!reptileId) {
        throw new Error('Missing reptile ID');
      }

      // Determine the correct API endpoint and payload based on task type
      let endpoint = '';
      let payload = {};

      if (scheduleType === 'feeding') {
        endpoint = '/api/feedings';
        payload = {
          reptile_id: reptileId,
          fed_at: new Date().toISOString(),
          foods: [], // Quick log doesn't specify foods - empty array required
          supplements: [], // Global supplements
          is_salad: false,
          salad_components: [],
          notes: notes.trim() || null
        };
      } else if (scheduleType === 'misting') {
        endpoint = '/api/misting';
        payload = {
          reptile_id: reptileId,
          misted_at: new Date().toISOString(),
          notes: notes.trim() || null
        };
      } else if (scheduleType === 'health' || scheduleType === 'weighing') {
        endpoint = '/api/health';
        payload = {
          reptile_id: reptileId,
          record_type: scheduleType === 'weighing' ? 'weight_check' : 'observation',
          title: scheduleType === 'weighing' ? 'Weight Check' : 'Health Observation',
          description: notes.trim() || null,
          date: new Date().toISOString()
        };
      } else {
        // Unsupported task type - show error
        throw new Error(`Unsupported task type: ${scheduleType}. Please use the full form.`);
      }

      await axios.post(endpoint, payload);

      // Call success handler to refresh widgets
      if (onSubmit) {
        await onSubmit();
      }

      onClose();
    } catch (err) {
      console.error('Failed to log task:', err);
      setError(err.response?.data?.message || err.message || 'Failed to log task. Please try again.');
      setSubmitting(false);
    }
  };

  if (!task) return null;

  const scheduleType = task.schedule_type || task.type || 'task';
  const reptileName = task.reptile_name || task.name || 'Unknown';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-card rounded-lg shadow-xl max-w-md w-full animate-in fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Quick Log</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {reptileName} • {scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Auto-filled data display */}
          {(task.food_category || (task.supplements && task.supplements.length > 0)) && (
            <div className="bg-muted rounded p-2 space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Auto-filled from schedule</p>

              {task.food_category && (
                <div className="text-xs text-foreground">
                  <span className="text-muted-foreground">Food:</span> {task.food_category.charAt(0).toUpperCase() + task.food_category.slice(1)}
                </div>
              )}

              {task.supplements && task.supplements.length > 0 && (
                <div className="text-xs text-foreground">
                  <span className="text-muted-foreground">Supplements:</span> {task.supplements.map(s => typeof s === 'string' ? s : s.name).join(', ')}
                </div>
              )}

              {task.time_window && (
                <div className="text-xs text-foreground">
                  <span className="text-muted-foreground">Time:</span> {task.time_window}
                </div>
              )}
            </div>
          )}

          {/* Notes input */}
          <div>
            <label htmlFor="quick-notes" className="block text-xs font-medium text-foreground mb-1">
              Notes (optional)
            </label>
            <textarea
              id="quick-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any quick notes..."
              rows={2}
              className="w-full px-2 py-1.5 bg-muted border border-border rounded text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleOpenFull}
              className="text-xs text-primary hover:text-primary-light flex items-center gap-1 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Open full form
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Logging...' : 'Log Task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickLogForm;
