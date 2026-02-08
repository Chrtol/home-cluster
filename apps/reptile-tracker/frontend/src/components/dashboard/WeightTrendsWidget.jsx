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
      <div className="bg-card rounded-lg shadow-sm border border-border p-4">
        <div className="text-center text-muted-foreground">
          Loading weight trends...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-4">
        <div className="text-center text-red-600 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (reptileWeights.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground">Weight Trends</h2>
        </div>
        <div className="text-center text-muted-foreground text-sm">
          No weight data in the last {timeRange} days
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground">Weight Trends</h2>
        <select
          value={timeRange}
          onChange={(e) => handleTimeRangeChange(Number(e.target.value))}
          className="text-xs px-2 py-1 rounded border border-border bg-surface-700/50 text-foreground"
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
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-700/30 transition-colors"
          >
            {/* Avatar */}
            <ReptileAvatar
              name={reptile.name}
              species={reptile.species}
              size="w-6 h-6"
              className="flex-shrink-0"
            />

            {/* Name and current weight */}
            <div className="flex-shrink-0 min-w-[100px]">
              <div className="text-sm font-medium text-foreground truncate">
                {reptile.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {reptile.currentWeight}g
              </div>
            </div>

            {/* Sparkline */}
            <div className="flex-1 min-w-[60px] h-6">
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

            {/* Change percentage */}
            {reptile.changePercent !== null && (
              <div
                className={`text-xs font-medium flex-shrink-0 ${getChangeColor(reptile.changePercent)}`}
              >
                {formatChange(reptile.changePercent)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeightTrendsWidget;
