import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  xp: number;
  level: number;
  streakDays: number;
  badges: number;
  createdAt: string;
  taskCount: number;
  sessionCount: number;
  moodCount: number;
  totalFocusMinutes: number;
  totalWorkMinutes: number;
  lastSessionAt: string | null;
};

type InviteRow = {
  id: string;
  code: string;
  note: string;
  maxUses: number | null;
  uses: number;
  createdAt: string;
  active: boolean;
};

type AdminConfig = {
  globalXpMultiplier: number;
  registrationMode: 'open' | 'invite' | 'closed';
  inviteCodes: InviteRow[];
  systemNudge: { message: string; updatedAt: string | null };
};

type Overview = {
  totals: {
    users: number;
    sessions: number;
    tasks: number;
    moods: number;
    focusMinutes: number;
    workMinutes: number;
  };
  admins: number;
};

type Analytics = {
  signupsLast7: { date: string; count: number }[];
  sessionsLast7: { date: string; count: number; focusMinutes: number; workMinutes: number }[];
  topUsers: {
    id: string;
    name: string;
    email: string;
    role: string;
    xp: number;
    focusMinutes: number;
    workMinutes: number;
    sessionCount: number;
  }[];
};

const tip = { borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', fontWeight: 600 as const };
const coral = '#e07a5f';
const sage = '#81b29a';
const ink = '#3d405b';

export default function Admin() {
  const [tab, setTab] = useState<'overview' | 'controls' | 'access' | 'analytics' | 'users'>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState('');
  const [cfg, setCfg] = useState<AdminConfig | null>(null);
  const [multDraft, setMultDraft] = useState(1);
  const [broadcastDraft, setBroadcastDraft] = useState('');
  const [opsMsg, setOpsMsg] = useState('');
  const [regModeDraft, setRegModeDraft] = useState<'open' | 'invite' | 'closed'>('open');
  const [inviteNote, setInviteNote] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState('');
  const [inviteCustomCode, setInviteCustomCode] = useState('');
  const [accessMsg, setAccessMsg] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPw, setNewUserPw] = useState('');
  const [newUserAdmin, setNewUserAdmin] = useState(false);
  const [userCreateMsg, setUserCreateMsg] = useState('');

  const loadAll = useCallback(async () => {
    const [o, a, u, c] = await Promise.all([
      api<Overview>('/api/admin/overview'),
      api<Analytics>('/api/admin/analytics'),
      api<{ users: UserRow[] }>('/api/admin/users'),
      api<AdminConfig>('/api/admin/config'),
    ]);
    setOverview(o);
    setAnalytics(a);
    setUsers(u.users);
    setCfg(c);
    setMultDraft(c.globalXpMultiplier);
    setRegModeDraft(c.registrationMode ?? 'open');
    setBroadcastDraft(c.systemNudge?.message || '');
  }, []);

  useEffect(() => {
    void loadAll().catch(() => {});
  }, [loadAll]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => u.email.toLowerCase().includes(s) || u.name.toLowerCase().includes(s));
  }, [users, q]);

  const sessionSeries =
    analytics?.sessionsLast7.map((d) => ({
      ...d,
      short: d.date.slice(5),
    })) || [];

  return (
    <div className="admin-readable space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Admin panel</h1>
          <p className="mt-1 text-sm text-slate-300">
            Overview, access control, analytics, and full user management (create accounts, XP, roles).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="rounded-[2rem] bg-[color:var(--nudge-primary)] px-5 py-2 text-sm font-extrabold text-white shadow"
        >
          Refresh data
        </button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-2 shadow-inner backdrop-blur-md">
        {(
          [
            ['overview', 'Overview'],
            ['controls', 'Controls'],
            ['access', 'Access'],
            ['analytics', 'Analytics'],
            ['users', 'Users'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-[1.5rem] px-4 py-2 text-sm font-extrabold transition ${
              tab === id ? 'bg-[color:var(--nudge-primary)] text-white shadow' : 'hover:bg-white/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Users', value: overview.totals.users },
              { label: 'Sessions (all)', value: overview.totals.sessions },
              { label: 'Tasks (all)', value: overview.totals.tasks },
              { label: 'Mood logs', value: overview.totals.moods },
            ].map((c) => (
              <motion.div
                key={c.label}
                layout
                className="rounded-[2rem] border border-white/40 bg-white/70 p-4 text-left shadow-lg backdrop-blur-md"
              >
                <p className="text-xs font-bold uppercase tracking-wide opacity-60">{c.label}</p>
                <p className="mt-2 text-3xl font-black text-white">{c.value}</p>
              </motion.div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-5 shadow-lg backdrop-blur-md">
              <h3 className="text-lg font-extrabold text-white">Focus vs work (global)</h3>
              <p className="mt-1 text-sm opacity-70">All users, all time — minutes.</p>
              <p className="mt-4 text-4xl font-black text-[color:var(--nudge-primary)]">{overview.totals.focusMinutes}</p>
              <p className="text-sm font-semibold opacity-80">Focus minutes</p>
              <p className="mt-3 text-4xl font-black text-white">{overview.totals.workMinutes}</p>
              <p className="text-sm font-semibold opacity-80">Open work minutes</p>
            </div>
            <div className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-5 shadow-lg backdrop-blur-md">
              <h3 className="text-lg font-extrabold text-white">Roles</h3>
              <p className="mt-4 text-3xl font-black">{overview.admins}</p>
              <p className="text-sm opacity-70">Admin accounts</p>
              <p className="mt-3 text-3xl font-black">{Math.max(0, overview.totals.users - overview.admins)}</p>
              <p className="text-sm opacity-70">Standard users</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'controls' && cfg && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-lg font-extrabold text-white">Global XP multiplier</h3>
            <p className="mt-1 text-sm opacity-70">Applied when focus or work sessions log minutes (server-side).</p>
            <label className="mt-4 block text-sm font-bold text-white/90">
              Multiplier ({multDraft.toFixed(2)}×)
              <input
                type="range"
                min={0.25}
                max={3}
                step={0.05}
                className="mt-2 w-full"
                value={multDraft}
                onChange={(e) => setMultDraft(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="mt-4 rounded-[2rem] bg-[color:var(--nudge-primary)] px-5 py-2 text-sm font-extrabold text-white shadow"
              onClick={async () => {
                setOpsMsg('');
                await api('/api/admin/config', {
                  method: 'PATCH',
                  body: JSON.stringify({ globalXpMultiplier: multDraft }),
                });
                await loadAll();
                setOpsMsg('Multiplier saved.');
              }}
            >
              Save multiplier
            </button>
          </div>
          <div className="rounded-[2rem] border border-white/40 bg-white/60 p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-lg font-extrabold text-[color:var(--nudge-text)]">System nudge broadcast</h3>
            <p className="mt-1 text-sm opacity-70">Short banner on the home screen for all signed-in users.</p>
            <textarea
              className="mt-3 min-h-[120px] w-full rounded-2xl border border-black/10 bg-white/90 p-3 text-sm font-semibold text-[color:var(--nudge-text)] shadow-inner"
              value={broadcastDraft}
              onChange={(e) => setBroadcastDraft(e.target.value)}
              placeholder="Warm reminder from the team…"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-[2rem] bg-[color:var(--nudge-primary)] px-5 py-2 text-sm font-extrabold text-white shadow"
                onClick={async () => {
                  setOpsMsg('');
                  await api('/api/admin/broadcast', {
                    method: 'POST',
                    body: JSON.stringify({ message: broadcastDraft }),
                  });
                  await loadAll();
                  setOpsMsg('Broadcast sent.');
                }}
              >
                Send / update
              </button>
              <button
                type="button"
                className="rounded-[2rem] bg-white/80 px-5 py-2 text-sm font-extrabold text-[color:var(--nudge-text)] shadow"
                onClick={async () => {
                  setOpsMsg('');
                  setBroadcastDraft('');
                  await api('/api/admin/broadcast', { method: 'POST', body: JSON.stringify({ message: '' }) });
                  await loadAll();
                  setOpsMsg('Banner cleared.');
                }}
              >
                Clear
              </button>
            </div>
          </div>
          {opsMsg && (
            <p className="text-sm font-semibold text-white lg:col-span-2">{opsMsg}</p>
          )}
        </div>
      )}

      {tab === 'access' && cfg && (
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-lg font-extrabold text-white">Who can sign up?</h3>
            <p className="mt-1 text-sm opacity-70">
              <strong className="text-white/90">Open</strong> — anyone can register.{' '}
              <strong className="text-white/90">Invite</strong> — needs a code you create below.{' '}
              <strong className="text-white/90">Closed</strong> — only you create accounts (Users tab).
            </p>
            <label className="mt-4 block text-sm font-bold text-white/90">
              Registration mode
              <select
                className="mt-2 w-full max-w-md rounded-2xl border border-black/10 bg-white/90 px-3 py-2 font-semibold text-[color:var(--nudge-text)]"
                value={regModeDraft}
                onChange={(e) => setRegModeDraft(e.target.value as 'open' | 'invite' | 'closed')}
              >
                <option value="open">Open</option>
                <option value="invite">Invite codes</option>
                <option value="closed">Closed (admin creates users)</option>
              </select>
            </label>
            <button
              type="button"
              className="mt-4 rounded-[2rem] bg-[color:var(--nudge-primary)] px-5 py-2 text-sm font-extrabold text-white shadow"
              onClick={async () => {
                setAccessMsg('');
                await api('/api/admin/config', {
                  method: 'PATCH',
                  body: JSON.stringify({ registrationMode: regModeDraft }),
                });
                await loadAll();
                setAccessMsg('Access settings saved.');
              }}
            >
              Save access mode
            </button>
            {accessMsg && <p className="mt-3 text-sm font-semibold text-emerald-200">{accessMsg}</p>}
          </div>

          <div className="rounded-[2rem] border border-white/40 bg-white/60 p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-lg font-extrabold text-[color:var(--nudge-text)]">Invite codes</h3>
            <p className="mt-1 text-sm opacity-70">
              Share a code with someone you trust. Leave custom code empty to generate one. Max uses empty = unlimited.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-left text-xs font-bold uppercase text-[color:var(--nudge-text)]">
                Custom code (optional, 4+ chars)
                <input
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-white/90 px-3 py-2 font-mono text-sm font-semibold"
                  value={inviteCustomCode}
                  onChange={(e) => setInviteCustomCode(e.target.value)}
                  placeholder="Auto-generate if empty"
                />
              </label>
              <label className="block text-left text-xs font-bold uppercase text-[color:var(--nudge-text)]">
                Note (optional)
                <input
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-sm font-semibold"
                  value={inviteNote}
                  onChange={(e) => setInviteNote(e.target.value)}
                  placeholder="e.g. Sarah — January"
                />
              </label>
              <label className="block text-left text-xs font-bold uppercase text-[color:var(--nudge-text)]">
                Max uses (optional)
                <input
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-sm font-semibold"
                  value={inviteMaxUses}
                  onChange={(e) => setInviteMaxUses(e.target.value)}
                  placeholder="Unlimited"
                  type="number"
                  min={1}
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  className="w-full rounded-[2rem] bg-[color:var(--nudge-primary)] px-4 py-2 text-sm font-extrabold text-white shadow sm:mt-5"
                  onClick={async () => {
                    setAccessMsg('');
                    const maxRaw = inviteMaxUses.trim();
                    const body: Record<string, unknown> = {
                      note: inviteNote.trim(),
                      code: inviteCustomCode.trim() || undefined,
                    };
                    if (maxRaw) body.maxUses = Number(maxRaw);
                    await api('/api/admin/invites', { method: 'POST', body: JSON.stringify(body) });
                    setInviteNote('');
                    setInviteMaxUses('');
                    setInviteCustomCode('');
                    await loadAll();
                    setAccessMsg('New invite code created.');
                  }}
                >
                  Create code
                </button>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl border border-white/40">
              <table className="w-full min-w-[520px] text-left text-sm text-[color:var(--nudge-text)]">
                <thead className="bg-white/70 text-xs font-bold uppercase opacity-70">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Uses</th>
                    <th className="px-3 py-2">Note</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2"> </th>
                  </tr>
                </thead>
                <tbody>
                  {(cfg.inviteCodes || []).map((inv) => (
                    <tr key={inv.id} className="border-t border-black/10">
                      <td className="px-3 py-2 font-mono font-bold">{inv.code}</td>
                      <td className="px-3 py-2">
                        {inv.uses}
                        {inv.maxUses != null ? ` / ${inv.maxUses}` : ' / ∞'}
                      </td>
                      <td className="px-3 py-2 text-xs opacity-80">{inv.note || '—'}</td>
                      <td className="px-3 py-2 text-xs font-semibold">{inv.active ? 'Active' : 'Revoked'}</td>
                      <td className="px-3 py-2">
                        {inv.active && (
                          <button
                            type="button"
                            className="text-xs font-bold text-rose-600 underline"
                            onClick={async () => {
                              await api(`/api/admin/invites/${inv.id}`, { method: 'DELETE', body: '{}' });
                              await loadAll();
                            }}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(cfg.inviteCodes || []).length === 0 && (
                <p className="p-4 text-center text-sm opacity-60">No codes yet. Create one to share.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'analytics' && analytics && (
        <div className="space-y-8">
          <section className="rounded-[2rem] border border-white/40 bg-white/60 p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-lg font-extrabold text-white">New sign-ups (7 days)</h3>
            <div className="mt-4 h-[260px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.signupsLast7.map((d) => ({ ...d, short: d.date.slice(5) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,64,91,0.1)" vertical={false} />
                  <XAxis dataKey="short" tick={{ fill: ink, fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: ink, fontSize: 11 }} width={28} />
                  <Tooltip contentStyle={tip} />
                  <Bar dataKey="count" name="Sign-ups" fill={coral} radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-lg font-extrabold text-white">Platform activity (7 days)</h3>
            <p className="text-sm opacity-70">Session count and minutes logged across all users.</p>
            <div className="mt-4 h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sessionSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,64,91,0.12)" />
                  <XAxis dataKey="short" tick={{ fill: ink, fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fill: ink, fontSize: 11 }} width={32} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: ink, fontSize: 11 }} width={32} />
                  <Tooltip contentStyle={tip} />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="count"
                    name="Sessions"
                    stroke={ink}
                    fill="rgba(61,64,91,0.12)"
                  />
                  <Area yAxisId="right" type="monotone" dataKey="focusMinutes" name="Focus min" stroke={coral} fill={coral} fillOpacity={0.2} />
                  <Area yAxisId="right" type="monotone" dataKey="workMinutes" name="Work min" stroke={sage} fill={sage} fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/40 bg-white/60 p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-lg font-extrabold text-white">Top explorers (by XP)</h3>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/40">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-white/60 text-xs font-bold uppercase opacity-70">
                  <tr>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">XP</th>
                    <th className="px-3 py-2">Focus</th>
                    <th className="px-3 py-2">Work</th>
                    <th className="px-3 py-2">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topUsers.map((u) => (
                    <tr key={u.id} className="border-t border-white/30">
                      <td className="px-3 py-2">
                        <div className="font-bold">{u.name}</div>
                        <div className="text-xs opacity-70">{u.email}</div>
                      </td>
                      <td className="px-3 py-2 font-semibold">{u.xp}</td>
                      <td className="px-3 py-2">{u.focusMinutes}</td>
                      <td className="px-3 py-2">{u.workMinutes}</td>
                      <td className="px-3 py-2">{u.sessionCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-4">
          <div className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-lg font-extrabold text-white">Create user</h3>
            <p className="mt-1 text-sm text-slate-300">
              Add someone directly (works even when registration is closed). Share the password with them once; they
              can change it in Profile.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-left text-xs font-bold uppercase text-white/80">
                Name
                <input
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-sm font-semibold text-[color:var(--nudge-text)]"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </label>
              <label className="block text-left text-xs font-bold uppercase text-white/80">
                Email
                <input
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-sm font-semibold text-[color:var(--nudge-text)]"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  type="email"
                />
              </label>
              <label className="block text-left text-xs font-bold uppercase text-white/80">
                Initial password (6+ chars)
                <input
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-sm font-semibold text-[color:var(--nudge-text)]"
                  value={newUserPw}
                  onChange={(e) => setNewUserPw(e.target.value)}
                  type="password"
                />
              </label>
              <label className="flex items-end gap-2 pb-1 text-sm font-bold text-white/90">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={newUserAdmin}
                  onChange={(e) => setNewUserAdmin(e.target.checked)}
                />
                Admin role
              </label>
            </div>
            <button
              type="button"
              className="mt-4 rounded-[2rem] bg-[color:var(--nudge-primary)] px-5 py-2 text-sm font-extrabold text-white shadow"
              onClick={async () => {
                setUserCreateMsg('');
                try {
                  await api('/api/admin/users', {
                    method: 'POST',
                    body: JSON.stringify({
                      name: newUserName.trim(),
                      email: newUserEmail.trim(),
                      password: newUserPw,
                      role: newUserAdmin ? 'admin' : 'user',
                    }),
                  });
                  setNewUserName('');
                  setNewUserEmail('');
                  setNewUserPw('');
                  setNewUserAdmin(false);
                  await loadAll();
                  setUserCreateMsg('User created. Send them their email and temporary password.');
                } catch (e) {
                  setUserCreateMsg(e instanceof Error ? e.message : 'Could not create user');
                }
              }}
            >
              Create account
            </button>
            {userCreateMsg && (
              <p
                className={`mt-3 text-sm font-semibold ${
                  userCreateMsg.includes('created') ? 'text-emerald-200' : 'text-rose-200'
                }`}
              >
                {userCreateMsg}
              </p>
            )}
          </div>

          <input
            className="w-full max-w-md rounded-[2rem] border border-black/10 bg-white/80 px-4 py-3 font-semibold shadow-inner"
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="hidden overflow-hidden rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] shadow-xl backdrop-blur-md md:block">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-white/80 text-xs font-bold uppercase opacity-70 backdrop-blur">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">XP</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Streak</th>
                    <th className="px-4 py-3">Tasks</th>
                    <th className="px-4 py-3">Sessions</th>
                    <th className="px-4 py-3">Focus / Work</th>
                    <th className="px-4 py-3">Last session</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-t border-white/40">
                      <td className="px-4 py-3">
                        <div className="font-bold">{u.name}</div>
                        <div className="text-xs opacity-70">{u.email}</div>
                        <div className="text-[10px] opacity-50">{u.badges} badges</div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="rounded-xl border border-black/10 bg-white/80 px-2 py-1 font-semibold"
                          value={u.role}
                          onChange={async (e) => {
                            await api(`/api/admin/users/${u.id}/role`, {
                              method: 'PATCH',
                              body: JSON.stringify({ role: e.target.value }),
                            });
                            await loadAll();
                          }}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 font-semibold">{u.xp}</td>
                      <td className="px-4 py-3 font-semibold">{u.level ?? Math.floor((u.xp || 0) / 100) + 1}</td>
                      <td className="px-4 py-3">{u.streakDays ?? 0}d</td>
                      <td className="px-4 py-3">{u.taskCount}</td>
                      <td className="px-4 py-3">{u.sessionCount}</td>
                      <td className="px-4 py-3 text-xs">
                        {u.totalFocusMinutes}F / {u.totalWorkMinutes}W
                      </td>
                      <td className="px-4 py-3 text-xs opacity-80">
                        {u.lastSessionAt ? new Date(u.lastSessionAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            className="text-left text-xs font-bold text-[color:var(--nudge-primary)]"
                            onClick={async () => {
                              await api(`/api/admin/users/${u.id}/grant-xp`, {
                                method: 'POST',
                                body: JSON.stringify({ amount: 50 }),
                              });
                              await loadAll();
                            }}
                          >
                            Grant +50 XP
                          </button>
                          <button
                            type="button"
                            className="text-left text-xs font-bold text-amber-700"
                            onClick={async () => {
                              if (!confirm(`Reset XP & history for ${u.email}?`)) return;
                              await api(`/api/admin/users/${u.id}/reset-progress`, { method: 'POST', body: '{}' });
                              await loadAll();
                            }}
                          >
                            Reset progress
                          </button>
                          <button
                            type="button"
                            className="text-left text-xs font-bold text-rose-600"
                            onClick={async () => {
                              if (!confirm(`Permanently delete ${u.email}?`)) return;
                              await api(`/api/admin/users/${u.id}`, { method: 'DELETE' });
                              await loadAll();
                            }}
                          >
                            Delete user
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 md:hidden">
            {filtered.map((u) => (
              <div
                key={u.id}
                className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-4 shadow-lg backdrop-blur-md"
              >
                <div className="font-bold text-white">{u.name}</div>
                <div className="text-xs opacity-70">{u.email}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-white/90">
                  <div>
                    <span className="text-[10px] font-bold uppercase opacity-60">XP</span>
                    <p className="font-semibold">{u.xp}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase opacity-60">Level</span>
                    <p className="font-semibold">{u.level ?? Math.floor((u.xp || 0) / 100) + 1}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase opacity-60">Streak</span>
                    <p className="font-semibold">{u.streakDays ?? 0} days</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase opacity-60">Sessions</span>
                    <p className="font-semibold">{u.sessionCount}</p>
                  </div>
                </div>
                <label className="mt-3 block text-xs font-bold uppercase opacity-70">Role</label>
                <select
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/90 px-2 py-2 text-sm font-semibold text-[color:var(--nudge-text)]"
                  value={u.role}
                  onChange={async (e) => {
                    await api(`/api/admin/users/${u.id}/role`, {
                      method: 'PATCH',
                      body: JSON.stringify({ role: e.target.value }),
                    });
                    await loadAll();
                  }}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    className="rounded-[2rem] bg-[color:var(--nudge-primary)] px-4 py-2 text-sm font-extrabold text-white shadow"
                    onClick={async () => {
                      await api(`/api/admin/users/${u.id}/grant-xp`, {
                        method: 'POST',
                        body: JSON.stringify({ amount: 50 }),
                      });
                      await loadAll();
                    }}
                  >
                    Grant +50 XP
                  </button>
                  <button
                    type="button"
                    className="rounded-[2rem] bg-white/70 px-4 py-2 text-xs font-bold text-amber-800"
                    onClick={async () => {
                      if (!confirm(`Reset XP & history for ${u.email}?`)) return;
                      await api(`/api/admin/users/${u.id}/reset-progress`, { method: 'POST', body: '{}' });
                      await loadAll();
                    }}
                  >
                    Reset progress
                  </button>
                  <button
                    type="button"
                    className="rounded-[2rem] bg-rose-100 px-4 py-2 text-xs font-bold text-rose-700"
                    onClick={async () => {
                      if (!confirm(`Permanently delete ${u.email}?`)) return;
                      await api(`/api/admin/users/${u.id}`, { method: 'DELETE' });
                      await loadAll();
                    }}
                  >
                    Delete user
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
