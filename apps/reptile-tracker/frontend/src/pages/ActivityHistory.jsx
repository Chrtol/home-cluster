import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Utensils, Droplets, Activity as ActivityIcon, Scale, Calendar, Heart, Snowflake, Ruler, HeartPulse, ChevronLeft } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ReptileAvatar from '../components/ReptileAvatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const PAGE_SIZE = 25;

// Category color schemes - subtle, muted tones matching app theme
const categoryColors = {
  feeding: {
    bg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/30 dark:border-emerald-500/40',
    activeBg: 'bg-emerald-600 hover:bg-emerald-600/90',
    icon: Utensils
  },
  misting: {
    bg: 'bg-sky-500/15 dark:bg-sky-500/20',
    text: 'text-sky-700 dark:text-sky-400',
    border: 'border-sky-500/30 dark:border-sky-500/40',
    activeBg: 'bg-sky-600 hover:bg-sky-600/90',
    icon: Droplets
  },
  health: {
    bg: 'bg-rose-500/15 dark:bg-rose-500/20',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-500/30 dark:border-rose-500/40',
    activeBg: 'bg-rose-600 hover:bg-rose-600/90',
    icon: HeartPulse
  }
};

// Subcategory labels for health
const healthSubcategoryLabels = {
  'bathing': 'Bathing',
  'shedding': 'Shedding',
  'shedding_check': 'Shedding Check',
  'observation': 'Observation',
  'vet_visit': 'Vet Visit',
  'medication': 'Medication',
  'bowel_movement': 'Bowel',
  'weight': 'Weight',
  'measurement': 'Measurement',
  'brumation': 'Brumation',
  'brumation_check': 'Brumation Check'
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

// Category badge component
const CategoryBadge = ({ category, subcategory }) => {
  const colors = categoryColors[category];
  if (!colors) return null;

  const label = subcategory
    ? (category === 'health' ? healthSubcategoryLabels[subcategory] : feedingSubcategoryLabels[subcategory]) || subcategory
    : category.charAt(0).toUpperCase() + category.slice(1);

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
    >
      {label}
    </span>
  );
};

