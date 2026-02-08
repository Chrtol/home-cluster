import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Utensils, Scale } from 'lucide-react';
import ReptileAvatar from '../ReptileAvatar';

/**
 * RecentActivityWidget - Compact recent activity list
 *
 * Shows recent feedings and weighings in a compact format suitable for dashboard widgets.
 *
 * Props:
 * - config: { itemCount: number (default 5) }
 * - size: Widget size determines item count if not in config
 */
const RecentActivityWidget = ({ config = {}, size = 'small' }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getItemCount = () => {
    if (config.itemCount) return config.itemCount;
    const sizeMap = {
      xs: 3,
      small: 3,
      medium: 5,
      large: 5
    };
    return sizeMap[size] || 5;
  };

  const itemCount = getItemCount();

  useEffect(() => {
    fetchRecentActivity();
  }, [itemCount]);

  const fetchRecentActivity = async () => {
    try {
      setLoading(true);
      setError(null);

      const [feedingsRes, weighingsRes] = await Promise.all([
        axios.get('/api/feedings', { params: { limit: itemCount * 2 } }),
        axios.get('/api/weight/dashboard')
      ]);

      const feedings = (feedingsRes.data || []).map(f => ({
        type: 'feeding',
        icon: Utensils,
        reptile_id: f.reptile_id,
        reptile_name: f.reptile_name,
        reptile: { id: f.reptile_id, name: f.reptile_name, avatar_photo_url: f.avatar_photo_url },
        timestamp: f.fed_at,
        description: `${f.food_item || 'Food'}${f.supplements ? ` + ${f.supplements}` : ''}`,
        quantity: f.quantity ? `×${f.quantity}` : null,
        details: f.notes
      }));

      const allWeighings = (weighingsRes.data || [])
        .sort((a, b) => new Date(b.measured_at) - new Date(a.measured_at))
        .slice(0, itemCount * 2);

      const weighings = allWeighings.map(w => ({
        type: 'weighing',
        icon: Scale,
        reptile_id: w.reptile_id,
        reptile_name: w.reptile_name,
        reptile: { id: w.reptile_id, name: w.reptile_name, avatar_photo_url: w.avatar_photo_url },
        timestamp: w.measured_at,
        description: 'Weight recorded',
        quantity: `${w.weight_grams}g`,
        details: w.notes
      }));

      const combined = [...feedings, ...weighings];
      combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setActivities(combined.slice(0, itemCount));
    } catch (err) {
      console.error('Failed to fetch recent activity:', err);
      setError('Failed to load recent activity');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border p-3">
        <div className="text-center text-muted-foreground text-sm">
          Loading recent activity...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-lg border border-border p-3">
        <div className="text-center text-destructive text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
        </div>
        <div className="text-center text-muted-foreground text-sm">
          No recent activity
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
        <Link
          to="/activity"
          className="text-xs text-primary hover:text-primary/80"
        >
          View all
        </Link>
      </div>

      <div className="space-y-2">
        {activities.map((activity, index) => (
          <div
            key={`${activity.type}-${activity.timestamp}-${index}`}
            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50"
          >
            <ReptileAvatar
              reptile={activity.reptile}
              size="sm"
            />

            <div className="flex-1 min-w-0">
              <div className="text-xs text-foreground truncate">
                {activity.description}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {activity.reptile_name} · {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
              </div>
            </div>

            {activity.quantity && (
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {activity.quantity}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentActivityWidget;
