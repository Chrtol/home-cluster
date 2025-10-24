import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, differenceInDays, format } from 'date-fns';
import { Utensils, Clock, Calendar, AlertCircle, CheckCircle, TrendingUp, Scale, Droplets, Activity } from 'lucide-react';
import { formatDateTime } from '../utils/dateFormatting';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getDashboardCardSettings, getChartSettings } from '../utils/displaySettings';

export default function Dashboard() {
  const [recentFeedings, setRecentFeedings] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]); // Combined activity feed
  const [reptiles, setReptiles] = useState([]);
  const [weightData, setWeightData] = useState([]);
  const [mistingData, setMistingData] = useState({});
  const [healthData, setHealthData] = useState({});
  const [loading, setLoading] = useState(true);
  const [dashboardCards, setDashboardCards] = useState([]);
  const [chartSettings, setChartSettings] = useState(null);

  // Load display settings on mount
  useEffect(() => {
    setDashboardCards(getDashboardCardSettings());
    setChartSettings(getChartSettings());
  }, []);

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

        // Fetch misting and health data for each reptile
        const mistingPromises = reptilesRes.data.map(r =>
          axios.get(`/api/misting/reptile/${r.id}`).catch(() => ({ data: [] }))
        );
        const healthPromises = reptilesRes.data.map(r =>
          axios.get(`/api/health/reptile/${r.id}`).catch(() => ({ data: [] }))
        );

        const [mistingResults, healthResults] = await Promise.all([
          Promise.all(mistingPromises),
          Promise.all(healthPromises)
        ]);

        // Process misting data - get last misting for each reptile
        const mistingMap = {};
        reptilesRes.data.forEach((reptile, index) => {
          const logs = mistingResults[index].data;
          if (logs && logs.length > 0) {
            mistingMap[reptile.id] = logs[0].misted_at; // Already sorted by misted_at desc
          }
        });
        setMistingData(mistingMap);

        // Process health data - get last shed for each reptile
        const healthMap = {};
        reptilesRes.data.forEach((reptile, index) => {
          const records = healthResults[index].data;
          const sheds = records.filter(r => r.record_type === 'shedding');
          if (sheds && sheds.length > 0) {
            healthMap[reptile.id] = sheds[0].date; // Already sorted by date desc
          }
        });
        setHealthData(healthMap);

        // Fetch recent activity from all sources
        const allActivity = [];

        // Add feedings
        feedingsRes.data.forEach(feeding => {
          allActivity.push({
            type: 'feeding',
            id: `feeding-${feeding.id}`,
            timestamp: new Date(feeding.fed_at),
            reptile: feeding.reptile,
            data: feeding,
            icon: Utensils,
            color: 'primary'
          });
        });

        // Fetch and add recent mistings
        const recentMistingsPromises = reptilesRes.data.map(r =>
          axios.get(`/api/misting/reptile/${r.id}`).then(res =>
            res.data.slice(0, 5).map(m => ({
              type: 'misting',
              id: `misting-${m.id}`,
              timestamp: new Date(m.misted_at),
              reptile: { id: r.id, name: r.name },
              data: m,
              icon: Droplets,
              color: 'blue'
            }))
          ).catch(() => [])
        );

        // Fetch and add recent weight logs
        const recentWeightLogs = weightRes.data.slice(0, 10).map(w => ({
          type: 'weight',
          id: `weight-${w.id}`,
          timestamp: new Date(w.measured_at),
          reptile: { id: w.reptile_id, name: w.reptile_name },
          data: w,
          icon: Scale,
          color: 'purple'
        }));
        allActivity.push(...recentWeightLogs);

        // Fetch and add recent health logs
        const recentHealthPromises = reptilesRes.data.map(r =>
          axios.get(`/api/health/reptile/${r.id}`).then(res =>
            res.data.slice(0, 5).map(h => ({
              type: 'health',
              id: `health-${h.id}`,
              timestamp: new Date(h.date),
              reptile: { id: r.id, name: r.name },
              data: h,
              icon: Activity,
              color: 'green'
            }))
          ).catch(() => [])
        );

        const [mistingActivities, healthActivities] = await Promise.all([
          Promise.all(recentMistingsPromises),
          Promise.all(recentHealthPromises)
        ]);

        mistingActivities.forEach(arr => allActivity.push(...arr));
        healthActivities.forEach(arr => allActivity.push(...arr));

        // Sort by timestamp and take top 10
        allActivity.sort((a, b) => b.timestamp - a.timestamp);
        setRecentActivity(allActivity.slice(0, 10));

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

  const mistedToday = Object.values(mistingData).filter(date => {
    return differenceInDays(new Date(), new Date(date)) === 0;
  }).length;

  const shedThisMonth = Object.values(healthData).filter(date => {
    return differenceInDays(new Date(), new Date(date)) <= 30;
  }).length;

  // Prepare weight chart data with interpolation - using Statistics page logic
  const prepareWeightChartData = () => {
    if (!weightData || weightData.length === 0) return { chartData: [], reptileColors: {}, reptileNames: [] };

    const weightCard = dashboardCards.find(c => c.id === 'weight_chart');
    const interpolationMode = weightCard?.interpolationMode || 'linear';

    // Group by reptile
    const byReptile = {};
    weightData.forEach(log => {
      if (!byReptile[log.reptile_id]) {
        byReptile[log.reptile_id] = {
          name: log.reptile_name,
          data: []
        };
      }
      byReptile[log.reptile_id].data.push({
        date: format(new Date(log.measured_at), 'MMM d, yyyy'),
        dateTime: new Date(log.measured_at).getTime(),
        weight: log.weight_grams
      });
    });

    // Sort each reptile's data by date
    Object.values(byReptile).forEach(reptile => {
      reptile.data.sort((a, b) => a.dateTime - b.dateTime);
    });

    // For 'none' mode, only show actual measurements
    if (interpolationMode === 'none') {
      const allDates = [...new Set(weightData.map(log => format(new Date(log.measured_at), 'MMM d, yyyy')))].sort(
        (a, b) => new Date(a) - new Date(b)
      );

      const chartData = allDates.map(date => {
        const dataPoint = { date };
        Object.values(byReptile).forEach(reptile => {
          const logForDate = reptile.data.find(d => d.date === date);
          if (logForDate) {
            dataPoint[reptile.name] = logForDate.weight;
          }
        });
        return dataPoint;
      });

      const colors = ['#16a34a', '#2563eb', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];
      const reptileColors = {};
      Object.values(byReptile).forEach((reptile, index) => {
        reptileColors[reptile.name] = colors[index % colors.length];
      });

      return { chartData, reptileColors, reptileNames: Object.values(byReptile).map(r => r.name) };
    }

    // For interpolation modes, generate daily dates between min and max (like Statistics page)
    const allMeasurementDates = weightData.map(log => new Date(log.measured_at).getTime());
    const minDate = new Date(Math.min(...allMeasurementDates));
    const maxDate = new Date(Math.max(...allMeasurementDates));

    const dates = [];
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      dates.push(format(new Date(d), 'MMM d, yyyy'));
    }

    // Build initial dataset with interpolated values per reptile
    const chartData = dates.map(date => {
      const dataPoint = { date };
      const dateTime = new Date(date).getTime();

      Object.values(byReptile).forEach(reptile => {
        // Check for actual measurement on this date
        const actualMeasurement = reptile.data.find(d => d.date === date);
        if (actualMeasurement) {
          dataPoint[`${reptile.name}_actual`] = actualMeasurement.weight;
          dataPoint[`${reptile.name}_interpolated`] = actualMeasurement.weight;
          dataPoint[`${reptile.name}_isActual`] = true;
          return;
        }

        // Find surrounding measurements
        let before = null, after = null;
        reptile.data.forEach(measurement => {
          if (measurement.dateTime < dateTime) {
            if (!before || measurement.dateTime > before.dateTime) {
              before = measurement;
            }
          } else if (measurement.dateTime > dateTime) {
            if (!after || measurement.dateTime < after.dateTime) {
              after = measurement;
            }
          }
        });

        // Step mode - use last known weight
        if (interpolationMode === 'step') {
          if (before && after) {
            dataPoint[`${reptile.name}_interpolated`] = before.weight;
          } else if (before && !after) {
            dataPoint[`${reptile.name}_extrapolated`] = before.weight;
            dataPoint[`${reptile.name}_isExtrapolated`] = true;
          } else if (!before && after) {
            dataPoint[`${reptile.name}_extrapolated`] = after.weight;
            dataPoint[`${reptile.name}_isExtrapolated`] = true;
          }
          return;
        }

        // Linear mode - interpolate between measurements
        if (before && after) {
          // Interpolate between two measurements
          const ratio = (dateTime - before.dateTime) / (after.dateTime - before.dateTime);
          const interpolated = before.weight + (after.weight - before.weight) * ratio;
          dataPoint[`${reptile.name}_interpolated`] = parseFloat(interpolated.toFixed(1));
        } else if (before && !after) {
          // Extrapolate forward (flat line from last measurement)
          dataPoint[`${reptile.name}_extrapolated`] = before.weight;
          dataPoint[`${reptile.name}_isExtrapolated`] = true;
        } else if (!before && after) {
          // Extrapolate backward (flat line from first measurement)
          dataPoint[`${reptile.name}_extrapolated`] = after.weight;
          dataPoint[`${reptile.name}_isExtrapolated`] = true;
        }
      });

      return dataPoint;
    });

    // Add connection points for each reptile (like Statistics page lines 286-303)
    // This ensures the dashed extrapolated line connects to the solid interpolated line
    Object.values(byReptile).forEach(reptile => {
      // Find the last actual measurement where extrapolation starts
      const lastActualIndex = chartData.findIndex((d, i) =>
        d[`${reptile.name}_isActual`] &&
        i < chartData.length - 1 &&
        chartData[i + 1][`${reptile.name}_isExtrapolated`]
      );
      if (lastActualIndex >= 0) {
        // Add the last measurement point to extrapolated data for connection
        chartData[lastActualIndex][`${reptile.name}_extrapolated`] = chartData[lastActualIndex][`${reptile.name}_interpolated`];
      }

      // Find the first actual measurement where backward extrapolation ends
      const firstActualIndex = chartData.findIndex((d, i) =>
        d[`${reptile.name}_isActual`] &&
        i > 0 &&
        chartData[i - 1][`${reptile.name}_isExtrapolated`]
      );
      if (firstActualIndex >= 0) {
        // Add the first measurement point to extrapolated data for connection
        chartData[firstActualIndex][`${reptile.name}_extrapolated`] = chartData[firstActualIndex][`${reptile.name}_interpolated`];
      }
    });

    // Generate colors
    const colors = ['#16a34a', '#2563eb', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];
    const reptileColors = {};
    Object.values(byReptile).forEach((reptile, index) => {
      reptileColors[reptile.name] = colors[index % colors.length];
    });

    return { chartData, reptileColors, reptileNames: Object.values(byReptile).map(r => r.name) };
  };

  const { chartData, reptileColors, reptileNames } = prepareWeightChartData();

  // Helper function to check if a card is visible
  const isCardVisible = (cardId) => {
    const card = dashboardCards.find(c => c.id === cardId);
    return card ? card.visible : true; // Default to visible if not found
  };

  // Helper function to get card size class
  const getCardSizeClass = (cardId) => {
    const card = dashboardCards.find(c => c.id === cardId);
    if (!card || !card.size) return 'col-span-1';

    switch (card.size) {
      case 'xs':
        return 'col-span-1'; // 1/4 width on desktop (in 4-column grid)
      case 'small':
        return 'col-span-1 sm:col-span-2'; // 1/3 width (spans 2 cols in 4-col grid, but takes only 1 in smaller grids)
      case 'medium':
        return 'col-span-1 sm:col-span-3'; // 2/3 width (spans 3 cols in 4-col grid)
      case 'large':
        return 'col-span-1 sm:col-span-4'; // Full width (spans all 4 cols)
      default:
        return 'col-span-1';
    }
  };

  // Define all card rendering functions
  const renderCard = (cardId) => {
    switch (cardId) {
      case 'need_feeding':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 h-full">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${reptilesNeedingFeeding > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                <AlertCircle size={18} className={reptilesNeedingFeeding > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Need Feeding</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{reptilesNeedingFeeding}</p>
              </div>
            </div>
          </div>
        );
      case 'fed_this_week':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 h-full">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <Utensils size={18} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Fed This Week</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{feedingsThisWeek}</p>
              </div>
            </div>
          </div>
        );
      case 'misted_today':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 h-full">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Droplets size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Misted Today</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{mistedToday}</p>
              </div>
            </div>
          </div>
        );
      case 'shed_this_month':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 h-full">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Activity size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Shed This Month</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{shedThisMonth}</p>
              </div>
            </div>
          </div>
        );
      case 'weight_chart':
        if (chartData.length === 0) return null;

        // Get interpolation mode for this card (already used in prepareWeightChartData)
        const weightCard = dashboardCards.find(c => c.id === 'weight_chart');
        const interpolationMode = weightCard?.interpolationMode || 'linear';

        const lineType = interpolationMode === 'step' ? 'stepAfter' : 'monotone';

        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 h-full">
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
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} label={{ value: 'grams', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgb(31, 41, 55)', border: '1px solid rgb(75, 85, 99)', borderRadius: '0.5rem', fontSize: '12px' }} labelStyle={{ color: '#f3f4f6' }} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px' }}
                    iconSize={10}
                    content={(props) => {
                      const { payload } = props;
                      if (!payload || payload.length === 0) return null;

                      // Filter to only show reptile names (interpolated lines) and the estimated line
                      const reptileItems = payload.filter(item =>
                        reptileNames.includes(item.value) || item.value === 'Estimated'
                      );

                      const reptiles = reptileItems.filter(item => reptileNames.includes(item.value));
                      const estimated = reptileItems.find(item => item.value === 'Estimated');

                      return (
                        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '12px' }}>
                          {reptiles.map((entry, index) => (
                            <div key={`legend-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="14" height="14" style={{ display: 'inline-block' }}>
                                <line x1="0" y1="7" x2="14" y2="7" stroke={entry.color} strokeWidth="2" />
                              </svg>
                              <span style={{ color: '#6b7280' }}>{entry.value}</span>
                            </div>
                          ))}
                          {estimated && (
                            <>
                              <div style={{ width: '1px', height: '14px', backgroundColor: '#d1d5db', margin: '0 4px' }} />
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <svg width="14" height="14" style={{ display: 'inline-block' }}>
                                  <line x1="0" y1="7" x2="14" y2="7" stroke="#6b7280" strokeWidth="2" strokeDasharray="3 3" />
                                </svg>
                                <span style={{ color: '#6b7280' }}>Estimated</span>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    }}
                  />

                  {interpolationMode === 'none' ? (
                    // None mode: just show dots for actual measurements
                    reptileNames && reptileNames.map(name => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={reptileColors[name]}
                        strokeWidth={0}
                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                        activeDot={{ r: 6 }}
                        connectNulls={false}
                      />
                    ))
                  ) : (
                    <>
                      {/* Linear/Step mode: three lines per reptile */}
                      {reptileNames && reptileNames.flatMap(name => [
                        // Interpolated/actual solid line
                        <Line
                          key={`${name}_interpolated`}
                          type={lineType}
                          dataKey={`${name}_interpolated`}
                          stroke={reptileColors[name]}
                          strokeWidth={2}
                          dot={false}
                          name={name}
                          connectNulls
                        />,
                        // Extrapolated dashed line (same color as reptile)
                        <Line
                          key={`${name}_extrapolated`}
                          type={lineType}
                          dataKey={`${name}_extrapolated`}
                          stroke={reptileColors[name]}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          name={`${name}_extrapolated`}
                          connectNulls
                        />,
                        // Actual measurement dots
                        <Line
                          key={`${name}_actual`}
                          type={lineType}
                          dataKey={`${name}_actual`}
                          stroke="transparent"
                          strokeWidth={0}
                          dot={{ fill: reptileColors[name], r: 4, strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6 }}
                          name={`${name}_actual`}
                          connectNulls={false}
                        />
                      ])}
                      {/* Dummy line for "Estimated" legend item */}
                      <Line
                        key="estimated"
                        type={lineType}
                        dataKey="__estimated__"
                        stroke="#6b7280"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        name="Estimated"
                        connectNulls={false}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      case 'reptile_cards':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 h-full">
            <h2 className="text-base font-bold mb-2 text-gray-900 dark:text-white">Your Reptiles</h2>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {reptiles.length > 0 ? (
                reptiles.map(reptile => {
                  const feedingStatus = getFeedingStatus(reptile);
                  const daysSinceFeeding = reptile.last_feeding ? differenceInDays(new Date(), new Date(reptile.last_feeding)) : null;
                  const daysSinceMisting = mistingData[reptile.id] ? differenceInDays(new Date(), new Date(mistingData[reptile.id])) : null;
                  const daysSinceShed = healthData[reptile.id] ? differenceInDays(new Date(), new Date(healthData[reptile.id])) : null;

                  return (
                    <Link to={`/reptiles/${reptile.id}`} key={reptile.id} className="block p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-gray-100 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{reptile.name}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{reptile.species}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <div className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                              <Utensils size={11} className="flex-shrink-0" />
                              {reptile.last_feeding ? <span title="Days since last feeding">{daysSinceFeeding === 0 ? 'Today' : `${daysSinceFeeding}d`}</span> : <span>-</span>}
                            </div>
                            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <Droplets size={11} className="flex-shrink-0" />
                              {mistingData[reptile.id] ? <span title="Days since last misting">{daysSinceMisting === 0 ? 'Today' : `${daysSinceMisting}d`}</span> : <span>-</span>}
                            </div>
                            <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                              <Activity size={11} className="flex-shrink-0" />
                              {healthData[reptile.id] ? <span title="Days since last shed">{daysSinceShed === 0 ? 'Today' : `${daysSinceShed}d`}</span> : <span>-</span>}
                            </div>
                            {feedingStatus && (
                              <div className={`flex items-center gap-1 ${feedingStatus.color === 'red' ? 'text-red-600 dark:text-red-400 font-medium' : feedingStatus.color === 'orange' ? 'text-orange-600 dark:text-orange-400 font-medium' : feedingStatus.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' : feedingStatus.color === 'green' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
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
                  <Link to="/reptiles/new" className="text-primary-600 dark:text-primary-400 hover:underline text-sm">Add your first reptile</Link>
                </div>
              )}
            </div>
          </div>
        );
      case 'recent_activity':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 h-full">
            <h2 className="text-base font-bold mb-2 text-gray-900 dark:text-white">Recent Activity</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentActivity.length > 0 ? (
                recentActivity.map(activity => {
                  const Icon = activity.icon;
                  const colorClasses = { primary: 'text-primary-600 dark:text-primary-400', blue: 'text-blue-600 dark:text-blue-400', purple: 'text-purple-600 dark:text-purple-400', green: 'text-green-600 dark:text-green-400' };
                  let summary = '', prominentValue = null, details = '', detailLink = '';
                  switch (activity.type) {
                    case 'feeding':
                      const foodItems = activity.data.foods || [];
                      const totalItems = foodItems.reduce((sum, f) => sum + (f.quantity || 1), 0);
                      prominentValue = totalItems > 0 ? `${totalItems}` : null;
                      const foodNames = foodItems.map(f => f.food?.name || f.name).filter(Boolean).join(', ');
                      const supplements = activity.data.supplements && activity.data.supplements.length > 0 ? ` + ${activity.data.supplements.map(s => s.name).join(', ')}` : '';
                      summary = (foodNames || 'Food items') + supplements;
                      details = activity.data.notes || '';
                      detailLink = `/feed/${activity.data.id}`;
                      break;
                    case 'misting':
                      summary = 'Misting logged';
                      details = activity.data.notes || '';
                      detailLink = `/misting/${activity.data.id}`;
                      break;
                    case 'weight':
                      prominentValue = `${activity.data.weight_grams}g`;
                      summary = 'Weight recorded';
                      details = activity.data.notes || '';
                      detailLink = `/health-log/weight/${activity.data.id}`;
                      break;
                    case 'health':
                      summary = `${activity.data.record_type.replace('_', ' ')}: ${activity.data.title}`;
                      details = activity.data.description || '';
                      detailLink = `/health-log/health/${activity.data.id}`;
                      break;
                  }
                  return (
                    <Link key={activity.id} to={detailLink} className="block p-3 rounded border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                      <div className="flex items-start gap-3">
                        <Icon size={18} className={`flex-shrink-0 mt-0.5 ${colorClasses[activity.color]}`} />
                        <div className="flex-shrink-0 w-12 text-center">{prominentValue && <span className="text-lg font-bold text-gray-900 dark:text-white">{prominentValue}</span>}</div>
                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] sm:gap-4 sm:items-center">
                          <p className="font-medium text-sm text-gray-900 dark:text-white whitespace-nowrap">{activity.reptile ? activity.reptile.name : '(deleted reptile)'}</p>
                          <div className="min-w-0">
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{summary}</p>
                            {details && <p className="text-xs text-gray-500 dark:text-gray-500 truncate italic mt-0.5">"{details}"</p>}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap sm:text-right">{formatDistanceToNow(activity.timestamp, { addSuffix: true })}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No activity logged yet.</p>
                  <Link to="/feed" className="btn-primary">Log First Activity</Link>
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <Link to="/feed" className="btn-primary flex items-center gap-2 text-sm sm:text-base w-full sm:w-auto justify-center">
          <Utensils size={18} className="sm:w-5 sm:h-5" /> Log Feeding
        </Link>
      </div>

      {/* Unified Grid Layout - Renders all cards in user's preferred order with custom sizing */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        {dashboardCards
          .filter(card => card.visible)
          .map(card => {
            const content = renderCard(card.id);
            if (!content) return null;

            return (
              <div key={card.id} className={`${getCardSizeClass(card.id)}`}>
                {content}
              </div>
            );
          })
        }
      </div>
    </div>
  );
}