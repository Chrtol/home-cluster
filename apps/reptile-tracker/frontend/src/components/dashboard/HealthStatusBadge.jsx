import React from 'react'
import { Badge } from '@/components/ui/badge'

/**
 * HealthStatusBadge - Displays active health states (shedding and/or brumating)
 *
 * @param {Object} healthStatus - Health status object from Phase 18 API
 * @param {boolean} healthStatus.is_shedding - Whether reptile is shedding
 * @param {boolean} healthStatus.is_brumating - Whether reptile is brumating
 * @param {number} healthStatus.days_shedding - Days in current shedding cycle
 * @param {number} healthStatus.days_brumating - Days in current brumation cycle
 */
export default function HealthStatusBadge({ healthStatus }) {
  // Return null if no health status or no active states
  if (!healthStatus || (!healthStatus.is_shedding && !healthStatus.is_brumating)) {
    return null
  }

  return (
    <>
      {healthStatus.is_shedding && (
        <Badge
          variant="outline"
          className="border-amber-500 text-amber-500"
        >
          Shedding day {healthStatus.days_shedding}
        </Badge>
      )}
      {healthStatus.is_brumating && (
        <Badge
          variant="outline"
          className="border-purple-500 text-purple-500"
        >
          Brumating day {healthStatus.days_brumating}
        </Badge>
      )}
    </>
  )
}
