import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { cn } from '@/lib/utils'
import 'react-day-picker/dist/style.css'

/**
 * Calendar component using react-day-picker v9
 *
 * Color theming is handled via CSS overrides in index.css
 * Layout is handled by react-day-picker's built-in styles
 */
function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('rdp bg-popover text-popover-foreground rounded-md border p-4', className)}
      classNames={classNames}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
