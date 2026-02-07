import * as React from 'react'
import { format, parse } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getUserDateFormat, getUserFirstDayOfWeek, toLocalISODate } from '@/utils/dateFormatting'

/**
 * Convert user date format to date-fns format
 * YYYY-MM-DD -> yyyy-MM-dd
 * DD/MM/YYYY -> dd/MM/yyyy
 * MM/DD/YYYY -> MM/dd/yyyy
 * DD.MM.YYYY -> dd.MM.yyyy
 */
function convertDateFormat(userFormat) {
  return userFormat
    .replace(/YYYY/g, 'yyyy')
    .replace(/DD/g, 'dd')
    .replace(/MM/g, 'MM')
}

/**
 * DatePicker component
 *
 * Props:
 * - value: ISO date string (YYYY-MM-DD) or empty string
 * - onChange: (isoDate: string) => void - receives ISO format
 * - minDate: Date object for minimum selectable date
 * - maxDate: Date object for maximum selectable date
 * - placeholder: string (default: "Pick a date")
 * - disabled: boolean
 */
function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Pick a date',
  disabled = false,
  className,
}) {
  const userFormat = getUserDateFormat()
  const dateFnsFormat = convertDateFormat(userFormat)
  const firstDayOfWeek = getUserFirstDayOfWeek() === 'monday' ? 1 : 0

  // Parse ISO date string to Date object
  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined

  const handleSelect = (date) => {
    if (date) {
      // Convert Date to ISO string in local time
      const isoDate = toLocalISODate(date)
      onChange(isoDate)
    } else {
      onChange('')
    }
  }

  // Format display text in user's preferred format
  const displayText = selectedDate ? format(selectedDate, dateFnsFormat) : placeholder

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={(date) => {
            if (minDate && date < minDate) return true
            if (maxDate && date > maxDate) return true
            return false
          }}
          weekStartsOn={firstDayOfWeek}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

/**
 * DateRangePicker component for filtering/statistics
 *
 * Props:
 * - value: { from: string (ISO), to: string (ISO) } or null
 * - onChange: (range: { from: string, to: string } | null) => void
 * - minDate: Date object for minimum selectable date
 * - maxDate: Date object for maximum selectable date
 * - placeholder: string (default: "Pick a date range")
 * - disabled: boolean
 */
function DateRangePicker({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Pick a date range',
  disabled = false,
  className,
}) {
  const userFormat = getUserDateFormat()
  const dateFnsFormat = convertDateFormat(userFormat)
  const firstDayOfWeek = getUserFirstDayOfWeek() === 'monday' ? 1 : 0

  // Parse ISO dates to Date objects
  const selectedRange = value
    ? {
        from: value.from ? parse(value.from, 'yyyy-MM-dd', new Date()) : undefined,
        to: value.to ? parse(value.to, 'yyyy-MM-dd', new Date()) : undefined,
      }
    : undefined

  const handleSelect = (range) => {
    if (range?.from) {
      const result = {
        from: toLocalISODate(range.from),
        to: range.to ? toLocalISODate(range.to) : toLocalISODate(range.from),
      }
      onChange(result)
    } else {
      onChange(null)
    }
  }

  // Format display text
  let displayText = placeholder
  if (selectedRange?.from) {
    if (selectedRange.to) {
      displayText = `${format(selectedRange.from, dateFnsFormat)} - ${format(selectedRange.to, dateFnsFormat)}`
    } else {
      displayText = format(selectedRange.from, dateFnsFormat)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={selectedRange}
          onSelect={handleSelect}
          disabled={(date) => {
            if (minDate && date < minDate) return true
            if (maxDate && date > maxDate) return true
            return false
          }}
          weekStartsOn={firstDayOfWeek}
          numberOfMonths={2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker, DateRangePicker }
