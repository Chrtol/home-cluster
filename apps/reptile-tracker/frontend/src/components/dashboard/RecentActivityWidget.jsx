import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Utensils, Droplets, Scale, Activity } from 'lucide-react';
import ReptileAvatar from '../ReptileAvatar';

/**
 * RecentActivityWidget - Compact recent activity list
 *
 * Shows recent feedings, mistings, weighings, and health events
 * in a compact format suitable for dashboard widgets.
 *
 * Props:
 * - config: { itemCount: number (default 5) }
 * - size: Widget size determines item count if not in config
 */
const RecentActivityWidget = ({ config = {}, size = 'small' }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Determine item count based on widget size
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

      // Fetch recent activities from all sources
      const [feedingsRes, mistingsRes, weighingsRes, healthRes] = await Promise.all([
        axios.get('/api/feedings', { params: { limit: itemCount } }),
        axios.get('/api/mistings', { params: { limit: itemCount } }),
        axios.get('/api/weighings', { params: { limit: itemCount } }),
        axios.get('/api/health-events', { params: { limit: itemCount } })
      ]);

      const feedings = (feedingsRes.data || []).map(f => ({
        type: 'feeding',
        icon: Utensils,
        reptile_id: f.reptile_id,
        reptile_name: f.reptile_name,
        species: f.species,
        timestamp: f.fed_at,
        description: `Fed ${f.food_item || 'food'}`,
        quantity: f.quantity,
        details: f.notes
      }));

      const mistings = (mistingsRes.data || []).map(m => ({
        type: 'misting',
        icon: Droplets,
        reptile_id: m.reptile_id,
        reptile_name: m.reptile_name,
        species: m.species,
        timestamp: m.misted_at,
        description: 'Misted',
        quantity: m.duration ? `${m.duration} sec` : null,
        details: m.notes
      }));

      const weighings = (weighingsRes.data || []).map(w => ({
        type: 'weighing',
        icon: Scale,
        reptile_id: w.reptile_id,
        reptile_name: w.reptile_name,
        species: w.species,
        timestamp: w.measured_at,
        description: 'Weighed',
        quantity: `${w.weight}g`,
        details: w.notes
      }));

      const healthEvents = (healthRes.data || []).map(h => ({
        type: 'health',
        icon: Activity,
        reptile_id: h.reptile_id,
        reptile_name: h.reptile_name,
        species: h.species,
        timestamp: h.event_date,
        description: h.event_type,
        quantity: null,
        details: h.description
      }));

      // Combine and sort by timestamp
      const combined = [...feedings, ...mistings, ...weighings, ...healthEvents];
      combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Take only itemCount
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
      <div className="bg-card rounded-lg shadow-sm border border-border p-4">
        <div className="text-center text-muted-foreground">
          Loading recent activity...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-4">
        <div className="text-center text-red-600 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground">Recent Activity</h2>
        </div>
        <div className="text-center text-muted-foreground text-sm">
          No recent activity
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground">Recent Activity</h2>
        <Link
          to="/activity"
          className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="space-y-2">
        {activities.map((activity, index) => {
          const Icon = activity.icon;
          return (
            <div
              key={`${activity.type}-${activity.timestamp}-${index}`}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-700/50 transition-colors"
            >
              {/* Avatar */}
              <ReptileAvatar
                name={activity.reptile_name}
                species={activity.species}
                size="w-6 h-6"
                className="flex-shrink-0"
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Description */}
                <div className="text-xs text-foreground truncate">
                  {activity.description}
                </div>

                {/* Reptile name + time */}
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <span className="truncate">{activity.reptile_name}</span>
                  <span className="text-gray-400">·</span>
                  <span className="whitespace-nowrap">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {/* Quantity */}
              {activity.quantity && (
                <div className="text-xs text-gray-500 flex-shrink-0">
                  {activity.quantity}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentActivityWidget;
