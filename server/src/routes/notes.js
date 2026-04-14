import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readDb, writeDb } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const db = await readDb();
  const notes = db.notes
    .filter((n) => n.userId === req.user.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ notes });
});

router.post('/', async (req, res) => {
  const content = String(req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Note content required' });

  const note = {
    id: uuid(),
    userId: req.user.id,
    content: content.slice(0, 1000),
    pinned: !!req.body?.pinned,
    context: ['focus', 'work', 'general'].includes(req.body?.context) ? req.body.context : 'general',
    linkedSessionRef:
      typeof req.body?.linkedSessionRef === 'string' && req.body.linkedSessionRef.trim()
        ? req.body.linkedSessionRef.trim().slice(0, 120)
        : null,
    linkedTaskId:
      typeof req.body?.linkedTaskId === 'string' && req.body.linkedTaskId.trim()
        ? req.body.linkedTaskId.trim().slice(0, 120)
        : null,
    linkedTaskTitle:
      typeof req.body?.linkedTaskTitle === 'string' && req.body.linkedTaskTitle.trim()
        ? req.body.linkedTaskTitle.trim().slice(0, 160)
        : null,
    linkedProjectName:
      typeof req.body?.linkedProjectName === 'string' && req.body.linkedProjectName.trim()
        ? req.body.linkedProjectName.trim().slice(0, 160)
        : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeDb((d) => {
    d.notes.push(note);
  });
  res.json({ note });
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const patch = req.body || {};
  let found = false;
  await writeDb((d) => {
    const n = d.notes.find((x) => x.id === id && x.userId === req.user.id);
    if (!n) return;
    found = true;
    if (typeof patch.content === 'string') n.content = patch.content.trim().slice(0, 1000) || n.content;
    if (typeof patch.pinned === 'boolean') n.pinned = patch.pinned;
    n.updatedAt = new Date().toISOString();
  });
  if (!found) return res.status(404).json({ error: 'Note not found' });
  const db = await readDb();
  const note = db.notes.find((x) => x.id === id && x.userId === req.user.id);
  res.json({ note });
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  await writeDb((d) => {
    d.notes = d.notes.filter((n) => !(n.id === id && n.userId === req.user.id));
  });
  res.json({ ok: true });
});

export default router;
