import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, X, Edit2, Trash2 } from 'lucide-react';
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

  // NEW: Food items array - each item has food_id, quantity, and supplements
  const [foodItems, setFoodItems] = useState([]);

  // NEW: Salad state - separate from regular foods
  const [isSalad, setIsSalad] = useState(false);
  const [saladComponents, setSaladComponents] = useState([]);

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
            loadFeedingData(feedingRes.data);
          } catch (err) {
            console.error('Failed to load feeding:', err);
            setError('Failed to load feeding. It may not exist or you may not have permission.');
          }
        } else {
          // Creating new feeding - start with one empty food item
          const initialReptileId = reptilesRes.data.length > 0 ? reptilesRes.data[0].id : '';
          setSelectedReptile(initialReptileId);

          // Add initial food item
          const insectFoods = foodsRes.data.filter(f => f.category === 'insect');
          if (insectFoods.length > 0) {
            setFoodItems([{
              id: Date.now(),
              food_id: insectFoods[0].id,
              quantity: 1,
              supplements: []
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

  const loadFeedingData = (feeding) => {
    setSelectedReptile(feeding.reptile_id);
    setNotes(feeding.notes || '');

    // Parse the fed_at datetime
    const fedAtDate = new Date(feeding.fed_at);
    setFedDate(fedAtDate.toISOString().slice(0, 10));

    const hour = fedAtDate.getHours();
    const minute = fedAtDate.getMinutes();
    setHours(hour);
    setMinutes(minute);
    setPeriod(hour >= 12 ? 'PM' : 'AM');

    // Load food items
    if (feeding.is_salad) {
      setIsSalad(true);
      setSaladComponents(feeding.salad_components?.map(sc => sc.id) || []);
    } else if (feeding.foods && feeding.foods.length > 0) {
      // Convert foods to food items format
      const items = feeding.foods.map(food => ({
        id: Date.now() + Math.random(), // Unique ID for React keys
        food_id: food.id,
        quantity: food.quantity || 1,
        supplements: feeding.supplements?.map(s => s.id) || [] // Note: global supplements for now
      }));
      setFoodItems(items);
    }
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

  // NEW: Add a new food item
  const addFoodItem = () => {
    const insectFoods = foods.filter(f => f.category === 'insect');
    const defaultFood = insectFoods.length > 0 ? insectFoods[0].id : (foods.length > 0 ? foods[0].id : '');

    setFoodItems([...foodItems, {
      id: Date.now(),
      food_id: defaultFood,
      quantity: 1,
      supplements: []
    }]);
  };

  // NEW: Remove a food item
  const removeFoodItem = (itemId) => {
    setFoodItems(foodItems.filter(item => item.id !== itemId));
  };

  // NEW: Update food item field
  const updateFoodItem = (itemId, field, value) => {
    setFoodItems(foodItems.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  // NEW: Toggle supplement for a specific food item
  const toggleItemSupplement = (itemId, supplementId) => {
    setFoodItems(foodItems.map(item => {
      if (item.id === itemId) {
        const supplements = item.supplements.includes(supplementId)
          ? item.supplements.filter(id => id !== supplementId)
          : [...item.supplements, supplementId];
        return { ...item, supplements };
      }
      return item;
    }));
  };

  // Toggle salad component
  const toggleSaladComponent = (foodId) => {
    if (saladComponents.includes(foodId)) {
      setSaladComponents(saladComponents.filter(id => id !== foodId));
    } else {
      setSaladComponents([...saladComponents, foodId]);
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

    // Construct ISO 8601 datetime WITH local timezone offset
    // This tells the backend "17:00 in the user's timezone"
    const [year, month, day] = fedDate.split('-').map(Number);
    const [hour, minute] = fedTime.split(':').map(Number);
    const localDate = new Date(year, month - 1, day, hour, minute, 0);

    // Get timezone offset in minutes and convert to +HH:MM format
    const tzOffset = -localDate.getTimezoneOffset(); // Negative because getTimezoneOffset returns opposite sign
    const offsetHours = Math.floor(Math.abs(tzOffset) / 60);
    const offsetMinutes = Math.abs(tzOffset) % 60;
    const offsetSign = tzOffset >= 0 ? '+' : '-';
    const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;

    // Construct: YYYY-MM-DDTHH:MM:SS+TZ
    const fedAtISO = `${fedDate}T${fedTime}:00${offsetString}`;

    let payload = {
      reptile_id: parseInt(selectedReptile),
      fed_at: fedAtISO,
      notes,
      is_salad: isSalad,
      foods: [],
      supplements: [],
      salad_components: []
    };

    // Validate that at least something is being fed
    if (foodItems.length === 0 && !isSalad) {
      setError("Please add at least one food item or include salad.");
      return;
    }

    // Add regular food items
    if (foodItems.length > 0) {
      payload.foods = foodItems.map(item => ({
        food_id: parseInt(item.food_id),
        quantity: item.quantity
      }));
    }

    // Add salad if included
    if (isSalad) {
      if (saladComponents.length === 0) {
        setError("Please select at least one salad component.");
        return;
      }

      const saladFood = foods.find(f => f.name === 'Salad');
      if (!saladFood) {
        setError("Salad food item not found. Please create it in Food Management.");
        return;
      }

      // Add the Salad food to the foods array
      payload.foods.push({ food_id: saladFood.id, quantity: 1 });
      payload.salad_components = saladComponents;
    }

    // Collect all unique supplements from all food items
    const allSupplements = new Set();
    foodItems.forEach(item => {
      item.supplements.forEach(suppId => allSupplements.add(suppId));
    });
    payload.supplements = Array.from(allSupplements);

    try {
      if (mode === 'edit') {
        await axios.put(`/api/feedings/${id}`, payload);
        setSuccess('Feeding updated successfully!');
        setMode('view');
        // Reload the feeding data
        const feedingRes = await axios.get(`/api/feedings/${id}`);
        setExistingFeeding(feedingRes.data);
        loadFeedingData(feedingRes.data);
      } else {
        await axios.post('/api/feedings', payload);
        setSuccess('Feeding logged successfully!');
        setTimeout(() => navigate('/'), 1500);
      }
    } catch (err) {
      console.error('Failed to log feeding:', err);
      setError(err.response?.data?.detail || 'Failed to log feeding.');
    }
  };

  const insectFoods = foods.filter(f => f.category === 'insect');
  const saladFoods = foods.filter(f => f.category === 'vegetable' || f.category === 'fruit');
  const preparedFoods = foods.filter(f => f.category === 'prepared' && f.name !== 'Salad');
  const allRegularFoods = [...insectFoods, ...preparedFoods];

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
              {existingFeeding.reptile?.name || 'Unknown'}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fed at</p>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {formatDateTime(existingFeeding.fed_at)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Food</p>
            <div className="space-y-2">
              {existingFeeding.foods && existingFeeding.foods.length > 0 ? (
                existingFeeding.foods.map(food => {
                  // Don't display the "Salad" food item itself, as it's shown separately below
                  if (food.name === 'Salad' && existingFeeding.is_salad) {
                    return null;
                  }
                  return (
                    <p key={food.id} className="text-gray-900 dark:text-white">
                      {food.name} × {food.quantity || 1}
                    </p>
                  );
                })
              ) : !existingFeeding.is_salad ? (
                <p className="text-gray-500 dark:text-gray-400">None specified</p>
              ) : null}

              {existingFeeding.is_salad && existingFeeding.salad_components && existingFeeding.salad_components.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <p className="font-medium text-green-900 dark:text-green-100 mb-1">Salad</p>
                  <p className="text-gray-700 dark:text-gray-300">
                    Components: {existingFeeding.salad_components.map(sc => sc.name).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {existingFeeding.supplements && existingFeeding.supplements.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Supplements</p>
              <div className="flex flex-wrap gap-2">
                {existingFeeding.supplements.map(sup => (
                  <span key={sup.id} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm">
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
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

        {/* REGULAR FOOD ITEMS */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="block font-medium">Food Items</label>
            <button
              type="button"
              onClick={addFoodItem}
              className="btn-secondary text-sm flex items-center gap-1"
            >
              <Plus size={16} /> Add Food
            </button>
          </div>

          {foodItems.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-sm italic">
              No food items added. Click "Add Food" to get started.
            </p>
          )}

          {foodItems.map((item, index) => (
            <div key={item.id} className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg space-y-3">
              <div className="flex justify-between items-start">
                <h4 className="font-medium text-gray-900 dark:text-white">Food Item {index + 1}</h4>
                {foodItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFoodItem(item.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Food Type</label>
                <select
                  value={item.food_id}
                  onChange={(e) => updateFoodItem(item.id, 'food_id', e.target.value)}
                  className="input w-full"
                >
                  {allRegularFoods.map(food => (
                    <option key={food.id} value={food.id}>
                      {food.name} ({food.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateFoodItem(item.id, 'quantity', Math.max(1, item.quantity - 1))}
                    className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded font-bold text-lg"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateFoodItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                    className="input text-center w-20"
                    min="1"
                  />
                  <button
                    type="button"
                    onClick={() => updateFoodItem(item.id, 'quantity', item.quantity + 1)}
                    className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded font-bold text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Supplements for this item</label>
                <div className="grid grid-cols-2 gap-2">
                  {supplements.map(sup => (
                    <label key={sup.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.supplements.includes(sup.id)}
                        onChange={() => toggleItemSupplement(item.id, sup.id)}
                      />
                      <span>{sup.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* SALAD COMPONENTS - Optional addition */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeSalad"
              checked={isSalad}
              onChange={(e) => setIsSalad(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="includeSalad" className="font-medium cursor-pointer">
              Also include salad
            </label>
          </div>

          {isSalad && (
            <div className="pl-6">
              <label className="block text-sm font-medium mb-2">Salad Components</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {saladFoods.map(food => (
                  <label key={food.id} className="flex items-center gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={saladComponents.includes(food.id)}
                      onChange={() => toggleSaladComponent(food.id)}
                    />
                    <span className="text-sm">{food.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
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
