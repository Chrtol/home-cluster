import { differenceInDays } from 'date-fns';
import { Cake } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * BirthdayBadge - Compact cake icon with birthday countdown
 *
 * Redesigned: Small circular badge with cake icon and native tooltip.
 * Colors: Violet/fuchsia gradient (celebratory, works well in dark mode).
 * Shows only within 30 days of birthday.
 */
const BirthdayBadge = ({ dateOfBirth }) => {
  if (!dateOfBirth) return null;

  const today = new Date();
  const birthDate = new Date(dateOfBirth);

  // Calculate next birthday
  const thisYearBirthday = new Date(
    today.getFullYear(),
    birthDate.getMonth(),
    birthDate.getDate()
  );
  const nextBirthday = thisYearBirthday < today
    ? new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate())
    : thisYearBirthday;

  const daysUntil = differenceInDays(nextBirthday, today);

  // Only show within 30 days
  if (daysUntil > 30) return null;

  // Color intensity increases as birthday approaches
  const getColors = (days) => {
    if (days === 0) return {
      bg: 'bg-fuchsia-500',
      text: 'text-white',
      glow: 'shadow-lg shadow-fuchsia-500/40',
      animate: 'animate-pulse'
    };
    if (days <= 3) return {
      bg: 'bg-fuchsia-500/30',
      text: 'text-fuchsia-300',
      glow: 'shadow-sm shadow-fuchsia-500/20'
    };
    if (days <= 7) return {
      bg: 'bg-violet-500/25',
      text: 'text-violet-400'
    };
    return {
      bg: 'bg-violet-500/15',
      text: 'text-violet-400/70'
    };
  };

  const getText = (days) => {
    if (days === 0) return 'Birthday today! 🎉';
    if (days === 1) return 'Birthday tomorrow!';
    return `Birthday in ${days} days`;
  };

  const colors = getColors(daysUntil);

  return (
    <div
      className={cn(
        "flex items-center justify-center w-6 h-6 rounded-full",
        "cursor-help transition-all",
        colors.bg, colors.text, colors.glow, colors.animate
      )}
      title={getText(daysUntil)}
    >
      <Cake className="w-3.5 h-3.5" />
    </div>
  );
};

export default BirthdayBadge;
