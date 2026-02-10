import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import axios from 'axios';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import NotificationDropdown from './NotificationDropdown';

const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchUnreadCount();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get('/api/notifications/unread-count');
      setUnreadCount(response.data.unread_count);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const handleNotificationRead = () => {
    // Refresh unread count when a notification is marked as read
    fetchUnreadCount();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors focus-ring"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-destructive-foreground bg-destructive rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 sm:w-96 p-0"
        align="end"
        sideOffset={8}
      >
        <NotificationDropdown
          onClose={() => setIsOpen(false)}
          onNotificationRead={handleNotificationRead}
        />
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
