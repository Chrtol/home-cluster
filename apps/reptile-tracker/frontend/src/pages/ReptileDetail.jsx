import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Edit2, Trash2 } from 'lucide-react';
import { formatDate, formatDateTime } from '../utils/dateFormatting';

// Edit Feeding Form Component
const EditFeedingForm = ({ feeding, reptileId, onUpdate, onCancel }) => {
  const [formData, setFormData] = useState({
    fed_at: feeding.fed_at ? new Date(feeding.fed_at).toISOString().slice(0, 16) : '',
    notes: feeding.notes || '',
    is_salad: feeding.is_salad || false,
    foods: feeding.foods?.map(f => ({ food_id: f.id, quantity: f.FeedingFood?.quantity || 1 })) || [],
    supplements: feeding.supplements?.map(s => s.id) || [],
    salad_components: feeding.salad_components?.map(sc => sc.id) || []
  });

  const [availableFoods, setAvailableFoods] = useState([]);
  const [availableSupplements, setAvailableSupplements] = useState([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [foodsRes, supplementsRes] = await Promise.all([
          axios.get('/api/foods'),
          axios.get('/api/supplements')
        ]);
        setAvailableFoods(foodsRes.data);
        setAvailableSupplements(supplementsRes.data);
      } catch (error) {
        console.error('Error fetching options:', error);
      }
    };
    fetchOptions();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(feeding.id, formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Date & Time
        </label>
        <input
          type="datetime-local"
          value={formData.fed_at}
          onChange={(e) => setFormData({ ...formData, fed_at: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Optional notes about this feeding"
        />
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p className="mb-2"><strong>Current Foods:</strong></p>
        {formData.foods.length > 0 ? (
          <ul className="list-disc list-inside">
            {formData.foods.map((f, idx) => {
              const food = availableFoods.find(af => af.id === f.food_id);
              return <li key={idx}>{food?.name} (Quantity: {f.quantity})</li>;
            })}
          </ul>
        ) : (
          <p className="italic">No foods selected</p>
        )}
      </div>

      {formData.supplements.length > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p className="mb-2"><strong>Current Supplements:</strong></p>
          <ul className="list-disc list-inside">
            {formData.supplements.map((suppId, idx) => {
              const supp = availableSupplements.find(s => s.id === suppId);
              return <li key={idx}>{supp?.name}</li>;
            })}
          </ul>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          className="flex-1 btn-primary"
        >
          Save Changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// A new component for the weight chart
const WeightChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">No weight data available to display chart.</p>;
  }

  const chartData = data.map(log => ({
    date: format(new Date(log.measured_at), 'MMM d'),
    weight: log.weight_grams,
  })).reverse();

  return (
    <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgb(31, 41, 55)',
                    border: '1px solid rgb(75, 85, 99)',
                    borderRadius: '0.5rem'
                  }}
                  labelStyle={{ color: '#f3f4f6' }}
                  itemStyle={{ color: '#22c55e' }}
                />
                <Line type="monotone" dataKey="weight" stroke="#16a34a" activeDot={{ r: 8 }} />
            </LineChart>
        </ResponsiveContainer>
    </div>
  );
};


export default function ReptileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reptile, setReptile] = useState(null);
  const [feedings, setFeedings] = useState([]);
  const [weightLogs, setWeightLogs] = useState([]);
  const [healthRecords, setHealthRecords] = useState([]);
  const [activeTab, setActiveTab] = useState('feedings');
  const [loading, setLoading] = useState(true);
  const [editingFeeding, setEditingFeeding] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reptileRes, feedingsRes, weightRes, healthRes] = await Promise.all([
          axios.get(`/api/reptiles/${id}`),
          axios.get(`/api/feedings?reptile_id=${id}`),
          axios.get(`/api/weight/reptile/${id}`),
          axios.get(`/api/health/reptile/${id}`)
        ]);
        setReptile(reptileRes.data);
        setFeedings(feedingsRes.data);
        setWeightLogs(weightRes.data);
        setHealthRecords(healthRes.data);
      } catch (error) {
        console.error('Failed to fetch reptile details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this reptile?')) {
      axios.delete(`/api/reptiles/${id}`)
        .then(() => {
          navigate('/reptiles');
        })
        .catch(error => {
          console.error('Error deleting reptile:', error);
        });
    }
  };

  const handleDeleteFeeding = async (feedingId) => {
    if (window.confirm('Are you sure you want to delete this feeding?')) {
      try {
        await axios.delete(`/api/feedings/${feedingId}`);
        setFeedings(feedings.filter(f => f.id !== feedingId));
      } catch (error) {
        console.error('Error deleting feeding:', error);
        alert('Failed to delete feeding. You may not have permission.');
      }
    }
  };

  const handleEditFeeding = (feeding) => {
    setEditingFeeding(feeding);
    setShowEditModal(true);
  };

  const handleUpdateFeeding = async (feedingId, updatedData) => {
    try {
      const response = await axios.put(`/api/feedings/${feedingId}`, updatedData);
      setFeedings(feedings.map(f => f.id === feedingId ? response.data : f));
      setShowEditModal(false);
      setEditingFeeding(null);
    } catch (error) {
      console.error('Error updating feeding:', error);
      alert('Failed to update feeding. You may not have permission.');
    }
  };

  if (loading) {
    return <div className="text-center text-gray-700 dark:text-gray-300">Loading reptile details...</div>;
  }

  if (!reptile) {
    return <div className="text-center text-red-500 dark:text-red-400">Could not load reptile data.</div>;
  }

  const tabs = {
    feedings: (
      <div className="space-y-4">
        {feedings.map(f => (
          <div key={f.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-gray-900 dark:text-white"><strong>{formatDateTime(f.fed_at)}</strong> by {f.user?.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{f.notes || 'No notes'}</p>
                {f.foods && f.foods.length > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Foods: {f.foods.map(food => `${food.name} (${food.FeedingFood?.quantity || 0})`).join(', ')}
                  </p>
                )}
                {f.supplements && f.supplements.length > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Supplements: {f.supplements.map(s => s.name).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleEditFeeding(f)}
                  className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 p-1"
                  title="Edit feeding"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDeleteFeeding(f.id)}
                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1"
                  title="Delete feeding"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    ),
    weight: (
        <div>
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Weight History</h3>
            <WeightChart data={weightLogs} />
            <div className="space-y-4 mt-6">
                {weightLogs.map(w => (
                    <div key={w.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <p className="text-gray-900 dark:text-white"><strong>{w.weight_grams}g</strong> on {formatDate(w.measured_at)}</p>
                        {w.notes && <p className="text-sm text-gray-600 dark:text-gray-400">{w.notes}</p>}
                    </div>
                ))}
            </div>
        </div>
    ),
    health: (
      <div className="space-y-4">
        {healthRecords.map(h => (
          <div key={h.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <p className="text-gray-900 dark:text-white"><strong>{h.title}</strong> ({h.record_type}) on {formatDate(h.date)}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{h.description}</p>
          </div>
        ))}
      </div>
    ),
  };

  return (
    <div>
      {/* Edit Feeding Modal */}
      {showEditModal && editingFeeding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Feeding</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingFeeding(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              <EditFeedingForm
                feeding={editingFeeding}
                reptileId={id}
                onUpdate={handleUpdateFeeding}
                onCancel={() => {
                  setShowEditModal(false);
                  setEditingFeeding(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

        <div className="flex justify-between items-center mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{reptile.name}</h1>
            <div className="flex gap-2">
                <Link to={`/health-log/${id}`} className="btn-primary">Log Health/Weight</Link>
                <Link to={`/reptiles/${id}/edit`} className="btn-secondary">Edit</Link>
                <button onClick={handleDelete} className="btn-danger">Delete</button>
            </div>
        </div>
      <p className="text-gray-600 dark:text-gray-400 mb-6">{reptile.species}</p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Details</h2>
        <p className="text-gray-900 dark:text-white"><strong>Date of Birth:</strong> {reptile.date_of_birth ? formatDate(reptile.date_of_birth) : 'N/A'}</p>
        <p className="text-gray-900 dark:text-white"><strong>Notes:</strong> {reptile.notes || 'None'}</p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {Object.keys(tabs).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {tabs[activeTab]}
      </div>
    </div>
  );
}