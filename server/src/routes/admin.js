import { randomBytes } from 'crypto';
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readDb, writeDb } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/requireAuth.js';
import { levelFromXp } from '../gamification.js';
import { hashPassword } from '../auth.js';
import { defaultPreferences } from '../userDefaults.js';
import { normalizeRole } from '../roles.js';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

function dayWindow(offsetFromToday) {
  const day = new Date();
  day.setDate(day.getDate() - offsetFromToday);
  day.setHours(0, 0, 0, 0);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  return { start: day.toISOString(), end: next.toISOString(), label: day.toISOString().slice(0, 10) };
}

function streakDaysForUserSessions(userSessions) {
  const last30Days = [];
  for (let i = 29; i >= 0; i -= 1) {
    const { start, end, label } = dayWindow(i);
    const daySessions = userSessions.filter((s) => s.completedAt >= start && s.completedAt < end);
    const focusMinutes = daySessions
      .filter((s) => s.type === 'focus')
      .reduce((a, s) => a + (s.durationMinutes || 0), 0);
    const workMinutes = daySessions
      .filter((s) => s.type === 'work')
      .reduce((a, s) => a + (s.durationMinutes || 0), 0);
    last30Days.push({ date: label, total: focusMinutes + workMinutes });
  }
  let streakDays = 0;
  for (let i = last30Days.length - 1; i >= 0; i -= 1) {
    if (last30Days[i].total > 0) streakDays += 1;
    else break;
  }
  return streakDays;
}

router.get('/overview', async (_req, res) => {
  const db = await readDb();
  const users = db.users;
  const sessions = db.sessions;
  const tasks = db.tasks;
  const moods = db.moods;

  const totalFocusMinutes = sessions
    .filter((s) => s.type === 'focus')
    .reduce((a, s) => a + (s.durationMinutes || 0), 0);
  const totalWorkMinutes = sessions
    .filter((s) => s.type === 'work')
    .reduce((a, s) => a + (s.durationMinutes || 0), 0);

  res.json({
    totals: {
      users: users.length,
      sessions: sessions.length,
      tasks: tasks.length,
      moods: moods.length,
      focusMinutes: totalFocusMinutes,
      workMinutes: totalWorkMinutes,
    },
    admins: users.filter((u) => u.role === 'admin').length,
  });
});

router.get('/analytics', async (_req, res) => {
  const db = await readDb();
  const users = db.users;
  const sessions = db.sessions;

  const signupsLast7 = [];
  const sessionsLast7 = [];
  for (let i = 6; i >= 0; i -= 1) {
    const { start, end, label } = dayWindow(i);
    const signups = users.filter((u) => u.createdAt >= start && u.createdAt < end).length;
    const daySessions = sessions.filter((s) => s.completedAt >= start && s.completedAt < end);
    signupsLast7.push({ date: label, count: signups });
    sessionsLast7.push({
      date: label,
      count: daySessions.length,
      focusMinutes: daySessions
        .filter((s) => s.type === 'focus')
        .reduce((a, s) => a + (s.durationMinutes || 0), 0),
      workMinutes: daySessions
        .filter((s) => s.type === 'work')
        .reduce((a, s) => a + (s.durationMinutes || 0), 0),
    });
  }

  const byUser = new Map();
  for (const u of users) {
    byUser.set(u.id, { focus: 0, work: 0, sessions: 0 });
  }
  for (const s of sessions) {
    const row = byUser.get(s.userId);
    if (!row) continue;
    row.sessions += 1;
    if (s.type === 'focus') row.focus += s.durationMinutes || 0;
    if (s.type === 'work') row.work += s.durationMinutes || 0;
  }

  const topUsers = users
    .map((u) => {
      const agg = byUser.get(u.id) || { focus: 0, work: 0, sessions: 0 };
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        xp: u.xp,
        focusMinutes: agg.focus,
        workMinutes: agg.work,
        sessionCount: agg.sessions,
      };
    })
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 8);

  res.json({ signupsLast7, sessionsLast7, topUsers });
});

