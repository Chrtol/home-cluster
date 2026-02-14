import { useEffect } from 'react';

/**
 * ConfettiDismissOverlay - Click-anywhere overlay to dismiss confetti
 *
 * Per user decisions: "Click anywhere to dismiss confetti early"
 *
 * Renders a full-screen transparent overlay that captures clicks
 * and calls the dismiss callback. Only visible when confetti is active.
 *
 * Props:
 * - isActive: Boolean indicating if confetti is animating
 * - onDismiss: Function to call when user clicks to dismiss
 */
export default function ConfettiDismissOverlay({ isActive, onDismiss }) {
  // Also allow Escape key to dismiss
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onDismiss]);

  if (!isActive) return null;

  return (
    <div
      className="fixed inset-0 z-50 cursor-pointer"
      onClick={onDismiss}
      role="button"
      aria-label="Click to dismiss confetti"
      tabIndex={-1}
    />
  );
}
