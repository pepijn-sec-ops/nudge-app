import { Router } from 'express';
import { readDb, writeDb } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { hashPassword, comparePassword } from '../auth.js';

const router = Router();

router.patch('/profile', requireAuth, async (req, res) => {
  const name = req.body?.name;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Name required' });
  }
  await writeDb((d) => {
    const u = d.users.find((x) => x.id === req.user.id);
    if (u) u.name = String(name).trim();
  });
  const u = (await readDb()).users.find((x) => x.id === req.user.id);
  res.json({
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      xp: u.xp,
      badges: u.badges,
      preferences: u.preferences,
      currentWorkSession: u.currentWorkSession,
    },
  });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const db = await readDb();
  const u = db.users.find((x) => x.id === req.user.id);
  if (!u || !(await comparePassword(String(currentPassword), u.passwordHash))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const passwordHash = await hashPassword(String(newPassword));
  await writeDb((d) => {
    const x = d.users.find((y) => y.id === req.user.id);
    if (x) x.passwordHash = passwordHash;
  });
  res.json({ ok: true });
});

export default router;
