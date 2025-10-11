import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Leaf, Bug, Utensils } from 'lucide-react';

export default function FeedingLog() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Data state
  const [reptiles, setReptiles] = useState([]);
  const [foods, setFoods] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [logType, setLogType] = useState('insect'); // insect, salad, prepared
  const [selectedReptile, setSelectedReptile] = useState('');
  const [fedAt, setFedAt] = useState(new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  const [selectedSupplements, setSelectedSupplements] = useState([]);

  // Log-type specific state
  const [insectCounts, setInsectCounts] = useState({});
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

        const initialReptileId = id || (reptilesRes.data.length > 0 ? reptilesRes.data[0].id : '');
        setSelectedReptile(initialReptileId);

        const preparedFoods = foodsRes.data.filter(f => f.category === 'prepared' && f.name !== 'Salad');
        if (preparedFoods.length > 0) {
          setSelectedPreparedFood(preparedFoods[0].id);
        }

      } catch (error) {
        console.error("Failed to load data for feeding log:", error);
        setError("Failed to load required data. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const insectFoods = foods.filter(f => f.category === 'insect');
  const saladFoods = foods.filter(f => f.category === 'vegetable' || f.category === 'fruit');
  const preparedFoods = foods.filter(f => f.category === 'prepared' && f.name !== 'Salad');

  const handleInsectCountChange = (foodId, delta) => {
    setInsectCounts(prev => ({ ...prev, [foodId]: Math.max(0, (prev[foodId] || 0) + delta) }));
  };

  const handleSaladToggle = (foodId) => {
    setSelectedSaladComponents(prev => prev.includes(foodId) ? prev.filter(id => id !== foodId) : [...prev, foodId]);
  };

  const handleSupplementToggle = (supId) => {
    setSelectedSupplements(prev => prev.includes(supId) ? prev.filter(id => id !== supId) : [...prev, supId]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedReptile) {
        setError("Please select a reptile.");
        return;
    }

    let payload = {
        reptile_id: parseInt(selectedReptile),
        fed_at: new Date(fedAt).toISOString(),
        notes,
        supplements: selectedSupplements,
        foods: [],
        is_salad: false,
        salad_components: []
    };

    if (logType === 'insect') {
        payload.foods = Object.entries(insectCounts)
            .filter(([, quantity]) => quantity > 0)
            .map(([food_id, quantity]) => ({ food_id: parseInt(food_id), quantity }));
        if (payload.foods.length === 0) {
            setError("Please add at least one insect.");
            return;
        }
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
        await axios.post('/api/feedings', payload);
        const reptileName = reptiles.find(r => r.id === parseInt(selectedReptile))?.name;
        setSuccess(`Feeding successfully logged for ${reptileName}!`);
        // Reset form
        setInsectCounts({});
        setSelectedSaladComponents([]);
        setSelectedSupplements([]);
        setNotes('');

        setTimeout(() => navigate(`/reptiles/${selectedReptile}`), 1500);
    } catch (err) {
        console.error("Failed to log feeding:", err);
        setError(err.response?.data?.detail || "An unexpected error occurred while saving.");
    }
  };

  if (loading) return <p className="text-center py-12">Loading form...</p>;

  return (
    <div>
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Log Feeding</h1>
        {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</p>}
        {success && <p className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{success}</p>}

        <form onSubmit={handleSubmit} className="card space-y-6">
            <div>
                <label htmlFor="reptile" className="block font-medium mb-1">Reptile</label>
                <select id="reptile" value={selectedReptile} onChange={e => setSelectedReptile(e.target.value)} className="input" required>
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
                    {insectFoods.map(food => (
                        <div key={food.id} className="flex items-center justify-between">
                            <span className="font-medium">{food.name}</span>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => handleInsectCountChange(food.id, -1)} className="counter-button bg-gray-200 dark:bg-gray-700">-</button>
                                <input type="number" value={insectCounts[food.id] || 0} onChange={e => setInsectCounts(p => ({...p, [food.id]: parseInt(e.target.value) || 0}))} className="input text-center w-16" />
                                <button type="button" onClick={() => handleInsectCountChange(food.id, 1)} className="counter-button bg-gray-200 dark:bg-gray-700">+</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {logType === 'salad' && (
                <div>
                    <label className="block font-medium mb-2">Salad Components</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {saladFoods.map(food => (
                            <label key={food.id} className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${selectedSaladComponents.includes(food.id) ? 'bg-primary-100 dark:bg-primary-900 border-primary-400 dark:border-primary-600' : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`}>
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
                            <button type="button" onClick={() => setPreparedFoodQuantity(q => Math.max(1, q - 1))} className="counter-button bg-gray-200 dark:bg-gray-700">-</button>
                            <input id="prepared-quantity" type="number" value={preparedFoodQuantity} onChange={e => setPreparedFoodQuantity(parseInt(e.target.value) || 1)} className="input text-center w-16" />
                            <button type="button" onClick={() => setPreparedFoodQuantity(q => q + 1)} className="counter-button bg-gray-200 dark:bg-gray-700">+</button>
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

            <div>
                <label htmlFor="fedAt" className="block font-medium mb-1">Date & Time</label>
                <input type="datetime-local" id="fedAt" value={fedAt} onChange={e => setFedAt(e.target.value)} className="input" required />
            </div>

            <div>
                <label htmlFor="notes" className="block font-medium mb-1">Notes (optional)</label>
                <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows="3" className="input" placeholder="e.g., Good feeding response"></textarea>
            </div>

            <button type="submit" className="btn-primary w-full !mt-8">Log Feeding</button>
        </form>
    </div>
  );
}