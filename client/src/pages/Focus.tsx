import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, type FocusSessionState } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { MoodCheckIn } from '../components/MoodCheckIn';
import { FocusBuddy } from '../components/FocusBuddy';
import {
  ambientAudio,
  playSessionCompleteSound
} from '../services/audioService';
import type { AmbientKind } from '../services/audioService';
import { tts } from '../services/ttsService';

type Loc = { minutes?: number };
type PersistedFocusState = {
  minutes: number;
  remaining: number;
  running: boolean;
  paused: boolean;
  endAtMs: number | null;
  stuckBreakEndMs: number | null;
};
const FOCUS_SESSION_KEY = 'nudge_focus_session_v1';

export default function Focus() {
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const loc = (location.state || {}) as Loc;

  const [minutes, setMinutes] = useState(loc.minutes ?? 25);
  const [remaining, setRemaining] = useState(() => (loc.minutes ?? 25) * 60);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [zen, setZen] = useState(false);
  const [ambient, setAmbient] = useState<AmbientKind>('off');
  const [vol, setVol] = useState(0.35);
  const [muteAll, setMuteAll] = useState(false);
  const [stuckBreakSec, setStuckBreakSec] = useState(0);
  const [ideaNote, setIdeaNote] = useState('');

  const [moodOpen, setMoodOpen] = useState(false);
  const [pendingComplete, setPendingComplete] = useState<{ actual: number; planned: number } | null>(null);

  const prevRem = useRef(remaining);
  const lastTickMsRef = useRef(Date.now());
  const tickRef = useRef<number | null>(null);
  const endedRef = useRef(false);
  const prefsRef = useRef(user?.preferences);

  const lang = user?.preferences?.language || 'en';

  const syncFocusServer = useCallback(
    async (payload: FocusSessionState | { clear: true }) => {
      try {
        await api('/api/sessions/focus/active', {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } catch {
        /* offline */
      }
    },
    [],
  );

  useEffect(() => {
    tts.unlock();
  }, []);

  function completeByTimer(planned: number) {
    if (endedRef.current) return;
    endedRef.current = true;
    setRunning(false);
    setPaused(false);
    setStuckBreakSec(0);
    setRemaining(0);
    sendHeartbeat(false);
    playSessionCompleteSound('lofi', muteAll);
    setTimeout(() => {
      tts.announceComplete(lang);
    }, 300);
    setPendingComplete({ actual: planned, planned });
    setMoodOpen(true);
    void syncFocusServer({ clear: true });
  }

  // Restore focus session from server first, then local fallback.
  useEffect(() => {
    let active = true;
    void api<{ currentFocusSession: FocusSessionState | null }>('/api/sessions/focus/active')
      .then((data) => {
        if (!active) return;
        const s = data.currentFocusSession;
        if (s) {
          const safeMinutes = Math.max(1, Number(s.plannedMinutes) || 25);
          setMinutes(safeMinutes);
          setRunning(true);
          setPaused(!!s.isPaused);
          if (!s.isPaused && s.endsAt) {
            const rem = Math.max(0, Math.ceil((new Date(s.endsAt).getTime() - Date.now()) / 1000));
            setRemaining(rem);
            if (rem <= 0) completeByTimer(safeMinutes);
          } else {
            setRemaining(Math.max(0, Number(s.remainingSeconds) || safeMinutes * 60));
          }
          if (s.stuckBreakEndAt) {
            const left = Math.max(0, Math.ceil((new Date(s.stuckBreakEndAt).getTime() - Date.now()) / 1000));
            setStuckBreakSec(left);
          }
          return;
        }

        // Local fallback for offline resumes.
        try {
          const raw = localStorage.getItem(FOCUS_SESSION_KEY);
          if (!raw) return;
          const saved = JSON.parse(raw) as PersistedFocusState;
          if (!saved || typeof saved !== 'object') return;
          const safeMinutes = Math.max(1, Number(saved.minutes) || 25);
          const safeRemaining = Math.max(0, Number(saved.remaining) || 0);
          setMinutes(safeMinutes);
          setRunning(!!saved.running);
          setPaused(!!saved.paused);
          if (saved.running && !saved.paused && Number(saved.endAtMs)) {
            const rem = Math.max(0, Math.ceil((Number(saved.endAtMs) - Date.now()) / 1000));
            setRemaining(rem);
            if (rem <= 0) {
              completeByTimer(safeMinutes);
            }
          } else {
            setRemaining(safeRemaining || safeMinutes * 60);
          }
          if (saved.stuckBreakEndMs) {
            const left = Math.max(0, Math.ceil((Number(saved.stuckBreakEndMs) - Date.now()) / 1000));
            setStuckBreakSec(left);
          }
        } catch {
          /* ignore malformed persisted timer state */
        }
      })
      .catch(() => {
        // Local fallback for offline resumes.
        try {
          const raw = localStorage.getItem(FOCUS_SESSION_KEY);
          if (!raw) return;
          const saved = JSON.parse(raw) as PersistedFocusState;
          if (!saved || typeof saved !== 'object') return;
          const safeMinutes = Math.max(1, Number(saved.minutes) || 25);
          const safeRemaining = Math.max(0, Number(saved.remaining) || 0);
          setMinutes(safeMinutes);
          setRunning(!!saved.running);
          setPaused(!!saved.paused);
          if (saved.running && !saved.paused && Number(saved.endAtMs)) {
            const rem = Math.max(0, Math.ceil((Number(saved.endAtMs) - Date.now()) / 1000));
            setRemaining(rem);
            if (rem <= 0) {
              completeByTimer(safeMinutes);
            }
          } else {
            setRemaining(safeRemaining || safeMinutes * 60);
          }
          if (saved.stuckBreakEndMs) {
            const left = Math.max(0, Math.ceil((Number(saved.stuckBreakEndMs) - Date.now()) / 1000));
            setStuckBreakSec(left);
          }
        } catch {
          /* ignore malformed persisted timer state */
        }
      });
    return () => {
      active = false;
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    prefsRef.current = user?.preferences;
  }, [user?.preferences]);

  useEffect(() => {
    ambientAudio.setMutedAll(muteAll);
    tts.setMuted(muteAll);
  }, [muteAll]);

  useEffect(() => {
    tts.setAnnouncementsEnabled(user?.preferences?.ttsEnabled !== false);
  }, [user?.preferences?.ttsEnabled]);

  useEffect(() => {
    ambientAudio.setVolume(vol);
  }, [vol]);

  useEffect(() => {
    ambientAudio.setKind(ambient);
  }, [ambient]);

  useEffect(() => {
    if (stuckBreakSec <= 0) return;
    const t = window.setInterval(() => {
      setStuckBreakSec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [stuckBreakSec]);

  useEffect(() => {
    if (stuckBreakSec === 0 && running && paused) {
      setPaused(false);
    }
  }, [stuckBreakSec, running, paused]);

  useEffect(() => {
    if (!running) setStuckBreakSec(0);
  }, [running]);

  useEffect(() => {
    const payload: PersistedFocusState = {
      minutes,
      remaining,
      running,
      paused,
      endAtMs: running && !paused ? Date.now() + remaining * 1000 : null,
      stuckBreakEndMs: stuckBreakSec > 0 ? Date.now() + stuckBreakSec * 1000 : null,
    };
    try {
      if (!running && remaining === minutes * 60) {
        localStorage.removeItem(FOCUS_SESSION_KEY);
      } else {
        localStorage.setItem(FOCUS_SESSION_KEY, JSON.stringify(payload));
      }
    } catch {
      /* ignore localStorage failures */
    }
  }, [minutes, remaining, running, paused, stuckBreakSec]);

  useEffect(() => {
    if (!running) return;
    if (paused) {
      void syncFocusServer({
        plannedMinutes: minutes,
        remainingSeconds: remaining,
        isPaused: true,
        endsAt: null,
        stuckBreakEndAt: stuckBreakSec > 0 ? new Date(Date.now() + stuckBreakSec * 1000).toISOString() : null,
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    void syncFocusServer({
      plannedMinutes: minutes,
      remainingSeconds: remaining,
      isPaused: false,
      endsAt: new Date(Date.now() + remaining * 1000).toISOString(),
      stuckBreakEndAt: stuckBreakSec > 0 ? new Date(Date.now() + stuckBreakSec * 1000).toISOString() : null,
      updatedAt: new Date().toISOString(),
    });
  }, [running, paused, minutes, syncFocusServer]);

  const sendHeartbeat = useCallback((focusing: boolean) => {
    void api('/api/presence/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ focusing }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!running || paused) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      sendHeartbeat(false);
      return;
    }

    endedRef.current = false;
    prevRem.current = remaining;
    lastTickMsRef.current = Date.now();
    void ambientAudio.resume();
    sendHeartbeat(true);

    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        const now = Date.now();
        const elapsedSec = Math.max(1, Math.floor((now - lastTickMsRef.current) / 1000));
        lastTickMsRef.current = now;
        const prev = prevRem.current;
        const next = Math.max(0, r - elapsedSec);
        const pref = prefsRef.current;

        if (pref?.focusVoiceCuesEnabled !== false) {
          const raw = pref?.ttsAlertMinutes;
          const mins = Array.isArray(raw) && raw.length ? raw : [10, 5, 1];
          const thresholds = [...new Set(mins.map((m) => Math.max(1, Math.round(Number(m))) * 60))];
          tts.maybeAnnounceRemaining(prev, next, lang, thresholds);
        }
        prevRem.current = next;

        if (next === 0 && !endedRef.current) {
          if (tickRef.current) window.clearInterval(tickRef.current);
          completeByTimer(minutes);
        }

        return next;
      });
    }, 1000);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [running, paused, minutes, lang, sendHeartbeat, muteAll]);

  function applyPreset(m: number) {
    setMinutes(m);
    setRemaining(m * 60);
    setRunning(false);
    setPaused(false);
    void syncFocusServer({ clear: true });
  }

  async function patchFocusPreference(body: Record<string, unknown>) {
    await api('/api/preferences', { method: 'PUT', body: JSON.stringify(body) });
    await refreshUser();
  }

  async function finishSession() {
    if (!pendingComplete) return;

    try {
      await api('/api/sessions/focus/complete', {
        method: 'POST',
        body: JSON.stringify({
          plannedMinutes: pendingComplete.planned,
          actualMinutes: pendingComplete.actual,
        }),
      });
      await refreshUser();
    } catch {}

    setMoodOpen(false);
    setPendingComplete(null);
    setRemaining(minutes * 60);
    void syncFocusServer({ clear: true });
    try {
      localStorage.removeItem(FOCUS_SESSION_KEY);
    } catch {
      /* ignore localStorage failures */
    }
  }

  async function saveIdeaNote(pinned = false) {
    const content = ideaNote.trim();
    if (!content) return;
    try {
      await api('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ content, context: 'focus', pinned }),
      });
      setIdeaNote('');
    } catch {
      /* ignore */
    }
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  const progress = 1 - remaining / (minutes * 60);
  const buddy = user?.preferences?.buddyId || 'luna';
  const primary = 'var(--nudge-primary)';
  const boltLook =
    buddy === 'bolt'
      ? {
          body: user?.preferences?.boltBodyColor || '#81b29a',
          hat: !!user?.preferences?.boltAccessoryHat,
          glasses: !!user?.preferences?.boltAccessoryGlasses,
        }
      : undefined;

  return (
    <div className="min-h-screen bg-[color:var(--nudge-bg)] px-6 py-10 flex justify-center">
      <div className="w-full max-w-5xl space-y-6">

        <MoodCheckIn
          open={moodOpen}
          title="How do you feel after that session?"
          onPick={() => void finishSession()}
          onSkip={() => void finishSession()}
        />

        <div className="rounded-3xl shadow-xl p-8 border border-white/30 bg-[color:var(--nudge-card)]">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            {/* LEFT SIDE (TIMER SECTION) */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-4 text-[color:var(--nudge-text)]">
                Focus timer
              </h1>

              <div className="flex gap-3 mb-4 lg:justify-end">
                <button
                  onClick={() => setZen((z) => !z)}
                  className={`px-4 py-2 rounded-full ${
                    zen ? 'bg-green-700 text-white' : 'bg-gray-100 text-[color:var(--nudge-text)]'
                  }`}
                  style={zen ? { backgroundColor: primary } : undefined}
                >
                  Zen mode
                </button>
                <button
                  onClick={() => setMuteAll((m) => !m)}
                  className={`px-4 py-2 rounded-full ${
                    muteAll ? 'bg-green-700 text-white' : 'bg-gray-100 text-[color:var(--nudge-text)]'
                  }`}
                  style={muteAll ? { backgroundColor: primary } : undefined}
                >
                  {muteAll ? 'Unmute all' : 'Mute all'}
                </button>
                <button
                  onClick={() =>
                    void patchFocusPreference({
                      focusVoiceCuesEnabled: !(user?.preferences?.focusVoiceCuesEnabled !== false),
                    })
                  }
                  className={`px-4 py-2 rounded-full ${
                    user?.preferences?.focusVoiceCuesEnabled !== false
                      ? 'bg-green-700 text-white'
                      : 'bg-gray-100 text-[color:var(--nudge-text)]'
                  }`}
                  style={user?.preferences?.focusVoiceCuesEnabled !== false ? { backgroundColor: primary } : undefined}
                >
                  Voice cues
                </button>
              </div>

              <p className="text-sm mb-5 text-[color:var(--nudge-text)]">
                <strong>Nudge says:</strong> Try a preset, pick ambient sound, then tap Start. Voice cues use gentle countdown marks; Zen mode keeps time visible and still offers the I'm stuck pause.
              </p>

              <div className="flex gap-3 mb-6 flex-wrap">
                {[
                  { label: 'Quick 5', val: 5 },
                  { label: 'Pomodoro 25', val: 25 },
                  { label: 'Deep 50', val: 50 },
                ].map((p) => (
                  <button
                    key={p.val}
                    onClick={() => applyPreset(p.val)}
                    className={`px-4 py-2 rounded-full ${
                      minutes === p.val ? 'bg-green-700 text-white' : 'bg-gray-100 text-[color:var(--nudge-text)]'
                    }`}
                    style={minutes === p.val ? { backgroundColor: primary } : undefined}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="text-sm text-gray-500 text-center">MINUTES</div>
              <input
                type="number"
                min={1}
                disabled={running}
                className="block mx-auto w-28 rounded-xl border border-gray-200 py-1 text-lg text-center mb-4 disabled:opacity-60"
                value={minutes}
                onChange={(e) => {
                  const v = Math.max(1, Number(e.target.value) || 1);
                  setMinutes(v);
                  if (!running) setRemaining(v * 60);
                }}
              />

              <div className="text-6xl font-bold text-center mb-4 text-[color:var(--nudge-text)]">
                {mm}:{ss}
              </div>

              <div className="h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{ width: `${progress * 100}%`, backgroundColor: primary }}
                />
              </div>

              {!running ? (
                <button
                  onClick={() => {
                    tts.unlock();
                    if (prefsRef.current?.focusVoiceCuesEnabled !== false) {
                      tts.announceStart(minutes, lang);
                    }
                    setRunning(true);
                    setPaused(false);
                    setStuckBreakSec(0);
                  }}
                  className="w-full py-3 rounded-full bg-green-800 text-white text-lg"
                  style={{ backgroundColor: primary }}
                >
                  Start
                </button>
              ) : (
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      setPaused((p) => !p);
                      setStuckBreakSec(0);
                    }}
                    className="px-5 py-2 rounded-full"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--nudge-primary) 25%, white)' }}
                  >
                    {paused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={() => {
                      setPaused(true);
                      setStuckBreakSec(120);
                    }}
                    className="px-5 py-2 bg-gray-100 rounded-full"
                  >
                    I'm stuck
                  </button>
                  <button
                    onClick={() => {
                      setRunning(false);
                      setPaused(false);
                      setStuckBreakSec(0);
                      const spent = minutes * 60 - remaining;
                      const actualMin = Math.max(1, Math.round(spent / 60));
                      setPendingComplete({ actual: actualMin, planned: minutes });
                      setMoodOpen(true);
                      void syncFocusServer({ clear: true });
                    }}
                    className="px-5 py-2 bg-gray-100 rounded-full"
                    type="button"
                  >
                    End early
                  </button>
                </div>
              )}
              {running && stuckBreakSec > 0 && (
                <p className="mt-3 text-center text-sm font-medium text-[color:var(--nudge-primary)]">
                  Brain reset break: {String(Math.floor(stuckBreakSec / 60)).padStart(2, '0')}:
                  {String(stuckBreakSec % 60).padStart(2, '0')}
                </p>
              )}
            </div>

            {/* RIGHT SIDE (FOCUS BUDDY) */}
            <div className="w-full lg:w-64 flex flex-col items-center">
              <h2 className="font-semibold mb-4 text-[color:var(--nudge-text)]">
                Focus buddy
              </h2>
              <FocusBuddy
                buddyId={buddy === 'bolt' || buddy === 'pip' || buddy === 'bruno' ? buddy : 'luna'}
                active={running}
                paused={paused}
                boltLook={boltLook}
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl shadow-xl p-6 border border-white/30 bg-[color:var(--nudge-card)]">
          <h3 className="text-lg font-semibold text-[color:var(--nudge-text)]">Sensory lane</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['off', 'rain', 'white', 'brown'] as AmbientKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setAmbient(k)}
                className={`px-4 py-2 rounded-full capitalize ${
                  ambient === k ? 'text-white' : 'bg-gray-100 text-[color:var(--nudge-text)]'
                }`}
                style={ambient === k ? { backgroundColor: primary } : undefined}
              >
                {k}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-sm text-[color:var(--nudge-text)]">
            Ambient volume
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={vol}
              onChange={(e) => setVol(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <p className="mt-2 text-xs text-gray-500">
            Voice alerts duck ambient audio automatically. Languages follow Settings - Language.
          </p>
        </div>

        <div className="rounded-3xl shadow-xl p-6 border border-white/30 bg-[color:var(--nudge-card)]">
          <h3 className="text-lg font-semibold text-[color:var(--nudge-text)]">Capture idea</h3>
          <p className="mt-1 text-sm opacity-75">Write down thoughts without breaking your flow.</p>
          <div className="mt-3 flex gap-2">
            <input
              value={ideaNote}
              onChange={(e) => setIdeaNote(e.target.value)}
              className="flex-1 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 font-semibold"
              placeholder="Quick idea..."
            />
            <button
              type="button"
              onClick={() => void saveIdeaNote(false)}
              className="rounded-[2rem] px-4 py-2 font-extrabold bg-[color:var(--nudge-primary)] text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => void saveIdeaNote(true)}
              className="rounded-[2rem] px-4 py-2 font-extrabold bg-white/80"
            >
              Pin
            </button>
          </div>
        </div>
      </div>
      {zen && (
        <div className="fixed inset-0 z-50 text-white flex flex-col items-center justify-center px-6" style={{ backgroundColor: primary }}>
          <p className="text-xs tracking-[0.3em] uppercase opacity-80">Zen mode</p>
          <p className="mt-3 text-6xl font-bold tabular-nums">{mm}:{ss}</p>
          <button
            type="button"
            onClick={() => setZen(false)}
            className="mt-8 px-5 py-2 rounded-full bg-white/20"
          >
            Exit zen
          </button>
        </div>
      )}
    </div>
  );
}