import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

type RegStatus = {
  mode: 'open' | 'invite' | 'closed';
  needsInvite: boolean;
  message: string;
};

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<RegStatus | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [err, setErr] = useState('');
  const inviteFromLink = searchParams.get('invite')?.trim() || '';

  useEffect(() => {
  void (async () => {
	try {
	  const s = await api<RegStatus>('/api/registration-status');
	  setStatus(s);
	} catch {
	  setStatus({
		mode: 'open',
		needsInvite: false,
		message: 'Could not load rules; trying open registration.',
	  });
	}
  })();
}, []);

  useEffect(() => {
    if (inviteFromLink) setInviteCode(inviteFromLink.toUpperCase());
  }, [inviteFromLink]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (status?.mode === 'closed') return;
    try {
      await register(name, email, password, inviteCode.trim() || undefined);
      nav('/', { replace: true });
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : 'Registration failed');
    }
  }

  const closed = status?.mode === 'closed';

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-8 shadow-xl backdrop-blur-md"
      >
        <h1 className="text-2xl font-extrabold text-[color:var(--nudge-text)]">Create Nudge</h1>
        <p className="mt-1 text-sm opacity-75">{status?.message || 'Checking registration…'}</p>

        {closed && (
          <div className="mt-6 rounded-2xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-950">
            Self-registration is turned off. Ask the person who runs this app to create an account for you (they can
            do that in the admin panel), or use your invite link if they sent one.
          </div>
        )}

        {!closed && (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {status?.needsInvite && (
              <label className="block text-left text-sm font-semibold">
                Invite code {inviteFromLink ? '(from link)' : ''}
                <input
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 font-mono outline-none ring-[color:var(--nudge-primary)] focus:ring-2"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="From your host"
                  required
                  autoComplete="off"
                />
              </label>
            )}
            <label className="block text-left text-sm font-semibold">
              Name
              <input
                className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none ring-[color:var(--nudge-primary)] focus:ring-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
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
                minLength={6}
                required
              />
            </label>
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <button
              type="submit"
              className="w-full rounded-[2rem] bg-[color:var(--nudge-primary)] py-3 text-lg font-bold text-white shadow-lg transition hover:brightness-105"
            >
              Create account
            </button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link className="font-semibold underline" to="/login">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
