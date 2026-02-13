import { useState, useCallback } from 'react';
import { differenceInDays, differenceInMonths, startOfDay, format } from 'date-fns';
import { Cake } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * BirthdayBadge - Compact cake icon with birthday countdown
 *
 * Shows year-round with adaptive format:
 * - Today: "Birthday!" with confetti easter egg on click
 * - 1-7 days: "3d" with "Birthday in 3 days" tooltip
 * - 8-30 days: "15d" with actual date in tooltip
 * - 1-12 months: "6m" with actual date in tooltip
 *
 * Colors: Violet/fuchsia gradient (celebratory, works well in dark mode).
 */
const BirthdayBadge = ({ dateOfBirth }) => {
  const [confettiPieces, setConfettiPieces] = useState([]);

  if (!dateOfBirth) return null;

  const today = startOfDay(new Date());
  const birthDate = new Date(dateOfBirth);

  // Calculate next birthday (compare date-only to avoid time issues)
  const thisYearBirthday = new Date(
    today.getFullYear(),
    birthDate.getMonth(),
    birthDate.getDate()
  );
  const nextBirthday = thisYearBirthday < today
    ? new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate())
    : thisYearBirthday;

  const daysUntil = differenceInDays(nextBirthday, today);
  const monthsUntil = differenceInMonths(nextBirthday, today);

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
    if (days <= 30) return {
      bg: 'bg-violet-500/15',
      text: 'text-violet-400/70'
    };
    // Distant birthdays - very subtle
    return {
      bg: 'bg-slate-500/10',
      text: 'text-slate-400/60'
    };
  };

  // Tooltip text - show actual date when > 7 days
  const getText = (days) => {
    if (days === 0) return 'Birthday today! 🎉 (click for surprise)';
    if (days === 1) return 'Birthday tomorrow!';
    if (days <= 7) return `Birthday in ${days} days`;
    // Show actual date for > 7 days
    return `Birthday on ${format(nextBirthday, 'MMMM d')}`;
  };

  // Short display text for badge
  const getShortText = (days, months) => {
    if (days === 0) return 'Birthday!';
    if (days <= 30) return `${days}d`;
    // Show months for distant birthdays
    return `${months}m`;
  };

  // Confetti easter egg
  const spawnConfetti = useCallback(() => {
    if (daysUntil !== 0) return;

    const colors = ['#f0abfc', '#e879f9', '#d946ef', '#c026d3', '#a855f7', '#fbbf24', '#f472b6'];
    const newPieces = Array.from({ length: 30 }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 100 - 50,
      y: -(Math.random() * 100 + 50),
      rotation: Math.random() * 360,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      delay: Math.random() * 0.2,
    }));
    setConfettiPieces(newPieces);

    // Clear confetti after animation
    setTimeout(() => setConfettiPieces([]), 2000);
  }, [daysUntil]);

  const colors = getColors(daysUntil);
  const isBirthday = daysUntil === 0;

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-1 px-2 h-6 rounded-full text-xs font-medium",
          isBirthday ? "cursor-pointer" : "cursor-help",
          "transition-all",
          colors.bg, colors.text, colors.glow, colors.animate
        )}
        title={getText(daysUntil)}
        onClick={spawnConfetti}
      >
        <Cake className="w-3 h-3" />
        <span>{getShortText(daysUntil, monthsUntil)}</span>
      </div>

      {/* Confetti explosion */}
      <AnimatePresence>
        {confettiPieces.length > 0 && (
          <div className="absolute inset-0 pointer-events-none overflow-visible">
            {confettiPieces.map((piece) => (
              <motion.div
                key={piece.id}
                initial={{
                  x: 0,
                  y: 0,
                  rotate: 0,
                  opacity: 1,
                  scale: 0
                }}
                animate={{
                  x: piece.x,
                  y: piece.y,
                  rotate: piece.rotation,
                  opacity: 0,
                  scale: 1
                }}
                transition={{
                  duration: 1.5,
                  delay: piece.delay,
                  ease: "easeOut"
                }}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: piece.size,
                  height: piece.size,
                  backgroundColor: piece.color,
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BirthdayBadge;
