import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readDb, writeDb } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);

const priorities = ['critical', 'high', 'normal', 'low'];

router.get('/', async (req, res) => {
  const db = await readDb();
  const tasks = db.tasks.filter((t) => t.userId === req.user.id);
  res.json({ tasks });
});

router.post('/', async (req, res) => {
  const { title, priority = 'normal', estimateMinutes = 25, pinned = false } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Title required' });
  }
  const p = priorities.includes(priority) ? priority : 'normal';
  const task = {
    id: uuid(),
    userId: req.user.id,
    title: String(title).trim(),
    priority: p,
    estimateMinutes: Math.max(1, Number(estimateMinutes) || 25),
    pinned: !!pinned,
    completed: false,
    actualMinutesLogged: 0,
    createdAt: new Date().toISOString(),
  };
  await writeDb((d) => {
    d.tasks.push(task);
  });
  res.json({ task });
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  const idx = db.tasks.findIndex((t) => t.id === id && t.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const patch = req.body || {};
  await writeDb((d) => {
    const t = d.tasks[idx];
    if (typeof patch.title === 'string') t.title = patch.title.trim() || t.title;
    if (priorities.includes(patch.priority)) t.priority = patch.priority;
    if (typeof patch.estimateMinutes === 'number') t.estimateMinutes = Math.max(1, patch.estimateMinutes);
    if (typeof patch.pinned === 'boolean') t.pinned = patch.pinned;
    if (typeof patch.completed === 'boolean') {
      t.completed = patch.completed;
      if (patch.completed) t.updatedAt = new Date().toISOString();
    }
  });
  const fresh = (await readDb()).tasks.find((t) => t.id === id);
  res.json({ task: fresh });
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  await writeDb((d) => {
    d.tasks = d.tasks.filter((t) => !(t.id === id && t.userId === req.user.id));
  });
  res.json({ ok: true });
});

router.post('/:id/log-minutes', async (req, res) => {
  const { id } = req.params;
  const minutes = Math.max(0, Number(req.body?.minutes) || 0);
  await writeDb((d) => {
    const t = d.tasks.find((x) => x.id === id && x.userId === req.user.id);
    if (t) t.actualMinutesLogged = (t.actualMinutesLogged || 0) + minutes;
  });
  const fresh = (await readDb()).tasks.find((t) => t.id === id);
  res.json({ task: fresh });
});

export default router;
