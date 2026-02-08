import { RotateCcw, Settings } from 'lucide-react';
import { resetDashboardCardSettings } from '../../utils/displaySettings';

/**
 * EditModeControls - Controls for dashboard customization mode
 *
 * Provides:
 * - Toggle button to enter/exit edit mode
 * - Reset button to restore default layout
 * - Confirmation dialog for destructive actions
 *
 * Props:
 * - isEditMode: boolean - Current edit mode state
 * - onToggleEditMode: function - Toggle edit mode handler
 * - onResetLayout: function - Reset layout handler (called after confirmation)
 */
const EditModeControls = ({ isEditMode, onToggleEditMode, onResetLayout }) => {
  const handleResetClick = () => {
    if (window.confirm('Reset dashboard layout to defaults? This will remove all customizations.')) {
      resetDashboardCardSettings();
      if (onResetLayout) {
        onResetLayout();
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isEditMode ? (
        <>
          <button
            onClick={handleResetClick}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface-700/50 text-foreground hover:bg-surface-700 transition-colors"
            title="Reset to default layout"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            onClick={onToggleEditMode}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-accent-400 text-white hover:bg-accent-500 transition-colors font-medium"
          >
            Done
          </button>
        </>
      ) : (
        <button
          onClick={onToggleEditMode}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface-700/50 text-foreground hover:bg-surface-700 transition-colors"
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
