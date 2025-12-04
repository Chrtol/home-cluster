import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, Plus, Trash2, Edit2, Eye, EyeOff } from 'lucide-react';
import { getUserTimeFormat } from '../utils/dateFormatting';

function NotificationsTab() {
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

  // Time picker state for quiet hours start
  const [startHours, setStartHours] = useState(22);
  const [startMinutes, setStartMinutes] = useState(0);
  const [startPeriod, setStartPeriod] = useState('PM');

  // Time picker state for quiet hours end
  const [endHours, setEndHours] = useState(8);
  const [endMinutes, setEndMinutes] = useState(0);
  const [endPeriod, setEndPeriod] = useState('AM');

  // Notification channels
  const [channels, setChannels] = useState([]);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);

  // Channel form state
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState('discord');
  const [channelUrl, setChannelUrl] = useState('');
  const [channelEnabled, setChannelEnabled] = useState(true);
  const [householdWide, setHouseholdWide] = useState(false);
  const [testingChannel, setTestingChannel] = useState(false);

  // Modal-specific messages (for test notifications)
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Pushover config state
  const [pushoverApiKey, setPushoverApiKey] = useState('');
  const [pushoverUserKey, setPushoverUserKey] = useState('');
  const [pushoverDevices, setPushoverDevices] = useState('');
  const [pushoverPriority, setPushoverPriority] = useState('normal');
  const [pushoverRetry, setPushoverRetry] = useState('30');
  const [pushoverExpire, setPushoverExpire] = useState('3600');
  const [pushoverSound, setPushoverSound] = useState('');

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
        }
      } catch (err) {
        // 404 is okay, means no settings yet
        if (err.response?.status !== 404) {
          console.error('Failed to load notification settings:', err);
        }
      }

      // Load channels
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
        webhook_type: 'discord'
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

  const handleAddChannel = () => {
    setEditingChannel(null);
    setChannelName('');
    setChannelType('discord');
    setChannelUrl('');
    setChannelEnabled(true);
    setHouseholdWide(false);
    setPushoverApiKey('');
    setPushoverUserKey('');
    setPushoverDevices('');
    setPushoverPriority('normal');
    setPushoverRetry('30');
    setPushoverExpire('3600');
    setPushoverSound('');
    setModalError('');
    setModalSuccess('');
    setShowAddChannel(true);
  };

  const handleEditChannel = (channel) => {
    setEditingChannel(channel);
    setChannelName(channel.name);
    setChannelType(channel.webhook_type);
    setChannelUrl(channel.webhook_url || '');
    setChannelEnabled(channel.enabled);
    setHouseholdWide(channel.household_wide || false);

    // Load Pushover config if exists
    if (channel.webhook_type === 'pushover' && channel.config) {
      setPushoverApiKey(channel.config.api_key || '');
      setPushoverUserKey(channel.config.user_key || '');
      setPushoverDevices(channel.config.devices || '');
      setPushoverPriority(channel.config.priority || 'normal');
      setPushoverRetry(channel.config.retry?.toString() || '30');
      setPushoverExpire(channel.config.expire?.toString() || '3600');
      setPushoverSound(channel.config.sound || '');
    } else {
      setPushoverApiKey('');
      setPushoverUserKey('');
      setPushoverDevices('');
      setPushoverPriority('normal');
      setPushoverRetry('30');
      setPushoverExpire('3600');
      setPushoverSound('');
    }

    setModalError('');
    setModalSuccess('');
    setShowAddChannel(true);
  };

  const handleSaveChannel = async () => {
    try {
      setError('');
      setSuccess('');

      if (!channelName.trim()) {
        setError('Channel name is required');
        return;
      }

      // Build payload based on channel type
      const payload = {
        name: channelName.trim(),
        webhook_type: channelType,
        enabled: channelEnabled,
        household_wide: householdWide
      };

      if (channelType === 'pushover') {
        // Validate Pushover fields
        if (!pushoverApiKey.trim() || !pushoverUserKey.trim()) {
          setError('Pushover requires API Key and User Key');
          return;
        }

        // Build Pushover config
        payload.config = {
          api_key: pushoverApiKey.trim(),
          user_key: pushoverUserKey.trim(),
          priority: pushoverPriority
        };

        if (pushoverDevices.trim()) {
          payload.config.devices = pushoverDevices.trim();
        }

        if (pushoverPriority === 'emergency') {
          payload.config.retry = parseInt(pushoverRetry) || 30;
          payload.config.expire = parseInt(pushoverExpire) || 3600;
        }

        if (pushoverSound.trim()) {
          payload.config.sound = pushoverSound.trim();
        }

        payload.webhook_url = null; // Pushover doesn't use webhook URLs
      } else {
        // Discord and Generic require webhook URL
        if (!channelUrl.trim()) {
          setError('Webhook URL is required');
          return;
        }
        payload.webhook_url = channelUrl.trim();
        payload.config = null;
      }

      if (editingChannel) {
        // Update existing channel
        await axios.patch(`/api/notification-channels/${editingChannel.id}`, payload);
        setSuccess('Channel updated successfully!');
      } else {
        // Create new channel
        await axios.post('/api/notification-channels', payload);
        setSuccess('Channel added successfully!');
      }

      setShowAddChannel(false);
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save channel:', err);
      setError(err.response?.data?.detail || 'Failed to save channel');
    }
  };

  const handleDeleteChannel = async (channelId) => {
    if (!confirm('Are you sure you want to delete this notification channel?')) {
      return;
    }

    try {
      setError('');
      await axios.delete(`/api/notification-channels/${channelId}`);
      setSuccess('Channel deleted successfully!');
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to delete channel:', err);
      setError(err.response?.data?.detail || 'Failed to delete channel');
    }
  };

  const handleToggleChannel = async (channel) => {
    try {
      setError('');
      await axios.patch(`/api/notification-channels/${channel.id}`, {
        enabled: !channel.enabled
      });
      loadData();
    } catch (err) {
      console.error('Failed to toggle channel:', err);
      setError(err.response?.data?.detail || 'Failed to toggle channel');
    }
  };

  const handleTestChannel = async () => {
    try {
      setTestingChannel(true);
      setModalError('');
      setModalSuccess('');

      const payload = {
        webhook_type: channelType
      };

      if (channelType === 'pushover') {
        if (!pushoverApiKey.trim() || !pushoverUserKey.trim()) {
          setModalError('Pushover requires API Key and User Key to test');
          return;
        }

        payload.config = {
          api_key: pushoverApiKey.trim(),
          user_key: pushoverUserKey.trim(),
          priority: pushoverPriority
        };

        if (pushoverDevices.trim()) {
          payload.config.devices = pushoverDevices.trim();
        }

        if (pushoverPriority === 'emergency') {
          payload.config.retry = parseInt(pushoverRetry) || 30;
          payload.config.expire = parseInt(pushoverExpire) || 3600;
        }

        if (pushoverSound.trim()) {
          payload.config.sound = pushoverSound.trim();
        }
      } else if (channelType === 'in_app') {
        // In-app notifications don't need a webhook URL
        // payload already has webhook_type set
      } else {
        if (!channelUrl.trim()) {
          setModalError('Webhook URL is required to test');
          return;
        }
        payload.webhook_url = channelUrl.trim();
      }

      await axios.post('/api/notification-settings/test', payload);

      setModalSuccess('Test notification sent! Check your notification destination.');
      setTimeout(() => setModalSuccess(''), 5000);
    } catch (err) {
      console.error('Failed to send test notification:', err);
      setModalError(err.response?.data?.detail || 'Failed to send test notification');
    } finally {
      setTestingChannel(false);
    }
  };

  const maskWebhookUrl = (url) => {
    if (url.length <= 20) return url;
    return url.substring(0, 20) + '...' + url.substring(url.length - 10);
  };

  const getChannelTypeDisplay = (webhookType) => {
    const typeMap = {
      'in_app': 'In-App',
      'discord': 'Discord',
      'pushover': 'Pushover',
      'generic': 'Generic Webhook'
    };
    return typeMap[webhookType] || webhookType;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500 dark:text-gray-400">Loading notification settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Notification Preferences */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Notification Preferences</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Choose which types of notifications you want to receive across all your notification channels.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {success && (
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
              <div className="font-medium text-gray-900 dark:text-white">Schedule Reminders</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
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
              <div className="font-medium text-gray-900 dark:text-white">Overdue Alerts</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Get notified when a scheduled activity is missed
              </div>
            </div>
          </label>

          {/* Quiet Hours */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={quietHoursEnabled}
                onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">Enable Quiet Hours</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Suppress non-critical notifications during specified hours (critical health alerts will still be sent)
                </div>
              </div>
            </label>

            {quietHoursEnabled && (
              <div className="ml-7 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                      <span className="flex items-center text-xl font-bold text-gray-700 dark:text-gray-300">:</span>
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                      <span className="flex items-center text-xl font-bold text-gray-700 dark:text-gray-300">:</span>
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
                <p className="text-xs text-gray-500 dark:text-gray-400">
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

      {/* Notification Channels */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notification Channels</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Add multiple notification channels (Discord, Pushover, etc.). Notifications are sent to all enabled channels.
            </p>
          </div>
          <button
            onClick={handleAddChannel}
            className="btn-secondary flex items-center gap-2"
          >
            <Plus size={16} />
            Add Channel
          </button>
        </div>

        {/* Channel Cards */}
        {channels.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
            <Bell size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">No notification channels configured yet</p>
            <button onClick={handleAddChannel} className="btn-primary">
              <Plus size={16} className="inline mr-2" />
              Add Your First Channel
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  channel.enabled
                    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 dark:text-white mb-1">{channel.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {getChannelTypeDisplay(channel.webhook_type)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleChannel(channel)}
                      className={`p-2 rounded transition-colors ${
                        channel.enabled
                          ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50'
                          : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      title={channel.enabled ? 'Disable channel' : 'Enable channel'}
                    >
                      {channel.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button
                      onClick={() => handleEditChannel(channel)}
                      className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-colors"
                      title="Edit channel"
                    >
                      <Edit2 size={16} />
                    </button>
                    {!channel.is_system ? (
                      <button
                        onClick={() => handleDeleteChannel(channel.id)}
                        className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition-colors"
                        title="Delete channel"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button
                        disabled
                        className="p-2 text-gray-400 cursor-not-allowed rounded transition-colors"
                        title="System channel cannot be deleted"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                  {channel.webhook_type === 'in_app' ? (
                    <div className="italic">Notifications appear in the notification bell icon</div>
                  ) : channel.webhook_type === 'pushover' ? (
                    <div>
                      <div>User: {channel.config?.user_key ? `${channel.config.user_key.substring(0, 8)}...` : 'Not configured'}</div>
                      <div>Priority: {channel.config?.priority || 'normal'}</div>
                    </div>
                  ) : (
                    maskWebhookUrl(channel.webhook_url)
                  )}
                </div>
                {!channel.enabled && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                    Disabled - notifications will not be sent to this channel
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Channel Modal */}
      {showAddChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {editingChannel ? 'Edit' : 'Add'} Notification Channel
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Channel Name
                </label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="e.g., Discord - Main Server"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Channel Type
                </label>
                <select
                  value={channelType}
                  onChange={(e) => setChannelType(e.target.value)}
                  className="input-field"
                >
                  <option value="discord">Discord</option>
                  <option value="pushover">Pushover</option>
                  <option value="generic">Generic Webhook</option>
                </select>
              </div>

              {/* Conditional fields based on channel type */}
              {channelType === 'pushover' ? (
                <>
                  {/* Pushover Config Fields */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      API Key *
                    </label>
                    <input
                      type="text"
                      value={pushoverApiKey}
                      onChange={(e) => setPushoverApiKey(e.target.value)}
                      placeholder="Your Pushover application API key"
                      className="input-field font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      User Key *
                    </label>
                    <input
                      type="text"
                      value={pushoverUserKey}
                      onChange={(e) => setPushoverUserKey(e.target.value)}
                      placeholder="Your Pushover user key"
                      className="input-field font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Devices (Optional)
                    </label>
                    <input
                      type="text"
                      value={pushoverDevices}
                      onChange={(e) => setPushoverDevices(e.target.value)}
                      placeholder="device1,device2 (leave blank for all devices)"
                      className="input-field text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Priority
                    </label>
                    <select
                      value={pushoverPriority}
                      onChange={(e) => setPushoverPriority(e.target.value)}
                      className="input-field"
                    >
                      <option value="silent">Silent (-2)</option>
                      <option value="quiet">Quiet (-1)</option>
                      <option value="normal">Normal (0)</option>
                      <option value="high">High (1)</option>
                      <option value="emergency">Emergency (2)</option>
                    </select>
                  </div>

                  {pushoverPriority === 'emergency' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Retry (seconds)
                        </label>
                        <input
                          type="number"
                          value={pushoverRetry}
                          onChange={(e) => setPushoverRetry(e.target.value)}
                          min="30"
                          className="input-field"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum 30 seconds</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Expire (seconds)
                        </label>
                        <input
                          type="number"
                          value={pushoverExpire}
                          onChange={(e) => setPushoverExpire(e.target.value)}
                          max="86400"
                          className="input-field"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum 86400 seconds (24 hours)</p>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sound (Optional)
                    </label>
                    <input
                      type="text"
                      value={pushoverSound}
                      onChange={(e) => setPushoverSound(e.target.value)}
                      placeholder="pushover, bike, bugle, etc."
                      className="input-field text-sm"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Webhook URL for Discord and Generic */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Webhook URL *
                    </label>
                    <input
                      type="url"
                      value={channelUrl}
                      onChange={(e) => setChannelUrl(e.target.value)}
                      placeholder="https://..."
                      className="input-field font-mono text-sm"
                    />
                  </div>
                </>
              )}

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={channelEnabled}
                  onChange={(e) => setChannelEnabled(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Enable this channel
                </span>
              </label>

              {/* Household-wide toggle */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={householdWide}
                    onChange={(e) => setHouseholdWide(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white block">
                      Household channel
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400 block mt-1">
                      Make this channel available to all household members. When enabled, any household member can select this channel when creating schedules for shared reptiles.
                    </span>
                  </div>
                </label>
              </div>

              {/* Test Button */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleTestChannel}
                  disabled={testingChannel || (channelType === 'pushover' ? (!pushoverApiKey.trim() || !pushoverUserKey.trim()) : !channelUrl.trim())}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  {testingChannel ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      Sending Test...
                    </>
                  ) : (
                    <>
                      <Bell size={16} />
                      Send Test Notification
                    </>
                  )}
                </button>

                {/* Success/Error messages inside modal */}
                {modalSuccess && (
                  <div className="mt-3 p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg text-sm">
                    {modalSuccess}
                  </div>
                )}
                {modalError && (
                  <div className="mt-3 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg text-sm">
                    {modalError}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={handleSaveChannel} className="btn-primary flex-1">
                  {editingChannel ? 'Update' : 'Add'} Channel
                </button>
                <button
                  onClick={() => {
                    setShowAddChannel(false);
                    setModalError('');
                    setModalSuccess('');
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="card bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border-blue-200 dark:border-blue-800">
        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Bell size={20} className="text-blue-600 dark:text-blue-400" />
          How Notifications Work
        </h3>
        <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
          <div>
            <div className="font-semibold text-blue-600 dark:text-blue-400 mb-1">Multiple Channels</div>
            <p>Add as many notification channels as you need. All enabled channels will receive notifications.</p>
          </div>
          <div>
            <div className="font-semibold text-green-600 dark:text-green-400 mb-1">Supported Platforms</div>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Discord - Rich embeds with timestamps</li>
              <li>Pushover - Mobile notifications</li>
              <li>Generic Webhooks - Any HTTP endpoint</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotificationsTab;
