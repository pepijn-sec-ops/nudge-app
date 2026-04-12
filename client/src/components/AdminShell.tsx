import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

const nav =
  'block rounded-2xl px-4 py-3 text-sm font-bold transition hover:bg-white/10 text-white/90 hover:text-white';

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav2 = useNavigate();

  return (
    <div className="flex min-h-dvh bg-gradient-to-br from-[#1a1b2e] via-[#16213e] to-[#0f3460] text-white">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/10 bg-black/20 p-4 md:flex">
        <div className="mb-6 rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-white/60">
          Nudge Admin
        </div>
        <NavLink to="/admin" end className={({ isActive }) => `${nav} ${isActive ? 'bg-white/15 text-white shadow-inner' : ''}`}>
          Dashboard
        </NavLink>
        <button
          type="button"
          className={`${nav} mt-6 text-left text-emerald-200 hover:text-emerald-100`}
          onClick={() => {
            void nav2('/');
          }}
        >
          ← Back to app
        </button>
        <div className="mt-auto border-t border-white/10 pt-4 text-xs text-white/50">
          Signed in as <span className="font-semibold text-white/80">{user?.email}</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold md:hidden"
              onClick={() => void nav2('/')}
            >
              ← App
            </button>
            <h1 className="text-lg font-extrabold tracking-tight">Administration</h1>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20"
          >
            Log out
          </button>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-6xl text-slate-100">{children}</div>
        </main>
      </div>
    </div>
  );
}
