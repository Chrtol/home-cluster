import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';

// Base validation schemas for each log type
const feedingBaseSchema = z.object({
  reptile_id: z.number().min(1, 'Please select a reptile'),
  fed_date: z.string().min(1, 'Date is required'),
  fed_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/, 'Invalid time format'),
  notes: z.string().optional(),
});

const mistingBaseSchema = z.object({
  reptile_id: z.number().min(1, 'Please select a reptile'),
  misted_at_date: z.string().min(1, 'Date is required'),
  misted_at_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/, 'Invalid time format'),
  notes: z.string().optional(),
});

const healthBaseSchema = z.object({
  reptile_id: z.number().min(1, 'Please select a reptile'),
  log_date: z.string().min(1, 'Date is required'),
  log_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/, 'Invalid time format'),
  record_type: z.string().min(1, 'Please select a record type'),
  title: z.string().min(1, 'Title is required'),
  consistency: z.string().optional(),
  notes: z.string().optional(),
});

const weightBaseSchema = z.object({
  reptile_id: z.number().min(1, 'Please select a reptile'),
  measured_date: z.string().min(1, 'Date is required'),
  measured_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/, 'Invalid time format'),
  weight_grams: z.string().min(1, 'Weight is required').refine(val => parseFloat(val) > 0, 'Weight must be greater than 0'),
  notes: z.string().optional(),
});

