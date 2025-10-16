import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, List, Edit, Trash2, ChevronDown, ChevronUp, Clock, Utensils, Droplets, Scale } from "lucide-react";
import { formatTime, getDayNames, getUserFirstDayOfWeek } from "../utils/dateFormatting";

function Calendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month"); // "month", "week", "day"
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

  useEffect(() => {
    fetchReptiles();
    // Load filter state from localStorage
    const savedFilters = localStorage.getItem('calendar_reptile_filters');
    if (savedFilters) {
      setVisibleReptiles(new Set(JSON.parse(savedFilters)));
    }
  }, []);

  useEffect(() => {
    if (reptiles.length > 0) {
      fetchSchedules();
      fetchPastData();
    }
  }, [reptiles, currentDate]);

  const fetchReptiles = async () => {
    try {
      const response = await axios.get("/api/reptiles");
      setReptiles(response.data);

      // Initialize all reptiles as visible if no saved filters
      const savedFilters = localStorage.getItem('calendar_reptile_filters');
      if (!savedFilters) {
        setVisibleReptiles(new Set(response.data.map(r => r.id)));
      }
    } catch (error) {
      console.error("Error fetching reptiles:", error);
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const allSchedules = [];
      const allRotations = [];
      for (const reptile of reptiles) {
        const response = await axios.get(`/api/schedules/reptile/${reptile.id}`);
        allSchedules.push(...response.data.map(s => ({ ...s, reptile_name: reptile.name })));

        // Fetch feeding rotations for this reptile
        try {
          const rotationsResponse = await axios.get(`/api/feeding-rotations/reptile/${reptile.id}`);
          allRotations.push(...rotationsResponse.data.map(r => ({ ...r, reptile_name: reptile.name })));
        } catch (rotError) {
          console.error(`Error fetching rotations for ${reptile.name}:`, rotError);
        }
      }
      setSchedules(allSchedules);
      setFeedingRotations(allRotations);
      calculateEvents(allSchedules, allRotations);
    } catch (error) {
      console.error("Error fetching schedules:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPastData = async () => {
    try {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const allFeedings = [];
      const allMistings = [];

      for (const reptile of reptiles) {
        // Fetch feedings for the current month using query parameters
        const feedingResponse = await axios.get(`/api/feedings`, {
          params: {
            reptile_id: reptile.id,
            start_date: monthStart.toISOString(),
            end_date: monthEnd.toISOString(),
            limit: 1000
          }
        });
        const monthFeedings = feedingResponse.data.map(f => ({
          ...f,
          reptile_name: reptile.name,
          type: "feeding"
        }));
        allFeedings.push(...monthFeedings);

        // Fetch mistings for the current month
        const mistingResponse = await axios.get(`/api/misting/reptile/${reptile.id}`);
        const monthMistings = mistingResponse.data.filter(m => {
          const mistDate = new Date(m.misted_at);
          return mistDate >= monthStart && mistDate <= monthEnd;
        }).map(m => ({ ...m, reptile_name: reptile.name, type: "misting" }));
        allMistings.push(...monthMistings);
      }

      setFeedings(allFeedings);
      setMistings(allMistings);
    } catch (error) {
      console.error("Error fetching past data:", error);
    }
  };

  const calculateEvents = (scheduleList, rotationsList = []) => {
    // Calculate events for the current month view
    const calculatedEvents = [];
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    // Group rotations by reptile for easy lookup
    const rotationsByReptile = {};
    rotationsList.forEach(rotation => {
      if (!rotationsByReptile[rotation.reptile_id]) {
        rotationsByReptile[rotation.reptile_id] = [];
      }
      rotationsByReptile[rotation.reptile_id].push(rotation);
    });

    // Helper function to find applicable supplements for a feeding event
    // NOTE: This is a simplified client-side calculation for display purposes
    // The actual rotation calculation happens server-side when logging feedings
    const getSuggestedSupplements = (reptileId, foodCategory, eventIndex, eventDate) => {
      const rotations = rotationsByReptile[reptileId] || [];

      // Filter rotations that apply to this food category
      const applicable = rotations.filter(r => {
        if (r.rotation_type !== 'supplement') return false;
        if (!r.applies_to_category || r.applies_to_category === 'all') return true;
        return r.applies_to_category === foodCategory;
      });

      // Sort by priority
      applicable.sort((a, b) => a.priority - b.priority);

      // Find ALL rotations that trigger on this event (not just the first one)
      const triggeredSupplements = [];
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
          triggeredSupplements.push(rotation.supplement);
        }
      }
      return triggeredSupplements;
    };

    // Helper to create event object with supplement suggestion
    let eventIndexCounter = 0;
    const createEvent = (schedule, date) => {
      const event = {
        date: new Date(date),
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

      return event;
    };

    // First pass: Calculate base schedules (non-dependent)
    const baseSchedules = scheduleList.filter(s => s.schedule_rule !== "dependent");
    const dependentSchedules = scheduleList.filter(s => s.schedule_rule === "dependent");

    baseSchedules.forEach(schedule => {
      if (!schedule.enabled) return;

      // Calculate events based on schedule_rule
      if (schedule.schedule_rule === "every_x_days") {
        // Start from beginning of month and iterate by frequency_days
        const frequency = schedule.frequency_days;
        let currentDay = new Date(monthStart);

        // Use schedule created_at as reference point (simplified version)
        // In a real app, you'd want to track the last actual occurrence
        while (currentDay <= monthEnd) {
          calculatedEvents.push(createEvent(schedule, currentDay));
          currentDay.setDate(currentDay.getDate() + frequency);
        }
      } else if (schedule.schedule_rule === "days_of_week") {
        const days = schedule.days_of_week.split(",").map(d => parseInt(d));
        let currentDay = new Date(monthStart);

        while (currentDay <= monthEnd) {
          if (days.includes(currentDay.getDay())) {
            calculatedEvents.push(createEvent(schedule, currentDay));
          }
          currentDay.setDate(currentDay.getDate() + 1);
        }
      } else if (schedule.schedule_rule === "monthly") {
        const day = schedule.day_of_month;
        const eventDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        if (eventDate >= monthStart && eventDate <= monthEnd) {
          calculatedEvents.push(createEvent(schedule, eventDate));
        }
      }
    });

    // Second pass: Calculate dependent schedules based on parent occurrences
    dependentSchedules.forEach(schedule => {
      if (!schedule.enabled) return;

      // Find parent schedule events
      const parentEvents = calculatedEvents.filter(e => e.schedule_id === schedule.parent_schedule_id);

      if (schedule.dependent_rule === "every_occurrence") {
        // Add event for every parent occurrence
        parentEvents.forEach(parentEvent => {
          const event = createEvent(schedule, parentEvent.date);
          event.parent_schedule_id = schedule.parent_schedule_id;
          calculatedEvents.push(event);
        });
      } else if (schedule.dependent_rule === "every_nth") {
        // Add event for every Nth parent occurrence
        const frequency = schedule.dependent_frequency;
        parentEvents.forEach((parentEvent, index) => {
          if ((index + 1) % frequency === 0) {
            const event = createEvent(schedule, parentEvent.date);
            event.parent_schedule_id = schedule.parent_schedule_id;
            calculatedEvents.push(event);
          }
        });
      } else if (schedule.dependent_rule === "specific_days") {
        // Add event only when parent occurrence falls on specific days
        const days = schedule.dependent_days.split(",").map(d => parseInt(d));
        parentEvents.forEach(parentEvent => {
          if (days.includes(parentEvent.date.getDay())) {
            const event = createEvent(schedule, parentEvent.date);
            event.parent_schedule_id = schedule.parent_schedule_id;
            calculatedEvents.push(event);
          }
        });
      } else if (schedule.dependent_rule === "once_per_day") {
        // Add event only for the first parent occurrence each day
        const eventsByDate = new Map();

        parentEvents.forEach(parentEvent => {
          const dateKey = parentEvent.date.toDateString();
          // Only add if we haven't already added an event for this date
          if (!eventsByDate.has(dateKey)) {
            eventsByDate.set(dateKey, true);
            const event = createEvent(schedule, parentEvent.date);
            event.parent_schedule_id = schedule.parent_schedule_id;
            calculatedEvents.push(event);
          }
        });
      }
    });

    setEvents(calculatedEvents);
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

  const getHoursInDay = () => {
    const hours = [];
    for (let i = 0; i < 24; i++) {
      hours.push(i);
    }
    return hours;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];

    // Get scheduled events for this date
    const scheduledEvents = events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString() && visibleReptiles.has(event.reptile_id);
    }).map(e => ({
      ...e,
      is_actual: false, // This is a schedule, not an actual feeding
    }));

    // Get actual completed feedings for this date
    const actualFeedings = feedings.filter(feeding => {
      const feedDate = new Date(feeding.fed_at);
      return feedDate.toDateString() === date.toDateString() && visibleReptiles.has(feeding.reptile_id);
    }).map(f => ({
      ...f,
      schedule_type: "feeding",
      reptile_name: f.reptile_name,
      notes: f.notes,
      is_actual: true, // This is an actual feeding that happened
      time: formatTime(new Date(f.fed_at)),
    }));

    // Get actual completed mistings for this date
    const actualMistings = mistings.filter(misting => {
      const mistDate = new Date(misting.misted_at);
      return mistDate.toDateString() === date.toDateString() && visibleReptiles.has(misting.reptile_id);
    }).map(m => ({
      ...m,
      schedule_type: "misting",
      reptile_name: m.reptile_name,
      notes: m.notes,
      is_actual: true, // This is an actual misting that happened
      time: formatTime(new Date(m.misted_at)),
    }));

    // Match actual events to their corresponding schedules
    const matchedScheduleIds = new Set();

    // Helper function to normalize food category (Food model uses singular, schedules use plural)
    const normalizeFoodCategory = (category) => {
      if (!category) return null;
      const normalizeMap = {
        'insect': 'insects',
        'insects': 'insects',
        'worms': 'worms',
        'salad': 'salad',
        'vegetable': 'salad',
        'fruit': 'salad',
        'prepared': 'prepared',
        'mixed': 'mixed'
      };
      return normalizeMap[category.toLowerCase()] || category;
    };

    // For each actual feeding/misting, find matching schedule and mark it as completed
    actualFeedings.forEach(actual => {
      // Determine the food category from the feeding
      // Feedings have is_salad flag or foods array with categories
      let actualFoodCategory = null;

      if (actual.is_salad) {
        actualFoodCategory = "salad";
      } else if (actual.foods && actual.foods.length > 0) {
        // Use the category of the first food item and normalize it
        actualFoodCategory = normalizeFoodCategory(actual.foods[0].category);
      }

      const matchingSchedule = scheduledEvents.find(scheduled =>
        scheduled.reptile_id === actual.reptile_id &&
        scheduled.schedule_type === "feeding" &&
        scheduled.food_category === actualFoodCategory &&
        !matchedScheduleIds.has(scheduled.schedule_id)
      );

      if (matchingSchedule) {
        matchingSchedule.is_completed = true;
        matchingSchedule.completed_at = actual.fed_at;
        matchingSchedule.completed_time = actual.time;
        matchingSchedule.completion_id = actual.id;
        matchedScheduleIds.add(matchingSchedule.schedule_id);
      }
    });

    actualMistings.forEach(actual => {
      const matchingSchedule = scheduledEvents.find(scheduled =>
        scheduled.reptile_id === actual.reptile_id &&
        scheduled.schedule_type === "misting" &&
        !matchedScheduleIds.has(scheduled.schedule_id)
      );

      if (matchingSchedule) {
        matchingSchedule.is_completed = true;
        matchingSchedule.completed_at = actual.misted_at;
        matchingSchedule.completed_time = actual.time;
        matchingSchedule.completion_id = actual.id;
        matchedScheduleIds.add(matchingSchedule.schedule_id);
      }
    });

    // Only include actual events that didn't match any schedule (manual entries)
    const unmatchedActualFeedings = actualFeedings.filter(actual => {
      // Determine the food category from the feeding
      let actualFoodCategory = null;
      if (actual.is_salad) {
        actualFoodCategory = "salad";
      } else if (actual.foods && actual.foods.length > 0) {
        actualFoodCategory = normalizeFoodCategory(actual.foods[0].category);
      }

      const hasMatchingSchedule = scheduledEvents.some(scheduled =>
        scheduled.reptile_id === actual.reptile_id &&
        scheduled.schedule_type === "feeding" &&
        scheduled.food_category === actualFoodCategory
      );
      return !hasMatchingSchedule;
    });

    const unmatchedActualMistings = actualMistings.filter(actual => {
      const hasMatchingSchedule = scheduledEvents.some(scheduled =>
        scheduled.reptile_id === actual.reptile_id &&
        scheduled.schedule_type === "misting"
      );
      return !hasMatchingSchedule;
    });

    // Combine: scheduled events (some now marked completed) + unmatched actual events
    return [...scheduledEvents, ...unmatchedActualFeedings, ...unmatchedActualMistings];
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
    setTimeout(() => calculateEvents(schedules, feedingRotations), 0);
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const navigateDay = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  const navigateView = (direction) => {
    if (view === "month") {
      navigateMonth(direction);
    } else if (view === "week") {
      navigateWeek(direction);
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
    } else {
      return currentDate.toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }
  };

  const getEventLink = (event) => {
    // For completed scheduled events, link to the completion view
    if (event.is_completed && event.completion_id) {
      if (event.schedule_type === "feeding") {
        return `/feed/${event.completion_id}`;
      } else if (event.schedule_type === "misting") {
        return `/misting/${event.completion_id}`;
      }
    }

    // For actual completed events (unmatched), link to the read-only view
    if (event.is_actual) {
      if (event.type === "feeding" || event.schedule_type === "feeding") {
        return `/feed/${event.id}`;
      } else if (event.type === "misting" || event.schedule_type === "misting") {
        return `/misting/${event.id}`;
      }
      return null;
    }

    // For uncompleted scheduled events, link to the schedule edit page
    if (event.schedule_id) {
      return `/schedule-edit/${event.schedule_id}`;
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

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm("Are you sure you want to delete this schedule?")) {
      return;
    }

    try {
      await axios.delete(`/api/schedules/${scheduleId}`);
      // Refresh schedules and recalculate events
      await fetchSchedules();
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
          return "bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-400 border border-primary-200 dark:border-primary-800";
        case "misting":
          return "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800";
        case "weighing":
          return "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200 dark:border-purple-800";
        case "supplement":
          return "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400 border border-green-200 dark:border-green-800";
        default:
          return "bg-gray-50 text-gray-700 dark:bg-gray-900/50 dark:text-gray-400 border border-gray-200 dark:border-gray-700";
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Calendar</h1>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Reptile Filters */}
          {reptiles.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                {reptiles.map(reptile => (
                  <button
                    key={reptile.id}
                    onClick={() => toggleReptileFilter(reptile.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      visibleReptiles.has(reptile.id)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {reptile.name}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="hidden sm:block h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
            </>
          )}

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
              {schedules.map(schedule => (
                <div
                  key={schedule.id}
                  className="flex items-start justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {schedule.reptile_name}
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
                      {formatScheduleRule(schedule)}
                      {schedule.name && <span className="ml-2">• {schedule.name}</span>}
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

                      {schedule.time_window_enabled && schedule.earliest_time && schedule.latest_time && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
                          <Clock size={12} />
                          <span className="font-medium">Window:</span>
                          <span>
                            {formatTime(new Date(`2000-01-01T${schedule.earliest_time}`))} - {formatTime(new Date(`2000-01-01T${schedule.latest_time}`))}
                          </span>
                        </div>
                      )}
                    </div>

                    {schedule.notes && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        {schedule.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => navigate(`/schedule-edit/${schedule.id}`)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Edit schedule"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(schedule.id)}
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
                          {event.suggested_supplements && event.suggested_supplements.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap">
                              {event.suggested_supplements.map((supp, suppIdx) => (
                                <span key={suppIdx} className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700">
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
              <div className="px-2 py-0.5 rounded bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-400 border border-primary-200 dark:border-primary-800">
                Feed
              </div>
              <div className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                Mist
              </div>
              <div className="px-2 py-0.5 rounded bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400 border border-green-200 dark:border-green-800">
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

                            return (
                              <div
                                key={idx}
                                className={`text-xs px-2 py-1 rounded truncate ${getScheduleTypeColor(event.schedule_type, event.is_actual)}`}
                                title={`${displayName}${detail}${supplementText ? ` + ${supplementText}` : ''}`}
                              >
                                {event.is_actual && "✓ "}
                                {displayName}
                                {detail && <span className="opacity-75">{detail}</span>}
                                {supplements.length > 0 && (
                                  <span className="ml-1 text-green-600 dark:text-green-400 font-medium">
                                    +{supplements.map(s => s.name).join(' +')}
                                  </span>
                                )}
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
                                const tooltipText = `${event.is_actual ? '✓ ' : ''}${displayName}${detail}${supplementText ? ` + ${supplementText}` : ''}`;

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
                              const tooltipText = `${event.is_actual ? '✓ ' : ''}${displayName}${detail}${supplementText ? ` + ${supplementText}` : ''}`;

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
                            <div className="text-xs opacity-75 truncate capitalize">{event.schedule_type}</div>
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

        {/* Day View */}
        {view === "day" && (
          <div className="space-y-2">
            {getEventsForDate(currentDate).length > 0 ? (
              <div className="space-y-2">
                {getEventsForDate(currentDate).map((event, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border ${
                      event.is_actual
                        ? "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {event.is_actual && (
                            <span className="text-green-600 dark:text-green-400">✓</span>
                          )}
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {event.name || event.reptile_name}
                          </div>
                          {event.is_actual && event.time && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {event.time}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                          {event.is_actual ? "Completed: " : "Scheduled: "}
                          {event.schedule_type}
                          {event.food_category && ` • ${event.food_category}`}
                          {event.time_slot && ` • ${event.time_slot}`}
                        </div>
                        {!event.name && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {event.reptile_name}
                          </div>
                        )}
                        {event.notes && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            {event.notes}
                          </div>
                        )}
                      </div>
                      <span className={`px-3 py-1 text-xs rounded-full ${getScheduleTypeColor(event.schedule_type, event.is_actual)}`}>
                        {event.schedule_type}
                      </span>
                    </div>
                  </div>
                ))}
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