router.get('/config', async (_req, res) => {
  const db = await readDb();
  const gc = db.globalConfig || { globalXpMultiplier: 1, systemNudge: { message: '', updatedAt: null } };
  const invites = (gc.inviteCodes || []).map((x) => ({
    id: x.id,
    code: x.code,
    note: x.note || '',
    maxUses: x.maxUses,
    uses: x.uses || 0,
    createdAt: x.createdAt,
    active: x.active !== false,
  }));
  res.json({
    globalXpMultiplier: gc.globalXpMultiplier ?? 1,
    registrationMode: gc.registrationMode || 'open',
    inviteCodes: invites,
    systemNudge: {
      message: String(gc.systemNudge?.message || ''),
      updatedAt: gc.systemNudge?.updatedAt || null,
    },
  });
});

router.patch('/config', async (req, res) => {
  const body = req.body || {};
  const rawMult = body.globalXpMultiplier;
  const registrationMode = body.registrationMode;
  const hasMult = rawMult !== undefined && rawMult !== null && String(rawMult) !== '';
  const hasMode = typeof registrationMode === 'string';

  if (!hasMult && !hasMode) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  await writeDb((d) => {
    if (!d.globalConfig) {
      d.globalConfig = {
        globalXpMultiplier: 1,
        systemNudge: { message: '', updatedAt: null },
        registrationMode: 'open',
        inviteCodes: [],
      };
    }
    if (hasMult) {
      const n = Number(rawMult);
      if (Number.isFinite(n)) {
        d.globalConfig.globalXpMultiplier = Math.min(5, Math.max(0.25, n));
      }
    }
    if (hasMode && ['open', 'invite', 'closed'].includes(registrationMode)) {
      d.globalConfig.registrationMode = registrationMode;
    }
  });
  const db = await readDb();
  res.json({
    globalXpMultiplier: db.globalConfig.globalXpMultiplier,
    registrationMode: db.globalConfig.registrationMode,
  });
});

router.post('/broadcast', async (req, res) => {
  const message = String(req.body?.message ?? '').trim().slice(0, 500);
  const updatedAt = new Date().toISOString();
  await writeDb((d) => {
    if (!d.globalConfig) d.globalConfig = { globalXpMultiplier: 1, systemNudge: { message: '', updatedAt: null } };
    d.globalConfig.systemNudge = { message, updatedAt };
  });
  res.json({ systemNudge: { message, updatedAt } });
});

router.post('/invites', async (req, res) => {
  const { code, note, maxUses } = req.body || {};
  const db0 = await readDb();
  let finalCode = String(code || '').trim().toUpperCase().slice(0, 32);
  if (!finalCode || finalCode.length < 4) {
    finalCode = randomBytes(5).toString('hex').toUpperCase();
  }
  const list = db0.globalConfig?.inviteCodes || [];
  if (list.some((x) => String(x.code).toUpperCase() === finalCode)) {
    return res.status(409).json({ error: 'That code already exists' });
  }
  const id = uuid();
  const max =
    maxUses === undefined || maxUses === null || maxUses === ''
      ? null
      : Math.min(10000, Math.max(1, Math.round(Number(maxUses))));
  const row = {
    id,
    code: finalCode,
    note: String(note || '').slice(0, 120),
    maxUses: max,
    uses: 0,
    createdAt: new Date().toISOString(),
    active: true,
  };
  await writeDb((d) => {
    if (!d.globalConfig) {
      d.globalConfig = {
        globalXpMultiplier: 1,
        systemNudge: { message: '', updatedAt: null },
        registrationMode: 'open',
        inviteCodes: [],
      };
    }
    if (!Array.isArray(d.globalConfig.inviteCodes)) d.globalConfig.inviteCodes = [];
    d.globalConfig.inviteCodes.push(row);
  });
  res.json({ invite: row });
});

router.delete('/invites/:id', async (req, res) => {
  const { id } = req.params;
  await writeDb((d) => {
    const inv = (d.globalConfig?.inviteCodes || []).find((x) => x.id === id);
    if (inv) inv.active = false;
  });
  res.json({ ok: true });
});

