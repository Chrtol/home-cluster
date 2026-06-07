import { useState, useEffect, useRef } from 'react';
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
  ArrowLeft,
  ArrowRight,
  Plus,
  Monitor,
  Smartphone,
} from 'lucide-react';
import {
  getDisplayProfiles,
  updateProfileCards,
  getDashboardCardSettings
} from '../utils/displaySettings';

// Device dimension presets
const DEVICE_PRESETS = {
  mobile: { width: 375, height: 667, cols: 1, label: 'Mobile', icon: Smartphone },
  tablet: { width: 768, height: 1024, cols: 2, label: 'Tablet', icon: Monitor },
  desktop: { width: 1200, height: 800, cols: 3, label: 'Desktop', icon: Monitor },
};

// Size to grid span mapping (matches Dashboard.jsx)
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

export function ProfilePreviewPanel({ profileId, open, onOpenChange, onSave }) {
  const [profile, setProfile] = useState(null);
  const [editedCards, setEditedCards] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [draggedCard, setDraggedCard] = useState(null);
  const [dragOverCard, setDragOverCard] = useState(null);
  const containerRef = useRef(null);

  // Load profile data when opened
  useEffect(() => {
    if (open && profileId) {
      const p = getProfileById(profileId);
      if (p) {
        setProfile(p);
        // Ensure all cards have visible property (default to true)
        const cards = (p.dashboard_cards || getDashboardCardSettings()).map(c => ({
          ...c,
          visible: c.visible !== false, // Default to true if undefined
        }));
        setEditedCards(cards);
        setHasChanges(false);
      }
    }
  }, [open, profileId]);

  const deviceType = getDeviceTypeFromProfile(profile);
  const device = DEVICE_PRESETS[deviceType] || DEVICE_PRESETS.desktop;
  const DeviceIcon = device.icon;

  // Sort cards by order and separate by zone
  const sortedCards = [...editedCards].sort((a, b) => (a.order || 0) - (b.order || 0));
  const mainCards = sortedCards.filter(c => c.zone !== 'sidebar' && c.visible);
  const sidebarCards = sortedCards.filter(c => c.zone === 'sidebar' && c.visible);
  const hiddenCards = sortedCards.filter(c => !c.visible);

  // Widget operations
  const toggleCardVisibility = (cardId) => {
    setEditedCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, visible: !c.visible } : c
    ));
    setHasChanges(true);
  };

  const cycleCardSize = (cardId) => {
    const sizes = ['xs', 'small', 'medium', 'large'];
    setEditedCards(prev => prev.map(c => {
      if (c.id !== cardId) return c;
      const currentIdx = sizes.indexOf(c.size || 'medium');
      const nextIdx = (currentIdx + 1) % sizes.length;
      return { ...c, size: sizes[nextIdx] };
    }));
    setHasChanges(true);
  };

  const moveToZone = (cardId, targetZone) => {
    setEditedCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, zone: targetZone } : c
    ));
    setHasChanges(true);
  };

  // Drag and drop handlers
  const handleDragStart = (e, cardId) => {
    setDraggedCard(cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, cardId) => {
    e.preventDefault();
    if (cardId !== draggedCard) {
      setDragOverCard(cardId);
    }
  };

  const handleDragLeave = () => {
    setDragOverCard(null);
  };

  const handleDrop = (e, targetCardId) => {
    e.preventDefault();
    if (!draggedCard || draggedCard === targetCardId) {
      setDraggedCard(null);
      setDragOverCard(null);
      return;
    }

    setEditedCards(prev => {
      const cards = [...prev];
      const dragIdx = cards.findIndex(c => c.id === draggedCard);
      const targetIdx = cards.findIndex(c => c.id === targetCardId);
      if (dragIdx === -1 || targetIdx === -1) return prev;

      // Move dragged card to target position
      const [removed] = cards.splice(dragIdx, 1);
      cards.splice(targetIdx, 0, removed);

      // Update order values
      return cards.map((card, i) => ({ ...card, order: i }));
    });

    setHasChanges(true);
    setDraggedCard(null);
    setDragOverCard(null);
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setDragOverCard(null);
  };

  const handleSave = () => {
    if (profileId && editedCards.length > 0) {
      updateProfileCards(profileId, editedCards);
      setHasChanges(false);
      onSave?.();
    }
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

  if (!profile) return null;

  // Render a widget card in the wireframe
  const renderWidgetCard = (card, zone = 'main') => {
    const span = zone === 'main' ? Math.min(SIZE_SPANS[card.size || 'medium'] || 2, device.cols) : 1;
    const isDragging = draggedCard === card.id;
    const isDragOver = dragOverCard === card.id;

    return (
      <div
        key={card.id}
        className={`
          relative group rounded-lg border-2 transition-all cursor-grab active:cursor-grabbing
          ${isDragging ? 'opacity-40 border-dashed' : ''}
          ${isDragOver ? 'border-primary ring-2 ring-primary/30' : 'border-border'}
          ${zone === 'main' ? 'bg-card' : 'bg-card/80'}
        `}
        style={{
          gridColumn: zone === 'main' ? `span ${span}` : undefined,
          minHeight: zone === 'sidebar' ? '48px' : '80px',
        }}
        draggable
        onDragStart={(e) => handleDragStart(e, card.id)}
        onDragOver={(e) => handleDragOver(e, card.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, card.id)}
        onDragEnd={handleDragEnd}
      >
        {/* Widget content */}
        <div className="p-3 h-full flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-sm truncate">{card.label || card.id}</span>
            </div>
          </div>

          {/* Placeholder content area */}
          <div className="flex-1 mt-2 rounded bg-muted/30 min-h-[24px]" />
        </div>

        {/* Edit controls overlay - visible on hover */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
          {/* Size button (main zone only, not mobile - only 1 column) */}
          {zone === 'main' && deviceType !== 'mobile' && (
            <button
              onClick={(e) => { e.stopPropagation(); cycleCardSize(card.id); }}
              className="px-2 py-1 bg-muted text-foreground rounded text-xs font-medium hover:bg-muted/80 flex items-center gap-1"
              title="Change size"
            >
              <Maximize2 className="w-3 h-3" />
              {SIZE_LABELS[card.size || 'medium']}
            </button>
          )}

          {/* Move to other zone */}
          {deviceType === 'desktop' && (
            <button
              onClick={(e) => { e.stopPropagation(); moveToZone(card.id, zone === 'sidebar' ? 'main' : 'sidebar'); }}
              className="p-1.5 bg-muted text-foreground rounded hover:bg-muted/80"
              title={zone === 'sidebar' ? 'Move to main' : 'Move to sidebar'}
            >
              {zone === 'sidebar' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
          )}

          {/* Hide button */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleCardVisibility(card.id); }}
            className="p-1.5 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
            title="Hide widget"
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
              <span>{profile.name}</span>
              {hasChanges && (
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">
                  unsaved
                </span>
              )}
            </SheetTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Preview and edit widget layout for {device.label.toLowerCase()} ({device.width}×{device.height})
            </p>
          </SheetHeader>

          {/* Stats bar */}
          <div className="flex items-center gap-4 px-6 py-3 border-b border-border text-sm">
            <span className="text-muted-foreground">
              {mainCards.length + sidebarCards.length} visible
            </span>
            {hiddenCards.length > 0 && (
              <span className="text-muted-foreground">
                {hiddenCards.length} hidden
              </span>
            )}
          </div>

          {/* Wireframe preview area */}
          <div ref={containerRef} className="flex-1 overflow-auto p-6 bg-muted/30">
            <div className="max-w-4xl mx-auto">
              {/* Dashboard wireframe */}
              <div className={`flex gap-4 ${deviceType === 'mobile' ? 'flex-col' : ''}`}>
                {/* Sidebar (desktop only) */}
                {deviceType === 'desktop' && sidebarCards.length > 0 && (
                  <div className="w-64 flex-shrink-0 space-y-3">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Sidebar
                    </div>
                    {sidebarCards.map(card => renderWidgetCard(card, 'sidebar'))}
                  </div>
                )}

                {/* Main area */}
                <div className="flex-1">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Main Area
                  </div>
                  <div
                    className="grid gap-3"
                    style={{
                      gridTemplateColumns: `repeat(${device.cols}, minmax(0, 1fr))`,
                    }}
                  >
                    {mainCards.map(card => renderWidgetCard(card, 'main'))}
                  </div>
                </div>
              </div>

              {/* Hidden widgets section */}
              {hiddenCards.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Hidden Widgets
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hiddenCards.map(card => (
                      <button
                        key={card.id}
                        onClick={() => toggleCardVisibility(card.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border bg-muted/30 text-sm hover:bg-muted/50 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        {card.label || card.id}
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
              You have unsaved changes to this profile. Are you sure you want to discard them?
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

export default ProfilePreviewPanel;
