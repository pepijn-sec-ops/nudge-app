import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../lib/roles';
import { AdminShell } from './AdminShell';

/** Admin-only area: separate shell from the main Nudge app. */
export function AdminLayout() {
  const { user } = useAuth();
  if (!isUserAdmin(user?.role)) return <Navigate to="/" replace />;
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
