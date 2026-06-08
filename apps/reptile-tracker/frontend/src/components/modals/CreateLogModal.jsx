import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { Loader2, Bug, Leaf, Utensils, Plus, X, Heart } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCelebrations } from '@/contexts/CelebrationContext';

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

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const feedingSchema = z.object({
  reptile_id: z.number().min(1, 'Please select a reptile'),
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
  global_supplements: z.array(z.number()),
  // Refused feeding fields (FEAT-02)
  is_refused: z.boolean(),
  retry_option: z.enum(['tomorrow_same_time', 'next_scheduled', 'custom', '']).optional(),
  retry_date: z.string().optional(),
  retry_time: z.string().optional(),
}).refine(data => data.is_refused || data.include_insects || data.include_salad || data.include_prepared, {
  message: 'Please select at least one feeding type',
  path: ['include_insects']
}).refine(data => data.is_refused || !data.include_insects || data.insect_items.length > 0, {
  message: 'Please add at least one insect item or uncheck Insects',
  path: ['insect_items']
}).refine(data => data.is_refused || !data.include_salad || data.salad_components.length > 0, {
  message: 'Please select at least one salad component or uncheck Salad',
  path: ['salad_components']
}).refine(data => data.is_refused || !data.include_prepared || data.prepared_items.length > 0, {
  message: 'Please add at least one prepared food item or uncheck Other Food',
  path: ['prepared_items']
}).refine(data => !data.is_refused || data.retry_option, {
  message: 'Please select a retry option',
  path: ['retry_option']
}).refine(data => !(data.is_refused && data.retry_option === 'custom') || (data.retry_date && data.retry_time), {
  message: 'Please select a date and time for the custom retry',
  path: ['retry_date']
});

const mistingSchema = z.object({
  reptile_id: z.number().min(1, 'Please select a reptile'),
  misted_at_date: z.string().min(1, 'Date is required'),
  misted_at_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/, 'Invalid time format'),
  notes: z.string().optional(),
});

const healthSchema = z.object({
  reptile_id: z.number().min(1, 'Please select a reptile'),
  log_date: z.string().min(1, 'Date is required'),
  log_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/, 'Invalid time format'),
  health_log_type: z.enum(['weight', 'health', 'shedding', 'brumation', 'bathing', 'measurement']),
  // Weight fields
  weight_grams: z.string().optional(),
  // Health record fields
  record_type: z.string().optional(),
  title: z.string().optional(),
  consistency: z.string().optional(),
  // Shedding/Brumation fields
  event_subtype: z.string().optional(),
  // Measurement fields
  measurement_type: z.string().optional(),
  measurement_value: z.string().optional(),
  measurement_unit: z.string().optional(),
  custom_label: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.health_log_type === 'weight') {
    return data.weight_grams && parseFloat(data.weight_grams) > 0;
  }
  return true;
}, {
  message: "Weight is required",
  path: ['weight_grams'],
}).refine((data) => {
  if (data.health_log_type === 'health') {
    return data.record_type && data.title && data.title.length > 0;
  }
  return true;
}, {
  message: "Record type and title are required",
  path: ['title'],
}).refine((data) => {
  if (data.health_log_type === 'shedding' || data.health_log_type === 'brumation') {
    return data.event_subtype && data.event_subtype.length > 0;
  }
  return true;
}, {
  message: "Please select an option",
  path: ['event_subtype'],
}).refine((data) => {
  if (data.health_log_type === 'measurement') {
    return data.measurement_type && data.measurement_value && data.measurement_unit;
  }
  return true;
}, {
  message: "Measurement type, value, and unit are required",
  path: ['measurement_type'],
}).refine((data) => {
  if (data.health_log_type === 'measurement' && data.measurement_type === 'custom') {
    return data.custom_label && data.custom_label.length > 0;
  }
  return true;
}, {
  message: "Custom label is required for custom measurements",
  path: ['custom_label'],
});

// Schema map by log type
const schemas = {
  feeding: feedingSchema,
  misting: mistingSchema,
  health: healthSchema,
  weight: healthSchema,
  measurement: healthSchema,
};

// ============================================================================
// HELPERS
// ============================================================================

const getCurrentDate = () => new Date().toISOString().slice(0, 10);
const getCurrentTime = () => new Date().toTimeString().slice(0, 5);

const LOG_TYPE_TITLES = {
  feeding: 'Log Feeding',
  misting: 'Log Misting',
  health: 'Log Health',
  weight: 'Log Weight',
  measurement: 'Log Measurement',
};

// Build ISO datetime with timezone offset
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

// Generate auto-title for shedding/brumation
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * CreateLogModal - Left-slide modal for creating new log entries
 * Full-featured modal matching the original log pages
 */
