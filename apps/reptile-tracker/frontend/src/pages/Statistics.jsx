import React, { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Calendar, Droplet, Heart, Scale } from 'lucide-react';
import axios from 'axios';

function Statistics() {
  const [reptiles, setReptiles] = useState([]);
  const [selectedReptile, setSelectedReptile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(90); // Days
  const [visibleData, setVisibleData] = useState({
    weight: true,
    feeding: true,
    misting: true,
    health: true
  });

  useEffect(() => {
    fetchReptiles();
  }, []);

  useEffect(() => {
    if (selectedReptile) {
      fetchStats();
    }
  }, [selectedReptile, timeRange]);

  const fetchReptiles = async () => {
    try {
      const res = await axios.get('/api/reptiles');
      setReptiles(res.data);
      if (res.data.length > 0) {
        setSelectedReptile(res.data[0].id);
      }
    } catch (e) {
      console.error('Failed to fetch reptiles', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!selectedReptile) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/stats/comprehensive/${selectedReptile}?days=${timeRange}`);
      setStats(res.data);
    } catch (e) {
      console.error('Failed to fetch stats', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleDataVisibility = (key) => {
    setVisibleData(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getWeightTrendIcon = () => {
    if (!stats?.summary?.weight_change) return <Minus className="text-gray-400" size={20} />;
    if (stats.summary.weight_change > 0) return <TrendingUp className="text-green-500" size={20} />;
    return <TrendingDown className="text-red-500" size={20} />;
  };

  const getWeightTrendColor = () => {
    if (!stats?.summary?.weight_change) return 'text-gray-600 dark:text-gray-400';
    return stats.summary.weight_change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  // Merge weight and feeding data for combined chart with interpolation
  const getCombinedData = () => {
    if (!stats) return [];

    // Get all unique dates from both datasets
    const allDates = new Set();

    stats.weight_data.forEach(item => {
      allDates.add(item.date.split('T')[0]);
    });

    stats.feeding_data.forEach(item => {
      allDates.add(item.date);
    });

    // Convert to sorted array
    const sortedDates = Array.from(allDates).sort((a, b) =>
      new Date(a) - new Date(b)
    );

    // Create weight lookup map (actual measurements)
    const weightMap = new Map();
    stats.weight_data.forEach(item => {
      const dateKey = item.date.split('T')[0];
      weightMap.set(dateKey, item.weight);
    });

    // Create feeding lookup map
    const feedingMap = new Map();
    stats.feeding_data.forEach(item => {
      feedingMap.set(item.date, item.count);
    });

    // Linear interpolation for weight
    const interpolateWeight = (date) => {
      if (weightMap.has(date)) {
        return { weight: weightMap.get(date), isActual: true };
      }

      // Find surrounding actual measurements
      const dateTime = new Date(date).getTime();
      let before = null, after = null;

      sortedDates.forEach(d => {
        const w = weightMap.get(d);
        if (w !== undefined) {
          const dTime = new Date(d).getTime();
          if (dTime < dateTime) {
            if (!before || new Date(d) > new Date(before.date)) {
              before = { date: d, weight: w };
            }
          } else if (dTime > dateTime) {
            if (!after || new Date(d) < new Date(after.date)) {
              after = { date: d, weight: w };
            }
          }
        }
      });

      // Interpolate if we have both before and after
      if (before && after) {
        const beforeTime = new Date(before.date).getTime();
        const afterTime = new Date(after.date).getTime();
        const ratio = (dateTime - beforeTime) / (afterTime - beforeTime);
        const interpolated = before.weight + (after.weight - before.weight) * ratio;
        return { weight: parseFloat(interpolated.toFixed(1)), isActual: false };
      }

      // Extrapolate forward if we only have before
      if (before && !after) {
        return { weight: before.weight, isActual: false };
      }

      // Extrapolate backward if we only have after
      if (!before && after) {
        return { weight: after.weight, isActual: false };
      }

      return null;
    };

    // Build final dataset
    return sortedDates.map(date => {
      const weightData = interpolateWeight(date);
      return {
        date,
        weight: weightData?.weight,
        weightActual: weightData?.isActual ? weightData.weight : null,
        weightInterpolated: !weightData?.isActual ? weightData?.weight : null,
        feedings: feedingMap.get(date)
      };
    });
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Loading statistics...</div>
      </div>
    );
  }

  if (reptiles.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Statistics</h1>
        <div className="card">
          <p className="text-gray-600 dark:text-gray-400">
            No reptiles found. Add a reptile to start tracking statistics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Statistics</h1>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Reptile Selector */}
          <select
            value={selectedReptile || ''}
            onChange={(e) => setSelectedReptile(parseInt(e.target.value))}
            className="input"
          >
            {reptiles.map(reptile => (
              <option key={reptile.id} value={reptile.id}>
                {reptile.name}
              </option>
            ))}
          </select>

          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="input min-w-[140px]"
          >
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>6 months</option>
            <option value={365}>1 year</option>
            <option value={730}>2 years</option>
          </select>
        </div>
      </div>

      {stats && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Weight Summary */}
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Scale size={20} className="text-blue-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Weight</h3>
                </div>
                {getWeightTrendIcon()}
              </div>
              {stats.summary.current_weight ? (
                <>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.summary.current_weight}g
                  </p>
                  {stats.summary.weight_change && (
                    <p className={`text-sm ${getWeightTrendColor()}`}>
                      {stats.summary.weight_change > 0 ? '+' : ''}
                      {stats.summary.weight_change.toFixed(1)}g ({stats.summary.weight_change_percent?.toFixed(1)}%)
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {stats.summary.weight_logs_count} measurements
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No weight data</p>
              )}
            </div>

            {/* Feeding Summary */}
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={20} className="text-green-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Feedings</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.summary.total_feedings}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {(stats.summary.total_feedings / (timeRange / 7)).toFixed(1)} per week avg
              </p>
            </div>

            {/* Misting Summary */}
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <Droplet size={20} className="text-blue-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Misting</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.summary.total_mistings}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {(stats.summary.total_mistings / (timeRange / 7)).toFixed(1)} per week avg
              </p>
            </div>

            {/* Health Events Summary */}
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <Heart size={20} className="text-red-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Health Events</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.summary.total_health_events}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Logs recorded
              </p>
            </div>
          </div>

          {/* Filter Toggles */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Show/Hide Data</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => toggleDataVisibility('weight')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  visibleData.weight
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Scale size={16} className="inline mr-2" />
                Weight
              </button>
              <button
                onClick={() => toggleDataVisibility('feeding')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  visibleData.feeding
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Calendar size={16} className="inline mr-2" />
                Feeding
              </button>
              <button
                onClick={() => toggleDataVisibility('misting')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  visibleData.misting
                    ? 'bg-blue-400 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Droplet size={16} className="inline mr-2" />
                Misting
              </button>
              <button
                onClick={() => toggleDataVisibility('health')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  visibleData.health
                    ? 'bg-red-400 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Heart size={16} className="inline mr-2" />
                Health Events
              </button>
            </div>
          </div>

          {/* Combined Weight & Feeding Chart */}
          {(visibleData.weight || visibleData.feeding) && getCombinedData().length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                Weight & Feeding Correlation
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                See how feeding frequency affects weight over time
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-4 flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-500"></span> Actual measurements
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-300 border-t-2 border-dashed border-blue-300"></span> Interpolated
                </span>
              </p>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={getCombinedData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke="#9CA3AF"
                  />
                  {/* Left Y-axis for Weight */}
                  {visibleData.weight && (
                    <YAxis
                      yAxisId="weight"
                      orientation="left"
                      label={{ value: 'Weight (g)', angle: -90, position: 'insideLeft', fill: '#3B82F6' }}
                      stroke="#3B82F6"
                    />
                  )}
                  {/* Right Y-axis for Feedings */}
                  {visibleData.feeding && (
                    <YAxis
                      yAxisId="feedings"
                      orientation="right"
                      label={{ value: 'Feedings', angle: 90, position: 'insideRight', fill: '#10B981' }}
                      stroke="#10B981"
                    />
                  )}
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#F3F4F6' }}
                    formatter={(value, name) => {
                      if (name === 'Weight (g)') return [`${value}g`, name];
                      if (name === 'Feedings') return [`${value}`, name];
                      return [value, name];
                    }}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Legend />

                  {/* Weight Lines - Actual and Interpolated */}
                  {visibleData.weight && (
                    <>
                      {/* Interpolated weight (dashed, lighter) */}
                      <Line
                        yAxisId="weight"
                        type="monotone"
                        dataKey="weightInterpolated"
                        stroke="#93C5FD"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        name="Weight (interpolated)"
                        connectNulls
                      />
                      {/* Actual weight measurements (solid, darker, with dots) */}
                      <Line
                        yAxisId="weight"
                        type="monotone"
                        dataKey="weightActual"
                        stroke="#3B82F6"
                        strokeWidth={3}
                        dot={{ fill: '#3B82F6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 7 }}
                        name="Weight (actual)"
                        connectNulls
                      />
                    </>
                  )}

                  {/* Feeding Bars */}
                  {visibleData.feeding && (
                    <Bar
                      yAxisId="feedings"
                      dataKey="feedings"
                      fill="#10B981"
                      name="Feedings"
                      radius={[8, 8, 0, 0]}
                      opacity={0.7}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Misting Frequency Chart */}
          {visibleData.misting && stats.misting_data.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Misting Frequency</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.misting_data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke="#9CA3AF"
                  />
                  <YAxis
                    label={{ value: 'Mistings', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                    stroke="#9CA3AF"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#F3F4F6' }}
                    formatter={(value) => [`${value}`, 'Mistings']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Legend />
                  <Bar
                    dataKey="count"
                    fill="#60A5FA"
                    name="Mistings"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Health Events Timeline */}
          {visibleData.health && stats.health_data.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Health Events Timeline</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {stats.health_data.map((event, index) => (
                  <div key={index} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 mt-2 rounded-full bg-red-400"></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white capitalize">
                              {event.type.replace('_', ' ')}
                            </span>
                            {event.title && (
                              <span className="text-sm text-gray-500 dark:text-gray-400">- {event.title}</span>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{event.description}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                          {new Date(event.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Data Messages */}
          {(visibleData.weight || visibleData.feeding) && getCombinedData().length === 0 && (
            <div className="card">
              <p className="text-center text-gray-600 dark:text-gray-400">
                No weight or feeding data available for this period. Start logging to see trends!
              </p>
            </div>
          )}
          {visibleData.misting && stats.misting_data.length === 0 && (
            <div className="card">
              <p className="text-center text-gray-600 dark:text-gray-400">
                No misting data available for this period.
              </p>
            </div>
          )}
          {visibleData.health && stats.health_data.length === 0 && (
            <div className="card">
              <p className="text-center text-gray-600 dark:text-gray-400">
                No health events recorded for this period.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Statistics;
