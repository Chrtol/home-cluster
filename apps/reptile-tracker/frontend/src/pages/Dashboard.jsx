import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, differenceInDays, format } from 'date-fns';
import { Utensils, Clock, Calendar, AlertCircle, CheckCircle, TrendingUp, Scale } from 'lucide-react';
import { formatDateTime } from '../utils/dateFormatting';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [recentFeedings, setRecentFeedings] = useState([]);
  const [reptiles, setReptiles] = useState([]);
  const [weightData, setWeightData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [feedingsRes, reptilesRes, weightRes] = await Promise.all([
          axios.get('/api/feedings?limit=5'),
          axios.get('/api/reptiles'),
          axios.get('/api/weight/dashboard')
        ]);
        setRecentFeedings(feedingsRes.data);
        setReptiles(reptilesRes.data);
        setWeightData(weightRes.data);
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

  // Calculate dashboard stats
  const reptilesNeedingFeeding = reptiles.filter(r => {
    const status = getFeedingStatus(r);
    return status && (status.status === 'overdue' || status.status === 'due_today');
  }).length;

  const feedingsThisWeek = recentFeedings.filter(f =>
    differenceInDays(new Date(), new Date(f.fed_at)) <= 7
  ).length;

  // Prepare weight chart data
  const prepareWeightChartData = () => {
    if (!weightData || weightData.length === 0) return { chartData: [], reptileColors: {} };

    // Group by reptile
    const byReptile = {};
    weightData.forEach(log => {
      if (!byReptile[log.reptile_id]) {
        byReptile[log.reptile_id] = {
          name: log.reptile_name,
          data: []
        };
      }
      byReptile[log.reptile_id].data.push(log);
    });

    // Sort each reptile's data by date
    Object.values(byReptile).forEach(reptile => {
      reptile.data.sort((a, b) => new Date(a.measured_at) - new Date(b.measured_at));
    });

    // Create chart data with all dates
    const allDates = [...new Set(weightData.map(log => format(new Date(log.measured_at), 'MMM d, yyyy')))].sort(
      (a, b) => new Date(a) - new Date(b)
    );

    const chartData = allDates.map(date => {
      const dataPoint = { date };
      Object.entries(byReptile).forEach(([reptileId, reptile]) => {
        const logForDate = reptile.data.find(
          log => format(new Date(log.measured_at), 'MMM d, yyyy') === date
        );
        if (logForDate) {
          dataPoint[reptile.name] = logForDate.weight_grams;
        }
      });
      return dataPoint;
    });

    // Generate colors for each reptile
    const colors = ['#16a34a', '#2563eb', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];
    const reptileColors = {};
    Object.values(byReptile).forEach((reptile, index) => {
      reptileColors[reptile.name] = colors[index % colors.length];
    });

    return { chartData, reptileColors, reptileNames: Object.values(byReptile).map(r => r.name) };
  };

  const { chartData, reptileColors, reptileNames } = prepareWeightChartData();

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <Link to="/feed" className="btn-primary flex items-center gap-2 text-sm sm:text-base w-full sm:w-auto justify-center">
          <Utensils size={18} className="sm:w-5 sm:h-5" /> Log Feeding
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${reptilesNeedingFeeding > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
              <AlertCircle size={20} className={reptilesNeedingFeeding > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Need Feeding</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{reptilesNeedingFeeding}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <TrendingUp size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Fed This Week</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{feedingsThisWeek}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Weight Tracking Chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Scale size={18} className="text-gray-700 dark:text-gray-300" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Weight Tracking</h2>
          </div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  stroke="#9ca3af"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'grams', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgb(31, 41, 55)',
                    border: '1px solid rgb(75, 85, 99)',
                    borderRadius: '0.5rem',
                    fontSize: '12px'
                  }}
                  labelStyle={{ color: '#f3f4f6' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px' }}
                  iconSize={10}
                />
                {reptileNames && reptileNames.map(name => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={reptileColors[name]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Reptile Summary */}
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 h-full">
            <h2 className="text-base font-bold mb-2 text-gray-900 dark:text-white">Your Reptiles</h2>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
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
                      className="block p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-gray-100 dark:border-gray-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{reptile.name}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{reptile.species}</span>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            {/* Last fed info */}
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <Clock size={11} className="flex-shrink-0" />
                              {reptile.last_feeding ? (
                                <span>
                                  {daysSinceFeeding === 0 ? 'Today' : `${daysSinceFeeding}d`}
                                </span>
                              ) : (
                                <span>Never</span>
                              )}
                            </div>

                            {/* Feeding status - only show if schedule is enabled */}
                            {feedingStatus && (
                              <div className={`flex items-center gap-1 ${
                                feedingStatus.color === 'red' ? 'text-red-600 dark:text-red-400 font-medium' :
                                feedingStatus.color === 'orange' ? 'text-orange-600 dark:text-orange-400 font-medium' :
                                feedingStatus.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                                feedingStatus.color === 'green' ? 'text-green-600 dark:text-green-400' :
                                'text-gray-500 dark:text-gray-400'
                              }`}>
                                <feedingStatus.icon size={11} className="flex-shrink-0" />
                                <span className="truncate">{feedingStatus.text}</span>
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
            <h2 className="text-base font-bold mb-2 text-gray-900 dark:text-white">Recent Activity</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentFeedings.length > 0 ? (
                recentFeedings.map(feeding => {
                  const foodSummary = feeding.foods && feeding.foods.length > 0
                    ? feeding.foods.map(f => f.food?.name).filter(Boolean).join(', ')
                    : 'No food details';

                  return (
                    <div key={feeding.id} className="p-2 rounded border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white">
                            {feeding.reptile ? (
                              <Link to={`/reptiles/${feeding.reptile.id}`} className="text-primary-600 dark:text-primary-400 hover:underline">{feeding.reptile.name}</Link>
                            ) : (
                              <span className="text-gray-500 dark:text-gray-400">(deleted reptile)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {foodSummary}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                            {formatDistanceToNow(new Date(feeding.fed_at), { addSuffix: true })} • {feeding.user?.name || 'Unknown'}
                          </p>
                        </div>
                        <Link to={`/feed/${feeding.id}`} className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0">Details</Link>
                      </div>
                    </div>
                  );
                })
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