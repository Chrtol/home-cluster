import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// A new component for the weight chart
const WeightChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-gray-500">No weight data available to display chart.</p>;
  }

  const chartData = data.map(log => ({
    date: format(new Date(log.measured_at), 'MMM d'),
    weight: log.weight_grams,
  })).reverse();

  return (
    <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="weight" stroke="#16a34a" activeDot={{ r: 8 }} />
            </LineChart>
        </ResponsiveContainer>
    </div>
  );
};


export default function ReptileDetail() {
  const { id } = useParams();
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

  if (loading) {
    return <div className="text-center">Loading reptile details...</div>;
  }

  if (!reptile) {
    return <div className="text-center text-red-500">Could not load reptile data.</div>;
  }

  const tabs = {
    feedings: (
      <div className="space-y-4">
        {feedings.map(f => (
          <div key={f.id} className="p-3 border rounded-lg">
            <p><strong>{format(new Date(f.fed_at), 'PPP p')}</strong> by {f.user?.name}</p>
            <p className="text-sm text-gray-600">{f.notes || 'No notes'}</p>
          </div>
        ))}
      </div>
    ),
    weight: (
        <div>
            <h3 className="text-lg font-bold mb-4">Weight History</h3>
            <WeightChart data={weightLogs} />
            <div className="space-y-4 mt-6">
                {weightLogs.map(w => (
                    <div key={w.id} className="p-3 border rounded-lg">
                        <p><strong>{w.weight_grams}g</strong> on {format(new Date(w.measured_at), 'PPP')}</p>
                        {w.notes && <p className="text-sm text-gray-600">{w.notes}</p>}
                    </div>
                ))}
            </div>
        </div>
    ),
    health: (
      <div className="space-y-4">
        {healthRecords.map(h => (
          <div key={h.id} className="p-3 border rounded-lg">
            <p><strong>{h.title}</strong> ({h.record_type}) on {format(new Date(h.date), 'PPP')}</p>
            <p className="text-sm text-gray-600">{h.description}</p>
          </div>
        ))}
      </div>
    ),
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">{reptile.name}</h1>
      <p className="text-gray-600 mb-6">{reptile.species}</p>

      <div className="card mb-6">
        <h2 className="text-xl font-bold mb-4">Details</h2>
        <p><strong>Date of Birth:</strong> {reptile.date_of_birth ? format(new Date(reptile.date_of_birth), 'PPP') : 'N/A'}</p>
        <p><strong>Notes:</strong> {reptile.notes || 'None'}</p>
      </div>

      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {Object.keys(tabs).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="card">
        {tabs[activeTab]}
      </div>
    </div>
  );
}