import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
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
import {
  Eye,
  EyeOff,
  Save,
  GripVertical,
  Maximize2,
  Plus,
  Monitor,
  Smartphone,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  getDisplayProfiles,
  updateProfileStatistics,
  getStatisticsChartSettings,
  hasCustomStatisticsSettings,
  saveStatisticsChartSettings,
  copyGlobalSettingsToReptile,
  resetStatisticsChartSettings,
} from '../utils/displaySettings';

// Device dimension presets
const DEVICE_PRESETS = {
  mobile: { width: 375, height: 667, cols: 1, label: 'Mobile', icon: Smartphone },
  tablet: { width: 768, height: 1024, cols: 2, label: 'Tablet', icon: Monitor },
  desktop: { width: 1200, height: 800, cols: 3, label: 'Desktop', icon: Monitor },
};

// Size to grid span mapping
const SIZE_SPANS = {
  xs: 1,
  small: 1,
  medium: 2,
  large: 3,
};

const SIZE_LABELS = {
  xs: 'XS',
  small: 'S',
  medium: 'M',
  large: 'L',
};

// Helper to get profile by ID
function getProfileById(profileId) {
  const profiles = getDisplayProfiles();
  return profiles.find(p => p.id === profileId);
}

// Determine device type from profile
function getDeviceTypeFromProfile(profile) {
  if (!profile) return 'desktop';
  if (profile.id === 'mobile') return 'mobile';
  const nameLower = (profile.name || '').toLowerCase();
  if (nameLower.includes('mobile')) return 'mobile';
  if (nameLower.includes('tablet')) return 'tablet';
  return 'desktop';
}

