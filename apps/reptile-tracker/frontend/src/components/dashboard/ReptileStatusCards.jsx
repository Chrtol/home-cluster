import { useState, useEffect } from 'react';
import axios from 'axios';
import { differenceInDays } from 'date-fns';
import { toLocalISODate } from '../../utils/dateFormatting';
import ReptileStatusCard from './ReptileStatusCard';

/**
 * ReptileStatusCards - Container for reptile status cards with grid layout
 *
 * Fetches reptiles with today's schedules, last feeding, and last weight data.
 * Auto-switches to compact mode at 6+ reptiles (hardcoded threshold).
 * Supports drag-to-reorder with localStorage persistence.
 *
 * Props:
 * - config: Widget config from displaySettings (showAge, showWeight)
 * - size: Widget size ('small', 'medium', 'large')
 * - onQuickLog: Handler for task chip clicks (passed to cards)
 * - streakData: { reptile_id: streak_obj } - batch streak data from Dashboard
 * - healthStatusData: { reptile_id: health_status } - batch health status data from Dashboard
 * - scheduleInstances: All schedule instances for next feeding calculation
 */
const ReptileStatusCards = ({
  config = {},
  size = 'large',
  onQuickLog,
  streakData = {},           // NEW: { reptile_id: streak_obj }
  healthStatusData = {},     // NEW: { reptile_id: health_status }
  scheduleInstances = [],    // NEW: all schedule instances for next feeding
}) => {
  const [reptiles, setReptiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Hardcoded compact threshold (not configurable per Claude's discretion)
  const COMPACT_THRESHOLD = 6;

  // Auto-compact mode based on reptile count
  const isCompact = reptiles.length >= COMPACT_THRESHOLD;

  useEffect(() => {
    fetchReptileData();
  }, []);

  const fetchReptileData = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = toLocalISODate(new Date());

      // Fetch reptiles with today's schedule instances
      const [reptilesRes, instancesRes, bulkDataRes] = await Promise.all([
        axios.get('/api/reptiles'),
        axios.get('/api/schedule-instances/calendar', {
          params: {
            start_date: today,
            end_date: today
          }
        }),
        axios.get('/api/bulk/dashboard', {
          params: {
            week_start: today,
            week_end: today
          }
        })
      ]);

      // Ensure we have an array (API might return error object on failure)
      let reptilesData = Array.isArray(reptilesRes.data) ? reptilesRes.data : [];

      // Get saved order from localStorage
      const savedOrder = localStorage.getItem('reptile_card_order');
      if (savedOrder) {
        try {
          const orderIds = JSON.parse(savedOrder);
          // Sort reptiles based on saved order
          reptilesData = orderIds
            .map(id => reptilesData.find(r => r.id === id))
            .filter(Boolean) // Remove any IDs that don't exist anymore
            .concat(reptilesData.filter(r => !orderIds.includes(r.id))); // Add new reptiles at the end
        } catch (e) {
          console.error('Failed to parse reptile card order', e);
        }
      }

      // Process schedule instances into task format (ensure array)
      const instances = Array.isArray(instancesRes.data) ? instancesRes.data : [];
      const bulkData = bulkDataRes.data || {};

      const enrichedReptiles = reptilesData.map(reptile => {
        // Find today's tasks for this reptile from schedule instances
        const todayTasks = instances
          .filter(i => i.schedule?.reptile_id === reptile.id)
          .map(i => ({
            id: i.id,
            instance_id: i.id,
            schedule_id: i.schedule_id,
            schedule_type: i.schedule?.schedule_type,
            // Include schedule name for display - fallback to capitalized schedule_type
            name: i.schedule?.name,
            task_name: i.schedule?.name,
            scheduled_time: i.schedule?.earliest_time,
            status: i.status,
            completed_at: i.status === 'completed' ? i.updated_at : null,
            reptile_id: reptile.id,
            reptile_name: reptile.name,
            // Include schedule data for QuickLogForm
            food_category: i.schedule?.food_category,
            supplements: i.supplements || i.schedule?.supplements,
            // Include reptile for QuickLogForm
            reptile: reptile
          }));

        // Find last feeding
        const lastFeeding = bulkData?.last_activity?.[reptile.id]?.last_feeding?.[0]?.fed_at || null;

        // Find last weight - API returns weight_grams not weight
        const weights = bulkData?.weight_data?.[reptile.id] || [];
        let lastWeight = null;
        if (weights.length > 0) {
          const latest = weights[0];
          // API returns weight_grams as the weight value
          const latestWeight = latest.weight_grams ?? latest.weight;

          // Only calculate if we have a valid weight
          if (latestWeight != null && typeof latestWeight === 'number') {
            let change = null;

            if (weights.length > 1) {
              const previous = weights[1];
              const previousWeight = previous.weight_grams ?? previous.weight;

              // Only calculate change if both values are valid numbers and previous is not zero
              if (previousWeight != null && typeof previousWeight === 'number' && previousWeight !== 0) {
                const diff = latestWeight - previousWeight;
                const percent = (diff / previousWeight) * 100;
                change = percent.toFixed(1);
              }
            }

            lastWeight = {
              weight: latestWeight,
              change: change
            };
          }
        }

        return {
          ...reptile,
          todayTasks,
          lastFed: lastFeeding,
          lastWeight
        };
      });

      setReptiles(enrichedReptiles);
    } catch (err) {
      console.error('Failed to fetch reptile data:', err);
      setError('Failed to load reptile status cards');
    } finally {
      setLoading(false);
    }
  };

  // Drag-to-reorder handlers
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (index) => {
    if (draggedIndex === null || draggedIndex === index) return;

    const newReptiles = [...reptiles];
    const draggedReptile = newReptiles[draggedIndex];

    // Remove from old position
    newReptiles.splice(draggedIndex, 1);
    // Insert at new position
    newReptiles.splice(index, 0, draggedReptile);

    setReptiles(newReptiles);
    setDraggedIndex(index);

    // Persist to localStorage
    const orderIds = newReptiles.map(r => r.id);
    localStorage.setItem('reptile_card_order', JSON.stringify(orderIds));
  };

  const handleDrop = (index) => {
    setDraggedIndex(null);
  };

  // Grid layout based on mode and widget size
  const getGridClasses = () => {
    if (isCompact) {
      return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2';
    }
    const sizeMap = {
      large: 'grid grid-cols-1 lg:grid-cols-2 gap-3',
      medium: 'grid grid-cols-1 lg:grid-cols-2 gap-3',
      small: 'grid grid-cols-1 gap-3'
    };
    return sizeMap[size] || sizeMap.large;
  };

  if (loading) {
    return (
      <div className="text-center text-muted-foreground text-sm py-6">
        Loading reptiles...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive text-sm py-6">
        {error}
      </div>
    );
  }

  if (reptiles.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="text-center text-muted-foreground text-sm">
          No reptiles yet. Add your first reptile to get started!
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* No container card - individual reptile cards provide the visual structure */}

      <div className={`${getGridClasses()} auto-rows-min`}>
        {reptiles.map((reptile, index) => (
          <ReptileStatusCard
            key={reptile.id}
            reptile={reptile}
            todayTasks={reptile.todayTasks}
            lastFed={reptile.lastFed}
            lastWeight={reptile.lastWeight}
            isCompact={isCompact}
            onReorder={{
              onDragStart: handleDragStart,
              onDragOver: handleDragOver,
              onDrop: handleDrop
            }}
            onQuickLog={onQuickLog}
            index={index}
            streak={streakData[reptile.id] || null}
            healthStatus={healthStatusData[reptile.id] || null}
            scheduleInstances={scheduleInstances.filter(inst => inst.reptile_id === reptile.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default ReptileStatusCards;
