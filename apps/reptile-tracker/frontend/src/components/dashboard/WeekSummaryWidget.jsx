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
      const firstDayStr = getUserFirstDayOfWeek();
      const firstDayOfWeek = firstDayStr === 'monday' ? 1 : 0;
      const weekStart = startOfWeek(today, { weekStartsOn: firstDayOfWeek });
      const weekEnd = endOfWeek(today, { weekStartsOn: firstDayOfWeek });

      const rangeStr = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd')}`;
      setWeekRange(rangeStr);

      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      const [summaryRes, instancesRes] = await Promise.all([
        axios.get('/api/stats/weekly-summary'),
        axios.get('/api/schedule-instances/calendar', {
          params: { start_date: startDate, end_date: endDate }
        })
      ]);

      const summary = summaryRes.data || {};
      const instances = instancesRes.data || [];

      const feedingCount = summary.total_feedings || 0;

      const mistingCount = instances.filter(i =>
        i.schedule?.schedule_type === 'misting' && i.status === 'completed'
      ).length;

      const todayStr = format(today, 'yyyy-MM-dd');
      let scheduledCount = 0;
      let overdueCount = 0;

      instances.forEach(instance => {
        const instanceDate = instance.scheduled_date;
        const isCompleted = instance.status === 'completed';

        if (!isCompleted) {
          if (instanceDate < todayStr) {
            overdueCount++;
          } else {
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
      <div className="bg-card rounded-lg border border-border p-3">
        <div className="text-center text-muted-foreground text-sm">
          Loading week summary...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-lg border border-border p-3">
        <div className="text-center text-destructive text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">This Week</h2>
        <span className="text-xs text-muted-foreground">{weekRange}</span>
      </div>

      {/* 2x2 grid of stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Feedings */}
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <div className="text-lg font-semibold text-primary">
            {stats.feedings}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Feedings
          </div>
        </div>

        {/* Mistings */}
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <div className="text-lg font-semibold text-blue-500">
            {stats.mistings}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Mistings
          </div>
        </div>

        {/* Scheduled */}
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <div className="text-lg font-semibold text-foreground">
            {stats.scheduled}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Scheduled
          </div>
        </div>

        {/* Overdue */}
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <div className="text-lg font-semibold text-destructive">
            {stats.overdue}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Overdue
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeekSummaryWidget;
