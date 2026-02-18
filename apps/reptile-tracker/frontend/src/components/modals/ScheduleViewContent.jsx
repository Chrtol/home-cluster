import { formatDateTime, formatDate, getDayNames } from '@/utils/dateFormatting';
import { CollapsibleNotes } from './CollapsibleNotes';
import ReptileNameWithAvatar from '../ReptileNameWithAvatar';

/**
 * ScheduleViewContent - Sectioned content layout for viewing schedule details
 *
 * Displays schedule data in sections: TYPE, TIMING, BEHAVIOR, REPTILE, NOTES
 * Matches styling patterns from LogViewContent for consistency.
 */
export function ScheduleViewContent({ schedule, reptile }) {
  if (!schedule) return null;

  return (
    <div className="space-y-6 p-6 overflow-y-auto flex-1">
      {/* SCHEDULE TYPE Section - includes reptile on same row */}
      <ScheduleTypeSection schedule={schedule} reptile={reptile} />

      {/* TIMING Section */}
      <TimingSection schedule={schedule} />

      {/* BEHAVIOR Section */}
      <BehaviorSection schedule={schedule} />

      {/* DETAILS Section - metadata only */}
      <DetailsSection schedule={schedule} />

      {/* NOTES Section - only if notes exist */}
      {schedule.notes && (
        <NotesSection notes={schedule.notes} />
      )}
    </div>
  );
}

/**
 * Section header component with consistent styling
 */
function SectionHeader({ children }) {
  return (
    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
      {children}
    </h3>
  );
}

/**
 * Field display component with label and value
 */
function Field({ label, children, prominent = false }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className={prominent ? 'text-lg font-semibold' : 'text-sm font-medium'}>
        {children}
      </div>
    </div>
  );
}

/**
 * SCHEDULE TYPE Section - displays type badge and reptile on same row, plus type-specific details
 */
