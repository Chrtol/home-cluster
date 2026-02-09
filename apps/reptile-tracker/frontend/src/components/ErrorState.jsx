import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * ErrorState - Consistent error display component
 *
 * Displays an error icon, title, optional message, and optional retry button.
 * Centered layout with appropriate spacing for error screens.
 *
 * Props:
 * - title: Error title text (default: 'Something went wrong')
 * - message: Optional error details/description
 * - onRetry: Optional retry handler function (shows retry button when provided)
 * - className: Additional CSS classes (optional)
 */
const ErrorState = ({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}) => {
  return (
    <div className={cn('py-8 text-center', className)}>
      <AlertCircle className="h-8 w-8 text-destructive mx-auto" />

      <h3 className="text-lg font-semibold text-foreground mt-3">
        {title}
      </h3>

      {message && (
        <p className="text-sm text-muted-foreground mt-1">
          {message}
        </p>
      )}

      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          className="mt-4"
        >
          Try Again
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
