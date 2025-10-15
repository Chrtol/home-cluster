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
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    fetchReptiles();
  }, []);

  useEffect(() => {
    if (reptiles.length > 0) {
      fetchSchedules();
    }
  }, [reptiles]);

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
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
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

  const getScheduleTypeColor = (type) => {
    switch (type) {
      case "feeding":
        return "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400";
      case "misting":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "weighing":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "supplement":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
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
                      {dayEvents.slice(0, 3).map((event, idx) => (
                        <div
                          key={idx}
                          className={`text-xs px-2 py-1 rounded truncate ${getScheduleTypeColor(event.schedule_type)}`}
                        >
                          {event.reptile_name}: {event.schedule_type}
                        </div>
                      ))}
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
                  className="flex items-start justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {event.reptile_name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {event.schedule_type}
                    </div>
                    {event.notes && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {event.notes}
                      </div>
                    )}
                  </div>
                  <span className={`px-3 py-1 text-xs rounded-full ${getScheduleTypeColor(event.schedule_type)}`}>
                    {event.schedule_type}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                No scheduled events for this day
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Calendar;
