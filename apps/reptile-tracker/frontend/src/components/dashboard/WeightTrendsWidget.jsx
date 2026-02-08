import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import ReptileAvatar from '../ReptileAvatar';

/**
 * WeightTrendsWidget - Display weight trends with sparklines
 *
 * Shows per-reptile weight trends with:
 * - Avatar and name
 * - Current weight
 * - Sparkline chart
 * - Change percentage since last measurement
 * - Time range selector (30, 90, 180 days)
 *
 * Props:
 * - config: { timeRange: number (default 90) }
 * - size: Widget size ('xs', 'small', 'medium', 'large')
 */
const WeightTrendsWidget = ({ config = {}, size = 'small' }) => {
  const [reptileWeights, setReptileWeights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState(config.timeRange || 90);

  useEffect(() => {
    fetchWeightData();
  }, [timeRange]);

  const fetchWeightData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range for filtering
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeRange);

      // Fetch weight logs from dashboard endpoint (returns all data, filter client-side)
      const response = await axios.get('/api/weight/dashboard');

      const weighings = response.data || [];

      // Filter by date range client-side
      const filtered = weighings.filter(log => {
        const logDate = new Date(log.measured_at);
        return logDate >= startDate && logDate <= endDate;
      });

      // Group by reptile
      const byReptile = {};
      filtered.forEach(log => {
        if (!byReptile[log.reptile_id]) {
          byReptile[log.reptile_id] = {
            id: log.reptile_id,
            name: log.reptile_name,
            // Create reptile object for ReptileAvatar
            reptile: {
              id: log.reptile_id,
              name: log.reptile_name,
              avatar_photo_url: log.avatar_photo_url || null
            },
            measurements: []
          };
        }
        byReptile[log.reptile_id].measurements.push({
          weight: log.weight_grams, // API returns weight_grams, not weight
          measured_at: log.measured_at
        });
      });

      // Process each reptile's data
      const processed = Object.values(byReptile).map(reptile => {
        // Sort measurements by date (oldest first for chart)
        const sorted = reptile.measurements.sort(
          (a, b) => new Date(a.measured_at) - new Date(b.measured_at)
        );

        // Calculate change percentage
        let changePercent = null;
        if (sorted.length >= 2) {
          const latest = sorted[sorted.length - 1];
          const previous = sorted[sorted.length - 2];
          const diff = latest.weight - previous.weight;
          const percent = (diff / previous.weight) * 100;
          changePercent = percent;
        }

        return {
          ...reptile,
          measurements: sorted,
          currentWeight: sorted[sorted.length - 1]?.weight || null,
          changePercent
        };
      });

      // Only include reptiles with weight data
      const withData = processed.filter(r => r.measurements.length > 0);

      setReptileWeights(withData);
    } catch (err) {
      console.error('Failed to fetch weight data:', err);
      setError('Failed to load weight trends');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeRangeChange = (newRange) => {
    setTimeRange(newRange);
    // Optionally persist to config
    if (config.onConfigChange) {
      config.onConfigChange({ timeRange: newRange });
    }
  };

  // Format change percentage
  const formatChange = (changePercent) => {
    if (changePercent === null) return null;
    const sign = changePercent >= 0 ? '+' : '';
    return `${sign}${changePercent.toFixed(1)}%`;
  };

  // Get color class for change
  const getChangeColor = (changePercent) => {
    if (changePercent === null) return '';
    if (changePercent >= 0) return 'text-accent-400'; // green
    return 'text-status-due'; // amber
  };

  if (loading) {
    return (
      <div className="bg-surface-800 rounded-xl border border-surface-600/50 p-3">
        <div className="text-center text-gray-400 text-sm">
          Loading weight trends...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface-800 rounded-xl border border-surface-600/50 p-3">
        <div className="text-center text-red-400 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (reptileWeights.length === 0) {
    return (
      <div className="bg-surface-800 rounded-xl border border-surface-600/50 p-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Weight Trends</h2>
        </div>
        <div className="text-center text-gray-400 text-sm">
          No weight data in the last {timeRange} days
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-600/50 p-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">Weight Trends</h2>
        <select
          value={timeRange}
          onChange={(e) => handleTimeRangeChange(Number(e.target.value))}
          className="text-xs bg-surface-700 border-none rounded px-2 py-1 text-gray-400"
        >
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
          <option value={180}>180 days</option>
        </select>
      </div>

      <div className="space-y-3">
        {reptileWeights.map(reptile => (
          <div
            key={reptile.id}
            className="flex items-center gap-3"
          >
            {/* Avatar */}
            <ReptileAvatar
              reptile={reptile.reptile}
              size="sm"
            />

            {/* Name, weight, and sparkline */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-300">{reptile.name}</span>
                <span className="text-xs font-medium text-white">{reptile.currentWeight}g</span>
              </div>
              {/* Sparkline */}
              <div className="h-4 w-full">
                <ResponsiveContainer width="100%" height={16}>
                  <LineChart data={reptile.measurements}>
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Change percentage */}
            {reptile.changePercent !== null && (
              <span className={`text-xs ${getChangeColor(reptile.changePercent)}`}>
                {formatChange(reptile.changePercent)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeightTrendsWidget;
