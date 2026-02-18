import { formatDateTime } from '@/utils/dateFormatting';
import { CollapsibleNotes } from './CollapsibleNotes';
import ReptileAvatar from '@/components/ReptileAvatar';

/**
 * LogViewContent - Sectioned content layout for viewing log entries
 *
 * Displays log data in three sections: WHAT, WHEN, NOTES
 * Adapts field display based on logType (feeding, misting, health, weight, measurement)
 */
export function LogViewContent({ log, logType }) {
  if (!log) return null;

  // Get reptile info from log
  const reptile = log.reptile;
  const reptileName = reptile?.name || log.reptile_name;

  return (
    <div className="space-y-6 p-6 overflow-y-auto flex-1">
      {/* Reptile Info Header */}
      {reptileName && (
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <ReptileAvatar reptile={reptile} size="md" />
          <div>
            <div className="text-base font-semibold text-foreground">{reptileName}</div>
            {reptile?.species && (
              <div className="text-sm text-muted-foreground">{reptile.species}</div>
            )}
          </div>
        </div>
      )}

      {/* WHAT Section */}
      <WhatSection log={log} logType={logType} />

      {/* WHEN Section */}
      <WhenSection log={log} logType={logType} />

      {/* NOTES Section - only if notes exist */}
      {(log.notes || log.description) && (
        <NotesSection notes={log.notes || log.description} />
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
 * WHAT Section - displays type-specific data
 */
function WhatSection({ log, logType }) {
  return (
    <section>
      <SectionHeader>What</SectionHeader>
      <div className="space-y-3">
        {logType === 'feeding' && <FeedingFields log={log} />}
        {logType === 'misting' && <MistingFields />}
        {logType === 'health' && <HealthFields log={log} />}
        {logType === 'weight' && <WeightFields log={log} />}
        {logType === 'measurement' && <MeasurementFields log={log} />}
      </div>
    </section>
  );
}

/**
 * WHEN Section - displays timestamp and attribution info
 */
function WhenSection({ log, logType }) {
  // Determine the primary timestamp field based on log type
  const getTimestamp = () => {
    if (logType === 'feeding') return log.fed_at;
    if (logType === 'misting') return log.misted_at;
    if (logType === 'weight' || logType === 'measurement') return log.measured_at;
    if (logType === 'health') return log.date;
    return log.created_at;
  };

  // Get user who logged this entry
  const getLoggedBy = () => {
    if (log.user?.name) return log.user.name;
    if (log.logged_by?.name) return log.logged_by.name;
    return null;
  };

  // Get schedule attribution if present
  const getScheduleInfo = () => {
    if (log.schedule_completion?.schedule_instance?.schedule?.name) {
      return log.schedule_completion.schedule_instance.schedule.name;
    }
    if (log.schedule_completion) {
      return 'Scheduled task';
    }
    return null;
  };

  const timestamp = getTimestamp();
  const loggedBy = getLoggedBy();
  const scheduleInfo = getScheduleInfo();

  return (
    <section>
      <SectionHeader>When</SectionHeader>
      <div className="space-y-2">
        {timestamp && (
          <Field label="Date & Time">
            {formatDateTime(timestamp)}
          </Field>
        )}
        {loggedBy && (
          <Field label="Logged by">
            {loggedBy}
          </Field>
        )}
        {scheduleInfo && (
          <Field label="From Schedule">
            {scheduleInfo}
          </Field>
        )}
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

/**
 * Feeding-specific fields
 */
function FeedingFields({ log }) {
  // Determine food category display
  const getFoodCategory = () => {
    if (log.is_salad) return 'Salad';
    const categories = new Set();
    log.foods?.forEach(food => {
      if (food.category === 'insect' || food.category === 'worms') categories.add('Insects');
      else if (food.category === 'prepared') categories.add('Prepared');
      else if (food.category === 'vegetable' || food.category === 'fruit') categories.add('Salad');
    });
    return Array.from(categories).join(', ') || 'Food';
  };

  return (
    <>
      {/* Food Category */}
      <Field label="Category">{getFoodCategory()}</Field>

      {/* Food Items List */}
      {log.foods && log.foods.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground">Food Items</span>
          <div className="mt-1 space-y-2">
            {log.foods.map((food, index) => {
              // Skip salad food item if is_salad (show components instead)
              if (food.name === 'Salad' && log.is_salad) return null;

              return (
                <div key={index} className="bg-card/50 p-2 rounded">
                  <div className="text-sm font-medium">
                    {food.name} x {food.quantity || 1}
                  </div>
                  {food.supplements && food.supplements.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {food.supplements.map(sup => (
                        <span
                          key={sup.id}
                          className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-xs"
                        >
                          {sup.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Salad Components */}
      {log.is_salad && log.salad_components && log.salad_components.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground">Salad Components</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {log.salad_components.map(component => (
              <span
                key={component.id}
                className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded text-xs"
              >
                {component.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Global Supplements */}
      {log.supplements && log.supplements.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground">Supplements (all items)</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {log.supplements.map(sup => (
              <span
                key={sup.id}
                className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded text-xs"
              >
                {sup.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Misting-specific fields - simple, just indicates misting occurred
 */
function MistingFields() {
  return (
    <Field label="Action">Misted enclosure</Field>
  );
}

/**
 * Health record-specific fields
 */
function HealthFields({ log }) {
  // Format record type for display
  const formatRecordType = (recordType) => {
    const typeMap = {
      'observation': 'General Observation',
      'vet_visit': 'Vet Visit',
      'medication': 'Medication',
      'shedding': 'Shedding',
      'shedding_check': 'Shedding Check',
      'brumation': 'Brumation',
      'brumation_check': 'Brumation Check',
      'bowel_movement': 'Bowel Movement',
      'bathing': 'Bathing',
    };
    return typeMap[recordType] || recordType;
  };

  // Format event type for shedding/brumation
  const formatEventType = (recordType, eventType) => {
    if (recordType === 'shedding') {
      if (eventType === 'start') return 'Started Shedding';
      if (eventType === 'complete') return 'Shed Complete';
    }
    if (recordType === 'shedding_check') {
      return log.title || 'Shedding Check';
    }
    if (recordType === 'brumation') {
      if (eventType === 'start') return 'Started Brumating';
      if (eventType === 'end') return 'Ended Brumation';
    }
    return null;
  };

  const eventDescription = formatEventType(log.record_type, log.event_type);

  return (
    <>
      <Field label="Record Type">{formatRecordType(log.record_type)}</Field>

      {/* For shedding/brumation events, show event description */}
      {eventDescription && (
        <Field label="Event">{eventDescription}</Field>
      )}

      {/* For regular health records, show title */}
      {log.title && !['shedding', 'brumation', 'shedding_check', 'bathing'].includes(log.record_type) && (
        <Field label="Title">{log.title}</Field>
      )}

      {/* Bowel movement consistency */}
      {log.record_type === 'bowel_movement' && log.consistency && (
        <Field label="Consistency">
          <span className="capitalize">{log.consistency}</span>
        </Field>
      )}
    </>
  );
}

/**
 * Weight-specific fields
 */
function WeightFields({ log }) {
  return (
    <Field label="Weight" prominent>
      {log.weight_grams}g
    </Field>
  );
}

/**
 * Measurement-specific fields
 */
function MeasurementFields({ log }) {
  // Format measurement type for display
  const formatMeasurementType = (measurementType, customLabel) => {
    if (measurementType === 'custom' && customLabel) return customLabel;
    const typeMap = {
      'svl': 'Snout-Vent Length (SVL)',
      'total_length': 'Total Length',
      'shell_length': 'Shell Length',
      'humidity': 'Humidity',
      'temperature': 'Temperature',
    };
    return typeMap[measurementType] || measurementType;
  };

  return (
    <>
      <Field label="Measurement Type">
        {formatMeasurementType(log.measurement_type, log.custom_label)}
      </Field>
      <Field label="Value" prominent>
        {log.value} {log.unit}
      </Field>
    </>
  );
}

export default LogViewContent;
