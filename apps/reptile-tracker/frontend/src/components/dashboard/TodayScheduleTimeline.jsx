import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { formatTime, toLocalISODate } from '../../utils/dateFormatting';
import { CheckCircle, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import ReptileAvatar from '../ReptileAvatar';

/**
 * TodayScheduleTimeline - Timeline widget showing today's scheduled tasks
 *
 * Groups tasks by time slot (morning/afternoon/evening/night).
 * Auto-scrolls to current time slot on mount.
 * Supports filtering by task type with localStorage persistence.
 * Completed tasks collapse into expandable section at top.
 * Inline quick-log form for task completion.
 *
 * Props:
 * - config: Widget configuration (filterTypes, autoScrollToCurrent, showCompletedSection)
 * - size: Widget size ('xs', 'small', 'medium', 'large')
 * - onQuickLog: Handler to open quick-log form (from Dashboard)
 */
const TodayScheduleTimeline = ({ config = {}, size = 'small', onQuickLog }) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [activeFilters, setActiveFilters] = useState([]);
  const [hoveredTask, setHoveredTask] = useState(null);
  const [hoverTimer, setHoverTimer] = useState(null);

  const currentSlotRef = useRef(null);

  const filterTypes = config.filterTypes || ['feeding', 'misting', 'health'];
  const autoScrollToCurrent = config.autoScrollToCurrent !== false;
  const showCompletedSection = config.showCompletedSection !== false;

  // Load filter state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('timeline_filters');
    if (stored) {
      try {
        setActiveFilters(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse timeline filters', e);
      }
    }
  }, []);

  // Save filter state to localStorage
  useEffect(() => {
    localStorage.setItem('timeline_filters', JSON.stringify(activeFilters));
  }, [activeFilters]);

  // Fetch today's schedule instances
  useEffect(() => {
    fetchSchedules();
  }, []);

  // Auto-scroll to current time slot
  useEffect(() => {
    if (!loading && autoScrollToCurrent && currentSlotRef.current) {
      requestAnimationFrame(() => {
        currentSlotRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      });
    }
  }, [loading, autoScrollToCurrent]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = toLocalISODate(new Date());

      // Use schedule-instances/calendar endpoint which returns instances with schedule details
      const response = await axios.get('/api/schedule-instances/calendar', {
        params: {
          start_date: today,
          end_date: today
        }
      });

      // Map instance data to expected schedule format
      const instances = response.data || [];
      const mapped = instances.map(instance => ({
        id: instance.id,
        schedule_id: instance.schedule_id,
        scheduled_date: instance.scheduled_date,
        // Use earliest_time from schedule for time display, fallback to scheduled_date
        scheduled_time: instance.schedule?.earliest_time || instance.scheduled_date,
        schedule_type: instance.schedule?.schedule_type,
        type: instance.schedule?.schedule_type,
        // Include reptile object for ReptileAvatar
        reptile: instance.schedule?.reptile ? {
          id: instance.schedule.reptile.id,
          name: instance.schedule.reptile.name,
          species: instance.schedule.reptile.species,
          avatar_photo_url: instance.schedule.reptile.avatar_photo_url
        } : null,
        reptile_name: instance.schedule?.reptile?.name,
        notes: instance.schedule?.notes,
        supplements: instance.supplements || instance.schedule?.supplements,
        status: instance.status,
        completed_at: instance.status === 'completed' ? instance.updated_at : null,
        last_logged: instance.completions?.[0]?.completed_at
      }));

      setSchedules(mapped);
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
      setError('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  // Time slot helper
  const getTimeSlot = (time) => {
    if (!time) return { id: 'morning', label: '07:00 - 11:59', order: 1 };

    let hour;

    // Handle time-only strings (HH:MM or HH:MM:SS)
    if (typeof time === 'string' && /^\d{2}:\d{2}/.test(time)) {
      hour = parseInt(time.substring(0, 2), 10);
    } else {
      // Handle full datetime strings
      const date = new Date(time);
      if (isNaN(date.getTime())) {
        // Fallback if parsing fails
        return { id: 'morning', label: '07:00 - 11:59', order: 1 };
      }
      hour = date.getHours();
    }

    if (hour < 7) return { id: 'night', label: '00:00 - 06:59', order: 0 };
    if (hour < 12) return { id: 'morning', label: '07:00 - 11:59', order: 1 };
    if (hour < 18) return { id: 'afternoon', label: '12:00 - 17:59', order: 2 };
    return { id: 'evening', label: '18:00 - 23:59', order: 3 };
  };

  const getCurrentTimeSlot = () => {
    return getTimeSlot(new Date());
  };

  // Filter schedules by active filters
  const filteredSchedules = schedules.filter(schedule => {
    if (activeFilters.length === 0) return true;
    const scheduleType = schedule.schedule_type || schedule.type;
    return activeFilters.includes(scheduleType);
  });

  // Group schedules by completion status
  const completedSchedules = filteredSchedules.filter(s => s.completed_at);
  const pendingSchedules = filteredSchedules.filter(s => !s.completed_at);

  // Group pending schedules by time slot
  const groupedBySlot = pendingSchedules.reduce((acc, schedule) => {
    const timeSlot = getTimeSlot(schedule.scheduled_time || schedule.scheduled_date);
    if (!acc[timeSlot.id]) {
      acc[timeSlot.id] = {
        slot: timeSlot,
        schedules: []
      };
    }
    acc[timeSlot.id].schedules.push(schedule);
    return acc;
  }, {});

  const sortedSlots = Object.values(groupedBySlot).sort((a, b) => a.slot.order - b.slot.order);

  const currentSlot = getCurrentTimeSlot();

  // Determine task status
  const getTaskStatus = (schedule) => {
    if (schedule.completed_at) return 'done';

    const scheduledTime = new Date(schedule.scheduled_time || schedule.scheduled_date);
    const now = new Date();

    // Overdue if scheduled time has passed
    if (scheduledTime < now) return 'overdue';

    // Due if within current time window (roughly same hour)
    const hoursDiff = (scheduledTime - now) / (1000 * 60 * 60);
    if (hoursDiff < 1) return 'due';

    return 'upcoming';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'done': return 'border-primary';
      case 'overdue': return 'border-destructive';
      case 'due': return 'border-amber-500';
      default: return 'border-border';
    }
  };

  const toggleFilter = (filterType) => {
    setActiveFilters(prev =>
      prev.includes(filterType)
        ? prev.filter(f => f !== filterType)
        : [...prev, filterType]
    );
  };

  const toggleGroupExpansion = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleMouseEnter = (schedule) => {
    const timer = setTimeout(() => {
      setHoveredTask(schedule);
    }, 150);
    setHoverTimer(timer);
  };

  const handleMouseLeave = () => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      setHoverTimer(null);
    }
    setHoveredTask(null);
  };

  const handleLogClick = (schedule) => {
    if (onQuickLog) {
      onQuickLog(schedule);
    }
  };

  // All done state
  const allDone = schedules.length > 0 && completedSchedules.length === schedules.length;

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading schedule...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl border border-border p-3">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Today</h2>
          <span className="text-xs text-muted-foreground">0 tasks</span>
        </div>
        <p className="text-sm text-muted-foreground">No scheduled tasks for today</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header with task count */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground">Today</h2>
          <span className="text-xs text-muted-foreground">{schedules.length} tasks</span>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterTypes.map(filterType => (
            <button
              key={filterType}
              onClick={() => toggleFilter(filterType)}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                activeFilters.includes(filterType)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* All done state */}
      {allDone && (
        <div className="p-4 text-center">
          <div className="inline-flex items-center gap-2 text-primary mb-2">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-semibold">All done for today!</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Great job taking care of your reptiles 🎉
          </p>
        </div>
      )}

      {/* Timeline content */}
      {!allDone && (
        <div className="max-h-96 overflow-y-auto">
          {/* Completed tasks section */}
          {showCompletedSection && completedSchedules.length > 0 && (
            <div className="border-b border-border">
              <button
                onClick={() => toggleGroupExpansion('completed')}
                className="w-full px-3 py-2 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <span>{completedSchedules.length} completed</span>
                {expandedGroups.has('completed') ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {expandedGroups.has('completed') && (
                <div className="px-2 pb-2 space-y-1">
                  {completedSchedules.map(schedule => {
                    const status = getTaskStatus(schedule);
                    const scheduleType = schedule.schedule_type || schedule.type;

                    return (
                      <div
                        key={schedule.id}
                        className={`pl-2 py-1 border-l-2 ${getStatusColor(status)} relative`}
                        onMouseEnter={() => handleMouseEnter(schedule)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {/* Scheduled time display - show raw time if it's HH:MM format */}
                        {schedule.scheduled_time && (
                          <div className="text-[10px] text-muted-foreground mb-0.5">
                            {typeof schedule.scheduled_time === 'string' && schedule.scheduled_time.match(/^\d{2}:\d{2}/)
                              ? schedule.scheduled_time.slice(0, 5)
                              : formatTime(schedule.scheduled_time)}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-xl overflow-hidden bg-gradient-to-br from-green-400 to-green-600 dark:from-green-600 dark:to-green-800 flex-shrink-0">
                            {schedule.reptile?.avatar_photo_url ? (
                              <img
                                src={schedule.reptile.avatar_photo_url}
                                alt={schedule.reptile.name}
                                className="w-full h-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-foreground truncate">
                              {schedule.reptile_name} - {scheduleType}
                            </div>
                          </div>
                          <span className="text-primary">✓</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Pending tasks by time slot */}
          <div className="space-y-2 p-2">
            {sortedSlots.map(({ slot, schedules: slotSchedules }) => {
              const isCurrentSlot = slot.id === currentSlot.id;

              return (
                <div
                  key={slot.id}
                  ref={isCurrentSlot ? currentSlotRef : null}
                  className={`${isCurrentSlot ? 'ring-1 ring-primary/30 rounded-lg p-2 -m-2' : ''}`}
                >
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                    {slot.label}
                    {isCurrentSlot && <span className="ml-1 text-primary">(now)</span>}
                  </div>

                  <div className="space-y-1">
                    {slotSchedules.map(schedule => {
                      const status = getTaskStatus(schedule);
                      const scheduleType = schedule.schedule_type || schedule.type;

                      return (
                        <div
                          key={schedule.id}
                          className={`pl-2 py-1 border-l-2 ${getStatusColor(status)} relative group`}
                          onMouseEnter={() => handleMouseEnter(schedule)}
                          onMouseLeave={handleMouseLeave}
                        >
                          {/* Scheduled time display - show raw time if it's HH:MM format */}
                          {schedule.scheduled_time && (
                            <div className="text-[10px] text-muted-foreground mb-0.5">
                              {typeof schedule.scheduled_time === 'string' && schedule.scheduled_time.match(/^\d{2}:\d{2}/)
                                ? schedule.scheduled_time.slice(0, 5)
                                : formatTime(schedule.scheduled_time)}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-xl overflow-hidden bg-gradient-to-br from-green-400 to-green-600 dark:from-green-600 dark:to-green-800 flex-shrink-0">
                              {schedule.reptile?.avatar_photo_url ? (
                                <img
                                  src={schedule.reptile.avatar_photo_url}
                                  alt={schedule.reptile.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : null}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-foreground truncate">
                                {schedule.reptile_name} - {scheduleType}
                              </div>
                            </div>
                            <button
                              onClick={() => handleLogClick(schedule)}
                              className="ml-auto text-xs px-1.5 py-0.5 rounded bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                              Log
                            </button>
                          </div>

                          {/* Hover tooltip */}
                          {hoveredTask?.id === schedule.id && (
                            <div className="absolute left-0 top-full mt-1 z-10 bg-popover border border-border rounded-lg p-2 shadow-lg text-xs w-64">
                              {schedule.notes && (
                                <div className="mb-1">
                                  <span className="text-muted-foreground">Notes:</span>{' '}
                                  <span className="text-foreground">{schedule.notes}</span>
                                </div>
                              )}
                              {schedule.supplements && schedule.supplements.length > 0 && (
                                <div className="mb-1">
                                  <span className="text-muted-foreground">Supplements:</span>{' '}
                                  <span className="text-foreground">{schedule.supplements.join(', ')}</span>
                                </div>
                              )}
                              {schedule.last_logged && (
                                <div>
                                  <span className="text-muted-foreground">Last logged:</span>{' '}
                                  <span className="text-foreground">{formatTime(schedule.last_logged)}</span>
                                </div>
                              )}
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
        </div>
      )}
    </div>
  );
};

export default TodayScheduleTimeline;
