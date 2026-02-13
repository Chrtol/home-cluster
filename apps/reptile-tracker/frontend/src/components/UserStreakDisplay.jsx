import { useState, useEffect } from 'react'
import axios from 'axios'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Flame, Snowflake, Trophy, Calendar, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

/**
 * UserStreakDisplay - Shows user's streak with flame icon in header
 *
 * Features:
 * - Flame icon with current streak count
 * - Snowflake overlay when frozen (vacation mode)
 * - Popover with detailed streak info and milestone progress
 * - Attribution toast when completing tasks for other users
 */
export default function UserStreakDisplay() {
  const [streak, setStreak] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  const fetchStreak = async () => {
    try {
      const response = await axios.get('/api/user-streaks/me')
      setStreak(response.data)
      setError(false)
    } catch (err) {
      console.error('Failed to fetch user streak:', err)
      setError(true)
      // Graceful degradation - don't show anything if API fails
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStreak()

    // Refresh every 5 minutes (same as QuickStatsHeader)
    const interval = setInterval(fetchStreak, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Attribution toast handler
  useEffect(() => {
    const handleTaskComplete = (event) => {
      const { credited_to_name, completed_by_user_id, credited_to_user_id } = event.detail

      // Only show toast if completing for someone else
      if (completed_by_user_id !== credited_to_user_id) {
        setToastMessage(`Completed for ${credited_to_name} - their streak continues!`)
        setShowToast(true)

        // Hide toast after 5 seconds
        setTimeout(() => setShowToast(false), 5000)
      }

      // Refetch streak data
      fetchStreak()
    }

    window.addEventListener('task-completed', handleTaskComplete)
    return () => window.removeEventListener('task-completed', handleTaskComplete)
  }, [])

  const handleManualFreeze = async () => {
    try {
      await axios.post('/api/user-streaks/me/freeze')
      fetchStreak() // Refresh data
    } catch (err) {
      console.error('Failed to toggle freeze:', err)
    }
  }

  const getMilestoneVariant = (currentStreak) => {
    if (currentStreak >= 365) return 'streak-diamond'
    if (currentStreak >= 100) return 'streak-platinum'
    if (currentStreak >= 30) return 'streak-gold'
    if (currentStreak >= 7) return 'streak-bronze'
    return 'streak-active'
  }

  const getMilestoneName = (milestone) => {
    if (milestone >= 365) return 'Diamond'
    if (milestone >= 100) return 'Platinum'
    if (milestone >= 30) return 'Gold'
    if (milestone >= 7) return 'Bronze'
    return null
  }

  const getConsecutiveMissesMessage = (misses) => {
    if (misses === 0) return 'No misses - streak safe!'
    if (misses === 1) return 'One more miss breaks streak!'
    if (misses === 2) return 'Streak broken - complete tasks to restart'
    return `${misses} consecutive misses`
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg animate-pulse">
        <div className="w-5 h-5 bg-secondary rounded"></div>
        <div className="w-6 h-4 bg-secondary rounded"></div>
      </div>
    )
  }

  // Error state - graceful degradation (show nothing)
  if (error || !streak) {
    return null
  }

  const currentMilestone = getMilestoneName(streak.current_streak)
  const shouldAnimate = streak.current_streak > 7

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-secondary/50 transition-colors">
            <div className="relative">
              {shouldAnimate ? (
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: 'loop',
                    ease: 'easeInOut'
                  }}
                >
                  <Flame className={cn(
                    "w-5 h-5",
                    streak.current_streak > 0 ? "text-orange-500" : "text-muted-foreground",
                    streak.is_frozen_today && "opacity-50"
                  )} />
                </motion.div>
              ) : (
                <Flame className={cn(
                  "w-5 h-5",
                  streak.current_streak > 0 ? "text-orange-500" : "text-muted-foreground",
                  streak.is_frozen_today && "opacity-50"
                )} />
              )}
              {streak.is_frozen_today && (
                <Snowflake className="absolute -top-1 -right-1 w-3 h-3 text-blue-400" />
              )}
            </div>
            <span className={cn(
              "text-sm font-semibold tabular-nums",
              streak.current_streak > 0 ? "text-foreground" : "text-muted-foreground"
            )}>
              {streak.current_streak}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            {/* Header with streak count and milestone badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-6 h-6 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold tabular-nums">{streak.current_streak} days</div>
                  <div className="text-xs text-muted-foreground">Current streak</div>
                </div>
              </div>
              {currentMilestone && (
                <Badge variant={getMilestoneVariant(streak.current_streak)}>
                  <Trophy className="w-3 h-3 mr-1" />
                  {currentMilestone}
                </Badge>
              )}
            </div>

            {/* Consecutive misses warning */}
            <div className="flex items-start gap-2 p-2 rounded-lg bg-secondary/50">
              <AlertCircle className={cn(
                "w-4 h-4 mt-0.5",
                streak.consecutive_misses === 0 ? "text-green-500" :
                streak.consecutive_misses === 1 ? "text-amber-500" :
                "text-destructive"
              )} />
              <div className="flex-1">
                <div className="text-xs font-medium">
                  {streak.consecutive_misses}/2 misses
                </div>
                <div className="text-xs text-muted-foreground">
                  {getConsecutiveMissesMessage(streak.consecutive_misses)}
                </div>
              </div>
            </div>

            {/* Next milestone */}
            {streak.next_milestone && (
              <div className="flex items-start gap-2">
                <Trophy className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-xs font-medium">Next milestone</div>
                  <div className="text-xs text-muted-foreground">
                    {streak.days_to_milestone} days to {streak.next_milestone}-day {getMilestoneName(streak.next_milestone)} milestone
                  </div>
                </div>
              </div>
            )}

            {/* Freeze status */}
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Snowflake className="w-4 h-4 mt-0.5 text-blue-400" />
                <div className="flex-1">
                  <div className="text-xs font-medium">Freeze status</div>
                  <div className="text-xs text-muted-foreground">
                    {streak.is_frozen_today
                      ? 'Frozen today - streak protected'
                      : 'Not frozen'
                    }
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {streak.available_freeze_days} freeze days available
                  </div>
                </div>
              </div>

              {/* Emergency freeze toggle */}
              <button
                onClick={handleManualFreeze}
                disabled={streak.available_freeze_days === 0 && !streak.is_frozen_today}
                className={cn(
                  "w-full px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  "border border-border hover:bg-secondary/50",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {streak.is_frozen_today ? 'Unfreeze (end vacation)' : 'Emergency freeze (1 day)'}
              </button>
            </div>

            {/* Info note */}
            <div className="text-[10px] text-muted-foreground border-t border-border pt-2">
              Complete tasks daily to maintain your streak. Freeze days protect your streak during vacations.
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Attribution toast */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-background border border-border shadow-lg">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-foreground">{toastMessage}</span>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Helper to dispatch streak attribution event
 * Call this from task completion handlers with the API response data
 *
 * @param {Object} attribution - Attribution data from completion API
 * @param {string} attribution.credited_to_name - Name of user receiving credit
 * @param {number} attribution.completed_by_user_id - User who completed task
 * @param {number} attribution.credited_to_user_id - User receiving credit
 */
export function notifyStreakAttribution(attribution) {
  window.dispatchEvent(new CustomEvent('task-completed', {
    detail: attribution
  }))
}
