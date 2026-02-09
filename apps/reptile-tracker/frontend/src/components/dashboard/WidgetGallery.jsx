import { useState } from 'react';
import { X, Plus, Check, Calendar, TrendingUp, Activity, Scale, Droplets, Clock, PanelLeft, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * WidgetGallery - Modal for adding widgets to dashboard
 *
 * Shows available widgets with:
 * - Visual preview/icon
 * - Name and description
 * - Zone selector (sidebar or main)
 * - Add button (disabled if already visible)
 *
 * Props:
 * - isOpen: boolean - Whether modal is open
 * - availableWidgets: array - List of all widgets with visibility status
 * - onAddWidget: function(widgetId, zone) - Handler for adding a widget to a zone
 * - onClose: function - Close modal handler
 * - sidebarEnabled: boolean - Whether sidebar zone is available
 */
const WidgetGallery = ({ isOpen, availableWidgets, onAddWidget, onClose, sidebarEnabled = true }) => {
  const [selectedZones, setSelectedZones] = useState({}); // { widgetId: 'sidebar' | 'main' }
  if (!isOpen) return null;

  // Widget metadata for display
  const widgetMetadata = {
    today_summary: {
      icon: Clock,
      description: 'Quick overview of today\'s tasks',
      color: 'text-blue-500'
    },
    today_timeline: {
      icon: Clock,
      description: 'Timeline view of today\'s schedule',
      color: 'text-blue-500'
    },
    weekly_calendar: {
      icon: Calendar,
      description: 'Week view of scheduled tasks',
      color: 'text-purple-500'
    },
    weight_chart: {
      icon: TrendingUp,
      description: 'Weight tracking chart over time',
      color: 'text-primary'
    },
    weight_trends: {
      icon: Scale,
      description: 'Compact weight trends with sparklines',
      color: 'text-primary'
    },
    reptile_cards: {
      icon: Activity,
      description: 'Status cards for each reptile',
      color: 'text-amber-500'
    },
    recent_activity: {
      icon: Activity,
      description: 'Recent feedings, mistings, and events',
      color: 'text-muted-foreground'
    },
    compact_recent_activity: {
      icon: Activity,
      description: 'Compact recent activity list',
      color: 'text-muted-foreground'
    },
    week_summary: {
      icon: Droplets,
      description: 'This week\'s stats at a glance',
      color: 'text-blue-500'
    },
    weekly_summary: {
      icon: Calendar,
      description: 'Weekly summary statistics',
      color: 'text-purple-500'
    },
    health_summary: {
      icon: Activity,
      description: 'Health events summary',
      color: 'text-destructive'
    },
    schedule_summary: {
      icon: Clock,
      description: 'Schedule summary',
      color: 'text-blue-500'
    }
  };

  const handleAddWidget = (widgetId) => {
    const zone = selectedZones[widgetId] || 'main';
    onAddWidget(widgetId, zone);
    // Reset zone selection for this widget
    setSelectedZones(prev => {
      const next = { ...prev };
      delete next[widgetId];
      return next;
    });
  };

  const toggleZone = (widgetId) => {
    setSelectedZones(prev => ({
      ...prev,
      [widgetId]: prev[widgetId] === 'sidebar' ? 'main' : 'sidebar'
    }));
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
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
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
                  color: 'text-muted-foreground'
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
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50'
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
                      <div className="flex items-center gap-2 text-xs text-primary font-medium">
                        <Check size={14} />
                        Active ({widget.zone || 'main'})
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {/* Zone selector */}
                        {sidebarEnabled && (
                          <button
                            onClick={() => toggleZone(widget.id)}
                            className={`flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                              (selectedZones[widget.id] || 'main') === 'sidebar'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                            }`}
                            title={`Add to ${(selectedZones[widget.id] || 'main') === 'sidebar' ? 'sidebar' : 'main area'}`}
                          >
                            {(selectedZones[widget.id] || 'main') === 'sidebar' ? (
                              <><PanelLeft size={12} /> Sidebar</>
                            ) : (
                              <><LayoutGrid size={12} /> Main</>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleAddWidget(widget.id)}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                        >
                          <Plus size={14} />
                          Add
                        </button>
                      </div>
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
