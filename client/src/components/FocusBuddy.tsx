import { motion } from 'motion/react';

type BuddyId = 'luna' | 'bolt' | 'pip' | 'bruno';

export type BoltLook = { body: string; hat: boolean; glasses: boolean };

export function FocusBuddy({
  buddyId,
  active,
  paused,
  className = '',
  boltLook: _boltLook,
}: {
  buddyId: BuddyId;
  active: boolean;
  paused: boolean;
  className?: string;
  boltLook?: BoltLook;
}) {
  const isWorking = active && !paused;
  const srcMap: Record<BuddyId, string> = {
    luna: '/buddies/luna.png',
    bolt: '/buddies/bolt.png',
    pip: '/buddies/pip.png',
    bruno: '/buddies/bruno.png',
  };
  const src = srcMap[buddyId] || '/buddies/luna.png';
  const buddyMotion: Record<BuddyId, { animate: Record<string, number[]> | { y: number }; duration: number }> = {
    luna: { animate: isWorking ? { y: [0, -5, 0], rotate: [0, -2, 0] } : { y: 0 }, duration: 2.4 },
    pip: { animate: isWorking ? { y: [0, -8, 0], rotate: [0, 2, 0, -2, 0] } : { y: 0 }, duration: 1.3 },
    bruno: { animate: isWorking ? { y: [0, -4, 0], scale: [1, 1.03, 1] } : { y: 0 }, duration: 1.7 },
    bolt: { animate: isWorking ? { y: [0, -6, 0] } : { y: 0 }, duration: 2.2 },
  };
  const motionCfg = buddyMotion[buddyId];

  return (
    <motion.div
      className={`mx-auto w-48 max-w-[55vw] ${className}`}
      animate={motionCfg.animate}
      transition={{ repeat: Infinity, duration: motionCfg.duration, ease: 'easeInOut' }}
      aria-hidden
    >
      <img src={src} alt={`${buddyId} focus buddy`} className="w-full h-full object-contain drop-shadow-xl" />
    </motion.div>
  );
}
