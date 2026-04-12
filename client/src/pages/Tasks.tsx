import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { api, type Task } from '../lib/api';

const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
const priorityColors: Record<string, string> = {
  critical: 'bg-rose-500 text-white',
  high: 'bg-orange-500 text-white',
  normal: 'bg-sky-500 text-white',
  low: 'bg-slate-400 text-white',
};

export default function Tasks() {
  const nav = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('active');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('normal');
  const [estimate, setEstimate] = useState(25);

  async function load() {
    const data = await api<{ tasks: Task[] }>('/api/tasks');
    setTasks(data.tasks);
  }

  useEffect(() => {
    void load();
  }, []);

  const sorted = useMemo(() => {
    const f = tasks.filter((t) => {
      if (filter === 'active' && t.completed) return false;
      if (filter === 'done' && !t.completed) return false;
      if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    return f.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const pa = priorityOrder[a.priority] ?? 9;
      const pb = priorityOrder[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks, filter, q]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, priority, estimateMinutes: estimate }),
    });
    setTitle('');
    await load();
  }

  async function patch(id: string, body: Partial<Task>) {
    await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    await load();
  }

  async function remove(id: string) {
    await api(`/api/tasks/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-6 shadow-xl backdrop-blur-md">
        <h1 className="text-2xl font-extrabold text-[color:var(--nudge-text)]">Tasks</h1>
        <p className="mt-1 text-sm opacity-75">Pin favorites to your home board and play them instantly.</p>
        <form className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]" onSubmit={addTask}>
          <input
            className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 font-semibold outline-none ring-[color:var(--nudge-primary)] focus:ring-2"
            placeholder="What needs your attention?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className="rounded-2xl border border-black/10 bg-white/80 px-3 py-3 font-semibold"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task['priority'])}
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          <input
            type="number"
            min={1}
            className="rounded-2xl border border-black/10 bg-white/80 px-3 py-3 font-semibold"
            value={estimate}
            onChange={(e) => setEstimate(Number(e.target.value) || 25)}
          />
          <button
            type="submit"
            className="rounded-[2rem] bg-[color:var(--nudge-primary)] px-5 py-3 font-extrabold text-white shadow"
          >
            Add
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-[200px] flex-1 rounded-2xl border border-black/10 bg-white/80 px-4 py-2 font-semibold"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {(['all', 'active', 'done'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-2xl px-4 py-2 text-sm font-bold capitalize ${
              filter === k ? 'bg-[color:var(--nudge-primary)] text-white' : 'bg-white/70'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {sorted.map((t) => (
          <motion.div
            layout
            key={t.id}
            className="flex flex-col gap-3 rounded-[2rem] border border-white/40 bg-white/60 p-4 shadow-md backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="text-left">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${priorityColors[t.priority]}`}>
                  {t.priority}
                </span>
                {t.pinned && (
                  <span className="rounded-full bg-[color:var(--nudge-accent)] px-3 py-1 text-xs font-extrabold text-[color:var(--nudge-text)]">
                    Pinned
                  </span>
                )}
              </div>
              <p className={`mt-2 text-lg font-bold ${t.completed ? 'line-through opacity-60' : ''}`}>
                {t.title}
              </p>
              <p className="text-sm opacity-70">
                Est. {t.estimateMinutes} min · Logged {t.actualMinutesLogged} min
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-[2rem] bg-[color:var(--nudge-accent)] px-4 py-2 text-sm font-extrabold text-[color:var(--nudge-text)] shadow disabled:opacity-40"
                disabled={t.completed}
                onClick={() =>
                  nav('focus', {
                    state: { taskId: t.id, taskTitle: t.title, minutes: Math.max(5, t.estimateMinutes) },
                  })
                }
              >
                Play
              </button>
              <button
                type="button"
                className="rounded-2xl bg-white/80 px-3 py-2 text-sm font-bold"
                onClick={() => void patch(t.id, { pinned: !t.pinned })}
              >
                {t.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                type="button"
                className="rounded-2xl bg-white/80 px-3 py-2 text-sm font-bold"
                onClick={() => void patch(t.id, { completed: !t.completed })}
              >
                {t.completed ? 'Reopen' : 'Complete'}
              </button>
              <button
                type="button"
                className="rounded-2xl px-3 py-2 text-sm font-bold text-rose-600"
                onClick={() => void remove(t.id)}
              >
                Delete
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
