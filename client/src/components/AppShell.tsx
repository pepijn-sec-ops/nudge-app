import { NavLink, Outlet } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../lib/roles';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-2xl px-3 py-2 text-sm font-semibold transition ${
    isActive ? 'bg-white/70 shadow' : 'hover:bg-white/40'
  }`;

export function AppShell() {
  const { user, logout } = useAuth();
  const anim = user?.preferences?.animationsEnabled !== false;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-white/30 bg-[color:var(--nudge-card)]/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            {anim ? (
              <motion.span
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--nudge-primary)] text-white shadow"
                animate={{ rotate: [0, -4, 4, 0] }}
                transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
              >
                N
              </motion.span>
            ) : (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--nudge-primary)] text-white shadow">
                N
              </span>
            )}
            <span>Nudge</span>
          </NavLink>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/" end className={linkClass}>
              Home
            </NavLink>
            <NavLink to="focus" className={linkClass}>
              Focus
            </NavLink>
            <NavLink to="tasks" className={linkClass}>
              Tasks
            </NavLink>
            <NavLink to="work" className={linkClass}>
              Work
            </NavLink>
            <NavLink to="notes" className={linkClass}>
              Notes
            </NavLink>
            <NavLink to="stats" className={linkClass}>
              Stats
            </NavLink>
            <NavLink to="profile" className={linkClass}>
              Profile
            </NavLink>
            {isUserAdmin(user?.role) && (
              <NavLink to="/admin" className={linkClass}>
                Admin
              </NavLink>
            )}
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-2xl px-3 py-2 text-sm font-semibold opacity-80 hover:bg-white/40"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto min-h-0 w-full min-w-0 max-w-5xl flex-1 overflow-x-auto px-4 py-6 text-[color:var(--nudge-text)]">
        <Outlet />
      </main>
    </div>
  );
}
