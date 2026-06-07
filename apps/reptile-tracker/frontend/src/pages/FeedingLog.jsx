import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { Leaf, Bug, Utensils, Plus, X, Edit2, Trash2, Calendar, Heart, Star } from 'lucide-react';
import { getUserTimeFormat, formatDateTime } from '../utils/dateFormatting';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { Textarea } from '@/components/ui/textarea';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import { notifyStreakAttribution } from '@/components/UserStreakDisplay';
import { useConfetti } from '../hooks/useConfetti';
import ConfettiDismissOverlay from '../components/ConfettiDismissOverlay';
import { useCelebrations } from '@/contexts/CelebrationContext';
import { toast } from 'sonner';
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

// Zod schema for feeding form
const feedingSchema = z.object({
  reptile_id: z.string().min(1, 'Please select a reptile'),
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
}).refine(data => data.include_insects || data.include_salad || data.include_prepared, {
  message: 'Please select at least one feeding type',
  path: ['include_insects']
}).refine(data => !data.include_insects || data.insect_items.length > 0, {
  message: 'Please add at least one insect item or uncheck Insects',
  path: ['insect_items']
}).refine(data => !data.include_salad || data.salad_components.length > 0, {
  message: 'Please select at least one salad component or uncheck Salad',
  path: ['salad_components']
}).refine(data => !data.include_prepared || data.prepared_items.length > 0, {
  message: 'Please add at least one prepared food item or uncheck Prepared Food',
  path: ['prepared_items']
});

