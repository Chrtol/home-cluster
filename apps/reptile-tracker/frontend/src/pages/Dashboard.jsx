import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { PlusCircle } from 'lucide-react';

export default function Dashboard() {
  const [recentFeedings, setRecentFeedings] = useState([]);
  const [reptiles, setReptiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [feedingsRes, reptilesRes] = await Promise.all([
          axios.get('/api/feedings?limit=5'),
          axios.get('/api/reptiles')
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
    return <div className="text-center text-gray-700 dark:text-gray-300">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Reptile Summary */}
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-full">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Your Reptiles ({reptiles.length})</h2>
            <div className="space-y-3">
              {reptiles.length > 0 ? (
                reptiles.map(reptile => (
                  <Link to={`/reptiles/${reptile.id}`} key={reptile.id} className="block p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="font-semibold text-gray-900 dark:text-white">{reptile.name}</span>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {reptile.last_feeding ? `Last fed: ${formatDistanceToNow(new Date(reptile.last_feeding), { addSuffix: true })}` : 'Never fed'}
                            </p>
                        </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{reptile.species}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No reptiles added yet.</p>
              )}
            </div>
            <Link to="/reptiles/new" className="btn-primary mt-4 w-full text-center flex items-center justify-center gap-2">
              <PlusCircle size={20} /> Add Reptile
            </Link>
          </div>
        </div>

        {/* Recent Feedings */}
        <div className="md:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Recent Feedings</h2>
            <div className="space-y-4">
              {recentFeedings.length > 0 ? (
                recentFeedings.map(feeding => (
                  <div key={feeding.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {feeding.reptile ? (
                            <>Fed <Link to={`/reptiles/${feeding.reptile.id}`} className="text-primary-600 dark:text-primary-400 hover:underline">{feeding.reptile.name}</Link></>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">Fed (reptile deleted)</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {format(new Date(feeding.fed_at), 'PPP p')} by {feeding.user?.name || 'Unknown'}
                        </p>
                      </div>
                      <Link to={`/feed/${feeding.id}`} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">View Details</Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No feedings have been logged yet.</p>
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