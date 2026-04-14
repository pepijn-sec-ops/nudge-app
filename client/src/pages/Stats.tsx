import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { StatsCharts } from '../components/StatsCharts';
import { normalizeStatsSummary, toChartModel, type StatsSummary } from '../lib/normalizeStatsSummary';

export default function Stats() {
  const { user } = useAuth();
  const [data, setData] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await api<unknown>('/api/stats/summary');
      const normalized = normalizeStatsSummary(raw);
      if (!normalized) {
        setError('Unexpected response from the server.');
        setData(null);
      } else {
        setData(normalized);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load stats.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const chartModel = useMemo(() => {
    if (!data) return null;
    return toChartModel(data, user?.preferences?.primaryColor);
  }, [data, user?.preferences?.primaryColor]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-[color:var(--nudge-text)]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[color:var(--nudge-primary)] border-t-transparent" />
        <p className="font-semibold opacity-80">Loading your charts…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg rounded-[2rem] border border-rose-200 bg-rose-50/90 p-8 text-center text-[color:var(--nudge-text)] shadow-lg">
        <h1 className="text-xl font-extrabold text-rose-900">Stats unavailable</h1>
        <p className="mt-2 text-sm text-rose-900/80">{error || 'No data.'}</p>
        <button
          type="button"
          className="mt-6 rounded-[2rem] bg-[color:var(--nudge-primary)] px-6 py-3 font-extrabold text-white shadow"
          onClick={() => void load()}
        >
          Try again
        </button>
      </div>
    );
  }

  const moodCounts = data.moods.reduce<Record<string, number>>((acc, m) => {
    acc[m.mood] = (acc[m.mood] || 0) + 1;
    return acc;
  }, {});

  const moodPie = Object.entries(moodCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="min-w-0 space-y-8 text-[color:var(--nudge-text)]">
      <div>
        <h1 className="text-3xl font-extrabold">Statistics</h1>
        <p className="mt-1 text-sm opacity-75">Your focus story, charts, and history.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total focus', value: `${data.totalFocusMinutes} min` },
          { label: 'Open work', value: `${data.totalWorkMinutes} min` },
          { label: 'Sessions', value: `${data.completedSessions} (${data.focusSessionCount}F / ${data.workSessionCount}W)` },
          { label: 'Level / XP', value: `Lv ${data.level} · ${data.xp} XP` },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-4 text-left shadow-lg backdrop-blur-md"
          >
            <p className="text-xs font-bold uppercase tracking-wide opacity-60">{c.label}</p>
            <p className="mt-2 text-2xl font-black">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[2rem] border border-white/40 bg-white/60 p-4 text-center shadow-md backdrop-blur-md">
          <p className="text-xs font-bold uppercase opacity-60">Daily streak</p>
          <p className="mt-1 text-4xl font-black text-[color:var(--nudge-primary)]">{data.streakDays}</p>
          <p className="text-xs opacity-70">
            {data.streak?.graceUsed
              ? `Best ${data.streak.best} days · grace day active`
              : `Best ${data.streak?.best ?? data.streakDays} days`}
          </p>
        </div>
        <div className="rounded-[2rem] border border-white/40 bg-white/60 p-4 text-center shadow-md backdrop-blur-md">
          <p className="text-xs font-bold uppercase opacity-60">Avg focus session</p>
          <p className="mt-1 text-4xl font-black">{data.avgFocusSession}</p>
          <p className="text-xs opacity-70">Minutes per completed focus session.</p>
        </div>
        <div className="rounded-[2rem] border border-white/40 bg-white/60 p-4 text-center shadow-md backdrop-blur-md">
          <p className="text-xs font-bold uppercase opacity-60">Today vs goal</p>
          <p className="mt-1 text-4xl font-black">
            {data.minutesToday}/{data.dailyGoalMinutes}
          </p>
          <p className="text-xs opacity-70">Minutes today vs daily goal.</p>
        </div>
      </div>

      {chartModel && <StatsCharts data={chartModel} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-6 shadow-lg backdrop-blur-md">
          <h2 className="text-xl font-extrabold">Badges</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.badgeDefs.map((b) => (
              <li
                key={b.id}
                className={`rounded-2xl border px-3 py-2 ${
                  data.badges.includes(b.id) ? 'border-[color:var(--nudge-primary)] bg-white/70' : 'border-transparent opacity-60'
                }`}
              >
                <span className="font-bold">{b.name}</span> — {b.desc}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-6 shadow-lg backdrop-blur-md">
          <h2 className="text-xl font-extrabold">Mood mix</h2>
          <p className="mt-2 text-sm opacity-75">Share of recent check-ins.</p>
          {moodPie.length > 0 ? (
            <div className="mt-4 h-[220px] w-full min-w-0">
              <div className="flex h-full flex-col justify-end gap-2">
                {moodPie.map((m) => {
                  const max = Math.max(1, ...moodPie.map((x) => x.value));
                  const w = Math.round((m.value / max) * 100);
                  return (
                    <div key={m.name}>
                      <div className="flex justify-between text-xs font-bold capitalize">
                        <span>{m.name}</span>
                        <span>{m.value}</span>
                      </div>
                      <motion.div className="mt-1 h-3 rounded-full bg-black/10" initial={false} animate={{ opacity: 1 }}>
                        <motion.div
                          className="h-3 rounded-full bg-[color:var(--nudge-primary)]"
                          initial={{ width: 0 }}
                          animate={{ width: `${w}%` }}
                          transition={{ type: 'spring', stiffness: 100, damping: 18 }}
                        />
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm opacity-60">No moods yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/40 bg-white/60 p-6 shadow-lg backdrop-blur-md">
        <h2 className="text-xl font-extrabold">Timeline</h2>
        <ul className="mt-4 space-y-3 text-left text-sm">
          {data.timeline.slice(0, 40).map((item, i) => (
            <li key={`${item.kind}-${i}`} className="rounded-2xl bg-white/70 px-3 py-2 font-semibold">
              <span className="text-xs uppercase opacity-60">{item.kind.replace('_', ' ')}</span>
              <div>
                {item.kind === 'focus_session' &&
                  `Focus · ${(item.payload as { durationMinutes?: number }).durationMinutes ?? 0} min`}
                {item.kind === 'work_session' &&
                  `Work · ${(item.payload as { projectName?: string }).projectName}`}
                {item.kind === 'task_completed' &&
                  `Task done · ${(item.payload as { title?: string }).title}`}
                {item.kind === 'note' &&
                  `Note · ${String((item.payload as { content?: string }).content || '').slice(0, 80)}`}
              </div>
              {(item.kind === 'focus_session' || item.kind === 'work_session') && (
                <div className="mt-1 text-xs opacity-70">
                  {(item.payload as { mood?: string | null }).mood
                    ? `Mood: ${(item.payload as { mood?: string }).mood}`
                    : 'Mood: none'}{' '}
                  · Notes linked: {(item.payload as { linkedNotesCount?: number }).linkedNotesCount ?? 0}
                </div>
              )}
              <div className="text-xs opacity-60">{new Date(item.at).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
