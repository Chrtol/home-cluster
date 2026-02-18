import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Utensils, Scale, Activity, HeartPulse, Droplets, ChevronLeft, Ruler } from 'lucide-react';
import ReptileAvatar from '../ReptileAvatar';
import EmptyState from '../EmptyState';

/**
 * RecentActivityWidget - Compact recent activity list with hierarchical filters
 *
 * Shows recent feedings, mistings, and health records with category/subcategory filtering.
 * Top-level categories: Feeding, Misting, Health
 * Subcategories appear when clicking a category that has them.
 *
 * Props:
 * - config: { itemCount: number (default 5) }
 * - size: Widget size determines item count if not in config
 */
const RecentActivityWidget = ({ config = {}, size = 'small' }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Filter state: null = all, 'feeding'/'misting'/'health' = category, or 'health:bathing' = subcategory
  const [activeFilter, setActiveFilter] = useState(null);

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

  // Category color schemes - subtle, muted tones matching app theme
  const categoryColors = {
    feeding: {
      bg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
      text: 'text-emerald-700 dark:text-emerald-400',
      border: 'border-emerald-500/30 dark:border-emerald-500/40',
      activeBg: 'bg-emerald-600',
      activeText: 'text-white',
      icon: Utensils
    },
    misting: {
      bg: 'bg-sky-500/15 dark:bg-sky-500/20',
      text: 'text-sky-700 dark:text-sky-400',
      border: 'border-sky-500/30 dark:border-sky-500/40',
      activeBg: 'bg-sky-600',
      activeText: 'text-white',
      icon: Droplets
    },
    health: {
      bg: 'bg-rose-500/15 dark:bg-rose-500/20',
      text: 'text-rose-700 dark:text-rose-400',
      border: 'border-rose-500/30 dark:border-rose-500/40',
      activeBg: 'bg-rose-600',
      activeText: 'text-white',
      icon: HeartPulse
    }
  };

  // Subcategory labels for health
  const healthSubcategoryLabels = {
    'bathing': 'Bathing',
    'shedding': 'Shedding',
    'shedding_check': 'Shedding Check',
    'brumation': 'Brumation',
    'brumation_check': 'Brumation Check',
    'observation': 'Observation',
    'vet_visit': 'Vet Visit',
    'medication': 'Medication',
    'bowel_movement': 'Bowel',
    'weight': 'Weight',
    'measurement': 'Measurement'
  };

  // Subcategory labels for feeding (food categories)
  const feedingSubcategoryLabels = {
    'insect': 'Insects',
    'worms': 'Worms',
    'vegetable': 'Veggies',
    'fruit': 'Fruit',
    'prepared': 'Prepared',
    'frozen_animal': 'Frozen',
    'live_rodent': 'Live',
    'fish_seafood': 'Fish',
    'eggs': 'Eggs',
    'other': 'Other'
  };

  useEffect(() => {
    fetchRecentActivity();
  }, [itemCount]);

  const fetchRecentActivity = async () => {
    try {
      setLoading(true);
      setError(null);

      const [feedingsRes, weighingsRes, healthRes, mistingsRes, measurementsRes, reptilesRes] = await Promise.all([
        axios.get('/api/feedings', { params: { limit: itemCount * 3 } }),
        axios.get('/api/weight/dashboard'),
        axios.get('/api/health', { params: { limit: itemCount * 3 } }),
        axios.get('/api/misting', { params: { limit: itemCount * 3 } }),
        axios.get('/api/measurements/dashboard', { params: { limit: itemCount * 3 } }),
        axios.get('/api/reptiles')
      ]);

      // Create reptile lookup map
      const reptilesMap = {};
      const reptilesData = Array.isArray(reptilesRes.data) ? reptilesRes.data : [];
      reptilesData.forEach(r => {
        reptilesMap[r.id] = {
          id: r.id,
          name: r.name,
          avatar_photo_url: r.avatar_photo_url,
          avatar_border_color: r.avatar_border_color
        };
      });

      const feedingsData = Array.isArray(feedingsRes.data) ? feedingsRes.data : [];
      const feedings = feedingsData.map(f => {
        const foodItems = f.foods || [];
        const totalItems = foodItems.reduce((sum, food) => sum + (food.quantity || 1), 0);
        const foodNames = foodItems.map(food => food.name).filter(Boolean).join(', ');
        // Get primary food category from first food item
        const primaryCategory = foodItems[0]?.category || 'other';
        const summary = foodNames || 'Food items';

        return {
          type: 'feeding',
          category: 'feeding',
          subcategory: primaryCategory,
          icon: Utensils,
          reptile_id: f.reptile_id,
          reptile_name: f.reptile?.name || reptilesMap[f.reptile_id]?.name || 'Unknown',
          reptile: reptilesMap[f.reptile_id] || (f.reptile ? {
            id: f.reptile.id,
            name: f.reptile.name,
            avatar_photo_url: f.reptile.avatar_photo_url,
            avatar_border_color: f.reptile.avatar_border_color
          } : null),
          timestamp: f.fed_at,
          summary,
          prominentValue: totalItems > 0 ? `×${totalItems}` : null,
          detailLink: `/feed/${f.id}`
        };
      });

      const mistingsData = Array.isArray(mistingsRes.data) ? mistingsRes.data : [];
      const mistings = mistingsData.map(m => {
        const reptileFromMap = reptilesMap[m.reptile_id];
        return {
          type: 'misting',
          category: 'misting',
          subcategory: null,
          icon: Droplets,
          reptile_id: m.reptile_id,
          reptile_name: reptileFromMap?.name || m.reptile?.name || 'Unknown',
          reptile: reptileFromMap || {
            id: m.reptile_id,
            name: m.reptile?.name,
            avatar_photo_url: null,
            avatar_border_color: null
          },
          timestamp: m.misted_at,
          summary: 'Misted',
          prominentValue: null,
          detailLink: `/misting/${m.id}`
        };
      });

      const weighingsData = Array.isArray(weighingsRes.data) ? weighingsRes.data : [];
      const weighings = weighingsData
        .sort((a, b) => new Date(b.measured_at) - new Date(a.measured_at))
        .slice(0, itemCount * 3)
        .map(w => {
          const reptileFromMap = reptilesMap[w.reptile_id];
          return {
            type: 'health',
            category: 'health',
            subcategory: 'weight',
            icon: Scale,
            reptile_id: w.reptile_id,
            reptile_name: reptileFromMap?.name || w.reptile_name || 'Unknown',
            reptile: reptileFromMap || {
              id: w.reptile_id,
              name: w.reptile_name,
              avatar_photo_url: null,
              avatar_border_color: null
            },
            timestamp: w.measured_at,
            summary: 'Weight recorded',
            prominentValue: `${w.weight_grams}g`,
            detailLink: `/health-log/weight/${w.id}`
          };
        });

      const healthData = Array.isArray(healthRes.data) ? healthRes.data : [];
      const healthRecords = healthData.map(h => {
        const reptileFromMap = reptilesMap[h.reptile_id];
        const recordTypeLabels = {
          'observation': 'Observation',
          'vet_visit': 'Vet Visit',
          'medication': 'Medication',
          'shedding': 'Shedding',
          'shedding_check': 'Shedding Check',
          'brumation': 'Brumation',
          'brumation_check': 'Brumation Check',
          'bowel_movement': 'Bowel Movement',
          'bathing': 'Bathing'
        };
        const summary = h.title || recordTypeLabels[h.record_type] || 'Health Record';

        return {
          type: 'health',
          category: 'health',
          subcategory: h.record_type || 'observation',
          icon: HeartPulse,
          reptile_id: h.reptile_id,
          reptile_name: reptileFromMap?.name || h.reptile?.name || 'Unknown',
          reptile: reptileFromMap || {
            id: h.reptile_id,
            name: h.reptile?.name,
            avatar_photo_url: h.reptile?.avatar_photo_url,
            avatar_border_color: h.reptile?.avatar_border_color
          },
          timestamp: h.date || h.created_at,
          summary,
          prominentValue: null,
          detailLink: `/health-log/health/${h.id}`
        };
      });

      const measurementsData = Array.isArray(measurementsRes.data) ? measurementsRes.data : [];
      const measurements = measurementsData.map(m => {
        const reptileFromMap = reptilesMap[m.reptile_id];
        const measurementTypeLabels = {
          'svl': 'SVL',
          'total_length': 'Total Length',
          'shell_length': 'Shell Length',
          'humidity': 'Humidity',
          'temperature': 'Temperature',
          'custom': m.custom_label || 'Custom'
        };
        const typeLabel = measurementTypeLabels[m.measurement_type] || m.measurement_type;

        return {
          type: 'health',
          category: 'health',
          subcategory: 'measurement',
          icon: Ruler,
          reptile_id: m.reptile_id,
          reptile_name: reptileFromMap?.name || m.reptile_name || 'Unknown',
          reptile: reptileFromMap || {
            id: m.reptile_id,
            name: m.reptile_name,
            avatar_photo_url: m.avatar_photo_url,
            avatar_border_color: null
          },
          timestamp: m.measured_at,
          summary: typeLabel,
          prominentValue: `${m.value}${m.unit}`,
          detailLink: `/health-log/measurement/${m.id}`
        };
      });

      const combined = [...feedings, ...mistings, ...weighings, ...healthRecords, ...measurements];
      combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setActivities(combined);
    } catch (err) {
      console.error('Failed to fetch recent activity:', err);
      setError('Failed to load recent activity');
    } finally {
      setLoading(false);
    }
  };

  // Get unique subcategories present in activities for the active category
  const getAvailableSubcategories = (category) => {
    const subcats = new Set();
    activities.forEach(a => {
      if (a.category === category && a.subcategory) {
        subcats.add(a.subcategory);
      }
    });
    return Array.from(subcats);
  };

  // Filter activities based on active filter
  const filteredActivities = useMemo(() => {
    if (!activeFilter) {
      return activities.slice(0, itemCount);
    }

    // Check if it's a subcategory filter (contains ':')
    if (activeFilter.includes(':')) {
      const [cat, subcat] = activeFilter.split(':');
      return activities
        .filter(a => a.category === cat && a.subcategory === subcat)
        .slice(0, itemCount);
    }

    // Top-level category filter
    return activities
      .filter(a => a.category === activeFilter)
      .slice(0, itemCount);
  }, [activities, activeFilter, itemCount]);

  // Get current filter level and parent category
  const currentCategory = activeFilter?.includes(':') ? activeFilter.split(':')[0] : activeFilter;
  const isSubcategoryFilter = activeFilter?.includes(':');

  // Category badge component
  const CategoryBadge = ({ category, subcategory, small = false }) => {
    const colors = categoryColors[category];
    if (!colors) return null;

    const label = subcategory
      ? (category === 'health' ? healthSubcategoryLabels[subcategory] : feedingSubcategoryLabels[subcategory]) || subcategory
      : category.charAt(0).toUpperCase() + category.slice(1);

    return (
      <span
        className={`inline-flex items-center gap-0.5 ${small ? 'px-1 py-0.5 text-[10px]' : 'px-1.5 py-0.5 text-xs'} rounded font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
      >
        {label}
      </span>
    );
  };

  // Filter button component
  const FilterButton = ({ category, subcategory = null, count }) => {
    const colors = categoryColors[category];
    const filterKey = subcategory ? `${category}:${subcategory}` : category;
    const isActive = activeFilter === filterKey;
    const Icon = colors?.icon;

    const label = subcategory
      ? (category === 'health' ? healthSubcategoryLabels[subcategory] : feedingSubcategoryLabels[subcategory]) || subcategory
      : category.charAt(0).toUpperCase() + category.slice(1);

    return (
      <button
        onClick={() => setActiveFilter(isActive ? null : filterKey)}
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium transition-colors ${
          isActive
            ? `${colors.activeBg} ${colors.activeText}`
            : `${colors.bg} ${colors.text} border ${colors.border} hover:opacity-80`
        }`}
      >
        {!subcategory && Icon && <Icon size={12} />}
        {label}
        {count > 0 && <span className="opacity-70">({count})</span>}
      </button>
    );
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
        <EmptyState
          icon={Activity}
          title="No recent activity"
          message="Start tracking feedings, mistings, and health records to see them here"
          compact={true}
        />
      </div>
    );
  }

  // Count activities by category
  const categoryCounts = {
    feeding: activities.filter(a => a.category === 'feeding').length,
    misting: activities.filter(a => a.category === 'misting').length,
    health: activities.filter(a => a.category === 'health').length
  };

  return (
    <div className="bg-card rounded-lg border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
        <Link
          to="/activity"
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          View all
        </Link>
      </div>

      {/* Filter buttons */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {/* Back button when in subcategory view */}
        {currentCategory && (
          <button
            onClick={() => setActiveFilter(isSubcategoryFilter ? currentCategory : null)}
            className="inline-flex items-center gap-0.5 px-1.5 py-1 text-xs rounded-full font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            <ChevronLeft size={12} />
            {isSubcategoryFilter ? currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1) : 'All'}
          </button>
        )}

        {/* Show subcategories if a category is selected, otherwise show top-level */}
        {currentCategory && !isSubcategoryFilter ? (
          // Subcategory filters
          getAvailableSubcategories(currentCategory).map(subcat => {
            const count = activities.filter(a => a.category === currentCategory && a.subcategory === subcat).length;
            return (
              <FilterButton
                key={`${currentCategory}:${subcat}`}
                category={currentCategory}
                subcategory={subcat}
                count={count}
              />
            );
          })
        ) : !currentCategory ? (
          // Top-level category filters
          <>
            {categoryCounts.feeding > 0 && (
              <FilterButton category="feeding" count={categoryCounts.feeding} />
            )}
            {categoryCounts.misting > 0 && (
              <FilterButton category="misting" count={categoryCounts.misting} />
            )}
            {categoryCounts.health > 0 && (
              <FilterButton category="health" count={categoryCounts.health} />
            )}
          </>
        ) : null}
      </div>

      {/* Activity list */}
      <div className="space-y-1">
        {filteredActivities.map((activity, index) => {
          const Icon = activity.icon;
          const colors = categoryColors[activity.category];

          return (
            <Link
              key={`${activity.type}-${activity.timestamp}-${index}`}
              to={activity.detailLink}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <ReptileAvatar
                reptile={activity.reptile}
                size="sm"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {activity.reptile_name}
                  </span>
                  <CategoryBadge category={activity.category} subcategory={activity.subcategory} small />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground truncate">
                    {activity.summary}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                    · {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {activity.prominentValue && (
                <span className={`flex-shrink-0 text-xs font-semibold tabular-nums ${colors?.text || 'text-primary'}`}>
                  {activity.prominentValue}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {filteredActivities.length === 0 && activeFilter && (
        <div className="text-center text-muted-foreground text-xs py-4">
          No activities in this category
        </div>
      )}
    </div>
  );
};

export default RecentActivityWidget;
