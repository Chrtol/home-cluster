import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow, differenceInDays, format, startOfWeek, addDays } from 'date-fns';
import { Utensils, Clock, Calendar, AlertCircle, CheckCircle, TrendingUp, Scale, Droplets, Activity, ChevronUp, Filter, Bell } from 'lucide-react';
import { formatDateTime, formatTime, getUserFirstDayOfWeek, toLocalISODate } from '../utils/dateFormatting';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getDashboardCardSettings, getChartSettings } from '../utils/displaySettings';

export default function Dashboard() {
  const navigate = useNavigate();
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
  const [feedingRotations, setFeedingRotations] = useState([]); // Feeding rotations for supplement suggestions
  const [weeklyEvents, setWeeklyEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarReptileFilter, setCalendarReptileFilter] = useState(new Set());
  const [showReptileFilter, setShowReptileFilter] = useState(false);
  const [weeklyFeedings, setWeeklyFeedings] = useState([]);
  const [weeklyMistings, setWeeklyMistings] = useState([]);

  // Load calendar view from localStorage or default to 'week'
  const [calendarView, setCalendarView] = useState(() => {
    const saved = localStorage.getItem('dashboard_calendar_view');
    return saved || 'week'; // 'day', 'three-day', 'week'
  });

  // Load display settings on mount
  useEffect(() => {
    setDashboardCards(getDashboardCardSettings());
    setChartSettings(getChartSettings());
  }, []);

  // Save calendar view to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('dashboard_calendar_view', calendarView);
  }, [calendarView]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Calculate date range based on calendar view
        const today = new Date();
        const firstDayOfWeek = getUserFirstDayOfWeek() === 'monday' ? 1 : 0;

        let weekStart, weekEnd;

        if (calendarView === 'day') {
          // 1-day view: fetch only today
          weekStart = today;
          weekEnd = today;
        } else if (calendarView === 'three-day') {
          // 3-day view: fetch today + next 2 days
          weekStart = today;
          weekEnd = addDays(today, 2);
        } else {
          // Week view: fetch full week (Monday-Sunday or Sunday-Saturday)
          weekStart = startOfWeek(today, { weekStartsOn: firstDayOfWeek });
          weekEnd = addDays(weekStart, 6);
        }

        const toLocalISODate = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        // Single bulk request for all dashboard data
        const bulkResponse = await axios.get('/api/bulk/dashboard', {
          params: {
            week_start: toLocalISODate(weekStart),
            week_end: toLocalISODate(weekEnd),
            reptile_ids: calendarReptileFilter.size > 0 ? Array.from(calendarReptileFilter).join(',') : undefined
          }
        });

        const data = bulkResponse.data;

        // Set basic data
        setReptiles(data.reptiles);
        setRecentFeedings(data.recent_feedings);
        setSchedules(data.schedules);
        setFeedingRotations(data.feeding_rotations);
        setWeeklyFeedings(data.weekly_feedings);
        setWeeklyMistings(data.weekly_mistings);

        // Process weight data
        const weightArray = [];
        Object.entries(data.weight_data).forEach(([reptileId, weights]) => {
          weights.forEach(w => weightArray.push({ ...w, reptile_id: parseInt(reptileId) }));
        });
        setWeightData(weightArray);

        // Process last activity data
        const feedingMap = {};
        const mistingMap = {};
        const healthMap = {};
        const weighingMap = {};

        Object.entries(data.last_activity).forEach(([reptileId, activity]) => {
          const id = parseInt(reptileId);

          if (activity.last_feeding && activity.last_feeding.length > 0) {
            feedingMap[id] = activity.last_feeding[0].fed_at;
          }

          if (activity.last_misting && activity.last_misting.length > 0) {
            mistingMap[id] = activity.last_misting[0].misted_at;
          }

          if (activity.last_health && activity.last_health.length > 0) {
            const sheds = activity.last_health.filter(r => r.record_type === 'shedding');
            if (sheds.length > 0) {
              healthMap[id] = sheds[0].date;
            }
          }
        });

        // Get last weighing from weight_data
        Object.entries(data.weight_data).forEach(([reptileId, weights]) => {
          if (weights.length > 0) {
            weighingMap[parseInt(reptileId)] = weights[0].weighed_at;
          }
        });

        setFeedingData(feedingMap);
        setMistingData(mistingMap);
        setHealthData(healthMap);
        setWeighingData(weighingMap);

        // Build recent activity
        const allActivity = [];

        // Add recent feedings
        data.recent_feedings.forEach(feeding => {
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

        // Add recent mistings and health from last_activity
        Object.entries(data.last_activity).forEach(([reptileId, activity]) => {
          const reptile = data.reptiles.find(r => r.id === parseInt(reptileId));
          if (!reptile) return;

          if (activity.last_misting && activity.last_misting.length > 0) {
            activity.last_misting.slice(0, 5).forEach(m => {
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
          }

          if (activity.last_health && activity.last_health.length > 0) {
            activity.last_health.slice(0, 5).forEach(h => {
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
          }
        });

        // Add recent weight logs
        const recentWeightLogs = weightArray.slice(0, 10).map(w => ({
          type: 'weight',
          id: `weight-${w.id}`,
          timestamp: new Date(w.weighed_at),
          reptile: data.reptiles.find(r => r.id === w.reptile_id),
          data: w,
          icon: Scale,
          color: 'purple'
        }));
        allActivity.push(...recentWeightLogs);

        // Sort by timestamp and take top 10
        allActivity.sort((a, b) => b.timestamp - a.timestamp);
        setRecentActivity(allActivity.slice(0, 10));

        // Transform instances to event format
        const instanceEvents = data.weekly_instances
          .filter(instance => instance.schedule && instance.schedule.reptile)
          .map(instance => {
            // Parse date as local time to avoid timezone issues
            const [year, month, day] = instance.scheduled_date.split('-').map(Number);
            const localDate = new Date(year, month - 1, day);

            return {
              instance_id: instance.id,
              date: localDate,
              schedule_id: instance.schedule.id,
              schedule_type: instance.schedule.schedule_type,
              schedule_rule: instance.schedule.schedule_rule,
              reptile_name: instance.schedule.reptile.name,
              reptile_id: instance.schedule.reptile_id,
              name: instance.schedule.name,
              food_category: instance.schedule.food_category,
              time_slot: instance.schedule.time_slot,
              health_category: instance.schedule.health_category,
              time_window_enabled: instance.schedule.time_window_enabled,
              earliest_time: instance.schedule.earliest_time,
              latest_time: instance.schedule.latest_time,
              notifications_enabled: instance.schedule.notifications_enabled,
              notes: instance.schedule.notes,
              status: instance.status,
              suggested_supplements: instance.supplements || []
            };
          });

        setWeeklyEvents(instanceEvents);

      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [calendarReptileFilter, calendarView]);

  // Initialize reptile filter when reptiles are loaded
  useEffect(() => {
    if (reptiles.length > 0 && calendarReptileFilter.size === 0) {
      setCalendarReptileFilter(new Set(reptiles.map(r => r.id)));
    }
  }, [reptiles]);

  const calculateWeeklyEvents = (scheduleList, rotationsList = []) => {
    const calculatedEvents = [];
    const today = new Date();
    const firstDayOfWeek = getUserFirstDayOfWeek() === 'monday' ? 1 : 0;

    // Get start of week
    const weekStart = startOfWeek(today, { weekStartsOn: firstDayOfWeek });
    const weekEnd = addDays(weekStart, 6);

    // Group rotations by reptile for easy lookup
    const rotationsByReptile = {};
    rotationsList.forEach(rotation => {
      if (!rotationsByReptile[rotation.reptile_id]) {
        rotationsByReptile[rotation.reptile_id] = [];
      }
      rotationsByReptile[rotation.reptile_id].push(rotation);
    });

    // Helper function to find applicable supplements for a feeding event
    const getSuggestedSupplements = (reptileId, foodCategory, eventIndex, eventDate) => {
      const rotations = rotationsByReptile[reptileId] || [];

      // Filter rotations that apply to this food category
      const applicable = rotations.filter(r => {
        if (r.rotation_type !== 'supplement') return false;
        if (!r.applies_to_category || r.applies_to_category === 'all') return true;
        return r.applies_to_category === foodCategory;
      });

      // Sort by priority (lower number = higher priority)
      applicable.sort((a, b) => a.priority - b.priority);

      // Find ALL rotations that trigger on this event
      const triggeredRotations = [];
      for (const rotation of applicable) {
        let shouldTrigger = false;

        if (rotation.trigger_mode === 'feeding_count') {
          // Using eventIndex as a rough approximation of feeding number
          if ((eventIndex + 1) % rotation.every_n_feedings === 0) {
            shouldTrigger = true;
          }
        } else if (rotation.trigger_mode === 'schedule_based') {
          // Check if event date's day of week matches configured days
          if (rotation.schedule_days_of_week && eventDate) {
            const dayOfWeek = eventDate.getDay(); // 0=Sunday, 1=Monday, etc
            const configuredDays = rotation.schedule_days_of_week.split(',').map(d => parseInt(d));
            if (configuredDays.includes(dayOfWeek)) {
              shouldTrigger = true;
            }
          }
        }

        if (shouldTrigger && rotation.supplement) {
          triggeredRotations.push(rotation);
        }
      }

      // Handle exclusive mode: If any rotation is exclusive, only keep highest priority
      if (triggeredRotations.length > 0 && triggeredRotations.some(r => r.is_exclusive)) {
        const exclusiveRotations = triggeredRotations.filter(r => r.is_exclusive);
        if (exclusiveRotations.length > 0) {
          // Keep only the highest priority (first after sorting)
          const highestPriority = exclusiveRotations[0].priority;
          // Filter to only rotations at this priority level
          const filtered = triggeredRotations.filter(r => r.priority === highestPriority);
          return filtered.map(r => r.supplement);
        }
      }

      return triggeredRotations.map(r => r.supplement);
    };

    // Helper to create event object with supplement suggestion
    let eventIndexCounter = 0;

    const baseSchedules = scheduleList.filter(s => s.schedule_rule !== "dependent");

    baseSchedules.forEach(schedule => {
      if (!schedule.enabled) return;

      if (schedule.schedule_rule === "every_x_days") {
        const frequency = schedule.frequency_days;
        let currentDay = new Date(weekStart);

        while (currentDay <= weekEnd) {
          const event = {
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
            notifications_enabled: schedule.notifications_enabled,
            reminder_time: schedule.reminder_time,
          };

          // Add supplement suggestions for feeding schedules
          if (schedule.schedule_type === 'feeding' && schedule.food_category) {
            const supplements = getSuggestedSupplements(
              schedule.reptile_id,
              schedule.food_category,
              eventIndexCounter,
              event.date
            );
            if (supplements && supplements.length > 0) {
              event.suggested_supplements = supplements;
            }
            eventIndexCounter++;
          }

          calculatedEvents.push(event);
          currentDay.setDate(currentDay.getDate() + frequency);
        }
      } else if (schedule.schedule_rule === "days_of_week") {
        const days = schedule.days_of_week.split(",").map(d => parseInt(d));
        let currentDay = new Date(weekStart);

        while (currentDay <= weekEnd) {
          if (days.includes(currentDay.getDay())) {
            const event = {
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
              notifications_enabled: schedule.notifications_enabled,
              reminder_time: schedule.reminder_time,
            };

            // Add supplement suggestions for feeding schedules
            if (schedule.schedule_type === 'feeding' && schedule.food_category) {
              const supplements = getSuggestedSupplements(
                schedule.reptile_id,
                schedule.food_category,
                eventIndexCounter,
                event.date
              );
              if (supplements && supplements.length > 0) {
                event.suggested_supplements = supplements;
              }
              eventIndexCounter++;
            }

            calculatedEvents.push(event);
          }
          currentDay.setDate(currentDay.getDate() + 1);
        }
      }
    });

    setWeeklyEvents(calculatedEvents);
  };

  const getEventsForDate = (date) => {
    if (!date) return [];

    const scheduledEvents = weeklyEvents.filter(event => {
      // event.date is already a proper Date object parsed as local time
      return event.date.toDateString() === date.toDateString() &&
             calendarReptileFilter.has(event.reptile_id);
    }).map(event => ({ ...event, is_completed: event.status === 'completed', is_actual: false }));

    // Get actual completed feedings for this date
    const actualFeedings = weeklyFeedings.filter(feeding => {
      const feedDate = new Date(feeding.fed_at);
      return feedDate.toDateString() === date.toDateString() &&
             calendarReptileFilter.has(feeding.reptile_id);
    });

    // Get actual completed mistings for this date
    const actualMistings = weeklyMistings.filter(misting => {
      const mistDate = new Date(misting.misted_at);
      return mistDate.toDateString() === date.toDateString() &&
             calendarReptileFilter.has(misting.reptile_id);
    });

    // Mark scheduled events as completed when there's a matching actual feeding/misting
    actualFeedings.forEach(actual => {
      let actualFoodCategory = null;
      if (actual.is_salad) {
        actualFoodCategory = 'salad';
      } else if (actual.foods && actual.foods.length > 0) {
        const firstFood = actual.foods[0];
        actualFoodCategory = firstFood.food_category || 'insects';
      }

      const matchingSchedule = scheduledEvents.find(event =>
        event.schedule_type === 'feeding' &&
        event.reptile_id === actual.reptile_id &&
        (!event.food_category || event.food_category === actualFoodCategory)
      );

      if (matchingSchedule) {
        matchingSchedule.is_completed = true;
        matchingSchedule.completed_at = actual.fed_at;
      }
    });

    actualMistings.forEach(actual => {
      const matchingSchedule = scheduledEvents.find(event =>
        event.schedule_type === 'misting' &&
        event.reptile_id === actual.reptile_id &&
        !event.is_completed
      );

      if (matchingSchedule) {
        matchingSchedule.is_completed = true;
        matchingSchedule.completed_at = actual.misted_at;
      }
    });

    // Sort events according to the rules:
    // 1. Items with time windows sorted by earliest time (earliest first)
    // 2. Items without time windows grouped by reptile
    // 3. Items with equal time windows grouped by reptile
    scheduledEvents.sort((a, b) => {
      const aHasTime = a.time_window_enabled && a.earliest_time;
      const bHasTime = b.time_window_enabled && b.earliest_time;

      // Both have time windows - sort by time, then by reptile name
      if (aHasTime && bHasTime) {
        if (a.earliest_time !== b.earliest_time) {
          return a.earliest_time.localeCompare(b.earliest_time);
        }
        return a.reptile_name.localeCompare(b.reptile_name);
      }

      // Only a has time window - a comes first
      if (aHasTime && !bHasTime) {
        return -1;
      }

      // Only b has time window - b comes first
      if (!aHasTime && bHasTime) {
        return 1;
      }

      // Neither has time window - sort by reptile name
      return a.reptile_name.localeCompare(b.reptile_name);
    });

    return scheduledEvents;
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

  // Get health status badge for reptile (only show if schedules exist)
  const getHealthStatusBadge = (reptileId) => {
    // Check if reptile has any schedules today
    const today = new Date();
    const reptileSchedules = weeklyEvents.filter(event =>
      event.reptile_id === reptileId
    );

    // Don't show badge if no schedules
    if (reptileSchedules.length === 0) {
      return null;
    }

    // Check for overdue or missed schedules (any day, not just today)
    const hasOverdue = reptileSchedules.some(e => e.status === 'missed');
    if (hasOverdue) {
      return { color: 'red', emoji: '🔴' };
    }

    // Check for pending schedules today
    const todaySchedules = reptileSchedules.filter(event =>
      event.date.toDateString() === today.toDateString()
    );
    const hasDueToday = todaySchedules.some(e => e.status === 'pending');
    if (hasDueToday) {
      return { color: 'yellow', emoji: '🟡' };
    }

    // All good
    return { color: 'green', emoji: '🟢' };
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
    minDate.setHours(0, 0, 0, 0);

    // Extend to today's date for extrapolation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxMeasurementDate = new Date(Math.max(...allMeasurementDates));
    maxMeasurementDate.setHours(0, 0, 0, 0);
    const maxDate = new Date(Math.max(maxMeasurementDate.getTime(), today.getTime()));

    // Add 1 day padding before first measurement and after last date
    const startDate = new Date(minDate);
    startDate.setDate(startDate.getDate() - 1);

    const endDate = new Date(maxDate);
    endDate.setDate(endDate.getDate() + 1);

    // Build array of midnight timestamps for each day
    const allDateTimestamps = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      allDateTimestamps.push(new Date(d).getTime());
    }

    // Build chart data with actual measurements and interpolation/extrapolation
    const chartData = allDateTimestamps.map(dateTime => {
      const date = format(new Date(dateTime), 'MMM d, yyyy');
      const dataPoint = { date };

      Object.values(byReptile).forEach(reptile => {
        // Find surrounding measurements
        const firstMeasurement = reptile.data[0];
        const lastMeasurement = reptile.data[reptile.data.length - 1];

        // Normalize measurement times to midnight for all calculations
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

        // Between measurements - interpolate linearly
        if (dateTime > firstMeasurementMidnight.getTime() && dateTime < lastMeasurementMidnight.getTime()) {
          if (interpolationMode === 'linear') {
            // Find the two surrounding measurements
            let beforeMeasurement = null;
            let afterMeasurement = null;

            for (let i = 0; i < reptile.data.length - 1; i++) {
              const currentMidnight = new Date(reptile.data[i].dateTime);
              currentMidnight.setHours(0, 0, 0, 0);
              const nextMidnight = new Date(reptile.data[i + 1].dateTime);
              nextMidnight.setHours(0, 0, 0, 0);

              if (dateTime > currentMidnight.getTime() && dateTime < nextMidnight.getTime()) {
                beforeMeasurement = reptile.data[i];
                afterMeasurement = reptile.data[i + 1];
                break;
              }
            }

            if (beforeMeasurement && afterMeasurement) {
              const beforeMidnight = new Date(beforeMeasurement.dateTime);
              beforeMidnight.setHours(0, 0, 0, 0);
              const afterMidnight = new Date(afterMeasurement.dateTime);
              afterMidnight.setHours(0, 0, 0, 0);

              const totalDays = (afterMidnight.getTime() - beforeMidnight.getTime()) / (24 * 60 * 60 * 1000);

              // Prevent division by zero
              if (totalDays > 0) {
                const daysFromBefore = (dateTime - beforeMidnight.getTime()) / (24 * 60 * 60 * 1000);
                const ratio = daysFromBefore / totalDays;

                const interpolated = beforeMeasurement.weight + (afterMeasurement.weight - beforeMeasurement.weight) * ratio;
                if (isFinite(interpolated)) {
                  dataPoint[`${reptile.name}_interpolated`] = parseFloat(interpolated.toFixed(1));
                }
              }
            }
          } else if (interpolationMode === 'step') {
            // Step mode: use the weight from the most recent measurement before this date
            let lastBeforeMeasurement = null;
            for (let i = reptile.data.length - 1; i >= 0; i--) {
              const measurementMidnight = new Date(reptile.data[i].dateTime);
              measurementMidnight.setHours(0, 0, 0, 0);
              if (measurementMidnight.getTime() < dateTime) {
                lastBeforeMeasurement = reptile.data[i];
                break;
              }
            }
            if (lastBeforeMeasurement) {
              dataPoint[`${reptile.name}_interpolated`] = lastBeforeMeasurement.weight;
            }
          }
          return;
        }

        // Before first or after last measurement - extrapolate based on mode
        if (dateTime < firstMeasurementMidnight.getTime()) {
          // Extrapolate into the past
          if (interpolationMode === 'linear' && reptile.data.length >= 2) {
            // Linear: use trend from first 2 measurements (using midnight-normalized times)
            const secondMeasurement = reptile.data[1];
            const secondMeasurementMidnight = new Date(secondMeasurement.dateTime);
            secondMeasurementMidnight.setHours(0, 0, 0, 0);

            const daysBetweenMeasurements = (secondMeasurementMidnight.getTime() - firstMeasurementMidnight.getTime()) / (24 * 60 * 60 * 1000);

            // If measurements are on the same day, use flat line instead
            if (daysBetweenMeasurements === 0 || !isFinite(daysBetweenMeasurements)) {
              dataPoint[`${reptile.name}_extrapolated`] = firstMeasurement.weight;
            } else {
              const gramsPerDay = (secondMeasurement.weight - firstMeasurement.weight) / daysBetweenMeasurements;
              const daysFromFirst = (dateTime - firstMeasurementMidnight.getTime()) / (24 * 60 * 60 * 1000);
              const extrapolated = firstMeasurement.weight + gramsPerDay * daysFromFirst;

              if (isFinite(extrapolated)) {
                dataPoint[`${reptile.name}_extrapolated`] = parseFloat(extrapolated.toFixed(1));
              } else {
                dataPoint[`${reptile.name}_extrapolated`] = firstMeasurement.weight;
              }
            }
          } else {
            // Step: flat line
            dataPoint[`${reptile.name}_extrapolated`] = firstMeasurement.weight;
          }
        } else if (dateTime > lastMeasurementMidnight.getTime()) {
          // Extrapolate into the future
          if (interpolationMode === 'linear' && reptile.data.length >= 2) {
            // Linear: use trend from last 2 measurements (using midnight-normalized times)
            const secondLastMeasurement = reptile.data[reptile.data.length - 2];
            const secondLastMeasurementMidnight = new Date(secondLastMeasurement.dateTime);
            secondLastMeasurementMidnight.setHours(0, 0, 0, 0);

            const daysBetweenMeasurements = (lastMeasurementMidnight.getTime() - secondLastMeasurementMidnight.getTime()) / (24 * 60 * 60 * 1000);

            // If measurements are on the same day (daysBetweenMeasurements = 0), use flat line instead
            if (daysBetweenMeasurements === 0 || !isFinite(daysBetweenMeasurements)) {
              dataPoint[`${reptile.name}_extrapolated`] = lastMeasurement.weight;
            } else {
              const gramsPerDay = (lastMeasurement.weight - secondLastMeasurement.weight) / daysBetweenMeasurements;
              const daysFromLast = (dateTime - lastMeasurementMidnight.getTime()) / (24 * 60 * 60 * 1000);
              const extrapolated = lastMeasurement.weight + gramsPerDay * daysFromLast;

              // Only set extrapolated value if it's a valid number
              if (isFinite(extrapolated)) {
                dataPoint[`${reptile.name}_extrapolated`] = parseFloat(extrapolated.toFixed(1));
              } else {
                dataPoint[`${reptile.name}_extrapolated`] = lastMeasurement.weight;
              }
            }
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

  // Calculate today's schedule stats
  const todayScheduleStats = (() => {
    const today = new Date();
    const todayEvents = weeklyEvents.filter(event =>
      event.date.toDateString() === today.toDateString() &&
      calendarReptileFilter.has(event.reptile_id)
    );

    const due = todayEvents.filter(e => e.status === 'pending').length;
    const overdue = todayEvents.filter(e => e.status === 'missed').length;
    const completed = todayEvents.filter(e => e.status === 'completed').length;

    return { due, overdue, completed };
  })();

  // Define all card rendering functions
  const renderCard = (cardId) => {
    switch (cardId) {
      case 'today_summary':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 h-full">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-gray-700 dark:text-gray-300" />
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Today</h3>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 dark:text-gray-400">Due:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{todayScheduleStats.due}</span>
                </div>
                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 dark:text-gray-400">Overdue:</span>
                  <span className={`font-bold ${todayScheduleStats.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>{todayScheduleStats.overdue}</span>
                </div>
                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 dark:text-gray-400">Done:</span>
                  <span className="font-bold text-green-600 dark:text-green-400">{todayScheduleStats.completed}</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'weekly_calendar': {
        const today = new Date();
        const firstDayOfWeek = getUserFirstDayOfWeek() === 'monday' ? 1 : 0;
        const weekStart = startOfWeek(today, { weekStartsOn: firstDayOfWeek });

        // Calculate days based on view
        let daysToShow = 7;
        let startDate = weekStart; // Default to week start for 7-day view

        if (calendarView === 'day') {
          daysToShow = 1;
          startDate = today; // Start from today for 1-day view
        } else if (calendarView === 'three-day') {
          daysToShow = 3;
          startDate = today; // Start from today for 3-day view
        }

        const weekDays = Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i));

        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-gray-700 dark:text-gray-300" />
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Schedule Calendar</h2>
              </div>
              <div className="flex items-center gap-2">
                {/* View switcher */}
                <div className="flex rounded border border-gray-200 dark:border-gray-600 overflow-hidden">
                  <button
                    onClick={() => setCalendarView('day')}
                    className={`px-2 py-1 text-xs font-medium transition-colors ${
                      calendarView === 'day'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    title="1 day view"
                  >
                    1d
                  </button>
                  <button
                    onClick={() => setCalendarView('three-day')}
                    className={`px-2 py-1 text-xs font-medium border-l border-gray-200 dark:border-gray-600 transition-colors ${
                      calendarView === 'three-day'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    title="3 day view"
                  >
                    3d
                  </button>
                  <button
                    onClick={() => setCalendarView('week')}
                    className={`px-2 py-1 text-xs font-medium border-l border-gray-200 dark:border-gray-600 transition-colors ${
                      calendarView === 'week'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    title="Week view"
                  >
                    7d
                  </button>
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
            </div>

            <div className={`grid gap-2 ${calendarView === 'day' ? 'grid-cols-1' : calendarView === 'three-day' ? 'grid-cols-3' : 'grid-cols-7'}`}>
              {weekDays.map((day, index) => {
                const dayEvents = getEventsForDate(day);
                const isToday = day.toDateString() === today.toDateString();

                return (
                  <div
                    key={index}
                    className={`border border-gray-200 dark:border-gray-700 rounded ${calendarView === 'week' ? 'p-2' : 'p-3'} cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex flex-col ${
                      isToday ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' : ''
                    }`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className="text-center mb-2 flex-shrink-0">
                      <div className={`${calendarView === 'week' ? 'text-xs' : 'text-sm'} font-medium text-gray-600 dark:text-gray-400`}>
                        {format(day, calendarView === 'week' ? 'EEE' : 'EEEE, MMM d')}
                      </div>
                      {calendarView === 'week' && (
                        <div className={`text-lg font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                          {format(day, 'd')}
                        </div>
                      )}
                      {dayEvents.length > 0 && calendarView !== 'week' && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    <div className={`${calendarView === 'week' ? 'space-y-1' : 'space-y-2'} overflow-y-auto flex-1 min-h-0`}>
                      {dayEvents.length === 0 && calendarView !== 'week' && (
                        <div className="text-center text-gray-400 dark:text-gray-500 py-4 text-xs">
                          No events
                        </div>
                      )}
                      {dayEvents.map((event, idx) => {
                        const { Icon, color } = getScheduleTypeIcon(event.schedule_type);

                        // Separate food category and time window
                        const foodCategory = event.schedule_type === 'feeding' && event.food_category ? event.food_category : null;
                        let timeText = null;
                        if (event.time_window_enabled && event.earliest_time && event.latest_time) {
                          timeText = `${formatTime(new Date(`2000-01-01T${event.earliest_time}`))} - ${formatTime(new Date(`2000-01-01T${event.latest_time}`))}`;
                        } else if (event.time_slot) {
                          timeText = event.time_slot;
                        }

                        // Enhanced display for day/3-day view - COMPACT SINGLE ROW
                        if (calendarView === 'day' || calendarView === 'three-day') {
                          return (
                            <div
                              key={idx}
                              className={`px-2 py-1 rounded bg-white dark:bg-gray-800 border ${
                                event.is_completed
                                  ? 'border-green-500 dark:border-green-600'
                                  : 'border-gray-200 dark:border-gray-600'
                              }`}
                              title={event.notes || event.name || event.reptile_name}
                            >
                              <div className="flex items-center gap-1.5 text-xs">
                                {event.is_completed && (
                                  <span className="text-green-600 dark:text-green-400 font-bold flex-shrink-0">✓</span>
                                )}
                                <Icon size={12} className={`flex-shrink-0 ${color === 'orange' ? 'text-primary-600 dark:text-primary-400' : color === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`} />
                                <span className="font-semibold text-gray-900 dark:text-white truncate">
                                  {event.reptile_name}
                                </span>
                                {event.notifications_enabled && (
                                  <Bell size={10} className="flex-shrink-0 text-blue-500 dark:text-blue-400" title="Notifications enabled" />
                                )}
                                <span className="text-gray-400 dark:text-gray-500">•</span>
                                {timeText && (
                                  <>
                                    <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">{timeText}</span>
                                    <span className="text-gray-400 dark:text-gray-500">•</span>
                                  </>
                                )}
                                {foodCategory && (
                                  <>
                                    <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">{foodCategory}</span>
                                  </>
                                )}
                                {event.suggested_supplements && event.suggested_supplements.length > 0 && (
                                  <>
                                    <span className="text-gray-400 dark:text-gray-500">•</span>
                                    <span className="text-amber-600 dark:text-amber-400 flex-shrink-0">
                                      +{event.suggested_supplements.map(s => s.name).join(', ')}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // Compact display for week view - SINGLE ROW
                        return (
                          <div
                            key={idx}
                            className={`text-xs px-1.5 py-0.5 rounded bg-white dark:bg-gray-800 border ${
                              event.is_completed
                                ? 'border-green-500 dark:border-green-600'
                                : 'border-gray-200 dark:border-gray-600'
                            }`}
                            title={`${event.reptile_name}${timeText ? ' • ' + timeText : ''}${foodCategory ? ' • ' + foodCategory : ''}${event.suggested_supplements?.length > 0 ? ' • +' + event.suggested_supplements.map(s => s.name).join(', ') : ''}${event.notes ? '\n' + event.notes : ''}`}
                          >
                            <div className="flex items-center gap-1 text-[10px]">
                              {event.is_completed && (
                                <span className="text-green-600 dark:text-green-400 font-bold flex-shrink-0">✓</span>
                              )}
                              <Icon size={9} className={`flex-shrink-0 ${color === 'orange' ? 'text-primary-600 dark:text-primary-400' : color === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`} />
                              <span className="truncate text-gray-700 dark:text-gray-300 font-medium">
                                {event.reptile_name}
                              </span>
                              {event.notifications_enabled && (
                                <Bell size={8} className="flex-shrink-0 text-blue-500 dark:text-blue-400" title="Notifications enabled" />
                              )}
                              {(timeText || foodCategory) && <span className="text-gray-400 dark:text-gray-500">•</span>}
                              {timeText && (
                                <span className="text-gray-500 dark:text-gray-400 truncate">{timeText}</span>
                              )}
                              {foodCategory && timeText && <span className="text-gray-400 dark:text-gray-500">•</span>}
                              {foodCategory && (
                                <span className="text-gray-500 dark:text-gray-400 truncate">{foodCategory}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
                  const healthBadge = getHealthStatusBadge(reptile.id);

                  return (
                    <Link to={`/reptiles/${reptile.id}`} key={reptile.id} className="block p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-gray-100 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {healthBadge && (
                              <span className="text-xs" title={`Status: ${healthBadge.color}`}>{healthBadge.emoji}</span>
                            )}
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
                        <div className="flex-shrink-0 w-24 text-center">{prominentValue && <span className="text-lg font-bold text-gray-900 dark:text-white">{prominentValue}</span>}</div>
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
                        onClick={() => event.instance_id && navigate(`/schedule-instances/${event.instance_id}`)}
                        className={`px-4 py-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                          event.is_completed
                            ? 'bg-white dark:bg-gray-800 border-green-500 dark:border-green-600 hover:border-green-600 dark:hover:border-green-500'
                            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${getIconColorClasses(typeColor)}`}>
                            <TypeIcon size={20} />
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            {event.is_completed && (
                              <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                            )}
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {displayName}
                            </div>
                          </div>
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {event.schedule_type}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Reptile</span>
                            <span className="text-gray-900 dark:text-white font-medium truncate">{event.reptile_name}</span>
                          </div>

                          {event.schedule_rule && (
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Frequency</span>
                              <span className="text-gray-900 dark:text-white truncate">{event.schedule_rule.replace(/_/g, ' ')}</span>
                            </div>
                          )}

                          {event.food_category && (
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Food</span>
                              <span className="text-gray-900 dark:text-white truncate">{event.food_category}</span>
                            </div>
                          )}

                          {event.suggested_supplements && event.suggested_supplements.length > 0 && (
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Supplement</span>
                              <span className="text-gray-900 dark:text-white truncate">
                                {event.suggested_supplements.map(s => s.name).join(', ')}
                              </span>
                            </div>
                          )}

                          {event.time_window_enabled && event.earliest_time && event.latest_time ? (
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                <Clock size={12} />
                                Time Window
                                {event.notifications_enabled && <Bell size={10} className="text-blue-500 dark:text-blue-400" />}
                              </span>
                              <span className="text-gray-900 dark:text-white font-medium break-words">
                                {formatTime(new Date(`2000-01-01T${event.earliest_time}`))} - {formatTime(new Date(`2000-01-01T${event.latest_time}`))}
                              </span>
                            </div>
                          ) : event.time_slot ? (
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                Time
                                {event.notifications_enabled && <Bell size={10} className="text-blue-500 dark:text-blue-400" />}
                              </span>
                              <span className="text-gray-900 dark:text-white truncate">{event.time_slot}</span>
                            </div>
                          ) : event.notifications_enabled ? (
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                <Bell size={10} className="text-blue-500 dark:text-blue-400" />
                                Notifications
                              </span>
                              <span className="text-blue-600 dark:text-blue-400 text-xs">Enabled</span>
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