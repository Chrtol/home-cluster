import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { X, ExternalLink, Plus, Minus } from 'lucide-react';
import { formatDate } from '../../utils/dateFormatting';
import { TimePicker } from '../ui/time-picker';
import { useCreateLogModal } from '@/contexts/CreateLogModalContext';
import { useCelebrations } from '@/contexts/CelebrationContext';

/**
 * QuickLogForm - Inline quick-log form for logging tasks from the dashboard
 *
 * Displays auto-filled data from schedule instance and provides minimal input
 * for quick task completion. Offers option to open full form for detailed logging.
 *
 * Props:
 * - task: Schedule instance object with auto-fill data (from ReptileStatusCards or Timeline)
 * - onClose: Handler to close the form
 * - onSubmit: Handler for successful submission (triggers widget refresh)
 * - onOpenFull: Handler to navigate to full log view with scheduleId
 */
const QuickLogForm = ({ task, onClose, onSubmit }) => {
  const navigate = useNavigate();
  const { openCreateLog } = useCreateLogModal();
  const { triggerCelebration, celebrationsEnabled } = useCelebrations();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Food selection state (for feeding tasks)
  const [selectedFoods, setSelectedFoods] = useState([]);
  const [availableFoods, setAvailableFoods] = useState([]);
  const [foodQuantity, setFoodQuantity] = useState(1);

  // Time selection state - always use current time when form opens (Decision D-01)
  const [fedAt, setFedAt] = useState(() => new Date());

  // Weight input state (for weight_check health schedules)
  const [weightGrams, setWeightGrams] = useState('');

  // Shedding check state (for shedding_check health schedules)
  const [isShedding, setIsShedding] = useState(null); // null = not selected, true = yes, false = no

  // Brumation check state (for brumation_check health schedules)
  const [isBrumating, setIsBrumating] = useState(null); // null = not selected, true = yes, false = no

  // Measurement input state (for measurement health schedules)
  const [measurementValue, setMeasurementValue] = useState('');
  const [measurementUnit, setMeasurementUnit] = useState('');

  // Default units for measurement types
  const measurementTypeDefaults = {
    svl: 'cm',
    total_length: 'cm',
    shell_length: 'cm',
    humidity: '%',
    temperature: 'C',
  };

  // Human-readable labels for measurement types
  const measurementTypeLabels = {
    svl: 'Snout-Vent Length',
    total_length: 'Total Length',
    shell_length: 'Shell Length',
    humidity: 'Humidity',
    temperature: 'Temperature',
    temp: 'Temperature',
    custom: 'Custom Measurement',
  };

  // Set default unit when task loads for measurement schedules
  useEffect(() => {
    if (task?.health_subtype === 'measurement' && task?.measurement_type) {
      const defaultUnit = measurementTypeDefaults[task.measurement_type.toLowerCase()];
      if (defaultUnit && !measurementUnit) {
        setMeasurementUnit(defaultUnit);
      }
    }
  }, [task]);

  // REMOVED: Per D-01, we want current time, not schedule time
  // The useEffect that updated fedAt from task.scheduled_date has been removed
  // Form now snapshots new Date() once when it opens (D-02)

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch available foods for feeding tasks
  useEffect(() => {
    const fetchFoods = async () => {
      const scheduleType = task?.schedule_type || task?.type;
      if (scheduleType !== 'feeding') return;

      try {
        const reptileId = task.reptile_id || task.reptile?.id;

        // Get foods with reptile_id to include is_reptile_favorite status
        const foodsUrl = reptileId ? `/api/foods?reptile_id=${reptileId}` : '/api/foods';
        const foodsRes = await axios.get(foodsUrl);
        let foods = foodsRes.data;

        // Filter by food_category if specified in schedule
        // Normalize categories by lowercasing and removing trailing 's' (backend does same)
        const normalizeCategory = (cat) => {
          if (!cat) return '';
          return cat.toLowerCase().replace(/s$/, '');
        };

        // Map common aliases to actual food categories
        const categoryAliases = {
          'salad': 'vegetable',
          'greens': 'vegetable',
          'veggies': 'vegetable',
          'veg': 'vegetable',
          'bug': 'insect',
          'cricket': 'insect',
          'roach': 'insect',
          'dubia': 'insect',
          'worm': 'worm',
          'mealworm': 'worm',
          'superworm': 'worm',
          'mice': 'frozen_animal',
          'mouse': 'frozen_animal',
          'rat': 'frozen_animal',
          'pinkie': 'frozen_animal',
          'fuzzy': 'frozen_animal',
          'rodent': 'frozen_animal',
        };

        const foodCategory = task?.food_category;
        if (foodCategory) {
          const normalizedScheduleCategory = normalizeCategory(foodCategory);
          // Check if there's an alias mapping
          const mappedCategory = categoryAliases[normalizedScheduleCategory] || normalizedScheduleCategory;

          const filtered = foods.filter(f => {
            const normalizedFoodCategory = normalizeCategory(f.category);
            // Match either the original or mapped category
            return normalizedFoodCategory === normalizedScheduleCategory ||
                   normalizedFoodCategory === mappedCategory;
          });
          // Only apply filter if it matches at least one food
          if (filtered.length > 0) {
            foods = filtered;
          }
        }

        // Sort: reptile favorites first (❤️), then global favorites (⭐), then alphabetically
        foods.sort((a, b) => {
          // Reptile favorites first
          if (a.is_reptile_favorite && !b.is_reptile_favorite) return -1;
          if (!a.is_reptile_favorite && b.is_reptile_favorite) return 1;
          // Then global favorites
          if (a.is_favorite && !b.is_favorite) return -1;
          if (!a.is_favorite && b.is_favorite) return 1;
          // Then alphabetically
          return a.name.localeCompare(b.name);
        });

        setAvailableFoods(foods);

        // Auto-select default food if set on reptile (per D-07)
        if (reptileId && foods.length > 0) {
          try {
            const reptileRes = await axios.get(`/api/reptiles/${reptileId}`);
            const reptile = reptileRes.data;

            // Check food_category from schedule to decide which default to use
            const category = task?.food_category?.toLowerCase();
            let defaultFoodId = null;

            if (category === 'insect' || category === 'insects') {
              defaultFoodId = reptile.default_insect_id;
            } else if (category === 'prepared' || category === 'other') {
              defaultFoodId = reptile.default_prepared_id;
            } else {
              // No specific category - prefer insect default, fallback to prepared
              defaultFoodId = reptile.default_insect_id || reptile.default_prepared_id;
            }

            if (defaultFoodId) {
              const defaultFood = foods.find(f => f.id === defaultFoodId);
              // Only auto-select if no foods already selected (don't override user selection)
              if (defaultFood && selectedFoods.length === 0) {
                setSelectedFoods([defaultFood]);
              }
            }
          } catch (err) {
            console.error('Failed to fetch reptile for default food:', err);
          }
        }
      } catch (err) {
        console.error('Failed to fetch foods:', err);
      }
    };

    fetchFoods();
  }, [task]);

  // Determine task type for navigation
  const getFullFormPath = () => {
    if (!task) return '/';

    const scheduleType = task.schedule_type || task.type;
    const reptileId = task.reptile_id || task.reptile?.id;
    const instanceId = task.instance_id || task.id;

    if (scheduleType === 'feeding') {
      const queryParam = instanceId ? `instance_id=${instanceId}` : (reptileId ? `reptile_id=${reptileId}` : '');
      return `/feed${queryParam ? `?${queryParam}` : ''}`;
    } else if (scheduleType === 'misting') {
      const queryParam = instanceId ? `instance_id=${instanceId}` : (reptileId ? `reptile_id=${reptileId}` : '');
      return `/misting-log${queryParam ? `?${queryParam}` : ''}`;
    } else if (scheduleType === 'health') {
      // Build params based on health_subtype
      const params = new URLSearchParams();
      if (instanceId) params.set('instance_id', instanceId);
      else if (reptileId) params.set('reptile_id', reptileId);

      // Pre-fill based on health_subtype
      const healthSubtype = task?.health_subtype;
      if (healthSubtype) {
        // Map health_subtype to log_type
        const logTypeMap = {
          'weight': 'weight',
          'measurement': 'measurement',
          'shedding_check': 'shedding',
          'brumation_check': 'brumation',
          'health_record': 'health',
          'bathing': 'health'
        };
        params.set('log_type', logTypeMap[healthSubtype] || 'health');

        // Add measurement_type for measurement schedules
        if (healthSubtype === 'measurement' && task?.measurement_type) {
          params.set('measurement_type', task.measurement_type);
        }

        // Add record_type for health_record and bathing
        if (healthSubtype === 'health_record' && task?.health_category) {
          params.set('record_type', task.health_category);
        }
        if (healthSubtype === 'bathing') {
          params.set('record_type', 'bathing');
        }
      }

      return `/health-log?${params.toString()}`;
    }

    // Default to reptile page if no specific form
    return reptileId ? `/reptiles/${reptileId}` : '/';
  };

  const handleOpenFull = () => {
    // Try to open modal first, fall back to navigation
    const scheduleType = task?.schedule_type || task?.type;
    const reptileId = task?.reptile_id || task?.reptile?.id;
    const healthSubtype = task?.health_subtype;
    const instanceId = task?.instance_id || task?.id;

    // Map schedule type to log type
    let logType = scheduleType;
    if (scheduleType === 'health') {
      if (healthSubtype === 'weight') logType = 'weight';
      else if (healthSubtype === 'measurement') logType = 'measurement';
      else logType = 'health';
    }

    // Build prefill from task data - include supplements for pre-fill
    const prefill = {
      instance_id: instanceId,
      scheduled_date: task?.scheduled_date,
      supplements: task?.supplements || [],
      health_subtype: healthSubtype,
      measurement_type: task?.measurement_type,
      food_category: task?.food_category,
      notes: task?.notes || notes,
    };

    // Try opening modal, if not available navigate to page
    const opened = openCreateLog(logType, reptileId, prefill);
    if (opened) {
      onClose?.(); // Close quick log form
    } else {
      navigate(getFullFormPath());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!task) return;

    const scheduleType = task.schedule_type || task.type;
    const healthSubtype = task?.health_subtype;

    // Validate shedding_check selection
    if (scheduleType === 'health' && healthSubtype === 'shedding_check' && isShedding === null) {
      setError('Please select whether reptile is showing signs of shedding');
      return;
    }

    // Validate brumation_check selection
    if (scheduleType === 'health' && healthSubtype === 'brumation_check' && isBrumating === null) {
      setError('Please select whether reptile is entering brumation');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const scheduleType = task.schedule_type || task.type;
      const reptileId = task.reptile_id || task.reptile?.id;

      if (!reptileId) {
        throw new Error('Missing reptile ID');
      }

      // Determine the correct API endpoint and payload based on task type
      let endpoint = '';
      let payload = {};

      if (scheduleType === 'feeding') {
        endpoint = '/api/feedings';
        payload = {
          reptile_id: reptileId,
          fed_at: fedAt.toISOString(),
          foods: selectedFoods.map(f => ({
            food_id: f.id,
            quantity: foodQuantity
          })),
          supplements: [], // Global supplements
          is_salad: false,
          salad_components: [],
          notes: notes.trim() || null
        };
      } else if (scheduleType === 'misting') {
        endpoint = '/api/misting';
        payload = {
          reptile_id: reptileId,
          misted_at: fedAt.toISOString(),
          notes: notes.trim() || null
        };
      } else if (scheduleType === 'health') {
        const healthSubtype = task?.health_subtype;

        // Route based on health_subtype
        if (healthSubtype === 'weight') {
          // Weight logs with weight input
          if (!weightGrams || parseFloat(weightGrams) <= 0) {
            setError('Please enter a weight value');
            setSubmitting(false);
            return;
          }
          endpoint = '/api/weight';
          payload = {
            reptile_id: reptileId,
            weight_grams: parseFloat(weightGrams),
            weighed_at: fedAt.toISOString(),
            notes: notes.trim() || null
          };
        } else if (healthSubtype === 'shedding_check') {
          // Shedding check - ALWAYS create a record for audit trail
          // First, create the shedding check record
          endpoint = '/api/health';
          payload = {
            reptile_id: reptileId,
            record_type: 'shedding_check',
            title: isShedding ? 'Shedding Check: Yes' : 'Shedding Check: No',
            description: notes.trim() || null,
            date: fedAt.toISOString()
          };

          // Post the shedding check record
          await axios.post(endpoint, payload);

          // If yes, ALSO create a shedding start event to begin the shed cycle
          if (isShedding) {
            await axios.post('/api/health', {
              reptile_id: reptileId,
              record_type: 'shedding',
              event_type: 'start',
              title: 'Started Shedding',
              description: 'Triggered from shedding check',
              date: fedAt.toISOString()
            });
          }

          // Trigger celebration after API success (per D-12)
          if (celebrationsEnabled) {
            try {
              const streakRes = await axios.get('/api/user-streaks/me');
              const totalTasks = streakRes.data.total_tasks_completed || 0;
              triggerCelebration(totalTasks - 1, totalTasks);
            } catch (err) {
              console.debug('Could not fetch streak for celebration:', err);
            }
          }

          // Call success handler and close (we already posted, so skip the final post)
          if (onSubmit) {
            await onSubmit();
          }
          onClose();
          return;
        } else if (healthSubtype === 'brumation_check') {
          // Brumation check - ALWAYS create a record for audit trail
          endpoint = '/api/health';
          payload = {
            reptile_id: reptileId,
            record_type: 'brumation_check',
            title: isBrumating ? 'Brumation Check: Yes' : 'Brumation Check: No',
            description: notes.trim() || null,
            date: fedAt.toISOString()
          };

          // Post the brumation check record
          await axios.post(endpoint, payload);

          // If yes, ALSO create a brumation start event
          if (isBrumating) {
            await axios.post('/api/health', {
              reptile_id: reptileId,
              record_type: 'brumation',
              event_type: 'start',
              title: 'Started Brumation',
              description: 'Triggered from brumation check',
              date: fedAt.toISOString()
            });
          }

          // Trigger celebration after API success (per D-12)
          if (celebrationsEnabled) {
            try {
              const streakRes = await axios.get('/api/user-streaks/me');
              const totalTasks = streakRes.data.total_tasks_completed || 0;
              triggerCelebration(totalTasks - 1, totalTasks);
            } catch (err) {
              console.debug('Could not fetch streak for celebration:', err);
            }
          }

          // Call success handler and close (we already posted, so skip the final post)
          if (onSubmit) {
            await onSubmit();
          }
          onClose();
          return;
        } else if (healthSubtype === 'measurement') {
          // Measurement logs with value input
          if (!measurementValue || parseFloat(measurementValue) <= 0) {
            setError('Please enter a measurement value');
            setSubmitting(false);
            return;
          }
          if (!measurementUnit) {
            setError('Please select a unit');
            setSubmitting(false);
            return;
          }
          endpoint = '/api/measurements';
          payload = {
            reptile_id: reptileId,
            measurement_type: task.measurement_type?.toLowerCase() || 'custom',
            value: parseFloat(measurementValue),
            unit: measurementUnit,
            measured_at: fedAt.toISOString(),
            notes: notes.trim() || null
          };
        } else if (healthSubtype === 'bathing') {
          endpoint = '/api/health';
          payload = {
            reptile_id: reptileId,
            record_type: 'bathing',
            title: 'Bathing',
            description: notes.trim() || null,
            date: fedAt.toISOString()
          };
        } else if (healthSubtype === 'health_record') {
          // Health record - use health_category from schedule if available
          const healthCategory = task?.health_category || 'observation';
          const titleMap = {
            'medication': 'Medication',
            'observation': 'Health Observation',
            'vet_visit': 'Vet Visit',
            'bowel_movement': 'Bowel Movement'
          };
          endpoint = '/api/health';
          payload = {
            reptile_id: reptileId,
            record_type: healthCategory,
            title: titleMap[healthCategory] || 'Health Record',
            description: notes.trim() || null,
            date: fedAt.toISOString()
          };
        } else {
          // Default fallback for unknown subtypes
          endpoint = '/api/health';
          payload = {
            reptile_id: reptileId,
            record_type: 'observation',
            title: 'Health Observation',
            description: notes.trim() || null,
            date: fedAt.toISOString()
          };
        }
      } else {
        // Unsupported task type - show error
        throw new Error(`Unsupported task type: ${scheduleType}. Please use the full form.`);
      }

      await axios.post(endpoint, payload);

      // Trigger celebration after API success (per D-12)
      if (celebrationsEnabled) {
        try {
          const streakRes = await axios.get('/api/user-streaks/me');
          const totalTasks = streakRes.data.total_tasks_completed || 0;
          triggerCelebration(totalTasks - 1, totalTasks);
        } catch (err) {
          console.debug('Could not fetch streak for celebration:', err);
        }
      }

      // Call success handler to refresh widgets
      if (onSubmit) {
        await onSubmit();
      }

      onClose();
    } catch (err) {
      console.error('Failed to log task:', err);
      setError(err.response?.data?.message || err.message || 'Failed to log task. Please try again.');
      setSubmitting(false);
    }
  };

  if (!task) return null;

  const scheduleType = task.schedule_type || task.type || 'task';
  const reptileName = task.reptile_name || task.name || 'Unknown';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-card rounded-lg shadow-xl max-w-md w-full animate-in fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Quick Log</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {reptileName} • {scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Auto-filled data display */}
          {(task.food_category || (task.supplements && task.supplements.length > 0)) && (
            <div className="bg-muted rounded p-2 space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Auto-filled from schedule</p>

              {task.food_category && (
                <div className="text-xs text-foreground">
                  <span className="text-muted-foreground">Food:</span> {task.food_category.charAt(0).toUpperCase() + task.food_category.slice(1)}
                </div>
              )}

              {task.supplements && task.supplements.length > 0 && (
                <div className="text-xs text-foreground">
                  <span className="text-muted-foreground">Supplements:</span> {task.supplements.map(s => typeof s === 'string' ? s : s.name).join(', ')}
                </div>
              )}

              {task.time_window && (
                <div className="text-xs text-foreground">
                  <span className="text-muted-foreground">Time:</span> {task.time_window}
                </div>
              )}
            </div>
          )}

          {/* Food selector for feeding tasks */}
          {scheduleType === 'feeding' && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Food Item
              </label>
              <select
                value={selectedFoods[0]?.id || ''}
                onChange={(e) => {
                  const food = availableFoods.find(f => f.id === parseInt(e.target.value));
                  if (food) setSelectedFoods([food]);
                }}
                className="w-full px-2 py-1.5 bg-muted border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="">Select food...</option>
                {availableFoods.map(food => {
                  const prefix = food.is_reptile_favorite ? '❤️ ' : (food.is_favorite ? '⭐ ' : '');
                  return (
                    <option key={food.id} value={food.id}>
                      {prefix}{food.name}
                    </option>
                  );
                })}
              </select>

              {selectedFoods.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Quantity:</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFoodQuantity(prev => Math.max(1, prev - 1))}
                      className="w-7 h-7 flex items-center justify-center bg-muted hover:bg-muted/80 border border-border rounded text-foreground transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={foodQuantity}
                      onChange={(e) => setFoodQuantity(parseInt(e.target.value) || 1)}
                      className="w-14 px-2 py-1 bg-muted border border-border rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setFoodQuantity(prev => prev + 1)}
                      className="w-7 h-7 flex items-center justify-center bg-muted hover:bg-muted/80 border border-border rounded text-foreground transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Weight input for weight_check health schedules */}
          {scheduleType === 'health' && task?.health_subtype === 'weight' && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Weight (grams)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={weightGrams}
                onChange={(e) => setWeightGrams(e.target.value)}
                placeholder="Enter weight in grams"
                className="w-full px-2 py-1.5 bg-muted border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoFocus
              />
            </div>
          )}

          {/* Measurement input for measurement health schedules */}
          {scheduleType === 'health' && task?.health_subtype === 'measurement' && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-foreground">
                {measurementTypeLabels[task.measurement_type?.toLowerCase()] || task.measurement_type?.replace('_', ' ') || 'Measurement'}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={measurementValue}
                  onChange={(e) => setMeasurementValue(e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-2 py-1.5 bg-muted border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  autoFocus
                />
                <select
                  value={measurementUnit}
                  onChange={(e) => setMeasurementUnit(e.target.value)}
                  className="w-20 px-2 py-1.5 bg-muted border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="">Unit</option>
                  <option value="cm">cm</option>
                  <option value="mm">mm</option>
                  <option value="in">in</option>
                  <option value="%">%</option>
                  <option value="C">°C</option>
                  <option value="F">°F</option>
                </select>
              </div>
            </div>
          )}

          {/* Health record type display */}
          {scheduleType === 'health' && task?.health_subtype === 'health_record' && (
            <div className="bg-muted rounded p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Record Type</p>
              <p className="text-xs text-foreground capitalize">
                {(task.health_category || 'observation').replace('_', ' ')}
              </p>
            </div>
          )}

          {/* Time picker */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Time
            </label>
            <div className="flex items-center gap-2">
              <TimePicker
                value={fedAt.toTimeString().slice(0, 5)}
                onChange={(timeStr) => {
                  const [hours, minutes] = timeStr.split(':');
                  const newDate = new Date();
                  newDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                  setFedAt(newDate);
                }}
                step={15}
                className="h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">
                {formatDate(fedAt)}
              </span>
            </div>
          </div>

          {/* Notes input */}
          <div>
            <label htmlFor="quick-notes" className="block text-xs font-medium text-foreground mb-1">
              Notes (optional)
            </label>
            <textarea
              id="quick-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any quick notes..."
              rows={2}
              className="w-full px-2 py-1.5 bg-muted border border-border rounded text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none"
            />
          </div>

          {/* Shedding check - Yes/No selection */}
          {scheduleType === 'health' && task?.health_subtype === 'shedding_check' && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-2">
                Is {reptileName} showing signs of shedding?
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsShedding(true)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded border transition-colors ${
                    isShedding === true
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-muted text-foreground border-border hover:bg-muted/80'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsShedding(false)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded border transition-colors ${
                    isShedding === false
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-foreground border-border hover:bg-muted/80'
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          )}

          {/* Brumation check - Yes/No selection */}
          {scheduleType === 'health' && task?.health_subtype === 'brumation_check' && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-2">
                Is {reptileName} entering brumation?
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsBrumating(true)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded border transition-colors ${
                    isBrumating === true
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-muted text-foreground border-border hover:bg-muted/80'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsBrumating(false)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded border transition-colors ${
                    isBrumating === false
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-foreground border-border hover:bg-muted/80'
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleOpenFull}
              className="text-xs text-primary hover:text-primary-light flex items-center gap-1 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Open full form
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Logging...' : 'Log Task'}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
              {error}
            </div>
          )}
        </form>
      </div>

    </div>
  );
};

export default QuickLogForm;
