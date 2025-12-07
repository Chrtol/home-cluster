import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, List, Edit, Trash2, ChevronDown, ChevronUp, Clock, Utensils, Droplets, Scale, Bell } from "lucide-react";
import { formatTime, getDayNames, getUserFirstDayOfWeek, toLocalISODate } from "../utils/dateFormatting";

function Calendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Detect if mobile device
  const [isMobile, setIsMobile] = useState(false);

  // Set initial view based on localStorage and device - mobile defaults to 3-day
  const getInitialView = () => {
    const isMobileDevice = window.innerWidth < 768;
    const saved = localStorage.getItem('calendar_view');

    // If we have a saved preference, use it (unless it's month/week on mobile)
    if (saved) {
      // On mobile, only allow day and 3-day views
      if (isMobileDevice && (saved === 'month' || saved === 'week')) {
        return '3-day';
      }
      return saved;
    }

    // Default: mobile gets 3-day, desktop gets month
    return isMobileDevice ? "3-day" : "month";
  };

  const [view, setView] = useState(getInitialView()); // "month", "week", "3-day", "day"
  const [reptiles, setReptiles] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [feedingRotations, setFeedingRotations] = useState([]); // Feeding rotations for supplement suggestions
  const [events, setEvents] = useState([]); // Calculated events based on schedules
  const [feedings, setFeedings] = useState([]); // Past feedings
  const [mistings, setMistings] = useState([]); // Past mistings
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showSchedules, setShowSchedules] = useState(false);
  const [visibleReptiles, setVisibleReptiles] = useState(new Set());
  const [visibleCategories, setVisibleCategories] = useState(new Set());
  const [quotaStatuses, setQuotaStatuses] = useState({});

  useEffect(() => {
    fetchReptiles();
    // Load filter state from localStorage
    const savedFilters = localStorage.getItem('calendar_reptile_filters');
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      // If saved filters is empty array, don't use it (initialize with all reptiles later)
      if (parsed && parsed.length > 0) {
        setVisibleReptiles(new Set(parsed));
      }
    }

    // Load category filter state from localStorage
    const savedCategoryFilters = localStorage.getItem('calendar_category_filters');
    if (savedCategoryFilters) {
      const parsed = JSON.parse(savedCategoryFilters);
      // If saved filters is empty array, don't use it (use default)
      if (parsed && parsed.length > 0) {
        setVisibleCategories(new Set(parsed));
      } else {
        // Default to all categories visible
        setVisibleCategories(new Set(['feeding', 'misting', 'weighing', 'supplement']));
      }
    } else {
      // Default to all categories visible
      setVisibleCategories(new Set(['feeding', 'misting', 'weighing', 'supplement']));
    }

    // Detect mobile and restrict view options
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth < 768;
      setIsMobile(isMobileDevice);

      // If switching to mobile and current view is not allowed, switch to 3-day
      if (isMobileDevice && view !== "day" && view !== "3-day") {
        setView("3-day");
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Save calendar view to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('calendar_view', view);
  }, [view]);

  useEffect(() => {
    if (reptiles.length > 0) {
      fetchCalendarData();
    }
  }, [reptiles, currentDate, visibleReptiles]);

  // Re-fetch data when page becomes visible (handles stale data when navigating back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && reptiles.length > 0) {
        fetchCalendarData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [reptiles, currentDate, visibleReptiles]);

  const fetchReptiles = async () => {
    try {
      const response = await axios.get("/api/reptiles");
      setReptiles(response.data);

      // Initialize all reptiles as visible if no saved filters or if saved filter is empty
      const savedFilters = localStorage.getItem('calendar_reptile_filters');
      if (!savedFilters || (savedFilters && JSON.parse(savedFilters).length === 0)) {
        setVisibleReptiles(new Set(response.data.map(r => r.id)));
      }
    } catch (error) {
      console.error("Error fetching reptiles:", error);
    }
  };

  const fetchCalendarData = async () => {
    try {
      setLoading(true);

      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const toLocalISODate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Build reptile_ids filter for instances
      const activeReptileIds = visibleReptiles.size > 0
        ? Array.from(visibleReptiles).join(',')
        : undefined;

      // Single bulk request for all calendar data
      const bulkResponse = await axios.get('/api/bulk/calendar', {
        params: {
          start_date: toLocalISODate(monthStart),
          end_date: toLocalISODate(monthEnd),
          reptile_ids: activeReptileIds
        }
      });

      const data = bulkResponse.data;

      // Set schedules and rotations (already have reptile_name from backend)
      setSchedules(data.schedules);
      setFeedingRotations(data.feeding_rotations);
      setQuotaStatuses(data.quota_statuses || {});

      // Set past feedings and mistings
      const feedingsWithType = data.feedings.map(f => ({
        ...f,
        reptile_name: f.reptile?.name || 'Unknown',
        type: 'feeding'
      }));
      const mistingsWithType = data.mistings.map(m => ({
        ...m,
        reptile_name: m.reptile?.name || 'Unknown',
        type: 'misting'
      }));

      setFeedings(feedingsWithType);
      setMistings(mistingsWithType);

      // Transform instances to event format
      const instanceEvents = data.instances
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
            min_days_between: instance.schedule.min_days_between,
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
          // Pre-calculated supplements from the instance
          suggested_supplements: instance.supplements || []
        };
      });

      setEvents(instanceEvents);
    } catch (error) {
      console.error("Error fetching calendar data:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 6 = Saturday

    const days = [];

    // Get first day of week preference
    const firstDayOfWeek = getUserFirstDayOfWeek();
    const offset = firstDayOfWeek === 'monday' ? 1 : 0;

    // Calculate padding based on first day preference
    let paddingDays = startingDayOfWeek - offset;
    if (paddingDays < 0) paddingDays += 7;

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < paddingDays; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const getDaysInWeek = () => {
    const firstDayOfWeek = getUserFirstDayOfWeek();
    const offset = firstDayOfWeek === 'monday' ? 1 : 0;

    const startOfWeek = new Date(currentDate);
    const currentDayOfWeek = currentDate.getDay();

    // Calculate days to subtract to get to the start of the week
    let daysToSubtract = currentDayOfWeek - offset;
    if (daysToSubtract < 0) daysToSubtract += 7;

    startOfWeek.setDate(currentDate.getDate() - daysToSubtract);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getDaysInThreeDays = () => {
    // Show yesterday + today + tomorrow (total of 3 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day
    const days = [];
    for (let i = -1; i <= 1; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getHoursInDay = () => {
    const hours = [];
    for (let i = 0; i < 24; i++) {
      hours.push(i);
    }
    return hours;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];

    // Only log for a specific date to avoid console spam
    const isTargetDate = date.getDate() === 5 && date.getMonth() === 11; // Dec 5
    if (isTargetDate) {
      console.log('[Calendar] ===== Detailed logging for Dec 5 =====');
      console.log('[Calendar] getEventsForDate called for', date.toDateString(), date);
      console.log('[Calendar] Total events:', events.length);

      // Log ALL events for Dec 5
      const dec5Events = events.filter(e => e.date.getDate() === 5 && e.date.getMonth() === 11);
      console.log('[Calendar] Events with date Dec 5:', dec5Events.length);
      dec5Events.forEach(e => {
        console.log('[Calendar] Dec 5 event:', {
          id: e.instance_id,
          date: e.date,
          dateStr: e.date.toDateString(),
          reptile_id: e.reptile_id,
          reptile_name: e.reptile_name,
          schedule_type: e.schedule_type
        });
      });

      console.log('[Calendar] visibleReptiles:', Array.from(visibleReptiles));
      console.log('[Calendar] visibleCategories:', Array.from(visibleCategories));
    }

    // Get schedule instances for this date
    // Instances already have status and completion info from the backend
    const filtered = events.filter(event => {
      // event.date is already a proper Date object parsed as local time
      const dateMatch = event.date.toDateString() === date.toDateString();
      const reptileMatch = visibleReptiles.has(event.reptile_id);
      const categoryMatch = visibleCategories.has(event.schedule_type);

      return dateMatch && reptileMatch && categoryMatch;
    }).map(e => ({
      ...e,
      // Mark as completed if status indicates completion
      is_completed: e.status === 'completed',
      is_actual: false, // This is a schedule instance
    }));

    console.log('[Calendar] Returning', filtered.length, 'events for', date.toDateString());
    return filtered;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
    setTimeout(() => fetchInstances(), 0);
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
    setTimeout(() => fetchInstances(), 0);
  };

  const navigateDay = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    setCurrentDate(newDate);
    setTimeout(() => fetchInstances(), 0);
  };

  const navigateView = (direction) => {
    if (view === "month") {
      navigateMonth(direction);
    } else if (view === "week") {
      navigateWeek(direction);
    } else if (view === "3-day") {
      // 3-day view always shows today + next 2 days, no navigation needed
      return;
    } else {
      navigateDay(direction);
    }
  };

  const getViewTitle = () => {
    if (view === "month") {
      return currentDate.toLocaleString("default", { month: "long", year: "numeric" });
    } else if (view === "week") {
      const weekDays = getDaysInWeek();
      const start = weekDays[0].toLocaleDateString("default", { month: "short", day: "numeric" });
      const end = weekDays[6].toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" });
      return `${start} - ${end}`;
    } else if (view === "3-day") {
      const threeDays = getDaysInThreeDays();
      const start = threeDays[0].toLocaleDateString("default", { month: "short", day: "numeric" });
      const end = threeDays[2].toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" });
      return `${start} - ${end}`;
    } else {
      return currentDate.toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }
  };

  const getEventLink = (event) => {
    // Always link to schedule instance if we have an instance_id
    if (event.instance_id) {
      return `/schedule-instances/${event.instance_id}`;
    }

    // Fallback for manual entries without a schedule
    if (event.is_actual) {
      if (event.type === "feeding" || event.schedule_type === "feeding") {
        return `/feed/${event.id}`;
      } else if (event.type === "misting" || event.schedule_type === "misting") {
        return `/misting/${event.id}`;
      }
    }

    // Final fallback to schedule
    if (event.schedule_id) {
      return `/schedules/${event.schedule_id}`;
    }

    return null;
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  const toggleReptileFilter = (reptileId) => {
    const newFilters = new Set(visibleReptiles);
    if (newFilters.has(reptileId)) {
      newFilters.delete(reptileId);
    } else {
      newFilters.add(reptileId);
    }
    setVisibleReptiles(newFilters);
    // Save to localStorage
    localStorage.setItem('calendar_reptile_filters', JSON.stringify(Array.from(newFilters)));
  };

  const toggleAllReptiles = () => {
    if (visibleReptiles.size === reptiles.length) {
      // If all are visible, hide all
      setVisibleReptiles(new Set());
      localStorage.setItem('calendar_reptile_filters', JSON.stringify([]));
    } else {
      // Show all
      const allIds = new Set(reptiles.map(r => r.id));
      setVisibleReptiles(allIds);
      localStorage.setItem('calendar_reptile_filters', JSON.stringify(Array.from(allIds)));
    }
  };

  const toggleCategoryFilter = (category) => {
    const newFilters = new Set(visibleCategories);
    if (newFilters.has(category)) {
      newFilters.delete(category);
    } else {
      newFilters.add(category);
    }
    setVisibleCategories(newFilters);
    // Save to localStorage
    localStorage.setItem('calendar_category_filters', JSON.stringify(Array.from(newFilters)));
  };

  const toggleAllCategories = () => {
    const allCategories = ['feeding', 'misting', 'weighing', 'supplement'];
    if (visibleCategories.size === allCategories.length) {
      // If all are visible, hide all
      setVisibleCategories(new Set());
      localStorage.setItem('calendar_category_filters', JSON.stringify([]));
    } else {
      // Show all
      setVisibleCategories(new Set(allCategories));
      localStorage.setItem('calendar_category_filters', JSON.stringify(allCategories));
    }
  };

  const getScheduleTypeIcon = (type) => {
    switch (type) {
      case "feeding":
        return { Icon: Utensils, color: "primary" };
      case "misting":
        return { Icon: Droplets, color: "blue" };
      case "weighing":
        return { Icon: Scale, color: "purple" };
      default:
        return { Icon: CalendarIcon, color: "gray" };
    }
  };

  const getIconColorClasses = (color) => {
    const colors = {
      primary: "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400",
      blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
      purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
      gray: "bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400"
    };
    return colors[color] || colors.gray;
  };

  const handleDeleteSchedule = async (schedule) => {
    const scheduleName = schedule.name || schedule.schedule_type;
    if (!window.confirm(`Are you sure you want to delete schedule "${scheduleName}"?`)) {
      return;
    }

    try {
      const response = await axios.delete(`/api/schedules/${schedule.id}`, {
        validateStatus: (status) => status >= 200 && status < 300, // Accept all 2xx as success
      });

      // Refresh schedules and recalculate events
      await fetchSchedules();
      alert("Schedule deleted successfully");
    } catch (error) {
      console.error("Error deleting schedule:", error);
      alert("Failed to delete schedule");
    }
  };

  const formatScheduleRule = (schedule) => {
    switch (schedule.schedule_rule) {
      case "every_x_days":
        return `Every ${schedule.frequency_days} day${schedule.frequency_days > 1 ? 's' : ''}`;
      case "days_of_week":
        const days = schedule.days_of_week.split(",").map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parseInt(d)]);
        return `Every ${days.join(", ")}`;
      case "monthly":
        return `Monthly on day ${schedule.day_of_month}`;
      case "dependent":
        return `Dependent on parent schedule`;
      default:
        return schedule.schedule_rule;
    }
  };

  const getQuotaBadge = (scheduleId) => {
    const quotaStatus = quotaStatuses[scheduleId];
    if (!quotaStatus) return null;

    const { count, quota_frequency, period_type, quota_met, quota_exceeded } = quotaStatus;
    const periodLabel = period_type === 'week' ? 'week' : 'month';

    if (quota_exceeded) {
      return {
        text: `${count}/${quota_frequency} this ${periodLabel} ⚠`,
        className: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-700'
      };
    } else if (quota_met) {
      return {
        text: `${count}/${quota_frequency} this ${periodLabel} ✓`,
        className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700'
      };
    } else {
      return {
        text: `${count}/${quota_frequency} this ${periodLabel}`,
        className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
      };
    }
  };

  const getScheduleTypeColor = (type, isActual) => {
    if (isActual) {
      // Solid colors for actual completed activities
      switch (type) {
        case "feeding":
          return "bg-primary-200 text-primary-800 dark:bg-primary-800 dark:text-primary-200 border border-primary-300 dark:border-primary-700";
        case "misting":
          return "bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700";
        case "weighing":
          return "bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700";
        case "supplement":
          return "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200 border border-green-300 dark:border-green-700";
        default:
          return "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600";
      }
    } else {
      // Outlined/lighter colors for scheduled events
      switch (type) {
        case "feeding":
          return "bg-primary-900/20 text-primary-300 dark:bg-primary-900/30 dark:text-primary-300 border border-primary-700 dark:border-primary-700";
        case "misting":
          return "bg-blue-900/20 text-blue-300 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-700 dark:border-blue-700";
        case "weighing":
          return "bg-purple-900/20 text-purple-300 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-700 dark:border-purple-700";
        case "supplement":
          return "bg-green-900/20 text-green-300 dark:bg-green-900/30 dark:text-green-300 border border-green-700 dark:border-green-700";
        default:
          return "bg-gray-900/20 text-gray-300 dark:bg-gray-900/30 dark:text-gray-300 border border-gray-700 dark:border-gray-700";
      }
    }
  };

  const getEventSquareColor = (type, isActual) => {
    if (isActual) {
      // Solid colors for actual completed activities (for small squares)
      switch (type) {
        case "feeding":
          return "bg-green-500 dark:bg-green-600 border border-green-600 dark:border-green-500";
        case "misting":
          return "bg-blue-500 dark:bg-blue-600 border border-blue-600 dark:border-blue-500";
        case "weighing":
          return "bg-purple-500 dark:bg-purple-600 border border-purple-600 dark:border-purple-500";
        case "supplement":
          return "bg-emerald-500 dark:bg-emerald-600 border border-emerald-600 dark:border-emerald-500";
        default:
          return "bg-gray-500 dark:bg-gray-600 border border-gray-600 dark:border-gray-500";
      }
    } else {
      // Lighter/outlined colors for scheduled events
      switch (type) {
        case "feeding":
          return "bg-green-200 dark:bg-green-800 border border-green-400 dark:border-green-700";
        case "misting":
          return "bg-blue-200 dark:bg-blue-800 border border-blue-400 dark:border-blue-700";
        case "weighing":
          return "bg-purple-200 dark:bg-purple-800 border border-purple-400 dark:border-purple-700";
        case "supplement":
          return "bg-emerald-200 dark:bg-emerald-800 border border-emerald-400 dark:border-emerald-700";
        default:
          return "bg-gray-200 dark:bg-gray-800 border border-gray-400 dark:border-gray-700";
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6">
        {/* Header with title, category filters, and action buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Calendar</h1>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Category Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => toggleCategoryFilter('feeding')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  visibleCategories.has('feeding')
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Feeding
              </button>
              <button
                onClick={() => toggleCategoryFilter('misting')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  visibleCategories.has('misting')
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Misting
              </button>
              <button
                onClick={() => toggleCategoryFilter('weighing')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  visibleCategories.has('weighing')
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Health
              </button>
              <button
                onClick={() => toggleCategoryFilter('supplement')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  visibleCategories.has('supplement')
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Supplement
              </button>
              <button
                onClick={toggleAllCategories}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {visibleCategories.size === 4 ? 'Hide All' : 'Show All'}
              </button>
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-8 w-px bg-gray-300 dark:bg-gray-600"></div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowSchedules(!showSchedules)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <List size={20} />
                <span className="hidden sm:inline">Manage Schedules</span>
                <span className="sm:hidden">Schedules</span>
                {showSchedules ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <button
                onClick={() => navigate("/schedule-create")}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Add Schedule</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Reptile Filters */}
        {reptiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reptiles:</span>
            {reptiles.map(reptile => (
              <button
                key={reptile.id}
                onClick={() => toggleReptileFilter(reptile.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  visibleReptiles.has(reptile.id)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {reptile.name}
              </button>
            ))}
            <button
              onClick={toggleAllReptiles}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {visibleReptiles.size === reptiles.length ? 'Hide All' : 'Show All'}
            </button>
          </div>
        )}
      </div>

      {/* Schedules Management Section */}
      {showSchedules && (
        <div className="card mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Active Schedules</h2>

          {schedules.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <p className="mb-4">No schedules created yet</p>
              <button
                onClick={() => navigate("/schedule-create")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus size={20} />
                Create your first schedule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.filter(schedule => visibleReptiles.has(schedule.reptile_id) && visibleCategories.has(schedule.schedule_type)).map(schedule => (
                <div
                  key={schedule.id}
                  className="flex items-start justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
                >
                  <Link to={`/schedules/${schedule.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {schedule.reptile?.name || 'Unknown'}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getScheduleTypeColor(schedule.schedule_type, false)}`}>
                        {schedule.schedule_type}
                      </span>
                      {!schedule.enabled && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          Disabled
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {schedule.schedule_mode === 'interval' ? (
                        <>
                          Interval-based
                          {schedule.min_days_between && schedule.max_days_between && (
                            <span className="ml-2">• Every {schedule.min_days_between}-{schedule.max_days_between} days</span>
                          )}
                          {schedule.name && <span className="ml-2">• {schedule.name}</span>}
                        </>
                      ) : (
                        <>
                          {formatScheduleRule(schedule)}
                          {schedule.name && <span className="ml-2">• {schedule.name}</span>}
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 mt-2">
                      {schedule.food_category && (
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          <span className="font-medium">Food:</span> {schedule.food_category}
                        </div>
                      )}

                      {schedule.time_slot && (
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          <span className="font-medium">Time:</span> {schedule.time_slot}
                        </div>
                      )}

                      {schedule.health_category && (
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          <span className="font-medium">Activity:</span> {schedule.health_category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </div>
                      )}

                      {schedule.time_window_enabled && schedule.earliest_time && schedule.latest_time && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
                          <Clock size={12} />
                          <span className="font-medium">Window:</span>
                          <span>
                            {formatTime(new Date(`2000-01-01T${schedule.earliest_time}`))} - {formatTime(new Date(`2000-01-01T${schedule.latest_time}`))}
                          </span>
                        </div>
                      )}

                      {schedule.notifications_enabled && (
                        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          <Bell size={12} />
                          <span className="font-medium">Notifications enabled</span>
                        </div>
                      )}
                    </div>

                    {schedule.notes && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        {schedule.notes}
                      </div>
                    )}
                  </Link>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => navigate(`/schedule-edit/${schedule.id}`)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Edit schedule"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(schedule)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Delete schedule"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                    const link = getEventLink(event);

                    const { Icon: TypeIcon, color: typeColor } = getScheduleTypeIcon(event.schedule_type);

                    const EventContent = (
                      <div className={`px-4 py-3 rounded-lg border-2 ${
                        event.is_completed || event.is_actual
                          ? 'bg-white dark:bg-gray-800 border-green-500 dark:border-green-600'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                      }`}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${getIconColorClasses(typeColor)}`}>
                            <TypeIcon size={20} />
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            {(event.is_completed || event.is_actual) && (
                              <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                            )}
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {displayName}
                            </div>
                          </div>
                          {event.supplement && (
                            <div className="flex gap-1.5 flex-wrap">
                              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700">
                                {event.supplement.name}
                              </span>
                            </div>
                          )}
                          {event.suggested_supplements && event.suggested_supplements.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap">
                              {event.suggested_supplements.map((supp, suppIdx) => (
                                <span key={suppIdx} className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                  + {supp.name}
                                </span>
                              ))}
                            </div>
                          )}
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
                                {event.notifications_enabled && <Bell size={10} className="text-blue-500 dark:text-blue-400" />}
                              </span>
                              <span className="text-gray-900 dark:text-white font-medium whitespace-nowrap">
                                {formatTime(new Date(`2000-01-01T${event.earliest_time}`))} - {formatTime(new Date(`2000-01-01T${event.latest_time}`))}
                              </span>
                            </div>
                          ) : event.time_slot ? (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                Time
                                {event.notifications_enabled && <Bell size={10} className="text-blue-500 dark:text-blue-400" />}
                              </span>
                              <span className="text-gray-900 dark:text-white">{event.time_slot}</span>
                            </div>
                          ) : event.notifications_enabled ? (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                <Bell size={10} className="text-blue-500 dark:text-blue-400" />
                                Notifications
                              </span>
                              <span className="text-blue-600 dark:text-blue-400 text-xs">Enabled</span>
                            </div>
                          ) : null}

                          {(event.completed_time || event.time) && (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Completed</span>
                              <span className="text-green-600 dark:text-green-400 font-medium">{event.completed_time || event.time}</span>
                            </div>
                          )}
                        </div>

                        {event.notes && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Notes:</span> {event.notes}
                          </div>
                        )}
                      </div>
                    );

                    return link ? (
                      <Link
                        key={idx}
                        to={link}
                        className="block hover:opacity-80 transition-opacity"
                      >
                        {EventContent}
                      </Link>
                    ) : (
                      <div key={idx}>
                        {EventContent}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Calendar Controls */}
      <div className="card mb-4">
        {/* View Switcher with Legend */}
        <div className="flex flex-col lg:flex-row lg:items-center sm:justify-between gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* View Buttons */}
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden w-full sm:w-auto">
            {/* Month and Week views - hidden on mobile */}
            {!isMobile && (
              <>
                <button
                  onClick={() => setView("month")}
                  className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-sm font-medium transition-colors ${
                    view === "month"
                      ? "bg-primary-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setView("week")}
                  className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-sm font-medium border-l border-gray-200 dark:border-gray-700 transition-colors ${
                    view === "week"
                      ? "bg-primary-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  Week
                </button>
              </>
            )}
            {/* 3-day view - always visible */}
            <button
              onClick={() => setView("3-day")}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-sm font-medium ${!isMobile ? 'border-l border-gray-200 dark:border-gray-700' : ''} transition-colors ${
                view === "3-day"
                  ? "bg-primary-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              3-Day
            </button>
            {/* Day view - always visible */}
            <button
              onClick={() => setView("day")}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-sm font-medium border-l border-gray-200 dark:border-gray-700 transition-colors ${
                view === "day"
                  ? "bg-primary-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              Day
            </button>
          </div>

          {/* Divider */}
          <div className="hidden sm:block h-8 w-px bg-gray-300 dark:bg-gray-600"></div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Scheduled */}
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 dark:text-gray-400">Scheduled:</span>
              <div className="px-2 py-0.5 rounded bg-primary-900/20 text-primary-300 dark:bg-primary-900/30 dark:text-primary-300 border border-primary-700 dark:border-primary-700">
                Feed
              </div>
              <div className="px-2 py-0.5 rounded bg-blue-900/20 text-blue-300 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-700 dark:border-blue-700">
                Mist
              </div>
              <div className="px-2 py-0.5 rounded bg-green-900/20 text-green-300 dark:bg-green-900/30 dark:text-green-300 border border-green-700 dark:border-green-700">
                Supp
              </div>
            </div>

            <span className="text-gray-300 dark:text-gray-600">|</span>

            {/* Completed */}
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 dark:text-gray-400">Completed:</span>
              <div className="px-2 py-0.5 rounded bg-primary-200 text-primary-800 dark:bg-primary-800 dark:text-primary-200 border border-primary-300 dark:border-primary-700">
                ✓ Feed
              </div>
              <div className="px-2 py-0.5 rounded bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
                ✓ Mist
              </div>
              <div className="px-2 py-0.5 rounded bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200 border border-green-300 dark:border-green-700">
                ✓ Supp
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between sm:justify-start gap-2">
            <button
              onClick={() => navigateView(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft size={24} />
            </button>

            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white min-w-[200px] text-center">
              {getViewTitle()}
            </h2>

            <button
              onClick={() => navigateView(1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {/* Month View */}
        {view === "month" && (
          <>
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
              {getDayNames(true).map(day => (
                <div key={day} className="text-center text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {getDaysInMonth().map((date, index) => {
                const dayEvents = date ? getEventsForDate(date) : [];
                const isToday = date && date.toDateString() === new Date().toDateString();
                const isSelected = selectedDate && date && date.toDateString() === selectedDate.toDateString();

                return (
                  <div
                    key={index}
                    onClick={() => date && handleDateClick(date)}
                    className={`
                      min-h-16 sm:min-h-24 p-1 sm:p-2 rounded-lg border transition-all
                      ${!date ? "bg-gray-50 dark:bg-gray-800/50" : "cursor-pointer hover:border-primary-300 dark:hover:border-primary-600"}
                      ${isToday ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-gray-200 dark:border-gray-700"}
                      ${isSelected ? "ring-2 ring-primary-500" : ""}
                    `}
                  >
                    {date && (
                      <>
                        <div className={`text-xs sm:text-sm font-semibold mb-1 ${isToday ? "text-primary-700 dark:text-primary-400" : "text-gray-700 dark:text-gray-300"}`}>
                          {date.getDate()}
                        </div>

                        {/* Desktop: Show first 2 events as text, rest as squares */}
                        <div className="space-y-1 hidden sm:block">
                          {dayEvents.slice(0, 2).map((event, idx) => {
                            const displayName = event.name || `${event.reptile_name}: ${event.schedule_type}`;
                            const detail = event.food_category ? ` (${event.food_category})` : event.time_slot ? ` (${event.time_slot})` : '';
                            const supplements = event.suggested_supplements || [];
                            const supplementText = supplements.map(s => s.name).join(', ');
                            const notificationText = event.notifications_enabled ? ' [Notifications ON]' : '';

                            return (
                              <div
                                key={idx}
                                className={`text-xs px-2 py-1 rounded truncate flex items-center gap-1 ${getScheduleTypeColor(event.schedule_type, event.is_actual)}`}
                                title={`${displayName}${detail}${supplementText ? ` + ${supplementText}` : ''}${notificationText}`}
                              >
                                {event.is_actual && "✓ "}
                                <span className="truncate">
                                  {displayName}
                                  {detail && <span className="opacity-75">{detail}</span>}
                                </span>
                                {event.notifications_enabled && <Bell size={10} className="flex-shrink-0" />}
                              </div>
                            );
                          })}
                          {dayEvents.length > 2 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {dayEvents.slice(2).map((event, idx) => {
                                const displayName = event.name || `${event.reptile_name}: ${event.schedule_type}`;
                                const detail = event.food_category ? ` (${event.food_category})` : event.time_slot ? ` (${event.time_slot})` : '';
                                const supplements = event.suggested_supplements || [];
                                const supplementText = supplements.map(s => s.name).join(', ');
                                const notificationText = event.notifications_enabled ? ' [Notifications ON]' : '';
                                const tooltipText = `${event.is_actual ? '✓ ' : ''}${displayName}${detail}${supplementText ? ` + ${supplementText}` : ''}${notificationText}`;

                                return (
                                  <div
                                    key={idx}
                                    className={`w-3 h-3 rounded-sm ${getEventSquareColor(event.schedule_type, event.is_actual)} transition-transform hover:scale-150 cursor-pointer`}
                                    title={tooltipText}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {/* Mobile: Show all events as squares */}
                        {dayEvents.length > 0 && (
                          <div className="sm:hidden flex flex-wrap gap-1 justify-center mt-1">
                            {dayEvents.map((event, idx) => {
                              const displayName = event.name || `${event.reptile_name}: ${event.schedule_type}`;
                              const detail = event.food_category ? ` (${event.food_category})` : event.time_slot ? ` (${event.time_slot})` : '';
                              const supplements = event.suggested_supplements || [];
                              const supplementText = supplements.map(s => s.name).join(', ');
                              const notificationText = event.notifications_enabled ? ' [Notifications ON]' : '';
                              const tooltipText = `${event.is_actual ? '✓ ' : ''}${displayName}${detail}${supplementText ? ` + ${supplementText}` : ''}${notificationText}`;

                              return (
                                <div
                                  key={idx}
                                  className={`w-2.5 h-2.5 rounded-sm ${getEventSquareColor(event.schedule_type, event.is_actual)}`}
                                  title={tooltipText}
                                />
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Week View */}
        {view === "week" && (
          <>
            <div className="grid grid-cols-7 gap-2 mb-2">
              {getDayNames(true).map(day => (
                <div key={day} className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
              {getDaysInWeek().map((date, index) => {
                const dayEvents = getEventsForDate(date);
                const isToday = date.toDateString() === new Date().toDateString();
                const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

                return (
                  <div
                    key={index}
                    onClick={() => handleDateClick(date)}
                    className={`
                      p-3 rounded-lg border transition-all cursor-pointer hover:border-primary-300 dark:hover:border-primary-600
                      ${isToday ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-gray-200 dark:border-gray-700"}
                      ${isSelected ? "ring-2 ring-primary-500" : ""}
                    `}
                  >
                    <div className="flex sm:block items-center justify-between sm:justify-start mb-2">
                      <div className={`text-sm font-semibold ${isToday ? "text-primary-700 dark:text-primary-400" : "text-gray-700 dark:text-gray-300"}`}>
                        <span className="sm:hidden">{date.toLocaleDateString("default", { weekday: "short" })} </span>
                        {date.getDate()}
                      </div>
                      {dayEvents.length > 0 && (
                        <div className="sm:hidden text-xs text-gray-500 dark:text-gray-400">
                          {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 hidden sm:block">
                      {dayEvents.map((event, idx) => {
                        const displayName = event.name || `${event.reptile_name}`;

                        return (
                          <div
                            key={idx}
                            className={`text-xs px-2 py-1.5 rounded ${getScheduleTypeColor(event.schedule_type, event.is_actual)}`}
                            title={displayName}
                          >
                            {event.is_actual && "✓ "}
                            <div className="truncate">{displayName}</div>
                            <div className="text-xs opacity-75 truncate capitalize flex items-center gap-1">
                              {event.schedule_type}
                              {event.notifications_enabled && (
                                <Bell size={10} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />
                              )}
                            </div>
                            {event.time_window_enabled && event.earliest_time && event.latest_time && (
                              <div className="text-[10px] opacity-60 flex items-center gap-0.5 mt-0.5">
                                <Clock size={8} />
                                {formatTime(new Date(`2000-01-01T${event.earliest_time}`))} - {formatTime(new Date(`2000-01-01T${event.latest_time}`))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 3-Day View - Enhanced with more details */}
        {view === "3-day" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {getDaysInThreeDays().map((date, index) => {
                const dayEvents = getEventsForDate(date);
                const isToday = date.toDateString() === new Date().toDateString();
                const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

                return (
                  <div
                    key={index}
                    className={`
                      p-4 rounded-lg border transition-all
                      ${isToday ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-gray-200 dark:border-gray-700"}
                      ${isSelected ? "ring-2 ring-primary-500" : ""}
                    `}
                  >
                    <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                      <div className={`text-lg font-bold ${isToday ? "text-primary-700 dark:text-primary-400" : "text-gray-900 dark:text-white"}`}>
                        {date.toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                      {dayEvents.length > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    {dayEvents.length === 0 ? (
                      <div className="text-center text-gray-400 dark:text-gray-500 py-4 text-sm">
                        No events
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dayEvents.map((event, idx) => {
                          const displayName = event.name || `${event.reptile_name}: ${event.schedule_type}`;
                          const link = getEventLink(event);
                          const { Icon: TypeIcon, color: typeColor } = getScheduleTypeIcon(event.schedule_type);

                          const EventContent = (
                            <div className={`px-3 py-2 rounded-lg ${getScheduleTypeColor(event.schedule_type, event.is_actual || event.is_completed)} cursor-pointer hover:opacity-80 transition-opacity`}>
                              <div className="flex items-center gap-2 mb-1">
                                {(event.is_actual || event.is_completed) && (
                                  <span className="text-green-600 dark:text-green-400 font-bold text-sm">✓</span>
                                )}
                                <div className="font-semibold text-sm truncate flex-1">{displayName}</div>
                              </div>

                              <div className="text-xs space-y-1">
                                {event.food_category && (
                                  <div className="text-xs opacity-90">Food: {event.food_category}</div>
                                )}
                                {event.supplement && (
                                  <div className="text-xs font-medium text-green-700 dark:text-green-400">Supplement: {event.supplement.name}</div>
                                )}
                                {event.time_window_enabled && event.earliest_time && event.latest_time && (
                                  <div className="flex items-center gap-1 opacity-90">
                                    <Clock size={10} />
                                    {formatTime(new Date(`2000-01-01T${event.earliest_time}`))} - {formatTime(new Date(`2000-01-01T${event.latest_time}`))}
                                    {event.notifications_enabled && <Bell size={10} className="text-blue-500 dark:text-blue-400" />}
                                  </div>
                                )}
                                {event.time_slot && !event.time_window_enabled && (
                                  <div className="flex items-center gap-1 opacity-90">
                                    <span>Time: {event.time_slot}</span>
                                    {event.notifications_enabled && <Bell size={10} className="text-blue-500 dark:text-blue-400" />}
                                  </div>
                                )}
                                {!event.time_window_enabled && !event.time_slot && event.notifications_enabled && (
                                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                    <Bell size={10} />
                                    <span>Notifications on</span>
                                  </div>
                                )}
                                {(event.completed_time || event.time) && (
                                  <div className="text-green-600 dark:text-green-400 font-medium">
                                    Done: {event.completed_time || event.time}
                                  </div>
                                )}
                                {event.suggested_supplements && event.suggested_supplements.length > 0 && (
                                  <div className="flex gap-1 flex-wrap mt-1">
                                    {event.suggested_supplements.map((supp, suppIdx) => (
                                      <span key={suppIdx} className="text-xs px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-200">
                                        +{supp.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {event.notes && (
                                  <div className="text-xs opacity-75 mt-1 italic">{event.notes}</div>
                                )}
                              </div>
                            </div>
                          );

                          return link ? (
                            <Link key={idx} to={link}>
                              {EventContent}
                            </Link>
                          ) : (
                            <div key={idx}>{EventContent}</div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Day View - Enhanced with maximum details */}
        {view === "day" && (
          <div className="space-y-3">
            {getEventsForDate(currentDate).length > 0 ? (
              <div className="space-y-3">
                {getEventsForDate(currentDate).map((event, idx) => {
                  const link = getEventLink(event);
                  const { Icon: TypeIcon, color: typeColor } = getScheduleTypeIcon(event.schedule_type);

                  const EventContent = (
                    <div
                      className={`p-5 rounded-lg border-2 ${
                        event.is_actual || event.is_completed
                          ? "border-green-500 dark:border-green-600 bg-white dark:bg-gray-800"
                          : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                      } hover:shadow-md transition-all ${link ? 'cursor-pointer' : ''}`}
                    >
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${getIconColorClasses(typeColor)}`}>
                          <TypeIcon size={24} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {(event.is_actual || event.is_completed) && (
                              <span className="text-green-600 dark:text-green-400 font-bold text-lg">✓</span>
                            )}
                            <div className="font-bold text-lg text-gray-900 dark:text-white">
                              {event.name || event.reptile_name}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                            {event.schedule_type}
                            {event.is_actual || event.is_completed ? " (Completed)" : " (Scheduled)"}
                          </div>
                        </div>
                        <span className={`px-3 py-1.5 text-xs rounded-full font-medium ${getScheduleTypeColor(event.schedule_type, event.is_actual || event.is_completed)}`}>
                          {event.schedule_type}
                        </span>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                        {event.reptile_name && event.name && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Reptile</div>
                            <div className="text-sm text-gray-900 dark:text-white font-medium">{event.reptile_name}</div>
                          </div>
                        )}

                        {event.food_category && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Food Category</div>
                            <div className="text-sm text-gray-900 dark:text-white capitalize">{event.food_category}</div>
                          </div>
                        )}

                        {event.health_category && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Activity Type</div>
                            <div className="text-sm text-gray-900 dark:text-white capitalize">{event.health_category.replace('_', ' ')}</div>
                          </div>
                        )}

                        {event.time_window_enabled && event.earliest_time && event.latest_time && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                              <Clock size={12} />
                              Time Window
                              {event.notifications_enabled && <Bell size={10} className="text-blue-500 dark:text-blue-400" />}
                            </div>
                            <div className="text-sm text-gray-900 dark:text-white font-medium">
                              {formatTime(new Date(`2000-01-01T${event.earliest_time}`))} - {formatTime(new Date(`2000-01-01T${event.latest_time}`))}
                            </div>
                          </div>
                        )}

                        {event.time_slot && !event.time_window_enabled && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                              Time Slot
                              {event.notifications_enabled && <Bell size={10} className="text-blue-500 dark:text-blue-400" />}
                            </div>
                            <div className="text-sm text-gray-900 dark:text-white">{event.time_slot}</div>
                          </div>
                        )}

                        {!event.time_window_enabled && !event.time_slot && event.notifications_enabled && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                              <Bell size={12} className="text-blue-500 dark:text-blue-400" />
                              Notifications
                            </div>
                            <div className="text-sm text-blue-600 dark:text-blue-400">Enabled</div>
                          </div>
                        )}

                        {(event.completed_time || event.time) && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Completed At</div>
                            <div className="text-sm text-green-600 dark:text-green-400 font-bold">
                              {event.completed_time || event.time}
                            </div>
                          </div>
                        )}

                        {event.schedule_rule && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Frequency</div>
                            <div className="text-sm text-gray-900 dark:text-white capitalize">{event.schedule_rule.replace(/_/g, ' ')}</div>
                          </div>
                        )}
                      </div>

                      {/* Supplement (for supplement schedules) */}
                      {event.supplement && (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Supplement</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {event.supplement.name}
                          </div>
                        </div>
                      )}

                      {/* Suggested Supplements (for feeding schedules) */}
                      {event.suggested_supplements && event.suggested_supplements.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Suggested Supplements</div>
                          <div className="flex gap-2 flex-wrap">
                            {event.suggested_supplements.map((supp, suppIdx) => (
                              <span key={suppIdx} className="px-3 py-1.5 text-sm rounded-lg font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                + {supp.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Foods (if available from actual feeding) */}
                      {event.foods && event.foods.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Foods Given</div>
                          <div className="flex gap-2 flex-wrap">
                            {event.foods.map((food, foodIdx) => (
                              <span key={foodIdx} className="px-3 py-1 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                {food.name} {food.quantity && `(${food.quantity})`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {event.notes && (
                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Notes</div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            {event.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  );

                  return link ? (
                    <Link key={idx} to={link} className="block">
                      {EventContent}
                    </Link>
                  ) : (
                    <div key={idx}>{EventContent}</div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-16">
                No events for this day
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

export default Calendar;
