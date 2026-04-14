import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isUserAdmin } from '../lib/roles';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { api, type User } from '../lib/api';

const ALERT_MINUTES = [60, 45, 30, 20, 15, 10, 5, 3, 2, 1];

const themes = [
  { id: 'cozy', label: 'Cozy' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'night_owl', label: 'Night Owl' },
  { id: 'minimal_zen', label: 'Minimal Zen' },
];

const timezones = [
  'UTC',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export default function Settings() {
  const { pathname } = useLocation();
  const isProfileRoute = pathname.endsWith('/profile');
  const { user, refreshUser, setUserLocal } = useAuth();
  const p = user?.preferences;
  const [messages, setMessages] = useState('');
  const [profileName, setProfileName] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');

  useEffect(() => {
    if (p?.motivationalMessages) setMessages(p.motivationalMessages.join('\n'));
  }, [p?.motivationalMessages]);

  useEffect(() => {
    if (user?.name) setProfileName(user.name);
  }, [user?.name]);

  if (!user || !p) return null;

  async function savePrefs(body: Record<string, unknown>) {
    if (!user) return;
    const currentUser: User = user;
    setSaveErr('');
    try {
      const data = await api<{ preferences: User['preferences'] }>('/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setUserLocal({
        ...currentUser,
        preferences: data.preferences,
      });
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Could not save settings');
    }
  }

  async function saveProfile() {
    const data = await api<{ user: User }>('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name: profileName }),
    });
    setUserLocal(data.user);
  }

  async function changePassword() {
    setPwMsg('');
    try {
      await api('/api/account/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      setCurrentPw('');
      setNewPw('');
      setPwMsg('Password updated.');
    } catch (e) {
      setPwMsg(e instanceof Error ? e.message : 'Could not update password');
    }
  }

  const card = 'rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-6 shadow-xl backdrop-blur-md';
  const label = 'block text-left text-sm font-bold text-[color:var(--nudge-text)]';
  const input =
    'mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 font-semibold outline-none ring-[color:var(--nudge-primary)] focus:ring-2';

  const rawBuddyId = String(p.buddyId ?? 'luna');
  const selectedBuddy = rawBuddyId === 'dog' ? 'bruno' : rawBuddyId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-[color:var(--nudge-text)]">
          {isProfileRoute ? 'Profile' : 'Settings'}
        </h1>
        <p className="mt-1 text-sm opacity-75">
          {isProfileRoute
            ? 'Personalize Bolt, color mood, sounds, and your account — all in one calm place.'
            : 'Tune Nudge to your senses, schedule, and account.'}
        </p>
        {saveErr && <p className="mt-2 text-sm font-semibold text-rose-700">{saveErr}</p>}
      </div>

      {isUserAdmin(user.role) && (
        <section className="rounded-[2rem] border border-indigo-200 bg-indigo-50/90 p-5 shadow-lg backdrop-blur-md">
          <h2 className="text-lg font-extrabold text-indigo-950">Administrator</h2>
          <p className="mt-1 text-sm text-indigo-900/80">
            The admin console uses a separate layout so it does not mix with your daily Nudge navigation.
          </p>
          <Link
            to="/admin"
            className="mt-4 inline-flex rounded-[2rem] bg-indigo-700 px-5 py-3 text-sm font-extrabold text-white shadow hover:bg-indigo-800"
          >
            Open admin console →
          </Link>
        </section>
      )}

      <section className={card}>
        <h2 className="text-xl font-extrabold text-[color:var(--nudge-text)]">Color mood</h2>
        <p className="mt-1 text-sm opacity-70">
          Instant palette for background, text, and buttons — no reload. Default follows your structural theme
          (Cozy, Midnight, …) from Appearance.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              ['default', 'Default'],
              ['midnight', 'Midnight'],
              ['forest', 'Forest'],
              ['sunset', 'Sunset'],
              ['dawn', 'Bloom dawn'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => void savePrefs({ uiColorPreset: id })}
              className={`rounded-[2rem] border px-3 py-3 text-sm font-extrabold shadow-sm transition ${
                (p.uiColorPreset ?? 'default') === id
                  ? 'border-[color:var(--nudge-primary)] bg-[color:var(--nudge-primary)]/15 text-[color:var(--nudge-text)]'
                  : 'border-white/40 bg-white/60 hover:bg-white/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="text-xl font-extrabold text-[color:var(--nudge-text)]">Account</h2>
        <p className="mt-1 text-sm opacity-70">Profile name and password (stored securely on the server).</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className={label}>
              Display name
              <input className={input} value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            </label>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              className="mt-3 rounded-[2rem] bg-[color:var(--nudge-primary)] px-5 py-2 text-sm font-extrabold text-white shadow"
              onClick={() => void saveProfile()}
            >
              Save name
            </motion.button>
          </div>
          <div className="rounded-2xl bg-white/50 p-4 text-sm opacity-80">
            <p>
              <span className="font-bold">Email:</span> {user.email}
            </p>
            <p className="mt-2 text-xs">Email cannot be changed in this version.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 border-t border-white/30 pt-6 md:grid-cols-2">
          <label className={label}>
            Current password
            <input className={input} type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
          </label>
          <label className={label}>
            New password
            <input className={input} type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-[2rem] bg-[color:var(--nudge-text)] px-5 py-2 text-sm font-extrabold text-white shadow"
            onClick={() => void changePassword()}
          >
            Update password
          </button>
          {pwMsg && <span className="text-sm font-semibold text-[color:var(--nudge-text)]">{pwMsg}</span>}
        </div>
      </section>

      <section className={card}>
        <h2 className="text-xl font-extrabold text-[color:var(--nudge-text)]">Appearance</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Theme
            <select
              className={input}
              value={p.themeId}
              onChange={(e) => void savePrefs({ themeId: e.target.value })}
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Focus buddy
            <select
              className={input}
              value={selectedBuddy}
              onChange={(e) => void savePrefs({ buddyId: e.target.value })}
            >
              <option value="luna">Luna the Cat</option>
              <option value="bolt">Bolt the Bot</option>
              <option value="pip">Pip the Bird</option>
              <option value="bruno">Bruno the Golden Retriever</option>
            </select>
          </label>
          <label className={label}>
            Primary button
            <input
              type="color"
              className="mt-1 h-11 w-full cursor-pointer rounded-2xl border border-black/10 bg-white"
              value={p.primaryColor}
              onChange={(e) => void savePrefs({ primaryColor: e.target.value })}
            />
          </label>
          <label className={label}>
            Accent
            <input
              type="color"
              className="mt-1 h-11 w-full cursor-pointer rounded-2xl border border-black/10 bg-white"
              value={p.accentColor}
              onChange={(e) => void savePrefs({ accentColor: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className={`${card} bg-white/60`}>
        <h2 className="text-xl font-extrabold text-[color:var(--nudge-text)]">Interface palette</h2>
        <p className="mt-1 text-sm opacity-70">
          Quick brand mixes (overrides custom colors below until you pick “Custom”).
        </p>
        <label className={`${label} mt-4`}>
          Accent preset
          <select
            className={input}
            value={p.interfaceAccent ?? 'custom'}
            onChange={(e) => void savePrefs({ interfaceAccent: e.target.value })}
          >
            <option value="custom">Custom (use color pickers)</option>
            <option value="coral">Warm coral (default)</option>
            <option value="ocean">Ocean</option>
            <option value="lavender">Lavender</option>
            <option value="forest">Forest</option>
            <option value="sunset">Sunset</option>
          </select>
        </label>
      </section>

      <section className={`${card} bg-white/60`}>
        <h2 className="text-xl font-extrabold text-[color:var(--nudge-text)]">Focus & audio defaults</h2>
        <p className="mt-1 text-sm opacity-70">Applied when you open Focus (unless you start from a task preset).</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Default focus length (minutes)
            <input
              type="number"
              min={5}
              max={180}
              className={input}
              value={p.defaultFocusMinutes ?? 25}
              onChange={(e) => void savePrefs({ defaultFocusMinutes: Number(e.target.value) })}
            />
          </label>
          <label className={label}>
            Ambient sound default
            <select
              className={input}
              value={p.ambientDefault ?? 'off'}
              onChange={(e) => void savePrefs({ ambientDefault: e.target.value })}
            >
              <option value="off">Off</option>
              <option value="rain">Rain</option>
              <option value="white">White noise</option>
              <option value="brown">Brown noise</option>
            </select>
          </label>
          <label className={label}>
            Session end chime
            <select
              className={input}
              value={p.sessionCompleteSound ?? 'lofi'}
              onChange={(e) => void savePrefs({ sessionCompleteSound: e.target.value })}
            >
              <option value="lofi">Lo-fi (soft)</option>
              <option value="digital">Digital (bright)</option>
              <option value="nature">Nature (airy)</option>
            </select>
          </label>
          <label className="flex items-center gap-3 text-sm font-bold text-[color:var(--nudge-text)]">
            <input
              type="checkbox"
              checked={p.focusVoiceCuesEnabled !== false}
              onChange={(e) => void savePrefs({ focusVoiceCuesEnabled: e.target.checked })}
            />
            Focus voice cues (10-minute marks + 1-minute)
          </label>
          <label className="flex items-center gap-3 text-sm font-bold text-[color:var(--nudge-text)]">
            <input
              type="checkbox"
              checked={p.ttsEnabled !== false}
              onChange={(e) => void savePrefs({ ttsEnabled: e.target.checked })}
            />
            Voice time alerts (see thresholds below + session complete)
          </label>
          <label className="flex items-center gap-3 text-sm font-bold text-[color:var(--nudge-text)]">
            <input
              type="checkbox"
              checked={p.showFocusTips !== false}
              onChange={(e) => void savePrefs({ showFocusTips: e.target.checked })}
            />
            Show gentle tips on Focus page
          </label>
        </div>
        {p.showFocusTips !== false && (
          <p className="mt-4 rounded-2xl bg-white/70 p-3 text-sm text-[color:var(--nudge-text)]/85">
            Tip: Pair a pinned task with Zen mode for a softer visual field. Use mute if you need silence without
            changing ambient levels.
          </p>
        )}
      </section>

      <section className={card}>
        <h2 className="text-xl font-extrabold text-[color:var(--nudge-text)]">Voice alerts</h2>
        <p className="mt-1 text-sm opacity-70">
          When Focus voice cues are off, these minute marks apply. When they are on, the timer uses 10-minute marks
          plus the 1-minute call instead. At least one chip stays on here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {ALERT_MINUTES.map((m) => {
            const active = new Set(p.ttsAlertMinutes ?? [10, 5, 1]).has(m);
            return (
              <button
                key={m}
                type="button"
                disabled={(p.ttsAlertMinutes ?? [10, 5, 1]).length === 1 && active}
                onClick={() => {
                  const cur = new Set(p.ttsAlertMinutes ?? [10, 5, 1]);
                  if (cur.has(m)) cur.delete(m);
                  else cur.add(m);
                  let next = [...cur].sort((a, b) => b - a);
                  if (next.length === 0) next = [1];
                  void savePrefs({ ttsAlertMinutes: next });
                }}
                className={`rounded-full px-4 py-2 text-sm font-extrabold transition ${
                  active ? 'bg-[color:var(--nudge-primary)] text-white shadow' : 'bg-white/70 hover:bg-white'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {m} min
              </button>
            );
          })}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Speech rate ({(p.ttsRate ?? 1).toFixed(2)}×)
            <input
              type="range"
              min={0.5}
              max={1.6}
              step={0.05}
              className="mt-2 w-full"
              value={p.ttsRate ?? 1}
              onChange={(e) => void savePrefs({ ttsRate: Number(e.target.value) })}
            />
          </label>
          <label className={label}>
            Speech pitch ({(p.ttsPitch ?? 1).toFixed(2)})
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              className="mt-2 w-full"
              value={p.ttsPitch ?? 1}
              onChange={(e) => void savePrefs({ ttsPitch: Number(e.target.value) })}
            />
          </label>
        </div>
        <p className="mt-3 text-xs opacity-60">
          Rate and pitch use the browser speech engine; results vary slightly by device.
        </p>
      </section>

      <section className={`${card} bg-white/60`}>
        <h2 className="text-xl font-extrabold text-[color:var(--nudge-text)]">Schedule & region</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Timezone (for your reference)
            <select className={input} value={p.timezone || 'UTC'} onChange={(e) => void savePrefs({ timezone: e.target.value })}>
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Week starts on (stats)
            <select
              className={input}
              value={String(p.weekStartsOn ?? 1)}
              onChange={(e) => void savePrefs({ weekStartsOn: Number(e.target.value) })}
            >
              <option value="0">Sunday</option>
              <option value="1">Monday</option>
            </select>
          </label>
          <p className="text-xs text-[color:var(--nudge-text)]/70 sm:col-span-2">
            Stats charts currently use your device&apos;s local midnight buckets. This preference is stored for future
            calendar views.
          </p>
        </div>
      </section>

      <section className={`${card} bg-white/60`}>
        <h2 className="text-xl font-extrabold text-[color:var(--nudge-text)]">Motivation & voice</h2>
        <label className={label}>
          Rotating home messages (one per line)
          <textarea
            className="mt-1 min-h-[120px] w-full rounded-2xl border border-black/10 bg-white/80 p-3 font-semibold"
            value={messages}
            onChange={(e) => setMessages(e.target.value)}
            onBlur={() =>
              void savePrefs({
                motivationalMessages: messages.split('\n').map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </label>
        <label className={`${label} mt-4`}>
          Voice / TTS language (BCP-47, e.g. en-US, nl-NL)
          <input className={input} value={p.language} onChange={(e) => void savePrefs({ language: e.target.value })} />
        </label>
      </section>

      <section className={`${card} bg-white/60`}>
        <h2 className="text-xl font-extrabold text-[color:var(--nudge-text)]">Comfort & layout</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Font family
            <select
              className={input}
              value={p.fontFamily ?? 'nunito'}
              onChange={(e) => void savePrefs({ fontFamily: e.target.value })}
            >
              <option value="nunito">Nunito (friendly)</option>
              <option value="system">System UI</option>
            </select>
          </label>
          <label className="flex items-center gap-3 text-sm font-bold text-[color:var(--nudge-text)]">
            <input
              type="checkbox"
              checked={p.animationsEnabled !== false}
              onChange={(e) => void savePrefs({ animationsEnabled: e.target.checked })}
            />
            Interface animations
          </label>
          <label className="flex items-center gap-3 text-sm font-bold text-[color:var(--nudge-text)]">
            <input
              type="checkbox"
              checked={p.vibrationEnabled !== false}
              onChange={(e) => void savePrefs({ vibrationEnabled: e.target.checked })}
            />
            Vibration when a timer completes
          </label>
          <label className="flex items-center gap-3 text-sm font-bold text-[color:var(--nudge-text)]">
            <input
              type="checkbox"
              checked={!!p.compactMode}
              onChange={(e) => void savePrefs({ compactMode: e.target.checked })}
            />
            Compact layout (tighter header & page padding)
          </label>
          <label className="flex items-center gap-3 text-sm font-bold text-[color:var(--nudge-text)]">
            <input
              type="checkbox"
              checked={!!p.highContrast}
              onChange={(e) => void savePrefs({ highContrast: e.target.checked })}
            />
            Stronger shadows (easier depth cues)
          </label>
          <label className={label}>
            Font size
            <select className={input} value={p.fontSize} onChange={(e) => void savePrefs({ fontSize: e.target.value })}>
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </label>
          <label className={label}>
            Daily goal (minutes)
            <input
              type="number"
              min={5}
              max={480}
              className={input}
              value={p.dailyGoalMinutes}
              onChange={(e) => void savePrefs({ dailyGoalMinutes: Number(e.target.value) })}
            />
          </label>
        </div>
      </section>

      <section className="rounded-[2rem] border border-rose-200 bg-rose-50/80 p-6 shadow-lg backdrop-blur-md">
        <h2 className="text-xl font-extrabold text-rose-900">Danger zone</h2>
        <p className="mt-2 text-sm text-rose-900/80">
          Reset progression (XP, badges, sessions, moods) or wipe everything including tasks.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-[2rem] bg-white px-5 py-3 text-sm font-extrabold text-rose-700 shadow"
            onClick={async () => {
              if (!confirm('Reset XP, badges, and session history?')) return;
              await api('/api/stats/reset-progress', { method: 'POST', body: '{}' });
              await refreshUser();
            }}
          >
            Reset progression
          </button>
          <button
            type="button"
            className="rounded-[2rem] bg-rose-600 px-5 py-3 text-sm font-extrabold text-white shadow"
            onClick={async () => {
              if (!confirm('Delete ALL tasks and history? This cannot be undone.')) return;
              await api('/api/stats/reset-all', { method: 'POST', body: '{}' });
              await refreshUser();
            }}
          >
            Reset all data
          </button>
        </div>
      </section>
    </div>
  );
}
