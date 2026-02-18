import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow, differenceInDays, format, startOfWeek, addDays } from 'date-fns';
import { Utensils, Clock, Calendar, AlertCircle, CheckCircle, TrendingUp, Scale, Droplets, Activity, ChevronUp, Filter, Bell, ChevronLeft, ChevronRight, Plus, X, GripVertical, Maximize2, ArrowLeft, ArrowRight, PanelLeft } from 'lucide-react';
import { formatDateTime, formatTime, getUserFirstDayOfWeek, toLocalISODate } from '../utils/dateFormatting';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getDashboardCardSettings, getChartSettings, isCalendarExtraSmall, applyProfile, getActiveProfileId, saveDashboardCardSettings, resetDashboardCardSettings, updateProfileCards, resetProfileToDefault, getSidebarSettings, saveSidebarSettings, isMobileScreen } from '../utils/displaySettings';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import ReptileAvatar from '../components/ReptileAvatar';
import ReptileStatusCards from '../components/dashboard/ReptileStatusCards';
import TodayScheduleTimeline from '../components/dashboard/TodayScheduleTimeline';
import QuickLogForm from '../components/dashboard/QuickLogForm';
import WeightTrendsWidget from '../components/dashboard/WeightTrendsWidget';
import WeekSummaryWidget from '../components/dashboard/WeekSummaryWidget';
import RecentActivityWidget from '../components/dashboard/RecentActivityWidget';
import Header from '../components/Header';
import EditModeControls from '../components/dashboard/EditModeControls';
import WidgetGallery from '../components/dashboard/WidgetGallery';
import { useModalState } from '@/hooks/useModalState';
import { ViewLogModal } from '@/components/modals/ViewLogModal';
import { ViewScheduleModal } from '@/components/modals/ViewScheduleModal';
import { CreateLogModal } from '@/components/modals/CreateLogModal';

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
  const [healthStatusData, setHealthStatusData] = useState({}); // { reptile_id: health_status }
  const [loading, setLoading] = useState(true);
  const [dashboardCards, setDashboardCards] = useState([]);
  const [chartSettings, setChartSettings] = useState(null);
  const [hideSupplements, setHideSupplements] = useState(false); // Hide supplements when calendar is XS
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger to force data refresh
  const [quickLogTask, setQuickLogTask] = useState(null); // Task for quick-log form (08-03)
  const [user, setUser] = useState(null); // User for Header greeting
  const [isEditMode, setIsEditMode] = useState(false); // Edit mode for dashboard customization
  const [showWidgetGallery, setShowWidgetGallery] = useState(false); // Widget gallery modal
  const [draggedWidget, setDraggedWidget] = useState(null); // Widget being dragged
  const [dragOverWidget, setDragOverWidget] = useState(null); // Widget being dragged over
  const [mainZoneDropActive, setMainZoneDropActive] = useState(false); // Drop zone active for main area
  const [sidebarSettings, setSidebarSettings] = useState({ sidebarEnabled: true, sidebarPosition: 'left' }); // Sidebar settings

  // Modal state management (Phase 27)
  const { isOpen: viewLogOpen, modalId: viewLogId, open: openViewLog, close: closeViewLog } = useModalState('viewLog');
  const { isOpen: viewScheduleOpen, modalId: viewScheduleId, open: openViewSchedule, close: closeViewSchedule } = useModalState('viewSchedule');
  const { isOpen: createOpen, modalId: createType, open: openCreate, close: closeCreate } = useModalState('create');
  const [selectedLogType, setSelectedLogType] = useState(null); // Log type for view modal
  const [selectedReptileId, setSelectedReptileId] = useState(null); // Reptile ID for create modal
  const [prefillData, setPrefillData] = useState(null); // Prefill data for create modal

  // Weekly calendar state
  const [schedules, setSchedules] = useState([]);
  const [feedingRotations, setFeedingRotations] = useState([]); // Feeding rotations for supplement suggestions
  const [weeklyEvents, setWeeklyEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarReptileFilter, setCalendarReptileFilter] = useState(new Set());
  const [showReptileFilter, setShowReptileFilter] = useState(false);
  const [weeklyFeedings, setWeeklyFeedings] = useState([]);
  const [weeklyMistings, setWeeklyMistings] = useState([]);
  const [quotaStatuses, setQuotaStatuses] = useState({});

  // Load calendar view from localStorage or default to 'week'
  const [calendarView, setCalendarView] = useState(() => {
    const saved = localStorage.getItem('dashboard_calendar_view');
    return saved || 'week'; // 'day', 'three-day', 'week'
  });

  // Current date for calendar navigation (defaults to today)
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());

  // Load display settings on mount and apply correct profile for screen size
  useEffect(() => {
    // Apply the appropriate profile for the current screen size
    const activeProfileId = getActiveProfileId();
    applyProfile(activeProfileId);

    // Load the settings
    setDashboardCards(getDashboardCardSettings());
    setChartSettings(getChartSettings());
    setSidebarSettings(getSidebarSettings());

    // Check if calendar is XS to hide supplements and force 1-day view
    const calendarIsXS = isCalendarExtraSmall();
    setHideSupplements(calendarIsXS);
    if (calendarIsXS && calendarView !== 'day') {
      setCalendarView('day');
    }
  }, []);

  // Save calendar view to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('dashboard_calendar_view', calendarView);
  }, [calendarView]);

  // Fetch user for Header greeting
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get('/auth/me');
        setUser(response.data);
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    };
    fetchUser();
  }, []);

  // Navigation functions for calendar
  const navigateCalendar = (direction) => {
    const newDate = new Date(currentWeekDate);
    if (calendarView === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (calendarView === 'three-day') {
      newDate.setDate(newDate.getDate() + (direction * 3));
    } else {
      // week view
      newDate.setDate(newDate.getDate() + (direction * 7));
    }
    setCurrentWeekDate(newDate);
  };

  const goToToday = () => {
    setCurrentWeekDate(new Date());
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Calculate date range based on calendar view
        const firstDayOfWeek = getUserFirstDayOfWeek() === 'monday' ? 1 : 0;

        let weekStart, weekEnd;

        if (calendarView === 'day') {
          // 1-day view: fetch only the current day
          weekStart = currentWeekDate;
          weekEnd = currentWeekDate;
        } else if (calendarView === 'three-day') {
          // 3-day view: fetch yesterday + today + tomorrow relative to currentWeekDate
          weekStart = addDays(currentWeekDate, -1);
          weekEnd = addDays(currentWeekDate, 1);
        } else {
          // Week view: fetch full week (Monday-Sunday or Sunday-Saturday)
          weekStart = startOfWeek(currentWeekDate, { weekStartsOn: firstDayOfWeek });
          weekEnd = addDays(weekStart, 6);
        }

        // Always extend weekEnd to include at least 7 days from today for NextFeedingIndicator
        // This ensures "next feeding" badge shows upcoming feedings even when today's are completed
        const minEndDate = addDays(new Date(), 7);
        if (weekEnd < minEndDate) {
          weekEnd = minEndDate;
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

        const data = bulkResponse.data || {};

        // Set basic data (defensive array checks for cached/malformed responses)
        setReptiles(Array.isArray(data.reptiles) ? data.reptiles : []);
        setRecentFeedings(Array.isArray(data.recent_feedings) ? data.recent_feedings : []);
        setSchedules(Array.isArray(data.schedules) ? data.schedules : []);
        setFeedingRotations(Array.isArray(data.feeding_rotations) ? data.feeding_rotations : []);
        setWeeklyFeedings(Array.isArray(data.weekly_feedings) ? data.weekly_feedings : []);
        setWeeklyMistings(Array.isArray(data.weekly_mistings) ? data.weekly_mistings : []);
        setQuotaStatuses(data.quota_statuses || {});

        // Process weight data
        const weightArray = [];
        const weightData = data.weight_data && typeof data.weight_data === 'object' ? data.weight_data : {};
        Object.entries(weightData).forEach(([reptileId, weights]) => {
          const weightsArr = Array.isArray(weights) ? weights : [];
          weightsArr.forEach(w => weightArray.push({ ...w, reptile_id: parseInt(reptileId) }));
        });
        setWeightData(weightArray);

        // Process last activity data
        const feedingMap = {};
        const mistingMap = {};
        const healthMap = {};
        const weighingMap = {};

        const lastActivity = data.last_activity && typeof data.last_activity === 'object' ? data.last_activity : {};
        Object.entries(lastActivity).forEach(([reptileId, activity]) => {
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
        Object.entries(weightData).forEach(([reptileId, weights]) => {
          const weightsArr = Array.isArray(weights) ? weights : [];
          if (weightsArr.length > 0) {
            weighingMap[parseInt(reptileId)] = weightsArr[0].weighed_at;
          }
        });

        setFeedingData(feedingMap);
        setMistingData(mistingMap);
        setHealthData(healthMap);
        setWeighingData(weighingMap);

        // Build recent activity
        const allActivity = [];
        const safeRecentFeedings = Array.isArray(data.recent_feedings) ? data.recent_feedings : [];
        const safeReptiles = Array.isArray(data.reptiles) ? data.reptiles : [];

        // Add recent feedings
        safeRecentFeedings.forEach(feeding => {
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
        Object.entries(lastActivity).forEach(([reptileId, activity]) => {
          const reptile = safeReptiles.find(r => r.id === parseInt(reptileId));
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
          reptile: safeReptiles.find(r => r.id === w.reptile_id),
          data: w,
          icon: Scale,
          color: 'purple'
        }));
        allActivity.push(...recentWeightLogs);

        // Sort by timestamp and take top 10
        allActivity.sort((a, b) => b.timestamp - a.timestamp);
        setRecentActivity(allActivity.slice(0, 10));

        // Transform instances to event format
        const safeWeeklyInstances = Array.isArray(data.weekly_instances) ? data.weekly_instances : [];
        const instanceEvents = safeWeeklyInstances
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
              schedule_mode: instance.schedule.schedule_mode,
              quota_period: instance.schedule.quota_period,
              quota_frequency: instance.schedule.quota_frequency,
              reptile_name: instance.schedule.reptile.name,
              reptile_id: instance.schedule.reptile_id,
              reptile: instance.schedule.reptile, // Include full reptile object for avatar
              name: instance.schedule.name,
              food_category: instance.schedule.food_category,
              time_slot: instance.schedule.time_slot,
              health_category: instance.schedule.health_category,
              health_subtype: instance.schedule.health_subtype,
              measurement_type: instance.schedule.measurement_type,
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

        // Batch fetch health statuses for all reptiles
        if (Array.isArray(data.reptiles) && data.reptiles.length > 0) {
          const reptileIds = data.reptiles.map(r => r.id);

          // Fetch health statuses (POST with array per Phase 18 API)
          try {
            const healthResponse = await axios.post('/api/health/status/batch', reptileIds);
            setHealthStatusData(healthResponse.data || {});
          } catch (error) {
            console.error('Failed to fetch health statuses:', error);
            setHealthStatusData({});
          }
        }

      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [calendarReptileFilter, calendarView, currentWeekDate, refreshTrigger]);

  // Initialize reptile filter when reptiles are loaded
  useEffect(() => {
    if (reptiles.length > 0 && calendarReptileFilter.size === 0) {
      setCalendarReptileFilter(new Set(reptiles.map(r => r.id)));
    }
  }, [reptiles]);

  // Refresh data when page becomes visible (e.g., user returns from completing a task)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setRefreshTrigger(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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

  const getQuotaBadge = (scheduleId, format = 'compact') => {
    const quotaStatus = quotaStatuses[scheduleId];
    if (!quotaStatus) return null;

    const { count, period_type } = quotaStatus;
    const periodLabel = format === 'full'
      ? (period_type === 'week' ? 'this week' : 'this month')
      : (period_type === 'week' ? 'wk' : 'mo');

    // Simple informational badge (no enforcement colors)
    return {
      text: format === 'full'
        ? `${count} ${periodLabel}`
        : `${count}/${periodLabel}`,
      className: 'bg-secondary text-muted-foreground border border-border'
    };
  };

  const getScheduleTypeIcon = (type) => {
    switch(type) {
      case 'feeding':
        return { Icon: Utensils, color: 'orange' };
      case 'misting':
        return { Icon: Droplets, color: 'blue' };
      case 'health':
        return { Icon: Scale, color: 'purple' };
      default:
        return { Icon: Calendar, color: 'gray' };
    }
  };

  const getIconColorClasses = (color) => {
    const colorMap = {
      'orange': 'bg-primary/10 text-primary',
      'blue': 'bg-blue-500/10 text-blue-500',
      'purple': 'bg-purple-500/10 text-purple-500',
      'gray': 'bg-secondary text-muted-foreground',
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

  // Get health status badge for reptile
  const getHealthStatusBadge = (reptileId) => {
    const today = new Date();
    const reptileSchedules = weeklyEvents.filter(event =>
      event.reptile_id === reptileId
    );

    // Check for overdue or missed schedules (any day, not just today)
    const hasOverdue = reptileSchedules.some(e => e.status === 'missed');
    if (hasOverdue) {
      return { color: 'red', emoji: '🔴', tooltip: 'Has overdue or missed tasks' };
    }

    // Check for pending schedules today
    const todaySchedules = reptileSchedules.filter(event =>
      event.date.toDateString() === today.toDateString()
    );
    const hasDueToday = todaySchedules.some(e => e.status === 'pending');
    if (hasDueToday) {
      return { color: 'yellow', emoji: '🟡', tooltip: 'Has tasks due today' };
    }

    // All good - no overdue tasks and nothing due today
    return { color: 'green', emoji: '🟢', tooltip: 'No tasks due today' };
  };

  // Calculate today's schedule stats for Header (MUST be before early return to respect Rules of Hooks)
  const todayScheduleStats = useMemo(() => {
    const today = new Date();
    const todayEvents = weeklyEvents.filter(event =>
      event.date.toDateString() === today.toDateString() &&
      calendarReptileFilter.has(event.reptile_id)
    );

    const due = todayEvents.filter(e => e.status === 'pending').length;
    const overdue = todayEvents.filter(e => e.status === 'missed').length;
    const completed = todayEvents.filter(e => e.status === 'completed').length;

    return { due, overdue, completed };
  }, [weeklyEvents, calendarReptileFilter]);

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading dashboard...</div>;
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

  // Helper function to get card size class (for main zone, 3-column grid)
  const getCardSizeClass = (cardId) => {
    const card = dashboardCards.find(c => c.id === cardId);
    // Sidebar cards have no size class - they're always full width of sidebar
    if (!card || card.zone === 'sidebar') return '';

    switch (card.size) {
      case 'small':
        return 'col-span-1'; // 1/3 width in 3-col grid
      case 'medium':
        return 'col-span-1 sm:col-span-2'; // 2/3 width
      case 'large':
        return 'col-span-1 sm:col-span-3'; // Full width
      default:
        return 'col-span-1';
    }
  };

  // Helper to check if a card is XS sized
  const isCardXS = (cardId) => {
    const card = dashboardCards.find(c => c.id === cardId);
    return card?.size === 'xs';
  };

  // Handle quick log task clicks (opens QuickLogForm)
  const handleQuickLog = (task) => {
    setQuickLogTask(task);
  };

  const handleQuickLogClose = () => {
    setQuickLogTask(null);
  };

  const handleQuickLogSubmit = async () => {
    // Refresh data after successful log
    setRefreshTrigger(prev => prev + 1);
    setQuickLogTask(null);
  };

  // Dashboard refresh function for modals
  const refreshDashboard = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Modal callback handlers (Phase 27)
  const handleViewActivity = (id, logType) => {
    setSelectedLogType(logType);
    openViewLog(id.toString());
  };

  const handleViewSchedule = (id) => {
    openViewSchedule(id.toString());
  };

  const handleCreateLog = (logType, reptileId, prefill) => {
    setSelectedReptileId(reptileId);
    setPrefillData(prefill);
    openCreate(logType);
  };

  // Edit mode handlers
  const handleToggleEditMode = () => {
    setIsEditMode(prev => {
      if (prev) {
        // Exiting edit mode - hide gallery if open
        setShowWidgetGallery(false);
      }
      return !prev;
    });
  };

  const handleResetLayout = () => {
    // Reset the active profile to default, then reload
    const activeProfileId = getActiveProfileId();
    resetProfileToDefault(activeProfileId);
    setDashboardCards(getDashboardCardSettings());
  };

  const handleAddWidget = (widgetId, zone = 'main') => {
    // Add widget to visible cards in the specified zone
    const cards = [...dashboardCards];
    // Get max order in target zone
    const zoneCards = cards.filter(c => c.zone === zone);
    const maxOrder = zoneCards.length > 0 ? Math.max(...zoneCards.map(c => c.order)) + 1 : 0;

    const updated = cards.map(c =>
      c.id === widgetId ? {
        ...c,
        visible: true,
        zone,
        order: maxOrder,
        size: zone === 'sidebar' ? undefined : (c.size || 'medium')
      } : c
    );

    // Save to the active profile (desktop or mobile)
    const activeProfileId = getActiveProfileId();
    updateProfileCards(activeProfileId, updated);

    // Update local state
    setDashboardCards(updated);
    setShowWidgetGallery(false);
  };

  const handleHideWidget = (widgetId) => {
    // Hide widget and save to active profile
    const updated = dashboardCards.map(c =>
      c.id === widgetId ? { ...c, visible: false } : c
    );

    // Save to the active profile
    const activeProfileId = getActiveProfileId();
    updateProfileCards(activeProfileId, updated);

    // Update local state
    setDashboardCards(updated);
  };

  const handleResizeWidget = (widgetId) => {
    // Cycle through sizes: small -> medium -> large -> small (3-col grid)
    const sizeOrder = ['small', 'medium', 'large'];
    const updated = dashboardCards.map(c => {
      if (c.id !== widgetId) return c;
      const currentIndex = sizeOrder.indexOf(c.size || 'small');
      const nextIndex = (currentIndex + 1) % sizeOrder.length;
      return { ...c, size: sizeOrder[nextIndex] };
    });

    // Save to the active profile
    const activeProfileId = getActiveProfileId();
    updateProfileCards(activeProfileId, updated);

    // Update local state
    setDashboardCards(updated);
  };

  const handleMoveToSidebar = (widgetId) => {
    // Move widget from main zone to sidebar
    const updated = dashboardCards.map(c => {
      if (c.id !== widgetId) return c;
      // Get max order in sidebar zone
      const sidebarCards = dashboardCards.filter(card => card.zone === 'sidebar');
      const maxOrder = sidebarCards.length > 0 ? Math.max(...sidebarCards.map(card => card.order)) + 1 : 0;
      return { ...c, zone: 'sidebar', order: maxOrder, size: undefined };
    });

    // Save to the active profile
    const activeProfileId = getActiveProfileId();
    updateProfileCards(activeProfileId, updated);

    // Update local state
    setDashboardCards(updated);
  };

  const handleMoveToMain = (widgetId) => {
    // Move widget from sidebar to main zone
    const updated = dashboardCards.map(c => {
      if (c.id !== widgetId) return c;
      // Get max order in main zone
      const mainCards = dashboardCards.filter(card => card.zone === 'main');
      const maxOrder = mainCards.length > 0 ? Math.max(...mainCards.map(card => card.order)) + 1 : 0;
      return { ...c, zone: 'main', order: maxOrder, size: 'medium' };
    });

    // Save to the active profile
    const activeProfileId = getActiveProfileId();
    updateProfileCards(activeProfileId, updated);

    // Update local state
    setDashboardCards(updated);
  };

  const getSizeLabel = (cardId) => {
    const card = dashboardCards.find(c => c.id === cardId);
    const size = card?.size || 'small';
    const labels = { small: '1/3', medium: '2/3', large: 'Full' };
    return labels[size] || '1/3';
  };

  // Drag and drop handlers for widget reordering
  const handleDragStart = (e, widgetId) => {
    setDraggedWidget(widgetId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('widgetId', widgetId);
  };

  const handleDragOver = (e, widgetId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverWidget(widgetId);
  };

  const handleDragLeave = () => {
    setDragOverWidget(null);
  };

  const handleDrop = (e, targetWidgetId) => {
    e.preventDefault();

    if (!draggedWidget || draggedWidget === targetWidgetId) {
      setDraggedWidget(null);
      setDragOverWidget(null);
      return;
    }

    const draggedCard = dashboardCards.find(c => c.id === draggedWidget);
    const targetCard = dashboardCards.find(c => c.id === targetWidgetId);

    if (!draggedCard || !targetCard) {
      setDraggedWidget(null);
      setDragOverWidget(null);
      return;
    }

    let updated = [...dashboardCards];

    // Check if crossing zones
    if (draggedCard.zone !== targetCard.zone) {
      // Move to target zone and update zone-specific order
      updated = updated.map(c => {
        if (c.id === draggedWidget) {
          return {
            ...c,
            zone: targetCard.zone,
            size: targetCard.zone === 'sidebar' ? undefined : (c.size || 'medium'),
            order: targetCard.order
          };
        }
        // Shift orders in target zone for cards after the drop position
        if (c.zone === targetCard.zone && c.order >= targetCard.order && c.id !== draggedWidget) {
          return { ...c, order: c.order + 1 };
        }
        return c;
      });
    } else {
      // Same zone - reorder within zone
      const zoneCards = dashboardCards
        .filter(c => c.zone === draggedCard.zone)
        .sort((a, b) => a.order - b.order);

      const draggedZoneIndex = zoneCards.findIndex(c => c.id === draggedWidget);
      const targetZoneIndex = zoneCards.findIndex(c => c.id === targetWidgetId);

      if (draggedZoneIndex !== -1 && targetZoneIndex !== -1) {
        const [removed] = zoneCards.splice(draggedZoneIndex, 1);
        zoneCards.splice(targetZoneIndex, 0, removed);

        // Update orders within the zone
        const orderMap = new Map();
        zoneCards.forEach((card, index) => {
          orderMap.set(card.id, index);
        });

        updated = dashboardCards.map(c => {
          if (orderMap.has(c.id)) {
            return { ...c, order: orderMap.get(c.id) };
          }
          return c;
        });
      }
    }

    // Save to active profile
    const activeProfileId = getActiveProfileId();
    updateProfileCards(activeProfileId, updated);

    // Update local state
    setDashboardCards(updated);
    setDraggedWidget(null);
    setDragOverWidget(null);
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
    setDragOverWidget(null);
  };

  // Define all card rendering functions
  const renderCard = (cardId) => {
    switch (cardId) {
      case 'today_timeline':
        {
          const card = dashboardCards.find(c => c.id === 'today_timeline');
          return (
            <TodayScheduleTimeline
              config={card?.config || {}}
              size={card?.size || 'small'}
              onQuickLog={handleQuickLog}
              inSidebar={card?.zone === 'sidebar'}
              onViewSchedule={handleViewSchedule}
              onCreateLog={handleCreateLog}
            />
          );
        }
      case 'reptile_status_cards':
        {
          const card = dashboardCards.find(c => c.id === 'reptile_status_cards');
          return (
            <ReptileStatusCards
              config={card?.config || { showAge: true, showWeight: true }}
              size={card?.size || 'large'}
              onQuickLog={handleQuickLog}
              healthStatusData={healthStatusData}
              scheduleInstances={weeklyEvents}
            />
          );
        }
      case 'weekly_summary':
        return (
          <div className="bg-card rounded-lg shadow-sm border border-border p-3 h-full">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-muted-foreground" />
                <h3 className="font-semibold text-sm text-foreground">This Week</h3>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Utensils size={14} className="text-primary" />
                  <span className="text-muted-foreground">Feedings:</span>
                  <span className="font-bold text-primary">{feedingsThisWeek}</span>
                </div>
                <div className="w-px h-4 bg-border"></div>
                <div className="flex items-center gap-1.5">
                  <Droplets size={14} className="text-blue-500" />
                  <span className="text-muted-foreground">Misted today:</span>
                  <span className="font-bold text-blue-500">{mistedToday}</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'health_summary': {
        const isXS = isCardXS('health_summary');
        return (
          <div className="bg-card rounded-lg shadow-sm border border-border p-3 h-full">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-shrink-0">
                <Activity size={18} className="text-muted-foreground" />
                <h3 className="font-semibold text-sm text-foreground whitespace-nowrap">Health Summary</h3>
              </div>
              <div className={`flex items-center ${isXS ? 'gap-2' : 'gap-4'} text-sm flex-shrink-0`}>
                <div className="flex items-center gap-1.5">
                  <Activity size={14} className="text-primary flex-shrink-0" />
                  {!isXS && <span className="text-muted-foreground whitespace-nowrap">Sheds:</span>}
                  <span className="font-bold text-primary">{shedThisMonth}</span>
                </div>
                <div className="w-px h-4 bg-border"></div>
                <div className="flex items-center gap-1.5">
                  <Scale size={14} className="text-purple-500 flex-shrink-0" />
                  {!isXS && <span className="text-muted-foreground whitespace-nowrap">Logs:</span>}
                  <span className="font-bold text-purple-500">{weightData.length}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }
      case 'schedule_summary': {
        const isXS = isCardXS('schedule_summary');
        return (
          <div className="bg-card rounded-lg shadow-sm border border-border p-3 h-full">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-shrink-0">
                <Calendar size={18} className="text-muted-foreground" />
                <h3 className="font-semibold text-sm text-foreground whitespace-nowrap">Schedule Status</h3>
              </div>
              <div className={`flex items-center ${isXS ? 'gap-2' : 'gap-4'} text-sm flex-shrink-0`}>
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-destructive flex-shrink-0" />
                  {!isXS && <span className="text-muted-foreground whitespace-nowrap">Need:</span>}
                  <span className={`font-bold ${reptilesNeedingFeeding > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{reptilesNeedingFeeding}</span>
                </div>
                <div className="w-px h-4 bg-border"></div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-primary flex-shrink-0" />
                  {!isXS && <span className="text-muted-foreground whitespace-nowrap">Done:</span>}
                  <span className="font-bold text-primary">{todayScheduleStats.completed}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }
      case 'today_summary':
        return (
          <div className="bg-card rounded-lg shadow-sm border border-border p-3 h-full">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-muted-foreground" />
                <h3 className="font-semibold text-sm text-foreground">Today</h3>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Due:</span>
                  <span className="font-bold text-blue-500">{todayScheduleStats.due}</span>
                </div>
                <div className="w-px h-4 bg-border"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Overdue:</span>
                  <span className={`font-bold ${todayScheduleStats.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{todayScheduleStats.overdue}</span>
                </div>
                <div className="w-px h-4 bg-border"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Done:</span>
                  <span className="font-bold text-primary">{todayScheduleStats.completed}</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'weekly_calendar': {
        const today = new Date();
        const firstDayOfWeek = getUserFirstDayOfWeek() === 'monday' ? 1 : 0;
        const weekStart = startOfWeek(currentWeekDate, { weekStartsOn: firstDayOfWeek });

        // Calculate days based on view
        let daysToShow = 7;
        let startDate = weekStart; // Default to week start for 7-day view

        if (calendarView === 'day') {
          daysToShow = 1;
          startDate = currentWeekDate; // Start from current date for 1-day view
        } else if (calendarView === 'three-day') {
          daysToShow = 3;
          startDate = addDays(currentWeekDate, -1); // Start from day before current date for 3-day view
        }

        const weekDays = Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i));

        // Helper to get title for current view
        const getCalendarTitle = () => {
          if (calendarView === 'day') {
            return format(currentWeekDate, 'EEEE, MMM d, yyyy');
          } else if (calendarView === 'three-day') {
            const start = addDays(currentWeekDate, -1);
            const end = addDays(currentWeekDate, 1);
            return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
          } else {
            const weekStart = startOfWeek(currentWeekDate, { weekStartsOn: firstDayOfWeek });
            const weekEnd = addDays(weekStart, 6);
            return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
          }
        };

        return (
          <div className="bg-card rounded-lg shadow-sm border border-border p-3 h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-muted-foreground" />
                <h2 className="text-base font-bold text-foreground">Schedule Calendar</h2>
              </div>
              <div className="flex items-center gap-2">
                {/* Navigation arrows and Today button */}
                <button
                  onClick={() => navigateCalendar(-1)}
                  className="p-1 hover:bg-secondary rounded transition-colors"
                  title="Previous"
                >
                  <ChevronLeft size={18} className="text-muted-foreground" />
                </button>
                <button
                  onClick={goToToday}
                  className="px-2 py-1 text-xs font-medium rounded hover:bg-secondary transition-colors text-muted-foreground"
                  title="Go to today"
                >
                  Today
                </button>
                <button
                  onClick={() => navigateCalendar(1)}
                  className="p-1 hover:bg-secondary rounded transition-colors"
                  title="Next"
                >
                  <ChevronRight size={18} className="text-muted-foreground" />
                </button>
                <div className="w-px h-4 bg-border"></div>
                {/* View switcher - hidden when calendar is XS */}
                {!hideSupplements && (
                  <div className="flex rounded border border-border overflow-hidden">
                    <button
                      onClick={() => setCalendarView('day')}
                      className={`px-2 py-1 text-xs font-medium transition-colors ${
                        calendarView === 'day'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card text-muted-foreground hover:bg-secondary'
                      }`}
                      title="1 day view"
                    >
                      1d
                    </button>
                    <button
                      onClick={() => setCalendarView('three-day')}
                      className={`px-2 py-1 text-xs font-medium border-l border-border transition-colors ${
                        calendarView === 'three-day'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card text-muted-foreground hover:bg-secondary'
                      }`}
                      title="3 day view"
                    >
                      3d
                    </button>
                    <button
                      onClick={() => setCalendarView('week')}
                      className={`px-2 py-1 text-xs font-medium border-l border-border transition-colors ${
                        calendarView === 'week'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card text-muted-foreground hover:bg-secondary'
                      }`}
                      title="Week view"
                    >
                      7d
                    </button>
                  </div>
                )}
                <div className="relative">
                  <button
                    onClick={() => setShowReptileFilter(!showReptileFilter)}
                    className="p-1 rounded hover:bg-secondary transition-colors"
                    title="Filter reptiles"
                  >
                    <Filter size={16} className="text-muted-foreground" />
                  </button>
                  {showReptileFilter && (
                    <div className="absolute right-0 mt-2 bg-card border border-border rounded-lg shadow-lg p-2 z-10 min-w-[200px]">
                      {reptiles.map(reptile => (
                        <label key={reptile.id} className="flex items-center gap-2 p-2 hover:bg-secondary rounded cursor-pointer">
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
                          <span className="text-sm text-foreground">{reptile.name}</span>
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
                    className={`border border-border rounded ${calendarView === 'week' ? 'p-2' : 'p-3'} cursor-pointer hover:bg-secondary transition-colors flex flex-col ${
                      isToday ? 'border-primary' : ''
                    }`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className="text-center mb-2 flex-shrink-0">
                      <div className={`${calendarView === 'week' ? 'text-xs' : 'text-sm'} font-medium text-muted-foreground`}>
                        {format(day, calendarView === 'week' ? 'EEE' : 'EEEE, MMM d')}
                      </div>
                      {calendarView === 'week' && (
                        <div className={`text-lg font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                          {format(day, 'd')}
                        </div>
                      )}
                      {dayEvents.length > 0 && calendarView !== 'week' && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    <div className={`${calendarView === 'week' ? 'space-y-1' : 'space-y-2'} overflow-y-auto flex-1 min-h-0`}>
                      {dayEvents.length === 0 && calendarView !== 'week' && (
                        <div className="text-center text-muted-foreground py-4 text-xs">
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
                              className={`px-2 py-1 rounded bg-card border overflow-hidden ${
                                event.is_completed
                                  ? 'border-primary'
                                  : 'border-border'
                              }`}
                              title={event.notes || event.name || event.reptile_name}
                            >
                              <div className="flex items-center gap-1.5 text-xs overflow-hidden min-w-0">
                                {/* Avatar + Reptile Name (always together) */}
                                {event.reptile && (
                                  <div className="flex-shrink-0 ml-0.5">
                                    {/* Avatar sized to fit: 2px border = 4px total, base 12px = 16px total */}
                                    <ReptileAvatar reptile={event.reptile} size="sm" className="w-[12px] h-[12px] text-[6px]" />
                                  </div>
                                )}
                                <span className="font-semibold text-foreground truncate min-w-0">
                                  {event.reptile_name}
                                </span>

                                {/* Category Icon */}
                                <Icon size={12} className={`flex-shrink-0 ${color === 'orange' ? 'text-primary' : color === 'blue' ? 'text-blue-500' : 'text-purple-500'}`} />

                                {/* Notification Bell */}
                                {event.notifications_enabled && (
                                  <Bell size={10} className="flex-shrink-0 text-blue-500" title="Notifications enabled" />
                                )}

                                {/* Details */}
                                {(timeText || foodCategory) && (
                                  <span className="text-muted-foreground flex-shrink-0">•</span>
                                )}
                                {timeText && (
                                  <>
                                    <span className="text-muted-foreground flex-shrink-0">{timeText}</span>
                                    {foodCategory && <span className="text-muted-foreground flex-shrink-0">•</span>}
                                  </>
                                )}
                                {foodCategory && (
                                  <>
                                    <span className="text-muted-foreground flex-shrink-0">{foodCategory}</span>
                                  </>
                                )}
                                {!hideSupplements && event.suggested_supplements && event.suggested_supplements.length > 0 && (
                                  <>
                                    <span className="text-muted-foreground flex-shrink-0">•</span>
                                    <span className="text-amber-500 truncate min-w-0">
                                      +{event.suggested_supplements.map(s => s.name).join(', ')}
                                    </span>
                                  </>
                                )}

                                {/* Checkmark (right-aligned) */}
                                {event.is_completed && (
                                  <span className="text-primary font-bold flex-shrink-0 ml-auto">✓</span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // Compact display for week view
                        return (
                          <div
                            key={idx}
                            className={`text-xs px-1.5 py-0.5 rounded bg-card border ${
                              event.is_completed
                                ? 'border-primary'
                                : 'border-border'
                            }`}
                            title={`${event.reptile_name}${timeText ? ' • ' + timeText : ''}${foodCategory ? ' • ' + foodCategory : ''}${!hideSupplements && event.suggested_supplements?.length > 0 ? ' • +' + event.suggested_supplements.map(s => s.name).join(', ') : ''}${event.notes ? '\n' + event.notes : ''}`}
                          >
                            <div className="flex items-center gap-1 text-[10px]">
                              {/* Avatar + Reptile Name (always together) */}
                              {event.reptile && (
                                <div className="flex-shrink-0 ml-0.5">
                                  {/* Avatar sized to fit: 2px border = 4px total, base 8px = 12px total */}
                                  <ReptileAvatar reptile={event.reptile} size="sm" className="w-[8px] h-[8px] text-[5px]" />
                                </div>
                              )}
                              <span className="truncate text-muted-foreground font-medium">
                                {event.reptile_name}
                              </span>

                              {/* Category Icon */}
                              <Icon size={9} className={`flex-shrink-0 ${color === 'orange' ? 'text-primary' : color === 'blue' ? 'text-blue-500' : 'text-purple-500'}`} />

                              {/* Notification Bell */}
                              {event.notifications_enabled && (
                                <Bell size={8} className="flex-shrink-0 text-blue-500" title="Notifications enabled" />
                              )}

                              {/* Details */}
                              {(timeText || foodCategory) && <span className="text-muted-foreground">•</span>}
                              {timeText && (
                                <span className="text-muted-foreground truncate">{timeText}</span>
                              )}
                              {foodCategory && timeText && <span className="text-muted-foreground">•</span>}
                              {foodCategory && (
                                <span className="text-muted-foreground truncate">{foodCategory}</span>
                              )}

                              {/* Checkmark (right-aligned) */}
                              {event.is_completed && (
                                <span className="text-primary font-bold flex-shrink-0 ml-auto">✓</span>
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
          <div className="bg-card rounded-lg shadow-sm border border-border p-3 h-full">
            <div className="flex items-center gap-2 mb-3">
              <Scale size={18} className="text-muted-foreground" />
              <h2 className="text-base font-bold text-foreground">Weight Tracking</h2>
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
          <div className="bg-card rounded-lg shadow-sm border border-border p-3 h-full">
            <h2 className="text-base font-bold mb-2 text-foreground">Your Reptiles</h2>
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
                    <Link to={`/reptiles/${reptile.id}`} key={reptile.id} className="block p-2 rounded hover:bg-secondary/50 transition-colors border border-border">
                      <div className="flex items-center gap-2">
                        {/* Avatar + Reptile Name (always together) */}
                        <ReptileAvatar reptile={reptile} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-medium text-sm text-foreground truncate">{reptile.name}</span>
                            <span className="text-xs text-muted-foreground truncate">{reptile.species}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <div className="flex items-center gap-1 text-primary">
                              <Utensils size={11} className="flex-shrink-0" />
                              {feedingData[reptile.id] ? <span title="Days since last feeding">{daysSinceFeeding === 0 ? 'Today' : `${daysSinceFeeding}d`}</span> : <span>-</span>}
                            </div>
                            <div className="flex items-center gap-1 text-blue-500">
                              <Droplets size={11} className="flex-shrink-0" />
                              {mistingData[reptile.id] ? <span title="Days since last misting">{daysSinceMisting === 0 ? 'Today' : `${daysSinceMisting}d`}</span> : <span>-</span>}
                            </div>
                            <div className="flex items-center gap-1 text-purple-500">
                              <Scale size={11} className="flex-shrink-0" />
                              {weighingData[reptile.id] ? <span title="Days since last weighing">{daysSinceWeighing === 0 ? 'Today' : `${daysSinceWeighing}d`}</span> : <span>-</span>}
                            </div>
                            <div className="flex items-center gap-1 text-purple-500">
                              <Activity size={11} className="flex-shrink-0" />
                              {healthData[reptile.id] ? <span title="Days since last shed">{daysSinceShed === 0 ? 'Today' : `${daysSinceShed}d`}</span> : <span>-</span>}
                            </div>
                            {feedingStatus && (
                              <div className={`flex items-center gap-1 ${feedingStatus.color === 'red' ? 'text-destructive font-medium' : feedingStatus.color === 'orange' ? 'text-amber-500 font-medium' : feedingStatus.color === 'yellow' ? 'text-amber-400' : feedingStatus.color === 'green' ? 'text-primary' : 'text-muted-foreground'}`}>
                                <feedingStatus.icon size={11} className="flex-shrink-0" />
                                <span className="truncate">{feedingStatus.text}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Health Status Badge (right side) */}
                        {healthBadge && (
                          <span className="text-base flex-shrink-0" title={healthBadge.tooltip}>{healthBadge.emoji}</span>
                        )}
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-3">No reptiles added yet.</p>
                  <Link to="/reptiles/new" className="text-primary hover:underline text-sm">Add your first reptile</Link>
                </div>
              )}
            </div>
          </div>
        );
      case 'recent_activity':
        return (
          <div className="bg-card rounded-lg shadow-sm border border-border p-3 h-full">
            <h2 className="text-base font-bold mb-2 text-foreground">Recent Activity</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentActivity.length > 0 ? (
                recentActivity.map(activity => {
                  const Icon = activity.icon;
                  const colorClasses = { primary: 'text-primary', blue: 'text-blue-500', purple: 'text-purple-500', green: 'text-primary' };
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
                    <Link key={activity.id} to={detailLink} className="block p-2 rounded border border-border hover:bg-secondary/50 hover:border-primary/50 transition-colors">
                      <div className="flex items-center gap-2">
                        {/* Avatar + Reptile Name (always together) */}
                        {activity.reptile && <ReptileAvatar reptile={activity.reptile} size="sm" className="flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <p className="font-medium text-sm text-foreground">{activity.reptile ? activity.reptile.name : '(deleted reptile)'}</p>
                            <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(activity.timestamp, { addSuffix: true })}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Icon size={14} className={`flex-shrink-0 ${colorClasses[activity.color]}`} />
                            <p className="text-sm text-muted-foreground truncate">{summary}</p>
                          </div>
                        </div>
                        {/* Prominent value (for weight, feeding count, etc.) */}
                        {prominentValue && (
                          <span className="flex-shrink-0 text-lg font-bold text-primary tabular-nums">{prominentValue}</span>
                        )}
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No activity logged yet.</p>
                  <Link to="/feed" className="btn-primary">Log First Activity</Link>
                </div>
              )}
            </div>
          </div>
        );
      case 'weight_trends':
        {
          const card = dashboardCards.find(c => c.id === 'weight_trends');
          return (
            <WeightTrendsWidget
              config={card?.config || { timeRange: 90 }}
              size={card?.size || 'small'}
            />
          );
        }
      case 'week_summary':
        {
          const card = dashboardCards.find(c => c.id === 'week_summary');
          return (
            <WeekSummaryWidget
              config={card?.config || {}}
              size={card?.size || 'small'}
            />
          );
        }
      case 'compact_recent_activity':
        {
          const card = dashboardCards.find(c => c.id === 'compact_recent_activity');
          return (
            <RecentActivityWidget
              config={card?.config || { itemCount: 5 }}
              size={card?.size || 'small'}
              onViewActivity={handleViewActivity}
            />
          );
        }
      default:
        return null;
    }
  };

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-6">
      {/* Welcome section with greeting and customize button */}
      <Header
        user={user}
        actions={
          <EditModeControls
            isEditMode={isEditMode}
            onToggleEditMode={handleToggleEditMode}
            onResetLayout={handleResetLayout}
          />
        }
      />

      {/* Content area with restored padding */}
      <div className="px-4 sm:px-6 lg:px-8 pb-6">
      {/* Day Events Modal */}
      {selectedDate && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">
                {selectedDate.toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </h2>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronUp size={24} />
              </button>
            </div>

            <div className="px-6 py-4">
              {getEventsForDate(selectedDate).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
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
                            ? 'bg-card border-primary hover:border-primary/80'
                            : 'bg-card border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${getIconColorClasses(typeColor)}`}>
                            <TypeIcon size={20} />
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            {event.is_completed && (
                              <span className="text-primary font-bold">✓</span>
                            )}
                            <div className="font-semibold text-foreground">
                              {displayName}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-secondary text-muted-foreground">
                              {event.schedule_type}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reptile</span>
                            <span className="text-foreground font-medium truncate">{event.reptile_name}</span>
                          </div>

                          {event.schedule_rule && (
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Frequency</span>
                              <span className="text-foreground truncate">{event.schedule_rule.replace(/_/g, ' ')}</span>
                            </div>
                          )}

                          {event.food_category && (
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Food</span>
                              <span className="text-foreground truncate">{event.food_category}</span>
                            </div>
                          )}

                          {event.suggested_supplements && event.suggested_supplements.length > 0 && (
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Supplement</span>
                              <span className="text-foreground truncate">
                                {event.suggested_supplements.map(s => s.name).join(', ')}
                              </span>
                            </div>
                          )}

                          {event.time_window_enabled && event.earliest_time && event.latest_time ? (
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                <Clock size={12} />
                                Time Window
                                {event.notifications_enabled && <Bell size={10} className="text-blue-500" />}
                              </span>
                              <span className="text-foreground font-medium break-words">
                                {formatTime(new Date(`2000-01-01T${event.earliest_time}`))} - {formatTime(new Date(`2000-01-01T${event.latest_time}`))}
                              </span>
                            </div>
                          ) : event.time_slot ? (
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                Time
                                {event.notifications_enabled && <Bell size={10} className="text-blue-500" />}
                              </span>
                              <span className="text-foreground truncate">{event.time_slot}</span>
                            </div>
                          ) : event.notifications_enabled ? (
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                <Bell size={10} className="text-blue-500" />
                                Notifications
                              </span>
                              <span className="text-blue-500 text-xs">Enabled</span>
                            </div>
                          ) : null}
                        </div>

                        {event.notes && (
                          <div className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border">
                            <span className="font-medium text-muted-foreground">Notes:</span> {event.notes}
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

      {/* Split Layout - Sidebar + Main Grid
          Sidebar: Fixed width, independent vertical stacking
          Main: 3-column grid with responsive sizing */}
      {(() => {
        // Filter cards into zones
        const sidebarCards = dashboardCards
          .filter(card => card.visible && card.zone === 'sidebar')
          .sort((a, b) => a.order - b.order);
        const mainCards = dashboardCards
          .filter(card => card.visible && card.zone === 'main')
          .sort((a, b) => a.order - b.order);

        // On mobile, sidebar is disabled - all cards go to main
        const showSidebar = sidebarSettings.sidebarEnabled && !isMobileScreen() && (sidebarCards.length > 0 || isEditMode);

        const dragHandlers = {
          onDragStart: handleDragStart,
          onDragOver: handleDragOver,
          onDragLeave: handleDragLeave,
          onDrop: handleDrop,
          onDragEnd: handleDragEnd
        };

        return (
          <div className={`flex gap-4 ${sidebarSettings.sidebarPosition === 'right' ? 'flex-row-reverse' : ''}`}>
            {/* Sidebar - conditionally rendered */}
            {showSidebar && sidebarCards.length > 0 && (
              <>
                <DashboardSidebar
                  cards={sidebarCards}
                  isEditMode={isEditMode}
                  onHide={handleHideWidget}
                  onMoveToMain={handleMoveToMain}
                  onMoveToSidebar={handleMoveToSidebar}
                  renderCard={renderCard}
                  dragHandlers={dragHandlers}
                  draggedWidget={draggedWidget}
                  dragOverWidget={dragOverWidget}
                />
                {/* Visual divider */}
                <div className="w-px bg-border flex-shrink-0" />
              </>
            )}

            {/* Show empty drop zone when sidebar has no cards but in edit mode */}
            {showSidebar && sidebarCards.length === 0 && isEditMode && (
              <div
                className="w-72 flex-shrink-0 border-2 border-dashed border-border rounded-xl p-4 flex items-center justify-center text-muted-foreground min-h-[200px]"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const widgetId = e.dataTransfer.getData('widgetId');
                  if (widgetId) {
                    handleMoveToSidebar(widgetId);
                  }
                }}
              >
                <div className="text-center">
                  <PanelLeft className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <span className="text-sm">Drop widget here</span>
                </div>
              </div>
            )}

            {/* Main content area - 3-column grid */}
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                {mainCards.map(card => {
                  const content = renderCard(card.id);
                  if (!content) return null;

                  return (
                    <div
                      key={card.id}
                      className={`${getCardSizeClass(card.id)} relative group ${
                        dragOverWidget === card.id ? 'ring-2 ring-primary' : ''
                      } ${draggedWidget === card.id ? 'opacity-50' : ''}`}
                      draggable={isEditMode}
                      onDragStart={(e) => handleDragStart(e, card.id)}
                      onDragOver={(e) => handleDragOver(e, card.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, card.id)}
                      onDragEnd={handleDragEnd}
                    >
                      {/* Edit mode controls */}
                      {isEditMode && (
                        <>
                          {/* Drag handle */}
                          <div className="absolute top-2 left-2 z-10 w-6 h-6 bg-muted text-muted-foreground rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          {/* Move to sidebar button */}
                          {showSidebar && (
                            <button
                              onClick={() => handleMoveToSidebar(card.id)}
                              className="absolute top-2 left-10 z-10 w-6 h-6 bg-muted text-muted-foreground rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-muted/80"
                              title="Move to sidebar"
                              aria-label={`Move ${card.id} to sidebar`}
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}
                          {/* Resize button */}
                          <button
                            onClick={() => handleResizeWidget(card.id)}
                            className="absolute top-2 right-10 z-10 h-6 px-1.5 bg-muted text-muted-foreground rounded flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-muted/80"
                            title={`Resize widget (current: ${getSizeLabel(card.id)})`}
                            aria-label={`Resize ${card.id} widget`}
                          >
                            <Maximize2 className="w-3 h-3" />
                            <span className="text-[10px] font-medium">{getSizeLabel(card.id)}</span>
                          </button>
                          {/* Hide button */}
                          <button
                            onClick={() => handleHideWidget(card.id)}
                            className="absolute top-2 right-2 z-10 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-destructive/90"
                            title="Hide widget"
                            aria-label={`Hide ${card.id} widget`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      {content}
                    </div>
                  );
                })}

                {/* If sidebar is disabled, also render sidebar cards in main */}
                {!showSidebar && sidebarCards.map(card => {
                  const content = renderCard(card.id);
                  if (!content) return null;

                  return (
                    <div
                      key={card.id}
                      className={`col-span-1 sm:col-span-3 relative group ${
                        dragOverWidget === card.id ? 'ring-2 ring-primary' : ''
                      } ${draggedWidget === card.id ? 'opacity-50' : ''}`}
                      draggable={isEditMode}
                      onDragStart={(e) => handleDragStart(e, card.id)}
                      onDragOver={(e) => handleDragOver(e, card.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, card.id)}
                      onDragEnd={handleDragEnd}
                    >
                      {isEditMode && (
                        <>
                          <div className="absolute top-2 left-2 z-10 w-6 h-6 bg-muted text-muted-foreground rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <button
                            onClick={() => handleHideWidget(card.id)}
                            className="absolute top-2 right-2 z-10 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-destructive/90"
                            title="Hide widget"
                            aria-label={`Hide ${card.id} widget`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      {content}
                    </div>
                  );
                })}

                {/* Drop zone at bottom of main grid for adding cards from sidebar */}
                {isEditMode && showSidebar && (
                  <div
                    className={`col-span-1 sm:col-span-3 min-h-[80px] border-2 border-dashed rounded-xl flex items-center justify-center text-sm text-muted-foreground transition-colors ${
                      mainZoneDropActive ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setMainZoneDropActive(true);
                    }}
                    onDragLeave={() => setMainZoneDropActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setMainZoneDropActive(false);
                      const widgetId = e.dataTransfer.getData('widgetId');
                      if (widgetId) {
                        handleMoveToMain(widgetId);
                      }
                    }}
                  >
                    Drop here
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* QuickLogForm modal */}
      {quickLogTask && (
        <QuickLogForm
          task={quickLogTask}
          onClose={handleQuickLogClose}
          onSubmit={handleQuickLogSubmit}
        />
      )}

      {/* Floating Add Widget button - only visible in edit mode */}
      {isEditMode && (
        <button
          onClick={() => setShowWidgetGallery(true)}
          className="fixed bottom-20 lg:bottom-6 right-6 bg-primary text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors z-40"
          title="Add Widget"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

        {/* Widget Gallery modal */}
        <WidgetGallery
          isOpen={showWidgetGallery}
          availableWidgets={dashboardCards}
          onAddWidget={handleAddWidget}
          onClose={() => setShowWidgetGallery(false)}
          sidebarEnabled={sidebarSettings.sidebarEnabled && !isMobileScreen()}
        />

        {/* View Log Modal (Phase 27) */}
        <ViewLogModal
          logId={viewLogId}
          logType={selectedLogType}
          open={viewLogOpen}
          onOpenChange={(open) => !open && closeViewLog()}
          onEdit={() => {}} // In-place edit handled internally
          onDelete={() => {
            closeViewLog();
            refreshDashboard();
          }}
        />

        {/* View Schedule Modal (Phase 27) */}
        <ViewScheduleModal
          scheduleId={viewScheduleId}
          open={viewScheduleOpen}
          onOpenChange={(open) => !open && closeViewSchedule()}
          onEdit={() => navigate(`/schedule/${viewScheduleId}/edit`)}
          onDelete={() => {
            closeViewSchedule();
            refreshDashboard();
          }}
        />

        {/* Create Log Modal (Phase 27) */}
        <CreateLogModal
          logType={createType}
          reptileId={selectedReptileId}
          prefill={prefillData}
          open={createOpen}
          onOpenChange={(open) => !open && closeCreate()}
          onSuccess={() => {
            closeCreate();
            refreshDashboard();
          }}
          onCancel={closeCreate}
        />
      </div>
    </div>
  );
}