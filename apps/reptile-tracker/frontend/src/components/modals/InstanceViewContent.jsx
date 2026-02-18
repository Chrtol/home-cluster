import { formatDate } from '@/utils/dateFormatting';
import { CollapsibleNotes } from './CollapsibleNotes';
import ReptileNameWithAvatar from '../ReptileNameWithAvatar';

/**
 * InstanceViewContent - Sectioned content layout for viewing schedule instance details
 *
 * Displays instance-specific data:
 * - Task type and reptile (header row)
 * - Scheduled date
 * - Pre-calculated supplements (for feeding)
 * - Completion info (if completed)
 * - Schedule notes
 */
export function InstanceViewContent({ instance }) {
  if (!instance) return null;

  const schedule = instance.schedule;
  const reptile = schedule?.reptile;

  return (
    <div className="space-y-6 p-6 overflow-y-auto flex-1">
      {/* Task Type + Reptile Header Row */}
      <TaskTypeSection schedule={schedule} reptile={reptile} />

      {/* Date Section */}
      <DateSection instance={instance} />

      {/* Supplements Section (for feeding instances) */}
      {schedule?.schedule_type === 'feeding' && instance.supplements?.length > 0 && (
        <SupplementsSection supplements={instance.supplements} />
      )}

      {/* Completion Section (if completed) */}
      {instance.status === 'completed' && instance.completions?.length > 0 && (
        <CompletionSection completions={instance.completions} />
      )}

      {/* Schedule Details Section */}
      <ScheduleDetailsSection schedule={schedule} />

      {/* Notes Section */}
      {schedule?.notes && (
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
 * Task Type + Reptile header section
 */
function TaskTypeSection({ schedule, reptile }) {
  const getTypeBadge = (type) => {
    const typeConfig = {
      feeding: { label: 'Feeding', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
      misting: { label: 'Misting', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
      health: { label: 'Health', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
      supplement: { label: 'Supplement', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
    };
    return typeConfig[type] || { label: type, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
  };

  const typeBadge = getTypeBadge(schedule?.schedule_type);

  // Format health subtype for display
  const getHealthSubtypeLabel = () => {
    if (schedule?.schedule_type !== 'health' || !schedule?.health_subtype) return null;

    const subtypeMap = {
      'weight': 'Weight Check',
      'measurement': 'Measurement',
      'shedding_check': 'Shedding Check',
      'brumation_check': 'Brumation Check',
      'health_record': 'Health Record',
      'bathing': 'Bathing',
    };
    return subtypeMap[schedule.health_subtype] || schedule.health_subtype;
  };

  const healthSubtype = getHealthSubtypeLabel();

  return (
    <section>
      {/* Two-column layout: Task Type (left) + Reptile (right) */}
      <div className="flex items-start justify-between">
        {/* Left column: Task Type */}
        <div>
          <SectionHeader>Task</SectionHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${typeBadge.color}`}>
              {typeBadge.label}
            </span>
            {healthSubtype && (
              <span className="text-sm text-muted-foreground">
                {healthSubtype}
              </span>
            )}
          </div>
        </div>
        {/* Right column: Reptile */}
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
    </section>
  );
}

/**
 * Date Section - shows scheduled date
 */
function DateSection({ instance }) {
  return (
    <section>
      <SectionHeader>Scheduled For</SectionHeader>
      <div className="text-lg font-semibold">
        {formatDate(instance.scheduled_date)}
      </div>
      {instance.schedule?.time_window_enabled && (
        <div className="text-sm text-muted-foreground mt-1">
          {formatTime(instance.schedule.earliest_time)} - {formatTime(instance.schedule.latest_time)}
        </div>
      )}
    </section>
  );
}

/**
 * Format time string (HH:MM) to user-friendly format
 */
function formatTime(timeString) {
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
}

/**
 * Supplements Section - shows pre-calculated supplements for this instance
 */
function SupplementsSection({ supplements }) {
  return (
    <section>
      <SectionHeader>Supplements</SectionHeader>
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="text-base">💊</span>
          <div className="flex-1">
            <p className="text-xs text-blue-800 dark:text-blue-300 mb-2">
              Pre-calculated for this feeding:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {supplements.map((supp, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium"
                >
                  {supp.name || `Supplement ${supp.id}`}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Completion Section - shows how the instance was completed
 */
function CompletionSection({ completions }) {
  const latestCompletion = completions[0]; // Completions are ordered newest first

  if (!latestCompletion) return null;

  return (
    <section>
      <SectionHeader>Completion</SectionHeader>
      <div className="space-y-2">
        <Field label="Completed At">
          {latestCompletion.completed_at
            ? formatDate(latestCompletion.completed_at, { includeTime: true })
            : 'N/A'}
        </Field>
        {latestCompletion.auto_completed && (
          <div className="text-xs text-muted-foreground italic">
            Auto-completed by system
          </div>
        )}
        {latestCompletion.completion_type && (
          <Field label="Logged As">
            <span className="capitalize">{latestCompletion.completion_type}</span>
          </Field>
        )}
      </div>
    </section>
  );
}

/**
 * Schedule Details Section - shows relevant schedule config
 */
function ScheduleDetailsSection({ schedule }) {
  if (!schedule) return null;

  // Format food category
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

  // Format time slot
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

  const hasDetails =
    (schedule.schedule_type === 'feeding' && schedule.food_category) ||
    (schedule.schedule_type === 'misting' && schedule.time_slot) ||
    (schedule.schedule_type === 'health' && schedule.measurement_type);

  if (!hasDetails) return null;

  return (
    <section>
      <SectionHeader>Details</SectionHeader>
      <div className="space-y-2">
        {/* Feeding: Food Category */}
        {schedule.schedule_type === 'feeding' && schedule.food_category && (
          <Field label="Food Category">
            {formatFoodCategory(schedule.food_category)}
          </Field>
        )}

        {/* Misting: Time Slot */}
        {schedule.schedule_type === 'misting' && schedule.time_slot && (
          <Field label="Time Slot">
            {formatTimeSlot(schedule.time_slot)}
          </Field>
        )}

        {/* Health Measurement: Type */}
        {schedule.schedule_type === 'health' &&
          schedule.health_subtype === 'measurement' &&
          schedule.measurement_type && (
            <Field label="Measurement Type">
              {schedule.custom_measurement_label || schedule.measurement_type}
            </Field>
          )}
      </div>
    </section>
  );
}

/**
 * Notes Section
 */
function NotesSection({ notes }) {
  return (
    <section>
      <SectionHeader>Notes</SectionHeader>
      <CollapsibleNotes notes={notes} />
    </section>
  );
}

export default InstanceViewContent;
