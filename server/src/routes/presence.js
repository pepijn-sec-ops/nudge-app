import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import * as presence from '../presence.js';

const router = Router();

router.post('/heartbeat', requireAuth, (req, res) => {
  presence.setPresence(req.user.id, !!req.body?.focusing);
  res.json({ ok: true });
});

router.get('/global', (_req, res) => {
  res.json({ focusingCount: presence.getGlobalFocusingCount() });
});

export default router;
