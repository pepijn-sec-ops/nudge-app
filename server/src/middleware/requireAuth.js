import { verifyToken } from '../auth.js';
import { readDb } from '../db.js';
import { isAdminRole, normalizeRole } from '../roles.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const decoded = verifyToken(token);
    if (!decoded?.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const db = await readDb();
    const user = db.users.find((u) => u.id === decoded.sub);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    const role = normalizeRole(user.role);
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
    };
    req.fullUser = user;
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

export function requireAdmin(req, res, next) {
  if (!isAdminRole(req.user?.role)) {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}
