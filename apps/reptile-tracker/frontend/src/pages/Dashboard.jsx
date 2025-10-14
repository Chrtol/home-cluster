import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { Utensils, Clock, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { formatDateTime } from '../utils/dateFormatting';

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

  const getFeedingStatus = (reptile) => {
    // Don't show schedule status if feeding schedule not enabled
    if (!reptile.feeding_schedule_enabled || !reptile.feeding_frequency_days) {
      return null; // No status to display
    }

    if (!reptile.last_feeding) {
      return { status: 'never_fed', color: 'yellow', icon: AlertCircle, text: 'Never fed' };
    }

    const daysSinceFeeding = differenceInDays(new Date(), new Date(reptile.last_feeding));
    const daysUntilDue = reptile.feeding_frequency_days - daysSinceFeeding;

    if (daysUntilDue < 0) {
      return {
        status: 'overdue',
        color: 'red',
        icon: AlertCircle,
        text: `Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`
      };
    } else if (daysUntilDue === 0) {
      return { status: 'due_today', color: 'orange', icon: Clock, text: 'Due today' };
    } else if (daysUntilDue <= 1) {
      return { status: 'due_soon', color: 'yellow', icon: Clock, text: 'Due tomorrow' };
    } else {
      return {
        status: 'on_track',
        color: 'green',
        icon: CheckCircle,
        text: `Due in ${daysUntilDue} days`
      };
    }
  };

  if (loading) {
    return <div className="text-center text-gray-700 dark:text-gray-300">Loading dashboard...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <Link to="/feed" className="btn-primary flex items-center gap-2">
          <Utensils size={20} /> Log Feeding
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Reptile Summary */}
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 h-full">
            <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Your Reptiles ({reptiles.length})</h2>
            <div className="space-y-2">
              {reptiles.length > 0 ? (
                reptiles.map(reptile => {
                  const feedingStatus = getFeedingStatus(reptile);
                  const daysSinceFeeding = reptile.last_feeding
                    ? differenceInDays(new Date(), new Date(reptile.last_feeding))
                    : null;

                  return (
                    <Link
                      to={`/reptiles/${reptile.id}`}
                      key={reptile.id}
                      className="block p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-gray-100 dark:border-gray-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 dark:text-white truncate">{reptile.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{reptile.species}</span>
                          </div>

                          <div className="flex flex-col gap-1 text-xs">
                            {/* Last fed info */}
                            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                              <Clock size={12} className="flex-shrink-0" />
                              {reptile.last_feeding ? (
                                <span>
                                  {daysSinceFeeding === 0 ? 'Fed today' : `${daysSinceFeeding}d ago`}
                                </span>
                              ) : (
                                <span>Never fed</span>
                              )}
                            </div>

                            {/* Feeding status - only show if schedule is enabled */}
                            {feedingStatus && (
                              <div className={`flex items-center gap-1.5 ${
                                feedingStatus.color === 'red' ? 'text-red-600 dark:text-red-400 font-medium' :
                                feedingStatus.color === 'orange' ? 'text-orange-600 dark:text-orange-400 font-medium' :
                                feedingStatus.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                                feedingStatus.color === 'green' ? 'text-green-600 dark:text-green-400' :
                                'text-gray-500 dark:text-gray-400'
                              }`}>
                                <feedingStatus.icon size={12} className="flex-shrink-0" />
                                <span>{feedingStatus.text}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500 dark:text-gray-400 mb-3">No reptiles added yet.</p>
                  <Link to="/reptiles/new" className="text-primary-600 dark:text-primary-400 hover:underline text-sm">
                    Add your first reptile
                  </Link>
                </div>
              )}
            </div>
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
                          {formatDateTime(feeding.fed_at)} by {feeding.user?.name || 'Unknown'}
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