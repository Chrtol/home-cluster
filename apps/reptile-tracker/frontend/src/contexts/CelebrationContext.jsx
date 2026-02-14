import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const CelebrationContext = createContext(null);

/**
 * CelebrationProvider - Global celebration state management
 *
 * Manages the "Enable celebrations" user preference with:
 * - Backend sync (stored in user profile for cross-device)
 * - prefers-reduced-motion detection (auto-disables by default)
 * - User override capability (can enable even with reduced-motion)
 */
export function CelebrationProvider({ children }) {
  const [celebrationsEnabled, setCelebrationsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Fetch user preference from backend
  useEffect(() => {
    const fetchPreference = async () => {
      try {
        const response = await axios.get('/auth/me');
        const userPref = response.data.celebrations_enabled;

        // If user has not explicitly set a preference (null/undefined),
        // default based on reduced-motion preference
        if (userPref === undefined || userPref === null) {
          setCelebrationsEnabled(!prefersReducedMotion);
        } else {
          setCelebrationsEnabled(userPref);
        }
      } catch (err) {
        // Fallback: respect reduced-motion
        setCelebrationsEnabled(!prefersReducedMotion);
      } finally {
        setLoading(false);
      }
    };

    fetchPreference();
  }, [prefersReducedMotion]);

  // Toggle celebration preference
  const toggleCelebrations = useCallback(async () => {
    const newValue = !celebrationsEnabled;
    setCelebrationsEnabled(newValue);

    try {
      await axios.patch('/auth/me', { celebrations_enabled: newValue });
    } catch (err) {
      console.error('Failed to save celebrations preference:', err);
      // Revert on error
      setCelebrationsEnabled(!newValue);
    }
  }, [celebrationsEnabled]);

  // Set celebration preference explicitly
  const setCelebrations = useCallback(async (value) => {
    setCelebrationsEnabled(value);

    try {
      await axios.patch('/auth/me', { celebrations_enabled: value });
    } catch (err) {
      console.error('Failed to save celebrations preference:', err);
      setCelebrationsEnabled(!value);
    }
  }, []);

  const value = {
    celebrationsEnabled,
    loading,
    prefersReducedMotion,
    toggleCelebrations,
    setCelebrations,
  };

  return (
    <CelebrationContext.Provider value={value}>
      {children}
    </CelebrationContext.Provider>
  );
}

export function useCelebrations() {
  const context = useContext(CelebrationContext);
  if (!context) {
    throw new Error('useCelebrations must be used within CelebrationProvider');
  }
  return context;
}

export default CelebrationContext;
