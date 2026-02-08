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
      // Note: /api/weight/dashboard returns all weight logs, we'll filter client-side
      const [feedingsRes, mistingsRes, weighingsRes, healthRes] = await Promise.all([
        axios.get('/api/feedings', { params: { limit: itemCount } }),
        axios.get('/api/mistings', { params: { limit: itemCount } }),
        axios.get('/api/weight/dashboard'),
        axios.get('/api/health-events', { params: { limit: itemCount } })
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

      const mistings = (mistingsRes.data || []).map(m => ({
        type: 'misting',
        icon: Droplets,
        reptile_id: m.reptile_id,
        reptile_name: m.reptile_name,
        reptile: { id: m.reptile_id, name: m.reptile_name, avatar_photo_url: m.avatar_photo_url },
        timestamp: m.misted_at,
        description: 'Misted',
        quantity: m.duration ? `${m.duration}s` : null,
        details: m.notes
      }));

      // Weight dashboard returns all data, sort by date and take most recent
      const allWeighings = (weighingsRes.data || [])
        .sort((a, b) => new Date(b.measured_at) - new Date(a.measured_at))
        .slice(0, itemCount);

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

      const healthEvents = (healthRes.data || []).map(h => ({
        type: 'health',
        icon: Activity,
        reptile_id: h.reptile_id,
        reptile_name: h.reptile_name,
        reptile: { id: h.reptile_id, name: h.reptile_name, avatar_photo_url: h.avatar_photo_url },
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
      <div className="bg-surface-800 rounded-xl border border-surface-600/50 p-3">
        <div className="text-center text-gray-400 text-sm">
          Loading recent activity...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface-800 rounded-xl border border-surface-600/50 p-3">
        <div className="text-center text-red-400 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-surface-800 rounded-xl border border-surface-600/50 p-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
        </div>
        <div className="text-center text-gray-400 text-sm">
          No recent activity
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-600/50 p-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
        <Link
          to="/activity"
          className="text-xs text-accent-500 hover:text-accent-400"
        >
          View all
        </Link>
      </div>

      <div className="space-y-2">
        {activities.map((activity, index) => (
          <div
            key={`${activity.type}-${activity.timestamp}-${index}`}
            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-700/50"
          >
            {/* Avatar */}
            <ReptileAvatar
              reptile={activity.reptile}
              size="sm"
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Description */}
              <div className="text-xs text-gray-300 truncate">
                {activity.description}
              </div>

              {/* Reptile name + time */}
              <div className="text-[10px] text-gray-500">
                {activity.reptile_name} · {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
              </div>
            </div>

            {/* Quantity */}
            {activity.quantity && (
              <span className="text-xs text-gray-500 flex-shrink-0">
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