const measurementBaseSchema = z.object({
  reptile_id: z.number().min(1, 'Please select a reptile'),
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

// Schema map by log type
const schemas = {
  feeding: feedingBaseSchema,
  misting: mistingBaseSchema,
  health: healthBaseSchema,
  weight: weightBaseSchema,
  measurement: measurementBaseSchema,
};

// Get current date and time in local format
const getCurrentDate = () => new Date().toISOString().slice(0, 10);
const getCurrentTime = () => new Date().toTimeString().slice(0, 5);

// Title format for display
const LOG_TYPE_TITLES = {
  feeding: 'Log Feeding',
  misting: 'Log Misting',
  health: 'Log Health Record',
  weight: 'Log Weight',
  measurement: 'Log Measurement',
};

/**
 * CreateLogModal - Left-slide modal for creating new log entries
 *
 * @param {string} logType - The type of log: "feeding" | "misting" | "health" | "weight" | "measurement"
 * @param {number} reptileId - Pre-selected reptile ID (optional)
 * @param {number} scheduleId - Schedule ID for attribution (optional)
 * @param {boolean} open - Controlled open state
 * @param {function} onOpenChange - Callback for open state changes
 * @param {function} onSuccess - Callback on successful create, receives the new log data
 * @param {function} onCancel - Callback on cancel
 * @param {object} prefill - Pre-fill values from schedule (health_subtype, measurement_type, etc.)
 */
export function CreateLogModal({
  logType = 'feeding',
  reptileId,
  scheduleId,
  open,
  onOpenChange,
  onSuccess,
  onCancel,
  prefill = {},
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reptiles, setReptiles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Get the appropriate schema for this log type
  const schema = schemas[logType] || feedingBaseSchema;

  // Build default values based on log type
  const getDefaultValues = () => {
    const now = {
      date: getCurrentDate(),
      time: getCurrentTime(),
    };

    const baseDefaults = {
      reptile_id: reptileId || 0,
      notes: prefill.notes || '',
    };

    switch (logType) {
      case 'feeding':
        return {
          ...baseDefaults,
          fed_date: prefill.date || now.date,
          fed_time: prefill.time || now.time,
        };
      case 'misting':
        return {
          ...baseDefaults,
          misted_at_date: prefill.date || now.date,
          misted_at_time: prefill.time || now.time,
        };
      case 'health':
        return {
          ...baseDefaults,
          log_date: prefill.date || now.date,
          log_time: prefill.time || now.time,
          record_type: prefill.record_type || prefill.health_subtype || 'observation',
          title: prefill.title || '',
          consistency: prefill.consistency || 'normal',
        };
      case 'weight':
        return {
          ...baseDefaults,
          measured_date: prefill.date || now.date,
          measured_time: prefill.time || now.time,
          weight_grams: prefill.weight_grams || '',
        };
      case 'measurement':
        return {
          ...baseDefaults,
          measured_date: prefill.date || now.date,
          measured_time: prefill.time || now.time,
          measurement_type: prefill.measurement_type || '',
          measurement_value: prefill.measurement_value || '',
          measurement_unit: prefill.measurement_unit || '',
          custom_label: prefill.custom_label || '',
        };
      default:
        return baseDefaults;
    }
  };

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: getDefaultValues(),
    mode: 'onBlur',
  });

  // Fetch reptiles on mount
  useEffect(() => {
    if (!open) return;

    const fetchReptiles = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/reptiles');
        setReptiles(response.data);

        // Set default reptile if provided or use first available
        const currentReptileId = form.getValues('reptile_id');
        if (!currentReptileId || currentReptileId === 0) {
          if (reptileId) {
            form.setValue('reptile_id', reptileId);
          } else if (response.data.length > 0) {
            form.setValue('reptile_id', response.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch reptiles:', err);
        setError('Failed to load reptiles');
      } finally {
        setLoading(false);
      }
    };

    fetchReptiles();
  }, [open, reptileId]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues());
      setError('');
    }
  }, [open, logType, reptileId, prefill]);

  // Auto-set default unit for measurement type
  const measurementType = form.watch('measurement_type');
  useEffect(() => {
    if (logType === 'measurement' && measurementType && !form.getValues('measurement_unit')) {
      const unitDefaults = {
        svl: 'cm',
        total_length: 'cm',
        shell_length: 'cm',
        humidity: '%',
        temperature: 'C',
      };
      const defaultUnit = unitDefaults[measurementType];
      if (defaultUnit) {
        form.setValue('measurement_unit', defaultUnit);
      }
    }
  }, [measurementType, logType]);

  const handleSubmit = async (data) => {
    setError('');
    setSubmitting(true);

    try {
      let response;
      let payload;

      // Build datetime string with timezone offset
      const buildDateTimeISO = (date, time) => {
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

      switch (logType) {
        case 'feeding':
          // Simple feeding log (no food items - just timestamp)
          // Note: For complex feedings with food items, users should use the full FeedingLog page
          payload = {
            reptile_id: data.reptile_id,
            fed_at: buildDateTimeISO(data.fed_date, data.fed_time),
            notes: data.notes || '',
            is_salad: false,
            foods: [],
            supplements: [],
            salad_components: [],
          };
          response = await axios.post('/api/feedings', payload);
          break;

        case 'misting':
          payload = {
            reptile_id: data.reptile_id,
            misted_at: new Date(`${data.misted_at_date}T${data.misted_at_time}`).toISOString(),
            notes: data.notes || null,
          };
          response = await axios.post('/api/misting', payload);
          break;

        case 'health':
          payload = {
            reptile_id: data.reptile_id,
            record_type: data.record_type,
            title: data.title,
            description: data.notes || null,
            date: new Date(`${data.log_date}T${data.log_time}`).toISOString(),
          };
          if (data.record_type === 'bowel_movement') {
            payload.consistency = data.consistency;
          }
          response = await axios.post('/api/health', payload);
          break;

        case 'weight':
          payload = {
            reptile_id: data.reptile_id,
            weight_grams: parseFloat(data.weight_grams),
            measured_at: new Date(`${data.measured_date}T${data.measured_time}`).toISOString(),
            notes: data.notes || null,
          };
          response = await axios.post('/api/weight', payload);
          break;

        case 'measurement':
          payload = {
            reptile_id: data.reptile_id,
            measurement_type: data.measurement_type,
            value: parseFloat(data.measurement_value),
            unit: data.measurement_unit,
            custom_label: data.measurement_type === 'custom' ? data.custom_label : null,
            measured_at: new Date(`${data.measured_date}T${data.measured_time}`).toISOString(),
            notes: data.notes || null,
          };
          response = await axios.post('/api/measurements', payload);
          break;

        default:
          throw new Error(`Unknown log type: ${logType}`);
      }

      // Call success callback with created data
      onSuccess?.(response.data);
      onOpenChange?.(false);
    } catch (err) {
      console.error('Failed to create log:', err);
      setError(err.response?.data?.detail || 'Failed to create log. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange?.(false);
  };

  const recordType = form.watch('record_type');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{LOG_TYPE_TITLES[logType] || 'Log Activity'}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full">
              <div className="flex-1 space-y-4 py-6">
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                )}

                {/* Reptile Selector */}
                <FormField
                  control={form.control}
                  name="reptile_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reptile</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value ? String(field.value) : ''}
                        disabled={!!reptileId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a reptile" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {reptiles.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Log Type Specific Fields */}
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
                      For detailed feeding logs with food items and supplements, use the full feeding log page.
                    </p>
                  </>
                )}

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

                {/* Notes (common to all log types) */}
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

              <SheetFooter className="border-t pt-4">
                <div className="flex gap-3 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
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
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </Button>
                </div>
              </SheetFooter>
            </form>
          </Form>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default CreateLogModal;
