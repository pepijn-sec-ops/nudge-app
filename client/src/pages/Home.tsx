import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { api, apiWithOfflineQueue, type Note, type Task } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type Summary = {
  minutesToday: number;
  dailyGoalMinutes: number;
  xp: number;
  level: number;
  focusingCount?: number;
  streak?: { current: number; best: number; graceUsed: boolean };
  systemNudge?: { message: string; updatedAt: string | null };
};

export default function Home() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [nudgeVisible, setNudgeVisible] = useState(true);
  const [quickNote, setQuickNote] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [t, n, s, p] = await Promise.all([
          api<{ tasks: Task[] }>('/api/tasks'),
          api<{ notes: Note[] }>('/api/notes'),
          api<{
            minutesToday: number;
            dailyGoalMinutes: number;
            xp: number;
            level: number;
          }>('/api/stats/summary'),
          api<{ focusingCount: number }>('/api/presence/global'),
        ]);
        setTasks(t.tasks);
        setNotes((n.notes || []).filter((x) => x.pinned));
        setSummary({ ...s, focusingCount: p.focusingCount });
      } catch {
        /* offline */
      }
    })();
  }, []);

  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const p = await api<{ focusingCount: number }>('/api/presence/global');
        setSummary((prev) => (prev ? { ...prev, focusingCount: p.focusingCount } : prev));
      } catch {
        /* ignore */
      }
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const msg = summary?.systemNudge?.message?.trim();
    const at = summary?.systemNudge?.updatedAt;
    if (!msg) {
      setNudgeVisible(false);
      return;
    }
    const key = at ? `nudge_sys_${at}` : `nudge_sys_${msg}`;
    if (sessionStorage.getItem(key)) setNudgeVisible(false);
    else setNudgeVisible(true);
  }, [summary?.systemNudge?.message, summary?.systemNudge?.updatedAt]);

  const pinned = useMemo(() => {
    return tasks
      .filter((x) => x.pinned && !x.completed)
      .sort((a, b) => {
        const pr: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
        return pr[a.priority] - pr[b.priority];
      });
  }, [tasks]);

  const msg =
    user?.preferences?.motivationalMessages?.[
      Math.floor(Math.random() * (user.preferences.motivationalMessages.length || 1))
    ] || 'Gentle momentum beats perfect plans.';

  const goal = summary?.dailyGoalMinutes || user?.preferences?.dailyGoalMinutes || 60;
  const today = summary?.minutesToday ?? 0;
  const pct = Math.min(100, Math.round((today / Math.max(goal, 1)) * 100));

  const nudgeMsg = summary?.systemNudge?.message?.trim();
  const nudgeAt = summary?.systemNudge?.updatedAt;
  const streak = summary?.streak;

  async function saveQuickNote(pinned = false) {
    const content = quickNote.trim();
    if (!content) return;
    try {
      await apiWithOfflineQueue('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ content, pinned, context: 'general' }),
      });
      setQuickNote('');
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-8">
      {nudgeVisible && nudgeMsg && (
        <motion.div
          layout
          role="status"
          className="flex flex-col gap-3 rounded-[2rem] border border-[color:var(--nudge-primary)]/35 bg-[color:var(--nudge-card)] p-4 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--nudge-primary)]">System nudge</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--nudge-text)]">{nudgeMsg}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-[2rem] bg-black/5 px-4 py-2 text-sm font-extrabold text-[color:var(--nudge-text)] shadow-sm"
            onClick={() => {
              const key = nudgeAt ? `nudge_sys_${nudgeAt}` : `nudge_sys_${nudgeMsg}`;
              sessionStorage.setItem(key, '1');
              setNudgeVisible(false);
            }}
          >
            Dismiss
          </button>
        </motion.div>
      )}
      <section className="rounded-[2rem] border border-white/35 bg-white/60 p-6 shadow-lg backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide opacity-60">Today</p>
            <h1 className="mt-1 text-3xl font-extrabold text-[color:var(--nudge-text)]">
              Hi, {user?.name?.split(' ')[0] || 'friend'}
            </h1>
            <p className="mt-2 max-w-xl text-[color:var(--nudge-text)]/80">{msg}</p>
          </div>
          <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm font-semibold shadow-inner">
            <span className="text-[color:var(--nudge-primary)]">{summary?.focusingCount ?? '—'}</span>{' '}
            people focusing globally
          </div>
        </div>
        <div className="mt-6">
          <div className="flex justify-between text-sm font-semibold">
            <span>Daily focus</span>
            <span>
              {today} / {goal} min ({pct}%)
            </span>
          </div>
          <div className="mt-2 h-4 overflow-hidden rounded-full bg-black/10">
            <motion.div
              className="h-full rounded-full bg-[color:var(--nudge-primary)]"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 18 }}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-2xl bg-white/70 px-3 py-1 font-bold shadow-sm">
            Level {summary?.level ?? 1}
          </span>
          <span className="rounded-2xl bg-white/70 px-3 py-1 font-bold shadow-sm">
            {summary?.xp ?? user?.xp ?? 0} XP
          </span>
          <Link
            to="/focus"
            className="ml-auto rounded-[2rem] bg-[color:var(--nudge-primary)] px-5 py-2 font-bold text-white shadow-md"
          >
            Start focus
          </Link>
        </div>
        {streak && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-2xl bg-white/70 px-3 py-1 shadow-sm">Streak: {streak.current} days</span>
            <span className="rounded-2xl bg-white/70 px-3 py-1 shadow-sm">Best: {streak.best} days</span>
            {streak.graceUsed && (
              <span className="rounded-2xl bg-amber-100 px-3 py-1 text-amber-900 shadow-sm">Grace day used</span>
            )}
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-6 shadow-lg backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-[color:var(--nudge-text)]">Quick actions</h2>
          <Link to="stats" className="text-sm font-semibold underline">
            View timeline
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => nav('/focus', { state: { minutes: 25 } })}
            className="rounded-[2rem] bg-[color:var(--nudge-primary)] px-4 py-2 text-sm font-extrabold text-white shadow"
          >
            Start Focus 25
          </button>
          <button
            type="button"
            onClick={() => nav('work')}
            className="rounded-[2rem] bg-[color:var(--nudge-accent)] px-4 py-2 text-sm font-extrabold text-[color:var(--nudge-text)] shadow"
          >
            Resume Work
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            className="flex-1 rounded-2xl border border-black/10 bg-white/80 px-4 py-2 font-semibold"
            placeholder="Capture note quickly..."
          />
          <button
            type="button"
            onClick={() => void saveQuickNote(false)}
            className="rounded-[2rem] bg-[color:var(--nudge-primary)] px-4 py-2 text-sm font-extrabold text-white shadow"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => void saveQuickNote(true)}
            className="rounded-[2rem] bg-white/80 px-4 py-2 text-sm font-extrabold shadow"
          >
            Pin
          </button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-[color:var(--nudge-text)]">Pinned tasks</h2>
          <Link to="tasks" className="text-sm font-semibold underline">
            Manage tasks
          </Link>
        </div>
        <div className="grid gap-3">
          {pinned.length === 0 && (
            <p className="rounded-[2rem] border border-dashed border-black/15 bg-white/40 p-6 text-center text-sm opacity-70">
              Pin tasks from the Tasks page to launch them instantly from home.
            </p>
          )}
          {pinned.map((t) => (
            <motion.div
              key={t.id}
              layout
              className="flex flex-col gap-3 rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-4 shadow-md backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--nudge-primary)]">
                  {t.priority}
                </p>
                <p className="text-lg font-bold text-[color:var(--nudge-text)]">{t.title}</p>
                <p className="text-sm opacity-70">Est. {t.estimateMinutes} min · Logged {t.actualMinutesLogged} min</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  nav('/focus', {
                    state: {
                      taskId: t.id,
                      taskTitle: t.title,
                      minutes: Math.max(5, t.estimateMinutes || 25),
                    },
                  })
                }
                className="rounded-[2rem] bg-[color:var(--nudge-accent)] px-6 py-3 text-base font-extrabold text-[color:var(--nudge-text)] shadow"
              >
                Play
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-[color:var(--nudge-text)]">Pinned notes</h2>
          <Link to="notes" className="text-sm font-semibold underline">
            Open notes
          </Link>
        </div>
        <div className="grid gap-3">
          {notes.length === 0 && (
            <p className="rounded-[2rem] border border-dashed border-black/15 bg-white/40 p-6 text-center text-sm opacity-70">
              Pin notes from the Notes page to keep ideas visible here.
            </p>
          )}
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-4 shadow-md backdrop-blur-sm"
            >
              <p className="font-semibold text-[color:var(--nudge-text)]">{n.content}</p>
              <p className="mt-1 text-xs opacity-65 capitalize">{n.context}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
