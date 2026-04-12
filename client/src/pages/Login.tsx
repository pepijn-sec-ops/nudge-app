import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await login(email, password);
      nav('/', { replace: true });
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : 'Login failed');
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-8 shadow-xl backdrop-blur-md"
      >
        <h1 className="text-2xl font-extrabold text-[color:var(--nudge-text)]">Welcome back</h1>
        <p className="mt-1 text-sm opacity-75">Sign in to your Nudge space.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-left text-sm font-semibold">
            Email
            <input
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none ring-[color:var(--nudge-primary)] focus:ring-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </label>
          <label className="block text-left text-sm font-semibold">
            Password
            <input
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none ring-[color:var(--nudge-primary)] focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </label>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <button
            type="submit"
            className="w-full rounded-[2rem] bg-[color:var(--nudge-primary)] py-3 text-lg font-bold text-white shadow-lg transition hover:brightness-105"
          >
            Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          New here?{' '}
          <Link className="font-semibold underline" to="/register">
            Create an account
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
