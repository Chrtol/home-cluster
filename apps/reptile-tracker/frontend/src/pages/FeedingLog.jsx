import { useState, useEffect } from 'react';
import apiClient from '../api/axios';

export default function FeedingLog() {
  const [reptiles, setReptiles] = useState([]);
  const [foods, setFoods] = useState([]);
  const [supplements, setSupplements] = useState([]);

  const [selectedReptile, setSelectedReptile] = useState('');
  const [selectedFood, setSelectedFood] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedSupplements, setSelectedSupplements] = useState([]);
  const [notes, setNotes] = useState('');
  const [fedAt, setFedAt] = useState(new Date().toISOString().slice(0, 16));
  const [isSalad, setIsSalad] = useState(false);
  const [insectCounts, setInsectCounts] = useState({});
  const [selectedSalad, setSelectedSalad] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reptilesRes, foodsRes, supplementsRes] = await Promise.all([
          apiClient.get('/api/reptiles'),
          apiClient.get('/api/foods'),
          apiClient.get('/api/supplements'),
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
    if (!selectedReptile || !selectedFood) {
      alert('Please select a reptile and a food item.');
      return;
    }
    try {
      await apiClient.post('/api/feedings', {
        reptile_id: selectedReptile,
        food_id: selectedFood,
        quantity,
        supplements: selectedSupplements,
        notes,
        fed_at: new Date(fedAt).toISOString(),
      });
      navigate(`/reptiles/${selectedReptile}`);
    } catch (error) {
      console.error("Failed to log feeding:", error);
      alert("Error logging feeding. Check console for details.");
    }
  };

  if (loading) return <p className="text-gray-600 dark:text-gray-400">Loading...</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Log Feeding</h1>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 space-y-6">
        <div>
          <label htmlFor="reptile" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reptile</label>
          <select id="reptile" value={selectedReptile} onChange={e => setSelectedReptile(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            {reptiles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="food" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Food</label>
          <select id="food" value={selectedFood} onChange={e => setSelectedFood(e.target.value)} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="">Select a food</option>
            {foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</label>
          <div className="flex items-center gap-4 mt-1">
            <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="counter-button bg-gray-200 dark:bg-gray-700">-</button>
            <input type="number" id="quantity" value={quantity} onChange={e => setQuantity(parseInt(e.target.value, 10))} className="input text-center w-24" />
            <button type="button" onClick={() => setQuantity(q => q + 1)} className="counter-button bg-gray-200 dark:bg-gray-700">+</button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Supplements</label>
          <div className="space-y-2 mt-1">
            {supplements.map(s => (
              <label key={s.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  value={s.id}
                  checked={selectedSupplements.includes(s.id)}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedSupplements([...selectedSupplements, s.id]);
                    } else {
                      setSelectedSupplements(selectedSupplements.filter(id => id !== s.id));
                    }
                  }}
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <span className="text-gray-900 dark:text-white">{s.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="fedAt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date and Time</label>
          <input type="datetime-local" id="fedAt" value={fedAt} onChange={e => setFedAt(e.target.value)} className="input mt-1" />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
          <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows="3" className="input mt-1"></textarea>
        </div>

        <div className="pt-4">
          <button type="submit" className="btn-primary w-full">Log Feeding</button>
        </div>
      </form>
    </div>
  );
}