import { useState } from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

/**
 * CollapsibleNotes - A component for displaying long notes with expand/collapse functionality
 *
 * When notes exceed maxLength, displays truncated text with "Show more" button.
 * When expanded, shows full text with "Show less" button.
 * Short notes are displayed as plain text without toggle.
 */
export function CollapsibleNotes({ notes, maxLength = 150 }) {
  const [isOpen, setIsOpen] = useState(false);

  // If no notes or notes are short enough, render plain text
  if (!notes || notes.length <= maxLength) {
    return <span className="text-sm text-foreground whitespace-pre-wrap break-words">{notes}</span>;
  }

  const truncatedText = notes.slice(0, maxLength).trim() + '...';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      {!isOpen && (
        <span className="text-sm text-foreground whitespace-pre-wrap break-words">{truncatedText}</span>
      )}
      <CollapsibleContent>
        <span className="text-sm text-foreground whitespace-pre-wrap break-words">{notes}</span>
      </CollapsibleContent>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="text-xs text-primary hover:underline ml-1 focus:outline-none"
        >
          {isOpen ? 'Show less' : 'Show more'}
        </button>
      </CollapsibleTrigger>
    </Collapsible>
  );
}

export default CollapsibleNotes;
