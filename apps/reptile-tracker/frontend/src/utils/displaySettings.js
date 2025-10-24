/**
 * Utility functions for managing user display customization settings
 * All settings are stored in localStorage and are per-user/per-browser
 */

// ============================================================================
// DASHBOARD SETTINGS
// ============================================================================

/**
 * Default dashboard card configuration
 * Each card has:
 *   - id: unique identifier
 *   - label: display name
 *   - visible: default visibility
 *   - order: default position
 *   - size: 'xs' (1/4), 'small' (1/3), 'medium' (2/3), 'large' (full-width)
 *   - type: 'summary' (small stat cards) or 'content' (larger content cards)
 *   - interpolationMode: 'linear' | 'step' | 'none' (only for weight-related charts)
 */
const DEFAULT_DASHBOARD_CARDS = [
  { id: 'need_feeding', label: 'Need Feeding', visible: true, order: 0, size: 'xs', type: 'summary' },
  { id: 'fed_this_week', label: 'Fed This Week', visible: true, order: 1, size: 'xs', type: 'summary' },
  { id: 'misted_today', label: 'Misted Today', visible: true, order: 2, size: 'xs', type: 'summary' },
  { id: 'shed_this_month', label: 'Shed This Month', visible: true, order: 3, size: 'xs', type: 'summary' },
  { id: 'weight_chart', label: 'Weight Tracking', visible: true, order: 4, size: 'large', type: 'content', interpolationMode: 'linear' },
  { id: 'reptile_cards', label: 'Your Reptiles', visible: true, order: 5, size: 'small', type: 'content' },
  { id: 'recent_activity', label: 'Recent Activity', visible: true, order: 6, size: 'medium', type: 'content' },
];

export function getDashboardCardSettings() {
  const stored = localStorage.getItem('dashboard_cards');
  if (!stored) return DEFAULT_DASHBOARD_CARDS;

  try {
    const parsed = JSON.parse(stored);
    // Merge with defaults to ensure any new cards are included
    const storedIds = new Set(parsed.map(c => c.id));
    const merged = [...parsed];

    DEFAULT_DASHBOARD_CARDS.forEach(defaultCard => {
      if (!storedIds.has(defaultCard.id)) {
        merged.push(defaultCard);
      } else {
        // Ensure stored cards have size, type, and interpolationMode properties
        const storedCard = merged.find(c => c.id === defaultCard.id);
        if (storedCard) {
          if (!storedCard.size) storedCard.size = defaultCard.size;
          if (!storedCard.type) storedCard.type = defaultCard.type;
          if (!storedCard.interpolationMode && defaultCard.interpolationMode) {
            storedCard.interpolationMode = defaultCard.interpolationMode;
          }
        }
      }
    });

    return merged.sort((a, b) => a.order - b.order);
  } catch (e) {
    console.error('Failed to parse dashboard card settings', e);
    return DEFAULT_DASHBOARD_CARDS;
  }
}

export function saveDashboardCardSettings(cards) {
  localStorage.setItem('dashboard_cards', JSON.stringify(cards));
}

export function resetDashboardCardSettings() {
  localStorage.removeItem('dashboard_cards');
  return DEFAULT_DASHBOARD_CARDS;
}

// ============================================================================
// STATISTICS SETTINGS
// ============================================================================

/**
 * Default statistics chart configuration
 * Each chart has:
 *   - id: unique identifier
 *   - label: display name
 *   - visible: default visibility
 *   - order: default position
 *   - size: 'xs' (1/4), 'small' (1/2), 'medium' (3/4), 'large' (full-width)
 *   - interpolationMode: 'linear' | 'step' | 'none' (only for weight-related charts)
 */
const DEFAULT_STATISTICS_CHARTS = [
  { id: 'summary_cards', label: 'Summary Cards', visible: true, order: 0, size: 'large' },
  { id: 'weight_feeding', label: 'Weight & Feeding Correlation', visible: true, order: 1, size: 'large', interpolationMode: 'linear' },
  { id: 'feeding_heatmap', label: 'Feeding Frequency Heatmap', visible: true, order: 2, size: 'small' },
];

export function getStatisticsChartSettings() {
  const stored = localStorage.getItem('statistics_charts');
  if (!stored) return DEFAULT_STATISTICS_CHARTS;

  try {
    const parsed = JSON.parse(stored);
    const storedIds = new Set(parsed.map(c => c.id));
    const merged = [...parsed];

    DEFAULT_STATISTICS_CHARTS.forEach(defaultChart => {
      if (!storedIds.has(defaultChart.id)) {
        merged.push(defaultChart);
      } else {
        // Ensure stored charts have size and interpolationMode properties
        const storedChart = merged.find(c => c.id === defaultChart.id);
        if (storedChart) {
          if (!storedChart.size) storedChart.size = defaultChart.size;
          if (!storedChart.interpolationMode && defaultChart.interpolationMode) {
            storedChart.interpolationMode = defaultChart.interpolationMode;
          }
        }
      }
    });

    return merged.sort((a, b) => a.order - b.order);
  } catch (e) {
    console.error('Failed to parse statistics chart settings', e);
    return DEFAULT_STATISTICS_CHARTS;
  }
}

export function saveStatisticsChartSettings(charts) {
  localStorage.setItem('statistics_charts', JSON.stringify(charts));
}

export function resetStatisticsChartSettings() {
  localStorage.removeItem('statistics_charts');
  return DEFAULT_STATISTICS_CHARTS;
}

