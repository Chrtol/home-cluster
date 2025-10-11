import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const FoodCounter = ({ food, count, onIncrement, onDecrement }) => (
  <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
    <span className="font-medium text-gray-900 dark:text-white">{food.name}</span>
    <div className="flex items-center gap-3">
      <button onClick={onDecrement} className="counter-button h-10 w-10 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">-</button>
      <span className="text-xl font-bold w-12 text-center text-gray-900 dark:text-white">{count}</span>
      <button onClick={onIncrement} className="counter-button h-10 w-10 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">+</button>
    </div>
  </div>
);

const SaladPicker = ({ foods, selected, onToggle }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {foods.map(food => (
            <button
                type="button"
                key={food.id}
                onClick={() => onToggle(food.id)}
                className={`p-4 text-center transition-all rounded-lg border ${
                    selected.includes(food.id)
                        ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900 border-primary-500'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
            >
                <div className="text-sm font-medium text-gray-900 dark:text-white">{food.name}</div>
            </button>
        ))}
    </div>
);


export default function FeedingLog() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [reptiles, setReptiles] = useState([]);
  const [foods, setFoods] = useState([]);
  const [supplements, setSupplements] = useState([]);

  const [selectedReptile, setSelectedReptile] = useState('');
  const [isSalad, setIsSalad] = useState(false);
  const [insectCounts, setInsectCounts] = useState({});
  const [selectedSalad, setSelectedSalad] = useState([]);
  const [selectedSupplements, setSelectedSupplements] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reptilesRes, foodsRes, supplementsRes] = await Promise.all([
          axios.get('/api/reptiles'),
          axios.get('/api/foods'),
          axios.get('/api/supplements')
        ]);
        setReptiles(reptilesRes.data);
        setFoods(foodsRes.data);
        setSupplements(supplementsRes.data);
        if (id) setSelectedReptile(id);
        else if (reptilesRes.data.length > 0) setSelectedReptile(reptilesRes.data[0].id);
      } catch (error) {
        console.error("Failed to load data for feeding log:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const insectFoods = foods.filter(f => f.category === 'insect');
  const saladFoods = foods.filter(f => f.category === 'vegetable' || f.category === 'fruit');

  const handleIncrement = (foodId) => {
    setInsectCounts(prev => ({ ...prev, [foodId]: (prev[foodId] || 0) + 1 }));
  };

  const handleDecrement = (foodId) => {
    setInsectCounts(prev => ({ ...prev, [foodId]: Math.max(0, (prev[foodId] || 0) - 1) }));
  };

  const handleToggleSalad = (foodId) => {
    setSelectedSalad(prev =>
      prev.includes(foodId) ? prev.filter(id => id !== foodId) : [...prev, foodId]
    );
  };

  const handleToggleSupplement = (supId) => {
      setSelectedSupplements(prev =>
          prev.includes(supId) ? prev.filter(id => id !== supId) : [...prev, supId]
      );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      reptile_id: parseInt(selectedReptile),
      is_salad: isSalad,
      foods: Object.entries(insectCounts).map(([food_id, quantity]) => ({ food_id: parseInt(food_id), quantity })),
      salad_components: selectedSalad,
      supplements: selectedSupplements,
      notes,
    };

    try {
      await axios.post('/api/feedings', payload);
      navigate(`/reptiles/${selectedReptile}`);
    } catch (error) {
      console.error("Failed to log feeding:", error);
      alert("Error logging feeding. Check console for details.");
    }
  };

  if (loading) return <p className="text-gray-600 dark:text-gray-400">Loading...</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Log Feeding</h1>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 space-y-6">
        <div>
          <label htmlFor="reptile" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reptile</label>
          <select id="reptile" value={selectedReptile} onChange={e => setSelectedReptile(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            {reptiles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <div className="flex items-center justify-center gap-4">
            <button type="button" onClick={() => setIsSalad(false)} className={!isSalad ? 'px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors' : 'px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors'}>Insects</button>
            <button type="button" onClick={() => setIsSalad(true)} className={isSalad ? 'px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors' : 'px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors'}>Salad</button>
        </div>

        {isSalad ? (
            <div>
                <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Salad Components</h3>
                <SaladPicker foods={saladFoods} selected={selectedSalad} onToggle={handleToggleSalad} />
            </div>
        ) : (
            <div className="space-y-3">
                <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Insects</h3>
                {insectFoods.map(food => (
                    <FoodCounter
                        key={food.id}
                        food={food}
                        count={insectCounts[food.id] || 0}
                        onIncrement={() => handleIncrement(food.id)}
                        onDecrement={() => handleDecrement(food.id)}
                    />
                ))}
            </div>
        )}

        <div>
            <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Supplements</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {supplements.map(sup => (
                    <button type="button" key={sup.id} onClick={() => handleToggleSupplement(sup.id)} className={`p-3 rounded-lg border text-center transition-all ${selectedSupplements.includes(sup.id) ? 'bg-primary-100 dark:bg-primary-900 ring-2 ring-primary-500 border-primary-500 text-gray-900 dark:text-white' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
                        {sup.name}
                    </button>
                ))}
            </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
          <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white" rows="3"></textarea>
        </div>

        <button type="submit" className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium">Log Feeding</button>
      </form>
    </div>
  );
}