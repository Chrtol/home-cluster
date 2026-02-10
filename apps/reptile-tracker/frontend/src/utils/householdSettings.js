/**
 * Household Settings Utilities
 *
 * Manages user preferences for household-related settings,
 * stored in localStorage for per-device persistence.
 */

const STORAGE_KEY = 'household_settings';

/**
 * Get all household settings from localStorage
 */
function getSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error('Failed to load household settings:', e);
    return {};
  }
}

/**
 * Save household settings to localStorage
 */
function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save household settings:', e);
  }
}

/**
 * Get the default household ID for creating new reptiles.
 * Returns null if no default is set.
 * @returns {number|null}
 */
export function getDefaultHouseholdId() {
  const settings = getSettings();
  return settings.defaultHouseholdId || null;
}

/**
 * Set the default household ID for creating new reptiles.
 * @param {number} householdId - The household ID to set as default
 */
export function setDefaultHouseholdId(householdId) {
  const settings = getSettings();
  settings.defaultHouseholdId = householdId;
  saveSettings(settings);
}

/**
 * Clear the default household ID.
 */
export function clearDefaultHouseholdId() {
  const settings = getSettings();
  delete settings.defaultHouseholdId;
  saveSettings(settings);
}

/**
 * Check if a specific household is set as default.
 * @param {number} householdId - The household ID to check
 * @returns {boolean}
 */
export function isDefaultHousehold(householdId) {
  return getDefaultHouseholdId() === householdId;
}
