import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Utensils, Droplet, Heart, Bell, Check, CheckCheck, Trash2, Filter } from 'lucide-react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';

const NotificationHistory = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [typeFilter, setTypeFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, [filter, typeFilter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = {
        limit: 100,
        offset: 0
      };

      if (filter === 'unread') {
        params.is_read = false;
      } else if (filter === 'read') {
        params.is_read = true;
      }

      if (typeFilter !== 'all') {
        params.notification_type = typeFilter;
      }

      const response = await axios.get('/api/notifications', { params });
      setNotifications(response.data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await axios.post(`/api/notifications/${notificationId}/mark-read`);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axios.post('/api/notifications/mark-all-read');
      fetchNotifications();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleDelete = async (notificationId) => {
    if (!window.confirm('Are you sure you want to delete this notification?')) {
      return;
    }

    try {
      await axios.delete(`/api/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleDeleteAllRead = async () => {
    if (!window.confirm('Are you sure you want to delete all read notifications?')) {
      return;
    }

    try {
      await axios.delete('/api/notifications');
      fetchNotifications();
    } catch (err) {
      console.error('Error deleting read notifications:', err);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'schedule_reminder':
      case 'overdue_alert':
        return Bell;
      case 'feeding_logged':
        return Utensils;
      case 'misting_logged':
        return Droplet;
      case 'weight_logged':
      case 'health_event':
        return Heart;
      default:
        return Bell;
    }
  };

  const getTypeDisplayName = (type) => {
    const names = {
      schedule_reminder: 'Reminder',
      overdue_alert: 'Overdue',
      feeding_logged: 'Feeding',
      weight_logged: 'Weight',
      misting_logged: 'Misting',
      health_event: 'Health',
      system: 'System'
    };
    return names[type] || type;
  };

  const getTypeBadgeVariant = (type) => {
    switch (type) {
      case 'overdue_alert':
        return 'overdue';
      case 'schedule_reminder':
        return 'due';
      case 'feeding_logged':
      case 'weight_logged':
      case 'misting_logged':
        return 'done';
      case 'health_event':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Notifications"
        subtitle="View and manage your notification history"
      />

      {/* Filter Controls */}
      <div className="bg-card rounded-lg border border-border p-4 mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Filter buttons and type selector */}
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <div className="flex gap-2">
              {['all', 'unread', 'read'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                    filter === f
                      ? 'bg-blue-500 text-white'
                      : 'bg-secondary text-muted-foreground hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Type filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="schedule_reminder">Reminders</SelectItem>
                <SelectItem value="overdue_alert">Overdue Alerts</SelectItem>
                <SelectItem value="feeding_logged">Feeding Logs</SelectItem>
                <SelectItem value="weight_logged">Weight Logs</SelectItem>
                <SelectItem value="health_event">Health Events</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleMarkAllAsRead}
              size="sm"
              className="bg-blue-500 hover:bg-blue-600"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
            <Button
              onClick={handleDeleteAllRead}
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Read
            </Button>
          </div>
        </div>
      </div>

      {/* Notifications List - Compact */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {loading ? (
          <LoadingState message="Loading notifications..." />
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No notifications found</p>
            <p className="text-sm mt-2">
              {filter === 'unread' ? 'All caught up!' : 'Notifications will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border space-y-1.5">
            {notifications.map((notification) => {
              const Icon = getNotificationIcon(notification.notification_type);
              return (
                <div
                  key={notification.id}
                  className={`p-2.5 transition-colors ${
                    notification.is_read
                      ? 'bg-card hover:bg-secondary/50'
                      : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 p-1.5 rounded-lg ${
                      notification.is_read
                        ? 'bg-secondary text-muted-foreground'
                        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    }`}>
                      <Icon size={18} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div
                        onClick={() => handleNotificationClick(notification)}
                        className={`${notification.link ? 'cursor-pointer' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-medium text-sm ${
                              notification.is_read ? 'text-foreground' : 'text-blue-900 dark:text-blue-100'
                            }`}>
                              {notification.title}
                            </p>
                            <Badge variant={getTypeBadgeVariant(notification.notification_type)} className="text-xs">
                              {getTypeDisplayName(notification.notification_type)}
                            </Badge>
                            {!notification.is_read && (
                              <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {notification.message.replace(/\*\*/g, '')}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Delete notification"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationHistory;
