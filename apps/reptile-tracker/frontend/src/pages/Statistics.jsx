import React, { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

          {/* Weight Growth Chart */}
          {visibleData.weight && stats.weight_data.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Weight Over Time</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.weight_data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke="#9CA3AF"
                  />
                  <YAxis
                    label={{ value: 'Weight (g)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                    stroke="#9CA3AF"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#F3F4F6' }}
                    formatter={(value) => [`${value}g`, 'Weight']}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Weight (g)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Feeding Frequency Chart */}
          {visibleData.feeding && stats.feeding_data.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Feeding Frequency</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.feeding_data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke="#9CA3AF"
                  />
                  <YAxis
                    label={{ value: 'Feedings', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                    stroke="#9CA3AF"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#F3F4F6' }}
                    formatter={(value) => [`${value}`, 'Feedings']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Legend />
                  <Bar
                    dataKey="count"
                    fill="#10B981"
                    name="Feedings"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
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
          {visibleData.weight && stats.weight_data.length === 0 && (
            <div className="card">
              <p className="text-center text-gray-600 dark:text-gray-400">
                No weight data available for this period. Start tracking weight to see trends!
              </p>
            </div>
          )}
          {visibleData.feeding && stats.feeding_data.length === 0 && (
            <div className="card">
              <p className="text-center text-gray-600 dark:text-gray-400">
                No feeding data available for this period.
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