router.post('/users', async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password required' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const normalized = String(email).toLowerCase().trim();
  const db = await readDb();
  if (db.users.some((u) => u.email === normalized)) {
    return res.status(409).json({ error: 'Email already in use' });
  }
  const passwordHash = await hashPassword(String(password));
  const id = uuid();
  const finalRole = normalizeRole(role === 'admin' ? 'admin' : 'user');
  const user = {
    id,
    name: String(name).trim(),
    email: normalized,
    passwordHash,
    role: finalRole,
    xp: 0,
    badges: [],
    preferences: defaultPreferences(),
    currentWorkSession: null,
    currentFocusSession: null,
    createdAt: new Date().toISOString(),
  };
  await writeDb((d) => {
    d.users.push(user);
  });
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: normalizeRole(user.role),
      xp: user.xp,
      badges: user.badges,
      preferences: user.preferences,
      currentWorkSession: null,
      currentFocusSession: null,
    },
  });
});

router.get('/users', async (_req, res) => {
  const db = await readDb();
  const sessionsByUser = new Map();
  for (const s of db.sessions) {
    if (!sessionsByUser.has(s.userId)) sessionsByUser.set(s.userId, []);
    sessionsByUser.get(s.userId).push(s);
  }
  const taskCounts = new Map();
  for (const t of db.tasks) {
    taskCounts.set(t.userId, (taskCounts.get(t.userId) || 0) + 1);
  }
  const moodCounts = new Map();
  for (const m of db.moods) {
    moodCounts.set(m.userId, (moodCounts.get(m.userId) || 0) + 1);
  }

  res.json({
    users: db.users.map((u) => {
      const list = sessionsByUser.get(u.id) || [];
      const lastSessionAt =
        list.length > 0
          ? list.reduce((max, s) => (s.completedAt > max ? s.completedAt : max), list[0].completedAt)
          : null;
      const focusMin = list.filter((s) => s.type === 'focus').reduce((a, s) => a + (s.durationMinutes || 0), 0);
      const workMin = list.filter((s) => s.type === 'work').reduce((a, s) => a + (s.durationMinutes || 0), 0);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        xp: u.xp,
        level: levelFromXp(u.xp || 0),
        streakDays: streakDaysForUserSessions(list),
        badges: u.badges?.length || 0,
        createdAt: u.createdAt,
        taskCount: taskCounts.get(u.id) || 0,
        sessionCount: list.length,
        moodCount: moodCounts.get(u.id) || 0,
        totalFocusMinutes: focusMin,
        totalWorkMinutes: workMin,
        lastSessionAt,
      };
    }),
  });
});

router.post('/users/:id/grant-xp', async (req, res) => {
  const { id } = req.params;
  const amount = Math.min(500, Math.max(1, Math.round(Number(req.body?.amount) || 50)));
  await writeDb((d) => {
    const u = d.users.find((x) => x.id === id);
    if (u) u.xp = (u.xp || 0) + amount;
  });
  const u = (await readDb()).users.find((x) => x.id === id);
  res.json({
    user: u
      ? { id: u.id, xp: u.xp, level: levelFromXp(u.xp || 0), granted: amount }
      : null,
  });
});

router.patch('/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const role = normalizeRole(req.body?.role === 'admin' ? 'admin' : 'user');
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  await writeDb((d) => {
    const u = d.users.find((x) => x.id === id);
    if (u) u.role = role;
  });
  const u = (await readDb()).users.find((x) => x.id === id);
  res.json({ user: u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null });
});

router.post('/users/:id/reset-progress', async (req, res) => {
  const { id } = req.params;
  await writeDb((d) => {
    d.sessions = d.sessions.filter((s) => s.userId !== id);
    d.moods = d.moods.filter((m) => m.userId !== id);
    const u = d.users.find((x) => x.id === id);
    if (u) {
      u.xp = 0;
      u.badges = [];
    }
  });
  res.json({ ok: true });
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  await writeDb((d) => {
    d.users = d.users.filter((u) => u.id !== id);
    d.tasks = d.tasks.filter((t) => t.userId !== id);
    d.sessions = d.sessions.filter((s) => s.userId !== id);
    d.moods = d.moods.filter((m) => m.userId !== id);
  });
  res.json({ ok: true });
});

export default router;
