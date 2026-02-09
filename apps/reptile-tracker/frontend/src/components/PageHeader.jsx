import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * PageHeader - Reusable page header component for consistent styling across pages
 *
 * Provides responsive layout with title, optional subtitle, action buttons, and back navigation.
 * Stacks vertically on mobile, horizontally on larger screens.
 *
 * Props:
 * - title: Main heading text (required)
 * - subtitle: Secondary text below title (optional)
 * - actions: React node for right-side action buttons (optional)
 * - backLink: { to: string, label?: string } for back navigation (optional)
 * - className: Additional CSS classes (optional)
 */
const PageHeader = ({
  title,
  subtitle,
  actions,
  backLink,
  className,
}) => {
  return (
    <div className={cn('mb-6', className)}>
      {backLink && (
        <Link
          to={backLink.to}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLink.label || 'Back'}
        </Link>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
