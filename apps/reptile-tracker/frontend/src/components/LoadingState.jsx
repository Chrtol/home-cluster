import { cn } from '@/lib/utils';

/**
 * LoadingState - Consistent loading component with spinner and skeleton variants
 *
 * Provides two loading patterns:
 * 1. Spinner: Animated spinner with optional message text
 * 2. Skeleton: Placeholder bars with pulse animation
 *
 * Props:
 * - variant: 'spinner' | 'skeleton' (default: 'spinner')
 * - message: Message text for spinner variant (default: 'Loading...')
 * - lines: Number of skeleton lines for skeleton variant (default: 3)
 * - className: Additional CSS classes (optional)
 */
const LoadingState = ({
  variant = 'spinner',
  message = 'Loading...',
  lines = 3,
  className,
}) => {
  if (variant === 'skeleton') {
    return (
      <div className={cn('animate-pulse space-y-3', className)}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'h-4 bg-muted rounded',
              index === 0 ? 'w-1/2' : 'w-full'
            )}
          />
        ))}
      </div>
    );
  }

  // Default spinner variant
  return (
    <div className={cn('flex items-center justify-center gap-2 py-8', className)}>
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
};

export default LoadingState;
