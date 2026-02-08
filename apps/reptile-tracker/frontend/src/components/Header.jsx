import { useState, useEffect } from 'react'
import { getUserTimezone } from '../utils/dateFormatting'
import NotificationBell from './NotificationBell'

export default function Header({ user, todayStats }) {
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
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  const getGreeting = () => {
    if (!timezone) return 'Good day' // Fallback while timezone loads

    const now = new Date()
    const hour = now.getHours()

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

  const renderQuickStats = () => {
    if (!todayStats) {
      return (
        <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-secondary/50">
          <span className="text-xs text-muted-foreground">...</span>
        </div>
      )
    }

    const { due = 0, done = 0, overdue = 0 } = todayStats
    const totalPending = due + overdue

    if (totalPending === 0 && done > 0) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10">
          <span className="w-2 h-2 rounded-full bg-primary"></span>
          <span className="text-xs font-medium text-foreground">All done!</span>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-secondary/50">
        {(due > 0 || overdue > 0) && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-xs font-medium text-foreground">
              {totalPending} due
            </span>
          </div>
        )}
        {done > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            <span className="text-xs font-medium text-foreground">
              {done} done
            </span>
          </div>
        )}
      </div>
    )
  }

  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <header className="px-6 py-4 border-b border-border bg-secondary/30">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-xs text-muted-foreground">
            {formatDate(currentDate)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {renderQuickStats()}
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
