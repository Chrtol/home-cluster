import { useState, useEffect } from 'react'
import { getUserTimezone } from '../utils/dateFormatting'

/**
 * Header - Dashboard welcome section with greeting and date
 * Now simplified since quick stats moved to the persistent layout header
 *
 * Props:
 * - user: User object with name
 * - actions: Optional React node to render on the right side (e.g., Customize button)
 */
export default function Header({ user, actions }) {
  const [timezone, setTimezone] = useState(null)
  const [currentDate, setCurrentDate] = useState(new Date())

  // Cache timezone on mount to avoid flicker
  useEffect(() => {
    setTimezone(getUserTimezone())
  }, [])

  // Update current date every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const getGreeting = () => {
    if (!timezone) return 'Good day'

    const now = new Date()
    const hour = now.getHours()

    if (hour < 5) return 'Good night'
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const formatDate = (date) => {
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
    return date.toLocaleDateString('en-US', options)
  }

  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {getGreeting()}, {firstName}
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatDate(currentDate)}
          </p>
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
