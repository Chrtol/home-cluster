import { useCallback, useState } from 'react';
import confetti from 'canvas-confetti';
import { useCelebrations } from '../contexts/CelebrationContext';

/**
 * useConfetti - Reusable confetti hook with intensity presets
 *
 * Per user decisions:
 * - Subtle: Quick small burst for task completions (particleCount 30, spread 50, ~1s)
 * - Dramatic: Longer burst for streak milestones (particleCount 150, spread 180, ~3s, multi-origin)
 * - Respects celebrationsEnabled preference from user settings
 * - User can override reduced-motion by explicitly enabling celebrations
 *
 * Returns:
 * - triggerSubtle: Function to trigger subtle confetti
 * - triggerDramatic: Function to trigger dramatic confetti (with milestone colors)
 * - isActive: Boolean indicating if confetti is currently animating
 * - dismiss: Function to clear confetti immediately
 */
export function useConfetti() {
  const { celebrationsEnabled } = useCelebrations();
  const [isActive, setIsActive] = useState(false);

  // Shared confetti options
  // disableForReducedMotion: false because we let the user override via settings
  const baseOptions = {
    disableForReducedMotion: false,
    useWorker: true,
  };

  // Subtle confetti for task completions
  const triggerSubtle = useCallback(() => {
    if (!celebrationsEnabled) return;

    setIsActive(true);

    confetti({
      ...baseOptions,
      particleCount: 30,
      spread: 60,
      startVelocity: 20,
      gravity: 0.8,
      ticks: 150,
      scalar: 0.9,
      origin: { y: 0.7 },
      colors: ['#8b5cf6', '#a78bfa', '#fbbf24', '#4ade80'], // Violet, light violet, amber, green
    });

    // Auto-clear active state (longer duration for visibility)
    setTimeout(() => setIsActive(false), 2500);
  }, [celebrationsEnabled]);

  // Dramatic confetti for milestones (colors passed as param)
  const triggerDramatic = useCallback((colors = ['#8b5cf6', '#a78bfa', '#fbbf24']) => {
    if (!celebrationsEnabled) return;

    setIsActive(true);

    // Fire from left
    confetti({
      ...baseOptions,
      particleCount: 75,
      spread: 100,
      startVelocity: 45,
      gravity: 0.7,
      ticks: 200,
      origin: { x: 0.1, y: 0.6 },
      colors,
    });

    // Fire from right
    confetti({
      ...baseOptions,
      particleCount: 75,
      spread: 100,
      startVelocity: 45,
      gravity: 0.7,
      ticks: 200,
      origin: { x: 0.9, y: 0.6 },
      colors,
    });

    // Fire from center after brief delay
    setTimeout(() => {
      if (celebrationsEnabled) {
        confetti({
          ...baseOptions,
          particleCount: 50,
          spread: 180,
          startVelocity: 35,
          gravity: 0.6,
          ticks: 250,
          origin: { y: 0.5 },
          colors,
        });
      }
    }, 300);

    // Auto-clear active state after full animation (longer for visibility)
    setTimeout(() => setIsActive(false), 4000);
  }, [celebrationsEnabled]);

  // Dismiss all confetti
  const dismiss = useCallback(() => {
    confetti.reset();
    setIsActive(false);
  }, []);

  return {
    triggerSubtle,
    triggerDramatic,
    isActive,
    dismiss,
  };
}

export default useConfetti;
