import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';

// Validation schemas for each log type
const feedingSchema = z.object({
  fed_date: z.string().min(1, 'Date is required'),
  fed_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/, 'Invalid time format'),
  notes: z.string().optional(),
});

const mistingSchema = z.object({
  misted_at_date: z.string().min(1, 'Date is required'),
  misted_at_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/, 'Invalid time format'),
  notes: z.string().optional(),
});

const healthSchema = z.object({
  log_date: z.string().min(1, 'Date is required'),
  log_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/, 'Invalid time format'),
  record_type: z.string().min(1, 'Please select a record type'),
  title: z.string().min(1, 'Title is required'),
  consistency: z.string().optional(),
  notes: z.string().optional(),
});

const weightSchema = z.object({
  measured_date: z.string().min(1, 'Date is required'),
  measured_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/, 'Invalid time format'),
  weight_grams: z.string().min(1, 'Weight is required').refine(val => parseFloat(val) > 0, 'Weight must be greater than 0'),
  notes: z.string().optional(),
});

const measurementSchema = z.object({
  measured_date: z.string().min(1, 'Date is required'),
  measured_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/, 'Invalid time format'),
  measurement_type: z.string().min(1, 'Please select a measurement type'),
  measurement_value: z.string().min(1, 'Value is required').refine(val => parseFloat(val) > 0, 'Value must be greater than 0'),
  measurement_unit: z.string().min(1, 'Please select a unit'),
  custom_label: z.string().optional(),
  notes: z.string().optional(),
}).refine(data => {
  if (data.measurement_type === 'custom') {
    return data.custom_label && data.custom_label.length > 0;
  }
  return true;
}, {
  message: 'Custom label is required for custom measurements',
  path: ['custom_label'],
});

// Schema map
const schemas = {
  feeding: feedingSchema,
  misting: mistingSchema,
  health: healthSchema,
  weight: weightSchema,
  measurement: measurementSchema,
};

// Parse datetime from ISO string to date and time components
const parseDateTime = (isoString) => {
  if (!isoString) return { date: '', time: '' };
  const d = new Date(isoString);
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 5);
  return { date, time };
};

/**
 * EditLogContent - In-place edit form for log entries
 *
 * Renders inside ViewLogModal when in edit mode.
 * Preserves original log data until save is confirmed.
 *
 * @param {object} log - The existing log data to edit
 * @param {string} logType - Type of log: feeding, misting, health, weight, measurement
 * @param {function} onSave - Callback with updated log data on successful save
 * @param {function} onCancel - Callback to return to view mode without saving
 */
