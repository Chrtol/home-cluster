import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No items',
  message,
  action,
  compact = false,
  className
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-4' : 'py-8',
        className
      )}
    >
      <Icon
        className={cn(
          'text-muted-foreground/50 mb-3',
          compact ? 'w-8 h-8' : 'w-12 h-12'
        )}
      />
      <h3
        className={cn(
          'font-medium text-foreground',
          compact ? 'text-sm' : 'text-base'
        )}
      >
        {title}
      </h3>
      {message && (
        <p
          className={cn(
            'text-muted-foreground mt-1 max-w-xs',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {message}
        </p>
      )}
      {action && (
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          onClick={action.onClick}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
