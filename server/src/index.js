import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
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

function parseOrigins() {
  const raw = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const allowedOrigins = parseOrigins();

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
	}),
  );
}

app.use(
  cors({
	origin(origin, callback) {
	  if (!origin) return callback(null, true);
	  if (allowedOrigins.includes(origin)) return callback(null, true);
	  if (String(origin).toLowerCase().startsWith('capacitor://')) return callback(null, true);
	  if (
		process.env.NODE_ENV !== 'production' &&
		/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin))
	  ) {
		return callback(null, true);
	  }
	  return callback(null, false);
	},
	credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));

// ✅ HEALTH ROUTE
app.get('/api/health', (_req, res) => {
  res.json({
	ok: true,
	name: 'Nudge API',
	database: isUsingPostgres() ? 'postgres' : 'json-file',
  });
});

// ✅ ✅ FIXED ROUTE (THIS IS THE IMPORTANT PART)
app.get('/api/registration-status', (req, res) => {
  res.json({
	mode: 'invite',
	needsInvite: true,
	message: 'Invite required'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/presence', presenceRoutes);

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, '..', '..', 'client', 'dist');

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
	res.sendFile(join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const message =
	process.env.NODE_ENV === 'production' && status === 500
	  ? 'Server error'
	  : err.message || 'Server error';
  res.status(status).json({ error: message });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Nudge API listening on http://localhost:${PORT}`);
  console.log(
	`Database: ${
	  isUsingPostgres()
		? 'PostgreSQL (DATABASE_URL)'
		: 'JSON file (server/data/db.json)'
	}`
  );
});

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
