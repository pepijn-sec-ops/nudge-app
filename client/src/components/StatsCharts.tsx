import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const coral = '#e07a5f';
const sage = '#81b29a';
const gold = '#f2cc8f';
const ink = '#3d405b';

const tipStyle = {
  borderRadius: 16,
  border: '1px solid rgba(0,0,0,0.08)',
  fontWeight: 600,
};

export type StatsChartModel = {
  weeklySplit: { date: string; focusMinutes: number; workMinutes: number; total: number }[];
  last30Days: { date: string; focusMinutes: number; workMinutes: number; total: number }[];
  dayOfWeek: { label: string; minutes: number }[];
  hourBuckets: { hour: number; minutes: number }[];
  focusVsWork: { focusMinutes: number; workMinutes: number; focusPct: number; workPct: number };
  xpProgress: { level: number; currentXpInLevel: number; xpToNext: number };
  primary?: string;
};

export function StatsCharts({ data }: { data: StatsChartModel }) {
  const primary = data.primary || coral;
  const fv = data.focusVsWork ?? { focusMinutes: 0, workMinutes: 0, focusPct: 0, workPct: 0 };
  const xpProgress = data.xpProgress ?? { level: 1, currentXpInLevel: 0, xpToNext: 100 };

  const last30 = (data.last30Days ?? []).map((d) => ({
    ...d,
    short: (d.date || '').slice(5) || '—',
  }));
  const week = (data.weeklySplit ?? []).map((d) => ({ ...d, short: (d.date || '').slice(5) || '—' }));
  const dow = data.dayOfWeek ?? [];
  const hours = (data.hourBuckets ?? []).map((h) => ({
    label: `${h.hour}h`,
    minutes: h.minutes,
  }));
  const pie = [
    { name: 'Focus', value: fv.focusMinutes || 0 },
    { name: 'Open work', value: fv.workMinutes || 0 },
  ];
  const xpFill = Math.min(100, Math.max(0, xpProgress.currentXpInLevel));
  const ringData = [
    { name: 'In level', value: xpFill },
    { name: 'To next', value: Math.max(0, 100 - xpFill) },
  ];

  const safeLast30 = last30.length ? last30 : [{ short: '—', focusMinutes: 0, workMinutes: 0, total: 0 }];
  const safeWeek = week.length ? week : [{ short: '—', focusMinutes: 0, workMinutes: 0, total: 0 }];
  const safeDow = dow.length ? dow : [{ label: '—', minutes: 0 }];
  const safeHours = hours.length ? hours : [{ label: '0h', minutes: 0 }];

  return (
    <div className="space-y-8 text-[color:var(--nudge-text)]">
      <section className="rounded-[2rem] border border-white/40 bg-white/60 p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-extrabold">30-day momentum</h3>
            <p className="text-sm opacity-70">Stacked focus vs open work (minutes per day).</p>
          </div>
        </div>
        <div className="mt-4 h-[300px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={200}>
            <AreaChart data={safeLast30} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nudge-cFocus" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={primary} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={primary} stopOpacity={0.15} />
                </linearGradient>
                <linearGradient id="nudge-cWork" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sage} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={sage} stopOpacity={0.12} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,64,91,0.12)" />
              <XAxis dataKey="short" tick={{ fill: ink, fontSize: 11 }} interval={4} />
              <YAxis tick={{ fill: ink, fontSize: 11 }} width={36} />
              <Tooltip contentStyle={tipStyle} />
              <Legend />
              <Area type="monotone" dataKey="focusMinutes" name="Focus" stackId="1" stroke={primary} fill="url(#nudge-cFocus)" />
              <Area type="monotone" dataKey="workMinutes" name="Work" stackId="1" stroke={sage} fill="url(#nudge-cWork)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-5 shadow-lg backdrop-blur-md">
          <h3 className="text-lg font-extrabold">This week (stacked)</h3>
          <p className="text-sm opacity-70">Daily split — last 7 days.</p>
          <div className="mt-4 h-[260px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={200}>
              <BarChart data={safeWeek} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,64,91,0.1)" vertical={false} />
                <XAxis dataKey="short" tick={{ fill: ink, fontSize: 11 }} />
                <YAxis tick={{ fill: ink, fontSize: 11 }} width={32} />
                <Tooltip contentStyle={tipStyle} />
                <Legend />
                <Bar dataKey="focusMinutes" name="Focus" stackId="a" fill={primary} radius={[10, 10, 0, 0]} />
                <Bar dataKey="workMinutes" name="Work" stackId="a" fill={sage} radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-5 shadow-lg backdrop-blur-md">
          <h3 className="text-lg font-extrabold">Lifetime mix</h3>
          <p className="text-sm opacity-70">
            Focus {fv.focusPct}% · Work {fv.workPct}%
          </p>
          <div className="mt-2 flex flex-col items-center gap-4 lg:flex-row lg:justify-center">
            <div className="h-[220px] w-full max-w-[260px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={160}>
                <PieChart>
                  <Pie
                    data={pie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={86}
                    paddingAngle={pie[0].value + pie[1].value > 0 ? 3 : 0}
                  >
                    <Cell fill={primary} />
                    <Cell fill={sage} />
                  </Pie>
                  <Tooltip contentStyle={tipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="max-w-xs text-sm font-semibold opacity-80">
              <p>
                Total focus logged: <strong className="text-[color:var(--nudge-text)]">{pie[0].value} min</strong>
              </p>
              <p className="mt-1">
                Open work logged: <strong className="text-[color:var(--nudge-text)]">{pie[1].value} min</strong>
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-white/40 bg-white/60 p-5 shadow-lg backdrop-blur-md">
          <h3 className="text-lg font-extrabold">Rhythm by weekday</h3>
          <p className="text-sm opacity-70">When you tend to log the most minutes (all session types).</p>
          <div className="mt-4 h-[240px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={200}>
              <BarChart data={safeDow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,64,91,0.1)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: ink, fontSize: 11 }} />
                <YAxis tick={{ fill: ink, fontSize: 11 }} width={36} />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="minutes" name="Minutes" fill={gold} radius={[12, 12, 0, 0]} stroke={ink} strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/40 bg-white/60 p-5 shadow-lg backdrop-blur-md">
          <h3 className="text-lg font-extrabold">Clock spread (local)</h3>
          <p className="text-sm opacity-70">Minutes completed by hour of day (local time).</p>
          <div className="mt-4 h-[240px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={200}>
              <LineChart data={safeHours} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,64,91,0.1)" />
                <XAxis dataKey="label" tick={{ fill: ink, fontSize: 9 }} interval={2} />
                <YAxis tick={{ fill: ink, fontSize: 11 }} width={36} />
                <Tooltip contentStyle={tipStyle} />
                <Line type="monotone" dataKey="minutes" name="Minutes" stroke={primary} strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-5 shadow-lg backdrop-blur-md">
        <h3 className="text-lg font-extrabold">Level ring (100 XP / level)</h3>
        <p className="text-sm opacity-70">Progress inside your current level.</p>
        <div className="mx-auto mt-4 flex max-w-md flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <div className="h-[200px] w-[200px] min-w-[200px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={200}>
              <PieChart>
                <Pie
                  data={ringData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={92}
                  startAngle={90}
                  endAngle={-270}
                  stroke={ink}
                  strokeWidth={1}
                >
                  <Cell fill={primary} />
                  <Cell fill="rgba(0,0,0,0.08)" />
                </Pie>
                <Tooltip contentStyle={tipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center text-sm font-semibold">
            <p className="text-3xl font-black">Lv {xpProgress.level}</p>
            <p className="mt-1 opacity-80">
              {xpProgress.currentXpInLevel} / 100 XP in this level
            </p>
            <p className="mt-1 text-xs opacity-60">{xpProgress.xpToNext} XP to next level</p>
          </div>
        </div>
      </section>
    </div>
  );
}
