/**
 * Utility functions for formatting dates and times according to user preferences
 */

export function getUserTimeFormat() {
  return localStorage.getItem('timeFormat') || '24h';
}

export function getUserDateFormat() {
  const stored = localStorage.getItem('dateFormat');
  if (stored) return stored;

  // Auto-detect based on browser locale
  const locale = navigator.language || navigator.userLanguage || 'en-US';

  // Map common locales to date formats
  if (locale.startsWith('en-US') || locale.startsWith('en-CA')) {
    return 'MM/DD/YYYY';
  } else if (locale.startsWith('en-GB') || locale.startsWith('en-AU') || locale.startsWith('en-NZ') || locale.startsWith('en-IE')) {
    return 'DD/MM/YYYY';
  } else if (locale.startsWith('de') || locale.startsWith('no') || locale.startsWith('nb') || locale.startsWith('nn') || locale.startsWith('da') || locale.startsWith('sv') || locale.startsWith('fi') || locale.startsWith('is')) {
    // German, Norwegian, Danish, Swedish, Finnish, Icelandic use DD.MM.YYYY
    return 'DD.MM.YYYY';
  } else if (locale.startsWith('fr') || locale.startsWith('es') || locale.startsWith('it') || locale.startsWith('pt') || locale.startsWith('nl') || locale.startsWith('pl')) {
    // French, Spanish, Italian, Portuguese, Dutch, Polish use DD/MM/YYYY
    return 'DD/MM/YYYY';
  }

  // Default to ISO format
  return 'YYYY-MM-DD';
}

export function getUserTimezone() {
  return localStorage.getItem('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getUserFirstDayOfWeek() {
  const stored = localStorage.getItem('firstDayOfWeek');
  if (stored) return stored;

  // Auto-detect based on browser locale
  const locale = navigator.language || navigator.userLanguage || 'en-US';

  // Countries/regions that use Monday as first day of week
  const mondayFirstLocales = [
    'en-GB', 'en-AU', 'en-NZ', 'en-IE', 'en-IN', 'en-ZA', // UK, Australia, NZ, Ireland, India, South Africa
    'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'tr', // Most of Europe
    'no', 'nb', 'nn', 'sv', 'da', 'fi', 'is', // Nordics
    'zh', 'ja', 'ko', // East Asia
    'ar', 'he', // Middle East (some)
  ];

  // Check if locale starts with any Monday-first prefix
  const usesMonday = mondayFirstLocales.some(prefix => locale.startsWith(prefix));

  return usesMonday ? 'monday' : 'sunday';
}

/**
 * Get day names in order based on first day of week preference
 * @param {boolean} short - If true, returns 3-letter abbreviations
 * @returns {Array<string>} Array of day names starting with preferred first day
 */
export function getDayNames(short = false) {
  const firstDay = getUserFirstDayOfWeek();
  const full = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const abbrev = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const names = short ? abbrev : full;

  if (firstDay === 'monday') {
    // Rotate array to start with Monday
    return [...names.slice(1), names[0]];
  }

  return names;
}

/**
 * Get day numbers in order based on first day of week preference
 * @returns {Array<number>} Array of day numbers (0-6) starting with preferred first day
 */
export function getDayNumbers() {
  const firstDay = getUserFirstDayOfWeek();

  if (firstDay === 'monday') {
    return [1, 2, 3, 4, 5, 6, 0]; // Monday through Sunday
  }

  return [0, 1, 2, 3, 4, 5, 6]; // Sunday through Saturday
}

export function formatDate(date, format = null) {
  const dateFormat = format || getUserDateFormat();
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  switch (dateFormat) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD.MM.YYYY':
      return `${day}.${month}.${year}`;
    case 'YYYY-MM-DD':
    default:
      return `${year}-${month}-${day}`;
  }
}

export function formatTime(date, format = null) {
  const timeFormat = format || getUserTimeFormat();
  const d = new Date(date);

  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');

  if (timeFormat === '12h') {
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${period}`;
  } else {
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
}

export function formatDateTime(date, options = {}) {
  const dateFormat = options.dateFormat || getUserDateFormat();
  const timeFormat = options.timeFormat || getUserTimeFormat();

  const formattedDate = formatDate(date, dateFormat);
  const formattedTime = formatTime(date, timeFormat);

  return `${formattedDate} ${formattedTime}`;
}

export function formatRelativeTime(date) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

  return formatDate(date);
}