export default function FeedingLog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { triggerSubtle, isActive, dismiss } = useConfetti();
  const { triggerCelebration, celebrationsEnabled } = useCelebrations();

  // Mode state
  const [mode, setMode] = useState('create'); // create, view, edit
  const [existingFeeding, setExistingFeeding] = useState(null);

  // Data state
  const [reptiles, setReptiles] = useState([]);
  const [foods, setFoods] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Show favorites only filters
  const [showOnlyFavoriteInsects, setShowOnlyFavoriteInsects] = useState(false);
  const [showOnlyFavoriteSalad, setShowOnlyFavoriteSalad] = useState(false);
  const [showOnlyFavoritePrepared, setShowOnlyFavoritePrepared] = useState(false);

  // Suggested supplements from rotation rules
  const [suggestedSupplements, setSuggestedSupplements] = useState([]);
  const [showSuggestion, setShowSuggestion] = useState(false);

  // Track if supplements were pre-filled from a schedule instance
  const [supplementsPreFilled, setSupplementsPreFilled] = useState(false);
  const [originalPreFilledSupplements, setOriginalPreFilledSupplements] = useState([]);

  // User preferences
  const [showFavoritesFirst, setShowFavoritesFirst] = useState(true);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewModeSuccess, setViewModeSuccess] = useState('');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Initialize form
  const form = useForm({
    resolver: zodResolver(feedingSchema),
    defaultValues: {
      reptile_id: '',
      fed_date: new Date().toISOString().slice(0, 10),
      fed_time: new Date().toTimeString().slice(0, 5),
      notes: '',
      include_insects: true,
      include_salad: false,
      include_prepared: false,
      insect_items: [],
      salad_components: [],
      salad_supplements: [],
      prepared_items: [],
      global_supplements: []
    }
  });

  // Field arrays for dynamic food items
  const { fields: insectFields, append: appendInsect, remove: removeInsect } = useFieldArray({
    control: form.control,
    name: 'insect_items'
  });

  const { fields: preparedFields, append: appendPrepared, remove: removePrepared } = useFieldArray({
    control: form.control,
    name: 'prepared_items'
  });

  // Watch form values for conditional rendering
  const watchReptileId = useWatch({ control: form.control, name: 'reptile_id' });
  const watchIncludeInsects = useWatch({ control: form.control, name: 'include_insects' });
  const watchIncludeSalad = useWatch({ control: form.control, name: 'include_salad' });
  const watchIncludePrepared = useWatch({ control: form.control, name: 'include_prepared' });
  const watchFedDate = useWatch({ control: form.control, name: 'fed_date' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reptilesRes, foodsRes, supplementsRes, userRes] = await Promise.all([
          axios.get('/api/reptiles'),
          axios.get('/api/foods'),
          axios.get('/api/supplements'),
          axios.get('/auth/me'),
        ]);
        setReptiles(reptilesRes.data);
        setFoods(foodsRes.data);
        setSupplements(supplementsRes.data);

        // Load user preference for showing favorites first
        if (userRes.data.show_favorites_first !== undefined) {
          setShowFavoritesFirst(userRes.data.show_favorites_first);
        }

        // Check if we're viewing/editing an existing feeding
        if (id && !isNaN(id)) {
          try {
            const feedingRes = await axios.get(`/api/feedings/${id}`);
            setExistingFeeding(feedingRes.data);
            setMode('view');
            loadFeedingData(feedingRes.data, foodsRes.data);

            // Check for success query parameter
            const successParam = searchParams.get('success');
            if (successParam === 'created') {
              setViewModeSuccess('Feeding logged successfully!');
              const newUrl = window.location.pathname;
              window.history.replaceState({}, '', newUrl);
              setTimeout(() => setViewModeSuccess(''), 5000);
            }
          } catch (err) {
            console.error('Failed to load feeding:', err);
            setError('Failed to load feeding. It may not exist or you may not have permission.');
          }
        } else {
          // Creating new feeding - handle pre-fill
          const scheduleId = searchParams.get('schedule_id');
          const instanceId = searchParams.get('instance_id');

          let reptilePreFilled = false;

          // Check if we have an instance_id query parameter (preferred over schedule_id)
          if (instanceId) {
            try {
              const instanceRes = await axios.get(`/api/schedule-instances/${instanceId}`);
              const instance = instanceRes.data;
              const schedule = instance.schedule;

              // Pre-fill reptile
              if (schedule?.reptile_id) {
                form.setValue('reptile_id', schedule.reptile_id.toString());
                reptilePreFilled = true;
              }

              // Pre-fill date from instance
              if (instance.scheduled_date) {
                form.setValue('fed_date', instance.scheduled_date);
              }

              // Pre-fill food category toggles based on schedule
              if (schedule?.food_category) {
                if (schedule.food_category === 'insects') {
                  form.setValue('include_insects', true);
                  form.setValue('include_salad', false);
                  form.setValue('include_prepared', false);
                } else if (schedule.food_category === 'salad') {
                  form.setValue('include_insects', false);
                  form.setValue('include_salad', true);
                  form.setValue('include_prepared', false);
                } else if (schedule.food_category === 'prepared') {
                  form.setValue('include_insects', false);
                  form.setValue('include_salad', false);
                  form.setValue('include_prepared', true);
                }
              }

              // Pre-fill supplements from pre-calculated instance supplements
              if (instance.supplements && instance.supplements.length > 0) {
                const suppIds = instance.supplements.map(s => s.id);
                form.setValue('global_supplements', suppIds);
                setOriginalPreFilledSupplements(suppIds);
                setSupplementsPreFilled(true);
              }
            } catch (instanceErr) {
              console.error('Failed to load instance for pre-fill:', instanceErr);
            }
          } else if (scheduleId) {
            // Fallback to schedule_id if no instance_id
            try {
              const scheduleRes = await axios.get(`/api/schedules/${scheduleId}`);
              const schedule = scheduleRes.data;

              // Pre-fill reptile
              if (schedule.reptile_id) {
                form.setValue('reptile_id', schedule.reptile_id.toString());
                reptilePreFilled = true;
              }

              // Pre-fill food category toggles based on schedule
              if (schedule.food_category) {
                if (schedule.food_category === 'insects') {
                  form.setValue('include_insects', true);
                  form.setValue('include_salad', false);
                  form.setValue('include_prepared', false);
                } else if (schedule.food_category === 'salad') {
                  form.setValue('include_insects', false);
                  form.setValue('include_salad', true);
                  form.setValue('include_prepared', false);
                } else if (schedule.food_category === 'prepared') {
                  form.setValue('include_insects', false);
                  form.setValue('include_salad', false);
                  form.setValue('include_prepared', true);
                }
              }
            } catch (scheduleErr) {
              console.error('Failed to load schedule for pre-fill:', scheduleErr);
            }
          }

          // Initialize with default reptile only if we didn't pre-fill from a schedule
          if (!reptilePreFilled && reptilesRes.data.length > 0) {
            form.setValue('reptile_id', reptilesRes.data[0].id.toString());
          }

          // Start with one insect item if insects are enabled and no items exist
          if (form.getValues('include_insects') && insectFields.length === 0) {
            const insectFoods = foodsRes.data.filter(f => f.category === 'insect');
            if (insectFoods.length > 0) {
              appendInsect({
                id: Date.now(),
                food_id: insectFoods[0].id.toString(),
                quantity: 1,
                supplement_ids: []
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, searchParams]);

  // Refetch foods when selected reptile changes
  useEffect(() => {
    const refetchFoods = async () => {
      if (watchReptileId) {
        try {
          const foodsRes = await axios.get(`/api/foods?reptile_id=${watchReptileId}`);
          setFoods(foodsRes.data);
        } catch (error) {
          console.error('Failed to refetch foods:', error);
        }
      }
    };
    refetchFoods();
  }, [watchReptileId]);

  // Pre-select default foods when reptile is selected (only in create mode)
  useEffect(() => {
    if (!watchReptileId || mode === 'edit' || mode === 'view') return;

    const selectedReptileData = reptiles.find(r => r.id === parseInt(watchReptileId));
    if (!selectedReptileData) return;

    // Set default insect if configured and insects are enabled
    if (selectedReptileData.default_insect_id && watchIncludeInsects) {
      // Replace existing items with default
      const currentItems = form.getValues('insect_items') || [];
      // Only update if current items are empty or contain the initial placeholder
      if (currentItems.length === 0 || (currentItems.length === 1 && currentItems[0].food_id !== selectedReptileData.default_insect_id.toString())) {
        form.setValue('insect_items', [{
          id: Date.now(),
          food_id: selectedReptileData.default_insect_id.toString(),
          quantity: 1,
          supplement_ids: []
        }]);
      }
    }

    // Set default prepared food if configured and prepared is enabled
    if (selectedReptileData.default_prepared_id && watchIncludePrepared) {
      // Replace existing items with default
      const currentItems = form.getValues('prepared_items') || [];
      // Only update if current items are empty or contain the initial placeholder
      if (currentItems.length === 0 || (currentItems.length === 1 && currentItems[0].food_id !== selectedReptileData.default_prepared_id.toString())) {
        form.setValue('prepared_items', [{
          id: Date.now(),
          food_id: selectedReptileData.default_prepared_id.toString(),
          quantity: 1,
          supplement_ids: []
        }]);
      }
    }
  }, [watchReptileId, watchIncludeInsects, watchIncludePrepared, mode, reptiles, foods]);

  // Fetch supplement suggestion when reptile or food types change
  useEffect(() => {
    const fetchSuggestion = async () => {
      if (!watchReptileId || mode === 'view' || mode === 'edit' || supplementsPreFilled) return;

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
  }, [watchReptileId, watchIncludeInsects, watchIncludeSalad, watchIncludePrepared, supplements, mode, watchFedDate, supplementsPreFilled]);

  const applyAllSuggestedSupplements = () => {
    const currentSupplements = form.getValues('global_supplements');
    const newSupplementIds = suggestedSupplements
      .map(s => s.supplement_id)
      .filter(id => !currentSupplements.includes(id));

    if (newSupplementIds.length > 0) {
      form.setValue('global_supplements', [...currentSupplements, ...newSupplementIds]);
    }
    setShowSuggestion(false);
  };

  const dismissSuggestion = () => {
    setShowSuggestion(false);
  };

  const loadFeedingData = (feeding, foodsList) => {
    form.setValue('reptile_id', feeding.reptile_id.toString());
    form.setValue('notes', feeding.notes || '');
    form.setValue('global_supplements', feeding.supplements?.map(s => s.id) || []);

    // Parse the fed_at datetime
    const fedAtDate = new Date(feeding.fed_at);
    form.setValue('fed_date', fedAtDate.toISOString().slice(0, 10));
    form.setValue('fed_time', `${String(fedAtDate.getHours()).padStart(2, '0')}:${String(fedAtDate.getMinutes()).padStart(2, '0')}`);

    // Determine which food types are included
    const insects = [];
    const prepared = [];
    let hasSalad = false;

    feeding.foods?.forEach(food => {
      const foodData = foodsList.find(f => f.id === food.id);
      if (!foodData) return;

      if (food.name === 'Salad' && feeding.is_salad) {
        hasSalad = true;
        form.setValue('salad_supplements', food.supplements?.map(s => s.id) || []);
      } else if (foodData.category === 'insect') {
        insects.push({
          id: Date.now() + Math.random(),
          food_id: food.id.toString(),
          quantity: food.quantity || 1,
          supplement_ids: food.supplements?.map(s => s.id) || []
        });
      } else if (foodData.category === 'prepared') {
        prepared.push({
          id: Date.now() + Math.random(),
          food_id: food.id.toString(),
          quantity: food.quantity || 1,
          supplement_ids: food.supplements?.map(s => s.id) || []
        });
      }
    });

    // Set food type toggles
    form.setValue('include_insects', insects.length > 0);
    form.setValue('include_salad', hasSalad);
    form.setValue('include_prepared', prepared.length > 0);

    // Set food items
    if (insects.length > 0) form.setValue('insect_items', insects);
    if (prepared.length > 0) form.setValue('prepared_items', prepared);
    if (hasSalad) form.setValue('salad_components', feeding.salad_components?.map(sc => sc.id) || []);
  };

  // Quick add to reptile favorites
  const toggleReptileFavorite = async (foodId) => {
    if (!watchReptileId) {
      toast.warning('Please select a reptile first');
      return;
    }

    const food = foods.find(f => f.id === parseInt(foodId));
    if (!food) return;

    const isCurrentlyFavorite = food.is_reptile_favorite || false;

    try {
      if (isCurrentlyFavorite) {
        await axios.delete(`/api/reptiles/${watchReptileId}/favorite-foods/${foodId}`);
      } else {
        await axios.post(`/api/reptiles/${watchReptileId}/favorite-foods/${foodId}`);
      }

      // Update local state
      setFoods(foods.map(f =>
        f.id === parseInt(foodId) ? { ...f, is_reptile_favorite: !isCurrentlyFavorite } : f
      ));
    } catch (error) {
      console.error('Failed to toggle reptile favorite:', error);
      toast.error('Failed to update favorite status');
    }
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const executeDelete = async () => {
    setDeleteDialogOpen(false);

    try {
      await axios.delete(`/api/feedings/${id}`);
      setSuccess('Feeding deleted successfully!');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      console.error('Failed to delete feeding:', err);
      setError(err.response?.data?.detail || 'Failed to delete feeding. You may not have permission.');
    }
  };

  const onSubmit = async (data) => {
    setError('');
    setSuccess('');

    // Construct ISO 8601 datetime WITH local timezone offset
    const [year, month, day] = data.fed_date.split('-').map(Number);
    const [hour, minute] = data.fed_time.split(':').map(Number);
    const localDate = new Date(year, month - 1, day, hour, minute, 0);

    const tzOffset = -localDate.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(tzOffset) / 60);
    const offsetMinutes = Math.abs(tzOffset) % 60;
    const offsetSign = tzOffset >= 0 ? '+' : '-';
    const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;

    const fedAtISO = `${data.fed_date}T${data.fed_time}:00${offsetString}`;

    let payload = {
      reptile_id: parseInt(data.reptile_id),
      fed_at: fedAtISO,
      notes: data.notes || '',
      is_salad: data.include_salad,
      foods: [],
      supplements: data.global_supplements,
      salad_components: []
    };

    // Add insect foods with per-item supplements
    if (data.include_insects) {
      payload.foods.push(...data.insect_items.map(item => ({
        food_id: parseInt(item.food_id),
        quantity: item.quantity,
        supplement_ids: item.supplement_ids || []
      })));
    }

    // Add prepared foods with per-item supplements
    if (data.include_prepared) {
      payload.foods.push(...data.prepared_items.map(item => ({
        food_id: parseInt(item.food_id),
        quantity: item.quantity,
        supplement_ids: item.supplement_ids || []
      })));
    }

    // Add salad with per-salad supplements
    if (data.include_salad) {
      const saladFood = foods.find(f => f.name === 'Salad');
      if (!saladFood) {
        setError("Salad food item not found. Please create it in Food Management.");
        return;
      }

      payload.foods.push({
        food_id: saladFood.id,
        quantity: 1,
        supplement_ids: data.salad_supplements || []
      });
      payload.salad_components = data.salad_components;
    }

    try {
      if (mode === 'edit') {
        await axios.put(`/api/feedings/${id}`, payload);
        setSuccess('Feeding updated successfully!');
        setMode('view');
        // Reload the feeding data
        const feedingRes = await axios.get(`/api/feedings/${id}`);
        setExistingFeeding(feedingRes.data);
        loadFeedingData(feedingRes.data, foods);
      } else {
        const response = await axios.post('/api/feedings', payload);

        // Dispatch attribution event if completing for another user
        if (response.data.attribution) {
          notifyStreakAttribution(response.data.attribution);
        }

        // Trigger celebration after API success (per D-12, D-13)
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

        triggerSubtle();
        setSuccess('Feeding logged successfully!');
        setTimeout(() => navigate(`/feed/${response.data.id}?success=created`), 1500);
      }
    } catch (err) {
      console.error('Failed to log feeding:', err);
      setError(err.response?.data?.detail || 'Failed to log feeding.');
    }
  };

  // Helper function to sort foods by favorites
  const sortByFavorites = (foodList) => {
    if (!showFavoritesFirst) {
      return foodList.sort((a, b) => a.name.localeCompare(b.name));
    }

    return foodList.sort((a, b) => {
      const aReptileFav = a.is_reptile_favorite || false;
      const bReptileFav = b.is_reptile_favorite || false;
      if (aReptileFav !== bReptileFav) return bReptileFav ? 1 : -1;

      if (a.is_favorite !== b.is_favorite) return b.is_favorite ? 1 : -1;

      return a.name.localeCompare(b.name);
    });
  };

  const insectFoods = sortByFavorites(
    foods
      .filter(f => f.category === 'insect' || f.category === 'worms')
      .filter(f => !showOnlyFavoriteInsects || (f.is_reptile_favorite || f.is_favorite))
  );
  const saladFoods = sortByFavorites(
    foods
      .filter(f => f.category === 'vegetable' || f.category === 'fruit')
      .filter(f => !showOnlyFavoriteSalad || (f.is_reptile_favorite || f.is_favorite))
  );
  const preparedFoods = sortByFavorites(
    foods
      .filter(f => (f.category === 'prepared' || f.category === 'frozen_animal' || f.category === 'live_rodent' || f.category === 'fish_seafood' || f.category === 'eggs' || f.category === 'other') && f.name !== 'Salad')
      .filter(f => !showOnlyFavoritePrepared || (f.is_reptile_favorite || f.is_favorite))
  );

  if (loading) {
    return <LoadingState />;
  }

  // VIEW MODE
  if (mode === 'view' && existingFeeding) {
    return (
      <div>
        <PageHeader
          title="View Feeding"
          backLink={{ to: '/feed', label: 'Back to Feed' }}
          actions={
            <>
              <Button onClick={() => setMode('edit')} variant="secondary">
                <Edit2 size={18} /> Edit
              </Button>
              <Button onClick={handleDelete} variant="secondary" className="text-red-600 dark:text-red-400">
                <Trash2 size={18} /> Delete
              </Button>
            </>
          }
        />

        {viewModeSuccess && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-green-800 dark:text-green-200">{viewModeSuccess}</p>
          </div>
        )}

        {existingFeeding.schedule_completion && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <div className="flex items-start gap-3">
              <Calendar size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                  Schedule Completed
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  This feeding completed a schedule for{' '}
                  <span className="font-medium">
                    {new Date(existingFeeding.schedule_completion.scheduled_date).toLocaleDateString()}
                  </span>
                  {(() => {
                    const fedDate = new Date(existingFeeding.fed_at).toDateString();
                    const scheduledDate = new Date(existingFeeding.schedule_completion.scheduled_date).toDateString();
                    if (fedDate !== scheduledDate) {
                      const fedDay = new Date(existingFeeding.fed_at);
                      const scheduledDay = new Date(existingFeeding.schedule_completion.scheduled_date);
                      const daysDiff = Math.round((fedDay.setHours(0,0,0,0) - scheduledDay.setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
                      const absDay = Math.abs(daysDiff);
                      const dayText = absDay === 1 ? '1 day' : `${absDay} days`;
                      const direction = daysDiff > 0 ? 'after' : 'before';
                      return (
                        <span className="text-blue-700 dark:text-blue-300">
                          {' '}({dayText} {direction} scheduled date - flexible completion)
                        </span>
                      );
                    }
                    return null;
                  })()}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="card space-y-6">
          <div className="pb-4 border-b border-border">
            <p className="text-sm text-muted-foreground mb-1">Logged at</p>
            <p className="text-lg font-medium text-foreground">
              {formatDateTime(existingFeeding.created_at || existingFeeding.fed_at)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              by {existingFeeding.user?.name || 'Unknown'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Reptile</p>
            <p className="text-lg font-medium text-foreground">
              {reptiles.find(r => r.id === existingFeeding.reptile_id)?.name || existingFeeding.reptile?.name || 'Unknown'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Fed at</p>
            <p className="text-lg font-medium text-foreground">
              {formatDateTime(existingFeeding.fed_at)}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-3">Food Items</p>
            <div className="space-y-3">
              {existingFeeding.foods && existingFeeding.foods.length > 0 ? (
                existingFeeding.foods.map(food => {
                  if (food.name === 'Salad' && existingFeeding.is_salad) {
                    return null;
                  }
                  return (
                    <div key={food.id} className="bg-card/50 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-foreground">
                          {food.name} × {food.quantity || 1}
                        </p>
                        {food.supplements && food.supplements.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {food.supplements.length} supplement{food.supplements.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {food.supplements && food.supplements.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {food.supplements.map(sup => (
                            <span key={sup.id} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-xs">
                              {sup.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : !existingFeeding.is_salad ? (
                <p className="text-muted-foreground">None specified</p>
              ) : null}

              {existingFeeding.is_salad && existingFeeding.salad_components && existingFeeding.salad_components.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-green-900 dark:text-green-100">Salad</p>
                    {(() => {
                      const saladFood = existingFeeding.foods?.find(f => f.name === 'Salad');
                      return saladFood?.supplements && saladFood.supplements.length > 0 && (
                        <span className="text-xs text-green-700 dark:text-green-300">
                          {saladFood.supplements.length} supplement{saladFood.supplements.length !== 1 ? 's' : ''}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    <span className="font-medium">Components:</span> {existingFeeding.salad_components.map(sc => sc.name).join(', ')}
                  </p>
                  {(() => {
                    const saladFood = existingFeeding.foods?.find(f => f.name === 'Salad');
                    return saladFood?.supplements && saladFood.supplements.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {saladFood.supplements.map(sup => (
                          <span key={sup.id} className="px-2 py-0.5 bg-green-200 dark:bg-green-800/30 text-green-900 dark:text-green-200 rounded text-xs">
                            {sup.name}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {existingFeeding.supplements && existingFeeding.supplements.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Global Supplements</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">Applied to all food items</p>
              <div className="flex flex-wrap gap-2">
                {existingFeeding.supplements.map(sup => (
                  <span key={sup.id} className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full text-sm">
                    {sup.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {existingFeeding.notes && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Notes</p>
              <p className="text-foreground">{existingFeeding.notes}</p>
            </div>
          )}
        </div>
        <ConfettiDismissOverlay isActive={isActive} onDismiss={dismiss} />
      </div>
    );
  }

  // CREATE/EDIT MODE - Continue in next message due to length
  return (
    <div>
      <PageHeader
        title={mode === 'edit' ? 'Edit Feeding' : 'Log Feeding'}
      />

      {mode === 'edit' && existingFeeding && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-blue-900 dark:text-blue-100 text-sm">
            Originally logged at {formatDateTime(existingFeeding.created_at || existingFeeding.fed_at)} by {existingFeeding.user?.name || 'Unknown'}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="card space-y-4">
          {/* Reptile Select */}
          <FormField
            control={form.control}
            name="reptile_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reptile</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={mode === 'edit'}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reptile" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {reptiles.map(r => (
                      <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Food Type Selection Buttons */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Feeding Type (select one or more)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                type="button"
                variant={watchIncludeInsects ? "default" : "outline"}
                className="h-auto p-3 sm:p-4"
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
                <div className="flex flex-col items-center gap-1 sm:gap-2">
                  <Bug size={20} />
                  <span className="text-sm sm:text-base">Insects/Worms</span>
                </div>
              </Button>

              <Button
                type="button"
                variant={watchIncludeSalad ? "default" : "outline"}
                className="h-auto p-3 sm:p-4"
                onClick={() => form.setValue('include_salad', !watchIncludeSalad)}
              >
                <div className="flex flex-col items-center gap-1 sm:gap-2">
                  <Leaf size={20} />
                  <span className="text-sm sm:text-base">Salad</span>
                </div>
              </Button>

              <Button
                type="button"
                variant={watchIncludePrepared ? "default" : "outline"}
                className="h-auto p-3 sm:p-4"
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
                <div className="flex flex-col items-center gap-1 sm:gap-2">
                  <Utensils size={20} />
                  <span className="text-sm sm:text-base">Other Food</span>
                </div>
              </Button>
            </div>
            {form.formState.errors.include_insects && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.include_insects.message}</p>
            )}
          </div>

          {/* INSECTS SECTION */}
          {watchIncludeInsects && (
            <div className="space-y-3 p-4 bg-card/50 rounded-lg">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">Insects/Worms</h3>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOnlyFavoriteInsects}
                      onChange={(e) => setShowOnlyFavoriteInsects(e.target.checked)}
                      className="rounded"
                    />
                    Show favorites only
                  </label>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => appendInsect({
                    id: Date.now(),
                    food_id: insectFoods.length > 0 ? insectFoods[0].id.toString() : '',
                    quantity: 1,
                    supplement_ids: []
                  })}
                >
                  <Plus size={16} /> Add Another Item
                </Button>
              </div>

              {insectFields.map((field, index) => {
                const selectedFood = foods.find(f => f.id === parseInt(form.watch(`insect_items.${index}.food_id`)));
                const isReptileFavorite = selectedFood?.is_reptile_favorite || false;

                return (
                  <div key={field.id} className="space-y-2 bg-card p-2 sm:p-3 rounded">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <FormField
                          control={form.control}
                          name={`insect_items.${index}.food_id`}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {insectFoods.map(food => {
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
                            onClick={() => toggleReptileFavorite(form.watch(`insect_items.${index}.food_id`))}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors flex-shrink-0"
                            title={isReptileFavorite ? "Remove from reptile's favorites" : "Add to reptile's favorites"}
                          >
                            <Heart
                              size={20}
                              className={isReptileFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}
                            />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between sm:justify-start gap-2">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            onClick={() => {
                              const currentQty = form.watch(`insect_items.${index}.quantity`);
                              form.setValue(`insect_items.${index}.quantity`, Math.max(1, currentQty - 1));
                            }}
                          >
                            -
                          </Button>
                          <FormField
                            control={form.control}
                            name={`insect_items.${index}.quantity`}
                            render={({ field }) => (
                              <input
                                type="number"
                                value={field.value}
                                onChange={(e) => field.onChange(Math.max(1, parseInt(e.target.value) || 1))}
                                className="input text-center w-16 text-lg sm:text-base font-semibold"
                                min="1"
                              />
                            )}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            onClick={() => {
                              const currentQty = form.watch(`insect_items.${index}.quantity`);
                              form.setValue(`insect_items.${index}.quantity`, currentQty + 1);
                            }}
                          >
                            +
                          </Button>
                        </div>
                        {insectFields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeInsect(index)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <X size={22} />
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Per-item supplements */}
                    {supplements.length > 0 && (
                      <div className="pl-2 border-l-2 border-border">
                        <p className="text-xs text-muted-foreground mb-1.5">Supplements:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {supplements.map(sup => {
                            const supplementIds = form.watch(`insect_items.${index}.supplement_ids`) || [];
                            const isChecked = supplementIds.includes(sup.id);
                            return (
                              <label key={sup.id} className="flex items-center gap-1.5 text-xs cursor-pointer py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const current = form.watch(`insect_items.${index}.supplement_ids`) || [];
                                    const updated = isChecked
                                      ? current.filter(id => id !== sup.id)
                                      : [...current, sup.id];
                                    form.setValue(`insect_items.${index}.supplement_ids`, updated);
                                  }}
                                  className="rounded w-4 h-4"
                                />
                                <span className="select-none">{sup.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {form.formState.errors.insect_items && (
                <p className="text-sm font-medium text-destructive">{form.formState.errors.insect_items.message}</p>
              )}
            </div>
          )}

          {/* SALAD SECTION */}
          {watchIncludeSalad && (
            <div className="space-y-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="space-y-2">
                <h3 className="font-medium text-foreground">Salad Components</h3>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyFavoriteSalad}
                    onChange={(e) => setShowOnlyFavoriteSalad(e.target.checked)}
                    className="rounded"
                  />
                  Show favorites only
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {saladFoods.map(food => {
                  const saladComponents = form.watch('salad_components') || [];
                  const isChecked = saladComponents.includes(food.id);
                  return (
                    <label key={food.id} className="flex items-center gap-2 p-2 border border-border rounded cursor-pointer hover:bg-white dark:hover:bg-gray-700">
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
                      />
                      <span className="text-sm flex items-center gap-1">
                        {food.is_reptile_favorite && <Heart size={14} className="fill-red-500 text-red-500" />}
                        {!food.is_reptile_favorite && food.is_favorite && <Star size={14} className="fill-yellow-400 text-yellow-400" />}
                        {food.name}
                      </span>
                    </label>
                  );
                })}
              </div>
              {form.formState.errors.salad_components && (
                <p className="text-sm font-medium text-destructive">{form.formState.errors.salad_components.message}</p>
              )}
              {/* Salad supplements */}
              {supplements.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">Supplements:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {supplements.map(sup => {
                      const saladSupplements = form.watch('salad_supplements') || [];
                      const isChecked = saladSupplements.includes(sup.id);
                      return (
                        <label key={sup.id} className="flex items-center gap-1.5 text-xs cursor-pointer py-1 px-2 rounded hover:bg-secondary transition-colors">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const current = form.watch('salad_supplements') || [];
                              const updated = isChecked
                                ? current.filter(id => id !== sup.id)
                                : [...current, sup.id];
                              form.setValue('salad_supplements', updated);
                            }}
                            className="rounded w-4 h-4"
                          />
                          <span className="select-none">{sup.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PREPARED FOOD SECTION */}
          {watchIncludePrepared && (
            <div className="space-y-3 p-4 bg-card/50 rounded-lg">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">Other Food</h3>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOnlyFavoritePrepared}
                      onChange={(e) => setShowOnlyFavoritePrepared(e.target.checked)}
                      className="rounded"
                    />
                    Show favorites only
                  </label>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => appendPrepared({
                    id: Date.now(),
                    food_id: preparedFoods.length > 0 ? preparedFoods[0].id.toString() : '',
                    quantity: 1,
                    supplement_ids: []
                  })}
                >
                  <Plus size={16} /> Add Another Item
                </Button>
              </div>

              {preparedFields.map((field, index) => {
                const selectedFood = foods.find(f => f.id === parseInt(form.watch(`prepared_items.${index}.food_id`)));
                const isReptileFavorite = selectedFood?.is_reptile_favorite || false;

                return (
                  <div key={field.id} className="space-y-2 bg-card p-2 sm:p-3 rounded">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <FormField
                          control={form.control}
                          name={`prepared_items.${index}.food_id`}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {preparedFoods.map(food => {
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
                            onClick={() => toggleReptileFavorite(form.watch(`prepared_items.${index}.food_id`))}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors flex-shrink-0"
                            title={isReptileFavorite ? "Remove from reptile's favorites" : "Add to reptile's favorites"}
                          >
                            <Heart
                              size={20}
                              className={isReptileFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}
                            />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between sm:justify-start gap-2">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            onClick={() => {
                              const currentQty = form.watch(`prepared_items.${index}.quantity`);
                              form.setValue(`prepared_items.${index}.quantity`, Math.max(1, currentQty - 1));
                            }}
                          >
                            -
                          </Button>
                          <FormField
                            control={form.control}
                            name={`prepared_items.${index}.quantity`}
                            render={({ field }) => (
                              <input
                                type="number"
                                value={field.value}
                                onChange={(e) => field.onChange(Math.max(1, parseInt(e.target.value) || 1))}
                                className="input text-center w-16 text-lg sm:text-base font-semibold"
                                min="1"
                              />
                            )}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            onClick={() => {
                              const currentQty = form.watch(`prepared_items.${index}.quantity`);
                              form.setValue(`prepared_items.${index}.quantity`, currentQty + 1);
                            }}
                          >
                            +
                          </Button>
                        </div>
                        {preparedFields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removePrepared(index)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <X size={22} />
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Per-item supplements */}
                    {supplements.length > 0 && (
                      <div className="pl-2 border-l-2 border-border">
                        <p className="text-xs text-muted-foreground mb-1.5">Supplements:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {supplements.map(sup => {
                            const supplementIds = form.watch(`prepared_items.${index}.supplement_ids`) || [];
                            const isChecked = supplementIds.includes(sup.id);
                            return (
                              <label key={sup.id} className="flex items-center gap-1.5 text-xs cursor-pointer py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const current = form.watch(`prepared_items.${index}.supplement_ids`) || [];
                                    const updated = isChecked
                                      ? current.filter(id => id !== sup.id)
                                      : [...current, sup.id];
                                    form.setValue(`prepared_items.${index}.supplement_ids`, updated);
                                  }}
                                  className="rounded w-4 h-4"
                                />
                                <span className="select-none">{sup.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {form.formState.errors.prepared_items && (
                <p className="text-sm font-medium text-destructive">{form.formState.errors.prepared_items.message}</p>
              )}
            </div>
          )}

          {/* SUPPLEMENT SUGGESTIONS OR PRE-FILLED BANNER */}
          {supplementsPreFilled && originalPreFilledSupplements.length > 0 ? (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">ℹ️</span>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300">
                      Supplements Pre-filled from Schedule
                    </h4>
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                    The following supplements have been automatically added based on your schedule's rotation rules:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {originalPreFilledSupplements.map((suppId) => {
                      const supp = supplements.find(s => s.id === suppId);
                      return supp ? (
                        <span key={suppId} className="px-3 py-1.5 bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded-lg font-medium">
                          {supp.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : showSuggestion && suggestedSupplements.length > 0 ? (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">💡</span>
                    <h4 className="font-semibold text-green-900 dark:text-green-300">
                      Supplement {suggestedSupplements.length > 1 ? 'Suggestions' : 'Suggestion'}
                    </h4>
                  </div>
                  <p className="text-sm text-green-800 dark:text-green-300 mb-2">
                    Based on your rotation rules, this feeding should include:
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {suggestedSupplements.map((suggestion, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-green-100 dark:bg-green-800 text-green-900 dark:text-green-100 rounded-lg font-medium">
                          {suggestion.supplement.name}
                        </span>
                        <span className="text-xs text-green-700 dark:text-green-400">
                          (Every {suggestion.every_n_feedings})
                        </span>
                      </div>
                    ))}
                  </div>
                  {suggestedSupplements.some(s => s.notes) && (
                    <div className="text-xs text-green-700 dark:text-green-400 italic space-y-1">
                      {suggestedSupplements.filter(s => s.notes).map((s, idx) => (
                        <p key={idx}>• {s.supplement.name}: {s.notes}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={applyAllSuggestedSupplements}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    Apply All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={dismissSuggestion}
                    className="text-green-700 dark:text-green-300"
                  >
                    ✕
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {/* GLOBAL SUPPLEMENTS */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Global Supplements (optional)</label>
            <p className="text-xs text-muted-foreground">
              Applied to all food items. You can also add supplements to individual items above.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {supplements.map(sup => {
                const globalSupplements = form.watch('global_supplements') || [];
                const isChecked = globalSupplements.includes(sup.id);
                return (
                  <label key={sup.id} className="flex items-center gap-2 p-2.5 sm:p-2 border border-border rounded cursor-pointer hover:bg-secondary transition-colors">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        const current = form.watch('global_supplements') || [];
                        const updated = isChecked
                          ? current.filter(id => id !== sup.id)
                          : [...current, sup.id];
                        form.setValue('global_supplements', updated);
                      }}
                      className="rounded w-4 h-4"
                    />
                    <span className="text-sm select-none">{sup.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="fed_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
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
              name="fed_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time</FormLabel>
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

          {/* Notes */}
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
                    placeholder="Any observations or notes about this feeding"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Submit buttons */}
          <div className="flex gap-3">
            <Button type="submit" className="flex-1">
              {mode === 'edit' ? 'Update Feeding' : 'Log Feeding'}
            </Button>
            {mode === 'edit' && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMode('view')}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Form>
      <ConfettiDismissOverlay isActive={isActive} onDismiss={dismiss} />

      {/* AlertDialog for delete feeding confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feeding</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this feeding? This action cannot be undone.
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