export function CreateLogModal({
  logType = 'feeding',
  reptileId,
  scheduleId,
  open,
  onOpenChange,
  onSuccess,
  onCancel,
  prefill,
}) {
  const safePrefill = prefill ?? {};
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const { triggerCelebration, celebrationsEnabled } = useCelebrations();
  const [reptiles, setReptiles] = useState([]);
  const [foods, setFoods] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Health status for shedding/brumation state validation
  const [healthStatus, setHealthStatus] = useState(null);
  const [healthStatusLoading, setHealthStatusLoading] = useState(false);

  // Supplement rotation suggestions
  const [suggestedSupplements, setSuggestedSupplements] = useState([]);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [supplementsPreFilled, setSupplementsPreFilled] = useState(false);
  const [originalPreFilledSupplements, setOriginalPreFilledSupplements] = useState([]);

  // Close on navigation (per D-03)
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  // Close modal when URL changes (navigation away from current page)
  useEffect(() => {
    if (prevPathRef.current !== location.pathname && open) {
      onOpenChange?.(false);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, open, onOpenChange]);

  // Determine effective log type for schema selection
  const effectiveLogType = (logType === 'weight' || logType === 'measurement') ? 'health' : logType;
  const schema = schemas[effectiveLogType] || feedingSchema;

  // ============================================================================
  // FORM INITIALIZATION
  // ============================================================================

  const getDefaultValues = () => {
    const now = { date: getCurrentDate(), time: getCurrentTime() };
    const baseReptileId = reptileId || 0;

    // Use scheduled_date if available (from schedule instance), otherwise fall back to date or now
    const defaultDate = safePrefill.scheduled_date || safePrefill.date || now.date;

    if (effectiveLogType === 'feeding') {
      // Extract supplement IDs from objects if needed (schedule instances pass objects)
      let supplementIds = [];
      if (safePrefill.supplements && Array.isArray(safePrefill.supplements)) {
        supplementIds = safePrefill.supplements.map(s => typeof s === 'object' ? s.id : s);
      }
      return {
        reptile_id: baseReptileId,
        fed_date: defaultDate,
        fed_time: safePrefill.time || now.time,
        notes: safePrefill.notes || '',
        include_insects: true,
        include_salad: false,
        include_prepared: false,
        insect_items: [],
        salad_components: [],
        salad_supplements: [],
        prepared_items: [],
        global_supplements: supplementIds,
        // Refused feeding (FEAT-02)
        is_refused: false,
        retry_option: '',
        retry_date: '',
        retry_time: '',
      };
    }

    if (effectiveLogType === 'misting') {
      return {
        reptile_id: baseReptileId,
        misted_at_date: defaultDate,
        misted_at_time: safePrefill.time || now.time,
        notes: safePrefill.notes || '',
      };
    }

    // Health (includes weight, measurement, shedding, brumation, bathing)
    let healthLogType = 'weight';
    if (logType === 'weight') healthLogType = 'weight';
    else if (logType === 'measurement') healthLogType = 'measurement';
    else if (safePrefill.record_type === 'shedding_check' || safePrefill.health_subtype === 'shedding_check') healthLogType = 'shedding';
    else if (safePrefill.record_type === 'brumation_check' || safePrefill.health_subtype === 'brumation_check') healthLogType = 'brumation';
    else if (safePrefill.record_type === 'bathing' || safePrefill.health_subtype === 'bathing') healthLogType = 'bathing';
    else if (safePrefill.record_type || safePrefill.health_subtype) {
      // Map health_record subtype to health log type
      const subtype = safePrefill.health_subtype || safePrefill.record_type;
      if (['weight'].includes(subtype)) healthLogType = 'weight';
      else if (['measurement'].includes(subtype)) healthLogType = 'measurement';
      else if (['shedding_check'].includes(subtype)) healthLogType = 'shedding';
      else if (['brumation_check'].includes(subtype)) healthLogType = 'brumation';
      else if (['bathing'].includes(subtype)) healthLogType = 'bathing';
      else healthLogType = 'health';
    }

    return {
      reptile_id: baseReptileId,
      log_date: defaultDate,
      log_time: safePrefill.time || now.time,
      health_log_type: healthLogType,
      weight_grams: safePrefill.weight_grams || '',
      record_type: safePrefill.record_type || 'observation',
      title: safePrefill.title || '',
      consistency: safePrefill.consistency || 'normal',
      event_subtype: '',
      measurement_type: safePrefill.measurement_type || '',
      measurement_value: safePrefill.measurement_value || '',
      measurement_unit: safePrefill.measurement_unit || '',
      custom_label: safePrefill.custom_label || '',
      notes: safePrefill.notes || '',
    };
  };

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: getDefaultValues(),
    mode: 'onBlur',
  });

  // Field arrays for feeding
  const { fields: insectFields, append: appendInsect, remove: removeInsect } = useFieldArray({
    control: form.control,
    name: 'insect_items'
  });

  const { fields: preparedFields, append: appendPrepared, remove: removePrepared } = useFieldArray({
    control: form.control,
    name: 'prepared_items'
  });

  // Watch values
  const watchReptileId = useWatch({ control: form.control, name: 'reptile_id' });
  const watchIncludeInsects = useWatch({ control: form.control, name: 'include_insects' });
  const watchIncludeSalad = useWatch({ control: form.control, name: 'include_salad' });
  const watchIncludePrepared = useWatch({ control: form.control, name: 'include_prepared' });
  const watchIsRefused = useWatch({ control: form.control, name: 'is_refused' });
  const watchRetryOption = useWatch({ control: form.control, name: 'retry_option' });
  const healthLogType = useWatch({ control: form.control, name: 'health_log_type' });
  const measurementType = useWatch({ control: form.control, name: 'measurement_type' });
  const recordType = useWatch({ control: form.control, name: 'record_type' });
  const watchFedDate = useWatch({ control: form.control, name: 'fed_date' });

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Fetch initial data when modal opens
  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const requests = [axios.get('/api/reptiles')];

        if (effectiveLogType === 'feeding') {
          requests.push(axios.get('/api/foods'));
          requests.push(axios.get('/api/supplements'));
        }

        const responses = await Promise.all(requests);
        setReptiles(responses[0].data);

        if (effectiveLogType === 'feeding') {
          setFoods(responses[1].data);
          setSupplements(responses[2].data);
        }

        // Set default reptile
        const currentReptileId = form.getValues('reptile_id');
        if (!currentReptileId || currentReptileId === 0) {
          if (reptileId) {
            form.setValue('reptile_id', reptileId);
          } else if (responses[0].data.length > 0) {
            form.setValue('reptile_id', responses[0].data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, effectiveLogType, reptileId]);

  // Refetch foods when reptile changes (for reptile-specific favorites)
  useEffect(() => {
    if (!open || effectiveLogType !== 'feeding' || !watchReptileId) return;

    const refetchFoods = async () => {
      try {
        const response = await axios.get(`/api/foods?reptile_id=${watchReptileId}`);
        setFoods(response.data);
      } catch (err) {
        console.error('Failed to refetch foods:', err);
      }
    };
    refetchFoods();
  }, [watchReptileId, open, effectiveLogType]);

  // Auto-select default food for reptile (per D-09 - matching FeedingLog.jsx pattern)
  useEffect(() => {
    if (!open || effectiveLogType !== 'feeding' || !watchReptileId || foods.length === 0) return;

    const applyDefaultFoods = async () => {
      try {
        const reptileRes = await axios.get(`/api/reptiles/${watchReptileId}`);
        const reptile = reptileRes.data;

        // Auto-add default insect if available and insect_items is empty
        if (reptile.default_insect_id && watchIncludeInsects) {
          const currentItems = form.getValues('insect_items') || [];
          if (currentItems.length === 0 || (currentItems.length === 1 && currentItems[0].food_id !== reptile.default_insect_id.toString())) {
            const defaultFood = foods.find(f => f.id === reptile.default_insect_id);
            if (defaultFood) {
              form.setValue('insect_items', [{
                id: Date.now(),
                food_id: String(reptile.default_insect_id),
                quantity: 1,
                supplement_ids: []
              }]);
            }
          }
        }

        // Auto-add default prepared if available and prepared_items is empty
        if (reptile.default_prepared_id && watchIncludePrepared) {
          const currentItems = form.getValues('prepared_items') || [];
          if (currentItems.length === 0 || (currentItems.length === 1 && currentItems[0].food_id !== reptile.default_prepared_id.toString())) {
            const defaultFood = foods.find(f => f.id === reptile.default_prepared_id);
            if (defaultFood) {
              form.setValue('prepared_items', [{
                id: Date.now(),
                food_id: String(reptile.default_prepared_id),
                quantity: 1,
                supplement_ids: []
              }]);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch reptile for default food:', err);
      }
    };

    applyDefaultFoods();
  }, [watchReptileId, watchIncludeInsects, watchIncludePrepared, open, effectiveLogType, foods]);

  // Fetch health status for shedding/brumation validation
  useEffect(() => {
    if (!open || effectiveLogType !== 'health' || !watchReptileId || watchReptileId === 0) {
      setHealthStatus(null);
      return;
    }

    const fetchHealthStatus = async () => {
      setHealthStatusLoading(true);
      try {
        const response = await axios.get(`/api/health/status/${watchReptileId}`);
        setHealthStatus(response.data);
      } catch (err) {
        console.error('Failed to fetch health status:', err);
        setHealthStatus(null);
      } finally {
        setHealthStatusLoading(false);
      }
    };

    fetchHealthStatus();
  }, [watchReptileId, open, effectiveLogType]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues());
      setError('');
      setHealthStatus(null);
      setSuggestedSupplements([]);
      setShowSuggestion(false);

      // Check for pre-filled supplements from prefill prop
      // If instance_id is present, we're from a schedule context - always use pre-fill mode (not suggestion)
      if (effectiveLogType === 'feeding' && (safePrefill.instance_id || (safePrefill.supplements && safePrefill.supplements.length > 0))) {
        // Extract IDs from objects if needed (schedule instances pass objects)
        const supplementIds = safePrefill.supplements?.length > 0
          ? safePrefill.supplements.map(s => typeof s === 'object' ? s.id : s)
          : [];
        setSupplementsPreFilled(true);
        setOriginalPreFilledSupplements(supplementIds);
      } else {
        setSupplementsPreFilled(false);
        setOriginalPreFilledSupplements([]);
      }
    }
  }, [open, logType, reptileId, prefill]);

  // Fetch supplement suggestions from rotation rules
  useEffect(() => {
    if (!open || effectiveLogType !== 'feeding' || !watchReptileId || supplementsPreFilled) {
      return;
    }

    const fetchSuggestion = async () => {
      try {
        // Determine food category based on what's enabled
        let foodCategory = null;
        if (watchIncludeInsects && !watchIncludeSalad && !watchIncludePrepared) {
          foodCategory = 'insects';
        } else if (watchIncludeSalad && !watchIncludeInsects && !watchIncludePrepared) {
          foodCategory = 'salad';
        } else if (watchIncludeInsects || watchIncludeSalad || watchIncludePrepared) {
          foodCategory = 'mixed';
        }

        if (foodCategory) {
          const response = await axios.get(
            `/api/feeding-rotations/reptile/${watchReptileId}/calculate`,
            { params: { food_category: foodCategory, feeding_date: watchFedDate } }
          );

          if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            const suggestionsWithSupplements = response.data
              .map(rotation => {
                const supplement = supplements.find(s => s.id === rotation.supplement_id);
                return supplement ? { ...rotation, supplement } : null;
              })
              .filter(Boolean);

            if (suggestionsWithSupplements.length > 0) {
              setSuggestedSupplements(suggestionsWithSupplements);
              setShowSuggestion(true);
            } else {
              setSuggestedSupplements([]);
              setShowSuggestion(false);
            }
          } else {
            setSuggestedSupplements([]);
            setShowSuggestion(false);
          }
        }
      } catch (error) {
        console.debug('No rotation suggestion:', error);
        setSuggestedSupplements([]);
        setShowSuggestion(false);
      }
    };

    fetchSuggestion();
  }, [open, effectiveLogType, watchReptileId, watchIncludeInsects, watchIncludeSalad, watchIncludePrepared, supplements, watchFedDate, supplementsPreFilled]);

  // Apply all suggested supplements
  const applyAllSuggestedSupplements = () => {
    const currentSupplements = form.getValues('global_supplements') || [];
    const newSupplementIds = suggestedSupplements
      .map(s => s.supplement_id)
      .filter(id => !currentSupplements.includes(id));

    if (newSupplementIds.length > 0) {
      form.setValue('global_supplements', [...currentSupplements, ...newSupplementIds]);
    }
    setShowSuggestion(false);
  };

  // Dismiss suggestion
  const dismissSuggestion = () => {
    setShowSuggestion(false);
  };

  // Auto-set default unit for measurement type
  useEffect(() => {
    if (effectiveLogType === 'health' && healthLogType === 'measurement' && measurementType && !form.getValues('measurement_unit')) {
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
  }, [measurementType, healthLogType, effectiveLogType]);

  // Auto-select valid shedding/brumation option when only one is available
  useEffect(() => {
    if (effectiveLogType !== 'health' || !healthStatus) return;

    if (healthLogType === 'shedding') {
      const canStart = !healthStatus.is_shedding;
      const canComplete = healthStatus.is_shedding;
      if (canComplete && !canStart) {
        form.setValue('event_subtype', 'complete');
      } else if (canStart && !canComplete) {
        form.setValue('event_subtype', 'start');
      }
    }

    if (healthLogType === 'brumation') {
      const canStart = !healthStatus.is_brumating;
      const canEnd = healthStatus.is_brumating;
      if (canEnd && !canStart) {
        form.setValue('event_subtype', 'end');
      } else if (canStart && !canEnd) {
        form.setValue('event_subtype', 'start');
      }
    }
  }, [healthLogType, healthStatus, effectiveLogType]);

  // ============================================================================
  // FEEDING HELPERS
  // ============================================================================

  // Sort foods by favorites
  const sortByFavorites = (foodList) => {
    return [...foodList].sort((a, b) => {
      const aReptileFav = a.is_reptile_favorite || false;
      const bReptileFav = b.is_reptile_favorite || false;
      if (aReptileFav !== bReptileFav) return bReptileFav ? 1 : -1;
      if (a.is_favorite !== b.is_favorite) return b.is_favorite ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  };

  const insectFoods = sortByFavorites(foods.filter(f => f.category === 'insect' || f.category === 'worms'));
  const saladFoods = sortByFavorites(foods.filter(f => f.category === 'vegetable' || f.category === 'fruit'));
  const preparedFoods = sortByFavorites(
    foods.filter(f =>
      (f.category === 'prepared' || f.category === 'frozen_animal' || f.category === 'live_rodent' ||
       f.category === 'fish_seafood' || f.category === 'eggs' || f.category === 'other') &&
      f.name !== 'Salad'
    )
  );

  // Toggle reptile favorite
  const toggleReptileFavorite = async (foodId) => {
    if (!watchReptileId) return;

    const food = foods.find(f => f.id === parseInt(foodId));
    if (!food) return;

    const isCurrentlyFavorite = food.is_reptile_favorite || false;

    try {
      if (isCurrentlyFavorite) {
        await axios.delete(`/api/reptiles/${watchReptileId}/favorite-foods/${foodId}`);
      } else {
        await axios.post(`/api/reptiles/${watchReptileId}/favorite-foods/${foodId}`);
      }

      setFoods(foods.map(f =>
        f.id === parseInt(foodId) ? { ...f, is_reptile_favorite: !isCurrentlyFavorite } : f
      ));
    } catch (err) {
      console.error('Failed to toggle reptile favorite:', err);
    }
  };

  // ============================================================================
  // HEALTH HELPERS
  // ============================================================================

  const canStartShedding = !healthStatus?.is_shedding;
  const canCompleteShedding = healthStatus?.is_shedding;
  const canStartBrumation = !healthStatus?.is_brumating;
  const canEndBrumation = healthStatus?.is_brumating;

  const formatCurrentStatus = () => {
    if (!healthStatus) return null;
    const parts = [];
    if (healthStatus.is_shedding) {
      parts.push(healthStatus.days_shedding ? `Shedding for ${healthStatus.days_shedding} days` : 'Shedding');
    }
    if (healthStatus.is_brumating) {
      parts.push(healthStatus.days_brumating ? `Brumating for ${healthStatus.days_brumating} days` : 'Brumating');
    }
    return parts.length > 0 ? parts.join(', ') : null;
  };

  // ============================================================================
  // FORM SUBMISSION
  // ============================================================================

  const handleSubmit = async (data) => {
    setError('');
    setSubmitting(true);

    try {
      let response;

      if (effectiveLogType === 'feeding') {
        const fedAtISO = buildDateTimeISO(data.fed_date, data.fed_time);

        // Calculate retry datetime if custom option selected
        let retryDatetime = null;
        if (data.is_refused && data.retry_option === 'custom' && data.retry_date && data.retry_time) {
          retryDatetime = buildDateTimeISO(data.retry_date, data.retry_time);
        }

        let payload = {
          reptile_id: data.reptile_id,
          fed_at: fedAtISO,
          notes: data.notes || '',
          is_salad: data.include_salad,
          foods: [],
          supplements: data.global_supplements,
          salad_components: [],
          // Refused feeding (FEAT-02)
          status: data.is_refused ? 'refused' : 'eaten',
          retry_option: data.is_refused ? data.retry_option : null,
          retry_datetime: retryDatetime,
        };

        // Only add food items if not refused
        if (!data.is_refused) {
          // Add insect foods
          if (data.include_insects) {
            payload.foods.push(...data.insect_items.map(item => ({
              food_id: parseInt(item.food_id),
              quantity: item.quantity,
              supplement_ids: item.supplement_ids || []
            })));
          }

          // Add prepared foods
          if (data.include_prepared) {
            payload.foods.push(...data.prepared_items.map(item => ({
              food_id: parseInt(item.food_id),
              quantity: item.quantity,
              supplement_ids: item.supplement_ids || []
            })));
          }

          // Add salad
          if (data.include_salad) {
            const saladFood = foods.find(f => f.name === 'Salad');
            if (!saladFood) {
              setError("Salad food item not found. Please create it in Food Management.");
              setSubmitting(false);
              return;
            }
            payload.foods.push({
              food_id: saladFood.id,
              quantity: 1,
              supplement_ids: data.salad_supplements || []
            });
            payload.salad_components = data.salad_components;
          }
        }

        response = await axios.post('/api/feedings', payload);
      } else if (effectiveLogType === 'misting') {
        const payload = {
          reptile_id: data.reptile_id,
          misted_at: new Date(`${data.misted_at_date}T${data.misted_at_time}`).toISOString(),
          notes: data.notes || null,
        };
        response = await axios.post('/api/misting', payload);
      } else if (effectiveLogType === 'health') {
        const dateTimeString = `${data.log_date}T${data.log_time}`;

        if (data.health_log_type === 'weight') {
          response = await axios.post('/api/weight', {
            reptile_id: data.reptile_id,
            weight_grams: parseFloat(data.weight_grams),
            measured_at: new Date(dateTimeString).toISOString(),
            notes: data.notes || null,
          });
        } else if (data.health_log_type === 'measurement') {
          response = await axios.post('/api/measurements', {
            reptile_id: data.reptile_id,
            measurement_type: data.measurement_type,
            value: parseFloat(data.measurement_value),
            unit: data.measurement_unit,
            custom_label: data.measurement_type === 'custom' ? data.custom_label : null,
            measured_at: new Date(dateTimeString).toISOString(),
            notes: data.notes || null,
          });
        } else if (data.health_log_type === 'shedding') {
          if (data.event_subtype === 'check_no') {
            response = await axios.post('/api/health', {
              reptile_id: data.reptile_id,
              record_type: 'shedding_check',
              title: 'Shedding Check: No',
              description: data.notes || null,
              date: new Date(dateTimeString).toISOString(),
            });
          } else if (data.event_subtype === 'start') {
            // Create shedding check: Yes AND shedding start
            await axios.post('/api/health', {
              reptile_id: data.reptile_id,
              record_type: 'shedding_check',
              title: 'Shedding Check: Yes',
              description: data.notes || null,
              date: new Date(dateTimeString).toISOString(),
            });
            response = await axios.post('/api/health', {
              reptile_id: data.reptile_id,
              record_type: 'shedding',
              event_type: 'start',
              title: 'Started shedding',
              description: 'Triggered from shedding check',
              date: new Date(dateTimeString).toISOString(),
            });
          } else {
            response = await axios.post('/api/health', {
              reptile_id: data.reptile_id,
              record_type: 'shedding',
              event_type: data.event_subtype,
              title: getAutoTitle('shedding', data.event_subtype),
              description: data.notes || null,
              date: new Date(dateTimeString).toISOString(),
            });
          }
        } else if (data.health_log_type === 'brumation') {
          response = await axios.post('/api/health', {
            reptile_id: data.reptile_id,
            record_type: 'brumation',
            event_type: data.event_subtype,
            title: getAutoTitle('brumation', data.event_subtype),
            description: data.notes || null,
            date: new Date(dateTimeString).toISOString(),
          });
        } else if (data.health_log_type === 'bathing') {
          response = await axios.post('/api/health', {
            reptile_id: data.reptile_id,
            record_type: 'bathing',
            title: 'Bathing',
            description: data.notes || null,
            date: new Date(dateTimeString).toISOString(),
          });
        } else {
          // General health record
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
          response = await axios.post('/api/health', payload);
        }
      }

      // Refetch dashboard queries to trigger immediate refresh (per D-05, BUG-04 fix)
      // Use refetchQueries instead of invalidateQueries to ensure data is updated before continuing
      await queryClient.refetchQueries({ queryKey: ['dashboard'] });

      // Trigger celebration after API success (per D-12, D-13)
      // Note: Animation shows prevCount→currentStreak, which may be approximate
      if (celebrationsEnabled) {
        try {
          const streakRes = await axios.get('/api/user-streaks/me');
          const currentStreak = streakRes.data.current_streak || 1;
          const prevCount = Math.max(0, currentStreak - 1);
          triggerCelebration(prevCount, currentStreak);
        } catch (err) {
          console.debug('Could not fetch streak for celebration:', err);
          triggerCelebration(0, 1);
        }
      }

      onSuccess?.(response?.data);
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

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex flex-col p-0 overflow-hidden sm:max-w-lg">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle>{LOG_TYPE_TITLES[logType] || 'Log Activity'}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 space-y-4 p-6 overflow-y-auto">
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

                {/* FEEDING FORM */}
                {effectiveLogType === 'feeding' && (
                  <FeedingForm
                    form={form}
                    insectFields={insectFields}
                    appendInsect={appendInsect}
                    removeInsect={removeInsect}
                    preparedFields={preparedFields}
                    appendPrepared={appendPrepared}
                    removePrepared={removePrepared}
                    watchIncludeInsects={watchIncludeInsects}
                    watchIncludeSalad={watchIncludeSalad}
                    watchIncludePrepared={watchIncludePrepared}
                    watchIsRefused={watchIsRefused}
                    watchRetryOption={watchRetryOption}
                    watchReptileId={watchReptileId}
                    insectFoods={insectFoods}
                    saladFoods={saladFoods}
                    preparedFoods={preparedFoods}
                    supplements={supplements}
                    toggleReptileFavorite={toggleReptileFavorite}
                    foods={foods}
                    suggestedSupplements={suggestedSupplements}
                    showSuggestion={showSuggestion}
                    supplementsPreFilled={supplementsPreFilled}
                    originalPreFilledSupplements={originalPreFilledSupplements}
                    applyAllSuggestedSupplements={applyAllSuggestedSupplements}
                    dismissSuggestion={dismissSuggestion}
                  />
                )}

                {/* MISTING FORM */}
                {effectiveLogType === 'misting' && (
                  <MistingForm form={form} />
                )}

                {/* HEALTH FORM */}
                {effectiveLogType === 'health' && (
                  <HealthForm
                    form={form}
                    healthLogType={healthLogType}
                    recordType={recordType}
                    measurementType={measurementType}
                    healthStatus={healthStatus}
                    healthStatusLoading={healthStatusLoading}
                    canStartShedding={canStartShedding}
                    canCompleteShedding={canCompleteShedding}
                    canStartBrumation={canStartBrumation}
                    canEndBrumation={canEndBrumation}
                    formatCurrentStatus={formatCurrentStatus}
                  />
                )}
              </div>

              <SheetFooter className="px-6 py-4 border-t border-border">
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
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
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

// ============================================================================
// FEEDING FORM COMPONENT
// ============================================================================

function FeedingForm({
  form,
  insectFields,
  appendInsect,
  removeInsect,
  preparedFields,
  appendPrepared,
  removePrepared,
  watchIncludeInsects,
  watchIncludeSalad,
  watchIncludePrepared,
  watchIsRefused,
  watchRetryOption,
  watchReptileId,
  insectFoods,
  saladFoods,
  preparedFoods,
  supplements,
  toggleReptileFavorite,
  foods,
  suggestedSupplements,
  showSuggestion,
  supplementsPreFilled,
  originalPreFilledSupplements,
  applyAllSuggestedSupplements,
  dismissSuggestion,
}) {
  return (
    <>
      {/* Refused Feeding Toggle (FEAT-02) - subtle inline style */}
      <div className="space-y-3">
        <label className="inline-flex items-center gap-2 cursor-pointer group">
          <div className={`relative w-10 h-5 rounded-full transition-colors ${
            watchIsRefused ? 'bg-primary' : 'bg-muted'
          }`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              watchIsRefused ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
            <input
              type="checkbox"
              checked={watchIsRefused || false}
              onChange={(e) => {
                form.setValue('is_refused', e.target.checked);
                if (e.target.checked) {
                  // Default to next scheduled feeding
                  form.setValue('retry_option', 'next_scheduled');
                } else {
                  form.setValue('retry_option', '');
                  form.setValue('retry_date', '');
                  form.setValue('retry_time', '');
                }
              }}
              className="sr-only"
            />
          </div>
          <span className={`text-sm transition-colors ${
            watchIsRefused ? 'text-foreground font-medium' : 'text-muted-foreground group-hover:text-foreground'
          }`}>Refused to eat</span>
        </label>

        {/* Retry Options - shown when refused is checked */}
        {watchIsRefused && (
          <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-3">
            <div className="text-sm font-medium text-foreground">When should we retry?</div>

            <div className="space-y-1.5">
              {[
                { value: 'tomorrow_same_time', label: 'Tomorrow, same time' },
                { value: 'next_scheduled', label: 'Next scheduled feeding' },
                { value: 'custom', label: 'Custom date/time' },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors text-sm ${
                    watchRetryOption === option.value
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  }`}
                  onClick={() => form.setValue('retry_option', option.value)}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    watchRetryOption === option.value
                      ? 'border-primary'
                      : 'border-muted-foreground'
                  }`}>
                    {watchRetryOption === option.value && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            {/* Custom date/time picker */}
            {watchRetryOption === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <FormField
                  control={form.control}
                  name="retry_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Date</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="retry_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Time</FormLabel>
                      <FormControl>
                        <TimePicker
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {form.formState.errors.retry_option && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.retry_option.message}</p>
            )}
          </div>
        )}
      </div>

      {/* Food Type Selection - hidden when refused */}
      {!watchIsRefused && (
      <>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Feeding Type</label>
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant={watchIncludeInsects ? "default" : "outline"}
            className="h-auto p-3"
            onClick={() => {
              const newValue = !watchIncludeInsects;
              form.setValue('include_insects', newValue);
              if (newValue && insectFields.length === 0 && insectFoods.length > 0) {
                appendInsect({
                  id: Date.now(),
                  food_id: insectFoods[0].id.toString(),
                  quantity: 1,
                  supplement_ids: []
                });
              }
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <Bug size={18} />
              <span className="text-xs">Insects</span>
            </div>
          </Button>

          <Button
            type="button"
            variant={watchIncludeSalad ? "default" : "outline"}
            className="h-auto p-3"
            onClick={() => form.setValue('include_salad', !watchIncludeSalad)}
          >
            <div className="flex flex-col items-center gap-1">
              <Leaf size={18} />
              <span className="text-xs">Salad</span>
            </div>
          </Button>

          <Button
            type="button"
            variant={watchIncludePrepared ? "default" : "outline"}
            className="h-auto p-3"
            onClick={() => {
              const newValue = !watchIncludePrepared;
              form.setValue('include_prepared', newValue);
              if (newValue && preparedFields.length === 0 && preparedFoods.length > 0) {
                appendPrepared({
                  id: Date.now(),
                  food_id: preparedFoods[0].id.toString(),
                  quantity: 1,
                  supplement_ids: []
                });
              }
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <Utensils size={18} />
              <span className="text-xs">Other</span>
            </div>
          </Button>
        </div>
        {form.formState.errors.include_insects && (
          <p className="text-sm font-medium text-destructive">{form.formState.errors.include_insects.message}</p>
        )}
      </div>

      {/* Insects Section */}
      {watchIncludeInsects && (
        <div className="space-y-2 p-3 bg-card/50 rounded-lg">
          <div className="flex justify-between items-center">
            <h4 className="font-medium text-sm">Insects/Worms</h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => appendInsect({
                id: Date.now(),
                food_id: insectFoods.length > 0 ? insectFoods[0].id.toString() : '',
                quantity: 1,
                supplement_ids: []
              })}
            >
              <Plus size={14} className="mr-1" /> Add
            </Button>
          </div>

          {insectFields.map((field, index) => (
            <FoodItemRow
              key={field.id}
              form={form}
              index={index}
              fieldArrayName="insect_items"
              foodList={insectFoods}
              supplements={supplements}
              onRemove={() => removeInsect(index)}
              canRemove={insectFields.length > 1}
              watchReptileId={watchReptileId}
              toggleReptileFavorite={toggleReptileFavorite}
              foods={foods}
            />
          ))}
          {form.formState.errors.insect_items && (
            <p className="text-sm font-medium text-destructive">{form.formState.errors.insect_items.message}</p>
          )}
        </div>
      )}

      {/* Salad Section */}
      {watchIncludeSalad && (
        <div className="space-y-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <h4 className="font-medium text-sm">Salad Components</h4>
          <div className="grid grid-cols-2 gap-1.5">
            {saladFoods.map(food => {
              const saladComponents = form.watch('salad_components') || [];
              const isChecked = saladComponents.includes(food.id);
              return (
                <label key={food.id} className="flex items-center gap-2 p-1.5 border border-border rounded cursor-pointer hover:bg-white dark:hover:bg-gray-700 text-xs">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const current = form.watch('salad_components') || [];
                      const updated = isChecked
                        ? current.filter(id => id !== food.id)
                        : [...current, food.id];
                      form.setValue('salad_components', updated);
                    }}
                    className="rounded"
                  />
                  <span className="flex items-center gap-1 truncate">
                    {food.is_reptile_favorite && <Heart size={10} className="fill-red-500 text-red-500 flex-shrink-0" />}
                    {food.name}
                  </span>
                </label>
              );
            })}
          </div>
          {form.formState.errors.salad_components && (
            <p className="text-sm font-medium text-destructive">{form.formState.errors.salad_components.message}</p>
          )}

          {/* Salad Supplements */}
          {supplements.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1.5">Salad Supplements:</p>
              <div className="flex flex-wrap gap-1">
                {supplements.map(sup => {
                  const saladSupplements = form.watch('salad_supplements') || [];
                  const isChecked = saladSupplements.includes(sup.id);
                  return (
                    <label key={sup.id} className="flex items-center gap-1 text-xs cursor-pointer py-0.5 px-1.5 rounded hover:bg-secondary">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const current = form.watch('salad_supplements') || [];
                          const updated = isChecked ? current.filter(id => id !== sup.id) : [...current, sup.id];
                          form.setValue('salad_supplements', updated);
                        }}
                        className="rounded w-3 h-3"
                      />
                      <span>{sup.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Prepared Food Section */}
      {watchIncludePrepared && (
        <div className="space-y-2 p-3 bg-card/50 rounded-lg">
          <div className="flex justify-between items-center">
            <h4 className="font-medium text-sm">Other Food</h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => appendPrepared({
                id: Date.now(),
                food_id: preparedFoods.length > 0 ? preparedFoods[0].id.toString() : '',
                quantity: 1,
                supplement_ids: []
              })}
            >
              <Plus size={14} className="mr-1" /> Add
            </Button>
          </div>

          {preparedFields.map((field, index) => (
            <FoodItemRow
              key={field.id}
              form={form}
              index={index}
              fieldArrayName="prepared_items"
              foodList={preparedFoods}
              supplements={supplements}
              onRemove={() => removePrepared(index)}
              canRemove={preparedFields.length > 1}
              watchReptileId={watchReptileId}
              toggleReptileFavorite={toggleReptileFavorite}
              foods={foods}
            />
          ))}
          {form.formState.errors.prepared_items && (
            <p className="text-sm font-medium text-destructive">{form.formState.errors.prepared_items.message}</p>
          )}
        </div>
      )}

      {/* Supplement Suggestions or Pre-filled Banner */}
      {supplementsPreFilled && originalPreFilledSupplements.length > 0 ? (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-base">ℹ️</span>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 text-sm">
                Supplements Pre-filled from Schedule
              </h4>
              <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
                Added based on your schedule's rotation rules:
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {originalPreFilledSupplements.map((suppId) => {
                  const supp = supplements.find(s => s.id === suppId);
                  return supp ? (
                    <span key={suppId} className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded text-xs font-medium">
                      {supp.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        </div>
      ) : showSuggestion && suggestedSupplements.length > 0 ? (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1">
              <span className="text-base">💡</span>
              <div className="flex-1">
                <h4 className="font-semibold text-green-900 dark:text-green-300 text-sm">
                  Supplement {suggestedSupplements.length > 1 ? 'Suggestions' : 'Suggestion'}
                </h4>
                <p className="text-xs text-green-800 dark:text-green-300 mt-1">
                  Based on rotation rules:
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {suggestedSupplements.map((suggestion, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-900 dark:text-green-100 rounded text-xs font-medium">
                        {suggestion.supplement.name}
                      </span>
                      <span className="text-xs text-green-700 dark:text-green-400">
                        (Every {suggestion.every_n_feedings})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button
                type="button"
                size="sm"
                onClick={applyAllSuggestedSupplements}
                className="bg-green-600 text-white hover:bg-green-700 text-xs px-2 py-1 h-auto"
              >
                Apply
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={dismissSuggestion}
                className="text-green-700 dark:text-green-300 px-1 py-1 h-auto"
              >
                ✕
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Global Supplements */}
      {supplements.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Global Supplements</label>
          <p className="text-xs text-muted-foreground">Applied to all food items</p>
          <div className="grid grid-cols-2 gap-1.5">
            {supplements.map(sup => {
              const globalSupplements = form.watch('global_supplements') || [];
              const isChecked = globalSupplements.includes(sup.id);
              return (
                <label key={sup.id} className="flex items-center gap-2 p-2 border border-border rounded cursor-pointer hover:bg-secondary text-sm">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const current = form.watch('global_supplements') || [];
                      const updated = isChecked ? current.filter(id => id !== sup.id) : [...current, sup.id];
                      form.setValue('global_supplements', updated);
                    }}
                    className="rounded"
                  />
                  <span>{sup.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
      </>
      )}

      {/* Date and Time */}
      <div className="grid grid-cols-2 gap-3">
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

      {/* Notes */}
      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes (optional)</FormLabel>
            <FormControl>
              <Textarea {...field} rows={2} placeholder="Any observations..." />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

// ============================================================================
// FOOD ITEM ROW COMPONENT
// ============================================================================

function FoodItemRow({
  form,
  index,
  fieldArrayName,
  foodList,
  supplements,
  onRemove,
  canRemove,
  watchReptileId,
  toggleReptileFavorite,
  foods,
}) {
  const selectedFoodId = form.watch(`${fieldArrayName}.${index}.food_id`);
  const selectedFood = foods.find(f => f.id === parseInt(selectedFoodId));
  const isReptileFavorite = selectedFood?.is_reptile_favorite || false;

  return (
    <div className="space-y-2 bg-card p-2 rounded">
      <div className="flex items-center gap-2">
        <FormField
          control={form.control}
          name={`${fieldArrayName}.${index}.food_id`}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger className="flex-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {foodList.map(food => {
                  const prefix = food.is_reptile_favorite ? '❤️ ' : (food.is_favorite ? '⭐ ' : '');
                  return (
                    <SelectItem key={food.id} value={food.id.toString()}>
                      {prefix}{food.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        />

        {watchReptileId && (
          <button
            type="button"
            onClick={() => toggleReptileFavorite(selectedFoodId)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
            title={isReptileFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart size={16} className={isReptileFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
          </button>
        )}

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              const currentQty = form.watch(`${fieldArrayName}.${index}.quantity`);
              form.setValue(`${fieldArrayName}.${index}.quantity`, Math.max(1, currentQty - 1));
            }}
          >
            -
          </Button>
          <FormField
            control={form.control}
            name={`${fieldArrayName}.${index}.quantity`}
            render={({ field }) => (
              <input
                type="number"
                value={field.value}
                onChange={(e) => field.onChange(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-12 h-8 text-center border border-border rounded text-sm bg-background text-foreground"
                min="1"
              />
            )}
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              const currentQty = form.watch(`${fieldArrayName}.${index}.quantity`);
              form.setValue(`${fieldArrayName}.${index}.quantity`, currentQty + 1);
            }}
          >
            +
          </Button>
        </div>

        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-red-600"
          >
            <X size={16} />
          </Button>
        )}
      </div>

      {/* Per-item supplements */}
      {supplements.length > 0 && (
        <div className="pl-2 border-l-2 border-border">
          <p className="text-xs text-muted-foreground mb-1">Supplements:</p>
          <div className="flex flex-wrap gap-1">
            {supplements.map(sup => {
              const supplementIds = form.watch(`${fieldArrayName}.${index}.supplement_ids`) || [];
              const isChecked = supplementIds.includes(sup.id);
              return (
                <label key={sup.id} className="flex items-center gap-1 text-xs cursor-pointer py-0.5 px-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const current = form.watch(`${fieldArrayName}.${index}.supplement_ids`) || [];
                      const updated = isChecked ? current.filter(id => id !== sup.id) : [...current, sup.id];
                      form.setValue(`${fieldArrayName}.${index}.supplement_ids`, updated);
                    }}
                    className="rounded w-3 h-3"
                  />
                  <span>{sup.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MISTING FORM COMPONENT
// ============================================================================

function MistingForm({ form }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
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

      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes (optional)</FormLabel>
            <FormControl>
              <Textarea {...field} rows={2} placeholder="Any observations..." />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

// ============================================================================
// HEALTH FORM COMPONENT
// ============================================================================

function HealthForm({
  form,
  healthLogType,
  recordType,
  measurementType,
  healthStatus,
  healthStatusLoading,
  canStartShedding,
  canCompleteShedding,
  canStartBrumation,
  canEndBrumation,
  formatCurrentStatus,
}) {
  return (
    <>
      {/* Log Type Selector */}
      <FormField
        control={form.control}
        name="health_log_type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Log Type</FormLabel>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'weight', label: 'Weight' },
                { value: 'health', label: 'Health' },
                { value: 'shedding', label: 'Shedding' },
                { value: 'brumation', label: 'Brumation' },
                { value: 'bathing', label: 'Bathing' },
                { value: 'measurement', label: 'Measurement' },
              ].map(opt => (
                <Button
                  key={opt.value}
                  type="button"
                  onClick={() => field.onChange(opt.value)}
                  variant={field.value === opt.value ? 'default' : 'outline'}
                  size="sm"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Weight Form */}
      {healthLogType === 'weight' && (
        <FormField
          control={form.control}
          name="weight_grams"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Weight (grams)</FormLabel>
              <FormControl>
                <Input {...field} type="number" step="0.1" placeholder="e.g., 125.5" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Health Record Form */}
      {healthLogType === 'health' && (
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
                  <Input {...field} placeholder="Brief description" />
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
        </>
      )}

      {/* Shedding Form */}
      {healthLogType === 'shedding' && (
        <FormField
          control={form.control}
          name="event_subtype"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Is this reptile shedding?</FormLabel>
              {formatCurrentStatus() && (
                <div className="mb-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-900 dark:text-blue-100">
                  Current status: {formatCurrentStatus()}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => field.onChange('start')}
                  disabled={!canStartShedding}
                  variant={field.value === 'start' ? 'default' : 'outline'}
                  size="sm"
                  className={!canStartShedding ? 'opacity-50' : ''}
                >
                  Yes, showing signs
                </Button>
                <Button
                  type="button"
                  onClick={() => field.onChange('check_no')}
                  variant={field.value === 'check_no' ? 'default' : 'outline'}
                  size="sm"
                >
                  No, not shedding
                </Button>
                <Button
                  type="button"
                  onClick={() => field.onChange('complete')}
                  disabled={!canCompleteShedding}
                  variant={field.value === 'complete' ? 'default' : 'outline'}
                  size="sm"
                  className={!canCompleteShedding ? 'opacity-50' : ''}
                >
                  Shed Complete
                </Button>
              </div>
              {healthStatusLoading && (
                <p className="text-sm text-muted-foreground">Loading status...</p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Brumation Form */}
      {healthLogType === 'brumation' && (
        <FormField
          control={form.control}
          name="event_subtype"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Brumation Event</FormLabel>
              {formatCurrentStatus() && (
                <div className="mb-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-900 dark:text-blue-100">
                  Current status: {formatCurrentStatus()}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => field.onChange('start')}
                  disabled={!canStartBrumation}
                  variant={field.value === 'start' ? 'default' : 'outline'}
                  size="sm"
                  className={!canStartBrumation ? 'opacity-50' : ''}
                >
                  Started Brumating
                </Button>
                <Button
                  type="button"
                  onClick={() => field.onChange('end')}
                  disabled={!canEndBrumation}
                  variant={field.value === 'end' ? 'default' : 'outline'}
                  size="sm"
                  className={!canEndBrumation ? 'opacity-50' : ''}
                >
                  Ended Brumation
                </Button>
              </div>
              {healthStatusLoading && (
                <p className="text-sm text-muted-foreground">Loading status...</p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Bathing - no extra fields needed, just date/time/notes */}
      {healthLogType === 'bathing' && (
        <p className="text-sm text-muted-foreground">
          Record a bathing session for this reptile.
        </p>
      )}

      {/* Measurement Form */}
      {healthLogType === 'measurement' && (
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
                    <Input {...field} placeholder="e.g., Tail width" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
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
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cm">cm</SelectItem>
                      <SelectItem value="mm">mm</SelectItem>
                      <SelectItem value="in">in</SelectItem>
                      <SelectItem value="%">%</SelectItem>
                      <SelectItem value="C">°C</SelectItem>
                      <SelectItem value="F">°F</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </>
      )}

      {/* Date and Time */}
      <div className="grid grid-cols-2 gap-3">
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

      {/* Notes */}
      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes (optional)</FormLabel>
            <FormControl>
              <Textarea {...field} rows={2} placeholder="Any observations..." />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

export default CreateLogModal;
