import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readDb, writeDb } from '../db.js';
import { hashPassword, comparePassword, signToken, verifyToken } from '../auth.js';
import { defaultPreferences } from '../userDefaults.js';
import { normalizeRole } from '../roles.js';

const router = Router();

function getClientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || req.ip || req.socket?.remoteAddress || 'unknown';
}

function makeAuthSession(req) {
  return {
    id: uuid(),
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    ip: String(getClientIp(req)).slice(0, 120),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 240),
  };
}

function publicUser(u) {
  const rawBuddy = String(u?.preferences?.buddyId || '').trim().toLowerCase();
  const buddyId = rawBuddy === 'dog' ? 'bruno' : rawBuddy;
  return {
	id: u.id,
	name: u.name,
	email: u.email,
	role: normalizeRole(u.role),
	xp: u.xp,
	badges: u.badges,
	preferences: {
	  ...u.preferences,
	  buddyId: ['luna', 'bolt', 'pip', 'bruno'].includes(buddyId) ? buddyId : 'luna',
	},
	currentWorkSession: u.currentWorkSession ?? null,
	currentFocusSession: u.currentFocusSession ?? null,
  };
}

router.get('/registration-status', async (_req, res) => {
  try {
	const db = await readDb();
	const mode = db.globalConfig?.registrationMode || 'open';
	const needsInvite = mode === 'invite';
	let message = 'Anyone can create an account.';
	if (mode === 'closed') message = 'New self-registration is disabled. Your host can create an account for you.';
	if (mode === 'invite') message = 'You need an invite code from your host to register.';
	res.json({ mode, needsInvite, message });
  } catch (err) {
	console.error(err);
	res.status(500).json({ error: 'Could not read registration settings' });
  }
});

router.post('/register', async (req, res) => {
  try {
	const { name, email, password, inviteCode } = req.body || {};

	if (!name || !email || !password) {
	  return res.status(400).json({ error: 'Name, email, and password required' });
	}

	const pw = String(password);
	if (pw.length < 6 || pw.length > 200) {
	  return res.status(400).json({ error: 'Password must be between 6 and 200 characters' });
	}

	const normalized = String(email).toLowerCase().trim();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
	  return res.status(400).json({ error: 'Invalid email address' });
	}

	const db0 = await readDb();
	const mode = db0.globalConfig?.registrationMode || 'open';

	// 🔒 BLOCK ALL REGISTRATION
	if (mode === 'closed') {
	  return res.status(403).json({
		error: 'Registration is closed. Ask your administrator to create an account for you.',
	  });
	}

	// 🔥 INVITE SYSTEM (THIS IS THE IMPORTANT PART)
	let inviteId = null;

	if (mode === 'invite') {
	  const raw = String(inviteCode || '').trim().toUpperCase();

	  if (!raw) {
		return res.status(400).json({ error: 'Invite code required' });
	  }

	  const invites = db0.globalConfig?.inviteCodes || [];

	  const row = invites.find(
		(x) => x.active !== false && String(x.code).toUpperCase() === raw
	  );

	  if (!row) {
		return res.status(400).json({ error: 'Invalid invite code' });
	  }

	  const max = row.maxUses;
	  if (max != null && (row.uses || 0) >= max) {
		return res.status(400).json({ error: 'This invite code has reached its use limit' });
	  }
	  inviteId = row.id;
	}

	const db = await readDb();

	if (db.users.some((u) => u.email === normalized)) {
	  return res.status(409).json({ error: 'Email already registered' });
	}

	const passwordHash = await hashPassword(pw);
	const id = uuid();
	const isFirstUser = db.users.length === 0;

	const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();

	const role =
	  isFirstUser || (adminEmail && adminEmail === normalized) ? 'admin' : 'user';

	const user = {
	  id,
	  name: String(name).trim().slice(0, 120),
	  email: normalized,
	  passwordHash,
	  role,
	  xp: 0,
	  badges: [],
	  preferences: defaultPreferences(),
	  currentWorkSession: null,
	  currentFocusSession: null,
	  tokenVersion: 0,
	  authSessions: [makeAuthSession(req)],
	  createdAt: new Date().toISOString(),
	};

	await writeDb((d) => {
	  d.users.push(user);

	  if (inviteId && (d.globalConfig?.registrationMode || 'open') === 'invite') {
		const inv = (d.globalConfig.inviteCodes || []).find((x) => x.id === inviteId);
		if (inv) inv.uses = (inv.uses || 0) + 1;
	  }
	});

	const token = signToken({ sub: id, role: normalizeRole(role), tv: 0 });

	res.json({
	  token,
	  user: publicUser(user),
	});
  } catch (err) {
	console.error(err);
	res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
	const { email, password } = req.body || {};

	if (!email || !password) {
	  return res.status(400).json({ error: 'Email and password required' });
	}

	const db = await readDb();

	const user = db.users.find(
	  (u) => u.email === String(email).toLowerCase().trim()
	);

	const hash = user?.passwordHash || user?.passwordhash;

	if (!user || !hash || !(await comparePassword(String(password), hash))) {
	  return res.status(401).json({ error: 'Invalid credentials' });
	}

	const role = normalizeRole(user.role);
	const tokenVersion = Math.max(0, Number(user.tokenVersion) || 0);
	await writeDb((d) => {
	  const u = d.users.find((x) => x.id === user.id);
	  if (!u) return;
	  if (typeof u.tokenVersion !== 'number') u.tokenVersion = tokenVersion;
	  if (!Array.isArray(u.authSessions)) u.authSessions = [];
	  u.authSessions.push(makeAuthSession(req));
	  if (u.authSessions.length > 30) {
	    u.authSessions = u.authSessions.slice(-30);
	  }
	});
	const token = signToken({ sub: user.id, role, tv: tokenVersion });

	res.json({
	  token,
	  user: publicUser(user),
	});
  } catch (err) {
	console.error(err);
	res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', async (req, res) => {
  try {
	const header = req.headers.authorization;
	const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

	if (!token) return res.status(401).json({ error: 'Unauthorized' });

	const decoded = verifyToken(token);

	if (!decoded?.sub) return res.status(401).json({ error: 'Invalid token' });

	const db = await readDb();
	const user = db.users.find((u) => u.id === decoded.sub);

	if (!user) return res.status(401).json({ error: 'User not found' });

	res.json({ user: publicUser(user) });
  } catch (err) {
	console.error(err);
	res.status(500).json({ error: 'Could not load profile' });
  }
});
export default router;
