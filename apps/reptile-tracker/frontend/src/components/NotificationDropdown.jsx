import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Check, CheckCheck, ExternalLink, Bell, Utensils, Scale, Activity, Calendar, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const NotificationDropdown = ({ onClose, onNotificationRead }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/api/notifications', {
        params: {
          limit: 10,
          offset: 0
        }
      });
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
      onNotificationRead();
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axios.post('/api/notifications/mark-all-read');
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      onNotificationRead();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
      onClose();
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'schedule_reminder':
        return <Calendar className="w-5 h-5 text-primary" />;
      case 'overdue_alert':
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
      case 'feeding_logged':
        return <Utensils className="w-5 h-5 text-primary" />;
      case 'weight_logged':
        return <Scale className="w-5 h-5 text-purple-500" />;
      case 'health_event':
        return <Activity className="w-5 h-5 text-green-500" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex justify-between items-center">
        <h3 className="text-sm font-semibold text-foreground">
          Notifications
        </h3>
        <button
          onClick={handleMarkAllAsRead}
          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          Mark all read
        </button>
      </div>

      {/* Notifications list */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  notification.is_read
                    ? 'hover:bg-muted/50'
                    : 'bg-primary/5 hover:bg-primary/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.notification_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${notification.is_read ? 'text-foreground' : 'font-medium text-foreground'}`}>
                        {notification.title}
                      </p>
                      {!notification.is_read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                          className="flex-shrink-0 text-primary hover:text-primary/80 transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.message.replace(/\*\*/g, '')}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                      {notification.link && (
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2.5 border-t border-border">
          <button
            onClick={() => {
              navigate('/notification-history');
              onClose();
            }}
            className="w-full text-center text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
