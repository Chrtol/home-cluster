import { differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Cake } from 'lucide-react';

/**
 * BirthdayBadge displays birthday countdown with tiered visual escalation
 *
 * Shows countdown only within 30 days of birthday. Visual urgency increases
 * as birthday approaches (4 tiers: approaching, soon, imminent, today).
 *
 * @param {Object} props
 * @param {string|null} props.dateOfBirth - ISO date string (YYYY-MM-DD) or null
 * @returns {JSX.Element|null} Badge component or null if no birthday or > 30 days away
 */
const BirthdayBadge = ({ dateOfBirth }) => {
  // Hide badge when date of birth is unknown
  if (!dateOfBirth) return null;

  const today = new Date();
  const birthDate = new Date(dateOfBirth);

  // Calculate next birthday (this year or next year)
  const thisYearBirthday = new Date(
    today.getFullYear(),
    birthDate.getMonth(),
    birthDate.getDate()
  );
  const nextBirthday = thisYearBirthday < today
    ? new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate())
    : thisYearBirthday;

  // Calculate days until birthday
  const daysUntil = differenceInDays(nextBirthday, today);

  // Only show countdown within 30 days
  if (daysUntil > 30) return null;

  /**
   * Get badge variant based on days until birthday
   * 4-tier escalation: approaching (30d), soon (7d), imminent (3d), today
   */
  const getVariant = (days) => {
    if (days === 0) return 'birthday-today';
    if (days <= 3) return 'birthday-imminent';
    if (days <= 7) return 'birthday-soon';
    return 'birthday-approaching';
  };

  /**
   * Get natural language text for birthday countdown
   */
  const getText = (days) => {
    if (days === 0) return 'Birthday today!';
    if (days === 1) return 'Birthday tomorrow';
    return `in ${days} days`;
  };

  return (
    <Badge variant={getVariant(daysUntil)} className="flex items-center gap-1">
      <Cake className="w-3 h-3" />
      {getText(daysUntil)}
    </Badge>
  );
};

export default BirthdayBadge;