function ScheduleTypeSection({ schedule, reptile }) {
  const getScheduleTypeBadge = (type) => {
    const typeConfig = {
      feeding: { label: 'Feeding', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
      misting: { label: 'Misting', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
      health: { label: 'Health', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
      supplement: { label: 'Supplement', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
    };
    return typeConfig[type] || { label: type, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
  };

  const typeBadge = getScheduleTypeBadge(schedule.schedule_type);

  // Format health subtype for display
  const formatHealthSubtype = (subtype) => {
    const subtypeMap = {
      'weight': 'Weight Check',
      'measurement': 'Measurement',
      'shedding_check': 'Shedding Check',
      'brumation_check': 'Brumation Check',
      'health_record': 'Health Record',
      'bathing': 'Bathing',
    };
    return subtypeMap[subtype] || subtype;
  };

  // Format measurement type for display
  const formatMeasurementType = (type, customLabel) => {
    if (type === 'custom' && customLabel) return customLabel;
    const typeMap = {
      'SVL': 'Snout-Vent Length (SVL)',
      'total_length': 'Total Length',
      'shell_length': 'Shell Length',
      'humidity': 'Humidity',
      'temp': 'Temperature',
    };
    return typeMap[type] || type;
  };

  // Format food category for display
  const formatFoodCategory = (category) => {
    const categoryMap = {
      'insects': 'Insects/Worms',
      'salad': 'Salad/Vegetables',
      'frozen': 'Frozen Prey (Rodents)',
      'prepared': 'Prepared Diet',
      'mixed': 'Mixed (Multiple Types)',
      'other': 'Other',
    };
    return categoryMap[category] || category;
  };

  // Format time slot for display
  const formatTimeSlot = (slot) => {
    const slotMap = {
      'morning': 'Morning',
      'midday': 'Midday',
      'afternoon': 'Afternoon',
      'evening': 'Evening',
      'night': 'Night',
    };
    return slotMap[slot] || slot;
  };

  return (
    <section>
      {/* Two-column layout: Schedule Type (left) + Reptile (right) */}
      <div className="flex items-start justify-between">
        {/* Left column: Schedule Type */}
        <div>
          <SectionHeader>Schedule Type</SectionHeader>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${typeBadge.color}`}>
            {typeBadge.label}
          </span>
        </div>
        {/* Right column: Reptile (content left-aligned within right-positioned column) */}
        {reptile && (
          <div>
            <SectionHeader>Reptile</SectionHeader>
            <ReptileNameWithAvatar
              reptile={reptile}
              size="sm"
              showSpecies={true}
            />
          </div>
        )}
      </div>
      <div className="space-y-3 mt-3">

        {/* Feeding-specific: Food Category */}
        {schedule.schedule_type === 'feeding' && schedule.food_category && (
          <Field label="Food Category">
            {formatFoodCategory(schedule.food_category)}
          </Field>
        )}

        {/* Misting-specific: Time Slot */}
        {schedule.schedule_type === 'misting' && schedule.time_slot && (
          <Field label="Time Slot">
            {formatTimeSlot(schedule.time_slot)}
          </Field>
        )}

        {/* Health-specific fields */}
        {schedule.schedule_type === 'health' && (
          <>
            {schedule.health_subtype && (
              <Field label="Health Type">
                {formatHealthSubtype(schedule.health_subtype)}
              </Field>
            )}
            {schedule.health_subtype === 'measurement' && schedule.measurement_type && (
              <Field label="Measurement Type">
                {formatMeasurementType(schedule.measurement_type, schedule.custom_measurement_label)}
              </Field>
            )}
            {schedule.health_subtype === 'health_record' && schedule.health_category && (
              <Field label="Record Type">
                <span className="capitalize">{schedule.health_category}</span>
              </Field>
            )}
          </>
        )}

        {/* Supplement-specific: Supplement name */}
        {schedule.schedule_type === 'supplement' && schedule.supplement && (
          <Field label="Supplement">
            {schedule.supplement.name}
          </Field>
        )}
      </div>
    </section>
  );
}

/**
 * TIMING Section - displays frequency, time window, next occurrence
 */
function TimingSection({ schedule }) {
  // Format schedule frequency
  const formatFrequency = () => {
    // Handle interval mode
    if (schedule.schedule_mode === 'interval') {
      const min = schedule.min_days_between;
      const max = schedule.max_days_between;

      let frequency = '';
      if (min && max && min !== max) {
        frequency = `Every ${min}-${max} days`;
      } else if (min) {
        frequency = `Every ${min} day${min > 1 ? 's' : ''}`;
      } else {
        frequency = 'Interval schedule';
      }

      // Add suggested days if configured
      if (schedule.suggested_days && schedule.suggested_days.length > 0) {
        const allDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const selectedDays = schedule.suggested_days.map(num => allDayNames[num]);
        frequency += ` (preferred: ${selectedDays.join(', ')})`;
      }

      return frequency;
    }

    // Handle dependent mode
    if (schedule.schedule_mode === 'dependent' || schedule.schedule_rule === 'dependent') {
      if (schedule.dependent_rule === 'every_occurrence') {
        return 'Every time parent schedule occurs';
      } else if (schedule.dependent_rule === 'every_nth') {
        return `Every ${schedule.dependent_frequency} parent occurrences`;
      } else if (schedule.dependent_rule === 'specific_days') {
        const dayNumbers = schedule.dependent_days?.split(',').map(d => parseInt(d)) || [];
        const allDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const selectedDays = dayNumbers.map(num => allDayNames[num]);
        return `On ${selectedDays.join(', ')} when parent occurs`;
      } else if (schedule.dependent_rule === 'once_per_day') {
        return 'Once per day (first occurrence only)';
      }
      return 'Dependent on parent schedule';
    }

    // Handle fixed mode rules
    switch (schedule.schedule_rule) {
      case 'every_x_days':
        return `Every ${schedule.frequency_days} day${schedule.frequency_days > 1 ? 's' : ''}`;
      case 'days_of_week': {
        if (!schedule.days_of_week) return 'Specific days of week';
        const dayNumbers = schedule.days_of_week.split(',').map(d => parseInt(d));
        const dayNames = getDayNames();
        const selectedDays = dayNumbers.map(num => {
          const index = [0, 1, 2, 3, 4, 5, 6].indexOf(num);
          return dayNames[index];
        });
        return selectedDays.join(', ');
      }
      case 'monthly':
        return `Monthly on day ${schedule.day_of_month}`;
      default:
        return schedule.schedule_rule || 'Custom';
    }
  };

  // Format schedule mode
  const getScheduleMode = () => {
    const mode = schedule.schedule_mode || 'fixed';
    const modeMap = {
      'fixed': 'Fixed Schedule',
      'interval': 'Interval Schedule',
      'dependent': 'Dependent Schedule',
    };
    return modeMap[mode] || mode;
  };

  // Format time (HH:MM string to user-friendly format)
  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':').map(Number);
    const userTimeFormat = localStorage.getItem('timeFormat') || '24h';

    if (userTimeFormat === '12h') {
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
    } else {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  };

  return (
    <section>
      <SectionHeader>Timing</SectionHeader>
      <div className="space-y-3">
        {/* Schedule Mode */}
        <Field label="Mode">
          {getScheduleMode()}
        </Field>

        {/* Frequency */}
        <Field label="Frequency">
          {formatFrequency()}
        </Field>

        {/* Parent Schedule (for dependent) */}
        {schedule.parent_schedule && (
          <Field label="Parent Schedule">
            {schedule.parent_schedule.name || `${schedule.parent_schedule.schedule_type} schedule`}
          </Field>
        )}

        {/* Time Window */}
        {schedule.time_window_enabled && (
          <Field label="Time Window">
            {formatTime(schedule.earliest_time)} - {formatTime(schedule.latest_time)}
          </Field>
        )}

        {/* Reminder Time */}
        {schedule.notifications_enabled && schedule.reminder_time && (
          <Field label="Reminder Time">
            {formatTime(schedule.reminder_time)}
          </Field>
        )}
      </div>
    </section>
  );
}

/**
 * BEHAVIOR Section - displays auto-complete, follow-up, notification settings
 */
function BehaviorSection({ schedule }) {
  const hasAnySettings = schedule.auto_complete_enabled ||
                         schedule.notifications_enabled ||
                         schedule.follow_up_enabled ||
                         schedule.flexible_completion_enabled;

  if (!hasAnySettings) {
    return null;
  }

  return (
    <section>
      <SectionHeader>Behavior</SectionHeader>
      <div className="space-y-3">
        {/* Auto-complete */}
        {schedule.auto_complete_enabled && (
          <Field label="Auto-complete">
            <span className="text-green-600 dark:text-green-400">
              Enabled
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              ({schedule.auto_complete_hours_after || 2}h after window)
            </span>
          </Field>
        )}

        {/* Flexible completion window */}
        {schedule.flexible_completion_enabled && (
          <Field label="Flexible Completion">
            <span>
              +/- {schedule.flexible_completion_days || 2} days
            </span>
          </Field>
        )}

        {/* Follow-up reminder */}
        {schedule.follow_up_enabled && (
          <Field label="Follow-up Reminder">
            <span>
              {schedule.follow_up_delay_minutes || 30} minutes after main reminder
            </span>
          </Field>
        )}

        {/* Notifications enabled */}
        {schedule.notifications_enabled && (
          <Field label="Notifications">
            <span className="text-green-600 dark:text-green-400">
              Enabled
            </span>
            {schedule.notification_channels && schedule.notification_channels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {schedule.notification_channels.map(channel => (
                  <span
                    key={channel.id}
                    className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs"
                  >
                    {channel.name}
                  </span>
                ))}
              </div>
            )}
          </Field>
        )}
      </div>
    </section>
  );
}

/**
 * DETAILS Section - displays schedule metadata (created, modified, status)
 */
function DetailsSection({ schedule }) {
  return (
    <section>
      <SectionHeader>Details</SectionHeader>
      <div className="space-y-3">
        {/* Created date */}
        {schedule.created_at && (
          <Field label="Created">
            {formatDate(schedule.created_at)}
          </Field>
        )}

        {/* Last modified date (if different from created) */}
        {schedule.updated_at && schedule.updated_at !== schedule.created_at && (
          <Field label="Last Modified">
            {formatDate(schedule.updated_at)}
          </Field>
        )}

        {/* Status */}
        <Field label="Status">
          {schedule.enabled ? (
            <span className="text-green-600 dark:text-green-400">Active</span>
          ) : (
            <span className="text-muted-foreground">Disabled</span>
          )}
        </Field>
      </div>
    </section>
  );
}

/**
 * NOTES Section - displays notes with collapsible behavior for long text
 */
function NotesSection({ notes }) {
  return (
    <section>
      <SectionHeader>Notes</SectionHeader>
      <CollapsibleNotes notes={notes} />
    </section>
  );
}

export default ScheduleViewContent;