export function StatisticsPreviewPanel({ profileId, open, onOpenChange, onSave }) {
  const [profile, setProfile] = useState(null);
  const [editedCharts, setEditedCharts] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [draggedChart, setDraggedChart] = useState(null);
  const [dragOverChart, setDragOverChart] = useState(null);
  const [reptiles, setReptiles] = useState([]);
  const [selectedReptileId, setSelectedReptileId] = useState(null);
  const containerRef = useRef(null);

  // Fetch reptiles on mount
  useEffect(() => {
    const fetchReptiles = async () => {
      try {
        const response = await axios.get('/api/reptiles');
        setReptiles(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Error fetching reptiles:', err);
        setReptiles([]);
      }
    };
    fetchReptiles();
  }, []);

  // Load profile data when opened
  useEffect(() => {
    if (open) {
      if (profileId) {
        const p = getProfileById(profileId);
        if (p) {
          setProfile(p);
          // Load charts from profile or global settings
          const charts = (p.statistics_charts || getStatisticsChartSettings()).map(c => ({
            ...c,
            visible: c.visible !== false, // Default to true if undefined
          }));
          setEditedCharts(charts);
          setHasChanges(false);
          setSelectedReptileId(null);
        }
      } else {
        // No profileId = editing global settings directly
        setProfile({ id: 'global', name: 'Global Settings' });
        const charts = getStatisticsChartSettings().map(c => ({
          ...c,
          visible: c.visible !== false,
        }));
        setEditedCharts(charts);
        setHasChanges(false);
        setSelectedReptileId(null);
      }
    }
  }, [open, profileId]);

  // Reload charts when reptile selection changes
  useEffect(() => {
    if (!open || !profile) return;

    if (selectedReptileId) {
      // Load per-reptile settings
      const charts = getStatisticsChartSettings(selectedReptileId).map(c => ({
        ...c,
        visible: c.visible !== false,
      }));
      setEditedCharts(charts);
    } else if (profile.id === 'global') {
      // Load global settings
      const charts = getStatisticsChartSettings().map(c => ({
        ...c,
        visible: c.visible !== false,
      }));
      setEditedCharts(charts);
    } else {
      // Load from profile
      const charts = (profile.statistics_charts || getStatisticsChartSettings()).map(c => ({
        ...c,
        visible: c.visible !== false,
      }));
      setEditedCharts(charts);
    }
    setHasChanges(false);
  }, [selectedReptileId, open, profile]);

  const deviceType = getDeviceTypeFromProfile(profile);
  const device = DEVICE_PRESETS[deviceType] || DEVICE_PRESETS.desktop;
  const DeviceIcon = device.icon;

  // Sort charts by order, filter out children when parent is hidden
  const sortedCharts = [...editedCharts].sort((a, b) => (a.order || 0) - (b.order || 0));
  const visibleCharts = sortedCharts.filter(c => {
    if (!c.visible) return false;
    if (c.parentId) {
      const parent = sortedCharts.find(p => p.id === c.parentId);
      return parent?.visible;
    }
    return true;
  });
  const parentCharts = visibleCharts.filter(c => !c.parentId);
  const hiddenCharts = sortedCharts.filter(c => !c.visible && !c.parentId);

  // Chart operations
  const toggleChartVisibility = (chartId) => {
    setEditedCharts(prev => prev.map(c =>
      c.id === chartId ? { ...c, visible: !c.visible } : c
    ));
    setHasChanges(true);
  };

  const cycleChartSize = (chartId) => {
    const sizes = ['xs', 'small', 'medium', 'large'];
    setEditedCharts(prev => prev.map(c => {
      if (c.id !== chartId) return c;
      const currentIdx = sizes.indexOf(c.size || 'medium');
      const nextIdx = (currentIdx + 1) % sizes.length;
      return { ...c, size: sizes[nextIdx] };
    }));
    setHasChanges(true);
  };

  // Reorder child charts within their parent
  const moveChildChart = (chartId, direction) => {
    setEditedCharts(prev => {
      const chart = prev.find(c => c.id === chartId);
      if (!chart || !chart.parentId) return prev;

      // Get siblings (same parent) sorted by order
      const siblings = prev
        .filter(c => c.parentId === chart.parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      const currentIdx = siblings.findIndex(c => c.id === chartId);
      if (currentIdx === -1) return prev;

      // Calculate new index
      const newIdx = direction === 'left' ? currentIdx - 1 : currentIdx + 1;
      if (newIdx < 0 || newIdx >= siblings.length) return prev;

      // Swap order values between the two charts
      const targetChart = siblings[newIdx];
      const currentOrder = chart.order ?? currentIdx;
      const targetOrder = targetChart.order ?? newIdx;

      return prev.map(c => {
        if (c.id === chartId) return { ...c, order: targetOrder };
        if (c.id === targetChart.id) return { ...c, order: currentOrder };
        return c;
      });
    });
    setHasChanges(true);
  };

  // Drag and drop handlers
  const handleDragStart = (e, chartId) => {
    const chart = editedCharts.find(c => c.id === chartId);
    if (chart?.parentId) return; // Don't allow dragging child charts
    setDraggedChart(chartId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, chartId) => {
    e.preventDefault();
    const chart = editedCharts.find(c => c.id === chartId);
    if (chart?.parentId) return; // Don't allow dropping on child charts
    if (chartId !== draggedChart) {
      setDragOverChart(chartId);
    }
  };

  const handleDragLeave = () => {
    setDragOverChart(null);
  };

  const handleDrop = (e, targetChartId) => {
    e.preventDefault();
    if (!draggedChart || draggedChart === targetChartId) {
      setDraggedChart(null);
      setDragOverChart(null);
      return;
    }

    const targetChart = editedCharts.find(c => c.id === targetChartId);
    if (targetChart?.parentId) return; // Don't allow dropping on child charts

    setEditedCharts(prev => {
      const charts = [...prev];
      const dragIdx = charts.findIndex(c => c.id === draggedChart);
      const targetIdx = charts.findIndex(c => c.id === targetChartId);
      if (dragIdx === -1 || targetIdx === -1) return prev;

      // Move dragged chart to target position
      const [removed] = charts.splice(dragIdx, 1);
      charts.splice(targetIdx, 0, removed);

      // Update order values (preserve child order relationships)
      let order = 0;
      return charts.map((chart) => {
        if (chart.parentId) {
          // Keep child order relative to parent
          return chart;
        }
        const newOrder = order;
        order++;
        return { ...chart, order: newOrder };
      });
    });

    setHasChanges(true);
    setDraggedChart(null);
    setDragOverChart(null);
  };

  const handleDragEnd = () => {
    setDraggedChart(null);
    setDragOverChart(null);
  };

  const handleSave = () => {
    if (selectedReptileId) {
      // Save per-reptile settings
      saveStatisticsChartSettings(editedCharts, selectedReptileId);
    } else if (profileId && editedCharts.length > 0) {
      // Save to profile
      updateProfileStatistics(profileId, editedCharts);
    } else if (!profileId && editedCharts.length > 0) {
      // Save to global settings (when profileId is null)
      saveStatisticsChartSettings(editedCharts);
    }
    setHasChanges(false);
    onSave?.();
  };

  const handleCloseAttempt = () => {
    if (hasChanges) {
      setShowDiscardDialog(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardDialog(false);
    onOpenChange(false);
  };

  const handleCopyFromGlobal = () => {
    if (selectedReptileId) {
      copyGlobalSettingsToReptile(selectedReptileId);
      const charts = getStatisticsChartSettings(selectedReptileId).map(c => ({
        ...c,
        visible: c.visible !== false,
      }));
      setEditedCharts(charts);
      setHasChanges(false);
    }
  };

  const handleResetToGlobal = () => {
    if (selectedReptileId) {
      resetStatisticsChartSettings(selectedReptileId);
      const charts = getStatisticsChartSettings(selectedReptileId).map(c => ({
        ...c,
        visible: c.visible !== false,
      }));
      setEditedCharts(charts);
      setHasChanges(false);
    }
  };

  if (!profile) return null;

  // Get all children for a parent (visible and hidden)
  const getAllChildCharts = (parentId) => {
    return sortedCharts.filter(c => c.parentId === parentId);
  };

  // Render a chart card in the wireframe
  const renderChartCard = (chart) => {
    const span = Math.min(SIZE_SPANS[chart.size || 'medium'] || 2, device.cols);
    const isDragging = draggedChart === chart.id;
    const isDragOver = dragOverChart === chart.id;
    const isChild = !!chart.parentId;
    const allChildCharts = getAllChildCharts(chart.id);
    const hasChildren = allChildCharts.length > 0;

    return (
      <div
        key={chart.id}
        className={`
          relative group rounded-lg border-2 transition-all
          ${!isChild ? 'cursor-grab active:cursor-grabbing' : ''}
          ${isDragging ? 'opacity-40 border-dashed' : ''}
          ${isDragOver ? 'border-primary ring-2 ring-primary/30' : 'border-border'}
          bg-card
        `}
        style={{
          gridColumn: `span ${span}`,
          minHeight: hasChildren ? '120px' : '80px',
        }}
        draggable={!isChild}
        onDragStart={(e) => handleDragStart(e, chart.id)}
        onDragOver={(e) => handleDragOver(e, chart.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, chart.id)}
        onDragEnd={handleDragEnd}
      >
        {/* Chart content */}
        <div className="p-3 h-full flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {!isChild && <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              <BarChart3 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-sm truncate">{chart.label || chart.id}</span>
            </div>
          </div>

          {/* Child charts (e.g., Summary Cards) - always interactive */}
          {hasChildren ? (
            <div className="flex-1 mt-2">
              <div className="text-xs text-muted-foreground mb-1">Click name to toggle, arrows to reorder:</div>
              <div className="flex flex-wrap gap-1">
                {allChildCharts.map((child, idx) => (
                  <div
                    key={child.id}
                    className={`
                      flex items-center rounded text-xs transition-colors
                      ${child.visible
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-muted/30 text-muted-foreground border border-transparent'
                      }
                    `}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); moveChildChart(child.id, 'left'); }}
                      className="p-1 hover:bg-black/20 rounded-l disabled:opacity-30"
                      disabled={idx === 0}
                      title="Move left"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleChartVisibility(child.id); }}
                      className={`px-1 py-1 hover:bg-black/20 ${!child.visible ? 'line-through' : ''}`}
                      title={child.visible ? 'Click to hide' : 'Click to show'}
                    >
                      {(child.label || child.id).replace('  ↳ ', '')}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveChildChart(child.id, 'right'); }}
                      className="p-1 hover:bg-black/20 rounded-r disabled:opacity-30"
                      disabled={idx === allChildCharts.length - 1}
                      title="Move right"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 mt-2 rounded bg-muted/30 min-h-[24px]" />
          )}
        </div>

        {/* Edit controls overlay - visible on hover */}
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg flex items-start justify-end gap-2 p-2">
          {/* Size button (not for mobile - only 1 column) */}
          {deviceType !== 'mobile' && (
            <button
              onClick={(e) => { e.stopPropagation(); cycleChartSize(chart.id); }}
              className="px-2 py-1 bg-muted text-foreground rounded text-xs font-medium hover:bg-muted/80 flex items-center gap-1"
              title="Change size"
            >
              <Maximize2 className="w-3 h-3" />
              {SIZE_LABELS[chart.size || 'medium']}
            </button>
          )}

          {/* Hide button */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleChartVisibility(chart.id); }}
            className="p-1.5 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
            title="Hide chart"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleCloseAttempt}>
        <SheetContent side="right" className="w-full sm:max-w-5xl flex flex-col p-0">
          <SheetHeader className="p-6 pb-0">
            <SheetTitle className="flex items-center gap-3">
              <DeviceIcon className="w-5 h-5 text-muted-foreground" />
              <span>{profile.name} - Statistics</span>
              {hasChanges && (
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">
                  unsaved
                </span>
              )}
            </SheetTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Preview and edit statistics layout for {device.label.toLowerCase()} ({device.width}×{device.height})
            </p>
          </SheetHeader>

          {/* Reptile selector */}
          <div className="px-6 py-3 border-b border-border">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm font-medium text-foreground">Customize for:</label>
              <select
                value={selectedReptileId || ''}
                onChange={(e) => setSelectedReptileId(e.target.value ? parseInt(e.target.value) : null)}
                className="input text-sm py-1.5 px-2 min-w-[180px]"
              >
                <option value="">All Reptiles (Profile Default)</option>
                {reptiles.map(reptile => (
                  <option key={reptile.id} value={reptile.id}>
                    {reptile.name}
                    {hasCustomStatisticsSettings(reptile.id) ? ' (Custom)' : ''}
                  </option>
                ))}
              </select>
              {selectedReptileId && (
                <>
                  {hasCustomStatisticsSettings(selectedReptileId) ? (
                    <Button variant="outline" size="sm" onClick={handleResetToGlobal}>
                      Reset to Global
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={handleCopyFromGlobal}>
                      Copy from Global
                    </Button>
                  )}
                </>
              )}
            </div>
            {selectedReptileId && hasCustomStatisticsSettings(selectedReptileId) && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                Editing custom layout for this reptile
              </p>
            )}
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 px-6 py-3 border-b border-border text-sm">
            <span className="text-muted-foreground">
              {parentCharts.length} visible charts
            </span>
            {hiddenCharts.length > 0 && (
              <span className="text-muted-foreground">
                {hiddenCharts.length} hidden
              </span>
            )}
          </div>

          {/* Wireframe preview area */}
          <div ref={containerRef} className="flex-1 overflow-auto p-6 bg-muted/30">
            <div className="max-w-4xl mx-auto">
              {/* Statistics wireframe - single column layout like statistics page */}
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Statistics Charts
              </div>
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${device.cols}, minmax(0, 1fr))`,
                }}
              >
                {parentCharts.map(chart => renderChartCard(chart))}
              </div>

              {/* Hidden charts section */}
              {hiddenCharts.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Hidden Charts
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hiddenCharts.map(chart => (
                      <button
                        key={chart.id}
                        onClick={() => toggleChartVisibility(chart.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border bg-muted/30 text-sm hover:bg-muted/50 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        {chart.label || chart.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="border-t border-border p-4 flex-row justify-end gap-2">
            <Button variant="outline" onClick={handleCloseAttempt}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Discard changes confirmation dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this layout. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscard}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default StatisticsPreviewPanel;