export function EditLogContent({
  log,
  logType,
  onSave,
  onCancel,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const schema = schemas[logType] || feedingSchema;

  // Build default values from existing log
  const getDefaultValues = () => {
    switch (logType) {
      case 'feeding': {
        const { date, time } = parseDateTime(log.fed_at);
        return {
          fed_date: date,
          fed_time: time,
          notes: log.notes || '',
        };
      }
      case 'misting': {
        const { date, time } = parseDateTime(log.misted_at);
        return {
          misted_at_date: date,
          misted_at_time: time,
          notes: log.notes || '',
        };
      }
      case 'health': {
        const { date, time } = parseDateTime(log.date);
        return {
          log_date: date,
          log_time: time,
          record_type: log.record_type || 'observation',
          title: log.title || '',
          consistency: log.consistency || 'normal',
          notes: log.description || log.notes || '',
        };
      }
      case 'weight': {
        const { date, time } = parseDateTime(log.measured_at);
        return {
          measured_date: date,
          measured_time: time,
          weight_grams: String(log.weight_grams || ''),
          notes: log.notes || '',
        };
      }
      case 'measurement': {
        const { date, time } = parseDateTime(log.measured_at);
        return {
          measured_date: date,
          measured_time: time,
          measurement_type: log.measurement_type || '',
          measurement_value: String(log.value || ''),
          measurement_unit: log.unit || '',
          custom_label: log.custom_label || '',
          notes: log.notes || '',
        };
      }
      default:
        return {};
    }
  };

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: getDefaultValues(),
    mode: 'onBlur',
  });

  // Reset form when log changes
  useEffect(() => {
    form.reset(getDefaultValues());
  }, [log, logType]);

  const handleSubmit = async (data) => {
    setError('');
    setSubmitting(true);

    try {
      let response;
      let payload;

      // Build datetime string
      const buildDateTimeISO = (date, time) => {
        return new Date(`${date}T${time}`).toISOString();
      };

      // Build datetime with timezone offset for feedings
      const buildDateTimeWithTz = (date, time) => {
        const [year, month, day] = date.split('-').map(Number);
        const [hour, minute] = time.split(':').map(Number);
        const localDate = new Date(year, month - 1, day, hour, minute, 0);

        const tzOffset = -localDate.getTimezoneOffset();
        const offsetHours = Math.floor(Math.abs(tzOffset) / 60);
        const offsetMinutes = Math.abs(tzOffset) % 60;
        const offsetSign = tzOffset >= 0 ? '+' : '-';
        const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;

        return `${date}T${time}:00${offsetString}`;
      };

      const endpoint = getEndpoint(logType, log.id);

      switch (logType) {
        case 'feeding':
          payload = {
            fed_at: buildDateTimeWithTz(data.fed_date, data.fed_time),
            notes: data.notes || '',
            // Preserve existing feeding data
            is_salad: log.is_salad || false,
            foods: log.foods || [],
            supplements: log.supplements || [],
            salad_components: log.salad_components || [],
          };
          response = await axios.put(endpoint, payload);
          break;

        case 'misting':
          payload = {
            misted_at: buildDateTimeISO(data.misted_at_date, data.misted_at_time),
            notes: data.notes || null,
          };
          response = await axios.put(endpoint, payload);
          break;

        case 'health':
          payload = {
            record_type: data.record_type,
            title: data.title,
            description: data.notes || null,
            date: buildDateTimeISO(data.log_date, data.log_time),
          };
          if (data.record_type === 'bowel_movement') {
            payload.consistency = data.consistency;
          }
          response = await axios.put(endpoint, payload);
          break;

        case 'weight':
          payload = {
            weight_grams: parseFloat(data.weight_grams),
            measured_at: buildDateTimeISO(data.measured_date, data.measured_time),
            notes: data.notes || null,
          };
          response = await axios.put(endpoint, payload);
          break;

        case 'measurement':
          payload = {
            measurement_type: data.measurement_type,
            value: parseFloat(data.measurement_value),
            unit: data.measurement_unit,
            custom_label: data.measurement_type === 'custom' ? data.custom_label : null,
            measured_at: buildDateTimeISO(data.measured_date, data.measured_time),
            notes: data.notes || null,
          };
          response = await axios.put(endpoint, payload);
          break;

        default:
          throw new Error(`Unknown log type: ${logType}`);
      }

      // Call onSave with the updated log data
      onSave?.(response.data);
    } catch (err) {
      console.error('Failed to update log:', err);
      setError(err.response?.data?.detail || 'Failed to update log. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Get API endpoint based on log type
  const getEndpoint = (type, id) => {
    const endpoints = {
      feeding: `/api/feedings/${id}`,
      misting: `/api/misting/${id}`,
      health: `/api/health/${id}`,
      weight: `/api/weight/${id}`,
      measurement: `/api/measurements/${id}`,
    };
    return endpoints[type];
  };

  const recordType = form.watch('record_type');
  const measurementType = form.watch('measurement_type');

  return (
    <div className="flex flex-col h-full">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full">
          <div className="flex-1 space-y-4 p-6 overflow-y-auto">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Feeding Fields */}
            {logType === 'feeding' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fed_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <DatePicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fed_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <TimePicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: Food items and supplements cannot be edited here. Use the full feeding log page for detailed changes.
                </p>
              </>
            )}

            {/* Misting Fields */}
            {logType === 'misting' && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="misted_at_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <DatePicker value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="misted_at_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <TimePicker value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Health Fields */}
            {logType === 'health' && (
              <>
                <FormField
                  control={form.control}
                  name="record_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Record Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select record type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="observation">General Observation</SelectItem>
                          <SelectItem value="bowel_movement">Bowel Movement</SelectItem>
                          <SelectItem value="vet_visit">Vet Visit</SelectItem>
                          <SelectItem value="medication">Medication</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={
                            recordType === 'bowel_movement'
                              ? 'e.g., Morning bowel movement'
                              : 'Brief description'
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {recordType === 'bowel_movement' && (
                  <FormField
                    control={form.control}
                    name="consistency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Consistency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select consistency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="soft">Soft</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                            <SelectItem value="watery">Watery</SelectItem>
                            <SelectItem value="mucus">Mucus Present</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="log_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <DatePicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="log_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <TimePicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {/* Weight Fields */}
            {logType === 'weight' && (
              <>
                <FormField
                  control={form.control}
                  name="weight_grams"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (grams)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.1"
                          placeholder="e.g., 125.5"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="measured_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <DatePicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="measured_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <TimePicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {/* Measurement Fields */}
            {logType === 'measurement' && (
              <>
                <FormField
                  control={form.control}
                  name="measurement_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Measurement Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select measurement type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="svl">Snout-Vent Length (SVL)</SelectItem>
                          <SelectItem value="total_length">Total Length</SelectItem>
                          <SelectItem value="humidity">Humidity</SelectItem>
                          <SelectItem value="temperature">Temperature</SelectItem>
                          <SelectItem value="shell_length">Shell Length (Turtles)</SelectItem>
                          <SelectItem value="custom">Custom Measurement</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {measurementType === 'custom' && (
                  <FormField
                    control={form.control}
                    name="custom_label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Measurement Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Tail width, Horn length" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="measurement_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Value</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} placeholder="0.0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="measurement_unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cm">Centimeters (cm)</SelectItem>
                            <SelectItem value="mm">Millimeters (mm)</SelectItem>
                            <SelectItem value="in">Inches (in)</SelectItem>
                            <SelectItem value="%">Percent (%)</SelectItem>
                            <SelectItem value="C">Celsius (C)</SelectItem>
                            <SelectItem value="F">Fahrenheit (F)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="measured_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <DatePicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="measured_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <TimePicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {/* Notes - common to all log types */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="Any additional notes..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Footer with Cancel/Save buttons */}
          <div className="px-6 py-4 border-t border-border">
            <div className="flex gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={submitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default EditLogContent;
