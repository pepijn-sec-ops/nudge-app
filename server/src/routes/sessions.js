import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readDb, writeDb } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  computeNewBadges,
  levelFromXp,
  unlockedAvatarsForLevel,
  unlockedThemesForLevel,
} from '../gamification.js';

const router = Router();
router.use(requireAuth);

router.post('/focus/complete', async (req, res) => {
  const {
    plannedMinutes,
    actualMinutes,
    taskId,
    taskName,
    localHour,
    mood,
    moodSkipped,
  } = req.body || {};
  const minutes = Math.max(0, Math.round(Number(actualMinutes) || 0));
  const planned = Math.max(1, Math.round(Number(plannedMinutes) || minutes || 1));

  const session = {
    id: uuid(),
    userId: req.user.id,
    type: 'focus',
    plannedMinutes: planned,
    durationMinutes: minutes,
    taskId: taskId || null,
    taskName: taskName || null,
    localHour: typeof localHour === 'number' ? localHour : null,
    completedAt: new Date().toISOString(),
  };

  let newBadges = [];
  let xpEarned = 0;
  await writeDb(async (d) => {
    const user = d.users.find((u) => u.id === req.user.id);
    if (!user) return;
    const mult = Number(d.globalConfig?.globalXpMultiplier) || 1;
    xpEarned = Math.max(0, Math.round(minutes * mult));
    const prevXp = user.xp || 0;
    user.xp = prevXp + xpEarned;
    d.sessions.push(session);
    const stats = aggregateUser(d, req.user.id);
    stats.xpAfter = user.xp;
    newBadges = computeNewBadges(user.badges, session, stats);
    for (const b of newBadges) {
      if (!user.badges.includes(b)) user.badges.push(b);
    }

    if (taskId) {
      const t = d.tasks.find((x) => x.id === taskId && x.userId === req.user.id);
      if (t && minutes > 0) t.actualMinutesLogged = (t.actualMinutesLogged || 0) + minutes;
    }

    if (!moodSkipped && mood && ['energized', 'steady', 'drained'].includes(mood)) {
      d.moods.push({
        id: uuid(),
        userId: req.user.id,
        sessionId: session.id,
        mood,
        context: 'focus',
        taskId: taskId || null,
        createdAt: new Date().toISOString(),
      });
    }
  });

  const user = (await readDb()).users.find((u) => u.id === req.user.id);
  res.json({
    session,
    xp: user.xp,
    level: levelFromXp(user.xp),
    newBadges,
    unlockedAvatars: unlockedAvatarsForLevel(levelFromXp(user.xp)),
    unlockedThemes: unlockedThemesForLevel(levelFromXp(user.xp)),
  });
});

router.post('/work/complete', async (req, res) => {
  const { actualMinutes, projectName, localHour, mood, moodSkipped } = req.body || {};
  const minutes = Math.max(0, Math.round(Number(actualMinutes) || 0));

  const session = {
    id: uuid(),
    userId: req.user.id,
    type: 'work',
    durationMinutes: minutes,
    projectName: projectName || 'Open work',
    localHour: typeof localHour === 'number' ? localHour : null,
    completedAt: new Date().toISOString(),
  };

  let newBadges = [];
  let xpEarned = 0;
  await writeDb(async (d) => {
    const user = d.users.find((u) => u.id === req.user.id);
    if (!user) return;
    const mult = Number(d.globalConfig?.globalXpMultiplier) || 1;
    xpEarned = Math.max(0, Math.round(minutes * mult));
    user.xp = (user.xp || 0) + xpEarned;
    user.currentWorkSession = null;
    d.sessions.push(session);
    const stats = aggregateUser(d, req.user.id);
    stats.xpAfter = user.xp;
    newBadges = computeNewBadges(user.badges, session, stats);
    for (const b of newBadges) {
      if (!user.badges.includes(b)) user.badges.push(b);
    }

    if (!moodSkipped && mood && ['energized', 'steady', 'drained'].includes(mood)) {
      d.moods.push({
        id: uuid(),
        userId: req.user.id,
        sessionId: session.id,
        mood,
        context: 'work',
        taskId: null,
        createdAt: new Date().toISOString(),
      });
    }
  });

  const user = (await readDb()).users.find((u) => u.id === req.user.id);
  res.json({
    session,
    xp: user.xp,
    level: levelFromXp(user.xp),
    newBadges,
    unlockedAvatars: unlockedAvatarsForLevel(levelFromXp(user.xp)),
    unlockedThemes: unlockedThemesForLevel(levelFromXp(user.xp)),
  });
});

router.put('/work/active', async (req, res) => {
  const body = req.body || {};
  await writeDb((d) => {
    const user = d.users.find((u) => u.id === req.user.id);
    if (!user) return;
    if (body.clear) {
      user.currentWorkSession = null;
    } else {
      user.currentWorkSession = {
        projectName: String(body.projectName || 'Open work'),
        startedAt: body.startedAt || new Date().toISOString(),
        accumulatedActiveMs: Math.max(0, Number(body.accumulatedActiveMs) || 0),
        isPaused: !!body.isPaused,
        pauseStartedAt: body.pauseStartedAt || null,
      };
    }
  });
  const u = (await readDb()).users.find((x) => x.id === req.user.id);
  res.json({ currentWorkSession: u.currentWorkSession });
});

router.get('/work/active', async (req, res) => {
  const u = (await readDb()).users.find((x) => x.id === req.user.id);
  res.json({ currentWorkSession: u.currentWorkSession || null });
});

router.post('/mood', async (req, res) => {
  const { mood, sessionId, context = 'manual', taskId } = req.body || {};
  if (!['energized', 'steady', 'drained'].includes(mood)) {
    return res.status(400).json({ error: 'Invalid mood' });
  }
  const row = {
    id: uuid(),
    userId: req.user.id,
    sessionId: sessionId || null,
    mood,
    context,
    taskId: taskId || null,
    createdAt: new Date().toISOString(),
  };
  await writeDb((d) => {
    d.moods.push(row);
  });
  res.json({ mood: row });
});

function aggregateUser(d, userId) {
  const sessions = d.sessions.filter((s) => s.userId === userId);
  const focus = sessions.filter((s) => s.type === 'focus');
  const totalFocusMinutes = focus.reduce((a, s) => a + (s.durationMinutes || 0), 0);
  const completedSessions = sessions.length;
  return { totalFocusMinutes, completedSessions };
}

export default router;
