import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Edit2, Trash2 } from 'lucide-react';
import { formatDate, formatDateTime } from '../utils/dateFormatting';

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
          <div key={f.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <Link
                  to={`/feed/${f.id}`}
                  className="block hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  <p className="text-gray-900 dark:text-white">
                    <strong className="hover:underline">{formatDateTime(f.fed_at)}</strong> by <span className="hover:underline">{f.user?.name}</span>
                  </p>
                </Link>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{f.notes || 'No notes'}</p>
                {f.foods && f.foods.length > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Foods: {f.foods.map(food => `${food.name} (${food.quantity || 1})`).join(', ')}
                  </p>
                )}
                {f.supplements && f.supplements.length > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Supplements: {f.supplements.map(s => s.name).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <Link
                  to={`/feed/${f.id}`}
                  className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 p-1"
                  title="View/Edit feeding"
                >
                  <Edit2 size={18} />
                </Link>
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