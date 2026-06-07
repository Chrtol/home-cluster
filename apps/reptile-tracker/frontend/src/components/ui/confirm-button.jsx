import * as React from "react"
import { useState, useRef, useEffect } from "react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

/**
 * ConfirmButton - Inline confirmation pattern
 *
 * First click shows confirmText, reverts after timeout.
 * Second click executes onConfirm callback.
 *
 * Usage:
 *   <ConfirmButton onConfirm={() => deleteItem(id)} variant="destructive">
 *     Delete
 *   </ConfirmButton>
 */
export function ConfirmButton({
  onConfirm,
  confirmText = "Confirm?",
  timeout = 3000,
  children,
  className,
  variant = "default",
  size = "default",
  disabled,
  ...props
}) {
  const [confirming, setConfirming] = useState(false)
  const timeoutRef = useRef(null)

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (confirming) {
      // Second click - execute action
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setConfirming(false)
      onConfirm?.()
    } else {
      // First click - enter confirmation state
      setConfirming(true)
      timeoutRef.current = setTimeout(() => {
        setConfirming(false)
        timeoutRef.current = null
      }, timeout)
    }
  }

  // Amber styling when in confirmation state
  const confirmingClasses = confirming
    ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
    : ""

  return (
    <button
      type="button"
      className={cn(
        buttonVariants({ variant: confirming ? undefined : variant, size }),
        confirmingClasses,
        className
      )}
      onClick={handleClick}
      disabled={disabled}
      {...props}
    >
      {confirming ? confirmText : children}
    </button>
  )
}

export default ConfirmButton
