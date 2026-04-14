import { Router } from 'express';
import { readDb, writeDb } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { levelFromXp, listBadgeDefs, xpIntoLevel } from '../gamification.js';

const router = Router();
router.use(requireAuth);

function dayWindow(offsetFromToday) {
  const day = new Date();
  day.setDate(day.getDate() - offsetFromToday);
  day.setHours(0, 0, 0, 0);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  return { start: day.toISOString(), end: next.toISOString(), label: day.toISOString().slice(0, 10) };
}

function sessionsInRange(sessions, startIso, endIso) {
  return sessions.filter((s) => s.completedAt >= startIso && s.completedAt < endIso);
}

router.get('/summary', async (req, res) => {
  const db = await readDb();
  const uid = req.user.id;
  const user = db.users.find((u) => u.id === uid);
  const sessions = db.sessions.filter((s) => s.userId === uid);
  const moods = db.moods.filter((m) => m.userId === uid);
  const notes = db.notes.filter((n) => n.userId === uid);
  const focusSessions = sessions.filter((s) => s.type === 'focus');
  const totalFocusMinutes = focusSessions.reduce((a, s) => a + (s.durationMinutes || 0), 0);
  const totalWorkMinutes = sessions
    .filter((s) => s.type === 'work')
    .reduce((a, s) => a + (s.durationMinutes || 0), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const minutesToday = sessions
    .filter((s) => s.completedAt >= todayIso)
    .reduce((a, s) => a + (s.durationMinutes || 0), 0);

  const weeklySplit = [];
  const last7 = [];
  for (let i = 6; i >= 0; i -= 1) {
    const { start, end, label } = dayWindow(i);
    const daySessions = sessionsInRange(sessions, start, end);
    const focusMinutes = daySessions
      .filter((s) => s.type === 'focus')
      .reduce((a, s) => a + (s.durationMinutes || 0), 0);
    const workMinutes = daySessions
      .filter((s) => s.type === 'work')
      .reduce((a, s) => a + (s.durationMinutes || 0), 0);
    const minutes = focusMinutes + workMinutes;
    weeklySplit.push({ date: label, focusMinutes, workMinutes, total: minutes });
    last7.push({ date: label, minutes });
  }

  const last30Days = [];
  for (let i = 29; i >= 0; i -= 1) {
    const { start, end, label } = dayWindow(i);
    const daySessions = sessionsInRange(sessions, start, end);
    const focusMinutes = daySessions
      .filter((s) => s.type === 'focus')
      .reduce((a, s) => a + (s.durationMinutes || 0), 0);
    const workMinutes = daySessions
      .filter((s) => s.type === 'work')
      .reduce((a, s) => a + (s.durationMinutes || 0), 0);
    last30Days.push({
      date: label,
      focusMinutes,
      workMinutes,
      total: focusMinutes + workMinutes,
    });
  }

  const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dow = [0, 0, 0, 0, 0, 0, 0];
  for (const s of sessions) {
    const day = new Date(s.completedAt).getDay();
    dow[day] += s.durationMinutes || 0;
  }
  const dayOfWeek = dow.map((minutes, i) => ({ label: dowLabels[i], minutes }));

  const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({ hour, minutes: 0 }));
  for (const s of sessions) {
    const h = new Date(s.completedAt).getHours();
    hourBuckets[h].minutes += s.durationMinutes || 0;
  }

  const totalMin = totalFocusMinutes + totalWorkMinutes;
  const focusVsWork = {
    focusMinutes: totalFocusMinutes,
    workMinutes: totalWorkMinutes,
    focusPct: totalMin > 0 ? Math.round((totalFocusMinutes / totalMin) * 1000) / 10 : 0,
    workPct: totalMin > 0 ? Math.round((totalWorkMinutes / totalMin) * 1000) / 10 : 0,
  };

  const avgFocusSession =
    focusSessions.length > 0
      ? Math.round((totalFocusMinutes / focusSessions.length) * 10) / 10
      : 0;

  const streak = computeGentleStreak(sessions);
  const timeline = buildTimeline(sessions, moods, notes, db.tasks.filter((t) => t.userId === uid));

  const nudge = db.globalConfig?.systemNudge || { message: '', updatedAt: null };

  res.json({
    xp: user.xp,
    level: levelFromXp(user.xp),
    xpProgress: xpIntoLevel(user.xp),
    badges: user.badges,
    badgeDefs: listBadgeDefs(),
    totalFocusMinutes,
    totalWorkMinutes,
    completedSessions: sessions.length,
    focusSessionCount: focusSessions.length,
    workSessionCount: sessions.filter((s) => s.type === 'work').length,
    minutesToday,
    dailyGoalMinutes: user.preferences?.dailyGoalMinutes ?? 60,
    weekly: last7,
    weeklySplit,
    last30Days,
    dayOfWeek,
    hourBuckets,
    focusVsWork,
    avgFocusSession,
    streakDays: streak.current,
    streak,
    timeline,
    moods: moods.slice(-200),
    systemNudge: {
      message: String(nudge.message || '').trim(),
      updatedAt: nudge.updatedAt || null,
    },
  });
});