// Filter button component for hierarchical filtering
const FilterButton = ({ category, subcategory = null, count, isActive, onClick, colors }) => {
  const Icon = colors?.icon;
  const label = subcategory
    ? (category === 'health' ? healthSubcategoryLabels[subcategory] : feedingSubcategoryLabels[subcategory]) || subcategory
    : category.charAt(0).toUpperCase() + category.slice(1);

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
        isActive
          ? `${colors.activeBg} text-white`
          : `${colors.bg} ${colors.text} border ${colors.border} hover:opacity-80`
      }`}
    >
      {!subcategory && Icon && <Icon size={12} />}
      {label}
      {count > 0 && <span className="opacity-70">({count})</span>}
    </button>
  );
};

const ActivityHistory = () => {
  const [activities, setActivities] = useState([]);
  const [reptiles, setReptiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hierarchical filter state: null = all, 'feeding'/'misting'/'health' = category, 'health:bathing' = subcategory
  const [activeFilter, setActiveFilter] = useState(null);
  // Additional filters
  const [reptileFilter, setReptileFilter] = useState(null);
  const [dateRange, setDateRange] = useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch reptiles first to get the lookup map
      const reptilesRes = await axios.get('/api/reptiles');
      const reptilesList = reptilesRes.data || [];
      setReptiles(reptilesList);

      // Create reptile lookup map
      const reptilesMap = {};
      reptilesList.forEach(r => {
        reptilesMap[r.id] = {
          id: r.id,
          name: r.name,
          avatar_photo_url: r.avatar_photo_url,
          avatar_border_color: r.avatar_border_color
        };
      });

      // Fetch all data types in parallel
      const [feedingsRes, weighingsRes, mistingsRes] = await Promise.all([
        axios.get('/api/feedings'),
        axios.get('/api/weight/dashboard'),
        axios.get('/api/misting')
      ]);

      // Fetch health records and measurements per reptile
      const healthAndMeasurements = await Promise.all(
        reptilesList.map(async (reptile) => {
          const [healthRes, measurementRes] = await Promise.all([
            axios.get(`/api/health/reptile/${reptile.id}`).catch(() => ({ data: [] })),
            axios.get(`/api/measurements/reptile/${reptile.id}`).catch(() => ({ data: [] }))
          ]);
          return {
            reptileId: reptile.id,
            health: healthRes.data || [],
            measurements: measurementRes.data || []
          };
        })
      );

      // Process feedings
      const feedings = (feedingsRes.data || []).map(f => {
        const foodItems = f.foods || [];
        const totalItems = foodItems.reduce((sum, food) => sum + (food.quantity || 1), 0);
        const foodNames = foodItems.map(food => food.name).filter(Boolean).join(', ');
        const supplementNames = f.supplements && f.supplements.length > 0
          ? f.supplements.map(s => s.name).join(', ')
          : '';
        const summary = foodNames || 'Food items';
        const supplementText = supplementNames ? ` + ${supplementNames}` : '';
        // Get primary food category from first food item
        const primaryCategory = foodItems[0]?.category || 'other';

        return {
          type: 'feeding',
          category: 'feeding',
          subcategory: primaryCategory,
          icon: Utensils,
          iconColor: 'text-emerald-600',
          reptile_id: f.reptile_id,
          reptile_name: f.reptile?.name || reptilesMap[f.reptile_id]?.name || 'Unknown',
          reptile: reptilesMap[f.reptile_id] || (f.reptile ? {
            id: f.reptile.id,
            name: f.reptile.name,
            avatar_photo_url: f.reptile.avatar_photo_url,
            avatar_border_color: f.reptile.avatar_border_color
          } : null),
          timestamp: f.fed_at,
          summary: summary + supplementText,
          prominentValue: totalItems > 0 ? `×${totalItems}` : null,
          detailLink: `/feed/${f.id}`,
          notes: f.notes
        };
      });

      // Process weighings
      const weighings = (weighingsRes.data || []).map(w => {
        const reptileFromMap = reptilesMap[w.reptile_id];
        return {
          type: 'weight',
          category: 'health',
          subcategory: 'weight',
          icon: Scale,
          iconColor: 'text-rose-600',
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
          detailLink: `/health-log/weight/${w.id}`,
          notes: w.notes
        };
      });

      // Process health records (shedding, brumation, observations, bathing, etc.)
      const healthRecords = healthAndMeasurements.flatMap(({ reptileId, health }) => {
        const reptileFromMap = reptilesMap[reptileId];
        return health.map(h => {
          // Determine type and summary based on record_type and event_type
          let type = 'health';
          let icon = HeartPulse;
          let iconColor = 'text-rose-600';
          let summary = h.title || 'Health record';
          let subcategory = h.record_type || 'observation';

          if (h.record_type === 'shedding') {
            type = 'shedding';
            icon = Heart;
            iconColor = 'text-rose-600';
            const subtype = h.event_type === 'start' ? 'Started' : 'Complete';
            summary = `Shedding ${subtype}`;
            subcategory = 'shedding';
          } else if (h.record_type === 'brumation') {
            type = 'brumation';
            icon = Snowflake;
            iconColor = 'text-rose-600';
            const subtype = h.event_type === 'start' ? 'Started' : 'Ended';
            summary = `Brumation ${subtype}`;
            subcategory = 'brumation';
          } else if (h.record_type === 'bathing') {
            summary = 'Bathing';
            subcategory = 'bathing';
          }

          return {
            type,
            category: 'health',
            subcategory,
            icon,
            iconColor,
            reptile_id: reptileId,
            reptile_name: reptileFromMap?.name || 'Unknown',
            reptile: reptileFromMap,
            timestamp: h.date,
            summary,
            prominentValue: null,
            detailLink: `/health-log/health/${h.id}`,
            notes: h.description
          };
        });
      });

      // Measurement type friendly names
      const measurementTypeNames = {
        svl: 'Snout-Vent Length (SVL)',
        total_length: 'Total Length',
        shell_length: 'Shell Length',
        head_width: 'Head Width',
        tail_length: 'Tail Length',
        humidity: 'Humidity',
        temperature: 'Temperature'
      };

      // Process measurements
      const measurements = healthAndMeasurements.flatMap(({ reptileId, measurements: measurementData }) => {
        const reptileFromMap = reptilesMap[reptileId];
        return measurementData.map(m => {
          // Format measurement type label
          let typeLabel = 'Measurement';
          if (m.measurement_type === 'custom' && m.custom_label) {
            typeLabel = m.custom_label;
          } else if (m.measurement_type && measurementTypeNames[m.measurement_type]) {
            typeLabel = measurementTypeNames[m.measurement_type];
          } else if (m.measurement_type) {
            // Fallback: convert snake_case to Title Case
            typeLabel = m.measurement_type
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          }

          return {
            type: 'measurement',
            category: 'health',
            subcategory: 'measurement',
            icon: Ruler,
            iconColor: 'text-rose-600',
            reptile_id: reptileId,
            reptile_name: reptileFromMap?.name || 'Unknown',
            reptile: reptileFromMap,
            timestamp: m.measured_at,
            summary: typeLabel,
            prominentValue: `${m.value} ${m.unit}`,
            detailLink: `/health-log/measurement/${m.id}`,
            notes: m.notes
          };
        });
      });

      // Process mistings
      const mistings = (mistingsRes.data || []).map(m => {
        const reptileFromMap = reptilesMap[m.reptile_id];
        return {
          type: 'misting',
          category: 'misting',
          subcategory: null,
          icon: Droplets,
          iconColor: 'text-blue-600',
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
          detailLink: `/misting/${m.id}`,
          notes: m.notes
        };
      });

      // Combine and sort
      const combined = [...feedings, ...mistings, ...weighings, ...healthRecords, ...measurements];
      combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setActivities(combined);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
      setError('Failed to load activity history');
    } finally {
      setLoading(false);
    }
  };

  // Get unique subcategories present in activities for a category
  const getAvailableSubcategories = (category) => {
    const subcats = new Set();
    activities.forEach(a => {
      if (a.category === category && a.subcategory) {
        subcats.add(a.subcategory);
      }
    });
    return Array.from(subcats);
  };

  // Get current filter level and parent category
  const currentCategory = activeFilter?.includes(':') ? activeFilter.split(':')[0] : activeFilter;
  const isSubcategoryFilter = activeFilter?.includes(':');

  // Count activities by category
  const categoryCounts = useMemo(() => ({
    feeding: activities.filter(a => a.category === 'feeding').length,
    misting: activities.filter(a => a.category === 'misting').length,
    health: activities.filter(a => a.category === 'health').length
  }), [activities]);

  // Filter activities based on hierarchical filter
  const getFilteredActivities = () => {
    let filtered = [...activities];

    // Apply hierarchical category/subcategory filter
    if (activeFilter) {
      if (activeFilter.includes(':')) {
        // Subcategory filter
        const [cat, subcat] = activeFilter.split(':');
        filtered = filtered.filter(a => a.category === cat && a.subcategory === subcat);
      } else {
        // Category filter
        filtered = filtered.filter(a => a.category === activeFilter);
      }
    }

    // Filter by reptile
    if (reptileFilter) {
      filtered = filtered.filter(a => a.reptile_id === parseInt(reptileFilter));
    }

    // Filter by date range
    if (dateRange !== 'all') {
      const now = new Date();
      const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
      const days = daysMap[dateRange];
      if (days) {
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(a => new Date(a.timestamp) >= cutoff);
      }
    }

    return filtered;
  };

  const filteredActivities = getFilteredActivities();
  const totalPages = Math.ceil(filteredActivities.length / PAGE_SIZE);
  const paginatedActivities = filteredActivities.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Generate pagination items
  const getPaginationItems = () => {
    const items = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        items.push(i);
      }
    } else {
      // Show first, last, current, and neighbors with ellipsis
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) items.push(i);
        items.push('ellipsis');
        items.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        items.push(1);
        items.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) items.push(i);
      } else {
        items.push(1);
        items.push('ellipsis');
        items.push(currentPage - 1);
        items.push(currentPage);
        items.push(currentPage + 1);
        items.push('ellipsis');
        items.push(totalPages);
      }
    }

    return items;
  };

  if (loading) {
    return <LoadingState message="Loading activity history..." />;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Activity History"
        subtitle="View and filter all reptile activities including feedings, misting, health events, weight, shedding, brumation, and measurements"
      />

      {/* Filters Section */}
      <div className="bg-card rounded-lg border border-border p-4 mb-6">
        {/* Hierarchical Activity Type Filters */}
        <div className="mb-4">
          <label className="text-sm font-medium text-foreground mb-2 block">
            Activity Types
          </label>
          <div className="flex flex-wrap gap-2">
            {/* Back button when in category or subcategory view */}
            {currentCategory && (
              <button
                onClick={() => {
                  setActiveFilter(isSubcategoryFilter ? currentCategory : null);
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-0.5 px-2 py-1 text-xs rounded-full font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <ChevronLeft size={12} />
                {isSubcategoryFilter ? currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1) : 'All'}
              </button>
            )}

            {/* Show subcategories if a category is selected AND has subcategories, otherwise show top-level */}
            {currentCategory && !isSubcategoryFilter && getAvailableSubcategories(currentCategory).length > 0 ? (
              // Subcategory filters for the selected category
              getAvailableSubcategories(currentCategory).map(subcat => {
                const count = activities.filter(a => a.category === currentCategory && a.subcategory === subcat).length;
                const filterKey = `${currentCategory}:${subcat}`;
                return (
                  <FilterButton
                    key={filterKey}
                    category={currentCategory}
                    subcategory={subcat}
                    count={count}
                    isActive={activeFilter === filterKey}
                    onClick={() => {
                      setActiveFilter(activeFilter === filterKey ? currentCategory : filterKey);
                      setCurrentPage(1);
                    }}
                    colors={categoryColors[currentCategory]}
                  />
                );
              })
            ) : !currentCategory || getAvailableSubcategories(currentCategory).length === 0 ? (
              // Top-level category filters (also shown when selected category has no subcategories)
              <>
                {categoryCounts.feeding > 0 && (
                  <FilterButton
                    category="feeding"
                    count={categoryCounts.feeding}
                    isActive={activeFilter === 'feeding'}
                    onClick={() => {
                      setActiveFilter(activeFilter === 'feeding' ? null : 'feeding');
                      setCurrentPage(1);
                    }}
                    colors={categoryColors.feeding}
                  />
                )}
                {categoryCounts.misting > 0 && (
                  <FilterButton
                    category="misting"
                    count={categoryCounts.misting}
                    isActive={activeFilter === 'misting'}
                    onClick={() => {
                      setActiveFilter(activeFilter === 'misting' ? null : 'misting');
                      setCurrentPage(1);
                    }}
                    colors={categoryColors.misting}
                  />
                )}
                {categoryCounts.health > 0 && (
                  <FilterButton
                    category="health"
                    count={categoryCounts.health}
                    isActive={activeFilter === 'health'}
                    onClick={() => {
                      setActiveFilter(activeFilter === 'health' ? null : 'health');
                      setCurrentPage(1);
                    }}
                    colors={categoryColors.health}
                  />
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Reptile and Date Range Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Reptile Filter */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Reptile
            </label>
            <Select
              value={reptileFilter || 'all'}
              onValueChange={(value) => {
                setReptileFilter(value === 'all' ? null : value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All reptiles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reptiles</SelectItem>
                {reptiles.map(reptile => (
                  <SelectItem key={reptile.id} value={reptile.id.toString()}>
                    {reptile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Date Range
            </label>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={dateRange === '7d' ? 'default' : 'outline'}
                className="cursor-pointer transition-colors"
                onClick={() => {
                  setDateRange('7d');
                  setCurrentPage(1);
                }}
              >
                <Calendar className="w-3 h-3 mr-1" />
                7 days
              </Badge>
              <Badge
                variant={dateRange === '30d' ? 'default' : 'outline'}
                className="cursor-pointer transition-colors"
                onClick={() => {
                  setDateRange('30d');
                  setCurrentPage(1);
                }}
              >
                <Calendar className="w-3 h-3 mr-1" />
                30 days
              </Badge>
              <Badge
                variant={dateRange === '90d' ? 'default' : 'outline'}
                className="cursor-pointer transition-colors"
                onClick={() => {
                  setDateRange('90d');
                  setCurrentPage(1);
                }}
              >
                <Calendar className="w-3 h-3 mr-1" />
                90 days
              </Badge>
              <Badge
                variant={dateRange === 'all' ? 'default' : 'outline'}
                className="cursor-pointer transition-colors"
                onClick={() => {
                  setDateRange('all');
                  setCurrentPage(1);
                }}
              >
                <Calendar className="w-3 h-3 mr-1" />
                All time
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Activity List */}
      {paginatedActivities.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activities found"
          message="Try adjusting your filters to see more activities"
        />
      ) : (
        <>
          <div className="bg-card rounded-lg border border-border divide-y divide-border">
            {paginatedActivities.map((activity, index) => {
              const Icon = activity.icon;

              return (
                <Link
                  key={`${activity.type}-${activity.timestamp}-${index}`}
                  to={activity.detailLink}
                  className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors group"
                >
                  <ReptileAvatar
                    reptile={activity.reptile}
                    size="md"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {activity.reptile_name}
                      </span>
                      <CategoryBadge category={activity.category} subcategory={activity.subcategory} />
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon size={14} className={`flex-shrink-0 ${activity.iconColor}`} />
                      <span className="text-sm text-muted-foreground">
                        {activity.summary}
                      </span>
                    </div>
                    {activity.notes && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {activity.notes}
                      </p>
                    )}
                  </div>

                  {activity.prominentValue && (
                    <span className="flex-shrink-0 text-lg font-semibold text-primary tabular-nums">
                      {activity.prominentValue}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={`cursor-pointer ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
                    />
                  </PaginationItem>

                  {getPaginationItems().map((item, index) => (
                    <PaginationItem key={index}>
                      {item === 'ellipsis' ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          onClick={() => setCurrentPage(item)}
                          isActive={currentPage === item}
                          className="cursor-pointer"
                        >
                          {item}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={`cursor-pointer ${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>

              <div className="text-center text-sm text-muted-foreground mt-2">
                Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filteredActivities.length)} of {filteredActivities.length} activities
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ActivityHistory;
