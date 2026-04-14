import { motion } from 'motion/react';

export type MoodValue = 'energized' | 'steady' | 'drained';

export function MoodCheckIn({
  open,
  title,
  onPick,
  onSkip,
}: {
  open: boolean;
  title: string;
  onPick: (m: MoodValue) => void;
  onSkip: () => void;
}) {
  if (!open) return null;
  const btn =
    'rounded-[2rem] px-5 py-3 font-semibold shadow-md border-2 border-[color:var(--nudge-text)]/10';
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 p-4 sm:items-center"
      onClick={onSkip}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-[2rem] border border-white/30 bg-[color:var(--nudge-card)] p-6 text-[color:var(--nudge-text)] shadow-2xl backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-1 text-sm opacity-80">Quick check-in (optional)</p>
        <div className="mt-5 grid gap-3">
          <button
            type="button"
            className={`${btn} bg-emerald-100/80 hover:bg-emerald-200`}
            onClick={() => onPick('energized')}
          >
            Energized
          </button>
          <button
            type="button"
            className={`${btn} bg-amber-100/80 hover:bg-amber-200`}
            onClick={() => onPick('steady')}
          >
            Steady
          </button>
          <button
            type="button"
            className={`${btn} bg-rose-100/80 hover:bg-rose-200`}
            onClick={() => onPick('drained')}
          >
            Drained
          </button>
          <button type="button" className="text-sm underline opacity-70" onClick={onSkip}>
            Skip for now
          </button>
        </div>
      </motion.div>
    </div>
  );
}
