import { X, Plus, Check, Calendar, TrendingUp, Activity, Scale, Droplets, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * WidgetGallery - Modal for adding widgets to dashboard
 *
 * Shows available widgets with:
 * - Visual preview/icon
 * - Name and description
 * - Add button (disabled if already visible)
 *
 * Props:
 * - isOpen: boolean - Whether modal is open
 * - availableWidgets: array - List of all widgets with visibility status
 * - onAddWidget: function(widgetId) - Handler for adding a widget
 * - onClose: function - Close modal handler
 */
const WidgetGallery = ({ isOpen, availableWidgets, onAddWidget, onClose }) => {
  if (!isOpen) return null;

  // Widget metadata for display
  const widgetMetadata = {
    today_summary: {
      icon: Clock,
      description: 'Quick overview of today\'s tasks',
      color: 'text-blue-600 dark:text-blue-400'
    },
    today_timeline: {
      icon: Clock,
      description: 'Timeline view of today\'s schedule',
      color: 'text-blue-600 dark:text-blue-400'
    },
    weekly_calendar: {
      icon: Calendar,
      description: 'Week view of scheduled tasks',
      color: 'text-purple-600 dark:text-purple-400'
    },
    weight_chart: {
      icon: TrendingUp,
      description: 'Weight tracking chart over time',
      color: 'text-green-600 dark:text-green-400'
    },
    weight_trends: {
      icon: Scale,
      description: 'Compact weight trends with sparklines',
      color: 'text-green-600 dark:text-green-400'
    },
    reptile_cards: {
      icon: Activity,
      description: 'Status cards for each reptile',
      color: 'text-orange-600 dark:text-orange-400'
    },
    recent_activity: {
      icon: Activity,
      description: 'Recent feedings, mistings, and events',
      color: 'text-gray-600 dark:text-gray-400'
    },
    compact_recent_activity: {
      icon: Activity,
      description: 'Compact recent activity list',
      color: 'text-gray-600 dark:text-gray-400'
    },
    week_summary: {
      icon: Droplets,
      description: 'This week\'s stats at a glance',
      color: 'text-blue-600 dark:text-blue-400'
    },
    weekly_summary: {
      icon: Calendar,
      description: 'Weekly summary statistics',
      color: 'text-purple-600 dark:text-purple-400'
    },
    health_summary: {
      icon: Activity,
      description: 'Health events summary',
      color: 'text-red-600 dark:text-red-400'
    },
    schedule_summary: {
      icon: Clock,
      description: 'Schedule summary',
      color: 'text-blue-600 dark:text-blue-400'
    }
  };

  const handleAddWidget = (widgetId) => {
    onAddWidget(widgetId);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-border"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">Add Widget</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-surface-700/50 transition-colors"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Widget grid */}
          <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableWidgets.map((widget) => {
                const metadata = widgetMetadata[widget.id] || {
                  icon: Activity,
                  description: 'Widget description',
                  color: 'text-gray-600 dark:text-gray-400'
                };
                const Icon = metadata.icon;
                const isVisible = widget.visible;

                return (
                  <motion.div
                    key={widget.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`relative p-4 rounded-lg border-2 transition-all ${
                      isVisible
                        ? 'border-accent-400 bg-accent-400/10'
                        : 'border-border bg-surface-700/30 hover:border-accent-400/50 hover:bg-surface-700/50'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`flex items-center gap-3 mb-2 ${metadata.color}`}>
                      <Icon size={24} className="flex-shrink-0" />
                      <h3 className="font-semibold text-foreground text-sm">
                        {widget.label}
                      </h3>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground mb-3">
                      {metadata.description}
                    </p>

                    {/* Action button */}
                    {isVisible ? (
                      <div className="flex items-center gap-2 text-xs text-accent-400 font-medium">
                        <Check size={14} />
                        Active
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddWidget(widget.id)}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-accent-400 text-white hover:bg-accent-500 transition-colors font-medium"
                      >
                        <Plus size={14} />
                        Add Widget
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WidgetGallery;
