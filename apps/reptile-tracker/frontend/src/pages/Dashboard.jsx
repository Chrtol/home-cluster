import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { PlusCircle } from 'lucide-react';

export default function Dashboard() {
  const [recentFeedings, setRecentFeedings] = useState([]);
  const [reptiles, setReptiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [feedingsRes, reptilesRes] = await Promise.all([
          axios.get('/api/feedings/?limit=5'),
          axios.get('/api/reptiles/')
        ]);
        setRecentFeedings(feedingsRes.data);
        setReptiles(reptilesRes.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="text-center">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Reptile Summary */}
        <div className="md:col-span-1">
          <div className="card h-full">
            <h2 className="text-xl font-bold mb-4">Your Reptiles ({reptiles.length})</h2>
            <div className="space-y-3">
              {reptiles.length > 0 ? (
                reptiles.map(reptile => (
                  <Link to={`/reptiles/${reptile.id}`} key={reptile.id} className="block p-3 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{reptile.name}</span>
                      <span className="text-sm text-gray-500">{reptile.species}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-gray-500">No reptiles added yet.</p>
              )}
            </div>
            <Link to="/reptiles/new" className="btn-primary mt-4 w-full text-center flex items-center justify-center gap-2">
              <PlusCircle size={20} /> Add Reptile
            </Link>
          </div>
        </div>

        {/* Recent Feedings */}
        <div className="md:col-span-2">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Recent Feedings</h2>
            <div className="space-y-4">
              {recentFeedings.length > 0 ? (
                recentFeedings.map(feeding => (
                  <div key={feeding.id} className="p-3 rounded-lg border">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">
                          Fed <Link to={`/reptiles/${feeding.reptile.id}`} className="text-primary-600 hover:underline">{feeding.reptile.name}</Link>
                        </p>
                        <p className="text-sm text-gray-600">
                          {format(new Date(feeding.fed_at), 'PPP p')} by {feeding.user?.name || 'Unknown'}
                        </p>
                      </div>
                      <Link to={`/feed/${feeding.id}`} className="text-sm text-primary-600 hover:underline">View Details</Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No feedings have been logged yet.</p>
                  <Link to="/feed" className="btn-primary">Log First Feeding</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}