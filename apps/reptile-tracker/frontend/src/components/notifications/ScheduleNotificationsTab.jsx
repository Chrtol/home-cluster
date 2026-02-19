import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Pencil, Trash2, ExternalLink, Bell, BellOff, Clock, AlertTriangle } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { TimePicker } from '@/components/ui/time-picker';
import { getUserTimeFormat } from '@/utils/dateFormatting';
import { add, format } from 'date-fns';

function FollowUpPreview({ reminderTime, followUpDelayMinutes, latestTime }) {
  if (!reminderTime || !followUpDelayMinutes) return null;

  // Parse reminder time (HH:MM)
  const [hours, minutes] = reminderTime.split(':').map(Number);
  const reminderDate = new Date();
  reminderDate.setHours(hours, minutes, 0, 0);

  // Calculate follow-up time
  const followUpDate = add(reminderDate, { minutes: parseInt(followUpDelayMinutes) });
  const followUpTime = format(followUpDate, 'HH:mm');

  // Check if past window close
  let warning = null;
  if (latestTime) {
    const [lh, lm] = latestTime.split(':').map(Number);
    const latestMinutes = lh * 60 + lm;
    const followUpMinutes = followUpDate.getHours() * 60 + followUpDate.getMinutes();

    if (followUpMinutes > latestMinutes) {
      warning = (
        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-200">
          Follow-up time is after window close. Alert will still be sent.
        </div>
      );
    }
  }

  return (
    <>
      <p className="text-sm text-muted-foreground mt-1">
        Follow-up will fire at {followUpTime}
      </p>
      {warning}
    </>
  );
}

