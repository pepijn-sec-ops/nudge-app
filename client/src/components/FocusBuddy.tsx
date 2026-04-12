import { motion } from 'motion/react';

type BuddyId = 'luna' | 'bolt' | 'pip';

export type BoltLook = { body: string; hat: boolean; glasses: boolean };

export function FocusBuddy({
  buddyId,
  active,
  paused,
  className = '',
  boltLook,
}: {
  buddyId: BuddyId;
  active: boolean;
  paused: boolean;
  className?: string;
  boltLook?: BoltLook;
}) {
  const bob = active && !paused ? { y: [0, -6, 0] } : { y: 0 };
  const dur = active && !paused ? 2.2 : 4;

  return (
    <motion.div
      className={`mx-auto w-48 max-w-[55vw] ${className}`}
      animate={bob}
      transition={{ repeat: Infinity, duration: dur, ease: 'easeInOut' }}
      aria-hidden
    >
      {buddyId === 'luna' && <Luna working={active && !paused} />}
      {buddyId === 'bolt' && (
        <Bolt working={active && !paused} look={boltLook || { body: '#81b29a', hat: false, glasses: false }} />
      )}
      {buddyId === 'pip' && <Pip working={active && !paused} />}
    </motion.div>
  );
}

function Luna({ working }: { working: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className="drop-shadow-xl">
      <defs>
        <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#f2cc8f" />
          <stop offset="100%" stopColor="#e07a5f" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="150" rx="70" ry="18" fill="rgba(61,64,91,0.12)" />
      <motion.circle
        cx="100"
        cy="95"
        r="72"
        fill="url(#lg)"
        animate={{ scale: working ? [1, 1.03, 1] : 1 }}
        transition={{ repeat: Infinity, duration: 3 }}
      />
      <ellipse cx="100" cy="110" rx="52" ry="40" fill="#fff8f0" opacity="0.9" />
      <motion.ellipse
        rx="8"
        ry={working ? 10 : 6}
        cx="78"
        cy="88"
        fill="#3d405b"
        animate={{ scaleY: working ? [1, 0.3, 1] : 1 }}
        transition={{ repeat: Infinity, duration: working ? 2.8 : 0 }}
      />
      <motion.ellipse
        rx="8"
        ry={working ? 10 : 6}
        cx="122"
        cy="88"
        fill="#3d405b"
        animate={{ scaleY: working ? [1, 0.3, 1] : 1 }}
        transition={{ repeat: Infinity, duration: working ? 2.8 : 0, delay: 0.05 }}
      />
      <path
        d="M88 118 Q100 128 112 118"
        stroke="#3d405b"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <motion.path
        d="M40 70 Q20 40 55 55"
        stroke="#3d405b"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        animate={{ rotate: working ? [0, 6, 0] : [0, 2, 0] }}
        style={{ transformOrigin: '55px 55px' }}
        transition={{ repeat: Infinity, duration: working ? 1.6 : 3 }}
      />
      <motion.path
        d="M160 70 Q180 40 145 55"
        stroke="#3d405b"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        animate={{ rotate: working ? [0, -6, 0] : [0, -2, 0] }}
        style={{ transformOrigin: '145px 55px' }}
        transition={{ repeat: Infinity, duration: working ? 1.6 : 3 }}
      />
    </svg>
  );
}

function Bolt({ working, look }: { working: boolean; look: BoltLook }) {
  const body = look.body || '#81b29a';
  return (
    <svg viewBox="0 0 200 200" className="drop-shadow-xl">
      <ellipse cx="100" cy="150" rx="60" ry="14" fill="rgba(61,64,91,0.1)" />
      {look.hat && (
        <path
          d="M52 52 Q100 12 148 52 L140 58 Q100 28 60 58Z"
          fill="#3d405b"
          stroke="#1e293b"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      <rect
        x="55"
        y="45"
        width="90"
        height="100"
        rx="28"
        fill={body}
        stroke="#3d405b"
        strokeWidth="4"
      />
      <motion.rect
        x="70"
        y="60"
        width="60"
        height="36"
        rx="10"
        fill="#0f172a"
        animate={{ opacity: working ? [0.85, 1, 0.85] : [0.5, 0.65, 0.5] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
      />
      {look.glasses ? (
        <g stroke="#1e293b" strokeWidth="3" fill="none">
          <circle cx="85" cy="78" r="10" fill="rgba(255,255,255,0.35)" />
          <circle cx="115" cy="78" r="10" fill="rgba(255,255,255,0.35)" />
          <path d="M95 78 h10" strokeLinecap="round" />
        </g>
      ) : (
        <>
          <circle cx="85" cy="78" r="6" fill="#38bdf8" />
          <circle cx="115" cy="78" r="6" fill="#38bdf8" />
        </>
      )}
      <motion.rect
        x="82"
        y="115"
        width="36"
        height="8"
        rx="4"
        fill="#f2cc8f"
        animate={{ x: working ? [82, 88, 82] : 82 }}
        transition={{ repeat: Infinity, duration: 0.8 }}
      />
      <path
        d="M100 40 L108 20 L116 40"
        fill="#f2cc8f"
        stroke="#3d405b"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <motion.g
        animate={{ rotate: working ? [0, 10, -10, 0] : 0 }}
        style={{ transformOrigin: '100px 120px' }}
        transition={{ repeat: Infinity, duration: 2.2 }}
      >
        <rect x="72" y="120" width="56" height="18" rx="8" fill="#e07a5f" stroke="#3d405b" strokeWidth="3" />
      </motion.g>
    </svg>
  );
}

function Pip({ working }: { working: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className="drop-shadow-xl">
      <ellipse cx="100" cy="150" rx="55" ry="12" fill="rgba(61,64,91,0.1)" />
      <motion.path
        d="M100 40 C60 55 50 120 100 140 C150 120 140 55 100 40Z"
        fill="#f2cc8f"
        stroke="#3d405b"
        strokeWidth="4"
        animate={{ y: working ? [0, -3, 0] : 0 }}
        transition={{ repeat: Infinity, duration: 1.4 }}
      />
      <circle cx="82" cy="88" r="7" fill="#3d405b" />
      <circle cx="118" cy="88" r="7" fill="#3d405b" />
      <path
        d="M90 108 Q100 118 110 108"
        stroke="#3d405b"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <motion.path
        d="M100 55 L120 35 L140 55"
        fill="#81b29a"
        stroke="#3d405b"
        strokeWidth="3"
        animate={{ rotate: working ? [0, 8, -8, 0] : [0, 3, -3, 0] }}
        style={{ transformOrigin: '100px 55px' }}
        transition={{ repeat: Infinity, duration: working ? 1.2 : 3 }}
      />
    </svg>
  );
}
