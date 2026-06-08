import { QueryClient } from '@tanstack/react-query';

/**
 * QueryClient configuration for React Query
 *
 * staleTime: 30 seconds - provides real-time header feel while avoiding excessive refetches
 * refetchOnWindowFocus: false - prevents unwanted refetches when switching tabs
 *
 * Used by QueryClientProvider in App.jsx to provide caching and invalidation
 * for header stats (QuickStatsHeader, UserStreakDisplay) and other data.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds - short for real-time feel
      refetchOnWindowFocus: false,
    },
  },
});
