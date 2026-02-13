import React from 'react'
import { Flame } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

/**
 * StreakBadge - Compact flame icon with streak count and detail popover
 *
 * Redesigned: Small circular badge with flame icon and number.
 * Colors: Warm orange gradient based on milestone (brighter = higher streak).
 */
export default function StreakBadge({ streak }) {
  if (!streak || streak.current_streak === 0) {
    return null
  }

  // Color intensity based on milestone
  const getColors = (count) => {
    if (count >= 100) return { bg: 'bg-yellow-500/25', text: 'text-yellow-400', glow: 'shadow-yellow-500/20' }
    if (count >= 30) return { bg: 'bg-amber-500/25', text: 'text-amber-400', glow: 'shadow-amber-500/20' }
    if (count >= 7) return { bg: 'bg-orange-500/25', text: 'text-orange-400', glow: 'shadow-orange-500/20' }
    return { bg: 'bg-orange-500/15', text: 'text-orange-400/80', glow: '' }
  }

  const colors = getColors(streak.current_streak)
  const isGracePeriod = streak.grace_days_remaining < streak.grace_period_days

  const lastCompletionText = streak.last_completion_date
    ? formatDistanceToNow(new Date(streak.last_completion_date), { addSuffix: true })
    : 'Never'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 px-2 h-6 rounded-full text-xs font-medium",
            "transition-all hover:scale-105 cursor-pointer",
            colors.bg, colors.text,
            colors.glow && `shadow-sm ${colors.glow}`,
            isGracePeriod && 'opacity-50'
          )}
        >
          <Flame className="w-3 h-3" />
          <span>{streak.current_streak}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3" side="bottom" align="end">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Flame className="w-4 h-4 text-orange-400" />
            Streak Stats
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current</span>
              <span className="font-medium">{streak.current_streak} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Longest</span>
              <span className="font-medium">{streak.longest_streak} days</span>
            </div>
            {isGracePeriod && (
              <div className="flex justify-between text-amber-400">
                <span>Grace left</span>
                <span>{streak.grace_days_remaining}/{streak.grace_period_days}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-border">
              <span className="text-muted-foreground">Last done</span>
              <span className="font-medium">{lastCompletionText}</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
