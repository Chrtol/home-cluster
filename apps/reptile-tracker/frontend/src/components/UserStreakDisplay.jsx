import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import confetti from 'canvas-confetti'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Flame, Snowflake, Trophy, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
  const [showMissesDetail, setShowMissesDetail] = useState(false)
  const [missedTasks, setMissedTasks] = useState([])
  const [loadingMisses, setLoadingMisses] = useState(false)

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

  // Attribution toast handler and milestone celebration
  useEffect(() => {
    const handleTaskComplete = (event) => {
      const { credited_to_name, completed_by_user_id, credited_to_user_id, milestone_reached } = event.detail

      // Attribution toast - only show if completing for someone else
      if (completed_by_user_id !== credited_to_user_id) {
        setToastMessage(`Completed for ${credited_to_name} - their streak continues!`)
        setShowToast(true)

        // Hide toast after 5 seconds
        setTimeout(() => setShowToast(false), 5000)
      }

      // Milestone celebration!
      if (milestone_reached) {
        triggerMilestoneCelebration(milestone_reached)
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

  const handleRecalculate = async () => {
    try {
      const response = await axios.post('/api/user-streaks/me/recalculate')
      setStreak(response.data)
    } catch (err) {
      console.error('Failed to recalculate streak:', err)
    }
  }

  const handleMissesClick = async () => {
    setShowMissesDetail(true)
    setLoadingMisses(true)
    try {
      const response = await axios.get('/api/user-streaks/me/misses')
      setMissedTasks(response.data)
    } catch (err) {
      console.error('Failed to fetch missed tasks:', err)
      setMissedTasks([])
    } finally {
      setLoadingMisses(false)
    }
  }

  const handleBackToMain = () => {
    setShowMissesDetail(false)
  }

  // Reset detail view when popover closes
  const handlePopoverOpenChange = (open) => {
    if (!open) {
      setShowMissesDetail(false)
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Compare dates (ignore time)
    const isToday = date.toDateString() === today.toDateString()
    const isYesterday = date.toDateString() === yesterday.toDateString()

    if (isToday) return 'Today'
    if (isYesterday) return 'Yesterday'

    // Format as "Mon, Jan 15"
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
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

  const getMilestoneColors = (milestone) => {
    switch(milestone) {
      case 7: return ['#CD7F32', '#D97706'] // Bronze
      case 30: return ['#FFD700', '#F59E0B'] // Gold
      case 100: return ['#E5E4E2', '#A3A3A3'] // Platinum
      case 365: return ['#B9F2FF', '#9333EA'] // Diamond
      default: return ['#FF6B6B', '#FF8E53']
    }
  }

  const getMilestoneBadge = (milestone) => {
    switch(milestone) {
      case 7: return '7 Tasks - Bronze'
      case 30: return '30 Tasks - Gold'
      case 100: return '100 Tasks - Platinum'
      case 365: return '365 Tasks - Diamond'
      default: return `${milestone} Tasks`
    }
  }

  const triggerMilestoneCelebration = (milestone) => {
    // Fire confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: getMilestoneColors(milestone)
    })

    // Show toast with milestone badge
    const badgeText = getMilestoneBadge(milestone)
    setToastMessage(
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-500" />
        <span>{badgeText} Unlocked!</span>
      </div>
    )
    setShowToast(true)

    // Hide toast after 5 seconds
    setTimeout(() => setShowToast(false), 5000)
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
      <Popover onOpenChange={handlePopoverOpenChange}>
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
        <PopoverContent className="w-80 overflow-hidden" align="start">
          <div className="relative">
            <AnimatePresence mode="wait" initial={false}>
              {!showMissesDetail ? (
                <motion.div
                  key="main"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  {/* Header with streak count and milestone badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="w-6 h-6 text-orange-500" />
                      <div>
                        <div className="text-2xl font-bold tabular-nums">{streak.current_streak} tasks</div>
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

                  {/* Consecutive misses warning - clickable to see details */}
                  <button
                    onClick={handleMissesClick}
                    className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer w-full text-left"
                  >
                    <AlertCircle className={cn(
                      "w-4 h-4",
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
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>

                  {/* Next milestone */}
                  {streak.next_milestone && (
                    <div className="flex items-start gap-2">
                      <Trophy className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="text-xs font-medium">Next milestone</div>
                        <div className="text-xs text-muted-foreground">
                          {streak.days_to_milestone} more tasks to {getMilestoneName(streak.next_milestone)} ({streak.next_milestone})
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
                    Complete tasks to grow your streak. Miss 2 in a row to break it. Freeze days protect during vacations.
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="misses"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3"
                >
                  {/* Header with back button */}
                  <button
                    onClick={handleBackToMain}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>

                  <div>
                    <h3 className="text-sm font-semibold">Recent Missed Tasks</h3>
                    <p className="text-xs text-muted-foreground">Tasks not completed on time</p>
                  </div>

                  {/* Missed tasks list */}
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {loadingMisses ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : missedTasks.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Trophy className="w-10 h-10 mx-auto mb-2 text-amber-500" />
                        <p className="text-xs font-medium">No recent misses!</p>
                        <p className="text-xs">Keep up the great work</p>
                      </div>
                    ) : (
                      missedTasks.map((task) => (
                        <Link
                          key={task.id}
                          to={`/schedules/${task.schedule_id}`}
                          className="block p-2 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors"
                        >
                          <div className="text-sm font-medium text-foreground">
                            {task.reptile_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {task.schedule_type}
                            {task.schedule_name && ` - ${task.schedule_name}`}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(task.scheduled_date)}
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
 *
 * @example
 * // In FeedingForm.jsx after successful submission:
 * import { notifyStreakAttribution } from './UserStreakDisplay'
 *
 * const response = await axios.post('/api/feeding', data)
 * if (response.data.attribution) {
 *   notifyStreakAttribution(response.data.attribution)
 * }
 */
export function notifyStreakAttribution(attribution) {
  window.dispatchEvent(new CustomEvent('task-completed', {
    detail: attribution
  }))
}
