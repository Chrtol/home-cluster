import { RotateCcw, Settings } from 'lucide-react';
import { resetDashboardCardSettings } from '../../utils/displaySettings';
import { ConfirmButton } from '@/components/ui/confirm-button';

/**
 * EditModeControls - Controls for dashboard customization mode
 *
 * Provides:
 * - Toggle button to enter/exit edit mode
 * - Reset button to restore default layout (uses ConfirmButton for inline confirmation)
 *
 * Props:
 * - isEditMode: boolean - Current edit mode state
 * - onToggleEditMode: function - Toggle edit mode handler
 * - onResetLayout: function - Reset layout handler (called after confirmation)
 */
const EditModeControls = ({ isEditMode, onToggleEditMode, onResetLayout }) => {
  const handleResetLayout = () => {
    resetDashboardCardSettings();
    if (onResetLayout) {
      onResetLayout();
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isEditMode ? (
        <>
          <ConfirmButton
            onConfirm={handleResetLayout}
            confirmText="Reset?"
            variant="outline"
            size="sm"
            className="flex items-center gap-2 px-3 py-1.5 text-xs"
            title="Reset to default layout"
          >
            <RotateCcw size={14} />
            Reset
          </ConfirmButton>
          <button
            onClick={onToggleEditMode}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            Done
          </button>
        </>
      ) : (
        <button
          onClick={onToggleEditMode}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-border bg-muted text-foreground hover:bg-muted/80 transition-colors"
          title="Customize dashboard"
        >
          <Settings size={14} />
          Customize
        </button>
      )}
    </div>
  );
};

export default EditModeControls;
