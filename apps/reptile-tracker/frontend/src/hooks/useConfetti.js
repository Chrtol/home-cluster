import { useCallback, useState } from 'react';
import confetti from 'canvas-confetti';
import { useCelebrations } from '../contexts/CelebrationContext';

/**
 * useConfetti - Reusable confetti hook with intensity presets
 *
 * Per user decisions:
 * - Subtle: Quick small burst for task completions (particleCount 30, spread 50, ~1s)
 * - Dramatic: Longer burst for streak milestones (particleCount 150, spread 180, ~3s, multi-origin)
 * - Respects celebrationsEnabled preference
 * - Uses canvas-confetti's built-in disableForReducedMotion
 *
 * Returns:
 * - triggerSubtle: Function to trigger subtle confetti
 * - triggerDramatic: Function to trigger dramatic confetti (with milestone colors)
 * - isActive: Boolean indicating if confetti is currently animating
 * - dismiss: Function to clear confetti immediately
 */
export function useConfetti() {
  const { celebrationsEnabled, prefersReducedMotion } = useCelebrations();
  const [isActive, setIsActive] = useState(false);

  // Shared confetti options
  const baseOptions = {
    disableForReducedMotion: true,
    useWorker: true,
  };

  // Subtle confetti for task completions
  const triggerSubtle = useCallback(() => {
    if (!celebrationsEnabled || prefersReducedMotion) return;

    setIsActive(true);

    confetti({
      ...baseOptions,
      particleCount: 30,
      spread: 50,
      startVelocity: 25,
      gravity: 1.2,
      scalar: 0.9,
      origin: { y: 0.7 },
      colors: ['#a855f7', '#f472b6', '#fbbf24', '#4ade80'], // Purple, pink, amber, green
    });

    // Auto-clear active state
    setTimeout(() => setIsActive(false), 1000);
  }, [celebrationsEnabled, prefersReducedMotion]);

  // Dramatic confetti for milestones (colors passed as param)
  const triggerDramatic = useCallback((colors = ['#a855f7', '#f472b6', '#fbbf24']) => {
    if (!celebrationsEnabled || prefersReducedMotion) return;

    setIsActive(true);

    // Fire from left
    confetti({
      ...baseOptions,
      particleCount: 75,
      spread: 100,
      startVelocity: 55,
      origin: { x: 0.1, y: 0.6 },
      colors,
    });

    // Fire from right
    confetti({
      ...baseOptions,
      particleCount: 75,
      spread: 100,
      startVelocity: 55,
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
          startVelocity: 45,
          origin: { y: 0.5 },
          colors,
        });
      }
    }, 200);

    // Auto-clear active state after full animation
    setTimeout(() => setIsActive(false), 3000);
  }, [celebrationsEnabled, prefersReducedMotion]);

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
