import { useState, useEffect } from 'react';
import axios from 'axios';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { getUserFirstDayOfWeek } from '../../utils/dateFormatting';

/**
 * WeekSummaryWidget - Display this week's summary statistics
 *
 * Shows 4 stat cards in a 2x2 grid:
 * - Feedings count (green)
 * - Mistings count (blue)
 * - Scheduled count (white)
 * - Overdue count (red)
 *
 * Props:
 * - config: Widget config (currently unused)
 * - size: Widget size ('xs', 'small', 'medium', 'large')
 */
const WeekSummaryWidget = ({ config = {}, size = 'small' }) => {
  const [stats, setStats] = useState({
    feedings: 0,
    mistings: 0,
    scheduled: 0,
    overdue: 0
  });
  const [weekRange, setWeekRange] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWeeklyStats();
  }, []);

  const fetchWeeklyStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate current week range
      const today = new Date();
      const firstDayOfWeek = getUserFirstDayOfWeek();
      const weekStart = startOfWeek(today, { weekStartsOn: firstDayOfWeek });
      const weekEnd = endOfWeek(today, { weekStartsOn: firstDayOfWeek });

      // Format week range for display
      const rangeStr = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd')}`;
      setWeekRange(rangeStr);

      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      // Fetch this week's data
      const [feedingsRes, mistingsRes, schedulesRes] = await Promise.all([
        axios.get('/api/feedings', {
          params: { start_date: startDate, end_date: endDate }
        }),
        axios.get('/api/mistings', {
          params: { start_date: startDate, end_date: endDate }
        }),
        axios.get('/api/schedules', {
          params: { start_date: startDate, end_date: endDate }
        })
      ]);

      const feedings = feedingsRes.data || [];
      const mistings = mistingsRes.data || [];
      const schedules = schedulesRes.data || [];

      // Calculate stats
      const feedingCount = feedings.length;
      const mistingCount = mistings.length;

      // Count scheduled and overdue tasks
      const todayStr = format(today, 'yyyy-MM-dd');
      let scheduledCount = 0;
      let overdueCount = 0;

      schedules.forEach(schedule => {
        const scheduleDate = schedule.scheduled_date;
        const isCompleted = schedule.completed;

        if (!isCompleted) {
          if (scheduleDate < todayStr) {
            overdueCount++;
          } else if (scheduleDate >= todayStr) {
            scheduledCount++;
          }
        }
      });

      setStats({
        feedings: feedingCount,
        mistings: mistingCount,
        scheduled: scheduledCount,
        overdue: overdueCount
      });
    } catch (err) {
      console.error('Failed to fetch weekly stats:', err);
      setError('Failed to load weekly stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-4">
        <div className="text-center text-muted-foreground">
          Loading week summary...
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

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground">This Week</h2>
        <span className="text-xs text-muted-foreground">{weekRange}</span>
      </div>

      {/* 2x2 grid of stat cards */}
      <div className="grid grid-cols-2 gap-2">
        {/* Feedings */}
        <div className="bg-surface-700/50 rounded-lg p-2 text-center">
          <div className="text-lg font-semibold text-accent-400">
            {stats.feedings}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">
            Feedings
          </div>
        </div>

        {/* Mistings */}
        <div className="bg-surface-700/50 rounded-lg p-2 text-center">
          <div className="text-lg font-semibold text-status-mist">
            {stats.mistings}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">
            Mistings
          </div>
        </div>

        {/* Scheduled */}
        <div className="bg-surface-700/50 rounded-lg p-2 text-center">
          <div className="text-lg font-semibold text-foreground">
            {stats.scheduled}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">
            Scheduled
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-surface-700/50 rounded-lg p-2 text-center">
          <div className="text-lg font-semibold text-status-overdue">
            {stats.overdue}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">
            Overdue
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeekSummaryWidget;
