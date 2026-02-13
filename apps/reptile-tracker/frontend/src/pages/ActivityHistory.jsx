import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Utensils, Droplets, Activity as ActivityIcon, Scale, Calendar, Heart, Snowflake, Ruler } from 'lucide-react';
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
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;

const ActivityHistory = () => {
  const [activities, setActivities] = useState([]);
  const [reptiles, setReptiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [filters, setFilters] = useState({
    types: new Set(['feeding', 'misting', 'health', 'weight', 'shedding', 'brumation', 'measurement']),
    reptileId: null,
    dateRange: 'all', // '7d', '30d', '90d', 'all'
  });

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
      const [feedingsRes, weighingsRes] = await Promise.all([
        axios.get('/api/feedings'),
        axios.get('/api/weight/dashboard')
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

        return {
          type: 'feeding',
          icon: Utensils,
          iconColor: 'text-primary',
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
          icon: Scale,
          iconColor: 'text-blue-500',
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

      // Process health records (shedding, brumation, observations)
      const healthRecords = healthAndMeasurements.flatMap(({ reptileId, health }) => {
        const reptileFromMap = reptilesMap[reptileId];
        return health.map(h => {
          // Determine type and summary based on record_type and event_type
          let type = 'health';
          let icon = ActivityIcon;
          let iconColor = 'text-gray-500';
          let summary = h.title || 'Health record';

          if (h.record_type === 'shedding') {
            type = 'shedding';
            icon = Heart;
            iconColor = 'text-amber-500';
            const subtype = h.event_type === 'start' ? 'Started' : 'Complete';
            summary = `Shedding ${subtype}`;
          } else if (h.record_type === 'brumation') {
            type = 'brumation';
            icon = Snowflake;
            iconColor = 'text-purple-500';
            const subtype = h.event_type === 'start' ? 'Started' : 'Ended';
            summary = `Brumation ${subtype}`;
          }

          return {
            type,
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
            icon: Ruler,
            iconColor: 'text-green-500',
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

      // Combine and sort
      const combined = [...feedings, ...weighings, ...healthRecords, ...measurements];
      combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setActivities(combined);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
      setError('Failed to load activity history');
    } finally {
      setLoading(false);
    }
  };

  // Toggle activity type filter
  const toggleTypeFilter = (type) => {
    const newTypes = new Set(filters.types);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setFilters({ ...filters, types: newTypes });
    setCurrentPage(1); // Reset to first page
  };

  // Filter activities
  const getFilteredActivities = () => {
    let filtered = [...activities];

    // Filter by type
    filtered = filtered.filter(a => filters.types.has(a.type));

    // Filter by reptile
    if (filters.reptileId) {
      filtered = filtered.filter(a => a.reptile_id === parseInt(filters.reptileId));
    }

    // Filter by date range
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
      const days = daysMap[filters.dateRange];
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
        {/* Activity Type Filters */}
        <div className="mb-4">
          <label className="text-sm font-medium text-foreground mb-2 block">
            Activity Types
          </label>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={filters.types.has('feeding') ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-colors',
                filters.types.has('feeding') && 'bg-primary hover:bg-primary/80'
              )}
              onClick={() => toggleTypeFilter('feeding')}
            >
              <Utensils className="w-3 h-3 mr-1" />
              Feeding
            </Badge>
            <Badge
              variant={filters.types.has('misting') ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-colors',
                filters.types.has('misting') && 'bg-primary hover:bg-primary/80'
              )}
              onClick={() => toggleTypeFilter('misting')}
            >
              <Droplets className="w-3 h-3 mr-1" />
              Misting
            </Badge>
            <Badge
              variant={filters.types.has('health') ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-colors',
                filters.types.has('health') && 'bg-primary hover:bg-primary/80'
              )}
              onClick={() => toggleTypeFilter('health')}
            >
              <ActivityIcon className="w-3 h-3 mr-1" />
              Health
            </Badge>
            <Badge
              variant={filters.types.has('weight') ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-colors',
                filters.types.has('weight') && 'bg-primary hover:bg-primary/80'
              )}
              onClick={() => toggleTypeFilter('weight')}
            >
              <Scale className="w-3 h-3 mr-1" />
              Weight
            </Badge>
            <Badge
              variant={filters.types.has('shedding') ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-colors',
                filters.types.has('shedding') && 'bg-amber-600 hover:bg-amber-600/80'
              )}
              onClick={() => toggleTypeFilter('shedding')}
            >
              <Heart className="w-3 h-3 mr-1" />
              Shedding
            </Badge>
            <Badge
              variant={filters.types.has('brumation') ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-colors',
                filters.types.has('brumation') && 'bg-purple-600 hover:bg-purple-600/80'
              )}
              onClick={() => toggleTypeFilter('brumation')}
            >
              <Snowflake className="w-3 h-3 mr-1" />
              Brumation
            </Badge>
            <Badge
              variant={filters.types.has('measurement') ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-colors',
                filters.types.has('measurement') && 'bg-green-600 hover:bg-green-600/80'
              )}
              onClick={() => toggleTypeFilter('measurement')}
            >
              <Ruler className="w-3 h-3 mr-1" />
              Measurements
            </Badge>
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
              value={filters.reptileId || 'all'}
              onValueChange={(value) => {
                setFilters({ ...filters, reptileId: value === 'all' ? null : value });
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
                variant={filters.dateRange === '7d' ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-colors',
                  filters.dateRange === '7d' && 'bg-primary hover:bg-primary/80'
                )}
                onClick={() => {
                  setFilters({ ...filters, dateRange: '7d' });
                  setCurrentPage(1);
                }}
              >
                <Calendar className="w-3 h-3 mr-1" />
                7 days
              </Badge>
              <Badge
                variant={filters.dateRange === '30d' ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-colors',
                  filters.dateRange === '30d' && 'bg-primary hover:bg-primary/80'
                )}
                onClick={() => {
                  setFilters({ ...filters, dateRange: '30d' });
                  setCurrentPage(1);
                }}
              >
                <Calendar className="w-3 h-3 mr-1" />
                30 days
              </Badge>
              <Badge
                variant={filters.dateRange === '90d' ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-colors',
                  filters.dateRange === '90d' && 'bg-primary hover:bg-primary/80'
                )}
                onClick={() => {
                  setFilters({ ...filters, dateRange: '90d' });
                  setCurrentPage(1);
                }}
              >
                <Calendar className="w-3 h-3 mr-1" />
                90 days
              </Badge>
              <Badge
                variant={filters.dateRange === 'all' ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-colors',
                  filters.dateRange === 'all' && 'bg-primary hover:bg-primary/80'
                )}
                onClick={() => {
                  setFilters({ ...filters, dateRange: 'all' });
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
                      className={cn(
                        'cursor-pointer',
                        currentPage === 1 && 'pointer-events-none opacity-50'
                      )}
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
                      className={cn(
                        'cursor-pointer',
                        currentPage === totalPages && 'pointer-events-none opacity-50'
                      )}
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
