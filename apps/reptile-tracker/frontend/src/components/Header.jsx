import { useState, useEffect } from 'react'
import { getUserTimezone } from '../utils/dateFormatting'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Utensils, Droplets, Heart, Clock } from 'lucide-react'

export default function Header({ user, todayStats, dueTasks = [] }) {
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

    // Night: 00:00-04:59 (late night / very early morning)
    if (hour < 5) return 'Good night'
    // Morning: 05:00-11:59
    if (hour < 12) return 'Good morning'
    // Afternoon: 12:00-17:59
    if (hour < 18) return 'Good afternoon'
    // Evening: 18:00-23:59
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

  const getScheduleTypeIcon = (type) => {
    switch (type) {
      case 'feeding':
        return <Utensils className="w-3 h-3" />
      case 'misting':
        return <Droplets className="w-3 h-3" />
      case 'health':
      case 'weighing':
        return <Heart className="w-3 h-3" />
      default:
        return <Clock className="w-3 h-3" />
    }
  }

  const formatTimeWindow = (task) => {
    if (task.time_window_enabled && task.earliest_time && task.latest_time) {
      return `${task.earliest_time} - ${task.latest_time}`
    }
    if (task.earliest_time) {
      return task.earliest_time
    }
    return null
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
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-xs font-medium text-foreground">
                  {totalPending} due
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <div className="p-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Due Today</h3>
                <p className="text-xs text-muted-foreground">{totalPending} task{totalPending !== 1 ? 's' : ''} remaining</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {dueTasks.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground text-center">
                    No tasks due
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {dueTasks.map((task) => (
                      <div
                        key={task.instance_id}
                        className="p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <div className={`mt-0.5 ${task.status === 'missed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {getScheduleTypeIcon(task.schedule_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-foreground truncate">
                                {task.reptile_name}
                              </span>
                              {task.status === 'missed' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">
                                  Overdue
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {task.name || task.schedule_type}
                              {task.food_category && ` (${task.food_category})`}
                            </div>
                            {formatTimeWindow(task) && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {formatTimeWindow(task)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
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
        <div className="flex items-center gap-3">
          {renderQuickStats()}
        </div>
      </div>
    </div>
  )
}
