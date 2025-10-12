import { useState, useEffect } from 'react';
import { getUserDateFormat } from '../utils/dateFormatting';

/**
 * Custom date input that respects user's date format preference
 * Converts between display format (DD/MM/YYYY, MM/DD/YYYY, etc.) and ISO format (YYYY-MM-DD)
 */
export default function DateInput({ value, onChange, className = '', required = false, ...props }) {
  const [displayValue, setDisplayValue] = useState('');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');

  useEffect(() => {
    setDateFormat(getUserDateFormat());
  }, []);

  // Convert ISO date (YYYY-MM-DD) to display format
  useEffect(() => {
    if (value) {
      const formatted = formatDateForDisplay(value, dateFormat);
      setDisplayValue(formatted);
    } else {
      setDisplayValue('');
    }
  }, [value, dateFormat]);

  const formatDateForDisplay = (isoDate, format) => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');

    switch (format) {
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'DD.MM.YYYY':
        return `${day}.${month}.${year}`;
      case 'YYYY-MM-DD':
      default:
        return isoDate;
    }
  };

  const parseDisplayToISO = (display, format) => {
    if (!display) return '';

    let day, month, year;

    switch (format) {
      case 'DD/MM/YYYY': {
        const parts = display.split('/');
        if (parts.length !== 3) return '';
        [day, month, year] = parts;
        break;
      }
      case 'MM/DD/YYYY': {
        const parts = display.split('/');
        if (parts.length !== 3) return '';
        [month, day, year] = parts;
        break;
      }
      case 'DD.MM.YYYY': {
        const parts = display.split('.');
        if (parts.length !== 3) return '';
        [day, month, year] = parts;
        break;
      }
      case 'YYYY-MM-DD':
      default: {
        const parts = display.split('-');
        if (parts.length !== 3) return '';
        [year, month, day] = parts;
        break;
      }
    }

    // Validate
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (isNaN(d) || isNaN(m) || isNaN(y)) return '';
    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return '';

    // Return ISO format
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const handleChange = (e) => {
    const newDisplayValue = e.target.value;
    setDisplayValue(newDisplayValue);

    // Try to parse and convert to ISO
    const isoDate = parseDisplayToISO(newDisplayValue, dateFormat);
    if (isoDate) {
      onChange({ target: { value: isoDate } });
    }
  };

  const handleBlur = () => {
    // Re-format on blur to ensure proper formatting
    if (value) {
      const formatted = formatDateForDisplay(value, dateFormat);
      setDisplayValue(formatted);
    }
  };

  const getPlaceholder = () => {
    switch (dateFormat) {
      case 'DD/MM/YYYY':
        return 'DD/MM/YYYY';
      case 'MM/DD/YYYY':
        return 'MM/DD/YYYY';
      case 'DD.MM.YYYY':
        return 'DD.MM.YYYY';
      case 'YYYY-MM-DD':
      default:
        return 'YYYY-MM-DD';
    }
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={getPlaceholder()}
      className={className}
      required={required}
      {...props}
    />
  );
}
