import * as React from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/**
 * TimePicker component with popover and quick-pick grid
 *
 * Props:
 * - value: string in HH:MM format (24-hour) or empty string
 * - onChange: (time: string) => void - receives HH:MM format
 * - step: number - minutes between quick-pick options (default: 30)
 * - minTime: string - minimum selectable time in HH:MM format
 * - maxTime: string - maximum selectable time in HH:MM format
 * - placeholder: string (default: "Pick a time")
 * - disabled: boolean
 */
function TimePicker({
  value,
  onChange,
  step = 30,
  minTime,
  maxTime,
  placeholder = 'Pick a time',
  disabled = false,
  className,
}) {
  const [manualInput, setManualInput] = React.useState(value || '')
  const [isOpen, setIsOpen] = React.useState(false)

  // Update manual input when value changes from outside
  React.useEffect(() => {
    setManualInput(value || '')
  }, [value])

  // Generate quick-pick times based on step
  const generateQuickPickTimes = () => {
    const times = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += step) {
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

        // Filter by min/max time
        if (minTime && timeStr < minTime) continue
        if (maxTime && timeStr > maxTime) continue

        times.push(timeStr)
      }
    }
    return times
  }

  const quickPickTimes = generateQuickPickTimes()

  const handleManualChange = (e) => {
    const input = e.target.value
    setManualInput(input)

    // Validate HH:MM format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/
    if (timeRegex.test(input)) {
      // Ensure proper padding
      const [hour, minute] = input.split(':')
      const paddedTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`

      // Check min/max constraints
      if (minTime && paddedTime < minTime) return
      if (maxTime && paddedTime > maxTime) return

      onChange(paddedTime)
    }
  }

  const handleQuickPick = (time) => {
    onChange(time)
    setIsOpen(false)
  }

  const displayText = value || placeholder

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
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
          <Clock className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-3">
          {/* Manual input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Manual entry</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="HH:MM"
              value={manualInput}
              onChange={handleManualChange}
              className={cn(
                'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1',
                'text-sm shadow-sm transition-colors',
                'placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            />
          </div>

          {/* Quick-pick grid */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Quick pick</label>
            <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto">
              {quickPickTimes.map((time) => (
                <button
                  key={time}
                  onClick={() => handleQuickPick(time)}
                  className={cn(
                    'px-2 py-1.5 text-sm rounded-md transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    value === time && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                  )}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * TimeInput - Simple inline time input using native HTML time input
 *
 * Props:
 * - value: string in HH:MM format (24-hour) or empty string
 * - onChange: (time: string) => void - receives HH:MM format
 * - minTime: string - minimum selectable time in HH:MM format
 * - maxTime: string - maximum selectable time in HH:MM format
 * - disabled: boolean
 */
function TimeInput({
  value,
  onChange,
  minTime,
  maxTime,
  disabled = false,
  className,
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={minTime}
      max={maxTime}
      disabled={disabled}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1',
        'text-sm shadow-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
        '[&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100',
        className
      )}
    />
  )
}

export { TimePicker, TimeInput }
