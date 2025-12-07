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
  { id: 'today_summary', label: 'Today Summary', visible: true, order: 0, size: 'large', type: 'summary' },
  { id: 'weekly_calendar', label: 'Weekly Calendar', visible: true, order: 1, size: 'large', type: 'content' },
  { id: 'weight_chart', label: 'Weight Tracking', visible: true, order: 2, size: 'large', type: 'content', interpolationMode: 'linear' },
  { id: 'reptile_cards', label: 'Your Reptiles', visible: true, order: 3, size: 'small', type: 'content' },
  { id: 'recent_activity', label: 'Recent Activity', visible: true, order: 4, size: 'medium', type: 'content' },
  // Additional summary cards (disabled by default) - TODO: Implement these in Dashboard.jsx
  { id: 'weekly_summary', label: 'Weekly Summary', visible: false, order: 5, size: 'large', type: 'summary' },
  { id: 'health_summary', label: 'Health Summary', visible: false, order: 6, size: 'large', type: 'summary' },
  { id: 'schedule_summary', label: 'Schedule Summary', visible: false, order: 7, size: 'large', type: 'summary' },
];

export function getDashboardCardSettings() {
  const stored = localStorage.getItem('dashboard_cards');
  if (!stored) return DEFAULT_DASHBOARD_CARDS;

  try {
    const parsed = JSON.parse(stored);

    // Create a set of valid card IDs from defaults
    const validCardIds = new Set(DEFAULT_DASHBOARD_CARDS.map(c => c.id));

    // Filter out cards that no longer exist and update existing cards with missing properties
    const validStoredCards = parsed
      .filter(card => validCardIds.has(card.id))
      .map(card => {
        const defaultCard = DEFAULT_DASHBOARD_CARDS.find(c => c.id === card.id);
        return {
          ...card,
          size: card.size || defaultCard.size,
          type: card.type || defaultCard.type,
          interpolationMode: card.interpolationMode || defaultCard.interpolationMode
        };
      });

    // Add any new default cards that aren't in stored settings
    const storedIds = new Set(validStoredCards.map(c => c.id));
    DEFAULT_DASHBOARD_CARDS.forEach(defaultCard => {
      if (!storedIds.has(defaultCard.id)) {
        validStoredCards.push(defaultCard);
      }
    });

    return validStoredCards.sort((a, b) => a.order - b.order);
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
  { id: 'summary_weight', label: '  ↳ Weight Summary', visible: true, order: 0.1, size: 'xs', parentId: 'summary_cards' },
  { id: 'summary_feeding', label: '  ↳ Feeding Summary', visible: true, order: 0.2, size: 'xs', parentId: 'summary_cards' },
  { id: 'summary_misting', label: '  ↳ Misting Summary', visible: true, order: 0.3, size: 'xs', parentId: 'summary_cards' },
  { id: 'summary_health', label: '  ↳ Health Events Summary', visible: true, order: 0.4, size: 'xs', parentId: 'summary_cards' },
  { id: 'weight_feeding', label: 'Weight & Feeding Correlation', visible: true, order: 1, size: 'large', interpolationMode: 'linear' },
  { id: 'feeding_heatmap', label: 'Feeding Activity Calendar', visible: true, order: 2, size: 'xs' },
  { id: 'misting_frequency', label: 'Misting Frequency', visible: true, order: 3, size: 'medium' },
  { id: 'health_events', label: 'Health Events Timeline', visible: true, order: 4, size: 'medium' },
];

/**
 * Get statistics chart settings for a specific reptile, or global settings if no reptile specified
 * @param {number|null} reptileId - Optional reptile ID for per-reptile settings
 * @returns {Array} Chart settings
 */
export function getStatisticsChartSettings(reptileId = null) {
  const key = reptileId ? `statistics_charts_reptile_${reptileId}` : 'statistics_charts';
  const stored = localStorage.getItem(key);

  // If no per-reptile setting exists, fall back to global settings
  if (!stored && reptileId) {
    return getStatisticsChartSettings(null); // Get global settings
  }

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

/**
 * Save statistics chart settings for a specific reptile or globally
 * @param {Array} charts - Chart settings to save
 * @param {number|null} reptileId - Optional reptile ID for per-reptile settings
 */
export function saveStatisticsChartSettings(charts, reptileId = null) {
  const key = reptileId ? `statistics_charts_reptile_${reptileId}` : 'statistics_charts';
  localStorage.setItem(key, JSON.stringify(charts));
}

/**
 * Reset statistics chart settings for a specific reptile or globally
 * @param {number|null} reptileId - Optional reptile ID for per-reptile settings
 * @returns {Array} Default chart settings
 */
export function resetStatisticsChartSettings(reptileId = null) {
  const key = reptileId ? `statistics_charts_reptile_${reptileId}` : 'statistics_charts';
  localStorage.removeItem(key);
  return DEFAULT_STATISTICS_CHARTS;
}

/**
 * Check if a reptile has custom statistics settings
 * @param {number} reptileId - Reptile ID to check
 * @returns {boolean} True if custom settings exist
 */
export function hasCustomStatisticsSettings(reptileId) {
  const key = `statistics_charts_reptile_${reptileId}`;
  return localStorage.getItem(key) !== null;
}

/**
 * Copy global settings to a specific reptile
 * @param {number} reptileId - Reptile ID to copy settings to
 */
export function copyGlobalSettingsToReptile(reptileId) {
  const globalSettings = getStatisticsChartSettings(null);
  saveStatisticsChartSettings(globalSettings, reptileId);
}

/**
 * Get all reptile IDs that have custom statistics settings
 * @returns {Array<number>} Array of reptile IDs with custom settings
 */
export function getReptileIdsWithCustomSettings() {
  const ids = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('statistics_charts_reptile_')) {
      const id = parseInt(key.replace('statistics_charts_reptile_', ''));
      if (!isNaN(id)) ids.push(id);
    }
  }
  return ids;
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

/**
 * Check if weekly calendar card is XS size
 * @returns {boolean} True if calendar is XS
 */
export function isCalendarExtraSmall() {
  const cards = getDashboardCardSettings();
  const calendarCard = cards.find(c => c.id === 'weekly_calendar');
  return calendarCard?.size === 'xs';
}

// ============================================================================
// DISPLAY PROFILES SYSTEM
// ============================================================================

/**
 * Display profile structure:
 * {
 *   id: string (UUID)
 *   name: string
 *   dashboard_cards: array
 *   statistics_charts: array (global only, per-reptile settings not included in profiles)
 *   chart_settings: object
 *   weight_interpolation_mode: string
 *   created_at: ISO timestamp
 *   updated_at: ISO timestamp
 * }
 */

/**
 * Generate a simple UUID for profile IDs
 */
function generateId() {
  return 'profile_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Get all saved display profiles
 * @returns {Array} Array of profile objects
 */
export function getDisplayProfiles() {
  const stored = localStorage.getItem('display_profiles');
  if (!stored) {
    // Create default profiles if none exist
    const standardProfile = {
      id: 'standard',
      name: 'Standard',
      dashboard_cards: [
        { id: 'today_summary', label: 'Today Summary', visible: true, order: 0, size: 'large', type: 'summary' },
        { id: 'weekly_calendar', label: 'Weekly Calendar', visible: true, order: 1, size: 'large', type: 'content' },
        { id: 'weight_chart', label: 'Weight Tracking', visible: true, order: 2, size: 'medium', type: 'content', interpolationMode: 'linear' },
        { id: 'reptile_cards', label: 'Your Reptiles', visible: true, order: 3, size: 'xs', type: 'content' },
        { id: 'recent_activity', label: 'Recent Activity', visible: true, order: 4, size: 'large', type: 'content' },
      ],
      statistics_charts: DEFAULT_STATISTICS_CHARTS,
      chart_settings: DEFAULT_CHART_SETTINGS,
      weight_interpolation_mode: 'linear',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isDefault: true
    };

    const compactProfile = {
      id: 'compact',
      name: 'Compact',
      dashboard_cards: [
        { id: 'today_summary', label: 'Today Summary', visible: true, order: 0, size: 'large', type: 'summary' },
        { id: 'recent_activity', label: 'Recent Activity', visible: true, order: 1, size: 'medium', type: 'content' },
        { id: 'weekly_calendar', label: 'Weekly Calendar', visible: true, order: 2, size: 'xs', type: 'content' },
        { id: 'weight_chart', label: 'Weight Tracking', visible: true, order: 3, size: 'medium', type: 'content', interpolationMode: 'linear' },
        { id: 'reptile_cards', label: 'Your Reptiles', visible: true, order: 4, size: 'xs', type: 'content' },
      ],
      statistics_charts: DEFAULT_STATISTICS_CHARTS,
      chart_settings: DEFAULT_CHART_SETTINGS,
      weight_interpolation_mode: 'linear',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isDefault: true
    };

    const mobileProfile = {
      id: 'mobile',
      name: 'Mobile',
      dashboard_cards: [
        { id: 'today_summary', label: 'Today Summary', visible: true, order: 0, size: 'large', type: 'summary' },
        { id: 'reptile_cards', label: 'Your Reptiles', visible: true, order: 1, size: 'large', type: 'content' },
        { id: 'recent_activity', label: 'Recent Activity', visible: true, order: 2, size: 'large', type: 'content' },
        { id: 'weekly_calendar', label: 'Weekly Calendar', visible: true, order: 3, size: 'xs', type: 'content' },
        { id: 'weight_chart', label: 'Weight Tracking', visible: true, order: 4, size: 'large', type: 'content', interpolationMode: 'linear' },
      ],
      statistics_charts: DEFAULT_STATISTICS_CHARTS,
      chart_settings: DEFAULT_CHART_SETTINGS,
      weight_interpolation_mode: 'linear',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isDefault: true
    };

    localStorage.setItem('display_profiles', JSON.stringify([standardProfile, compactProfile, mobileProfile]));
    return [standardProfile, compactProfile, mobileProfile];
  }

  try {
    const profiles = JSON.parse(stored);

    // Ensure all default profiles exist
    const hasStandard = profiles.find(p => p.id === 'standard');
    const hasCompact = profiles.find(p => p.id === 'compact');
    const hasMobile = profiles.find(p => p.id === 'mobile');

    if (!hasStandard) {
      const standardProfile = {
        id: 'standard',
        name: 'Standard',
        dashboard_cards: [
          { id: 'today_summary', label: 'Today Summary', visible: true, order: 0, size: 'large', type: 'summary' },
          { id: 'weekly_calendar', label: 'Weekly Calendar', visible: true, order: 1, size: 'large', type: 'content' },
          { id: 'weight_chart', label: 'Weight Tracking', visible: true, order: 2, size: 'medium', type: 'content', interpolationMode: 'linear' },
          { id: 'reptile_cards', label: 'Your Reptiles', visible: true, order: 3, size: 'xs', type: 'content' },
          { id: 'recent_activity', label: 'Recent Activity', visible: true, order: 4, size: 'large', type: 'content' },
        ],
        statistics_charts: DEFAULT_STATISTICS_CHARTS,
        chart_settings: DEFAULT_CHART_SETTINGS,
        weight_interpolation_mode: 'linear',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isDefault: true
      };
      profiles.unshift(standardProfile);
    }

    if (!hasCompact) {
      const compactProfile = {
        id: 'compact',
        name: 'Compact',
        dashboard_cards: [
          { id: 'today_summary', label: 'Today Summary', visible: true, order: 0, size: 'large', type: 'summary' },
          { id: 'recent_activity', label: 'Recent Activity', visible: true, order: 1, size: 'medium', type: 'content' },
          { id: 'weekly_calendar', label: 'Weekly Calendar', visible: true, order: 2, size: 'xs', type: 'content' },
          { id: 'weight_chart', label: 'Weight Tracking', visible: true, order: 3, size: 'medium', type: 'content', interpolationMode: 'linear' },
          { id: 'reptile_cards', label: 'Your Reptiles', visible: true, order: 4, size: 'xs', type: 'content' },
        ],
        statistics_charts: DEFAULT_STATISTICS_CHARTS,
        chart_settings: DEFAULT_CHART_SETTINGS,
        weight_interpolation_mode: 'linear',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isDefault: true
      };
      profiles.splice(1, 0, compactProfile); // Insert after standard
    }

    if (!hasMobile) {
      const mobileProfile = {
        id: 'mobile',
        name: 'Mobile',
        dashboard_cards: [
          { id: 'today_summary', label: 'Today Summary', visible: true, order: 0, size: 'large', type: 'summary' },
          { id: 'reptile_cards', label: 'Your Reptiles', visible: true, order: 1, size: 'large', type: 'content' },
          { id: 'recent_activity', label: 'Recent Activity', visible: true, order: 2, size: 'large', type: 'content' },
          { id: 'weekly_calendar', label: 'Weekly Calendar', visible: true, order: 3, size: 'xs', type: 'content' },
          { id: 'weight_chart', label: 'Weight Tracking', visible: true, order: 4, size: 'large', type: 'content', interpolationMode: 'linear' },
        ],
        statistics_charts: DEFAULT_STATISTICS_CHARTS,
        chart_settings: DEFAULT_CHART_SETTINGS,
        weight_interpolation_mode: 'linear',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isDefault: true
      };
      profiles.splice(2, 0, mobileProfile); // Insert after compact
    }

    // Migration: Remove old "default" profile if "standard" exists
    const hasOldDefault = profiles.find(p => p.id === 'default');
    let needsSave = !hasStandard || !hasCompact || !hasMobile;

    if (hasOldDefault && hasStandard) {
      // Migrate active profile ID from old "default" to new "standard"
      const oldActiveId = localStorage.getItem('active_profile_id');
      if (oldActiveId === 'default') {
        localStorage.setItem('active_desktop_profile_id', 'standard');
        localStorage.removeItem('active_profile_id');
      }

      // Remove old default profile
      const filtered = profiles.filter(p => p.id !== 'default');
      localStorage.setItem('display_profiles', JSON.stringify(filtered));
      return filtered;
    }

    if (needsSave) {
      localStorage.setItem('display_profiles', JSON.stringify(profiles));
    }

    return profiles;
  } catch (e) {
    console.error('Failed to parse display profiles', e);
    return [];
  }
}

/**
 * Check if current screen is mobile (< 768px)
 * @returns {boolean} True if mobile
 */
export function isMobileScreen() {
  return window.innerWidth < 768; // Tailwind's md breakpoint
}

/**
 * Get the currently active profile ID for desktop
 * @returns {string} Active desktop profile ID
 */
export function getActiveDesktopProfileId() {
  return localStorage.getItem('active_desktop_profile_id') || 'standard';
}

/**
 * Get the currently active profile ID for mobile
 * @returns {string} Active mobile profile ID
 */
export function getActiveMobileProfileId() {
  return localStorage.getItem('active_mobile_profile_id') || 'mobile';
}

/**
 * Get the currently active profile ID based on screen size
 * @returns {string} Active profile ID
 */
export function getActiveProfileId() {
  return isMobileScreen() ? getActiveMobileProfileId() : getActiveDesktopProfileId();
}

/**
 * Set the active profile ID for desktop or mobile
 * @param {string} profileId - Profile ID to activate
 * @param {boolean} isMobile - Whether to set mobile profile (default: auto-detect)
 */
export function setActiveProfileId(profileId, isMobile = null) {
  const mobile = isMobile !== null ? isMobile : isMobileScreen();

  if (mobile) {
    localStorage.setItem('active_mobile_profile_id', profileId);
  } else {
    localStorage.setItem('active_desktop_profile_id', profileId);
  }
}

/**
 * Get the currently active profile based on screen size
 * @returns {Object|null} Active profile object
 */
export function getActiveProfile() {
  const profiles = getDisplayProfiles();
  const activeId = getActiveProfileId();
  return profiles.find(p => p.id === activeId) || profiles.find(p => p.id === 'standard') || profiles[0];
}

/**
 * Create a new profile from current settings
 * @param {string} name - Profile name
 * @returns {Object} Created profile object
 */
export function createProfileFromCurrent(name) {
  const profiles = getDisplayProfiles();

  const newProfile = {
    id: generateId(),
    name,
    dashboard_cards: getDashboardCardSettings(),
    statistics_charts: getStatisticsChartSettings(), // Global settings only
    chart_settings: getChartSettings(),
    weight_interpolation_mode: getWeightInterpolationMode(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    isDefault: false
  };

  profiles.push(newProfile);
  localStorage.setItem('display_profiles', JSON.stringify(profiles));
  return newProfile;
}

/**
 * Update an existing profile with current settings
 * @param {string} profileId - Profile ID to update
 * @returns {boolean} Success status
 */
export function updateProfileWithCurrent(profileId) {
  const profiles = getDisplayProfiles();
  const profileIndex = profiles.findIndex(p => p.id === profileId);

  if (profileIndex === -1) return false;

  profiles[profileIndex] = {
    ...profiles[profileIndex],
    dashboard_cards: getDashboardCardSettings(),
    statistics_charts: getStatisticsChartSettings(),
    chart_settings: getChartSettings(),
    weight_interpolation_mode: getWeightInterpolationMode(),
    updated_at: new Date().toISOString()
  };

  localStorage.setItem('display_profiles', JSON.stringify(profiles));
  return true;
}

/**
 * Rename a profile
 * @param {string} profileId - Profile ID to rename
 * @param {string} newName - New profile name
 * @returns {boolean} Success status
 */
export function renameProfile(profileId, newName) {
  const profiles = getDisplayProfiles();
  const profile = profiles.find(p => p.id === profileId);

  if (!profile) return false;

  profile.name = newName;
  profile.updated_at = new Date().toISOString();

  localStorage.setItem('display_profiles', JSON.stringify(profiles));
  return true;
}

/**
 * Delete a profile
 * @param {string} profileId - Profile ID to delete
 * @returns {boolean} Success status
 */
export function deleteProfile(profileId) {
  // Can't delete built-in profiles
  if (profileId === 'standard' || profileId === 'compact' || profileId === 'mobile') return false;

  const profiles = getDisplayProfiles();
  const filtered = profiles.filter(p => p.id !== profileId);

  if (filtered.length === profiles.length) return false; // Profile not found

  localStorage.setItem('display_profiles', JSON.stringify(filtered));

  // If deleted profile was active, switch to appropriate default
  const desktopActive = getActiveDesktopProfileId();
  const mobileActive = getActiveMobileProfileId();

  if (desktopActive === profileId) {
    setActiveProfileId('standard', false);
    if (!isMobileScreen()) {
      applyProfile('standard');
    }
  }

  if (mobileActive === profileId) {
    setActiveProfileId('mobile', true);
    if (isMobileScreen()) {
      applyProfile('mobile');
    }
  }

  return true;
}

/**
 * Apply a profile (load its settings into localStorage)
 * @param {string} profileId - Profile ID to apply
 * @returns {boolean} Success status
 */
export function applyProfile(profileId) {
  const profiles = getDisplayProfiles();
  const profile = profiles.find(p => p.id === profileId);

  if (!profile) return false;

  // Apply settings to localStorage
  saveDashboardCardSettings(profile.dashboard_cards);
  saveStatisticsChartSettings(profile.statistics_charts);
  saveChartSettings(profile.chart_settings);
  saveWeightInterpolationMode(profile.weight_interpolation_mode);

  // Set as active
  setActiveProfileId(profileId);

  return true;
}

/**
 * Duplicate a profile
 * @param {string} profileId - Profile ID to duplicate
 * @param {string} newName - Name for the duplicated profile
 * @returns {Object|null} Duplicated profile object or null if failed
 */
export function duplicateProfile(profileId, newName) {
  const profiles = getDisplayProfiles();
  const profile = profiles.find(p => p.id === profileId);

  if (!profile) return null;

  const duplicated = {
    ...profile,
    id: generateId(),
    name: newName || `${profile.name} (Copy)`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    isDefault: false
  };

  profiles.push(duplicated);
  localStorage.setItem('display_profiles', JSON.stringify(profiles));
  return duplicated;
}

/**
 * Export a profile as JSON
 * @param {string} profileId - Profile ID to export
 * @returns {Object|null} Profile export data
 */
export function exportProfile(profileId) {
  const profiles = getDisplayProfiles();
  const profile = profiles.find(p => p.id === profileId);

  if (!profile) return null;

  return {
    version: '1.0',
    type: 'display_profile',
    exported_at: new Date().toISOString(),
    profile: {
      name: profile.name,
      dashboard_cards: profile.dashboard_cards,
      statistics_charts: profile.statistics_charts,
      chart_settings: profile.chart_settings,
      weight_interpolation_mode: profile.weight_interpolation_mode
    }
  };
}

/**
 * Import a profile from JSON data
 * @param {Object} data - Profile export data
 * @param {string} customName - Optional custom name for imported profile
 * @returns {Object|null} Imported profile object or null if failed
 */
export function importProfile(data, customName = null) {
  try {
    if (!data || !data.profile) {
      throw new Error('Invalid profile data');
    }

    const profiles = getDisplayProfiles();

    const importedProfile = {
      id: generateId(),
      name: customName || data.profile.name || 'Imported Profile',
      dashboard_cards: data.profile.dashboard_cards || DEFAULT_DASHBOARD_CARDS,
      statistics_charts: data.profile.statistics_charts || DEFAULT_STATISTICS_CHARTS,
      chart_settings: data.profile.chart_settings || DEFAULT_CHART_SETTINGS,
      weight_interpolation_mode: data.profile.weight_interpolation_mode || 'linear',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isDefault: false
    };

    profiles.push(importedProfile);
    localStorage.setItem('display_profiles', JSON.stringify(profiles));
    return importedProfile;
  } catch (e) {
    console.error('Failed to import profile', e);
    return null;
  }
}
