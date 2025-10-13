import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Leaf, Bug, Utensils, Edit2, Trash2 } from 'lucide-react';
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
  const [logType, setLogType] = useState('insect'); // insect, salad, prepared
  const [selectedReptile, setSelectedReptile] = useState('');
  const [fedDate, setFedDate] = useState(new Date().toISOString().slice(0, 10));
  const [fedTime, setFedTime] = useState(new Date().toTimeString().slice(0, 5));
  const [notes, setNotes] = useState('');
  const [selectedSupplements, setSelectedSupplements] = useState([]);

  // Time input format state
  const [timeFormat, setTimeFormat] = useState('24h');
  const [hours, setHours] = useState(new Date().getHours());
  const [minutes, setMinutes] = useState(new Date().getMinutes());
  const [period, setPeriod] = useState(new Date().getHours() >= 12 ? 'PM' : 'AM');

  // Log-type specific state
  const [selectedInsectFood, setSelectedInsectFood] = useState('');
  const [insectQuantity, setInsectQuantity] = useState(1);
  const [selectedSaladComponents, setSelectedSaladComponents] = useState([]);
  const [selectedPreparedFood, setSelectedPreparedFood] = useState('');
  const [preparedFoodQuantity, setPreparedFoodQuantity] = useState(1);

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
          // Creating new feeding
          const initialReptileId = reptilesRes.data.length > 0 ? reptilesRes.data[0].id : '';
          setSelectedReptile(initialReptileId);

          const insectFoods = foodsRes.data.filter(f => f.category === 'insect');
          if (insectFoods.length > 0) {
            setSelectedInsectFood(insectFoods[0].id);
          }

          const preparedFoods = foodsRes.data.filter(f => f.category === 'prepared' && f.name !== 'Salad');
          if (preparedFoods.length > 0) {
            setSelectedPreparedFood(preparedFoods[0].id);
          }
        }

        // Load user's time format preference
        const format = getUserTimeFormat();
        setTimeFormat(format);

      } catch (error) {
        console.error("Failed to load data for feeding log:", error);
        setError("Failed to load required data. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const loadFeedingData = (feeding, foodsList) => {
    // Set reptile
    setSelectedReptile(feeding.reptile_id);

    // Parse fed_at datetime
    const fedAtDate = new Date(feeding.fed_at);
    setFedDate(fedAtDate.toISOString().slice(0, 10));

    const hours24 = fedAtDate.getHours();
    const mins = fedAtDate.getMinutes();
    setMinutes(mins);

    const format = getUserTimeFormat();
    if (format === '12h') {
      if (hours24 === 0) {
        setHours(12);
        setPeriod('AM');
      } else if (hours24 < 12) {
        setHours(hours24);
        setPeriod('AM');
      } else if (hours24 === 12) {
        setHours(12);
        setPeriod('PM');
      } else {
        setHours(hours24 - 12);
        setPeriod('PM');
      }
    } else {
      setHours(hours24);
    }

    // Set notes
    setNotes(feeding.notes || '');

    // Set supplements
    setSelectedSupplements(feeding.supplements?.map(s => s.id) || []);

    // Determine log type and set foods
    if (feeding.is_salad) {
      setLogType('salad');
      setSelectedSaladComponents(feeding.salad_components?.map(sc => sc.id) || []);
    } else if (feeding.foods && feeding.foods.length > 0) {
      const firstFood = feeding.foods[0];
      const foodItem = foodsList.find(f => f.id === firstFood.id);

      if (foodItem?.category === 'insect') {
        setLogType('insect');
        setSelectedInsectFood(firstFood.id);
        setInsectQuantity(firstFood.FeedingFood?.quantity || 1);
      } else if (foodItem?.category === 'prepared') {
        setLogType('prepared');
        setSelectedPreparedFood(firstFood.id);
        setPreparedFoodQuantity(firstFood.FeedingFood?.quantity || 1);
      }
    }
  };

  const insectFoods = foods.filter(f => f.category === 'insect');
  const saladFoods = foods.filter(f => f.category === 'vegetable' || f.category === 'fruit');
  const preparedFoods = foods.filter(f => f.category === 'prepared' && f.name !== 'Salad');

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
    const numValue = parseInt(value) || 0;
    if (timeFormat === '12h') {
      setHours(Math.max(1, Math.min(12, numValue)));
    } else {
      setHours(Math.max(0, Math.min(23, numValue)));
    }
  };

  const handleMinutesChange = (value) => {
    const numValue = parseInt(value) || 0;
    setMinutes(Math.max(0, Math.min(59, numValue)));
  };

  const handleInsectQuantityChange = (delta) => {
    setInsectQuantity(prev => Math.max(1, prev + delta));
  };

  const handleSaladToggle = (foodId) => {
    setSelectedSaladComponents(prev => prev.includes(foodId) ? prev.filter(fid => fid !== foodId) : [...prev, foodId]);
  };

  const handleSupplementToggle = (supId) => {
    setSelectedSupplements(prev => prev.includes(supId) ? prev.filter(sid => sid !== supId) : [...prev, supId]);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this feeding?')) {
      return;
    }

    try {
      await axios.delete(`/api/feedings/${id}`);
      navigate(`/reptiles/${existingFeeding.reptile_id}`);
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

    const fedAtDateTime = new Date(`${fedDate}T${fedTime}`);

    let payload = {
        reptile_id: parseInt(selectedReptile),
        fed_at: fedAtDateTime.toISOString(),
        notes,
        supplements: selectedSupplements,
        foods: [],
        is_salad: false,
        salad_components: []
    };

    if (logType === 'insect') {
        if (!selectedInsectFood) {
            setError("Please select an insect type.");
            return;
        }
        payload.foods = [{ food_id: parseInt(selectedInsectFood), quantity: insectQuantity }];
    } else if (logType === 'salad') {
        const saladFood = foods.find(f => f.name === 'Salad');
        if (!saladFood) {
            setError("Could not find 'Salad' food type. Please contact support.");
            return;
        }
        if (selectedSaladComponents.length === 0) {
            setError("Please select at least one salad component.");
            return;
        }
        payload.is_salad = true;
        payload.foods = [{ food_id: saladFood.id, quantity: 1 }];
        payload.salad_components = selectedSaladComponents;
    } else if (logType === 'prepared') {
        if (!selectedPreparedFood) {
            setError("Please select a prepared food.");
            return;
        }
        payload.foods = [{ food_id: parseInt(selectedPreparedFood), quantity: preparedFoodQuantity }];
    }

    try {
        if (mode === 'edit' && existingFeeding) {
          // Update existing feeding
          await axios.put(`/api/feedings/${id}`, payload);
          setSuccess('Feeding updated successfully!');
          setTimeout(() => navigate(`/reptiles/${selectedReptile}`), 1500);
        } else {
          // Create new feeding
          await axios.post('/api/feedings', payload);
          const reptileName = reptiles.find(r => r.id === parseInt(selectedReptile))?.name;
          setSuccess(`Feeding successfully logged for ${reptileName}!`);
          // Reset form
          setInsectQuantity(1);
          setSelectedSaladComponents([]);
          setSelectedSupplements([]);
          setNotes('');
          setPreparedFoodQuantity(1);

          setTimeout(() => navigate(`/reptiles/${selectedReptile}`), 1500);
        }
    } catch (err) {
        console.error("Failed to save feeding:", err);
        setError(err.response?.data?.detail || "An unexpected error occurred while saving.");
    }
  };

  if (loading) return <p className="text-center py-12">Loading...</p>;

  // VIEW MODE - Read-only display with Edit/Delete buttons
  if (mode === 'view' && existingFeeding) {
    const reptileName = reptiles.find(r => r.id === existingFeeding.reptile_id)?.name || 'Unknown';

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

        {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</p>}

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
            <p className="text-lg font-medium text-gray-900 dark:text-white">{reptileName}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fed At</p>
            <p className="text-lg font-medium text-gray-900 dark:text-white">{formatDateTime(existingFeeding.fed_at)}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Food</p>
            {existingFeeding.is_salad ? (
              <div>
                <p className="font-medium text-gray-900 dark:text-white mb-2">Salad</p>
                <p className="text-gray-700 dark:text-gray-300">
                  Components: {existingFeeding.salad_components?.map(sc => sc.name).join(', ') || 'None'}
                </p>
              </div>
            ) : existingFeeding.foods && existingFeeding.foods.length > 0 ? (
              existingFeeding.foods.map(food => (
                <p key={food.id} className="text-gray-900 dark:text-white">
                  {food.name} × {food.FeedingFood?.quantity || 1}
                </p>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400">None specified</p>
            )}
          </div>

          {existingFeeding.supplements && existingFeeding.supplements.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Supplements</p>
              <div className="flex flex-wrap gap-2">
                {existingFeeding.supplements.map(sup => (
                  <span key={sup.id} className="px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-full text-sm">
                    {sup.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {existingFeeding.notes && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Notes</p>
              <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{existingFeeding.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // EDIT/CREATE MODE - Editable form
  const pageTitle = mode === 'edit' ? 'Edit Feeding' : 'Log Feeding';

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{pageTitle}</h1>
          {mode === 'edit' && (
            <button onClick={() => setMode('view')} className="btn-secondary">
              Cancel
            </button>
          )}
        </div>

        {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</p>}
        {success && <p className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{success}</p>}

        {mode === 'edit' && existingFeeding && (
          <div className="card mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Originally logged at {formatDateTime(existingFeeding.created_at || existingFeeding.fed_at)} by {existingFeeding.user?.name || 'Unknown'}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card space-y-6">
            <div>
                <label htmlFor="reptile" className="block font-medium mb-1">Reptile</label>
                <select id="reptile" value={selectedReptile} onChange={e => setSelectedReptile(e.target.value)} className="input" required disabled={mode === 'edit'}>
                    {reptiles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
            </div>

            <div>
                <label className="block font-medium mb-2">Feeding Type</label>
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                    <button type="button" onClick={() => setLogType('insect')} className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 ${logType === 'insect' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
                        <Bug size={16} /> Insects
                    </button>
                    <button type="button" onClick={() => setLogType('salad')} className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 border-l border-r border-gray-300 dark:border-gray-600 ${logType === 'salad' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
                        <Leaf size={16} /> Salad
                    </button>
                    <button type="button" onClick={() => setLogType('prepared')} className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 ${logType === 'prepared' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
                        <Utensils size={16} /> Prepared
                    </button>
                </div>
            </div>

            {logType === 'insect' && (
                <div className="space-y-4">
                    <div>
                        <label className="block font-medium mb-2">Insect Type</label>
                        <select
                            value={selectedInsectFood}
                            onChange={(e) => setSelectedInsectFood(e.target.value)}
                            className="input w-full"
                        >
                            {insectFoods.map(food => (
                                <option key={food.id} value={food.id}>{food.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block font-medium mb-2">Quantity</label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleInsectQuantityChange(-1)}
                                className="counter-button w-12 h-12 bg-gray-200 dark:bg-gray-700 text-xl font-bold"
                            >
                                -
                            </button>
                            <input
                                type="number"
                                value={insectQuantity}
                                onChange={e => setInsectQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                className="input text-center w-20 text-lg font-semibold"
                            />
                            <button
                                type="button"
                                onClick={() => handleInsectQuantityChange(1)}
                                className="counter-button w-12 h-12 bg-gray-200 dark:bg-gray-700 text-xl font-bold"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {logType === 'salad' && (
                <div>
                    <label className="block font-medium mb-2">Salad Components</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {saladFoods.map(food => (
                            <label key={food.id} className={`flex items-center gap-2 p-3 rounded-lg border transition-colors cursor-pointer ${selectedSaladComponents.includes(food.id) ? 'bg-primary-100 dark:bg-primary-900 border-primary-400 dark:border-primary-600' : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`}>
                                <input type="checkbox" checked={selectedSaladComponents.includes(food.id)} onChange={() => handleSaladToggle(food.id)} className="rounded text-primary-600 focus:ring-primary-500" />
                                <span>{food.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {logType === 'prepared' && (
                <div className="space-y-4">
                    <div>
                        <label htmlFor="prepared-food" className="block font-medium mb-1">Prepared Food</label>
                        <select id="prepared-food" value={selectedPreparedFood} onChange={e => setSelectedPreparedFood(e.target.value)} className="input">
                            {preparedFoods.map(food => <option key={food.id} value={food.id}>{food.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="prepared-quantity" className="block font-medium mb-1">Quantity</label>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setPreparedFoodQuantity(q => Math.max(1, q - 1))} className="counter-button w-10 h-10 bg-gray-200 dark:bg-gray-700">-</button>
                            <input id="prepared-quantity" type="number" value={preparedFoodQuantity} onChange={e => setPreparedFoodQuantity(parseInt(e.target.value) || 1)} className="input text-center w-16" />
                            <button type="button" onClick={() => setPreparedFoodQuantity(q => q + 1)} className="counter-button w-10 h-10 bg-gray-200 dark:bg-gray-700">+</button>
                        </div>
                    </div>
                </div>
            )}

            <div>
                <label className="block font-medium mb-2">Supplements</label>
                <div className="flex flex-wrap gap-2">
                    {supplements.map(sup => (
                        <label key={sup.id} className={`flex items-center gap-2 p-2 px-3 rounded-full border cursor-pointer transition-colors ${selectedSupplements.includes(sup.id) ? 'bg-primary-100 dark:bg-primary-900 border-primary-400 dark:border-primary-600' : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`}>
                            <input type="checkbox" checked={selectedSupplements.includes(sup.id)} onChange={() => handleSupplementToggle(sup.id)} className="hidden" />
                            <span>{sup.name}</span>
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
                            <select
                                value={period}
                                onChange={e => setPeriod(e.target.value)}
                                className="input w-20"
                            >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                            </select>
                        )}
                    </div>
                </div>
            </div>

            <div>
                <label htmlFor="notes" className="block font-medium mb-1">Notes (optional)</label>
                <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows="3" className="input" placeholder="e.g., Good feeding response"></textarea>
            </div>

            <button type="submit" className="btn-primary w-full !mt-8">
              {mode === 'edit' ? 'Update Feeding' : 'Log Feeding'}
            </button>
        </form>
    </div>
  );
}
