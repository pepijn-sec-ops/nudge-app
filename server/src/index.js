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
const PORT = Number(process.env.PORT) || 4000;

// ✅ SIMPLE, RELIABLE CORS (FIXES YOUR MAIN ISSUE)
app.use(cors({
  origin: true, // allow ALL origins safely
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// ✅ SECURITY (only in production)
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32) {
	console.error('FATAL: Set JWT_SECRET to at least 32 random characters in production.');
	process.exit(1);
  }

  app.use(
	helmet({
	  contentSecurityPolicy: false,
	  crossOriginEmbedderPolicy: false,
	})
  );
}

// ✅ HEALTH ROUTE
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
	message: 'Invite required'
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

// ✅ SERVE FRONTEND (if exists)
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, '..', '..', 'client', 'dist');

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
	res.sendFile(join(clientDist, 'index.html'));
  });
}

// ✅ GLOBAL ERROR HANDLER (prevents 502 crashes)
app.use((err, _req, res, _next) => {
  console.error('🔥 ERROR:', err);

  const status = err.status && Number.isInteger(err.status) ? err.status : 500;

  res.status(status).json({
	error: err.message || 'Server error'
  });
});

// ✅ START SERVER
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Nudge API running on port ${PORT}`);
  console.log(
	`Database: ${
	  isUsingPostgres()
		? 'PostgreSQL'
		: 'JSON file'
	}`
  );
});

// ✅ CLEAN SHUTDOWN
async function shutdown() {
  try {
	await closeDb();
  } catch (e) {
	console.error(e);
  }
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
