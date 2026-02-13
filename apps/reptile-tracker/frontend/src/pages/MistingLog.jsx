import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { Edit2, Trash2 } from 'lucide-react';
import { formatDateTime } from '../utils/dateFormatting';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import PageHeader from '../components/PageHeader';
import { notifyStreakAttribution } from '@/components/UserStreakDisplay';

// Validation schema
const mistingSchema = z.object({
  reptile_id: z.number().min(1, "Please select a reptile"),
  misted_at_date: z.string().min(1, "Date is required"),
  misted_at_time: z.string().regex(/^\d{2}:\d{2}$/, "Time is required (HH:MM format)"),
  notes: z.string().optional(),
});

export default function MistingLog() {
  const navigate = useNavigate();
  const { reptileId, id } = useParams();
  const [searchParams] = useSearchParams();

  // Mode state
  const [mode, setMode] = useState('create'); // create, view, edit
  const [existingLog, setExistingLog] = useState(null);

  const [reptiles, setReptiles] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewModeSuccess, setViewModeSuccess] = useState('');

  // Initialize form
  const form = useForm({
    resolver: zodResolver(mistingSchema),
    defaultValues: {
      reptile_id: 0,
      misted_at_date: new Date().toISOString().slice(0, 10),
      misted_at_time: new Date().toTimeString().slice(0, 5),
      notes: '',
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const reptilesRes = await axios.get('/api/reptiles');
        setReptiles(reptilesRes.data);

        // Check if we're viewing/editing an existing misting log
        if (id && !isNaN(id)) {
          try {
            const logRes = await axios.get(`/api/misting/${id}`);
            setExistingLog(logRes.data);
            setMode('view');
            loadLogData(logRes.data);

            // Check for success query parameter
            const successParam = searchParams.get('success');
            if (successParam === 'created') {
              setViewModeSuccess('Misting logged successfully!');
              // Clear the query parameter from URL without reloading
              const newUrl = window.location.pathname;
              window.history.replaceState({}, '', newUrl);
              // Auto-dismiss after 5 seconds
              setTimeout(() => setViewModeSuccess(''), 5000);
            }
          } catch (err) {
            console.error('Failed to load misting log:', err);
            setError('Failed to load misting log. It may not exist or you may not have permission.');
          }
        } else {
          // Check for instance_id or schedule_id in query params to pre-fill
          const instanceId = searchParams.get('instance_id');
          const scheduleId = searchParams.get('schedule_id');

          if (instanceId) {
            try {
              const instanceRes = await axios.get(`/api/schedule-instances/${instanceId}`);
              const instance = instanceRes.data;
              const schedule = instance.schedule;

              // Pre-fill reptile from schedule
              if (schedule?.reptile_id) {
                form.setValue('reptile_id', schedule.reptile_id);
              }

              // Pre-fill date from instance
              if (instance.scheduled_date) {
                form.setValue('misted_at_date', instance.scheduled_date);
              }

              // Pre-fill time from schedule
              if (schedule?.reminder_time || (schedule?.time_window_enabled && schedule?.earliest_time)) {
                const timeStr = schedule.reminder_time || schedule.earliest_time;
                form.setValue('misted_at_time', timeStr);
              }
            } catch (instanceErr) {
              console.error('Failed to load instance for pre-fill:', instanceErr);
            }
          } else if (scheduleId) {
            try {
              const scheduleRes = await axios.get(`/api/schedules/${scheduleId}`);
              const schedule = scheduleRes.data;

              // Pre-fill reptile from schedule
              if (schedule.reptile_id) {
                form.setValue('reptile_id', schedule.reptile_id);
              }

              // Pre-fill time from schedule
              if (schedule.reminder_time || (schedule.time_window_enabled && schedule.earliest_time)) {
                const timeStr = schedule.reminder_time || schedule.earliest_time;
                form.setValue('misted_at_time', timeStr);
              }
            } catch (scheduleErr) {
              console.error('Failed to load schedule for pre-fill:', scheduleErr);
            }
          }

          // Fallback to defaults if not pre-filled
          if (!form.getValues('reptile_id')) {
            if (reptileId) {
              form.setValue('reptile_id', parseInt(reptileId));
            } else if (reptilesRes.data.length > 0) {
              form.setValue('reptile_id', reptilesRes.data[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch reptiles:", err);
      }
    };
    fetchData();
  }, [reptileId, id, searchParams]);

  const loadLogData = (log) => {
    form.setValue('reptile_id', log.reptile_id);
    form.setValue('notes', log.notes || '');

    // Parse the misted_at datetime
    const mistedAtDate = new Date(log.misted_at);
    form.setValue('misted_at_date', mistedAtDate.toISOString().slice(0, 10));

    const hour = mistedAtDate.getHours();
    const minute = mistedAtDate.getMinutes();
    form.setValue('misted_at_time', `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };

  // Reset form when navigating from /misting/:id to /misting
  useEffect(() => {
    if (!id && mode !== 'create') {
      // Reset to create mode
      setMode('create');
      setExistingLog(null);
      setError('');
      setSuccess('');

      // Reset form to defaults
      form.reset({
        reptile_id: reptileId ? parseInt(reptileId) : (reptiles.length > 0 ? reptiles[0].id : 0),
        misted_at_date: new Date().toISOString().slice(0, 10),
        misted_at_time: new Date().toTimeString().slice(0, 5),
        notes: '',
      });
    }
  }, [id, mode, reptiles, reptileId, form]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this misting log?')) return;

    try {
      await axios.delete(`/api/misting/${id}`);
      setSuccess('Misting log deleted successfully!');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      console.error('Failed to delete misting log:', err);
      setError(err.response?.data?.detail || 'Failed to delete misting log. You may not have permission.');
    }
  };

  const onSubmit = async (data) => {
    setError('');
    setSuccess('');

    // Combine date + time into ISO format
    const dateTimeString = `${data.misted_at_date}T${data.misted_at_time}`;

    try {
      if (mode === 'edit') {
        const response = await axios.patch(`/api/misting/${id}`, {
          misted_at: new Date(dateTimeString).toISOString(),
          notes: data.notes || null,
        });
        setSuccess('Misting log updated successfully!');
        // Redirect to read-only view
        setTimeout(() => navigate(`/misting/${id}`), 1500);
      } else {
        const response = await axios.post('/api/misting', {
          reptile_id: data.reptile_id,
          misted_at: new Date(dateTimeString).toISOString(),
          notes: data.notes || null,
        });

        // Dispatch attribution event if completing for another user
        if (response.data.attribution) {
          notifyStreakAttribution(response.data.attribution);
        }

        setSuccess(`Misting logged for ${reptiles.find(r => r.id === data.reptile_id)?.name}.`);
        // Redirect to read-only view
        setTimeout(() => navigate(`/misting/${response.data.id}?success=created`), 1500);
      }
    } catch (err) {
      console.error("Failed to submit misting log:", err);
      const errorMsg = err.response?.data?.detail || "An unexpected error occurred.";
      setError(errorMsg);
      form.setError('root', { message: errorMsg });
    }
  };

  // VIEW MODE
  if (mode === 'view' && existingLog) {
    return (
      <div>
        <PageHeader
          title="View Misting Log"
          backLink={{ to: '/misting-log', label: 'Back to Misting Log' }}
          actions={
            <div className="flex gap-2">
              <Button onClick={() => setMode('edit')} className="flex items-center gap-2">
                <Edit2 size={18} /> Edit
              </Button>
              <Button onClick={handleDelete} variant="secondary" className="text-red-600 dark:text-red-400 flex items-center gap-2">
                <Trash2 size={18} /> Delete
              </Button>
            </div>
          }
        />

        {error && <p className="text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg mb-4 border border-red-200 dark:border-red-800">{error}</p>}
        {success && <p className="text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900/30 p-3 rounded-lg mb-4 border border-green-200 dark:border-green-800">{success}</p>}
        {viewModeSuccess && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-green-800 dark:text-green-200">{viewModeSuccess}</p>
          </div>
        )}

        <div className="card space-y-6">
          <div className="pb-4 border-b border-border">
            <p className="text-sm text-muted-foreground mb-1">Logged at</p>
            <p className="text-lg font-medium text-foreground">
              {formatDateTime(existingLog.created_at || existingLog.misted_at)}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Reptile</p>
            <p className="text-lg font-medium text-foreground">
              {reptiles.find(r => r.id === existingLog.reptile_id)?.name || existingLog.reptile?.name || 'Unknown'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Misted at</p>
            <p className="text-lg font-medium text-foreground">
              {formatDateTime(existingLog.misted_at)}
            </p>
          </div>

          {existingLog.notes && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Notes</p>
              <p className="text-foreground">{existingLog.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // CREATE/EDIT MODE
  return (
    <div>
      <PageHeader
        title={mode === 'edit' ? 'Edit Misting Log' : 'Log Misting'}
      />
      {error && <p className="text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg mb-4 border border-red-200 dark:border-red-800">{error}</p>}
      {success && <p className="text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900/30 p-3 rounded-lg mb-4 border border-green-200 dark:border-green-800">{success}</p>}

      {mode === 'edit' && existingLog && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-blue-900 dark:text-blue-100 text-sm">
            Originally logged at {formatDateTime(existingLog.created_at || existingLog.misted_at)}
          </p>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="card space-y-4">
          <FormField
            control={form.control}
            name="reptile_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-muted-foreground">Reptile</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  value={field.value ? String(field.value) : ''}
                  disabled={mode === 'edit'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reptile" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {reptiles.map(r => (
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

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="misted_at_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Date</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Pick a date"
                    />
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
                  <FormLabel className="text-muted-foreground">Time</FormLabel>
                  <FormControl>
                    <TimePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Pick a time"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-muted-foreground">Notes (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={3}
                    placeholder="e.g., increased humidity for shedding"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-3">
            <Button type="submit" className="flex-1">
              {mode === 'edit' ? 'Update Misting Log' : 'Save Misting Log'}
            </Button>
            {mode === 'edit' && (
              <Button
                type="button"
                onClick={() => setMode('view')}
                variant="secondary"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
