import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"

// Encouraging messages for task completion celebration
const ENCOURAGING_MESSAGES = [
  "Nice!",
  "Well done!",
  "Great job!",
  "Awesome!",
  "Keep it up!",
  "You rock!",
  "Way to go!",
  "Fantastic!",
  "Brilliant!",
  "Superb!",
]

/**
 * TaskCounterOverlay - Centered celebration overlay with counting animation
 *
 * Shows a card with animated counter (previousCount -> newCount),
 * encouraging message, and auto-dismisses after 3 seconds or on click.
 *
 * Props:
 *   isVisible: boolean - whether overlay is showing
 *   previousCount: number - count to animate from
 *   newCount: number - count to animate to
 *   onDismiss: () => void - callback when overlay is dismissed
 */
export function TaskCounterOverlay({
  isVisible,
  previousCount,
  newCount,
  onDismiss,
}) {
  const [displayCount, setDisplayCount] = useState(previousCount)

  // Select random encouraging message when overlay becomes visible
  const encouragingMessage = useMemo(() => {
    if (!isVisible) return ""
    return ENCOURAGING_MESSAGES[Math.floor(Math.random() * ENCOURAGING_MESSAGES.length)]
  }, [isVisible])

  // Count-up animation effect
  useEffect(() => {
    if (!isVisible) {
      setDisplayCount(previousCount)
      return
    }

    // If counts are the same, no animation needed
    if (previousCount === newCount) {
      setDisplayCount(newCount)
      return
    }

    const duration = 800 // ms
    const steps = Math.abs(newCount - previousCount)
    const intervalTime = duration / steps

    let current = previousCount
    const interval = setInterval(() => {
      if (current < newCount) {
        current++
      } else if (current > newCount) {
        current--
      }
      setDisplayCount(current)

      if (current === newCount) {
        clearInterval(interval)
      }
    }, intervalTime)

    return () => clearInterval(interval)
  }, [isVisible, previousCount, newCount])

  // Auto-dismiss after 3 seconds
  useEffect(() => {
    if (!isVisible) return

    const timeout = setTimeout(() => {
      onDismiss?.()
    }, 3000)

    return () => clearTimeout(timeout)
  }, [isVisible, onDismiss])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
            }}
            className="bg-card rounded-xl p-8 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Counter display */}
            <motion.div
              key={displayCount}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-6xl font-bold text-primary"
            >
              {displayCount}
            </motion.div>

            {/* Tasks completed label */}
            <div className="text-lg text-muted-foreground mt-2">
              tasks completed
            </div>

            {/* Encouraging message */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl font-medium text-primary mt-4"
            >
              {encouragingMessage}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default TaskCounterOverlay
