import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import { formatDate, formatDateTime } from '../utils/dateFormatting';
import FeedingRotationManager from '../components/FeedingRotationManager';

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
  const [mistingLogs, setMistingLogs] = useState([]);
  const [weightLogs, setWeightLogs] = useState([]);
  const [healthRecords, setHealthRecords] = useState([]);
  const [activeTab, setActiveTab] = useState('feedings');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reptileRes, feedingsRes, mistingRes, weightRes, healthRes] = await Promise.all([
          axios.get(`/api/reptiles/${id}`),
          axios.get(`/api/feedings?reptile_id=${id}`),
          axios.get(`/api/misting/reptile/${id}`),
          axios.get(`/api/weight/reptile/${id}`),
          axios.get(`/api/health/reptile/${id}`)
        ]);
        setReptile(reptileRes.data);
        setFeedings(feedingsRes.data);
        setMistingLogs(mistingRes.data);
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

  const handleToggleActive = async () => {
    const newActiveState = !reptile.is_active;
    const action = newActiveState ? 'unhide' : 'hide';

    if (window.confirm(`Are you sure you want to ${action} this reptile? ${newActiveState ? 'It will appear in all views again.' : 'It will be hidden from most views.'}`)) {
      try {
        await axios.put(`/api/reptiles/${id}`, { is_active: newActiveState });
        setReptile({ ...reptile, is_active: newActiveState });
      } catch (error) {
        console.error(`Error ${action}ing reptile:`, error);
        alert(`Failed to ${action} reptile. You may not have permission.`);
      }
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this reptile? This action cannot be undone!')) {
      axios.delete(`/api/reptiles/${id}`)
        .then(() => {
          navigate('/reptiles');
        })
        .catch(error => {
          console.error('Error deleting reptile:', error);
          alert('Failed to delete reptile. You may not have permission.');
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

  const handleDeleteMisting = async (mistingId) => {
    if (window.confirm('Are you sure you want to delete this misting log?')) {
      try {
        await axios.delete(`/api/misting/${mistingId}`);
        setMistingLogs(mistingLogs.filter(m => m.id !== mistingId));
      } catch (error) {
        console.error('Error deleting misting log:', error);
        alert('Failed to delete misting log. You may not have permission.');
      }
    }
  };

  const handleDeleteWeight = async (weightId) => {
    if (window.confirm('Are you sure you want to delete this weight log?')) {
      try {
        await axios.delete(`/api/weight/${weightId}`);
        setWeightLogs(weightLogs.filter(w => w.id !== weightId));
      } catch (error) {
        console.error('Error deleting weight log:', error);
        alert('Failed to delete weight log. You may not have permission.');
      }
    }
  };

  const handleDeleteHealth = async (healthId) => {
    if (window.confirm('Are you sure you want to delete this health record?')) {
      try {
        await axios.delete(`/api/health/${healthId}`);
        setHealthRecords(healthRecords.filter(h => h.id !== healthId));
      } catch (error) {
        console.error('Error deleting health record:', error);
        alert('Failed to delete health record. You may not have permission.');
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
    rotation: (
      <FeedingRotationManager reptileId={reptile.id} reptileName={reptile.name} />
    ),
    feedings: (
      <div className="space-y-4">
        {feedings.map(f => (
          <div key={f.id} className="relative group">
            <Link
              to={`/feed/${f.id}`}
              className="block p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-20">
                  <p className="text-gray-900 dark:text-white">
                    <strong>{formatDateTime(f.fed_at)}</strong> by {f.user?.name}
                  </p>
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
              </div>
            </Link>
            <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Link
                to={`/feed/${f.id}`}
                className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                title="View/Edit feeding"
                onClick={(e) => e.stopPropagation()}
              >
                <Edit2 size={18} />
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); handleDeleteFeeding(f.id); }}
                className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Delete feeding"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    ),
    misting: (
      <div className="space-y-4">
        {mistingLogs.map(m => (
          <div key={m.id} className="relative group">
            <Link
              to={`/misting/${m.id}`}
              className="block p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-20">
                  <p className="text-gray-900 dark:text-white">
                    <strong>{formatDateTime(m.misted_at)}</strong>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{m.notes || 'No notes'}</p>
                </div>
              </div>
            </Link>
            <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Link
                to={`/misting/${m.id}`}
                className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                title="View/Edit misting"
                onClick={(e) => e.stopPropagation()}
              >
                <Edit2 size={18} />
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); handleDeleteMisting(m.id); }}
                className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Delete misting"
              >
                <Trash2 size={18} />
              </button>
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
                    <div key={w.id} className="relative group">
                      <Link
                        to={`/health-log/weight/${w.id}`}
                        className="block p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 pr-20">
                            <p className="text-gray-900 dark:text-white">
                              <strong>{w.weight_grams}g</strong> on {formatDate(w.measured_at)}
                            </p>
                            {w.notes && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{w.notes}</p>}
                          </div>
                        </div>
                      </Link>
                      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Link
                          to={`/health-log/weight/${w.id}`}
                          className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          title="View/Edit weight"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Edit2 size={18} />
                        </Link>
                        <button
                          onClick={(e) => { e.preventDefault(); handleDeleteWeight(w.id); }}
                          className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          title="Delete weight"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                ))}
            </div>
        </div>
    ),
    health: (
      <div className="space-y-4">
        {healthRecords.map(h => (
          <div key={h.id} className="relative group">
            <Link
              to={`/health-log/health/${h.id}`}
              className="block p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-20">
                  <p className="text-gray-900 dark:text-white">
                    <strong>{h.title}</strong> ({h.record_type}) on {formatDate(h.date)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{h.description}</p>
                </div>
              </div>
            </Link>
            <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Link
                to={`/health-log/health/${h.id}`}
                className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                title="View/Edit health record"
                onClick={(e) => e.stopPropagation()}
              >
                <Edit2 size={18} />
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); handleDeleteHealth(h.id); }}
                className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Delete health record"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    ),
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{reptile.name}</h1>
          <p className="text-gray-600 dark:text-gray-400">{reptile.species}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Link to={`/health-log/${id}`} className="btn-primary text-sm sm:text-base whitespace-nowrap">Log Health</Link>
          <Link to={`/reptiles/${id}/edit`} className="btn-secondary text-sm sm:text-base">Edit</Link>
          <button
            onClick={handleToggleActive}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              reptile.is_active
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {reptile.is_active ? (
              <>
                <EyeOff size={18} />
                Hide
              </>
            ) : (
              <>
                <Eye size={18} />
                Unhide
              </>
            )}
          </button>
          <button onClick={handleDelete} className="btn-danger text-sm sm:text-base">Delete</button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-white">Details</h2>
        <p className="text-gray-900 dark:text-white"><strong>Date of Birth:</strong> {reptile.date_of_birth ? formatDate(reptile.date_of_birth) : 'N/A'}</p>
        {reptile.length && (
          <p className="text-gray-900 dark:text-white"><strong>Length:</strong> {reptile.length} cm</p>
        )}
        {reptile.age_category && (
          <p className="text-gray-900 dark:text-white"><strong>Age Category:</strong> {reptile.age_category.charAt(0).toUpperCase() + reptile.age_category.slice(1)}</p>
        )}
        {reptile.has_uvb !== null && (
          <p className="text-gray-900 dark:text-white"><strong>UVB Lighting:</strong> {reptile.has_uvb ? 'Yes' : 'No'}</p>
        )}
        {reptile.notes && (
          <p className="text-gray-900 dark:text-white"><strong>Notes:</strong> {reptile.notes}</p>
        )}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
        <nav className="-mb-px flex space-x-4 sm:space-x-8" aria-label="Tabs">
          {Object.keys(tabs).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm capitalize`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        {tabs[activeTab]}
      </div>
    </div>
  );
}