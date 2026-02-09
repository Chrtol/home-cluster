import { GripVertical, X, ArrowRight } from 'lucide-react';

/**
 * DashboardSidebar - Sidebar component for dashboard split layout
 *
 * Renders sidebar cards in a single column with independent stacking.
 * In edit mode, shows drag handle and hide button.
 * Cards can be moved to main zone via button.
 *
 * Props:
 * - cards: Array of card objects in sidebar zone
 * - isEditMode: boolean - Whether edit mode is active
 * - onHide: function(cardId) - Handler to hide a widget
 * - onMoveToMain: function(cardId) - Handler to move widget to main zone
 * - renderCard: function(cardId) - Render function for card content
 * - dragHandlers: object - Drag event handlers from parent
 * - draggedWidget: string - ID of widget being dragged
 * - dragOverWidget: string - ID of widget being dragged over
 */
const DashboardSidebar = ({
  cards,
  isEditMode,
  onHide,
  onMoveToMain,
  renderCard,
  dragHandlers,
  draggedWidget,
  dragOverWidget
}) => {
  if (cards.length === 0 && !isEditMode) {
    return null;
  }

  return (
    <div className="w-72 flex-shrink-0 space-y-3">
      {cards.map(card => {
        const content = renderCard(card.id);
        if (!content) return null;

        return (
          <div
            key={card.id}
            className={`relative group ${
              dragOverWidget === card.id ? 'ring-2 ring-primary' : ''
            } ${draggedWidget === card.id ? 'opacity-50' : ''}`}
            draggable={isEditMode}
            {...(dragHandlers ? {
              onDragStart: (e) => dragHandlers.onDragStart(e, card.id),
              onDragOver: (e) => dragHandlers.onDragOver(e, card.id),
              onDragLeave: dragHandlers.onDragLeave,
              onDrop: (e) => dragHandlers.onDrop(e, card.id),
              onDragEnd: dragHandlers.onDragEnd
            } : {})}
          >
            {/* Edit mode controls */}
            {isEditMode && (
              <>
                {/* Drag handle */}
                <div className="absolute top-2 left-2 z-10 w-6 h-6 bg-muted text-muted-foreground rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-4 h-4" />
                </div>
                {/* Move to main button */}
                <button
                  onClick={() => onMoveToMain(card.id)}
                  className="absolute top-2 right-10 z-10 w-6 h-6 bg-muted text-muted-foreground rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-muted/80"
                  title="Move to main area"
                  aria-label={`Move ${card.id} to main area`}
                >
                  <ArrowRight className="w-3 h-3" />
                </button>
                {/* Hide button */}
                <button
                  onClick={() => onHide(card.id)}
                  className="absolute top-2 right-2 z-10 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-destructive/90"
                  title="Hide widget"
                  aria-label={`Hide ${card.id} widget`}
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            )}
            {content}
          </div>
        );
      })}
    </div>
  );
};

export default DashboardSidebar;
