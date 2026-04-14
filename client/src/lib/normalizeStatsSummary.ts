import type { StatsChartModel } from '../components/StatsCharts';

export type StatsSummary = {
  xp: number;
  level: number;
  xpProgress: { level: number; currentXpInLevel: number; xpToNext: number };
  badges: string[];
  badgeDefs: { id: string; name: string; desc: string }[];
  totalFocusMinutes: number;
  totalWorkMinutes: number;
  completedSessions: number;
  focusSessionCount: number;
  workSessionCount: number;
  minutesToday: number;
  dailyGoalMinutes: number;
  weekly: { date: string; minutes: number }[];
  weeklySplit: { date: string; focusMinutes: number; workMinutes: number; total: number }[];
  last30Days: { date: string; focusMinutes: number; workMinutes: number; total: number }[];
  dayOfWeek: { label: string; minutes: number }[];
  hourBuckets: { hour: number; minutes: number }[];
  focusVsWork: { focusMinutes: number; workMinutes: number; focusPct: number; workPct: number };
  avgFocusSession: number;
  streakDays: number;
  streak?: { current: number; best: number; graceUsed: boolean };
  timeline: { kind: string; at: string; payload: Record<string, unknown> }[];
  moods: { mood: string; createdAt: string }[];
};

function daysBack(n: number): StatsSummary['last30Days'] {
  const out: StatsSummary['last30Days'] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const label = d.toISOString().slice(0, 10);
    out.push({ date: label, focusMinutes: 0, workMinutes: 0, total: 0 });
  }
  return out;
}

export function normalizeStatsSummary(raw: unknown): StatsSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const z = (n: unknown, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n : d);
  const fv = r.focusVsWork as Record<string, unknown> | undefined;
  const focusVsWork = {
    focusMinutes: z(fv?.focusMinutes),
    workMinutes: z(fv?.workMinutes),
    focusPct: z(fv?.focusPct),
    workPct: z(fv?.workPct),
  };
  const xp = r.xpProgress as Record<string, unknown> | undefined;
  const xpProgress = {
    level: z(xp?.level, 1),
    currentXpInLevel: z(xp?.currentXpInLevel, 0),
    xpToNext: z(xp?.xpToNext, 100),
  };
  const weeklySplit = Array.isArray(r.weeklySplit) ? (r.weeklySplit as StatsSummary['weeklySplit']) : [];
  const last30Days = Array.isArray(r.last30Days) ? (r.last30Days as StatsSummary['last30Days']) : [];
  const dayOfWeek = Array.isArray(r.dayOfWeek) ? (r.dayOfWeek as StatsSummary['dayOfWeek']) : [];
  const hourBuckets = Array.isArray(r.hourBuckets)
    ? (r.hourBuckets as StatsSummary['hourBuckets'])
    : Array.from({ length: 24 }, (_, hour) => ({ hour, minutes: 0 }));

  const streakRaw = r.streak as Record<string, unknown> | undefined;
  const streak =
    streakRaw && typeof streakRaw === 'object'
      ? {
          current: z(streakRaw.current),
          best: z(streakRaw.best),
          graceUsed: !!streakRaw.graceUsed,
        }
      : undefined;

  return {
    xp: z(r.xp),
    level: z(r.level, 1),
    xpProgress,
    badges: Array.isArray(r.badges) ? (r.badges as string[]) : [],
    badgeDefs: Array.isArray(r.badgeDefs) ? (r.badgeDefs as StatsSummary['badgeDefs']) : [],
    totalFocusMinutes: z(r.totalFocusMinutes),
    totalWorkMinutes: z(r.totalWorkMinutes),
    completedSessions: z(r.completedSessions),
    focusSessionCount: z(r.focusSessionCount),
    workSessionCount: z(r.workSessionCount),
    minutesToday: z(r.minutesToday),
    dailyGoalMinutes: z(r.dailyGoalMinutes, 60),
    weekly: Array.isArray(r.weekly) ? (r.weekly as StatsSummary['weekly']) : [],
    weeklySplit: weeklySplit.length ? weeklySplit : daysBack(7),
    last30Days: last30Days.length ? last30Days : daysBack(30),
    dayOfWeek: dayOfWeek.length ? dayOfWeek : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => ({ label, minutes: 0 })),
    hourBuckets,
    focusVsWork,
    avgFocusSession: z(r.avgFocusSession),
    streakDays: z(r.streakDays),
    streak,
    timeline: Array.isArray(r.timeline) ? (r.timeline as StatsSummary['timeline']) : [],
    moods: Array.isArray(r.moods) ? (r.moods as StatsSummary['moods']) : [],
  };
}

export function toChartModel(data: StatsSummary, primary?: string): StatsChartModel {
  return {
    weeklySplit: data.weeklySplit,
    last30Days: data.last30Days,
    dayOfWeek: data.dayOfWeek,
    hourBuckets: data.hourBuckets,
    focusVsWork: data.focusVsWork,
    xpProgress: data.xpProgress,
    primary,
  };
}
