import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Leaf, Bug, Utensils, Plus, X, Edit2, Trash2 } from 'lucide-react';
import { getUserTimeFormat, formatDateTime } from '../utils/dateFormatting';
import DateInput from '../components/DateInput';

export default function FeedingLog() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mode state
  const [mode, setMode] = useState('create'); // create, view, edit
  const [existingFeeding, setExistingFeeding] = useState(null);

  // Data state
  const [reptiles, setReptiles] = useState([]);
  const [foods, setFoods] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedReptile, setSelectedReptile] = useState('');
  const [fedDate, setFedDate] = useState(new Date().toISOString().slice(0, 10));
  const [fedTime, setFedTime] = useState(new Date().toTimeString().slice(0, 5));
  const [notes, setNotes] = useState('');

  // Food type toggles
  const [includeInsects, setIncludeInsects] = useState(true);
  const [includeSalad, setIncludeSalad] = useState(false);
  const [includePrepared, setIncludePrepared] = useState(false);

  // Insect feeding items (array to support multiple different insects)
  const [insectItems, setInsectItems] = useState([]);

  // Salad components
  const [saladComponents, setSaladComponents] = useState([]);

  // Prepared food items (array to support multiple different prepared foods)
  const [preparedItems, setPreparedItems] = useState([]);

  // Salad supplements (applied to salad if selected)
  const [saladSupplements, setSaladSupplements] = useState([]);

  // Global supplements (applied to entire feeding)
  const [selectedSupplements, setSelectedSupplements] = useState([]);

  // Suggested supplements from rotation rules (can be multiple)
  const [suggestedSupplements, setSuggestedSupplements] = useState([]);
  const [showSuggestion, setShowSuggestion] = useState(false);

  // Time input format state
  const [timeFormat, setTimeFormat] = useState('24h');
  const [hours, setHours] = useState(new Date().getHours());
  const [minutes, setMinutes] = useState(new Date().getMinutes());
  const [period, setPeriod] = useState(new Date().getHours() >= 12 ? 'PM' : 'AM');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reptilesRes, foodsRes, supplementsRes] = await Promise.all([
          axios.get('/api/reptiles'),
          axios.get('/api/foods'),
          axios.get('/api/supplements'),
        ]);
        setReptiles(reptilesRes.data);
        setFoods(foodsRes.data);
        setSupplements(supplementsRes.data);

        // Check if we're viewing/editing an existing feeding
        if (id && !isNaN(id)) {
          try {
            const feedingRes = await axios.get(`/api/feedings/${id}`);
            setExistingFeeding(feedingRes.data);
            setMode('view');
            loadFeedingData(feedingRes.data, foodsRes.data);
          } catch (err) {
            console.error('Failed to load feeding:', err);
            setError('Failed to load feeding. It may not exist or you may not have permission.');
          }
        } else {
          // Creating new feeding - start with one insect item
          const initialReptileId = reptilesRes.data.length > 0 ? reptilesRes.data[0].id : '';
          setSelectedReptile(initialReptileId);

          const insectFoods = foodsRes.data.filter(f => f.category === 'insect');
          if (insectFoods.length > 0) {
            setInsectItems([{
              id: Date.now(),
              food_id: insectFoods[0].id,
              quantity: 1,
              supplement_ids: []
            }]);
          }
        }

        // Load time format preference
        const savedTimeFormat = getUserTimeFormat();
        setTimeFormat(savedTimeFormat);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Fetch supplement suggestion when reptile or food types change
  useEffect(() => {
    const fetchSuggestion = async () => {
      if (!selectedReptile || mode === 'view' || mode === 'edit') return;

      try {
        // Determine food category based on what's enabled
        let foodCategory = null;
        if (includeInsects && !includeSalad && !includePrepared) {
          foodCategory = 'insects';
        } else if (includeSalad && !includeInsects && !includePrepared) {
          foodCategory = 'salad';
        } else if (includeInsects || includeSalad || includePrepared) {
          foodCategory = 'mixed';
        }

        if (foodCategory) {
          const response = await axios.get(
            `/api/feeding-rotations/reptile/${selectedReptile}/calculate`,
            { params: { food_category: foodCategory, feeding_date: fedDate } }
          );

          // API now returns an array of rotations
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
        // Silently fail if no rotation rules exist
        console.debug('No rotation suggestion:', error);
        setSuggestedSupplements([]);
        setShowSuggestion(false);
      }
    };

    fetchSuggestion();
  }, [selectedReptile, includeInsects, includeSalad, includePrepared, supplements, mode, fedDate]);

  const applyAllSuggestedSupplements = () => {
    const newSupplementIds = suggestedSupplements
      .map(s => s.supplement_id)
      .filter(id => !selectedSupplements.includes(id));

    if (newSupplementIds.length > 0) {
      setSelectedSupplements([...selectedSupplements, ...newSupplementIds]);
    }
    setShowSuggestion(false);
  };

  const dismissSuggestion = () => {
    setShowSuggestion(false);
  };

  const loadFeedingData = (feeding, foodsList) => {
    setSelectedReptile(feeding.reptile_id);
    setNotes(feeding.notes || '');
    setSelectedSupplements(feeding.supplements?.map(s => s.id) || []);

    // Parse the fed_at datetime
    const fedAtDate = new Date(feeding.fed_at);
    setFedDate(fedAtDate.toISOString().slice(0, 10));

    const hour = fedAtDate.getHours();
    const minute = fedAtDate.getMinutes();

    console.log('Loading feeding data:', {
      rawFedAt: feeding.fed_at,
      parsedDate: fedAtDate.toString(),
      extractedHour: hour,
      extractedMinute: minute
    });

    setHours(hour);
    setMinutes(minute);
    setPeriod(hour >= 12 ? 'PM' : 'AM');

    // Determine which food types are included
    const insects = [];
    const prepared = [];
    let hasSalad = false;

    feeding.foods?.forEach(food => {
      const foodData = foodsList.find(f => f.id === food.id);
      if (!foodData) return;

      if (food.name === 'Salad' && feeding.is_salad) {
        hasSalad = true;
        // Load salad supplements
        setSaladSupplements(food.supplements?.map(s => s.id) || []);
      } else if (foodData.category === 'insect') {
        insects.push({
          id: Date.now() + Math.random(),
          food_id: food.id,
          quantity: food.quantity || 1,
          supplement_ids: food.supplements?.map(s => s.id) || []
        });
      } else if (foodData.category === 'prepared') {
        prepared.push({
          id: Date.now() + Math.random(),
          food_id: food.id,
          quantity: food.quantity || 1,
          supplement_ids: food.supplements?.map(s => s.id) || []
        });
      }
    });

    // Set food type toggles
    setIncludeInsects(insects.length > 0);
    setIncludeSalad(hasSalad);
    setIncludePrepared(prepared.length > 0);

    // Set food items
    if (insects.length > 0) setInsectItems(insects);
    if (prepared.length > 0) setPreparedItems(prepared);
    if (hasSalad) setSaladComponents(feeding.salad_components?.map(sc => sc.id) || []);
  };

  // Update fedTime whenever hours/minutes/period change
  useEffect(() => {
    let hour24 = hours;
    if (timeFormat === '12h') {
      if (period === 'PM' && hours !== 12) {
        hour24 = hours + 12;
      } else if (period === 'AM' && hours === 12) {
        hour24 = 0;
      }
    }
    const timeString = `${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    setFedTime(timeString);
  }, [hours, minutes, period, timeFormat]);

  const handleHoursChange = (value) => {
    const numValue = parseInt(value) || (timeFormat === '12h' ? 12 : 0);
    const maxHours = timeFormat === '12h' ? 12 : 23;
    const minHours = timeFormat === '12h' ? 1 : 0;
    setHours(Math.max(minHours, Math.min(maxHours, numValue)));
  };

  const handleMinutesChange = (value) => {
    const numValue = parseInt(value) || 0;
    setMinutes(Math.max(0, Math.min(59, numValue)));
  };

  // Insect item management
  const addInsectItem = () => {
    const insectFoods = foods.filter(f => f.category === 'insect');
    const defaultFood = insectFoods.length > 0 ? insectFoods[0].id : '';
    setInsectItems([...insectItems, {
      id: Date.now(),
      food_id: defaultFood,
      quantity: 1,
      supplement_ids: []
    }]);
  };

  const removeInsectItem = (itemId) => {
    setInsectItems(insectItems.filter(item => item.id !== itemId));
  };

  const updateInsectItem = (itemId, field, value) => {
    setInsectItems(insectItems.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  // Prepared food item management
  const addPreparedItem = () => {
    const preparedFoods = foods.filter(f => (f.category === 'prepared' || f.category === 'frozen_animal' || f.category === 'live_rodent' || f.category === 'fish_seafood' || f.category === 'eggs' || f.category === 'other') && f.name !== 'Salad');
    const defaultFood = preparedFoods.length > 0 ? preparedFoods[0].id : '';
    setPreparedItems([...preparedItems, {
      id: Date.now(),
      food_id: defaultFood,
      quantity: 1,
      supplement_ids: []
    }]);
  };

  const removePreparedItem = (itemId) => {
    setPreparedItems(preparedItems.filter(item => item.id !== itemId));
  };

  const updatePreparedItem = (itemId, field, value) => {
    setPreparedItems(preparedItems.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  // Toggle salad component
  const toggleSaladComponent = (foodId) => {
    if (saladComponents.includes(foodId)) {
      setSaladComponents(saladComponents.filter(id => id !== foodId));
    } else {
      setSaladComponents([...saladComponents, foodId]);
    }
  };

  // Toggle supplement for a specific insect item
  const toggleInsectSupplement = (itemId, suppId) => {
    setInsectItems(insectItems.map(item => {
      if (item.id === itemId) {
        const currentSupps = item.supplement_ids || [];
        const newSupps = currentSupps.includes(suppId)
          ? currentSupps.filter(id => id !== suppId)
          : [...currentSupps, suppId];
        return { ...item, supplement_ids: newSupps };
      }
      return item;
    }));
  };

  // Toggle supplement for a specific prepared item
  const togglePreparedSupplement = (itemId, suppId) => {
    setPreparedItems(preparedItems.map(item => {
      if (item.id === itemId) {
        const currentSupps = item.supplement_ids || [];
        const newSupps = currentSupps.includes(suppId)
          ? currentSupps.filter(id => id !== suppId)
          : [...currentSupps, suppId];
        return { ...item, supplement_ids: newSupps };
      }
      return item;
    }));
  };

  // Toggle supplement for salad
  const toggleSaladSupplement = (suppId) => {
    if (saladSupplements.includes(suppId)) {
      setSaladSupplements(saladSupplements.filter(id => id !== suppId));
    } else {
      setSaladSupplements([...saladSupplements, suppId]);
    }
  };

  // Toggle global supplement
  const toggleSupplement = (suppId) => {
    if (selectedSupplements.includes(suppId)) {
      setSelectedSupplements(selectedSupplements.filter(id => id !== suppId));
    } else {
      setSelectedSupplements([...selectedSupplements, suppId]);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this feeding?')) return;

    try {
      await axios.delete(`/api/feedings/${id}`);
      setSuccess('Feeding deleted successfully!');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      console.error('Failed to delete feeding:', err);
      setError(err.response?.data?.detail || 'Failed to delete feeding. You may not have permission.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedReptile) {
      setError("Please select a reptile.");
      return;
    }

    // Validate at least one food type is selected
    if (!includeInsects && !includeSalad && !includePrepared) {
      setError("Please select at least one feeding type (Insects, Salad, or Prepared Food).");
      return;
    }

    // Construct ISO 8601 datetime WITH local timezone offset
    const [year, month, day] = fedDate.split('-').map(Number);
    const [hour, minute] = fedTime.split(':').map(Number);
    const localDate = new Date(year, month - 1, day, hour, minute, 0);

    const tzOffset = -localDate.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(tzOffset) / 60);
    const offsetMinutes = Math.abs(tzOffset) % 60;
    const offsetSign = tzOffset >= 0 ? '+' : '-';
    const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;

    const fedAtISO = `${fedDate}T${fedTime}:00${offsetString}`;

    console.log('Submitting feeding:', {
      inputDate: fedDate,
      inputTime: fedTime,
      tzOffset,
      offsetString,
      finalISO: fedAtISO
    });

    let payload = {
      reptile_id: parseInt(selectedReptile),
      fed_at: fedAtISO,
      notes,
      is_salad: includeSalad,
      foods: [],
      supplements: selectedSupplements,
      salad_components: []
    };

    // Add insect foods with per-item supplements
    if (includeInsects) {
      if (insectItems.length === 0) {
        setError("Please add at least one insect item or uncheck Insects.");
        return;
      }
      payload.foods.push(...insectItems.map(item => ({
        food_id: parseInt(item.food_id),
        quantity: item.quantity,
        supplement_ids: item.supplement_ids || []
      })));
    }

    // Add prepared foods with per-item supplements
    if (includePrepared) {
      if (preparedItems.length === 0) {
        setError("Please add at least one prepared food item or uncheck Prepared Food.");
        return;
      }
      payload.foods.push(...preparedItems.map(item => ({
        food_id: parseInt(item.food_id),
        quantity: item.quantity,
        supplement_ids: item.supplement_ids || []
      })));
    }

    // Add salad with per-salad supplements
    if (includeSalad) {
      if (saladComponents.length === 0) {
        setError("Please select at least one salad component or uncheck Salad.");
        return;
      }

      const saladFood = foods.find(f => f.name === 'Salad');
      if (!saladFood) {
        setError("Salad food item not found. Please create it in Food Management.");
        return;
      }

      payload.foods.push({
        food_id: saladFood.id,
        quantity: 1,
        supplement_ids: saladSupplements || []
      });
      payload.salad_components = saladComponents;
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
        setSuccess('Feeding logged successfully!');
        setTimeout(() => navigate(`/feed/${response.data.id}`), 1500);
      }
    } catch (err) {
      console.error('Failed to log feeding:', err);
      setError(err.response?.data?.detail || 'Failed to log feeding.');
    }
  };

  const insectFoods = foods.filter(f => f.category === 'insect' || f.category === 'worms');
  const saladFoods = foods.filter(f => f.category === 'vegetable' || f.category === 'fruit');
  const preparedFoods = foods.filter(f => (f.category === 'prepared' || f.category === 'frozen_animal' || f.category === 'live_rodent' || f.category === 'fish_seafood' || f.category === 'eggs' || f.category === 'other') && f.name !== 'Salad');

  if (loading) {
    return <div className="text-center text-gray-700 dark:text-gray-300">Loading...</div>;
  }

  // VIEW MODE
  if (mode === 'view' && existingFeeding) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">View Feeding</h1>
          <div className="flex gap-2">
            <button onClick={() => navigate('/feed')} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Log New Feeding
            </button>
            <button onClick={() => setMode('edit')} className="btn-secondary flex items-center gap-2">
              <Edit2 size={18} /> Edit
            </button>
            <button onClick={handleDelete} className="btn-secondary text-red-600 dark:text-red-400 flex items-center gap-2">
              <Trash2 size={18} /> Delete
            </button>
          </div>
        </div>

        <div className="card space-y-6">
          <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Logged at</p>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {formatDateTime(existingFeeding.created_at || existingFeeding.fed_at)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              by {existingFeeding.user?.name || 'Unknown'}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Reptile</p>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {reptiles.find(r => r.id === existingFeeding.reptile_id)?.name || existingFeeding.reptile?.name || 'Unknown'}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fed at</p>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {formatDateTime(existingFeeding.fed_at)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Food Items</p>
            <div className="space-y-3">
              {existingFeeding.foods && existingFeeding.foods.length > 0 ? (
                existingFeeding.foods.map(food => {
                  // Don't display the "Salad" food item itself, as it's shown separately below
                  if (food.name === 'Salad' && existingFeeding.is_salad) {
                    return null;
                  }
                  return (
                    <div key={food.id} className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {food.name} × {food.quantity || 1}
                        </p>
                        {food.supplements && food.supplements.length > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
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
                <p className="text-gray-500 dark:text-gray-400">None specified</p>
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
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
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
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Global Supplements</p>
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
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Notes</p>
              <p className="text-gray-900 dark:text-white">{existingFeeding.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // CREATE/EDIT MODE
  return (
    <div>
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          {mode === 'edit' ? 'Edit Feeding' : 'Log Feeding'}
        </h1>
      </div>

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

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label htmlFor="reptile" className="block font-medium mb-1">Reptile</label>
          <select
            id="reptile"
            value={selectedReptile}
            onChange={e => setSelectedReptile(e.target.value)}
            className="input"
            required
            disabled={mode === 'edit'}
          >
            {reptiles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {/* Food Type Selection Buttons */}
        <div>
          <label className="block font-medium mb-2 text-sm sm:text-base">Feeding Type (select one or more)</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setIncludeInsects(!includeInsects);
                if (!includeInsects && insectItems.length === 0 && insectFoods.length > 0) {
                  setInsectItems([{ id: Date.now(), food_id: insectFoods[0].id, quantity: 1, supplement_ids: [] }]);
                }
              }}
              className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
                includeInsects
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary-400'
              }`}
            >
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <Bug size={20} className="sm:w-6 sm:h-6" />
                <span className="font-medium text-sm sm:text-base">Insects/Worms</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIncludeSalad(!includeSalad)}
              className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
                includeSalad
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary-400'
              }`}
            >
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <Leaf size={20} className="sm:w-6 sm:h-6" />
                <span className="font-medium text-sm sm:text-base">Salad</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setIncludePrepared(!includePrepared);
                if (!includePrepared && preparedItems.length === 0 && preparedFoods.length > 0) {
                  setPreparedItems([{ id: Date.now(), food_id: preparedFoods[0].id, quantity: 1, supplement_ids: [] }]);
                }
              }}
              className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
                includePrepared
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary-400'
              }`}
            >
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <Utensils size={20} className="sm:w-6 sm:h-6" />
                <span className="font-medium text-sm sm:text-base">Other Food</span>
              </div>
            </button>
          </div>
        </div>

        {/* INSECTS/WORMS SECTION */}
        {includeInsects && (
          <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
              <h3 className="font-medium text-gray-900 dark:text-white">Insects/Worms</h3>
              <button
                type="button"
                onClick={addInsectItem}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <Plus size={16} /> Add Another Item
              </button>
            </div>

            {insectItems.map((item, index) => (
              <div key={item.id} className="space-y-2 bg-white dark:bg-gray-700 p-2 sm:p-3 rounded">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <select
                      value={item.food_id}
                      onChange={(e) => updateInsectItem(item.id, 'food_id', e.target.value)}
                      className="input w-full text-sm sm:text-base"
                    >
                      {insectFoods.map(food => (
                        <option key={food.id} value={food.id}>{food.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateInsectItem(item.id, 'quantity', Math.max(1, item.quantity - 1))}
                        className="w-12 h-12 sm:w-10 sm:h-10 bg-gray-200 dark:bg-gray-600 rounded-lg font-bold text-xl sm:text-lg hover:bg-gray-300 dark:hover:bg-gray-500 active:scale-95 transition-all"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateInsectItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        className="input text-center w-16 sm:w-16 text-lg sm:text-base font-semibold"
                        min="1"
                      />
                      <button
                        type="button"
                        onClick={() => updateInsectItem(item.id, 'quantity', item.quantity + 1)}
                        className="w-12 h-12 sm:w-10 sm:h-10 bg-gray-200 dark:bg-gray-600 rounded-lg font-bold text-xl sm:text-lg hover:bg-gray-300 dark:hover:bg-gray-500 active:scale-95 transition-all"
                      >
                        +
                      </button>
                    </div>
                    {insectItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeInsectItem(item.id)}
                        className="text-red-600 dark:text-red-400 p-1 sm:p-1"
                      >
                        <X size={22} className="sm:w-5 sm:h-5" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Per-item supplements */}
                {supplements.length > 0 && (
                  <div className="pl-2 sm:pl-2 border-l-2 border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">Supplements:</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {supplements.map(sup => (
                        <label key={sup.id} className="flex items-center gap-1.5 text-xs sm:text-xs cursor-pointer py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                          <input
                            type="checkbox"
                            checked={(item.supplement_ids || []).includes(sup.id)}
                            onChange={() => toggleInsectSupplement(item.id, sup.id)}
                            className="rounded w-4 h-4"
                          />
                          <span className="select-none">{sup.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* SALAD SECTION */}
        {includeSalad && (
          <div className="space-y-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white">Salad Components</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {saladFoods.map(food => (
                <label key={food.id} className="flex items-center gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:bg-white dark:hover:bg-gray-700">
                  <input
                    type="checkbox"
                    checked={saladComponents.includes(food.id)}
                    onChange={() => toggleSaladComponent(food.id)}
                  />
                  <span className="text-sm">{food.name}</span>
                </label>
              ))}
            </div>
            {/* Salad supplements */}
            {supplements.length > 0 && (
              <div className="pt-2 border-t border-gray-300 dark:border-gray-600">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Supplements:</p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {supplements.map(sup => (
                    <label key={sup.id} className="flex items-center gap-1.5 text-xs cursor-pointer py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <input
                        type="checkbox"
                        checked={saladSupplements.includes(sup.id)}
                        onChange={() => toggleSaladSupplement(sup.id)}
                        className="rounded w-4 h-4"
                      />
                      <span className="select-none">{sup.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PREPARED FOOD SECTION */}
        {includePrepared && (
          <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
              <h3 className="font-medium text-gray-900 dark:text-white">Other Food</h3>
              <button
                type="button"
                onClick={addPreparedItem}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <Plus size={16} /> Add Another Item
              </button>
            </div>

            {preparedItems.map((item, index) => (
              <div key={item.id} className="space-y-2 bg-white dark:bg-gray-700 p-2 sm:p-3 rounded">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <select
                      value={item.food_id}
                      onChange={(e) => updatePreparedItem(item.id, 'food_id', e.target.value)}
                      className="input w-full text-sm sm:text-base"
                    >
                      {preparedFoods.map(food => (
                        <option key={food.id} value={food.id}>{food.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updatePreparedItem(item.id, 'quantity', Math.max(1, item.quantity - 1))}
                        className="w-12 h-12 sm:w-10 sm:h-10 bg-gray-200 dark:bg-gray-600 rounded-lg font-bold text-xl sm:text-lg hover:bg-gray-300 dark:hover:bg-gray-500 active:scale-95 transition-all"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updatePreparedItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        className="input text-center w-16 sm:w-16 text-lg sm:text-base font-semibold"
                        min="1"
                      />
                      <button
                        type="button"
                        onClick={() => updatePreparedItem(item.id, 'quantity', item.quantity + 1)}
                        className="w-12 h-12 sm:w-10 sm:h-10 bg-gray-200 dark:bg-gray-600 rounded-lg font-bold text-xl sm:text-lg hover:bg-gray-300 dark:hover:bg-gray-500 active:scale-95 transition-all"
                      >
                        +
                      </button>
                    </div>
                    {preparedItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePreparedItem(item.id)}
                        className="text-red-600 dark:text-red-400 p-1 sm:p-1"
                      >
                        <X size={22} className="sm:w-5 sm:h-5" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Per-item supplements */}
                {supplements.length > 0 && (
                  <div className="pl-2 sm:pl-2 border-l-2 border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">Supplements:</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {supplements.map(sup => (
                        <label key={sup.id} className="flex items-center gap-1.5 text-xs sm:text-xs cursor-pointer py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                          <input
                            type="checkbox"
                            checked={(item.supplement_ids || []).includes(sup.id)}
                            onChange={() => togglePreparedSupplement(item.id, sup.id)}
                            className="rounded w-4 h-4"
                          />
                          <span className="select-none">{sup.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* SUPPLEMENT SUGGESTIONS */}
        {showSuggestion && suggestedSupplements.length > 0 && (
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
                <button
                  type="button"
                  onClick={applyAllSuggestedSupplements}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  Apply All
                </button>
                <button
                  type="button"
                  onClick={dismissSuggestion}
                  className="px-3 py-2 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-800 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GLOBAL SUPPLEMENTS */}
        <div>
          <label className="block font-medium mb-1 text-sm sm:text-base">Global Supplements (optional)</label>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            Applied to all food items. You can also add supplements to individual items above.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {supplements.map(sup => (
              <label key={sup.id} className="flex items-center gap-2 p-2.5 sm:p-2 border border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedSupplements.includes(sup.id)}
                  onChange={() => toggleSupplement(sup.id)}
                  className="rounded w-4 h-4"
                />
                <span className="text-sm select-none">{sup.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="fedDate" className="block font-medium mb-1">Date</label>
            <DateInput
              id="fedDate"
              value={fedDate}
              onChange={e => setFedDate(e.target.value)}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Time ({timeFormat === '12h' ? '12h' : '24h'})</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={hours}
                onChange={e => handleHoursChange(e.target.value)}
                className="input w-20 text-center"
                min={timeFormat === '12h' ? 1 : 0}
                max={timeFormat === '12h' ? 12 : 23}
                required
              />
              <span className="flex items-center text-xl font-bold text-gray-700 dark:text-gray-300">:</span>
              <input
                type="number"
                value={String(minutes).padStart(2, '0')}
                onChange={e => handleMinutesChange(e.target.value)}
                className="input w-20 text-center"
                min="0"
                max="59"
                required
              />
              {timeFormat === '12h' && (
                <select value={period} onChange={e => setPeriod(e.target.value)} className="input w-20">
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              )}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block font-medium mb-1">Notes (optional)</label>
          <textarea
            id="notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="input w-full"
            placeholder="Any observations or notes about this feeding"
          />
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary flex-1">
            {mode === 'edit' ? 'Update Feeding' : 'Log Feeding'}
          </button>
          {mode === 'edit' && (
            <button
              type="button"
              onClick={() => setMode('view')}
              className="btn-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
