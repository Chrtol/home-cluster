import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import PageHeader from '../components/PageHeader';
import { notifyStreakAttribution } from '@/components/UserStreakDisplay';
import { useConfetti } from '../hooks/useConfetti';
import ConfettiDismissOverlay from '../components/ConfettiDismissOverlay';
import { useCelebrations } from '@/contexts/CelebrationContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Validation schema with conditional logic
const healthLogSchema = z.object({
  reptile_id: z.number().min(1, "Please select a reptile"),
  log_type: z.enum(['weight', 'health', 'shedding', 'brumation', 'bathing', 'measurement']),
  log_date: z.string().min(1, "Date is required"),
  log_time: z.string().regex(/^\d{2}:\d{2}$/, "Time is required (HH:MM format)"),
  // Weight-specific fields
  weight_grams: z.string().optional(),
  // Health-specific fields
  record_type: z.string().optional(),
  title: z.string().optional(),
  consistency: z.string().optional(),
  notes: z.string().optional(),
  // Shedding/Brumation-specific fields
  event_subtype: z.string().optional(),
  // Measurement-specific fields
  measurement_type: z.string().optional(),
  measurement_value: z.string().optional(),
  measurement_unit: z.string().optional(),
  custom_label: z.string().optional(),
}).refine((data) => {
  // If log_type is weight, weight_grams is required
  if (data.log_type === 'weight') {
    return data.weight_grams && parseFloat(data.weight_grams) > 0;
  }
  return true;
}, {
  message: "Weight is required",
  path: ['weight_grams'],
}).refine((data) => {
  // If log_type is health, record_type and title are required
  if (data.log_type === 'health') {
    return data.record_type && data.title && data.title.length > 0;
  }
  return true;
}, {
  message: "Record type and title are required for health records",
  path: ['title'],
}).refine((data) => {
  // If log_type is shedding or brumation, event_subtype is required
  // Valid shedding subtypes: start, complete, check_no
  // Valid brumation subtypes: start, end
  if (data.log_type === 'shedding' || data.log_type === 'brumation') {
    return data.event_subtype && data.event_subtype.length > 0;
  }
  return true;
}, {
  message: "Please select an option",
  path: ['event_subtype'],
}).refine((data) => {
  // If log_type is measurement, measurement fields are required
  if (data.log_type === 'measurement') {
    return data.measurement_type && data.measurement_value && data.measurement_unit;
  }
  return true;
}, {
  message: "Measurement type, value, and unit are required",
  path: ['measurement_type'],
}).refine((data) => {
  // If measurement_type is custom, custom_label is required
  if (data.log_type === 'measurement' && data.measurement_type === 'custom') {
    return data.custom_label && data.custom_label.length > 0;
  }
  return true;
}, {
  message: "Custom label is required for custom measurements",
  path: ['custom_label'],
});

