import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, Plus, Trash2, Edit2, Eye, EyeOff } from 'lucide-react';

function NotificationsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Global notification preferences
  const [notifyScheduleReminders, setNotifyScheduleReminders] = useState(true);
  const [notifyOverdueAlerts, setNotifyOverdueAlerts] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Notification channels
  const [channels, setChannels] = useState([]);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);

  // Channel form state
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState('discord');
  const [channelUrl, setChannelUrl] = useState('');
  const [channelEnabled, setChannelEnabled] = useState(true);

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

  const handleSavePreferences = async () => {
    try {
      setSavingPreferences(true);
      setError('');
      setSuccess('');

      await axios.post('/api/notification-settings/me', {
        notify_schedule_reminders: notifyScheduleReminders,
        notify_overdue_alerts: notifyOverdueAlerts,
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
    setShowAddChannel(true);
  };

  const handleEditChannel = (channel) => {
    setEditingChannel(channel);
    setChannelName(channel.name);
    setChannelType(channel.webhook_type);
    setChannelUrl(channel.webhook_url);
    setChannelEnabled(channel.enabled);
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

      if (!channelUrl.trim()) {
        setError('Webhook URL is required');
        return;
      }

      if (editingChannel) {
        // Update existing channel
        await axios.patch(`/api/notification-channels/${editingChannel.id}`, {
          name: channelName.trim(),
          webhook_type: channelType,
          webhook_url: channelUrl.trim(),
          enabled: channelEnabled
        });
        setSuccess('Channel updated successfully!');
      } else {
        // Create new channel
        await axios.post('/api/notification-channels', {
          name: channelName.trim(),
          webhook_type: channelType,
          webhook_url: channelUrl.trim(),
          enabled: channelEnabled
        });
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

  const maskWebhookUrl = (url) => {
    if (url.length <= 20) return url;
    return url.substring(0, 20) + '...' + url.substring(url.length - 10);
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
                Get notified when a scheduled activity is missed (checked daily at 1 AM UTC)
              </div>
            </div>
          </label>

          <button
            onClick={handleSavePreferences}
            disabled={savingPreferences}
            className="btn-primary"
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
                    <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {channel.webhook_type}
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
                    <button
                      onClick={() => handleDeleteChannel(channel.id)}
                      className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition-colors"
                      title="Delete channel"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                  {maskWebhookUrl(channel.webhook_url)}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Webhook URL
                </label>
                <input
                  type="url"
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  placeholder="https://..."
                  className="input-field"
                />
              </div>

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

              <div className="flex gap-3">
                <button onClick={handleSaveChannel} className="btn-primary flex-1">
                  {editingChannel ? 'Update' : 'Add'} Channel
                </button>
                <button
                  onClick={() => setShowAddChannel(false)}
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
