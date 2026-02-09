import { useState, useEffect } from 'react';

/**
 * useMediaQuery - Hook for responsive breakpoint detection
 *
 * Returns a boolean indicating whether the provided media query matches.
 * Updates automatically when the window is resized.
 *
 * @param {string} query - CSS media query string (e.g., '(min-width: 768px)')
 * @returns {boolean} - True if the media query matches, false otherwise
 *
 * Example usage:
 *   const isMobile = useMediaQuery('(max-width: 640px)');
 *   const isDesktop = useMediaQuery('(min-width: 1024px)');
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}
