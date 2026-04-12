/**
 * Single source of truth for admin checks: role === 'admin' (normalized).
 * Never use a separate isAdmin flag — normalize DB/API values here.
 */
export function normalizeRole(role) {
  if (role == null) return 'user';
  const r = String(role).toLowerCase().trim();
  return r === 'admin' ? 'admin' : 'user';
}

export function isAdminRole(role) {
  return normalizeRole(role) === 'admin';
}
