import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';

function ScheduleNotificationsTab() {
  const [reptiles, setReptiles] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedReptiles, setExpandedReptiles] = useState(new Set());
  const [savingScheduleId, setSavingScheduleId] = useState(null);

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
      // API is GET /api/schedules/reptile/{reptile_id}
      const schedulePromises = reptilesList.map(reptile =>
        axios.get(`/api/schedules/reptile/${reptile.id}`)
          .then(res => res.data)
          .catch(() => []) // Handle case where reptile has no schedules
      );

      const schedulesByReptile = await Promise.all(schedulePromises);
      const allSchedules = schedulesByReptile.flat();
      setSchedules(allSchedules);

      // Expand first reptile by default (if it has schedules)
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

  const handleToggleNotification = async (schedule) => {
    setSavingScheduleId(schedule.id);
    setError('');

    try {
      const res = await axios.patch(`/api/schedules/${schedule.id}`, {
        notification_enabled: !schedule.notification_enabled
      });

      // Update schedules list
      setSchedules(schedules.map(s => s.id === schedule.id ? res.data : s));
    } catch (err) {
      console.error('Failed to toggle notification:', err);
      setError(err.response?.data?.detail || 'Failed to update notification setting');
    } finally {
      setSavingScheduleId(null);
    }
  };

  const getFilteredSchedules = () => {
    let filtered = schedules;

    // Filter by type
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
      'weighing': '⚖️',
      'misting': '💧',
      'health': '🏥',
      'supplement': '💊'
    };
    return emojiMap[type] || '📅';
  };

  const getScheduleTypeLabel = (type) => {
    const labelMap = {
      'feeding': 'Feeding',
      'weighing': 'Weighing',
      'misting': 'Misting',
      'health': 'Health Check',
      'supplement': 'Supplement'
    };
    return labelMap[type] || type;
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

      <div className="card">
        <h2 className="text-xl font-bold mb-4 text-foreground">Schedule Notifications</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Enable or disable notifications for specific schedules. You can also configure reminder times by editing each schedule.
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
            <option value="weighing">Weighings</option>
            <option value="misting">Misting</option>
            <option value="health">Health Checks</option>
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
              const enabledCount = reptileSchedules.filter(s => s.notification_enabled).length;

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
                              {enabledCount > 0 && ` • ${enabledCount} with notifications enabled`}
                            </div>
                          </div>
                        </div>
                      </button>
                    </Collapsible.Trigger>

                    {/* Schedules List */}
                    <Collapsible.Content className="bg-card border-t border-border">
                      <div className="p-4 space-y-3">
                        {reptileSchedules.map((schedule) => (
                          <div
                            key={schedule.id}
                            className="flex items-center justify-between p-3 bg-secondary rounded-lg border border-border"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{getScheduleTypeEmoji(schedule.schedule_type)}</span>
                                <div>
                                  <div className="font-medium text-foreground">{schedule.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {getScheduleTypeLabel(schedule.schedule_type)}
                                    {schedule.notification_minutes_before && (
                                      <> • Reminder: {schedule.notification_minutes_before} min before</>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Notification Toggle */}
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={schedule.notification_enabled || false}
                                  onChange={() => handleToggleNotification(schedule)}
                                  disabled={savingScheduleId === schedule.id}
                                />
                                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary disabled:opacity-50"></div>
                              </label>

                              {/* Edit Link */}
                              <Link
                                to={`/schedule-edit/${schedule.id}`}
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                              >
                                Edit
                                <ExternalLink size={14} />
                              </Link>
                            </div>
                          </div>
                        ))}
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
            • Toggle notifications on/off for individual schedules using the switches above
          </p>
          <p>
            • To configure reminder times (e.g., "notify 30 minutes before"), click "Edit" to go to the schedule editor
          </p>
          <p>
            • Schedule reminders respect your global notification preferences (quiet hours, frequency caps, etc.)
          </p>
          <p>
            • Overdue alerts are sent separately and can be enabled/disabled in Global Settings
          </p>
        </div>
      </div>
    </div>
  );
}

export default ScheduleNotificationsTab;
