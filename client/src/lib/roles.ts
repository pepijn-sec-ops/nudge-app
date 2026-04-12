/** Must match server: only `role === 'admin'` (after normalize) grants admin UI. */
export function normalizeUserRole(role: string | undefined | null): 'user' | 'admin' {
  if (role == null) return 'user';
  const r = String(role).toLowerCase().trim();
  return r === 'admin' ? 'admin' : 'user';
}

export function isUserAdmin(role: string | undefined | null): boolean {
  return normalizeUserRole(role) === 'admin';
}