// ============================================================================
// WEIGHT INTERPOLATION SETTINGS
// ============================================================================

/**
 * Weight interpolation modes:
 * - linear: Draw straight line between measurements (default)
 * - step: Draw horizontal line from last known weight
 * - none: Show only actual measurement dots
 */
export function getWeightInterpolationMode() {
  return localStorage.getItem('weight_interpolation_mode') || 'linear';
}

export function saveWeightInterpolationMode(mode) {
  localStorage.setItem('weight_interpolation_mode', mode);
}

// ============================================================================
// CHART CUSTOMIZATION SETTINGS
// ============================================================================

const DEFAULT_CHART_SETTINGS = {
  showGrid: true,
  showLegend: true,
  showAxisLabels: true,
  chartHeight: 300, // pixels
};

export function getChartSettings() {
  const stored = localStorage.getItem('chart_settings');
  if (!stored) return DEFAULT_CHART_SETTINGS;

  try {
    return { ...DEFAULT_CHART_SETTINGS, ...JSON.parse(stored) };
  } catch (e) {
    console.error('Failed to parse chart settings', e);
    return DEFAULT_CHART_SETTINGS;
  }
}

export function saveChartSettings(settings) {
  localStorage.setItem('chart_settings', JSON.stringify(settings));
}

export function resetChartSettings() {
  localStorage.removeItem('chart_settings');
  return DEFAULT_CHART_SETTINGS;
}

// ============================================================================
// DATA EXPORT/IMPORT SETTINGS
// ============================================================================

/**
 * Export all user display settings as a JSON object
 * @returns {Object} All display settings
 */
export function exportAllDisplaySettings() {
  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    settings: {
      dashboard_cards: getDashboardCardSettings(),
      statistics_charts: getStatisticsChartSettings(),
      weight_interpolation_mode: getWeightInterpolationMode(),
      chart_settings: getChartSettings(),
      // Also include date/time preferences
      timeFormat: localStorage.getItem('timeFormat'),
      dateFormat: localStorage.getItem('dateFormat'),
      timezone: localStorage.getItem('timezone'),
      firstDayOfWeek: localStorage.getItem('firstDayOfWeek'),
      // Calendar filters
      calendar_category_filters: localStorage.getItem('calendar_category_filters'),
    }
  };
}

/**
 * Import display settings from a JSON object
 * @param {Object} data - Settings data to import
 * @param {boolean} merge - If true, merge with existing settings; if false, replace
 * @returns {boolean} Success status
 */
export function importDisplaySettings(data, merge = false) {
  try {
    if (!data || !data.settings) {
      throw new Error('Invalid settings data');
    }

    const settings = data.settings;

    // Import dashboard cards
    if (settings.dashboard_cards) {
      if (merge) {
        const current = getDashboardCardSettings();
        const merged = mergeDashboardCards(current, settings.dashboard_cards);
        saveDashboardCardSettings(merged);
      } else {
        saveDashboardCardSettings(settings.dashboard_cards);
      }
    }

    // Import statistics charts
    if (settings.statistics_charts) {
      if (merge) {
        const current = getStatisticsChartSettings();
        const merged = mergeStatisticsCharts(current, settings.statistics_charts);
        saveStatisticsChartSettings(merged);
      } else {
        saveStatisticsChartSettings(settings.statistics_charts);
      }
    }

    // Import other settings
    if (settings.weight_interpolation_mode) {
      saveWeightInterpolationMode(settings.weight_interpolation_mode);
    }

    if (settings.chart_settings) {
      saveChartSettings(settings.chart_settings);
    }

    // Import date/time preferences (optional)
    if (settings.timeFormat) localStorage.setItem('timeFormat', settings.timeFormat);
    if (settings.dateFormat) localStorage.setItem('dateFormat', settings.dateFormat);
    if (settings.timezone) localStorage.setItem('timezone', settings.timezone);
    if (settings.firstDayOfWeek) localStorage.setItem('firstDayOfWeek', settings.firstDayOfWeek);
    if (settings.calendar_category_filters) localStorage.setItem('calendar_category_filters', settings.calendar_category_filters);

    return true;
  } catch (e) {
    console.error('Failed to import display settings', e);
    return false;
  }
}

/**
 * Helper function to merge dashboard cards (keep user's visibility/order preferences)
 */
function mergeDashboardCards(current, imported) {
  const currentMap = new Map(current.map(c => [c.id, c]));

  imported.forEach(importedCard => {
    if (currentMap.has(importedCard.id)) {
      // Update existing card
      currentMap.set(importedCard.id, { ...currentMap.get(importedCard.id), ...importedCard });
    } else {
      // Add new card
      currentMap.set(importedCard.id, importedCard);
    }
  });

  return Array.from(currentMap.values()).sort((a, b) => a.order - b.order);
}

/**
 * Helper function to merge statistics charts
 */
function mergeStatisticsCharts(current, imported) {
  const currentMap = new Map(current.map(c => [c.id, c]));

  imported.forEach(importedChart => {
    if (currentMap.has(importedChart.id)) {
      currentMap.set(importedChart.id, { ...currentMap.get(importedChart.id), ...importedChart });
    } else {
      currentMap.set(importedChart.id, importedChart);
    }
  });

  return Array.from(currentMap.values()).sort((a, b) => a.order - b.order);
}

/**
 * Reset all display settings to defaults
 */
export function resetAllDisplaySettings() {
  resetDashboardCardSettings();
  resetStatisticsChartSettings();
  resetChartSettings();
  localStorage.removeItem('weight_interpolation_mode');
}
