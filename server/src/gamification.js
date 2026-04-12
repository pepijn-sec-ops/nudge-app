const XP_PER_LEVEL = 100;

export function levelFromXp(xp) {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function xpIntoLevel(xp) {
  const level = levelFromXp(xp);
  const current = xp % XP_PER_LEVEL;
  return { level, currentXpInLevel: current, xpToNext: XP_PER_LEVEL - current };
}

const BADGE_DEFS = [
  { id: 'early_bird', name: 'Early Bird', desc: 'Complete a focus session before 9:00 local time.' },
  { id: 'deep_diver', name: 'Deep Diver', desc: 'Single session of 50+ minutes.' },
  { id: 'marathon', name: 'Marathon', desc: '1000+ total focus minutes.' },
  { id: 'consistent', name: 'Consistent', desc: '10 completed sessions.' },
  { id: 'zen_master', name: 'Zen Master', desc: 'Reach level 5.' },
];

export function listBadgeDefs() {
  return BADGE_DEFS;
}

/**
 * @param {{ type: string, durationMinutes: number, localHour?: number }} session
 * @param {{ totalFocusMinutes: number, completedSessions: number }} stats
 */
export function computeNewBadges(userBadges, session, stats) {
  const have = new Set(userBadges || []);
  const earned = [];

  if (
    (session.type === 'focus' || session.type === 'work') &&
    session.durationMinutes >= 50 &&
    !have.has('deep_diver')
  ) {
    earned.push('deep_diver');
  }
  if (
    session.type === 'focus' &&
    typeof session.localHour === 'number' &&
    session.localHour < 9 &&
    !have.has('early_bird')
  ) {
    earned.push('early_bird');
  }
  if (stats.totalFocusMinutes >= 1000 && !have.has('marathon')) {
    earned.push('marathon');
  }
  if (stats.completedSessions >= 10 && !have.has('consistent')) {
    earned.push('consistent');
  }
  if (levelFromXp(stats.xpAfter) >= 5 && !have.has('zen_master')) {
    earned.push('zen_master');
  }

  return earned.filter((id) => !have.has(id));
}

const AVATAR_UNLOCK_LEVELS = {
  ghost: 2,
  rocket: 3,
  target: 4,
  star: 5,
  bolt: 6,
  leaf: 7,
};

export function unlockedAvatarsForLevel(level) {
  const base = ['smile', 'heart', 'sparkle'];
  const extra = Object.entries(AVATAR_UNLOCK_LEVELS)
    .filter(([, lv]) => level >= lv)
    .map(([id]) => id);
  return [...new Set([...base, ...extra])];
}

export const THEME_IDS = ['cozy', 'midnight', 'night_owl', 'minimal_zen'];

export function unlockedThemesForLevel(level) {
  const all = THEME_IDS;
  if (level >= 6) return all;
  if (level >= 4) return ['cozy', 'midnight', 'night_owl'];
  if (level >= 2) return ['cozy', 'midnight'];
  return ['cozy'];
}
