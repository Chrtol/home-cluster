import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Utensils, Droplet, Heart, Bell, Check, CheckCheck, Trash2, Filter, Calendar, AlertTriangle, Scale, Activity } from 'lucide-react';
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
        return <Calendar className="w-[18px] h-[18px] text-primary" />;
      case 'overdue_alert':
        return <AlertTriangle className="w-[18px] h-[18px] text-destructive" />;
      case 'feeding_logged':
        return <Utensils className="w-[18px] h-[18px] text-primary" />;
      case 'weight_logged':
        return <Scale className="w-[18px] h-[18px] text-purple-500" />;
      case 'misting_logged':
        return <Droplet className="w-[18px] h-[18px] text-blue-500" />;
      case 'health_event':
        return <Activity className="w-[18px] h-[18px] text-green-500" />;
      default:
        return <Bell className="w-[18px] h-[18px] text-muted-foreground" />;
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
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:bg-muted'
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
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
            <Button
              onClick={handleDeleteAllRead}
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
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
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-base font-medium">No notifications found</p>
            <p className="text-sm mt-1">
              {filter === 'unread' ? 'All caught up!' : 'Notifications will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 transition-colors ${
                  notification.is_read
                    ? 'hover:bg-muted/50'
                    : 'bg-primary/5 hover:bg-primary/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`flex-shrink-0 p-1.5 rounded-lg ${
                    notification.is_read
                      ? 'bg-secondary'
                      : 'bg-primary/10'
                  }`}>
                    {getNotificationIcon(notification.notification_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div
                      onClick={() => handleNotificationClick(notification)}
                      className={`${notification.link ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm ${
                            notification.is_read ? 'text-foreground' : 'font-medium text-foreground'
                          }`}>
                            {notification.title}
                          </p>
                          <Badge variant={getTypeBadgeVariant(notification.notification_type)} className="text-xs">
                            {getTypeDisplayName(notification.notification_type)}
                          </Badge>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
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
                        className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notification.id)}
                      className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Delete notification"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationHistory;
