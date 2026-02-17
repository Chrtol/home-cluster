import { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';

/**
 * Modal for shedding check completion
 * Shows yes/no prompt asking if reptile is showing shedding signs
 * - Yes: Creates shedding start event + marks task done
 * - No: Just marks task done without creating event
 * - Cancel: Returns without changes
 */
export default function SheddingCheckModal({ task, onClose, onComplete }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reptileName = task?.reptile_name || task?.name || 'your reptile';
  const reptileId = task?.reptile_id || task?.reptile?.id;

  const handleYes = async () => {
    setSubmitting(true);
    setError('');

    try {
      // Create shedding start event
      await axios.post('/api/health', {
        reptile_id: reptileId,
        record_type: 'shedding',
        event_type: 'start',
        title: 'Started shedding',
        date: new Date().toISOString()
      });

      // Mark task done
      if (onComplete) {
        await onComplete();
      }

      onClose();
    } catch (err) {
      console.error('Failed to log shedding start:', err);
      setError(err.response?.data?.message || err.response?.data?.detail || 'Failed to log shedding. Please try again.');
      setSubmitting(false);
    }
  };

  const handleNo = async () => {
    setSubmitting(true);

    try {
      // Just mark task done without creating event
      if (onComplete) {
        await onComplete();
      }
      onClose();
    } catch (err) {
      console.error('Failed to complete task:', err);
      setError('Failed to complete task. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Shedding Check</h3>

        <p className="text-muted-foreground mb-6">
          Is <span className="font-medium text-foreground">{reptileName}</span> showing signs of shedding?
        </p>

        {error && (
          <div className="text-destructive text-sm mb-4">{error}</div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleNo}
            disabled={submitting}
            className="flex-1"
          >
            No
          </Button>
          <Button
            onClick={handleYes}
            disabled={submitting}
            className="flex-1"
          >
            {submitting ? 'Saving...' : 'Yes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
