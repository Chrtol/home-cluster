import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react";

function Calendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month"); // "month", "week", "day"
  const [reptiles, setReptiles] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [events, setEvents] = useState([]); // Calculated events based on schedules
  const [feedings, setFeedings] = useState([]); // Past feedings
  const [mistings, setMistings] = useState([]); // Past mistings
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    fetchReptiles();
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
    } catch (error) {
      console.error("Error fetching reptiles:", error);
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const allSchedules = [];
      for (const reptile of reptiles) {
        const response = await axios.get(`/api/schedules/reptile/${reptile.id}`);
        allSchedules.push(...response.data.map(s => ({ ...s, reptile_name: reptile.name })));
      }
      setSchedules(allSchedules);
      calculateEvents(allSchedules);
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

  const calculateEvents = (scheduleList) => {
    // Calculate events for the current month view
    const calculatedEvents = [];
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

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
          calculatedEvents.push({
            date: new Date(currentDay),
            schedule_id: schedule.id,
            schedule_type: schedule.schedule_type,
            reptile_name: schedule.reptile_name,
            reptile_id: schedule.reptile_id,
            notes: schedule.notes,
          });
          currentDay.setDate(currentDay.getDate() + frequency);
        }
      } else if (schedule.schedule_rule === "days_of_week") {
        const days = schedule.days_of_week.split(",").map(d => parseInt(d));
        let currentDay = new Date(monthStart);

        while (currentDay <= monthEnd) {
          if (days.includes(currentDay.getDay())) {
            calculatedEvents.push({
              date: new Date(currentDay),
              schedule_id: schedule.id,
              schedule_type: schedule.schedule_type,
              reptile_name: schedule.reptile_name,
              reptile_id: schedule.reptile_id,
              notes: schedule.notes,
            });
          }
          currentDay.setDate(currentDay.getDate() + 1);
        }
      } else if (schedule.schedule_rule === "monthly") {
        const day = schedule.day_of_month;
        const eventDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        if (eventDate >= monthStart && eventDate <= monthEnd) {
          calculatedEvents.push({
            date: eventDate,
            schedule_id: schedule.id,
            schedule_type: schedule.schedule_type,
            reptile_name: schedule.reptile_name,
            reptile_id: schedule.reptile_id,
            notes: schedule.notes,
          });
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
          calculatedEvents.push({
            date: new Date(parentEvent.date),
            schedule_id: schedule.id,
            schedule_type: schedule.schedule_type,
            reptile_name: schedule.reptile_name,
            reptile_id: schedule.reptile_id,
            notes: schedule.notes,
            parent_schedule_id: schedule.parent_schedule_id,
          });
        });
      } else if (schedule.dependent_rule === "every_nth") {
        // Add event for every Nth parent occurrence
        const frequency = schedule.dependent_frequency;
        parentEvents.forEach((parentEvent, index) => {
          if ((index + 1) % frequency === 0) {
            calculatedEvents.push({
              date: new Date(parentEvent.date),
              schedule_id: schedule.id,
              schedule_type: schedule.schedule_type,
              reptile_name: schedule.reptile_name,
              reptile_id: schedule.reptile_id,
              notes: schedule.notes,
              parent_schedule_id: schedule.parent_schedule_id,
            });
          }
        });
      } else if (schedule.dependent_rule === "specific_days") {
        // Add event only when parent occurrence falls on specific days
        const days = schedule.dependent_days.split(",").map(d => parseInt(d));
        parentEvents.forEach(parentEvent => {
          if (days.includes(parentEvent.date.getDay())) {
            calculatedEvents.push({
              date: new Date(parentEvent.date),
              schedule_id: schedule.id,
              schedule_type: schedule.schedule_type,
              reptile_name: schedule.reptile_name,
              reptile_id: schedule.reptile_id,
              notes: schedule.notes,
              parent_schedule_id: schedule.parent_schedule_id,
            });
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
            calculatedEvents.push({
              date: new Date(parentEvent.date),
              schedule_id: schedule.id,
              schedule_type: schedule.schedule_type,
              reptile_name: schedule.reptile_name,
              reptile_id: schedule.reptile_id,
              notes: schedule.notes,
              parent_schedule_id: schedule.parent_schedule_id,
            });
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
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];

    // Get scheduled events for this date
    const scheduledEvents = events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    }).map(e => ({
      ...e,
      is_actual: false, // This is a schedule, not an actual feeding
    }));

    // Get actual completed feedings for this date
    const actualFeedings = feedings.filter(feeding => {
      const feedDate = new Date(feeding.fed_at);
      return feedDate.toDateString() === date.toDateString();
    }).map(f => ({
      ...f,
      schedule_type: "feeding",
      reptile_name: f.reptile_name,
      notes: f.notes,
      is_actual: true, // This is an actual feeding that happened
      time: new Date(f.fed_at).toLocaleTimeString("default", { hour: "2-digit", minute: "2-digit" }),
    }));

    // Get actual completed mistings for this date
    const actualMistings = mistings.filter(misting => {
      const mistDate = new Date(misting.misted_at);
      return mistDate.toDateString() === date.toDateString();
    }).map(m => ({
      ...m,
      schedule_type: "misting",
      reptile_name: m.reptile_name,
      notes: m.notes,
      is_actual: true, // This is an actual misting that happened
      time: new Date(m.misted_at).toLocaleTimeString("default", { hour: "2-digit", minute: "2-digit" }),
    }));

    // Combine all events and sort: actual events first, then scheduled
    return [...actualFeedings, ...actualMistings, ...scheduledEvents].sort((a, b) => {
      // Sort actual events before scheduled events
      if (a.is_actual && !b.is_actual) return -1;
      if (!a.is_actual && b.is_actual) return 1;
      return 0;
    });
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
    setTimeout(() => calculateEvents(schedules), 0);
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
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

  const days = getDaysInMonth();
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

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

        <div className="flex gap-2">
          <button
            onClick={() => navigate("/schedule-create")}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={20} />
            <span>Add Schedule</span>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="card mb-4 p-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-medium text-gray-600 dark:text-gray-400">Legend:</span>

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

      {/* Calendar Controls */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft size={24} />
          </button>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {monthName}
          </h2>

          <button
            onClick={() => navigateMonth(1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
            <div key={day} className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((date, index) => {
            const dayEvents = date ? getEventsForDate(date) : [];
            const isToday = date && date.toDateString() === new Date().toDateString();
            const isSelected = selectedDate && date && date.toDateString() === selectedDate.toDateString();

            return (
              <div
                key={index}
                onClick={() => date && handleDateClick(date)}
                className={`
                  min-h-24 p-2 rounded-lg border transition-all
                  ${!date ? "bg-gray-50 dark:bg-gray-800/50" : "cursor-pointer hover:border-primary-300 dark:hover:border-primary-600"}
                  ${isToday ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-gray-200 dark:border-gray-700"}
                  ${isSelected ? "ring-2 ring-primary-500" : ""}
                `}
              >
                {date && (
                  <>
                    <div className={`text-sm font-semibold mb-1 ${isToday ? "text-primary-700 dark:text-primary-400" : "text-gray-700 dark:text-gray-300"}`}>
                      {date.getDate()}
                    </div>

                    {/* Event indicators */}
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event, idx) => {
                        const displayName = event.name || `${event.reptile_name}: ${event.schedule_type}`;
                        const detail = event.food_category ? ` (${event.food_category})` : event.time_slot ? ` (${event.time_slot})` : '';

                        return (
                          <div
                            key={idx}
                            className={`text-xs px-2 py-1 rounded truncate ${getScheduleTypeColor(event.schedule_type, event.is_actual)}`}
                            title={`${displayName}${detail}`}
                          >
                            {event.is_actual && "✓ "}
                            {displayName}
                            {detail && <span className="opacity-75">{detail}</span>}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {selectedDate.toLocaleDateString("default", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </h3>

          <div className="space-y-2">
            {getEventsForDate(selectedDate).length > 0 ? (
              getEventsForDate(selectedDate).map((event, idx) => (
                <div
                  key={idx}
                  className={`flex items-start justify-between p-3 rounded-lg border ${
                    event.is_actual
                      ? "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {event.is_actual && (
                        <span className="text-green-600 dark:text-green-400">✓</span>
                      )}
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {event.name || event.reptile_name}
                      </div>
                      {event.is_actual && event.time && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {event.time}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 capitalize mt-1">
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
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {event.notes}
                      </div>
                    )}
                  </div>
                  <span className={`px-3 py-1 text-xs rounded-full ${getScheduleTypeColor(event.schedule_type, event.is_actual)}`}>
                    {event.schedule_type}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                No events for this day
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Calendar;