export default function HealthLog() {
  const navigate = useNavigate();
  const { reptileId, id, type } = useParams(); // Get reptileId, id, and type from URL
  const [searchParams] = useSearchParams();
  const { triggerSubtle, isActive, dismiss } = useConfetti();
  const { triggerCelebration, celebrationsEnabled } = useCelebrations();

  // Mode state
  const [mode, setMode] = useState('create'); // create, view, edit
  const [existingLog, setExistingLog] = useState(null);

  const [reptiles, setReptiles] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewModeSuccess, setViewModeSuccess] = useState('');
  const [healthStatus, setHealthStatus] = useState(null);
  const [healthStatusLoading, setHealthStatusLoading] = useState(false);

  // Success action state
  const [showSuccessActions, setShowSuccessActions] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState(null);
  const [lastLogType, setLastLogType] = useState(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Initialize form
  const form = useForm({
    resolver: zodResolver(healthLogSchema),
    defaultValues: {
      reptile_id: 0,
      log_type: 'weight',
      log_date: new Date().toISOString().slice(0, 10),
      log_time: new Date().toTimeString().slice(0, 5),
      weight_grams: '',
      record_type: 'observation',
      title: '',
      consistency: 'normal',
      notes: '',
      event_subtype: '',
      measurement_type: '',
      measurement_value: '',
      measurement_unit: '',
      custom_label: '',
    },
    mode: 'onBlur',
  });

  // Watch log_type for conditional rendering
  const logType = form.watch('log_type');
  const recordType = form.watch('record_type');
  const eventSubtype = form.watch('event_subtype');
  const watchedReptileId = form.watch('reptile_id');
  const measurementType = form.watch('measurement_type');

  // Fetch health status for selected reptile
  const fetchHealthStatus = async (selectedId) => {
    if (!selectedId || selectedId === 0) {
      setHealthStatus(null);
      return;
    }
    try {
      setHealthStatusLoading(true);
      const response = await axios.get(`/api/health/status/${selectedId}`);
      setHealthStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch health status:', error);
      setHealthStatus(null);
    } finally {
      setHealthStatusLoading(false);
    }
  };

  // Helper to format current status display
  const formatCurrentStatus = () => {
    if (!healthStatus) return null;
    const parts = [];
    if (healthStatus.is_shedding) {
      if (healthStatus.days_shedding) {
        parts.push(`Shedding for ${healthStatus.days_shedding} days`);
      } else {
        parts.push('Shedding');
      }
    }
    if (healthStatus.is_brumating) {
      if (healthStatus.days_brumating) {
        parts.push(`Brumating for ${healthStatus.days_brumating} days`);
      } else {
        parts.push('Brumating');
      }
    }
    return parts.length > 0 ? parts.join(', ') : null;
  };

  // Determine valid state transitions
  const canStartShedding = mode === 'create' && !healthStatus?.is_shedding;
  const canCompleteShedding = mode === 'create' && healthStatus?.is_shedding;
  const canStartBrumation = mode === 'create' && !healthStatus?.is_brumating;
  const canEndBrumation = mode === 'create' && healthStatus?.is_brumating;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const reptilesRes = await axios.get('/api/reptiles');
        setReptiles(reptilesRes.data);

        // Check if we're viewing/editing an existing log
        if (id && !isNaN(id) && type) {
          try {
            let logRes;
            if (type === 'weight') {
              logRes = await axios.get(`/api/weight/${id}`);
              form.setValue('log_type', 'weight');
            } else if (type === 'measurement') {
              logRes = await axios.get(`/api/measurements/${id}`);
              form.setValue('log_type', 'measurement');
            } else if (type === 'health') {
              logRes = await axios.get(`/api/health/${id}`);
              form.setValue('log_type', 'health');
            }
            setExistingLog(logRes.data);
            setMode('view');
            loadLogData(logRes.data, type);

            // Check for success query parameter
            const successParam = searchParams.get('success');
            if (successParam === 'created') {
              setViewModeSuccess(`${type === 'weight' ? 'Weight' : 'Health record'} logged successfully!`);
              // Clear the query parameter from URL without reloading
              const newUrl = window.location.pathname;
              window.history.replaceState({}, '', newUrl);
              // Auto-dismiss after 5 seconds
              setTimeout(() => setViewModeSuccess(''), 5000);
            }
          } catch (err) {
            console.error('Failed to load log:', err);
            setError('Failed to load log. It may not exist or you may not have permission.');
          }
        } else {
          // Check for instance_id or schedule_id in query params to pre-fill
          const instanceId = searchParams.get('instance_id');
          const scheduleId = searchParams.get('schedule_id');
          const logTypeParam = searchParams.get('log_type');
          const measurementTypeParam = searchParams.get('measurement_type');
          const recordTypeParam = searchParams.get('record_type');

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
                form.setValue('log_date', instance.scheduled_date);
              }

              // Keep current time as default (user feedback: don't pre-fill from schedule window)
              // The form already defaults to current time in its initial values

              // Pre-fill log type if specified in URL or from schedule
              if (logTypeParam) {
                form.setValue('log_type', logTypeParam);
              } else if (schedule?.health_category) {
                // Map health category to record type if applicable
                form.setValue('record_type', schedule.health_category);
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

              // Keep current time as default (user feedback: don't pre-fill from schedule window)
              // The form already defaults to current time in its initial values

              // Pre-fill log type if specified in URL or from schedule
              if (logTypeParam) {
                form.setValue('log_type', logTypeParam);
              } else if (schedule.health_category) {
                // Map health category to record type if applicable
                form.setValue('record_type', schedule.health_category);
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

          // Pre-fill from URL params (these override schedule-based pre-fills)
          if (logTypeParam && ['weight', 'health', 'shedding', 'brumation', 'measurement'].includes(logTypeParam)) {
            form.setValue('log_type', logTypeParam);
          }

          if (measurementTypeParam) {
            // Normalize to lowercase to match Select options
            form.setValue('measurement_type', measurementTypeParam.toLowerCase());
          }

          if (recordTypeParam) {
            form.setValue('record_type', recordTypeParam);
          }
        }
      } catch (err) {
        console.error("Failed to fetch reptiles:", err);
      }
    };
    fetchData();
  }, [reptileId, id, type, searchParams]);

  // Fetch health status when reptile is selected (create mode only)
  useEffect(() => {
    if (mode === 'create' && watchedReptileId && watchedReptileId > 0) {
      // Reset event_subtype when reptile changes to prevent old selection from persisting
      form.setValue('event_subtype', '');
      fetchHealthStatus(watchedReptileId);
    } else {
      setHealthStatus(null);
    }
  }, [watchedReptileId, mode]);

  // Auto-select valid option when log type changes and only one option is valid
  useEffect(() => {
    if (mode !== 'create' || !healthStatus) return;

    if (logType === 'shedding') {
      // If only one option is valid, auto-select it
      if (canCompleteShedding && !canStartShedding) {
        form.setValue('event_subtype', 'complete');
      } else if (canStartShedding && !canCompleteShedding) {
        form.setValue('event_subtype', 'start');
      }
      // If both options available, don't auto-select (let user choose)
    }

    if (logType === 'brumation') {
      if (canEndBrumation && !canStartBrumation) {
        form.setValue('event_subtype', 'end');
      } else if (canStartBrumation && !canEndBrumation) {
        form.setValue('event_subtype', 'start');
      }
    }
  }, [logType, healthStatus, mode, canStartShedding, canCompleteShedding, canStartBrumation, canEndBrumation, form]);

  // Default unit mapping for measurement types
  const measurementTypeDefaults = {
    svl: 'cm',
    total_length: 'cm',
    shell_length: 'cm',
    humidity: '%',
    temperature: 'C',
  };

  // Auto-set default unit when measurement type changes
  useEffect(() => {
    if (logType === 'measurement' && measurementType && !form.getValues('measurement_unit')) {
      const defaultUnit = measurementTypeDefaults[measurementType];
      if (defaultUnit) {
        form.setValue('measurement_unit', defaultUnit);
      }
    }
  }, [logType, measurementType, form]);

  // Helper function to generate auto-title for shedding/brumation
  const getAutoTitle = (logType, subtype) => {
    if (logType === 'shedding') {
      if (subtype === 'start') return 'Started shedding';
      if (subtype === 'complete') return 'Shed complete';
      if (subtype === 'check_no') return 'Shedding Check: No';
    }
    if (logType === 'brumation') {
      return subtype === 'start' ? 'Started brumation' : 'Ended brumation';
    }
    return '';
  };

  // Helper function to format event type for display
  const formatEventType = (recordType, eventType) => {
    if (recordType === 'shedding') {
      if (eventType === 'start') return 'Started Shedding';
      if (eventType === 'complete') return 'Shed Complete';
    }
    if (recordType === 'shedding_check') {
      return 'Shedding Check: No';
    }
    if (recordType === 'brumation') {
      return eventType === 'start' ? 'Started Brumating' : 'Ended Brumation';
    }
    return '';
  };

  const loadLogData = (log, logType) => {
    form.setValue('reptile_id', log.reptile_id);
    form.setValue('notes', log.notes || log.description || '');

    if (logType === 'weight') {
      form.setValue('weight_grams', String(log.weight_grams));
      const measuredAtDate = new Date(log.measured_at);
      form.setValue('log_date', measuredAtDate.toISOString().slice(0, 10));
      const hour = measuredAtDate.getHours();
      const minute = measuredAtDate.getMinutes();
      form.setValue('log_time', `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    } else if (logType === 'measurement') {
      form.setValue('measurement_type', log.measurement_type);
      form.setValue('measurement_value', String(log.value));
      form.setValue('measurement_unit', log.unit);
      if (log.custom_label) {
        form.setValue('custom_label', log.custom_label);
      }
      const measuredAtDate = new Date(log.measured_at);
      form.setValue('log_date', measuredAtDate.toISOString().slice(0, 10));
      const hour = measuredAtDate.getHours();
      const minute = measuredAtDate.getMinutes();
      form.setValue('log_time', `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    } else if (logType === 'health') {
      // Check if this is a shedding, brumation, or bathing record
      if ((log.record_type === 'shedding' || log.record_type === 'brumation') && log.event_type) {
        form.setValue('log_type', log.record_type);
        form.setValue('event_subtype', log.event_type);
      } else if (log.record_type === 'bathing') {
        form.setValue('log_type', 'bathing');
      } else {
        form.setValue('record_type', log.record_type);
        form.setValue('title', log.title);
        if (log.consistency) {
          form.setValue('consistency', log.consistency);
        }
      }
      const logDateObj = new Date(log.date);
      form.setValue('log_date', logDateObj.toISOString().slice(0, 10));
      const hour = logDateObj.getHours();
      const minute = logDateObj.getMinutes();
      form.setValue('log_time', `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  };

  // Reset form when navigating from /health-log/:type/:id to /health-log
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
        log_type: 'weight',
        log_date: new Date().toISOString().slice(0, 10),
        log_time: new Date().toTimeString().slice(0, 5),
        weight_grams: '',
        record_type: 'observation',
        title: '',
        consistency: 'normal',
        notes: '',
      });
    }
  }, [id, mode, reptiles, reptileId, form]);

  const handleLogAnother = () => {
    setShowSuccessActions(false);
    setSuccess('');
    setLastCreatedId(null);
    setLastLogType(null);

    // Reset form but keep reptile selection
    const currentReptile = form.getValues('reptile_id');
    form.reset({
      reptile_id: currentReptile,
      log_type: 'weight',
      log_date: new Date().toISOString().slice(0, 10),
      log_time: new Date().toTimeString().slice(0, 5),
      weight_grams: '',
      record_type: 'observation',
      title: '',
      consistency: 'normal',
      notes: '',
      event_subtype: '',
      measurement_type: '',
      measurement_value: '',
      measurement_unit: '',
      custom_label: '',
    });

    // Refresh health status for continued logging
    if (currentReptile && currentReptile > 0) {
      fetchHealthStatus(currentReptile);
    }
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const executeDelete = async () => {
    const currentLogType = form.getValues('log_type');
    setDeleteDialogOpen(false);

    try {
      if (currentLogType === 'weight') {
        await axios.delete(`/api/weight/${id}`);
      } else if (currentLogType === 'measurement') {
        await axios.delete(`/api/measurements/${id}`);
      } else {
        await axios.delete(`/api/health/${id}`);
      }
      setSuccess('Log deleted successfully!');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      console.error('Failed to delete log:', err);
      setError(err.response?.data?.detail || 'Failed to delete log. You may not have permission.');
    }
  };

  const getDeleteDialogTitle = () => {
    const currentLogType = form.getValues('log_type');
    if (currentLogType === 'weight') return 'Delete Weight Log';
    if (currentLogType === 'measurement') return 'Delete Measurement Log';
    return 'Delete Health Log';
  };

  const onSubmit = async (data) => {
    setError('');
    setSuccess('');

    const dateTimeString = `${data.log_date}T${data.log_time}`;

    try {
      if (mode === 'edit') {
        // Edit existing log
        if (data.log_type === 'weight') {
          await axios.patch(`/api/weight/${id}`, {
            weight_grams: parseFloat(data.weight_grams),
            measured_at: new Date(dateTimeString).toISOString(),
            notes: data.notes || null,
          });
          setSuccess('Weight log updated successfully!');
        } else if (data.log_type === 'measurement') {
          await axios.patch(`/api/measurements/${id}`, {
            measurement_type: data.measurement_type,
            value: parseFloat(data.measurement_value),
            unit: data.measurement_unit,
            custom_label: data.measurement_type === 'custom' ? data.custom_label : null,
            measured_at: new Date(dateTimeString).toISOString(),
            notes: data.notes || null,
          });
          setSuccess('Measurement updated successfully!');
        } else if (data.log_type === 'shedding' || data.log_type === 'brumation') {
          // Shedding or brumation event (event_type cannot be changed in edit mode)
          const payload = {
            record_type: data.log_type,
            event_type: data.event_subtype,
            title: getAutoTitle(data.log_type, data.event_subtype),
            description: data.notes || null,
            date: new Date(dateTimeString).toISOString(),
          };
          await axios.patch(`/api/health/${id}`, payload);
          setSuccess(`${data.log_type === 'shedding' ? 'Shedding' : 'Brumation'} event updated successfully!`);
        } else if (data.log_type === 'bathing') {
          // Bathing event
          const payload = {
            record_type: 'bathing',
            title: 'Bathing',
            description: data.notes || null,
            date: new Date(dateTimeString).toISOString(),
          };
          await axios.patch(`/api/health/${id}`, payload);
          setSuccess('Bathing record updated successfully!');
        } else {
          const payload = {
            record_type: data.record_type,
            title: data.title,
            description: data.notes || null,
            date: new Date(dateTimeString).toISOString(),
          };
          if (data.record_type === 'bowel_movement') {
            payload.consistency = data.consistency;
          }
          await axios.patch(`/api/health/${id}`, payload);
          setSuccess('Health record updated successfully!');
        }
        setMode('view');
        // Reload the log data
        if (data.log_type === 'weight') {
          const logRes = await axios.get(`/api/weight/${id}`);
          setExistingLog(logRes.data);
          loadLogData(logRes.data, 'weight');
        } else if (data.log_type === 'measurement') {
          const logRes = await axios.get(`/api/measurements/${id}`);
          setExistingLog(logRes.data);
          loadLogData(logRes.data, 'measurement');
        } else {
          const logRes = await axios.get(`/api/health/${id}`);
          setExistingLog(logRes.data);
          loadLogData(logRes.data, data.log_type);
        }
      } else {
        // Create new log
        if (data.log_type === 'weight') {
          const response = await axios.post('/api/weight', {
            reptile_id: data.reptile_id,
            weight_grams: parseFloat(data.weight_grams),
            measured_at: new Date(dateTimeString).toISOString(),
            notes: data.notes || null,
          });

          // Dispatch attribution event if completing for another user
          if (response.data.attribution) {
            notifyStreakAttribution(response.data.attribution);
          }

          // Trigger celebration after API success (per D-12, D-13)
          if (celebrationsEnabled) {
            try {
              const streakRes = await axios.get('/api/user-streaks/me');
              const totalTasks = streakRes.data.total_tasks_completed || 0;
              triggerCelebration(totalTasks - 1, totalTasks);
            } catch (err) {
              console.debug('Could not fetch streak for celebration:', err);
            }
          }

          triggerSubtle();
          setSuccess(`Weight logged for ${reptiles.find(r => r.id === data.reptile_id)?.name}.`);
          setLastCreatedId(response.data.id);
          setLastLogType('weight');
          setShowSuccessActions(true);
        } else if (data.log_type === 'shedding' || data.log_type === 'brumation') {
          // Handle shedding check "No" case - creates audit record without starting shed cycle
          if (data.log_type === 'shedding' && data.event_subtype === 'check_no') {
            const payload = {
              reptile_id: data.reptile_id,
              record_type: 'shedding_check',
              title: 'Shedding Check: No',
              description: data.notes || null,
              date: new Date(dateTimeString).toISOString(),
            };
            const response = await axios.post('/api/health', payload);

            if (response.data.attribution) {
              notifyStreakAttribution(response.data.attribution);
            }

            // Trigger celebration after API success (per D-12, D-13)
            if (celebrationsEnabled) {
              try {
                const streakRes = await axios.get('/api/user-streaks/me');
                const totalTasks = streakRes.data.total_tasks_completed || 0;
                triggerCelebration(totalTasks - 1, totalTasks);
              } catch (err) {
                console.debug('Could not fetch streak for celebration:', err);
              }
            }

            triggerSubtle();
            setSuccess(`Shedding check logged for ${reptiles.find(r => r.id === data.reptile_id)?.name}. No signs of shedding.`);
            setLastCreatedId(response.data.id);
            setLastLogType('health');
            setShowSuccessActions(true);
          } else if (data.log_type === 'shedding' && data.event_subtype === 'start') {
            // Shedding start - create both shedding_check: Yes AND shedding start event
            // First, create the shedding check audit record
            await axios.post('/api/health', {
              reptile_id: data.reptile_id,
              record_type: 'shedding_check',
              title: 'Shedding Check: Yes',
              description: data.notes || null,
              date: new Date(dateTimeString).toISOString(),
            });

            // Then create the shedding start event
            const response = await axios.post('/api/health', {
              reptile_id: data.reptile_id,
              record_type: 'shedding',
              event_type: 'start',
              title: 'Started shedding',
              description: 'Triggered from shedding check',
              date: new Date(dateTimeString).toISOString(),
            });

            if (response.data.attribution) {
              notifyStreakAttribution(response.data.attribution);
            }

            // Trigger celebration after API success (per D-12, D-13)
            if (celebrationsEnabled) {
              try {
                const streakRes = await axios.get('/api/user-streaks/me');
                const totalTasks = streakRes.data.total_tasks_completed || 0;
                triggerCelebration(totalTasks - 1, totalTasks);
              } catch (err) {
                console.debug('Could not fetch streak for celebration:', err);
              }
            }

            triggerSubtle();
            setSuccess(`Shedding started for ${reptiles.find(r => r.id === data.reptile_id)?.name}.`);
            setLastCreatedId(response.data.id);
            setLastLogType('health');
            setShowSuccessActions(true);
          } else {
            // Shedding complete or brumation event
            const payload = {
              reptile_id: data.reptile_id,
              record_type: data.log_type,
              event_type: data.event_subtype,
              title: getAutoTitle(data.log_type, data.event_subtype),
              description: data.notes || null,
              date: new Date(dateTimeString).toISOString(),
            };
            const response = await axios.post('/api/health', payload);

            // Dispatch attribution event if completing for another user
            if (response.data.attribution) {
              notifyStreakAttribution(response.data.attribution);
            }

            // Trigger celebration after API success (per D-12, D-13)
            if (celebrationsEnabled) {
              try {
                const streakRes = await axios.get('/api/user-streaks/me');
                const totalTasks = streakRes.data.total_tasks_completed || 0;
                triggerCelebration(totalTasks - 1, totalTasks);
              } catch (err) {
                console.debug('Could not fetch streak for celebration:', err);
              }
            }

            triggerSubtle();
            setSuccess(`${data.log_type === 'shedding' ? 'Shedding' : 'Brumation'} event logged for ${reptiles.find(r => r.id === data.reptile_id)?.name}.`);
            setLastCreatedId(response.data.id);
            setLastLogType('health');
            setShowSuccessActions(true);
          }
        } else if (data.log_type === 'bathing') {
          // Bathing event - simple, no event_type needed
          const payload = {
            reptile_id: data.reptile_id,
            record_type: 'bathing',
            title: 'Bathing',
            description: data.notes || null,
            date: new Date(dateTimeString).toISOString(),
          };
          const response = await axios.post('/api/health', payload);

          // Dispatch attribution event if completing for another user
          if (response.data.attribution) {
            notifyStreakAttribution(response.data.attribution);
          }

          // Trigger celebration after API success (per D-12, D-13)
          if (celebrationsEnabled) {
            try {
              const streakRes = await axios.get('/api/user-streaks/me');
              const totalTasks = streakRes.data.total_tasks_completed || 0;
              triggerCelebration(totalTasks - 1, totalTasks);
            } catch (err) {
              console.debug('Could not fetch streak for celebration:', err);
            }
          }

          triggerSubtle();
          setSuccess(`Bathing logged for ${reptiles.find(r => r.id === data.reptile_id)?.name}.`);
          setLastCreatedId(response.data.id);
          setLastLogType('health');
          setShowSuccessActions(true);
        } else if (data.log_type === 'measurement') {
          const response = await axios.post('/api/measurements', {
            reptile_id: data.reptile_id,
            measurement_type: data.measurement_type,
            value: parseFloat(data.measurement_value),
            unit: data.measurement_unit,
            custom_label: data.measurement_type === 'custom' ? data.custom_label : null,
            measured_at: new Date(dateTimeString).toISOString(),
            notes: data.notes || null,
          });
          const typeLabel = data.measurement_type === 'custom'
            ? data.custom_label
            : data.measurement_type.replace('_', ' ');

          // Trigger celebration after API success (per D-12, D-13)
          if (celebrationsEnabled) {
            try {
              const streakRes = await axios.get('/api/user-streaks/me');
              const totalTasks = streakRes.data.total_tasks_completed || 0;
              triggerCelebration(totalTasks - 1, totalTasks);
            } catch (err) {
              console.debug('Could not fetch streak for celebration:', err);
            }
          }

          triggerSubtle();
          setSuccess(`${typeLabel} measurement logged for ${reptiles.find(r => r.id === data.reptile_id)?.name}.`);
          setLastCreatedId(response.data.id);
          setLastLogType('measurement');
          setShowSuccessActions(true);
        } else {
          const payload = {
            reptile_id: data.reptile_id,
            record_type: data.record_type,
            title: data.title,
            description: data.notes || null,
            date: new Date(dateTimeString).toISOString(),
          };
          if (data.record_type === 'bowel_movement') {
            payload.consistency = data.consistency;
          }
          const response = await axios.post('/api/health', payload);

          // Trigger celebration after API success (per D-12, D-13)
          if (celebrationsEnabled) {
            try {
              const streakRes = await axios.get('/api/user-streaks/me');
              const totalTasks = streakRes.data.total_tasks_completed || 0;
              triggerCelebration(totalTasks - 1, totalTasks);
            } catch (err) {
              console.debug('Could not fetch streak for celebration:', err);
            }
          }

          triggerSubtle();
          setSuccess(`Health record logged for ${reptiles.find(r => r.id === data.reptile_id)?.name}.`);
          setLastCreatedId(response.data.id);
          setLastLogType('health');
          setShowSuccessActions(true);
        }
      }
    } catch (err) {
      console.error("Failed to submit log:", err);
      const errorMsg = err.response?.data?.detail || "An unexpected error occurred.";
      setError(errorMsg);
      form.setError('root', { message: errorMsg });
    }
  };

  // VIEW MODE
  if (mode === 'view' && existingLog) {
    const isSheddingOrBrumation = logType === 'shedding' || logType === 'brumation';
    const viewTitle = logType === 'weight' ? 'Weight' :
                     logType === 'shedding' ? 'Shedding Event' :
                     logType === 'brumation' ? 'Brumation Event' :
                     logType === 'bathing' ? 'Bathing' :
                     logType === 'measurement' ? 'Measurement' : 'Health';

    return (
      <div>
        <PageHeader
          title={`View ${viewTitle} Log`}
          backLink={{ to: '/health-log', label: 'Back to Health Log' }}
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
              {formatDateTime(existingLog.created_at || existingLog.measured_at || existingLog.date)}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Reptile</p>
            <p className="text-lg font-medium text-foreground">
              {reptiles.find(r => r.id === existingLog.reptile_id)?.name || existingLog.reptile?.name || 'Unknown'}
            </p>
          </div>

          {logType === 'weight' ? (
            <>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Weight</p>
                <p className="text-lg font-medium text-foreground">
                  {existingLog.weight_grams}g
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Measured at</p>
                <p className="text-lg font-medium text-foreground">
                  {formatDateTime(existingLog.measured_at)}
                </p>
              </div>
            </>
          ) : logType === 'measurement' ? (
            <>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Measurement Type</p>
                <p className="text-lg font-medium text-foreground capitalize">
                  {existingLog.measurement_type === 'custom'
                    ? existingLog.custom_label
                    : existingLog.measurement_type?.replace('_', ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Value</p>
                <p className="text-lg font-medium text-foreground">
                  {existingLog.value} {existingLog.unit}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Measured at</p>
                <p className="text-lg font-medium text-foreground">
                  {formatDateTime(existingLog.measured_at)}
                </p>
              </div>
            </>
          ) : isSheddingOrBrumation ? (
            <>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Event Type</p>
                <p className="text-lg font-medium text-foreground">
                  {formatEventType(existingLog.record_type, existingLog.event_type)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Date</p>
                <p className="text-lg font-medium text-foreground">
                  {formatDateTime(existingLog.date)}
                </p>
              </div>
            </>
          ) : logType === 'bathing' ? (
            <>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Date</p>
                <p className="text-lg font-medium text-foreground">
                  {formatDateTime(existingLog.date)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Title</p>
                <p className="text-lg font-medium text-foreground">
                  {existingLog.title}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Record Type</p>
                <p className="text-lg font-medium text-foreground capitalize">
                  {existingLog.record_type.replace('_', ' ')}
                </p>
              </div>
              {existingLog.consistency && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Consistency</p>
                  <p className="text-lg font-medium text-foreground capitalize">
                    {existingLog.consistency}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Date</p>
                <p className="text-lg font-medium text-foreground">
                  {formatDateTime(existingLog.date)}
                </p>
              </div>
            </>
          )}

          {existingLog.notes && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Notes</p>
              <p className="text-foreground">{existingLog.notes}</p>
            </div>
          )}
          {existingLog.description && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Description</p>
              <p className="text-foreground">{existingLog.description}</p>
            </div>
          )}
        </div>
        <ConfettiDismissOverlay isActive={isActive} onDismiss={dismiss} />
      </div>
    );
  }

  // CREATE/EDIT MODE
  return (
    <div>
      <PageHeader
        title={mode === 'edit' ?
          `Edit ${logType === 'weight' ? 'Weight' :
                 logType === 'shedding' ? 'Shedding Event' :
                 logType === 'brumation' ? 'Brumation Event' :
                 logType === 'bathing' ? 'Bathing' :
                 logType === 'measurement' ? 'Measurement' : 'Health'} Log` :
          'Log Health'}
      />

      {/* Link to Activity History (only in create mode, not edit) */}
      {!id && mode === 'create' && (
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate('/activity')}>
            View Activity History
          </Button>
        </div>
      )}
      {error && <p className="text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg mb-4 border border-red-200 dark:border-red-800">{error}</p>}
      {success && (
        <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg mb-4 border border-green-200 dark:border-green-800">
          <p className="text-green-500 dark:text-green-400">{success}</p>
          {showSuccessActions && (
            <div className="flex gap-3 mt-4">
              <Button onClick={handleLogAnother} variant="default">
                Log Another
              </Button>
              <Button onClick={() => navigate('/')} variant="outline">
                Go to Dashboard
              </Button>
              {lastCreatedId && (
                <Button
                  onClick={() => navigate(`/health-log/${lastLogType}/${lastCreatedId}`)}
                  variant="ghost"
                >
                  View Record
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'edit' && existingLog && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-blue-900 dark:text-blue-100 text-sm">
            Originally logged at {formatDateTime(existingLog.created_at || existingLog.measured_at || existingLog.date)}
          </p>
        </div>
      )}

      {!showSuccessActions && (
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

          <FormField
            control={form.control}
            name="log_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-muted-foreground">Log Type</FormLabel>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => field.onChange('weight')}
                    disabled={mode === 'edit'}
                    variant={field.value === 'weight' ? 'default' : 'outline'}
                  >
                    Weight
                  </Button>
                  <Button
                    type="button"
                    onClick={() => field.onChange('health')}
                    disabled={mode === 'edit'}
                    variant={field.value === 'health' ? 'default' : 'outline'}
                  >
                    Health Record
                  </Button>
                  <Button
                    type="button"
                    onClick={() => field.onChange('shedding')}
                    disabled={mode === 'edit'}
                    variant={field.value === 'shedding' ? 'default' : 'outline'}
                  >
                    Shedding
                  </Button>
                  <Button
                    type="button"
                    onClick={() => field.onChange('brumation')}
                    disabled={mode === 'edit'}
                    variant={field.value === 'brumation' ? 'default' : 'outline'}
                  >
                    Brumation
                  </Button>
                  <Button
                    type="button"
                    onClick={() => field.onChange('bathing')}
                    disabled={mode === 'edit'}
                    variant={field.value === 'bathing' ? 'default' : 'outline'}
                  >
                    Bathing
                  </Button>
                  <Button
                    type="button"
                    onClick={() => field.onChange('measurement')}
                    disabled={mode === 'edit'}
                    variant={field.value === 'measurement' ? 'default' : 'outline'}
                  >
                    Measurement
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {logType === 'shedding' && (
            <FormField
              control={form.control}
              name="event_subtype"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Is this reptile shedding?</FormLabel>
                  {mode === 'create' && formatCurrentStatus() && (
                    <div className="mb-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-900 dark:text-blue-100">
                      Current status: {formatCurrentStatus()}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        field.onChange('start');
                      }}
                      disabled={mode === 'edit' || !canStartShedding}
                      variant={field.value === 'start' ? 'default' : 'outline'}
                      className={!canStartShedding && mode === 'create' ? 'opacity-50 cursor-not-allowed' : ''}
                      title={!canStartShedding && mode === 'create' ? 'Already shedding' : ''}
                    >
                      Yes, showing signs
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        field.onChange('check_no');
                      }}
                      disabled={mode === 'edit'}
                      variant={field.value === 'check_no' ? 'default' : 'outline'}
                    >
                      No, not shedding
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        field.onChange('complete');
                      }}
                      disabled={mode === 'edit' || !canCompleteShedding}
                      variant={field.value === 'complete' ? 'default' : 'outline'}
                      className={!canCompleteShedding && mode === 'create' ? 'opacity-50 cursor-not-allowed' : ''}
                      title={!canCompleteShedding && mode === 'create' ? 'Not currently shedding' : ''}
                    >
                      Shed Complete
                    </Button>
                  </div>
                  {mode === 'create' && healthStatusLoading && (
                    <p className="text-sm text-muted-foreground">Loading status...</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {logType === 'brumation' && (
            <FormField
              control={form.control}
              name="event_subtype"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Event Type</FormLabel>
                  {mode === 'create' && formatCurrentStatus() && (
                    <div className="mb-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-900 dark:text-blue-100">
                      Current status: {formatCurrentStatus()}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        field.onChange('start');
                      }}
                      disabled={mode === 'edit' || !canStartBrumation}
                      variant={field.value === 'start' ? 'default' : 'outline'}
                      className={!canStartBrumation && mode === 'create' ? 'opacity-50 cursor-not-allowed' : ''}
                      title={!canStartBrumation && mode === 'create' ? 'Already brumating' : ''}
                    >
                      Started Brumating
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        field.onChange('end');
                      }}
                      disabled={mode === 'edit' || !canEndBrumation}
                      variant={field.value === 'end' ? 'default' : 'outline'}
                      className={!canEndBrumation && mode === 'create' ? 'opacity-50 cursor-not-allowed' : ''}
                      title={!canEndBrumation && mode === 'create' ? 'Not currently brumating' : ''}
                    >
                      Ended Brumation
                    </Button>
                  </div>
                  {mode === 'create' && healthStatusLoading && (
                    <p className="text-sm text-muted-foreground">Loading status...</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {logType === 'measurement' && (
            <>
              <FormField
                control={form.control}
                name="measurement_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">What are you measuring?</FormLabel>
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
                      <FormLabel className="text-muted-foreground">Custom Measurement Name</FormLabel>
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
                      <FormLabel className="text-muted-foreground">Value</FormLabel>
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
                      <FormLabel className="text-muted-foreground">Unit</FormLabel>
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
            </>
          )}

          {logType === 'weight' ? (
            <FormField
              control={form.control}
              name="weight_grams"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Weight (grams)</FormLabel>
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
          ) : logType === 'health' ? (
            <>
              <FormField
                control={form.control}
                name="record_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Record Type</FormLabel>
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
                    <FormLabel className="text-muted-foreground">Title</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={
                          recordType === 'shedding' ? 'e.g., Complete shed' :
                          recordType === 'bowel_movement' ? 'e.g., Morning bowel movement' :
                          'Brief description'
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
                      <FormLabel className="text-muted-foreground">Consistency</FormLabel>
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
            </>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="log_date"
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
              name="log_time"
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
                    placeholder={
                      logType === 'weight' ? 'e.g., after shedding' :
                      recordType === 'bowel_movement' ? 'Additional observations...' :
                      'e.g., noticed a small scratch'
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-3">
            <Button type="submit" className="flex-1">
              {mode === 'edit' ? 'Update Log' : 'Save Log'}
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
      )}
      <ConfettiDismissOverlay isActive={isActive} onDismiss={dismiss} />

      {/* AlertDialog for delete health log confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getDeleteDialogTitle()}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this log? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={executeDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
