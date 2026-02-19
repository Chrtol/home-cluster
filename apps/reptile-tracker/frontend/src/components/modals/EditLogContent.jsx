import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { Loader2, Plus, X, Bug, Leaf, Utensils } from 'lucide-react';

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
  include_insects: z.boolean(),
  include_salad: z.boolean(),
  include_prepared: z.boolean(),
  insect_items: z.array(z.object({
    id: z.number(),
    food_id: z.string(),
    quantity: z.number().min(1),
    supplement_ids: z.array(z.number())
  })),
  salad_components: z.array(z.number()),
  salad_supplements: z.array(z.number()),
  prepared_items: z.array(z.object({
    id: z.number(),
    food_id: z.string(),
    quantity: z.number().min(1),
    supplement_ids: z.array(z.number())
  })),
  global_supplements: z.array(z.number())
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
  const [foods, setFoods] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const schema = schemas[logType] || feedingSchema;

  // Build default values from existing log
  const getDefaultValues = () => {
    switch (logType) {
      case 'feeding': {
        const { date, time } = parseDateTime(log.fed_at);

        // Parse existing foods into insect and prepared items
        const insectItems = [];
        const preparedItems = [];
        let saladSupplements = [];

        if (log.foods && Array.isArray(log.foods)) {
          log.foods.forEach(foodItem => {
            // Check if this is the Salad item
            if (foodItem.is_salad) {
              saladSupplements = foodItem.supplement_ids || [];
            } else {
              // Categorize as insect or prepared based on food category
              const itemData = {
                id: foodItem.id || Date.now() + Math.random(),
                food_id: String(foodItem.food_id),
                quantity: foodItem.quantity || 1,
                supplement_ids: foodItem.supplement_ids || []
              };

              // Check category - we'll need to match against foods data later
              // For now, add to prepared by default (will be refined after foods load)
              preparedItems.push(itemData);
            }
          });
        }

        return {
          fed_date: date,
          fed_time: time,
          notes: log.notes || '',
          include_insects: insectItems.length > 0,
          include_salad: log.is_salad || false,
          include_prepared: preparedItems.length > 0,
          insect_items: insectItems,
          salad_components: log.salad_components || [],
          salad_supplements: saladSupplements,
          prepared_items: preparedItems,
          global_supplements: log.supplements || []
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

  // Set up useFieldArray for food items
  const { fields: insectFields, append: appendInsect, remove: removeInsect } = useFieldArray({
    control: form.control,
    name: 'insect_items'
  });
  const { fields: preparedFields, append: appendPrepared, remove: removePrepared } = useFieldArray({
    control: form.control,
    name: 'prepared_items'
  });

  // Watch food type toggles
  const watchIncludeInsects = useWatch({ control: form.control, name: 'include_insects' });
  const watchIncludeSalad = useWatch({ control: form.control, name: 'include_salad' });
  const watchIncludePrepared = useWatch({ control: form.control, name: 'include_prepared' });

  // Compute food category filters
  const insectFoods = foods.filter(f => f.category === 'insect' || f.category === 'worms');
  const saladFoods = foods.filter(f => f.category === 'vegetable' || f.category === 'fruit');
  const preparedFoods = foods.filter(f =>
    ['prepared', 'frozen_animal', 'live_rodent', 'fish_seafood', 'eggs', 'other'].includes(f.category) && f.name !== 'Salad'
  );

  // Fetch foods and supplements when logType is feeding
  useEffect(() => {
    const fetchFoodData = async () => {
      if (logType !== 'feeding') return;
      setLoadingData(true);
      try {
        const [foodsRes, supplementsRes] = await Promise.all([
          axios.get(`/api/foods?reptile_id=${log.reptile_id}`),
          axios.get('/api/supplements'),
        ]);
        setFoods(foodsRes.data);
        setSupplements(supplementsRes.data);
      } catch (err) {
        console.error('Failed to fetch food data:', err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchFoodData();
  }, [logType, log.reptile_id]);

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
          response = await axios.patch(endpoint, payload);
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
                {loadingData ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
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

                    {/* Food Type Toggles */}
                    <div className="space-y-2">
                      <FormLabel>Food Types</FormLabel>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={watchIncludeInsects ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const newValue = !watchIncludeInsects;
                            form.setValue('include_insects', newValue);
                            if (newValue && insectFields.length === 0) {
                              if (insectFoods.length > 0) {
                                appendInsect({ id: Date.now(), food_id: insectFoods[0].id.toString(), quantity: 1, supplement_ids: [] });
                              }
                            }
                          }}
                        >
                          <Bug className="h-4 w-4 mr-1" /> Insects
                        </Button>
                        <Button
                          type="button"
                          variant={watchIncludeSalad ? "default" : "outline"}
                          size="sm"
                          onClick={() => form.setValue('include_salad', !watchIncludeSalad)}
                        >
                          <Leaf className="h-4 w-4 mr-1" /> Salad
                        </Button>
                        <Button
                          type="button"
                          variant={watchIncludePrepared ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const newValue = !watchIncludePrepared;
                            form.setValue('include_prepared', newValue);
                            if (newValue && preparedFields.length === 0) {
                              if (preparedFoods.length > 0) {
                                appendPrepared({ id: Date.now(), food_id: preparedFoods[0].id.toString(), quantity: 1, supplement_ids: [] });
                              }
                            }
                          }}
                        >
                          <Utensils className="h-4 w-4 mr-1" /> Other
                        </Button>
                      </div>
                    </div>

                    {/* Insects Section */}
                    {watchIncludeInsects && (
                      <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Insects/Worms</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (insectFoods.length > 0) {
                                appendInsect({ id: Date.now(), food_id: insectFoods[0].id.toString(), quantity: 1, supplement_ids: [] });
                              }
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {insectFields.map((field, index) => (
                          <div key={field.id} className="space-y-2 p-2 bg-background rounded border">
                            <div className="flex gap-2 items-center">
                              <Select
                                value={form.watch(`insect_items.${index}.food_id`)}
                                onValueChange={(v) => form.setValue(`insect_items.${index}.food_id`, v)}
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {insectFoods.map(f => (
                                    <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => form.setValue(`insect_items.${index}.quantity`, Math.max(1, form.watch(`insect_items.${index}.quantity`) - 1))}
                                >
                                  -
                                </Button>
                                <Input
                                  type="number"
                                  className="w-14 h-8 text-center"
                                  value={form.watch(`insect_items.${index}.quantity`)}
                                  onChange={(e) => form.setValue(`insect_items.${index}.quantity`, Math.max(1, parseInt(e.target.value) || 1))}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => form.setValue(`insect_items.${index}.quantity`, form.watch(`insect_items.${index}.quantity`) + 1)}
                                >
                                  +
                                </Button>
                              </div>
                              {insectFields.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => removeInsect(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            {/* Per-item supplements */}
                            {supplements.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1 border-t">
                                {supplements.map(sup => {
                                  const ids = form.watch(`insect_items.${index}.supplement_ids`) || [];
                                  const checked = ids.includes(sup.id);
                                  return (
                                    <label
                                      key={sup.id}
                                      className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          const updated = checked ? ids.filter(id => id !== sup.id) : [...ids, sup.id];
                                          form.setValue(`insect_items.${index}.supplement_ids`, updated);
                                        }}
                                        className="rounded h-3 w-3"
                                      />
                                      {sup.name}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Salad Section */}
                    {watchIncludeSalad && (
                      <div className="space-y-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <span className="text-sm font-medium">Salad Components</span>
                        <div className="grid grid-cols-2 gap-1">
                          {saladFoods.map(f => {
                            const components = form.watch('salad_components') || [];
                            const checked = components.includes(f.id);
                            return (
                              <label
                                key={f.id}
                                className="flex items-center gap-2 p-1.5 border rounded text-sm cursor-pointer hover:bg-background"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const updated = checked ? components.filter(id => id !== f.id) : [...components, f.id];
                                    form.setValue('salad_components', updated);
                                  }}
                                />
                                {f.name}
                              </label>
                            );
                          })}
                        </div>
                        {/* Salad supplements */}
                        {supplements.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-2 border-t">
                            <span className="text-xs text-muted-foreground w-full mb-1">Salad supplements:</span>
                            {supplements.map(sup => {
                              const saladSupps = form.watch('salad_supplements') || [];
                              const checked = saladSupps.includes(sup.id);
                              return (
                                <label
                                  key={sup.id}
                                  className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const updated = checked ? saladSupps.filter(id => id !== sup.id) : [...saladSupps, sup.id];
                                      form.setValue('salad_supplements', updated);
                                    }}
                                    className="rounded h-3 w-3"
                                  />
                                  {sup.name}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Prepared/Other Foods Section */}
                    {watchIncludePrepared && (
                      <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Other Foods</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (preparedFoods.length > 0) {
                                appendPrepared({ id: Date.now(), food_id: preparedFoods[0].id.toString(), quantity: 1, supplement_ids: [] });
                              }
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {preparedFields.map((field, index) => (
                          <div key={field.id} className="space-y-2 p-2 bg-background rounded border">
                            <div className="flex gap-2 items-center">
                              <Select
                                value={form.watch(`prepared_items.${index}.food_id`)}
                                onValueChange={(v) => form.setValue(`prepared_items.${index}.food_id`, v)}
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {preparedFoods.map(f => (
                                    <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => form.setValue(`prepared_items.${index}.quantity`, Math.max(1, form.watch(`prepared_items.${index}.quantity`) - 1))}
                                >
                                  -
                                </Button>
                                <Input
                                  type="number"
                                  className="w-14 h-8 text-center"
                                  value={form.watch(`prepared_items.${index}.quantity`)}
                                  onChange={(e) => form.setValue(`prepared_items.${index}.quantity`, Math.max(1, parseInt(e.target.value) || 1))}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => form.setValue(`prepared_items.${index}.quantity`, form.watch(`prepared_items.${index}.quantity`) + 1)}
                                >
                                  +
                                </Button>
                              </div>
                              {preparedFields.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => removePrepared(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            {/* Per-item supplements */}
                            {supplements.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1 border-t">
                                {supplements.map(sup => {
                                  const ids = form.watch(`prepared_items.${index}.supplement_ids`) || [];
                                  const checked = ids.includes(sup.id);
                                  return (
                                    <label
                                      key={sup.id}
                                      className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          const updated = checked ? ids.filter(id => id !== sup.id) : [...ids, sup.id];
                                          form.setValue(`prepared_items.${index}.supplement_ids`, updated);
                                        }}
                                        className="rounded h-3 w-3"
                                      />
                                      {sup.name}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Global Supplements */}
                    {supplements.length > 0 && (
                      <div className="space-y-2">
                        <FormLabel>Global Supplements</FormLabel>
                        <p className="text-xs text-muted-foreground">Applied to all food items</p>
                        <div className="grid grid-cols-2 gap-1">
                          {supplements.map(sup => {
                            const globalSupps = form.watch('global_supplements') || [];
                            const checked = globalSupps.includes(sup.id);
                            return (
                              <label
                                key={sup.id}
                                className="flex items-center gap-2 p-1.5 border rounded text-sm cursor-pointer hover:bg-muted"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const updated = checked ? globalSupps.filter(id => id !== sup.id) : [...globalSupps, sup.id];
                                    form.setValue('global_supplements', updated);
                                  }}
                                />
                                {sup.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
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
                          <SelectItem value="shedding">Shedding</SelectItem>
                          <SelectItem value="shedding_check">Shedding Check</SelectItem>
                          <SelectItem value="brumation">Brumation</SelectItem>
                          <SelectItem value="brumation_check">Brumation Check</SelectItem>
                          <SelectItem value="bathing">Bathing</SelectItem>
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
