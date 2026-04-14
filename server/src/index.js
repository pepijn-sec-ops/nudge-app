import cors from 'cors';
import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import tasksRoutes from './routes/tasks.js';
import sessionsRoutes from './routes/sessions.js';
import statsRoutes from './routes/stats.js';
import preferencesRoutes from './routes/preferences.js';
import adminRoutes from './routes/admin.js';
import accountRoutes from './routes/account.js';
import presenceRoutes from './routes/presence.js';
import notesRoutes from './routes/notes.js';
import { createRateLimiter } from './middleware/rateLimit.js';

import { closeDb, isUsingPostgres, readDb } from './db.js';

const app = express();
const authLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 120,
  message: 'Too many auth requests. Please try again shortly.',
});
const authSensitiveLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many login/register attempts. Please wait before trying again.',
});
const adminLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 300,
  message: 'Too many admin requests. Please slow down and try again.',
});

// 🔥 CRITICAL FIX (Render dynamic port)
const PORT = process.env.PORT || 10000;

// ✅ CORS (safe + works everywhere)
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// ✅ SECURITY (production only)
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET || '';

  if (secret.length < 32) {
	console.error('FATAL: JWT_SECRET must be at least 32 characters.');
	process.exit(1);
  }

  app.use(
	helmet({
	  contentSecurityPolicy: false,
	  crossOriginEmbedderPolicy: false,
	})
  );
}

// ✅ HEALTH CHECK (Render uses this implicitly)
app.get('/api/health', (_req, res) => {
  res.json({
	ok: true,
	name: 'Nudge API',
	database: isUsingPostgres() ? 'postgres' : 'json-file',
  });
});

// ✅ REGISTRATION STATUS
app.get('/api/registration-status', async (_req, res) => {
  try {
    const db = await readDb();
    const mode = db.globalConfig?.registrationMode || 'open';
    const needsInvite = mode === 'invite';
    let message = 'Anyone can create an account.';
    if (mode === 'closed') message = 'New self-registration is disabled. Ask your administrator to create an account.';
    if (mode === 'invite') message = 'Invite required.';
    res.json({ mode, needsInvite, message });
  } catch {
    res.status(500).json({ error: 'Could not read registration settings' });
  }
});

// ✅ ROUTES
app.use('/api/auth/login', authSensitiveLimiter);
app.use('/api/auth/register', authSensitiveLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/notes', notesRoutes);

// ✅ SERVE FRONTEND (IMPORTANT FIX)
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, '../../client/dist');

if (existsSync(clientDist)) {
  console.log('Serving frontend from:', clientDist);

  app.use(express.static(clientDist));

  app.get('*', (_req, res) => {
	res.sendFile(join(clientDist, 'index.html'));
  });
} else {
  console.warn('⚠️ No frontend build found at:', clientDist);
}

// ✅ GLOBAL ERROR HANDLER (no crashes → no 502)
app.use((err, _req, res, _next) => {
  console.error('🔥 ERROR:', err);

  res.status(err.status || 500).json({
	error: err.message || 'Server error',
  });
});

// ✅ START SERVER (bind to 0.0.0.0 for Render)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Nudge API running on port ${PORT}`);
  console.log(`🗄 Database: ${isUsingPostgres() ? 'PostgreSQL' : 'JSON file'}`);
});

// ✅ CLEAN SHUTDOWN (prevents memory leaks)
async function shutdown() {
  console.log('Shutting down...');
  try {
	await closeDb();
  } catch (e) {
	console.error(e);
  }
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
