import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, differenceInDays, format, startOfWeek, addDays } from 'date-fns';
import { Utensils, Clock, Calendar, AlertCircle, CheckCircle, TrendingUp, Scale, Droplets, Activity, ChevronUp, Filter } from 'lucide-react';
import { formatDateTime, formatTime, getUserFirstDayOfWeek } from '../utils/dateFormatting';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getDashboardCardSettings, getChartSettings } from '../utils/displaySettings';

export default function Dashboard() {
  const [recentFeedings, setRecentFeedings] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]); // Combined activity feed
  const [reptiles, setReptiles] = useState([]);
  const [weightData, setWeightData] = useState([]);
  const [weighingData, setWeighingData] = useState({}); // Last weighing per reptile
  const [feedingData, setFeedingData] = useState({});
  const [mistingData, setMistingData] = useState({});
  const [healthData, setHealthData] = useState({});
  const [loading, setLoading] = useState(true);
  const [dashboardCards, setDashboardCards] = useState([]);
  const [chartSettings, setChartSettings] = useState(null);

  // Weekly calendar state
  const [schedules, setSchedules] = useState([]);
  const [weeklyEvents, setWeeklyEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarReptileFilter, setCalendarReptileFilter] = useState(new Set());
  const [showReptileFilter, setShowReptileFilter] = useState(false);

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

        // Fetch feeding, misting and health data for each reptile (single fetch, used for both stats and activity)
        const feedingPromises = reptilesRes.data.map(r =>
          axios.get(`/api/feedings?reptile_id=${r.id}&limit=1`).catch(() => ({ data: [] }))
        );
        const mistingPromises = reptilesRes.data.map(r =>
          axios.get(`/api/misting/reptile/${r.id}`).catch(() => ({ data: [] }))
        );
        const healthPromises = reptilesRes.data.map(r =>
          axios.get(`/api/health/reptile/${r.id}`).catch(() => ({ data: [] }))
        );

        const [feedingResults, mistingResults, healthResults] = await Promise.all([
          Promise.all(feedingPromises),
          Promise.all(mistingPromises),
          Promise.all(healthPromises)
        ]);

        // Process feeding data - get last feeding for each reptile
        const feedingMap = {};
        reptilesRes.data.forEach((reptile, index) => {
          const logs = feedingResults[index].data;
          if (logs && logs.length > 0) {
            feedingMap[reptile.id] = logs[0].fed_at; // Already sorted by fed_at desc
          }
        });
        setFeedingData(feedingMap);

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

        // Process weighing data - get last weighing for each reptile from weightData
        const weighingMap = {};
        reptilesRes.data.forEach((reptile) => {
          const reptileWeights = weightRes.data
            .filter(w => w.reptile_id === reptile.id)
            .sort((a, b) => new Date(b.measured_at) - new Date(a.measured_at));
          if (reptileWeights.length > 0) {
            weighingMap[reptile.id] = reptileWeights[0].measured_at;
          }
        });
        setWeighingData(weighingMap);

        // Build recent activity from already-fetched data
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

        // Add recent mistings from already-fetched data
        reptilesRes.data.forEach((reptile, index) => {
          const logs = mistingResults[index].data;
          logs.slice(0, 5).forEach(m => {
            allActivity.push({
              type: 'misting',
              id: `misting-${m.id}`,
              timestamp: new Date(m.misted_at),
              reptile: { id: reptile.id, name: reptile.name },
              data: m,
              icon: Droplets,
              color: 'blue'
            });
          });
        });

        // Add recent weight logs
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

        // Add recent health logs from already-fetched data
        reptilesRes.data.forEach((reptile, index) => {
          const records = healthResults[index].data;
          records.slice(0, 5).forEach(h => {
            allActivity.push({
              type: 'health',
              id: `health-${h.id}`,
              timestamp: new Date(h.date),
              reptile: { id: reptile.id, name: reptile.name },
              data: h,
              icon: Activity,
              color: 'green'
            });
          });
        });

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

  // Initialize reptile filter when reptiles are loaded
  useEffect(() => {
    if (reptiles.length > 0 && calendarReptileFilter.size === 0) {
      setCalendarReptileFilter(new Set(reptiles.map(r => r.id)));
    }
  }, [reptiles]);

  // Fetch schedules for weekly calendar
  useEffect(() => {
    if (reptiles.length > 0) {
      fetchSchedules();
    }
  }, [reptiles]);

  const fetchSchedules = async () => {
    try {
      const schedulePromises = reptiles.map(reptile =>
        axios.get(`/api/schedules/reptile/${reptile.id}`)
          .then(res => res.data.map(s => ({ ...s, reptile_name: reptile.name })))
          .catch(() => [])
      );

      const scheduleResults = await Promise.all(schedulePromises);
      const allSchedules = scheduleResults.flat();
      setSchedules(allSchedules);
      calculateWeeklyEvents(allSchedules);
    } catch (error) {
      console.error("Error fetching schedules:", error);
    }
  };

  const calculateWeeklyEvents = (scheduleList) => {
    const calculatedEvents = [];
    const today = new Date();
    const firstDayOfWeek = getUserFirstDayOfWeek() === 'monday' ? 1 : 0;

    // Get start of week
    const weekStart = startOfWeek(today, { weekStartsOn: firstDayOfWeek });
    const weekEnd = addDays(weekStart, 6);

    const baseSchedules = scheduleList.filter(s => s.schedule_rule !== "dependent");

    baseSchedules.forEach(schedule => {
      if (!schedule.enabled) return;

      if (schedule.schedule_rule === "every_x_days") {
        const frequency = schedule.frequency_days;
        let currentDay = new Date(weekStart);

        while (currentDay <= weekEnd) {
          calculatedEvents.push({
            date: new Date(currentDay),
            schedule_id: schedule.id,
            schedule_type: schedule.schedule_type,
            schedule_rule: schedule.schedule_rule,
            reptile_name: schedule.reptile_name,
            reptile_id: schedule.reptile_id,
            name: schedule.name,
            food_category: schedule.food_category,
            time_slot: schedule.time_slot,
            time_window_enabled: schedule.time_window_enabled,
            earliest_time: schedule.earliest_time,
            latest_time: schedule.latest_time,
            notes: schedule.notes,
          });
          currentDay.setDate(currentDay.getDate() + frequency);
        }
      } else if (schedule.schedule_rule === "days_of_week") {
        const days = schedule.days_of_week.split(",").map(d => parseInt(d));
        let currentDay = new Date(weekStart);

        while (currentDay <= weekEnd) {
          if (days.includes(currentDay.getDay())) {
            calculatedEvents.push({
              date: new Date(currentDay),
              schedule_id: schedule.id,
              schedule_type: schedule.schedule_type,
              schedule_rule: schedule.schedule_rule,
              reptile_name: schedule.reptile_name,
              reptile_id: schedule.reptile_id,
              name: schedule.name,
              food_category: schedule.food_category,
              time_slot: schedule.time_slot,
              time_window_enabled: schedule.time_window_enabled,
              earliest_time: schedule.earliest_time,
              latest_time: schedule.latest_time,
              notes: schedule.notes,
            });
          }
          currentDay.setDate(currentDay.getDate() + 1);
        }
      }
    });

    setWeeklyEvents(calculatedEvents);
  };

  const getEventsForDate = (date) => {
    if (!date) return [];

    return weeklyEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString() &&
             calendarReptileFilter.has(event.reptile_id);
    });
  };

  const getScheduleTypeIcon = (type) => {
    switch(type) {
      case 'feeding':
        return { Icon: Utensils, color: 'orange' };
      case 'misting':
        return { Icon: Droplets, color: 'blue' };
      case 'weighing':
        return { Icon: Scale, color: 'purple' };
      default:
        return { Icon: Calendar, color: 'gray' };
    }
  };

  const getIconColorClasses = (color) => {
    const colorMap = {
      'orange': 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
      'blue': 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      'purple': 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      'gray': 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    };
    return colorMap[color] || colorMap['gray'];
  };

  const getFeedingStatus = (reptile, lastFeedingDate = null) => {
    // Don't show schedule status if feeding schedule not enabled
    if (!reptile.feeding_schedule_enabled || !reptile.feeding_frequency_days) {
      return null; // No status to display
    }

    // Use provided lastFeedingDate or fall back to reptile.last_feeding (for backward compatibility)
    const lastFeeding = lastFeedingDate || reptile.last_feeding;

    if (!lastFeeding) {
      return { status: 'never_fed', color: 'yellow', icon: AlertCircle, text: 'Never fed' };
    }

    const daysSinceFeeding = differenceInDays(new Date(), new Date(lastFeeding));
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
    const status = getFeedingStatus(r, feedingData[r.id]);
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

    // Get all unique dates from measurements and generate daily dates for extrapolation
    const allMeasurementDates = weightData.map(log => new Date(log.measured_at).getTime());
    const minDate = new Date(Math.min(...allMeasurementDates));

    // Extend to today's date for extrapolation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxMeasurementDate = new Date(Math.max(...allMeasurementDates));
    const maxDate = new Date(Math.max(maxMeasurementDate.getTime(), today.getTime()));

    // Add 1 day padding before first measurement and after last date
    const startDate = new Date(minDate);
    startDate.setDate(startDate.getDate() - 1);

    const endDate = new Date(maxDate);
    endDate.setDate(endDate.getDate() + 1);

    const allDates = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      allDates.push(format(new Date(d), 'MMM d, yyyy'));
    }

    // Build chart data with actual measurements and interpolation/extrapolation
    const chartData = allDates.map(date => {
      const dataPoint = { date };
      const dateTime = new Date(date).getTime();

      Object.values(byReptile).forEach(reptile => {
        // Find surrounding measurements
        const firstMeasurement = reptile.data[0];
        const lastMeasurement = reptile.data[reptile.data.length - 1];

        // Normalize measurement times to midnight for comparison
        const firstMeasurementMidnight = new Date(firstMeasurement.dateTime);
        firstMeasurementMidnight.setHours(0, 0, 0, 0);
        const lastMeasurementMidnight = new Date(lastMeasurement.dateTime);
        lastMeasurementMidnight.setHours(0, 0, 0, 0);

        // Check for actual measurement on this date
        const measurement = reptile.data.find(d => d.date === date);
        if (measurement) {
          // Set actual dot and interpolated line (for connecting measurements)
          dataPoint[`${reptile.name}_actual`] = measurement.weight;
          dataPoint[`${reptile.name}_interpolated`] = measurement.weight;

          // Set extrapolated value at first/last measurement to connect dashed line
          // (tooltip formatter will hide it to prevent duplicates)
          if (date === firstMeasurement.date || date === lastMeasurement.date) {
            dataPoint[`${reptile.name}_extrapolated`] = measurement.weight;
          }
          return;
        }

        // Between measurements - don't fill in values, let chart draw straight lines
        // (The chart will connect the actual measurement dots with straight lines)
        // Use normalized midnight times for comparison
        if (dateTime > firstMeasurementMidnight.getTime() && dateTime < lastMeasurementMidnight.getTime()) {
          return;
        }

        // Before first or after last measurement - extrapolate based on mode
        // Use normalized midnight times for comparison
        if (dateTime < firstMeasurementMidnight.getTime()) {
          // Extrapolate into the past
          if (interpolationMode === 'linear' && reptile.data.length >= 2) {
            // Linear: use trend from first 2 measurements
            const secondMeasurement = reptile.data[1];
            const slope = (secondMeasurement.weight - firstMeasurement.weight) /
                         (secondMeasurement.dateTime - firstMeasurement.dateTime);
            // Project from actual first measurement timestamp to chart date
            const millisecondsSinceFirstMeasurement = dateTime - firstMeasurement.dateTime;
            const extrapolated = firstMeasurement.weight + slope * millisecondsSinceFirstMeasurement;
            dataPoint[`${reptile.name}_extrapolated`] = parseFloat(extrapolated.toFixed(1));
          } else {
            // Step: flat line
            dataPoint[`${reptile.name}_extrapolated`] = firstMeasurement.weight;
          }
        } else if (dateTime > lastMeasurementMidnight.getTime()) {
          // Extrapolate into the future
          if (interpolationMode === 'linear' && reptile.data.length >= 2) {
            // Linear: use trend from last 2 measurements
            const secondLastMeasurement = reptile.data[reptile.data.length - 2];
            const slope = (lastMeasurement.weight - secondLastMeasurement.weight) /
                         (lastMeasurement.dateTime - secondLastMeasurement.dateTime);

            // Project from actual last measurement timestamp to chart date
            const millisecondsSinceLastMeasurement = dateTime - lastMeasurement.dateTime;
            const extrapolated = lastMeasurement.weight + slope * millisecondsSinceLastMeasurement;

            dataPoint[`${reptile.name}_extrapolated`] = parseFloat(extrapolated.toFixed(1));
          } else {
            // Step: flat line
            dataPoint[`${reptile.name}_extrapolated`] = lastMeasurement.weight;
          }
        }
      });

      return dataPoint;
    });



    // Generate colors
    const colors = ['#16a34a', '#2563eb', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];
    const reptileColors = {};
    Object.values(byReptile).forEach((reptile, index) => {
      reptileColors[reptile.name] = colors[index % colors.length];
    });

    return { chartData, reptileColors, reptileNames: Object.values(byReptile).map(r => r.name) };
  };

  const { chartData, reptileColors, reptileNames} = prepareWeightChartData();

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
      case 'weekly_calendar': {
        const today = new Date();
        const firstDayOfWeek = getUserFirstDayOfWeek() === 'monday' ? 1 : 0;
        const weekStart = startOfWeek(today, { weekStartsOn: firstDayOfWeek });
        const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-gray-700 dark:text-gray-300" />
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Weekly Calendar</h2>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowReptileFilter(!showReptileFilter)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Filter reptiles"
                >
                  <Filter size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
                {showReptileFilter && (
                  <div className="absolute right-0 mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-2 z-10 min-w-[200px]">
                    {reptiles.map(reptile => (
                      <label key={reptile.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={calendarReptileFilter.has(reptile.id)}
                          onChange={(e) => {
                            const newFilter = new Set(calendarReptileFilter);
                            if (e.target.checked) {
                              newFilter.add(reptile.id);
                            } else {
                              newFilter.delete(reptile.id);
                            }
                            setCalendarReptileFilter(newFilter);
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">{reptile.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day, index) => {
                const dayEvents = getEventsForDate(day);
                const isToday = day.toDateString() === today.toDateString();

                return (
                  <div
                    key={index}
                    className={`border border-gray-200 dark:border-gray-700 rounded p-2 min-h-[120px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      isToday ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' : ''
                    }`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className="text-center mb-2">
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {format(day, 'EEE')}
                      </div>
                      <div className={`text-lg font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                        {format(day, 'd')}
                      </div>
                    </div>

                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event, idx) => {
                        const { Icon, color } = getScheduleTypeIcon(event.schedule_type);
                        return (
                          <div
                            key={idx}
                            className="text-xs px-1.5 py-0.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center gap-1"
                            title={event.name || event.reptile_name}
                          >
                            <Icon size={10} className={`flex-shrink-0 ${color === 'orange' ? 'text-primary-600 dark:text-primary-400' : color === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`} />
                            <span className="truncate text-gray-700 dark:text-gray-300">{event.reptile_name}</span>
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
      case 'weight_chart':
        if (chartData.length === 0) return null;

        // Get interpolation mode for this card (already used in prepareWeightChartData)
        const weightCard = dashboardCards.find(c => c.id === 'weight_chart');
        const interpolationMode = weightCard?.interpolationMode || 'linear';

        // Always use monotone for smooth lines - interpolation mode only affects data calculation
        const lineType = 'monotone';

        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 h-full">
            <div className="flex items-center gap-2 mb-3">
              <Scale size={18} className="text-gray-700 dark:text-gray-300" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Weight Tracking</h2>
            </div>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    minTickGap={50}
                    padding={{ left: 10, right: 10 }}
                  />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} label={{ value: 'grams', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgb(31, 41, 55)', border: '1px solid rgb(75, 85, 99)', borderRadius: '0.5rem', fontSize: '12px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    formatter={(value, name, props) => {
                      const payload = props.payload;

                      // If this is an _actual data point, show only this
                      if (name.includes('_actual')) {
                        const baseName = name.replace('_actual', '');
                        return [value, baseName];
                      }

                      // For extrapolated data, check if there's an actual point at this location
                      // (this happens at first/last measurements where we connect the dashed line)
                      if (name.includes('_extrapolated')) {
                        const baseName = name.replace('_extrapolated', '');
                        // If there's an actual measurement at this point, don't show extrapolated
                        if (payload && payload[`${baseName}_actual`] !== undefined) {
                          return null;
                        }
                        return [value, `${baseName} (estimated)`];
                      }

                      // For interpolated lines, check if there's an actual point at this location
                      if (name.includes('_interpolated')) {
                        const baseName = name.replace('_interpolated', '');
                        // If there's an actual measurement at this point, don't show interpolated
                        if (payload && payload[`${baseName}_actual`] !== undefined) {
                          return null;
                        }
                        return [value, baseName];
                      }

                      return [value, name];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '12px' }}
                    iconSize={10}
                    content={(props) => {
                      const { payload } = props;
                      if (!payload || payload.length === 0) return null;

                      // Filter to only show reptile names (not the _extrapolated or _actual variants)
                      const reptileItems = payload.filter(item =>
                        reptileNames.includes(item.value)
                      );

                      // Check if any extrapolated lines exist
                      const hasExtrapolated = payload.some(item =>
                        item.value && item.value.includes('(estimated)')
                      );

                      return (
                        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '12px' }}>
                          {reptileItems.map((entry, index) => (
                            <div key={`legend-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="14" height="14" style={{ display: 'inline-block' }}>
                                <line x1="0" y1="7" x2="14" y2="7" stroke={entry.color} strokeWidth="2" />
                              </svg>
                              <span style={{ color: '#6b7280' }}>{entry.value}</span>
                            </div>
                          ))}
                          {hasExtrapolated && (
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

                  {/* Render in order: extrapolated (lowest z-index), interpolated, then dots (highest z-index) */}
                  {reptileNames && [
                    // First: Dashed lines for extrapolated estimates (lowest z-index)
                    ...reptileNames.map(name => (
                      <Line
                        key={`${name}_extrapolated`}
                        type="linear"
                        dataKey={`${name}_extrapolated`}
                        stroke={reptileColors[name]}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        connectNulls={false}
                        name={`${name}_extrapolated`}
                        legendType="none"
                      />
                    )),
                    // Second: Solid lines connecting actual measurements
                    ...reptileNames.map(name => (
                      <Line
                        key={`${name}_interpolated`}
                        type="linear"
                        dataKey={`${name}_interpolated`}
                        stroke={reptileColors[name]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={true}
                        name={name}
                      />
                    )),
                    // Third: Dots for actual measurements (highest z-index)
                    ...reptileNames.map(name => (
                      <Line
                        key={`${name}_actual`}
                        type="linear"
                        dataKey={`${name}_actual`}
                        stroke="transparent"
                        strokeWidth={0}
                        dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: reptileColors[name] }}
                        activeDot={{ r: 6 }}
                        connectNulls={false}
                        name={`${name}_actual`}
                        legendType="none"
                      />
                    ))
                  ]}
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
                  const feedingStatus = getFeedingStatus(reptile, feedingData[reptile.id]);
                  const daysSinceFeeding = feedingData[reptile.id] ? differenceInDays(new Date(), new Date(feedingData[reptile.id])) : null;
                  const daysSinceMisting = mistingData[reptile.id] ? differenceInDays(new Date(), new Date(mistingData[reptile.id])) : null;
                  const daysSinceWeighing = weighingData[reptile.id] ? differenceInDays(new Date(), new Date(weighingData[reptile.id])) : null;
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
                              {feedingData[reptile.id] ? <span title="Days since last feeding">{daysSinceFeeding === 0 ? 'Today' : `${daysSinceFeeding}d`}</span> : <span>-</span>}
                            </div>
                            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <Droplets size={11} className="flex-shrink-0" />
                              {mistingData[reptile.id] ? <span title="Days since last misting">{daysSinceMisting === 0 ? 'Today' : `${daysSinceMisting}d`}</span> : <span>-</span>}
                            </div>
                            <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                              <Scale size={11} className="flex-shrink-0" />
                              {weighingData[reptile.id] ? <span title="Days since last weighing">{daysSinceWeighing === 0 ? 'Today' : `${daysSinceWeighing}d`}</span> : <span>-</span>}
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
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      </div>

      {/* Day Events Modal */}
      {selectedDate && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {selectedDate.toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </h2>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <ChevronUp size={24} />
              </button>
            </div>

            <div className="px-6 py-4">
              {getEventsForDate(selectedDate).length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No events scheduled for this day
                </p>
              ) : (
                <div className="space-y-3">
                  {getEventsForDate(selectedDate).map((event, idx) => {
                    const displayName = event.name || `${event.reptile_name}: ${event.schedule_type}`;
                    const { Icon: TypeIcon, color: typeColor } = getScheduleTypeIcon(event.schedule_type);

                    return (
                      <div
                        key={idx}
                        className="px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${getIconColorClasses(typeColor)}`}>
                            <TypeIcon size={20} />
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {displayName}
                            </div>
                          </div>
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {event.schedule_type}
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-x-6 gap-y-2 text-sm">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Reptile</span>
                            <span className="text-gray-900 dark:text-white font-medium">{event.reptile_name}</span>
                          </div>

                          {event.schedule_rule && (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Frequency</span>
                              <span className="text-gray-900 dark:text-white">{event.schedule_rule.replace(/_/g, ' ')}</span>
                            </div>
                          )}

                          {event.food_category && (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Food</span>
                              <span className="text-gray-900 dark:text-white">{event.food_category}</span>
                            </div>
                          )}

                          {event.time_window_enabled && event.earliest_time && event.latest_time ? (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                <Clock size={12} />
                                Time Window
                              </span>
                              <span className="text-gray-900 dark:text-white font-medium whitespace-nowrap">
                                {formatTime(new Date(`2000-01-01T${event.earliest_time}`))} - {formatTime(new Date(`2000-01-01T${event.latest_time}`))}
                              </span>
                            </div>
                          ) : event.time_slot ? (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Time</span>
                              <span className="text-gray-900 dark:text-white">{event.time_slot}</span>
                            </div>
                          ) : null}
                        </div>

                        {event.notes && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Notes:</span> {event.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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