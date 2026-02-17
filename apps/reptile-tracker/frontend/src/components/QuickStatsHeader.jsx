import { useState, useEffect, useMemo } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Utensils, Droplets, Heart, Clock } from 'lucide-react'
import axios from 'axios'
import UserStreakDisplay from './UserStreakDisplay'

/**
 * QuickStatsHeader - Displays "due today" stats in the persistent header
 * Fetches its own data independently from Dashboard
 */
export default function QuickStatsHeader() {
  const [weeklyInstances, setWeeklyInstances] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Calculate week range (same as Dashboard)
        const today = new Date()
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)

        const toLocalISODate = (date) => {
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }

        const response = await axios.get('/api/bulk/dashboard', {
          params: {
            week_start: toLocalISODate(weekStart),
            week_end: toLocalISODate(weekEnd)
          }
        })

        setWeeklyInstances(response.data.weekly_instances || [])
      } catch (error) {
        console.error('Failed to fetch quick stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Parse instances into events
  const todayEvents = useMemo(() => {
    const today = new Date()

    return weeklyInstances
      .filter(instance => instance.schedule && instance.schedule.reptile)
      .map(instance => {
        const [year, month, day] = instance.scheduled_date.split('-').map(Number)
        const localDate = new Date(year, month - 1, day)

        return {
          instance_id: instance.id,
          date: localDate,
          schedule_type: instance.schedule.schedule_type,
          reptile_name: instance.schedule.reptile.name,
          reptile_id: instance.schedule.reptile_id,
          name: instance.schedule.name,
          food_category: instance.schedule.food_category,
          time_window_enabled: instance.schedule.time_window_enabled,
          earliest_time: instance.schedule.earliest_time,
          latest_time: instance.schedule.latest_time,
          status: instance.status
        }
      })
      .filter(event => event.date.toDateString() === today.toDateString())
  }, [weeklyInstances])

  // Compute stats
  const stats = useMemo(() => {
    const due = todayEvents.filter(e => e.status === 'pending').length
    const overdue = todayEvents.filter(e => e.status === 'missed').length
    const done = todayEvents.filter(e => e.status === 'completed').length
    return { due, overdue, done }
  }, [todayEvents])

  // Get due tasks for dropdown
  const dueTasks = useMemo(() => {
    return todayEvents
      .filter(e => e.status === 'pending' || e.status === 'missed')
      .sort((a, b) => {
        if (a.status === 'missed' && b.status !== 'missed') return -1
        if (a.status !== 'missed' && b.status === 'missed') return 1
        const aTime = a.earliest_time || '23:59'
        const bTime = b.earliest_time || '23:59'
        return aTime.localeCompare(bTime)
      })
  }, [todayEvents])

  const getScheduleTypeIcon = (type) => {
    switch (type) {
      case 'feeding':
        return <Utensils className="w-3 h-3" />
      case 'misting':
        return <Droplets className="w-3 h-3" />
      case 'health':
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

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <UserStreakDisplay />
        <div className="h-4 w-px bg-border"></div>
        <div className="flex items-center gap-4 px-3 py-1.5 rounded-lg bg-secondary/50">
          <span className="text-xs text-muted-foreground">...</span>
        </div>
      </div>
    )
  }

  const totalPending = stats.due + stats.overdue

  if (totalPending === 0 && stats.done > 0) {
    return (
      <div className="flex items-center gap-3">
        <UserStreakDisplay />
        <div className="h-4 w-px bg-border"></div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10">
          <span className="w-2 h-2 rounded-full bg-primary"></span>
          <span className="text-xs font-medium text-foreground">All done today!</span>
        </div>
      </div>
    )
  }

  if (totalPending === 0 && stats.done === 0) {
    return (
      <div className="flex items-center gap-3">
        <UserStreakDisplay />
        <div className="h-4 w-px bg-border"></div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50">
          <span className="text-xs text-muted-foreground">No tasks today</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <UserStreakDisplay />
      <div className="h-4 w-px bg-border"></div>
      <div className="flex items-center gap-4 px-3 py-1.5 rounded-lg bg-secondary/50">
      {totalPending > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer">
              <span className={`w-2 h-2 rounded-full ${stats.overdue > 0 ? 'bg-destructive' : 'bg-amber-500'}`}></span>
              <span className="text-xs font-medium text-foreground">
                {totalPending} due today
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
      {stats.done > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary"></span>
          <span className="text-xs font-medium text-foreground">
            {stats.done} done
          </span>
        </div>
      )}
      </div>
    </div>
  )
}
