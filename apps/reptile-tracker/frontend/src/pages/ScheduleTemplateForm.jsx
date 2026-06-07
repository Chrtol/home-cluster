import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Save, Clock } from 'lucide-react';
import * as api from '../utils/scheduleTemplateApi';
import axios from 'axios';
import { getUserTimeFormat, getDayNames, getDayNumbers } from '../utils/dateFormatting';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker } from '@/components/ui/time-picker';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Zod schema with conditional validation
const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  species: z.string().optional(),
  age_category: z.string().optional(),
  schedule_type: z.enum(['feeding', 'misting', 'health', 'supplement']),
  schedule_rule: z.enum(['days_of_week', 'every_x_days', 'monthly']),
  food_category: z.string().optional(),
  time_slot: z.string().optional(),
  health_category: z.string().optional(),
  frequency_days: z.string().optional(),
  days_of_week: z.array(z.number()).optional(),
  day_of_month: z.string().optional(),
  supplement_id: z.string().optional(),
  notes: z.string().optional(),
  time_window_enabled: z.boolean(),
  earliest_time: z.string().optional(),
  latest_time: z.string().optional(),
  reminder_minutes_before: z.string().optional(),
}).refine((data) => {
  if (data.schedule_rule === 'every_x_days') {
    return data.frequency_days && parseInt(data.frequency_days) >= 1;
  }
  return true;
}, {
  message: 'Frequency must be at least 1 day',
  path: ['frequency_days']
}).refine((data) => {
  if (data.schedule_rule === 'days_of_week') {
    return data.days_of_week && data.days_of_week.length > 0;
  }
  return true;
}, {
  message: 'Please select at least one day',
  path: ['days_of_week']
}).refine((data) => {
  if (data.schedule_rule === 'monthly') {
    const day = parseInt(data.day_of_month);
    return data.day_of_month && day >= 1 && day <= 31;
  }
  return true;
}, {
  message: 'Day must be between 1 and 31',
  path: ['day_of_month']
});

function ScheduleTemplateForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);

  // Build weekDays array respecting first day of week preference
  const dayNumbers = getDayNumbers();
  const dayNames = getDayNames();
  const weekDays = dayNumbers.map((dayNum, index) => ({
    value: dayNum,
    label: dayNames[index]
  }));

  // Initialize form
  const form = useForm({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      description: '',
      species: '',
      age_category: '__all__',
      schedule_type: 'feeding',
      schedule_rule: 'days_of_week',
      food_category: '__none__',
      time_slot: '__none__',
      health_category: '__none__',
      frequency_days: '',
      days_of_week: [],
      day_of_month: '',
      supplement_id: '__none__',
      notes: '',
      time_window_enabled: false,
      earliest_time: '',
      latest_time: '',
      reminder_minutes_before: '',
    }
  });

  // Watch schedule type and rule for conditional rendering
  const scheduleType = form.watch('schedule_type');
  const scheduleRule = form.watch('schedule_rule');
  const timeWindowEnabled = form.watch('time_window_enabled');
  const selectedDaysOfWeek = form.watch('days_of_week');

  useEffect(() => {
    fetchSupplements();
    if (isEditing) {
      fetchTemplateData();
    }
  }, []);

  async function fetchSupplements() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/supplements`, { withCredentials: true });
      setSupplements(response.data);
    } catch (error) {
      console.error('Error fetching supplements:', error);
    }
  }

  async function fetchTemplateData() {
    try {
      setInitialLoading(true);
      const template = await api.getScheduleTemplate(id);

      form.reset({
        name: template.name || '',
        description: template.description || '',
        species: template.species || '',
        age_category: template.age_category || '__all__',
        schedule_type: template.schedule_type || 'feeding',
        schedule_rule: template.schedule_rule || 'days_of_week',
        food_category: template.food_category || '__none__',
        time_slot: template.time_slot || '__none__',
        health_category: template.health_category || '__none__',
        frequency_days: template.frequency_days ? String(template.frequency_days) : '',
        days_of_week: template.days_of_week ? template.days_of_week.split(',').map(d => parseInt(d)) : [],
        day_of_month: template.day_of_month ? String(template.day_of_month) : '',
        supplement_id: template.supplement_id ? String(template.supplement_id) : '__none__',
        notes: template.notes || '',
        time_window_enabled: template.time_window_enabled || false,
        earliest_time: template.earliest_time || '',
        latest_time: template.latest_time || '',
        reminder_minutes_before: template.reminder_minutes_before ? String(template.reminder_minutes_before) : '',
      });
    } catch (error) {
      console.error('Error fetching template:', error);
      toast.error('Failed to load template');
    } finally {
      setInitialLoading(false);
    }
  }

  function toggleDayOfWeek(day) {
    const current = form.getValues('days_of_week');
    const newDays = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day];
    form.setValue('days_of_week', newDays, { shouldValidate: true });
  }

  // Helper to convert sentinel values to null
  function toNullIfSentinel(value) {
    return (value === '__none__' || value === '__all__' || !value) ? null : value;
  }

  async function handleSubmit(values) {
    const templateData = {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      species: values.species?.trim() || null,
      age_category: toNullIfSentinel(values.age_category),
      schedule_type: values.schedule_type,
      schedule_rule: values.schedule_rule,
      food_category: toNullIfSentinel(values.food_category),
      time_slot: toNullIfSentinel(values.time_slot),
      health_category: toNullIfSentinel(values.health_category),
      frequency_days: values.schedule_rule === 'every_x_days' && values.frequency_days ? parseInt(values.frequency_days) : null,
      days_of_week: values.schedule_rule === 'days_of_week' && values.days_of_week ? values.days_of_week.sort((a, b) => a - b).join(',') : null,
      day_of_month: values.schedule_rule === 'monthly' && values.day_of_month ? parseInt(values.day_of_month) : null,
      supplement_id: toNullIfSentinel(values.supplement_id),
      notes: values.notes?.trim() || null,
      time_window_enabled: values.time_window_enabled,
      earliest_time: values.time_window_enabled && values.earliest_time ? values.earliest_time : null,
      latest_time: values.time_window_enabled && values.latest_time ? values.latest_time : null,
      reminder_minutes_before: values.reminder_minutes_before ? parseInt(values.reminder_minutes_before) : null,
    };

    try {
      setLoading(true);
      if (isEditing) {
        await api.updateScheduleTemplate(id, templateData);
        toast.success('Template updated successfully!');
      } else {
        await api.createScheduleTemplate(templateData);
        toast.success('Template created successfully!');
      }
      navigate('/schedule-templates');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error.response?.data?.detail || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/schedule-templates')}
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {isEditing ? 'Edit Template' : 'Create Schedule Template'}
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 border-b border-border pb-2">
              Basic Information
            </h2>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Juvenile Bearded Dragon Daily Feeding" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe this schedule template..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="species"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Species (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Bearded Dragon" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Leave empty for general templates</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="age_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age Category (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="All Ages" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__all__">All Ages</SelectItem>
                        <SelectItem value="hatchling">Hatchling</SelectItem>
                        <SelectItem value="juvenile">Juvenile</SelectItem>
                        <SelectItem value="adult">Adult</SelectItem>
                        <SelectItem value="senior">Senior</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          {/* Schedule Configuration */}
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 border-b border-border pb-2">
              Schedule Configuration
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="schedule_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="feeding">Feeding</SelectItem>
                        <SelectItem value="misting">Misting</SelectItem>
                        <SelectItem value="health">Health</SelectItem>
                        <SelectItem value="supplement">Supplement</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="schedule_rule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule Rule *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="days_of_week">Specific Days of Week</SelectItem>
                        <SelectItem value="every_x_days">Every X Days</SelectItem>
                        <SelectItem value="monthly">Monthly (Specific Day)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Schedule Rule Parameters */}
            {scheduleRule === 'every_x_days' && (
              <FormField
                control={form.control}
                name="frequency_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency (days) *</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="e.g., 3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {scheduleRule === 'days_of_week' && (
              <FormField
                control={form.control}
                name="days_of_week"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Days of Week *</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {weekDays.map(day => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDayOfWeek(day.value)}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            selectedDaysOfWeek?.includes(day.value)
                              ? 'bg-blue-600 text-white'
                              : 'bg-secondary text-muted-foreground hover:bg-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {scheduleRule === 'monthly' && (
              <FormField
                control={form.control}
                name="day_of_month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of Month (1-31) *</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="31" placeholder="e.g., 15" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Type-specific fields */}
            {scheduleType === 'feeding' && (
              <FormField
                control={form.control}
                name="food_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Food Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Not specified" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Not specified</SelectItem>
                        <SelectItem value="insects">Insects</SelectItem>
                        <SelectItem value="salad">Salad</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {scheduleType === 'misting' && (
              <FormField
                control={form.control}
                name="time_slot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Slot</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Not specified" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Not specified</SelectItem>
                        <SelectItem value="morning">Morning</SelectItem>
                        <SelectItem value="midday">Midday</SelectItem>
                        <SelectItem value="afternoon">Afternoon</SelectItem>
                        <SelectItem value="evening">Evening</SelectItem>
                        <SelectItem value="night">Night</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {scheduleType === 'health' && (
              <FormField
                control={form.control}
                name="health_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Health Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Not specified" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Not specified</SelectItem>
                        <SelectItem value="weight_check">Weight Check</SelectItem>
                        <SelectItem value="bathing">Bathing</SelectItem>
                        <SelectItem value="shedding_check">Shedding Check</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {scheduleType === 'supplement' && (
              <FormField
                control={form.control}
                name="supplement_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplement</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplement..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Select supplement...</SelectItem>
                        {supplements.map(supplement => (
                          <SelectItem key={supplement.id} value={String(supplement.id)}>
                            {supplement.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </Card>

          {/* Time Window */}
          <Card className="p-6 space-y-4">
            <FormField
              control={form.control}
              name="time_window_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="w-4 h-4 text-blue-600 rounded"
                      id="timeWindow"
                    />
                  </FormControl>
                  <label htmlFor="timeWindow" className="text-sm font-medium text-muted-foreground flex items-center gap-2 cursor-pointer">
                    <Clock size={16} />
                    Enable Time Window
                  </label>
                </FormItem>
              )}
            />

            {timeWindowEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <FormField
                  control={form.control}
                  name="earliest_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Earliest Time</FormLabel>
                      <FormControl>
                        <TimePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Pick earliest time"
                          step={30}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="latest_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latest Time</FormLabel>
                      <FormControl>
                        <TimePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Pick latest time"
                          step={30}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reminder_minutes_before"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Reminder (minutes before latest time)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="e.g., 30"
                          className="w-full md:w-48"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card className="p-6">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Card>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
            >
              <Save size={20} className="mr-2" />
              {loading ? 'Saving...' : (isEditing ? 'Update Template' : 'Create Template')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/schedule-templates')}
              className="px-6"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default ScheduleTemplateForm;
