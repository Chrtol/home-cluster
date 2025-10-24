import React, { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Calendar, Droplets, Heart, Scale, Utensils, Activity } from 'lucide-react';
import axios from 'axios';
import { getDayNames, getUserFirstDayOfWeek } from '../utils/dateFormatting';
import { getStatisticsChartSettings, getWeightInterpolationMode, getChartSettings, hasCustomStatisticsSettings } from '../utils/displaySettings';

function Statistics() {
  const [reptiles, setReptiles] = useState([]);
  const [selectedReptile, setSelectedReptile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(90); // Days
  const [selectedFood, setSelectedFood] = useState('all'); // 'all' or specific food name
  const [visibleData, setVisibleData] = useState({
    weight: true,
    feeding: true,
    misting: true,
    health: true
  });
  const [statisticsCharts, setStatisticsCharts] = useState([]);
  const [weightInterpolationMode, setWeightInterpolationMode] = useState('linear');
  const [chartSettings, setChartSettings] = useState(null);

  // Load display settings when selectedReptile changes
  useEffect(() => {
    setStatisticsCharts(getStatisticsChartSettings(selectedReptile));
    setWeightInterpolationMode(getWeightInterpolationMode());
    setChartSettings(getChartSettings());
  }, [selectedReptile]);

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

  // Get list of all available food names
  const getAvailableFoods = () => {
    if (!stats || !stats.food_data) return [];
    const foodSet = new Set();
    stats.food_data.forEach(item => {
      Object.keys(item.foods).forEach(foodName => foodSet.add(foodName));
    });
    return Array.from(foodSet).sort();
  };

  // Helper function to check if a chart is visible
  const isChartVisible = (chartId) => {
    const chart = statisticsCharts.find(c => c.id === chartId);
    return chart ? chart.visible : true; // Default to visible if not found
  };

  // Helper function to check if a summary card is visible
  const isSummaryCardVisible = (cardId) => {
    const card = statisticsCharts.find(c => c.id === cardId);
    return card ? card.visible : true; // Default to visible if not found
  };

  // Helper function to get chart size class
  const getChartSizeClass = (chartId) => {
    const chart = statisticsCharts.find(c => c.id === chartId);
    if (!chart || !chart.size) return 'col-span-1 sm:col-span-4';

    switch (chart.size) {
      case 'xs':
        return 'col-span-1'; // 1/4 width on desktop
      case 'small':
        return 'col-span-1 sm:col-span-2'; // 1/2 width
      case 'medium':
        return 'col-span-1 sm:col-span-3'; // 3/4 width
      case 'large':
        return 'col-span-1 sm:col-span-4'; // Full width
      default:
        return 'col-span-1 sm:col-span-4';
    }
  };

  // Merge weight and feeding data for combined chart with interpolation
  const getCombinedData = () => {
    if (!stats) return [];

    // Get interpolation mode for this chart
    const weightFeedingChart = statisticsCharts.find(c => c.id === 'weight_feeding');
    const interpolationMode = weightFeedingChart?.interpolationMode || 'linear';

    // Get all unique dates from both datasets
    // This ensures we include ALL feeding dates, even those before first weight measurement
    const allDates = new Set();

    // Add all weight measurement dates
    stats.weight_data.forEach(item => {
      allDates.add(item.date.split('T')[0]);
    });

    // Add all feeding dates (ensures chart extends back to earliest feeding)
    stats.feeding_data.forEach(item => {
      allDates.add(item.date);
    });

    // If we have no data at all, return empty
    if (allDates.size === 0) return [];

    // Add today's date to extend the chart forward to present
    const today = new Date().toISOString().split('T')[0];
    allDates.add(today);

    // Convert to sorted array
    let sortedDates = Array.from(allDates).sort((a, b) =>
      new Date(a) - new Date(b)
    );

    // Fill in missing dates between first and last date for smooth line rendering
    if (sortedDates.length >= 2) {
      const firstDate = new Date(sortedDates[0]);
      const lastDate = new Date(sortedDates[sortedDates.length - 1]);
      const filledDates = new Set(sortedDates);

      for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
        filledDates.add(d.toISOString().split('T')[0]);
      }

      sortedDates = Array.from(filledDates).sort((a, b) =>
        new Date(a) - new Date(b)
      );
    }

    // Create weight lookup map (actual measurements)
    const weightMap = new Map();
    stats.weight_data.forEach(item => {
      const dateKey = item.date.split('T')[0];
      weightMap.set(dateKey, item.weight);
    });

    // Create feeding lookup map (total count or specific food)
    const feedingMap = new Map();
    if (selectedFood === 'all') {
      // Use total feeding count
      stats.feeding_data.forEach(item => {
        feedingMap.set(item.date, item.count);
      });
    } else {
      // Use specific food quantity
      stats.food_data?.forEach(item => {
        if (item.foods[selectedFood]) {
          feedingMap.set(item.date, item.foods[selectedFood]);
        }
      });
    }

    // Get all weight measurement dates sorted
    const weightDates = Array.from(weightMap.keys()).sort((a, b) =>
      new Date(a) - new Date(b)
    );

    // Weight interpolation based on selected mode
    const interpolateWeight = (date) => {
      if (weightMap.has(date)) {
        return { weight: weightMap.get(date), isActual: true };
      }

      // If mode is 'none', only show actual measurements
      if (interpolationMode === 'none') {
        return null;
      }

      // Find surrounding actual measurements from weight dates only
      const dateTime = new Date(date).getTime();
      let before = null, after = null;

      weightDates.forEach(d => {
        const dTime = new Date(d).getTime();
        if (dTime < dateTime) {
          if (!before || new Date(d) > new Date(before.date)) {
            before = { date: d, weight: weightMap.get(d) };
          }
        } else if (dTime > dateTime) {
          if (!after || new Date(d) < new Date(after.date)) {
            after = { date: d, weight: weightMap.get(d) };
          }
        }
      });

      // Handle interpolation based on mode
      if (interpolationMode === 'step') {
        // Step: use last known weight
        if (before && after) {
          // Between measurements - use solid line with last known value
          return { weight: before.weight, isActual: false, isExtrapolated: false };
        }
        // Before first or after last measurement - use dashed line
        if (before && !after) {
          return { weight: before.weight, isActual: false, isExtrapolated: true };
        }
        if (!before && after) {
          return { weight: after.weight, isActual: false, isExtrapolated: true };
        }
        return null;
      }

      // Linear interpolation (default)
      // Between measurements - use solid line with linear interpolation
      if (before && after) {
        const beforeTime = new Date(before.date).getTime();
        const afterTime = new Date(after.date).getTime();
        const ratio = (dateTime - beforeTime) / (afterTime - beforeTime);
        const interpolated = before.weight + (after.weight - before.weight) * ratio;
        return { weight: parseFloat(interpolated.toFixed(1)), isActual: false, isExtrapolated: false };
      }

      // After last measurement - extrapolate into the future with trend (dashed line)
      if (before && !after) {
        // Calculate trend from last 2 measurements if available
        if (weightDates.length >= 2) {
          const lastIdx = weightDates.length - 1;
          const secondLastIdx = lastIdx - 1;
          const lastDate = new Date(weightDates[lastIdx]).getTime();
          const secondLastDate = new Date(weightDates[secondLastIdx]).getTime();
          const lastWeight = weightMap.get(weightDates[lastIdx]);
          const secondLastWeight = weightMap.get(weightDates[secondLastIdx]);

          // Calculate linear trend
          const slope = (lastWeight - secondLastWeight) / (lastDate - secondLastDate);
          const extrapolated = lastWeight + slope * (dateTime - lastDate);

          return { weight: parseFloat(extrapolated.toFixed(1)), isActual: false, isExtrapolated: true };
        }
        // If only one measurement, use flat line
        return { weight: before.weight, isActual: false, isExtrapolated: true };
      }

      // Before first measurement - extrapolate into the past with flat line (dashed line)
      if (!before && after) {
        return { weight: after.weight, isActual: false, isExtrapolated: true };
      }

      return null;
    };

    // Build final dataset with proper line connections
    const dataset = sortedDates.map(date => {
      const weightData = interpolateWeight(date);
      return {
        date,
        weight: weightData?.weight,
        weightActual: weightData?.isActual ? weightData.weight : null, // Only show dots on actual measurements
        weightInterpolated: (weightData && !weightData.isExtrapolated) ? weightData.weight : null, // Solid line for known/interpolated
        weightExtrapolated: (weightData && weightData.isExtrapolated) ? weightData.weight : null, // Dashed line for extrapolated
        feedings: feedingMap.get(date),
        isActual: weightData?.isActual || false,
        isExtrapolated: weightData?.isExtrapolated || false
      };
    });

    // Ensure dashed line connects to solid line at transition points
    // Find the last actual measurement date to connect extrapolated line
    const lastWeightIndex = dataset.findIndex((d, i) =>
      d.isActual && (!dataset[i + 1] || dataset[i + 1].isExtrapolated)
    );
    if (lastWeightIndex >= 0) {
      // Add the last measurement point to extrapolated data for connection
      dataset[lastWeightIndex].weightExtrapolated = dataset[lastWeightIndex].weight;
    }

    // Find the first actual measurement date to connect backward extrapolated line
    const firstWeightIndex = dataset.findIndex((d, i) =>
      d.isActual && i > 0 && dataset[i - 1].isExtrapolated
    );
    if (firstWeightIndex >= 0) {
      // Add the first measurement point to extrapolated data for connection
      dataset[firstWeightIndex].weightExtrapolated = dataset[firstWeightIndex].weight;
    }

    return dataset;
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Left: Filter Toggles - Inline and Horizontal */}
          {stats && (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => toggleDataVisibility('weight')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    visibleData.weight
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Scale size={16} className="inline mr-1" />
                  Weight
                </button>
                <button
                  onClick={() => toggleDataVisibility('feeding')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    visibleData.feeding
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Calendar size={16} className="inline mr-1" />
                  Feeding
                </button>
                <button
                  onClick={() => toggleDataVisibility('misting')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    visibleData.misting
                      ? 'bg-blue-400 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Droplets size={16} className="inline mr-1" />
                  Misting
                </button>
                <button
                  onClick={() => toggleDataVisibility('health')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    visibleData.health
                      ? 'bg-red-400 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Heart size={16} className="inline mr-1" />
                  Health
                </button>
              </div>

              {/* Divider */}
              <div className="hidden sm:block h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
            </>
          )}

          {/* Right: Dropdowns */}
          <div className="flex gap-3">
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
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={180}>6 months</option>
              <option value={365}>1 year</option>
              <option value={730}>2 years</option>
            </select>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* Summary Cards */}
          {isChartVisible('summary_cards') && (
            <div className={`${getChartSizeClass('summary_cards')} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`}>
            {/* Weight Summary */}
            {isSummaryCardVisible('summary_weight') && (
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Scale size={20} className="text-purple-600 dark:text-purple-400" />
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
            )}

            {/* Feeding Summary */}
            {isSummaryCardVisible('summary_feeding') && (
              <div className="card">
                <div className="flex items-center gap-2 mb-2">
                  <Utensils size={20} className="text-primary-600 dark:text-primary-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Feedings</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.summary.total_feedings}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {(stats.summary.total_feedings / (timeRange / 7)).toFixed(1)} per week avg
                </p>
              </div>
            )}

            {/* Misting Summary */}
            {isSummaryCardVisible('summary_misting') && (
              <div className="card">
                <div className="flex items-center gap-2 mb-2">
                  <Droplets size={20} className="text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Misting</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.summary.total_mistings}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {(stats.summary.total_mistings / (timeRange / 7)).toFixed(1)} per week avg
                </p>
              </div>
            )}

            {/* Health Events Summary */}
            {isSummaryCardVisible('summary_health') && (
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
            )}
          </div>
          )}

          {/* Combined Weight & Feeding Chart */}
          {isChartVisible('weight_feeding') && (visibleData.weight || visibleData.feeding) && getCombinedData().length > 0 && (
            <div className={`${getChartSizeClass('weight_feeding')} card`}>
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Weight & Feeding Correlation
                  </h2>
                  {getAvailableFoods().length > 0 && (
                    <select
                      value={selectedFood}
                      onChange={(e) => setSelectedFood(e.target.value)}
                      className="input py-1 px-2 text-sm ml-4 max-w-xs flex-shrink-0"
                    >
                      <option value="all">All Feedings</option>
                      {getAvailableFoods().map(food => (
                        <option key={food} value={food}>{food}</option>
                      ))}
                    </select>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  See how feeding frequency affects weight over time
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-4 flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-500"></span> Known weight
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-300 border-t-2 border-dashed border-blue-300"></span> Estimated weight
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 border-2 border-white"></span> Weighed
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
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />

                  {/* Feeding Bars - Placed first to appear first in legend */}
                  {visibleData.feeding && (
                    <Bar
                      yAxisId="feedings"
                      dataKey="feedings"
                      fill="#10B981"
                      name={selectedFood === 'all' ? 'Feedings' : `${selectedFood} (quantity)`}
                      radius={[8, 8, 0, 0]}
                      opacity={0.7}
                    />
                  )}

                  {/* Weight Lines - Actual, Interpolated, and Extrapolated */}
                  {visibleData.weight && (
                    <>
                      {/* Solid line for actual and interpolated weight (between measurements) */}
                      <Line
                        yAxisId="weight"
                        type="monotone"
                        dataKey="weightInterpolated"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={false}
                        name="Weight"
                        connectNulls
                      />
                      {/* Dashed line for extrapolated weight (before first/after last measurement) */}
                      <Line
                        yAxisId="weight"
                        type="monotone"
                        dataKey="weightExtrapolated"
                        stroke="#93C5FD"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        name="Estimated"
                        connectNulls
                      />
                      {/* Actual weight measurement dots (highlight on lines) */}
                      <Line
                        yAxisId="weight"
                        type="monotone"
                        dataKey="weightActual"
                        stroke="transparent"
                        strokeWidth={0}
                        dot={{ fill: '#3B82F6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 7 }}
                        name="Actual measurements"
                        connectNulls={false}
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Feeding Frequency Calendar Heatmap */}
          {isChartVisible('feeding_heatmap') && visibleData.feeding && stats.feeding_data.length > 0 && (
            <div className={`${getChartSizeClass('feeding_heatmap')} card`} style={{ maxWidth: '420px' }}>
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Feeding Activity Calendar</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Daily feeding activity over the past {timeRange} days
              </p>
              <div className="overflow-x-auto">
                <FeedingHeatmap feedingData={stats.feeding_data} timeRange={timeRange} />
              </div>
            </div>
          )}

          {/* Misting Frequency Chart */}
          {isChartVisible('misting_frequency') && visibleData.misting && stats.misting_data.length > 0 && (
            <div className={`${getChartSizeClass('misting_frequency')} card`}>
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
          {isChartVisible('health_events') && visibleData.health && stats.health_data.length > 0 && (
            <div className={`${getChartSizeClass('health_events')} card`}>
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Health Events Timeline</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {stats.health_data.map((event, index) => {
                  // Determine icon and color based on event type
                  const getEventStyle = (type) => {
                    switch (type) {
                      case 'weight':
                        return { icon: Scale, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Weight Measurement' };
                      case 'shed':
                        return { icon: Activity, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30', label: 'Shed' };
                      case 'vet_visit':
                        return { icon: Heart, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Vet Visit' };
                      case 'illness':
                        return { icon: Heart, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'Illness' };
                      case 'injury':
                        return { icon: Heart, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Injury' };
                      default:
                        return { icon: Heart, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30', label: type.replace('_', ' ') };
                    }
                  };

                  const style = getEventStyle(event.type);
                  const EventIcon = style.icon;

                  return (
                    <div key={index} className="p-3 rounded border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 p-2 rounded-lg ${style.bgColor}`}>
                          <EventIcon size={18} className={`${style.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium text-sm text-gray-900 dark:text-white capitalize">
                              {style.label}
                            </span>
                            {event.title && (
                              <span className="text-sm text-gray-600 dark:text-gray-400">{event.title}</span>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 italic">"{event.description}"</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap">
                          {new Date(event.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
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
          {visibleData.health && stats.health_data.length === 0 && (
            <div className="card">
              <p className="text-center text-gray-600 dark:text-gray-400">
                No health events recorded for this period.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Feeding Heatmap Component (GitHub-style)
function FeedingHeatmap({ feedingData, timeRange }) {
  const firstDayOfWeek = getUserFirstDayOfWeek();
  const dayLabels = getDayNames(true); // Get short names based on user preference
  // Generate calendar grid for the past N days
  const generateCalendarGrid = () => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - timeRange);

    // Create a map of dates to feeding counts
    const feedingMap = new Map();
    feedingData.forEach(item => {
      feedingMap.set(item.date, item.count);
    });

    // Generate all dates in range
    const days = [];
    const currentDate = new Date(startDate);

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const count = feedingMap.get(dateStr) || 0;

      days.push({
        date: new Date(currentDate),
        dateStr: dateStr,
        count: count,
        dayOfWeek: currentDate.getDay(),
        weekOfYear: getWeekNumber(currentDate)
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  };

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const getColor = (count) => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700';
    if (count === 1) return 'bg-green-200 dark:bg-green-900 border border-green-300 dark:border-green-800';
    if (count === 2) return 'bg-green-400 dark:bg-green-700 border border-green-500 dark:border-green-600';
    if (count === 3) return 'bg-green-500 dark:bg-green-600 border border-green-600 dark:border-green-500';
    return 'bg-green-600 dark:bg-green-500 border border-green-700 dark:border-green-400';
  };

  const days = generateCalendarGrid();

  // Group days into weeks (columns)
  const weeks = [];
  const startDayOfWeek = days[0]?.dayOfWeek || 0;
  const weekStartDay = firstDayOfWeek === 'monday' ? 1 : 0; // Monday = 1, Sunday = 0
  const weekEndDay = firstDayOfWeek === 'monday' ? 0 : 6; // Sunday = 0, Saturday = 6

  // Add padding for first week based on first day of week preference
  const paddingDays = firstDayOfWeek === 'monday'
    ? (startDayOfWeek === 0 ? 6 : startDayOfWeek - 1) // If Sunday, pad 6 days; otherwise offset by 1
    : startDayOfWeek; // Sunday-based needs no adjustment

  let currentWeek = Array(paddingDays).fill(null);

  days.forEach((day, idx) => {
    currentWeek.push(day);

    // Complete week when we hit the last day of week or last day
    if (day.dayOfWeek === weekEndDay || idx === days.length - 1) {
      // Pad the end if needed to reach 7 days
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  const maxFeedingsPerDay = Math.max(...days.map(d => d.count), 1);

  return (
    <div className="inline-flex flex-col gap-2">
        {/* Month labels row */}
        <div className="flex gap-1 pl-14">
          {weeks.map((week, weekIdx) => {
            const firstValidDay = week.find(d => d !== null);
            const showMonth = firstValidDay && (
              weekIdx === 0 ||
              firstValidDay.date.getDate() <= 7
            );

            return (
              <div key={weekIdx} className="w-3">
                {showMonth && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap -ml-2">
                    {firstValidDay.date.toLocaleDateString('en-US', { month: 'short' })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Grid with day labels */}
        <div className="flex gap-1">
          {/* Day of week labels column */}
          <div className="flex flex-col gap-1 pr-2 text-right">
            {dayLabels.map(day => (
              <div key={day} className="h-3 text-xs text-gray-600 dark:text-gray-400 flex items-center justify-end" style={{minWidth: '28px'}}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid columns (weeks) */}
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-1">
              {week.map((day, dayIdx) => {
                if (!day) {
                  return <div key={dayIdx} className="w-3 h-3"></div>;
                }

                return (
                  <div
                    key={dayIdx}
                    className={`w-3 h-3 rounded-sm ${getColor(day.count)} transition-all hover:scale-125 cursor-pointer`}
                    title={`${day.date.toLocaleDateString()}: ${day.count} feeding${day.count !== 1 ? 's' : ''}`}
                  ></div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 text-xs text-gray-600 dark:text-gray-400">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"></div>
            <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900 border border-green-300 dark:border-green-800"></div>
            <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700 border border-green-500 dark:border-green-600"></div>
            <div className="w-3 h-3 rounded-sm bg-green-500 dark:bg-green-600 border border-green-600 dark:border-green-500"></div>
            <div className="w-3 h-3 rounded-sm bg-green-600 dark:bg-green-500 border border-green-700 dark:border-green-400"></div>
          </div>
          <span>More</span>
          <span className="ml-4">Max: {maxFeedingsPerDay} per day</span>
        </div>
    </div>
  );
}

export default Statistics;
