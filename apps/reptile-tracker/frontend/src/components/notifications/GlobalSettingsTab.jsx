import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getUserTimeFormat, getDayNames, getDayNumbers, getUserTimezone } from '../utils/dateFormatting';
import { TimePicker } from '@/components/ui/time-picker';

function GlobalSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userTimeFormat, setUserTimeFormat] = useState(getUserTimeFormat());

  // Global notification preferences
  const [notifyScheduleReminders, setNotifyScheduleReminders] = useState(true);
  const [notifyOverdueAlerts, setNotifyOverdueAlerts] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Frequency cap settings (Phase 22)
  const [frequencyCapEnabled, setFrequencyCapEnabled] = useState(true);
  const [frequencyCapPerReptile, setFrequencyCapPerReptile] = useState(5);
  const [frequencyCapMode, setFrequencyCapMode] = useState('silent');

  // Planner digest settings (Phase 23)
  const [dailyPlannerEnabled, setDailyPlannerEnabled] = useState(false);
  const [dailyPlannerTime, setDailyPlannerTime] = useState('08:00');
  const [weeklyPlannerEnabled, setWeeklyPlannerEnabled] = useState(false);
  // Default weekly planner day to user's first day of week
  const [weeklyPlannerDay, setWeeklyPlannerDay] = useState(() => getDayNumbers()[0]);
  const [weeklyPlannerTime, setWeeklyPlannerTime] = useState('08:00'); // Independent time for weekly planner
  const [digestFormat, setDigestFormat] = useState('grouped');
  const [digestChannelId, setDigestChannelId] = useState(null); // null = send to all enabled channels

  // Time picker state for quiet hours start
  const [startHours, setStartHours] = useState(22);
  const [startMinutes, setStartMinutes] = useState(0);
  const [startPeriod, setStartPeriod] = useState('PM');

  // Time picker state for quiet hours end
  const [endHours, setEndHours] = useState(8);
  const [endMinutes, setEndMinutes] = useState(0);
  const [endPeriod, setEndPeriod] = useState('AM');

  // Channels for digest dropdown
  const [channels, setChannels] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load global preferences
      try {
        const settingsRes = await axios.get('/api/notification-settings/me');
        if (settingsRes.data) {
          setNotifyScheduleReminders(settingsRes.data.notify_schedule_reminders !== undefined ? settingsRes.data.notify_schedule_reminders : true);
          setNotifyOverdueAlerts(settingsRes.data.notify_overdue_alerts !== undefined ? settingsRes.data.notify_overdue_alerts : true);
          setQuietHoursEnabled(settingsRes.data.quiet_hours_enabled || false);
          setQuietHoursStart(settingsRes.data.quiet_hours_start || '22:00');
          setQuietHoursEnd(settingsRes.data.quiet_hours_end || '08:00');

          // Load frequency cap settings (Phase 22)
          setFrequencyCapEnabled(settingsRes.data.frequency_cap_enabled !== undefined ? settingsRes.data.frequency_cap_enabled : true);
          setFrequencyCapPerReptile(settingsRes.data.frequency_cap_per_reptile !== undefined ? settingsRes.data.frequency_cap_per_reptile : 5);
          setFrequencyCapMode(settingsRes.data.frequency_cap_mode || 'silent');

          // Load planner digest settings (Phase 23)
          setDailyPlannerEnabled(settingsRes.data.daily_planner_enabled || false);
          setDailyPlannerTime(settingsRes.data.daily_planner_time || '08:00');
          setWeeklyPlannerEnabled(settingsRes.data.weekly_planner_enabled || false);
          // Only use stored day if user has explicitly enabled weekly planner before
          // Otherwise use their locale-preferred first day of week
          if (settingsRes.data.weekly_planner_enabled) {
            setWeeklyPlannerDay(settingsRes.data.weekly_planner_day ?? 0);
          }
          // Load weekly planner time (falls back to daily time if not set)
          setWeeklyPlannerTime(settingsRes.data.weekly_planner_time || settingsRes.data.daily_planner_time || '08:00');
          // else: keep the locale-aware default from useState initialization
          setDigestFormat(settingsRes.data.digest_format || 'grouped');
          setDigestChannelId(settingsRes.data.digest_channel_id ?? null);
        }
      } catch (err) {
        // 404 is okay, means no settings yet
        if (err.response?.status !== 404) {
          console.error('Failed to load notification settings:', err);
        }
      }

      // Load channels for digest dropdown
      const channelsRes = await axios.get('/api/notification-channels/me');
      setChannels(channelsRes.data || []);
    } catch (err) {
      console.error('Failed to load notification data:', err);
      setError('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  // Update quietHoursStart string when time picker values change
  useEffect(() => {
    let hour24 = startHours;
    if (userTimeFormat === '12h') {
      if (startPeriod === 'PM' && startHours !== 12) {
        hour24 = startHours + 12;
      } else if (startPeriod === 'AM' && startHours === 12) {
        hour24 = 0;
      }
    }
    const timeString = `${String(hour24).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`;
    setQuietHoursStart(timeString);
  }, [startHours, startMinutes, startPeriod, userTimeFormat]);

  // Update quietHoursEnd string when time picker values change
  useEffect(() => {
    let hour24 = endHours;
    if (userTimeFormat === '12h') {
      if (endPeriod === 'PM' && endHours !== 12) {
        hour24 = endHours + 12;
      } else if (endPeriod === 'AM' && endHours === 12) {
        hour24 = 0;
      }
    }
    const timeString = `${String(hour24).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    setQuietHoursEnd(timeString);
  }, [endHours, endMinutes, endPeriod, userTimeFormat]);

  // Parse loaded quietHoursStart time into picker state
  useEffect(() => {
    if (quietHoursStart) {
      const [hours, minutes] = quietHoursStart.split(':').map(Number);

      if (userTimeFormat === '12h') {
        if (hours === 0) {
          setStartHours(12);
          setStartPeriod('AM');
        } else if (hours < 12) {
          setStartHours(hours);
          setStartPeriod('AM');
        } else if (hours === 12) {
          setStartHours(12);
          setStartPeriod('PM');
        } else {
          setStartHours(hours - 12);
          setStartPeriod('PM');
        }
      } else {
        setStartHours(hours);
      }

      setStartMinutes(minutes);
    }
  }, []); // Only run on mount

  // Parse loaded quietHoursEnd time into picker state
  useEffect(() => {
    if (quietHoursEnd) {
      const [hours, minutes] = quietHoursEnd.split(':').map(Number);

      if (userTimeFormat === '12h') {
        if (hours === 0) {
          setEndHours(12);
          setEndPeriod('AM');
        } else if (hours < 12) {
          setEndHours(hours);
          setEndPeriod('AM');
        } else if (hours === 12) {
          setEndHours(12);
          setEndPeriod('PM');
        } else {
          setEndHours(hours - 12);
          setEndPeriod('PM');
        }
      } else {
        setEndHours(hours);
      }

      setEndMinutes(minutes);
    }
  }, []); // Only run on mount

  const handleStartHoursChange = (value) => {
    const num = parseInt(value) || 0;
    const max = userTimeFormat === '12h' ? 12 : 23;
    const min = userTimeFormat === '12h' ? 1 : 0;
    setStartHours(Math.max(min, Math.min(max, num)));
  };

  const handleStartMinutesChange = (value) => {
    const num = parseInt(value) || 0;
    setStartMinutes(Math.max(0, Math.min(59, num)));
  };

  const handleEndHoursChange = (value) => {
    const num = parseInt(value) || 0;
    const max = userTimeFormat === '12h' ? 12 : 23;
    const min = userTimeFormat === '12h' ? 1 : 0;
    setEndHours(Math.max(min, Math.min(max, num)));
  };

  const handleEndMinutesChange = (value) => {
    const num = parseInt(value) || 0;
    setEndMinutes(Math.max(0, Math.min(59, num)));
  };

  const handleSavePreferences = async () => {
    try {
      setSavingPreferences(true);
      setError('');
      setSuccess('');

      await axios.post('/api/notification-settings/me', {
        notify_schedule_reminders: notifyScheduleReminders,
        notify_overdue_alerts: notifyOverdueAlerts,
        quiet_hours_enabled: quietHoursEnabled,
        quiet_hours_start: quietHoursEnabled ? quietHoursStart : null,
        quiet_hours_end: quietHoursEnabled ? quietHoursEnd : null,
        webhook_enabled: false, // Legacy field
        webhook_url: '',
        webhook_type: 'discord',
        // Frequency cap settings (Phase 22)
        frequency_cap_enabled: frequencyCapEnabled,
        frequency_cap_per_reptile: parseInt(frequencyCapPerReptile) || 5,
        frequency_cap_mode: frequencyCapMode
      });

      setSuccess('Notification preferences saved!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save preferences:', err);
      setError(err.response?.data?.detail || 'Failed to save preferences');
    } finally {
      setSavingPreferences(false);
    }
  };

  const savePlannerSettings = async () => {
    try {
      setSavingPreferences(true);
      setError('');
      setSuccess('');

      await axios.post('/api/notification-settings/me', {
        daily_planner_enabled: dailyPlannerEnabled,
        daily_planner_time: dailyPlannerTime,
        weekly_planner_enabled: weeklyPlannerEnabled,
        weekly_planner_day: weeklyPlannerDay,
        weekly_planner_time: weeklyPlannerTime,
        digest_format: digestFormat,
        digest_channel_id: digestChannelId,
      });

      setSuccess('Planner settings saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save planner settings:', err);
      setError('Failed to save planner settings');
    } finally {
      setSavingPreferences(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-muted-foreground">Loading notification settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Notification Preferences */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 text-foreground">Notification Preferences</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Choose which types of notifications you want to receive across all your notification channels.
        </p>

        {error && !success.includes('Planner') && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {success && !success.includes('Planner') && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-green-800 dark:text-green-200 text-sm">{success}</p>
          </div>
        )}

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyScheduleReminders}
              onChange={(e) => setNotifyScheduleReminders(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <div className="flex-1">
              <div className="font-medium text-foreground">Schedule Reminders</div>
              <div className="text-sm text-muted-foreground">
                Get notified before a schedule's time window closes (configured per schedule)
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyOverdueAlerts}
              onChange={(e) => setNotifyOverdueAlerts(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <div className="flex-1">
              <div className="font-medium text-foreground">Overdue Alerts</div>
              <div className="text-sm text-muted-foreground">
                Get notified when a scheduled activity is missed
              </div>
            </div>
          </label>

          {/* Quiet Hours */}
          <div className="pt-4 border-t border-border">
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={quietHoursEnabled}
                onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <div className="flex-1">
                <div className="font-medium text-foreground">Enable Quiet Hours</div>
                <div className="text-sm text-muted-foreground">
                  Suppress non-critical notifications during specified hours (critical health alerts will still be sent)
                </div>
              </div>
            </label>

            {quietHoursEnabled && (
              <div className="ml-7 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Start Time
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={startHours}
                        onChange={e => handleStartHoursChange(e.target.value)}
                        className="input-field w-20 text-center"
                        min={userTimeFormat === '12h' ? 1 : 0}
                        max={userTimeFormat === '12h' ? 12 : 23}
                        required
                      />
                      <span className="flex items-center text-xl font-bold text-muted-foreground">:</span>
                      <input
                        type="number"
                        value={String(startMinutes).padStart(2, '0')}
                        onChange={e => handleStartMinutesChange(e.target.value)}
                        className="input-field w-20 text-center"
                        min="0"
                        max="59"
                        required
                      />
                      {userTimeFormat === '12h' && (
                        <select
                          value={startPeriod}
                          onChange={e => setStartPeriod(e.target.value)}
                          className="input-field w-20"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      End Time
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={endHours}
                        onChange={e => handleEndHoursChange(e.target.value)}
                        className="input-field w-20 text-center"
                        min={userTimeFormat === '12h' ? 1 : 0}
                        max={userTimeFormat === '12h' ? 12 : 23}
                        required
                      />
                      <span className="flex items-center text-xl font-bold text-muted-foreground">:</span>
                      <input
                        type="number"
                        value={String(endMinutes).padStart(2, '0')}
                        onChange={e => handleEndMinutesChange(e.target.value)}
                        className="input-field w-20 text-center"
                        min="0"
                        max="59"
                        required
                      />
                      {userTimeFormat === '12h' && (
                        <select
                          value={endPeriod}
                          onChange={e => setEndPeriod(e.target.value)}
                          className="input-field w-20"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {quietHoursStart && quietHoursEnd && (
                    quietHoursStart > quietHoursEnd
                      ? `Quiet hours from ${quietHoursStart} to ${quietHoursEnd} (overnight)`
                      : `Quiet hours from ${quietHoursStart} to ${quietHoursEnd}`
                  )}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleSavePreferences}
            disabled={savingPreferences}
            className="btn-primary mt-2"
          >
            {savingPreferences ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>

      {/* Notification Frequency Cap */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 text-foreground">Notification Frequency Cap</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Prevent notification overload by limiting how many notifications you receive per reptile per day.
        </p>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={frequencyCapEnabled}
              onChange={(e) => setFrequencyCapEnabled(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <div className="flex-1">
              <div className="font-medium text-foreground">Enable Frequency Cap</div>
              <div className="text-sm text-muted-foreground">
                Limit the number of notifications per reptile per day
              </div>
            </div>
          </label>

          {frequencyCapEnabled && (
            <div className="ml-7 space-y-4 pt-2 border-t border-border">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Max Notifications Per Reptile Per Day
                </label>
                <input
                  type="number"
                  value={frequencyCapPerReptile}
                  onChange={(e) => setFrequencyCapPerReptile(e.target.value)}
                  min="0"
                  max="50"
                  className="input-field w-24"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {parseInt(frequencyCapPerReptile) === 0
                    ? 'Unlimited notifications (cap disabled)'
                    : `After ${frequencyCapPerReptile} notifications for a reptile, additional notifications will be ${frequencyCapMode === 'silent' ? 'suppressed' : 'summarized'}`
                  }
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  When Limit is Reached
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="frequencyCapMode"
                      value="silent"
                      checked={frequencyCapMode === 'silent'}
                      onChange={(e) => setFrequencyCapMode(e.target.value)}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <div className="font-medium text-foreground">Suppress Silently</div>
                      <div className="text-sm text-muted-foreground">
                        Additional notifications are quietly dropped
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="frequencyCapMode"
                      value="summary"
                      checked={frequencyCapMode === 'summary'}
                      onChange={(e) => setFrequencyCapMode(e.target.value)}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <div className="font-medium text-foreground">Send Summary</div>
                      <div className="text-sm text-muted-foreground">
                        When limit is reached, send a summary notification instead
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSavePreferences}
            disabled={savingPreferences}
            className="btn-primary mt-2"
          >
            {savingPreferences ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>

      {/* Planner Digests Section - Phase 23 */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 text-foreground">Planner Digests</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Receive a summary of scheduled tasks at your preferred time.
        </p>

        <div className="space-y-4">
          {/* Daily Planner */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground">Daily Planner</label>
                <p className="text-xs text-muted-foreground">Morning digest of today's tasks</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={dailyPlannerEnabled}
                  onChange={(e) => setDailyPlannerEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {dailyPlannerEnabled && (
              <div className="ml-4 pl-4 border-l-2 border-border space-y-3">
                {/* Delivery Time */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Delivery Time
                  </label>
                  <div className="max-w-[200px]">
                    <TimePicker
                      value={dailyPlannerTime}
                      onChange={setDailyPlannerTime}
                      step={30}
                      placeholder="Pick a time"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Time is in your timezone ({getUserTimezone()})
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Weekly Planner */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground">Weekly Planner</label>
                <p className="text-xs text-muted-foreground">Preview of the week's tasks</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={weeklyPlannerEnabled}
                  onChange={(e) => setWeeklyPlannerEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {weeklyPlannerEnabled && (
              <div className="ml-4 pl-4 border-l-2 border-border space-y-3">
                {/* Day Selection */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Send On
                  </label>
                  <select
                    value={weeklyPlannerDay}
                    onChange={(e) => setWeeklyPlannerDay(Number(e.target.value))}
                    className="bg-background border border-border rounded-md px-3 py-2 text-sm w-full"
                  >
                    {getDayNumbers().map((dayNum) => (
                      <option key={dayNum} value={dayNum}>
                        {getDayNames()[getDayNumbers().indexOf(dayNum)]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Delivery Time for weekly planner */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Delivery Time
                  </label>
                  <div className="max-w-[200px]">
                    <TimePicker
                      value={weeklyPlannerTime}
                      onChange={setWeeklyPlannerTime}
                      step={30}
                      placeholder="Pick a time"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Time is in your timezone ({getUserTimezone()})
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Digest Settings (applies to both) */}
          {(dailyPlannerEnabled || weeklyPlannerEnabled) && (
            <div className="space-y-4 pt-4 border-t border-border">
              {/* Channel Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Send To
                </label>
                <select
                  value={digestChannelId ?? ''}
                  onChange={(e) => setDigestChannelId(e.target.value ? parseInt(e.target.value) : null)}
                  className="bg-background border border-border rounded-md px-3 py-2 text-sm w-full"
                >
                  <option value="">All enabled channels</option>
                  {channels.filter(ch => ch.enabled).map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {digestChannelId ? 'Digests will be sent only to the selected channel' : 'Digests will be sent to all enabled notification channels'}
                </p>
              </div>

              {/* Digest Format */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Digest Format
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="digestFormat"
                      value="grouped"
                      checked={digestFormat === 'grouped'}
                      onChange={(e) => setDigestFormat(e.target.value)}
                      className="text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="text-sm text-foreground">Single message</span>
                      <p className="text-xs text-muted-foreground">All tasks in one notification</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="digestFormat"
                      value="individual"
                      checked={digestFormat === 'individual'}
                      onChange={(e) => setDigestFormat(e.target.value)}
                      className="text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="text-sm text-foreground">Individual notifications</span>
                      <p className="text-xs text-muted-foreground">One notification per task</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && success.includes('Planner') && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-green-800 dark:text-green-200 text-sm">{success}</p>
            </div>
          )}

          {/* Save Button */}
          <div className="pt-4">
            <button
              onClick={savePlannerSettings}
              disabled={savingPreferences}
              className="btn-primary"
            >
              {savingPreferences ? 'Saving...' : 'Save Planner Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GlobalSettingsTab;
