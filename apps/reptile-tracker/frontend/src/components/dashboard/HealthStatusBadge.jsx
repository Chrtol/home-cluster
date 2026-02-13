import React from 'react'
import { Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import SnakeIcon from '@/components/icons/SnakeIcon'

/**
 * HealthStatusBadge - Compact pill badges showing shedding/brumating with day count
 *
 * Colors: Cyan/teal for shedding (skin renewal), indigo for brumating (sleep).
 * Distinct from streak badge which uses orange/amber.
 */
export default function HealthStatusBadge({ healthStatus }) {
  if (!healthStatus || (!healthStatus.is_shedding && !healthStatus.is_brumating)) {
    return null
  }

  return (
    <div className="flex items-center gap-1">
      {healthStatus.is_shedding && (
        <div
          className={cn(
            "flex items-center gap-1 px-2 h-6 rounded-full text-xs font-medium",
            "bg-cyan-500/20 text-cyan-400",
            "cursor-help transition-colors hover:bg-cyan-500/30"
          )}
          title="Shedding"
        >
          <SnakeIcon className="w-3 h-3" />
          <span>{healthStatus.days_shedding}d</span>
        </div>
      )}
      {healthStatus.is_brumating && (
        <div
          className={cn(
            "flex items-center gap-1 px-2 h-6 rounded-full text-xs font-medium",
            "bg-indigo-500/20 text-indigo-400",
            "cursor-help transition-colors hover:bg-indigo-500/30"
          )}
          title="Brumating"
        >
          <Moon className="w-3 h-3" />
          <span>{healthStatus.days_brumating}d</span>
        </div>
      )}
    </div>
  )
}
