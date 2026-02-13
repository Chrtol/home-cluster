import React from 'react'
import { Flame } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

/**
 * StreakBadge - Displays activity streak with milestone colors and detail popover
 *
 * @param {Object} streak - Streak object from Phase 17 API
 * @param {number} streak.current_streak - Current active streak days
 * @param {number} streak.longest_streak - All-time longest streak
 * @param {number} streak.grace_days_remaining - Days left in grace period
 * @param {number} streak.grace_period_days - Total grace period length
 * @param {string} streak.last_completion_date - ISO date of last completion
 */
export default function StreakBadge({ streak }) {
  // Return null if no streak or no active streak
  if (!streak || streak.current_streak === 0) {
    return null
  }

  // Determine milestone variant based on streak count
  const getMilestoneVariant = (count) => {
    if (count >= 100) return 'streak-platinum'
    if (count >= 30) return 'streak-gold'
    if (count >= 7) return 'streak-bronze'
    return 'streak-active'
  }

  const variant = getMilestoneVariant(streak.current_streak)

  // Check if in grace period
  const isGracePeriod = streak.grace_days_remaining < streak.grace_period_days

  // Format last completion date
  const lastCompletionText = streak.last_completion_date
    ? formatDistanceToNow(new Date(streak.last_completion_date), { addSuffix: true })
    : 'Never'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant={variant}
          className={cn(
            'inline-flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105',
            isGracePeriod && 'opacity-60'
          )}
          title={`${streak.current_streak} day streak (tap for details)`}
        >
          <Flame className="h-3.5 w-3.5" />
          <span>{streak.current_streak}</span>
        </Badge>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Streak Stats</h4>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">Current: </span>
              <span className="font-medium">{streak.current_streak} days</span>
            </div>
            <div>
              <span className="text-muted-foreground">Longest: </span>
              <span className="font-medium">{streak.longest_streak} days</span>
            </div>
            {isGracePeriod && (
              <div className="text-amber-500">
                Grace days left: {streak.grace_days_remaining} of {streak.grace_period_days}
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Last completed: </span>
              <span className="font-medium">{lastCompletionText}</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