function buildTimeline(sessions, moods, notes, tasks) {
  const items = [];
  const moodBySessionId = new Map();
  for (const m of moods) {
    if (!m.sessionId) continue;
    if (!moodBySessionId.has(m.sessionId)) moodBySessionId.set(m.sessionId, m);
  }
  const notesBySessionRef = new Map();
  for (const n of notes) {
    const key = typeof n.linkedSessionRef === 'string' ? n.linkedSessionRef : null;
    if (!key) continue;
    if (!notesBySessionRef.has(key)) notesBySessionRef.set(key, []);
    notesBySessionRef.get(key).push(n);
  }
  for (const s of sessions) {
    const linkedNotes = typeof s.sessionRef === 'string' ? notesBySessionRef.get(s.sessionRef) || [] : [];
    items.push({
      kind: s.type === 'focus' ? 'focus_session' : 'work_session',
      at: s.completedAt,
      payload: {
        ...s,
        mood: moodBySessionId.get(s.id)?.mood || null,
        linkedNotes: linkedNotes.slice(0, 3).map((n) => ({ id: n.id, content: n.content })),
        linkedNotesCount: linkedNotes.length,
      },
    });
  }
  for (const n of notes) {
    if (n.linkedSessionRef) continue;
    items.push({ kind: 'note', at: n.createdAt, payload: n });
  }
  for (const t of tasks) {
    if (t.completed) {
      items.push({
        kind: 'task_completed',
        at: t.updatedAt || t.createdAt || new Date().toISOString(),
        payload: t,
      });
    }
  }
  items.sort((a, b) => new Date(b.at) - new Date(a.at));
  return items.slice(0, 100);
}

function dateKeyLocal(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayNumberFromKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y || !m || !d) return 0;
  return Math.floor(new Date(y, m - 1, d).getTime() / 86400000);
}

function computeGentleStreak(sessions) {
  const activeKeys = [...new Set(sessions.map((s) => dateKeyLocal(s.completedAt)))].sort();
  const activeNums = activeKeys.map(dayNumberFromKey).filter((n) => Number.isFinite(n) && n > 0);
  const activeSet = new Set(activeNums);
  const todayNum = Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000);

  let current = 0;
  let cursor = todayNum;
  let graceUsed = false;
  while (activeSet.has(cursor) || !graceUsed) {
    if (activeSet.has(cursor)) {
      current += 1;
      cursor -= 1;
    } else if (!graceUsed) {
      graceUsed = true;
      cursor -= 1;
    } else {
      break;
    }
  }

  let best = 0;
  for (let i = 0; i < activeNums.length; i += 1) {
    let len = 1;
    let grace = 1;
    let prev = activeNums[i];
    for (let j = i + 1; j < activeNums.length; j += 1) {
      const diff = activeNums[j] - prev;
      if (diff === 1) {
        len += 1;
        prev = activeNums[j];
      } else if (diff === 2 && grace > 0) {
        grace = 0;
        len += 1;
        prev = activeNums[j];
      } else if (diff > 2) {
        break;
      }
    }
    if (len > best) best = len;
  }

  return {
    current,
    best,
    graceUsed,
  };
}

router.post('/reset-progress', async (req, res) => {
  await writeDb((d) => {
    const uid = req.user.id;
    d.sessions = d.sessions.filter((s) => s.userId !== uid);
    d.moods = d.moods.filter((m) => m.userId !== uid);
    const u = d.users.find((x) => x.id === uid);
    if (u) {
      u.xp = 0;
      u.badges = [];
      u.currentFocusSession = null;
    }
  });
  res.json({ ok: true });
});

router.post('/reset-all', async (req, res) => {
  await writeDb((d) => {
    const uid = req.user.id;
    d.sessions = d.sessions.filter((s) => s.userId !== uid);
    d.moods = d.moods.filter((m) => m.userId !== uid);
    d.tasks = d.tasks.filter((t) => t.userId !== uid);
    const u = d.users.find((x) => x.id === uid);
    if (u) {
      u.xp = 0;
      u.badges = [];
      u.currentWorkSession = null;
      u.currentFocusSession = null;
    }
  });
  res.json({ ok: true });
});

export default router;
