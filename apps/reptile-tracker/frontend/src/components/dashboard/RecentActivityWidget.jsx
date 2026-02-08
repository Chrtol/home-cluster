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

      const feedings = (feedingsRes.data || []).map(f => {
        // Build summary from foods array
        const foodItems = f.foods || [];
        const totalItems = foodItems.reduce((sum, food) => sum + (food.quantity || 1), 0);
        const foodNames = foodItems.map(food => food.name).filter(Boolean).join(', ');
        const supplementNames = f.supplements && f.supplements.length > 0
          ? f.supplements.map(s => s.name).join(', ')
          : '';
        const summary = foodNames || 'Food items';
        const supplementText = supplementNames ? ` + ${supplementNames}` : '';

        return {
          type: 'feeding',
          icon: Utensils,
          iconColor: 'text-primary',
          reptile_id: f.reptile_id,
          reptile_name: f.reptile?.name || 'Unknown',
          reptile: f.reptile ? {
            id: f.reptile.id,
            name: f.reptile.name,
            avatar_photo_url: f.reptile.avatar_photo_url
          } : null,
          timestamp: f.fed_at,
          summary: summary + supplementText,
          prominentValue: totalItems > 0 ? `×${totalItems}` : null,
          detailLink: `/feed/${f.id}`,
          notes: f.notes
        };
      });

      const allWeighings = (weighingsRes.data || [])
        .sort((a, b) => new Date(b.measured_at) - new Date(a.measured_at))
        .slice(0, itemCount * 2);

      const weighings = allWeighings.map(w => ({
        type: 'weighing',
        icon: Scale,
        iconColor: 'text-amber-500',
        reptile_id: w.reptile_id,
        reptile_name: w.reptile_name || 'Unknown',
        reptile: {
          id: w.reptile_id,
          name: w.reptile_name,
          avatar_photo_url: w.avatar_photo_url
        },
        timestamp: w.measured_at,
        summary: 'Weight recorded',
        prominentValue: `${w.weight_grams}g`,
        detailLink: `/health-log/weight/${w.id}`,
        notes: w.notes
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
        <div className="text-center text-muted-foreground text-sm py-4">
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
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          View all
        </Link>
      </div>

      <div className="space-y-1.5">
        {activities.map((activity, index) => {
          const Icon = activity.icon;

          return (
            <Link
              key={`${activity.type}-${activity.timestamp}-${index}`}
              to={activity.detailLink}
              className={`flex items-center gap-2 p-2 rounded-lg border border-transparent hover:bg-muted/50 hover:border-border/50 transition-colors group ${index % 2 === 0 ? 'bg-muted/30' : ''}`}
            >
              <ReptileAvatar
                reptile={activity.reptile}
                size="sm"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 mb-0.5">
                  <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                    {activity.reptile_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon size={12} className={`flex-shrink-0 ${activity.iconColor}`} />
                  <span className="text-xs text-muted-foreground truncate">
                    {activity.summary}
                  </span>
                </div>
              </div>

              {activity.prominentValue && (
                <span className="flex-shrink-0 text-sm font-semibold text-primary tabular-nums">
                  {activity.prominentValue}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default RecentActivityWidget;
