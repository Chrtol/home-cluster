import React from 'react'
import { Sparkles, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * HealthStatusBadge - Compact icon indicators for shedding/brumating
 *
 * Redesigned: Small icon badges with native tooltips.
 * Colors: Warm amber for shedding (renewal), cool indigo for brumating (sleep).
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
            "flex items-center justify-center w-6 h-6 rounded-full",
            "bg-amber-500/20 text-amber-400",
            "cursor-help transition-colors hover:bg-amber-500/30"
          )}
          title={`Shedding · Day ${healthStatus.days_shedding}`}
        >
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      )}
      {healthStatus.is_brumating && (
        <div
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full",
            "bg-indigo-500/20 text-indigo-400",
            "cursor-help transition-colors hover:bg-indigo-500/30"
          )}
          title={`Brumating · Day ${healthStatus.days_brumating}`}
        >
          <Moon className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  )
}
