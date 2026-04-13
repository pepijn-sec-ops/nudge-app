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

import { closeDb, isUsingPostgres } from './db.js';

const app = express();

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
app.get('/api/registration-status', (_req, res) => {
  res.json({
	mode: 'invite',
	needsInvite: true,
	message: 'Invite required',
  });
});

// ✅ ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/presence', presenceRoutes);

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
