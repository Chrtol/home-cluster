import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FoodCounter = ({ food, count, onIncrement, onDecrement }) => (
  <div className="flex items-center justify-between p-3 border rounded-lg">
    <span className="font-medium">{food.name}</span>
    <div className="flex items-center gap-3">
      <button onClick={onDecrement} className="counter-button h-10 w-10 bg-red-500 text-white">-</button>
      <span className="text-xl font-bold w-12 text-center">{count}</span>
      <button onClick={onIncrement} className="counter-button h-10 w-10 bg-green-500 text-white">+</button>
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
                className={`card p-4 text-center transition-all ${selected.includes(food.id) ? 'ring-2 ring-primary-500 bg-primary-50' : 'hover:bg-gray-50'}`}
            >
                <div className="text-sm font-medium">{food.name}</div>
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
          axios.get('/api/reptiles/'),
          axios.get('/api/foods/'),
          axios.get('/api/supplements/')
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
      await axios.post('/api/feedings/', payload);
      navigate(`/reptiles/${selectedReptile}`);
    } catch (error) {
      console.error("Failed to log feeding:", error);
      alert("Error logging feeding. Check console for details.");
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Log Feeding</h1>
      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label htmlFor="reptile" className="block text-sm font-medium text-gray-700 mb-1">Reptile</label>
          <select id="reptile" value={selectedReptile} onChange={e => setSelectedReptile(e.target.value)} className="input">
            {reptiles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <div className="flex items-center justify-center gap-4">
            <button type="button" onClick={() => setIsSalad(false)} className={!isSalad ? 'btn-primary' : 'btn-secondary'}>Insects</button>
            <button type="button" onClick={() => setIsSalad(true)} className={isSalad ? 'btn-primary' : 'btn-secondary'}>Salad</button>
        </div>

        {isSalad ? (
            <div>
                <h3 className="text-lg font-bold mb-2">Salad Components</h3>
                <SaladPicker foods={saladFoods} selected={selectedSalad} onToggle={handleToggleSalad} />
            </div>
        ) : (
            <div className="space-y-3">
                <h3 className="text-lg font-bold mb-2">Insects</h3>
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
            <h3 className="text-lg font-bold mb-2">Supplements</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {supplements.map(sup => (
                    <button type="button" key={sup.id} onClick={() => handleToggleSupplement(sup.id)} className={`p-3 rounded-lg border text-center ${selectedSupplements.includes(sup.id) ? 'bg-primary-100 ring-2 ring-primary-500' : 'hover:bg-gray-50'}`}>
                        {sup.name}
                    </button>
                ))}
            </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} className="input" rows="3"></textarea>
        </div>

        <button type="submit" className="btn-primary w-full py-3">Log Feeding</button>
      </form>
    </div>
  );
}