function ScheduleNotificationsTab() {
  const navigate = useNavigate();
  const [reptiles, setReptiles] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedReptiles, setExpandedReptiles] = useState(new Set());
  const [savingScheduleId, setSavingScheduleId] = useState(null);
  const [expandedSchedule, setExpandedSchedule] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [deletingScheduleId, setDeletingScheduleId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // First fetch all reptiles
      const reptilesRes = await axios.get('/api/reptiles');
      const reptilesList = reptilesRes.data;
      setReptiles(reptilesList);

      // Then fetch schedules for each reptile in parallel
      const schedulePromises = reptilesList.map(reptile =>
        axios.get(`/api/schedules/reptile/${reptile.id}`)
          .then(res => res.data)
          .catch(() => [])
      );

      const schedulesByReptile = await Promise.all(schedulePromises);
      const allSchedules = schedulesByReptile.flat();
      setSchedules(allSchedules);

      // Expand first reptile by default
      if (reptilesList.length > 0) {
        const firstReptileWithSchedules = reptilesList.find(r =>
          allSchedules.some(s => s.reptile_id === r.id)
        );
        if (firstReptileWithSchedules) {
          setExpandedReptiles(new Set([firstReptileWithSchedules.id]));
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const toggleReptile = (reptileId) => {
    setExpandedReptiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reptileId)) {
        newSet.delete(reptileId);
      } else {
        newSet.add(reptileId);
      }
      return newSet;
    });
  };

  const toggleScheduleExpand = (scheduleId) => {
    if (expandedSchedule === scheduleId) {
      setExpandedSchedule(null);
      setEditingData({});
    } else {
      const schedule = schedules.find(s => s.id === scheduleId);
      setExpandedSchedule(scheduleId);
      setEditingData({
        notifications_enabled: schedule.notifications_enabled ?? true,
        reminder_time: schedule.reminder_time || '',
        follow_up_enabled: schedule.follow_up_enabled ?? false,
        follow_up_delay_minutes: schedule.follow_up_delay_minutes || 30,
      });
    }
  };

  const handleQuickToggle = async (schedule, e) => {
    e.stopPropagation();
    setSavingScheduleId(schedule.id);
    setError('');

    try {
      const res = await axios.patch(`/api/schedules/${schedule.id}`, {
        notifications_enabled: !schedule.notifications_enabled
      });
      setSchedules(schedules.map(s => s.id === schedule.id ? res.data : s));
      setSuccess(`Notifications ${res.data.notifications_enabled ? 'enabled' : 'disabled'} for ${schedule.name || 'schedule'}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to toggle notification:', err);
      setError(err.response?.data?.detail || 'Failed to update notification setting');
    } finally {
      setSavingScheduleId(null);
    }
  };

  const handleSaveSettings = async (scheduleId) => {
    setSavingScheduleId(scheduleId);
    setError('');

    try {
      const schedule = schedules.find(s => s.id === scheduleId);
      const updates = {
        notifications_enabled: editingData.notifications_enabled,
        reminder_time: editingData.reminder_time || null,
        follow_up_enabled: editingData.follow_up_enabled,
        follow_up_delay_minutes: editingData.follow_up_enabled ? parseInt(editingData.follow_up_delay_minutes) : null,
      };

      const res = await axios.patch(`/api/schedules/${scheduleId}`, updates);
      setSchedules(schedules.map(s => s.id === scheduleId ? res.data : s));
      setExpandedSchedule(null);
      setEditingData({});
      setSuccess(`Notification settings saved for ${schedule?.name || 'schedule'}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err.response?.data?.detail || 'Failed to save notification settings');
    } finally {
      setSavingScheduleId(null);
    }
  };

  const handleDelete = async (scheduleId, e) => {
    e.stopPropagation();
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!confirm(`Delete schedule "${schedule?.name || 'this schedule'}"? This cannot be undone.`)) {
      return;
    }

    setDeletingScheduleId(scheduleId);
    setError('');

    try {
      await axios.delete(`/api/schedules/${scheduleId}`);
      setSchedules(schedules.filter(s => s.id !== scheduleId));
      setSuccess(`Schedule "${schedule?.name || ''}" deleted`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      setError(err.response?.data?.detail || 'Failed to delete schedule');
    } finally {
      setDeletingScheduleId(null);
    }
  };

  const getFilteredSchedules = () => {
    let filtered = schedules;
    if (typeFilter !== 'all') {
      filtered = filtered.filter(s => s.schedule_type === typeFilter);
    }
    return filtered;
  };

  const groupSchedulesByReptile = () => {
    const filtered = getFilteredSchedules();
    const grouped = {};

    reptiles.forEach(reptile => {
      const reptileSchedules = filtered.filter(s => s.reptile_id === reptile.id);
      if (reptileSchedules.length > 0) {
        grouped[reptile.id] = {
          reptile,
          schedules: reptileSchedules
        };
      }
    });

    return grouped;
  };

  const getScheduleTypeEmoji = (type) => {
    const emojiMap = {
      'feeding': '🍽️',
      'misting': '💧',
      'health': '🏥',
      'supplement': '💊'
    };
    return emojiMap[type] || '📅';
  };

  const getScheduleTypeLabel = (type) => {
    const labelMap = {
      'feeding': 'Feeding',
      'misting': 'Misting',
      'health': 'Health',
      'supplement': 'Supplement'
    };
    return labelMap[type] || type;
  };

  const getScheduleFrequencyText = (schedule) => {
    if (schedule.schedule_mode === 'interval') {
      if (schedule.min_days_between === schedule.max_days_between) {
        return `Every ${schedule.min_days_between} days`;
      }
      return `Every ${schedule.min_days_between}-${schedule.max_days_between} days`;
    }
    if (schedule.schedule_rule === 'days_of_week' && schedule.days_of_week) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      // Handle both array and comma-separated string formats
      const daysArray = Array.isArray(schedule.days_of_week)
        ? schedule.days_of_week
        : (typeof schedule.days_of_week === 'string' && schedule.days_of_week.trim()
            ? schedule.days_of_week.split(',').map(Number).filter(n => !isNaN(n))
            : []);
      const activeDays = daysArray.map(d => days[d]).join(', ');
      return activeDays || 'Weekly';
    }
    if (schedule.schedule_rule === 'every_x_days' && schedule.frequency_days) {
      return `Every ${schedule.frequency_days} days`;
    }
    return schedule.schedule_mode || 'Custom';
  };

  const getTimeWindowText = (schedule) => {
    if (!schedule.time_window_enabled) return null;
    const userTimeFormat = getUserTimeFormat();
    const formatTime = (time) => {
      if (!time) return '';
      const [h, m] = time.split(':');
      const hour = parseInt(h);
      if (userTimeFormat === '24h') {
        return `${h}:${m}`;
      }
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${m} ${ampm}`;
    };
    if (schedule.earliest_time && schedule.latest_time) {
      return `${formatTime(schedule.earliest_time)} - ${formatTime(schedule.latest_time)}`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-muted-foreground">Loading schedules...</div>
      </div>
    );
  }

  const groupedSchedules = groupSchedulesByReptile();
  const hasSchedules = Object.keys(groupedSchedules).length > 0;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-200 text-sm">{success}</p>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-bold mb-4 text-foreground">Schedule Notifications</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Configure notifications for each schedule. Click a schedule to expand notification settings.
        </p>

        {/* Type Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            Filter by Schedule Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-field w-full max-w-xs"
          >
            <option value="all">All Types</option>
            <option value="feeding">Feedings</option>
            <option value="misting">Misting</option>
            <option value="health">Health</option>
            <option value="supplement">Supplements</option>
          </select>
        </div>

        {/* Grouped Schedules */}
        {!hasSchedules ? (
          <div className="text-center py-12 bg-card/50 rounded-lg border-2 border-dashed border-border">
            <p className="text-muted-foreground">
              {typeFilter === 'all'
                ? 'No schedules found. Create schedules to configure notifications.'
                : `No ${typeFilter} schedules found. Try a different filter.`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedSchedules).map(([reptileId, { reptile, schedules: reptileSchedules }]) => {
              const isExpanded = expandedReptiles.has(parseInt(reptileId));
              const enabledCount = reptileSchedules.filter(s => s.notifications_enabled).length;

              return (
                <Collapsible.Root
                  key={reptileId}
                  open={isExpanded}
                  onOpenChange={() => toggleReptile(parseInt(reptileId))}
                >
                  <div className="border border-border rounded-lg overflow-hidden">
                    {/* Reptile Header */}
                    <Collapsible.Trigger asChild>
                      <button className="w-full flex items-center justify-between p-4 bg-card hover:bg-secondary transition-colors">
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                          <div className="text-left">
                            <div className="font-semibold text-foreground">{reptile.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {reptileSchedules.length} {reptileSchedules.length === 1 ? 'schedule' : 'schedules'}
                              {enabledCount > 0 && ` • ${enabledCount} with notifications`}
                            </div>
                          </div>
                        </div>
                      </button>
                    </Collapsible.Trigger>

                    {/* Schedules List */}
                    <Collapsible.Content className="bg-card border-t border-border">
                      <div className="p-4 space-y-3">
                        {reptileSchedules.map((schedule) => {
                          const isScheduleExpanded = expandedSchedule === schedule.id;
                          const timeWindow = getTimeWindowText(schedule);

                          return (
                            <div
                              key={schedule.id}
                              className="border border-border rounded-lg overflow-hidden"
                            >
                              {/* Schedule Header */}
                              <div
                                onClick={() => toggleScheduleExpand(schedule.id)}
                                className="flex items-center justify-between p-3 bg-secondary hover:bg-secondary/80 cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <span className="text-xl flex-shrink-0">{getScheduleTypeEmoji(schedule.schedule_type)}</span>
                                  <div className="min-w-0">
                                    <div className="font-medium text-foreground truncate">{schedule.name || getScheduleTypeLabel(schedule.schedule_type)}</div>
                                    <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2">
                                      <span>{getScheduleFrequencyText(schedule)}</span>
                                      {timeWindow && <span>• {timeWindow}</span>}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {/* Quick notification toggle */}
                                  <button
                                    onClick={(e) => handleQuickToggle(schedule, e)}
                                    disabled={savingScheduleId === schedule.id}
                                    className={`p-2 rounded-lg transition-colors ${
                                      schedule.notifications_enabled
                                        ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30'
                                        : 'text-muted-foreground hover:bg-muted'
                                    }`}
                                    title={schedule.notifications_enabled ? 'Notifications On' : 'Notifications Off'}
                                  >
                                    {schedule.notifications_enabled ? <Bell size={18} /> : <BellOff size={18} />}
                                  </button>

                                  {/* Edit button - go to full schedule editor */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/schedule-edit/${schedule.id}`);
                                    }}
                                    className="p-2 rounded-lg text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                    title="Edit Schedule"
                                  >
                                    <Pencil size={18} />
                                  </button>

                                  {/* Delete button */}
                                  <button
                                    onClick={(e) => handleDelete(schedule.id, e)}
                                    disabled={deletingScheduleId === schedule.id}
                                    className="p-2 rounded-lg text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                                    title="Delete Schedule"
                                  >
                                    <Trash2 size={18} />
                                  </button>

                                  {/* Expand indicator */}
                                  {isScheduleExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </div>
                              </div>

                              {/* Expanded Notification Settings */}
                              {isScheduleExpanded && (
                                <div className="p-4 bg-card border-t border-border space-y-4">
                                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                                    <Bell size={16} />
                                    Notification Settings
                                  </h4>

                                  {/* Enable Notifications */}
                                  <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingData.notifications_enabled || false}
                                      onChange={(e) => setEditingData(prev => ({
                                        ...prev,
                                        notifications_enabled: e.target.checked
                                      }))}
                                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                    />
                                    <span className="text-foreground">Enable notifications for this schedule</span>
                                  </label>

                                  {editingData.notifications_enabled && (
                                    <div className="space-y-4 ml-7 pt-2 border-t border-border">
                                      {/* Reminder Time */}
                                      <div>
                                        <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                                          <Clock size={14} />
                                          Reminder Time
                                        </label>
                                        <div className="w-40">
                                          <TimePicker
                                            value={editingData.reminder_time || ''}
                                            onChange={(time) => setEditingData(prev => ({
                                              ...prev,
                                              reminder_time: time
                                            }))}
                                            placeholder="Pick a time"
                                            step={15}
                                          />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          When to send the reminder (leave empty to use global settings)
                                        </p>
                                      </div>

                                      {/* Follow-up Reminder */}
                                      <div className="space-y-2">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={editingData.follow_up_enabled || false}
                                            onChange={(e) => setEditingData(prev => ({
                                              ...prev,
                                              follow_up_enabled: e.target.checked
                                            }))}
                                            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                          />
                                          <span className="text-foreground">Send follow-up reminder if not completed</span>
                                        </label>
                                        {editingData.follow_up_enabled && (
                                          <div className="ml-7">
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="number"
                                                value={editingData.follow_up_delay_minutes || 30}
                                                onChange={(e) => setEditingData(prev => ({
                                                  ...prev,
                                                  follow_up_delay_minutes: e.target.value
                                                }))}
                                                min="5"
                                                max="480"
                                                className="input-field w-20"
                                              />
                                              <span className="text-sm text-muted-foreground">minutes after first reminder</span>
                                            </div>
                                            <FollowUpPreview
                                              reminderTime={editingData.reminder_time || schedule.reminder_time}
                                              followUpDelayMinutes={editingData.follow_up_delay_minutes}
                                              latestTime={schedule.latest_time}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Save/Cancel Buttons */}
                                  <div className="flex gap-3 pt-2">
                                    <button
                                      onClick={() => handleSaveSettings(schedule.id)}
                                      disabled={savingScheduleId === schedule.id}
                                      className="btn-primary"
                                    >
                                      {savingScheduleId === schedule.id ? 'Saving...' : 'Save Settings'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setExpandedSchedule(null);
                                        setEditingData({});
                                      }}
                                      className="btn-secondary"
                                    >
                                      Cancel
                                    </button>
                                    <Link
                                      to={`/schedule-edit/${schedule.id}`}
                                      className="btn-secondary flex items-center gap-2"
                                    >
                                      <ExternalLink size={14} />
                                      Full Schedule Editor
                                    </Link>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Collapsible.Content>
                  </div>
                </Collapsible.Root>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="card bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
        <h3 className="font-bold text-foreground mb-3">About Schedule Notifications</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            • Click the bell icon to quickly toggle notifications on/off
          </p>
          <p>
            • Click a schedule row to expand and edit notification settings
          </p>
          <p>
            • Follow-up reminders send a second notification if the task isn't completed
          </p>
          <p>
            • Window expiry alerts notify you when a time window is about to close
          </p>
        </div>
      </div>
    </div>
  );
}

export default ScheduleNotificationsTab;
