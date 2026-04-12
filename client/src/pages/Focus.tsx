import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { FocusBuddy } from '../components/FocusBuddy';
import { MoodCheckIn, type MoodValue } from '../components/MoodCheckIn';
import {
  ambientAudio,
  playSessionCompleteSound,
  type AmbientKind,
  type SessionCompleteSound,
} from '../services/audioService';
import { tts } from '../services/ttsService';

type Loc = { taskId?: string; taskTitle?: string; minutes?: number };

const MICRO_TASKS = [
  'Write just one sentence about what you are doing next.',
  'Stand up, stretch for 20 seconds, then sit back down.',
  'Clear one small thing from your desk (a cup, a tab, a wrapper).',
  'Name your next tiny step out loud, then do only that.',
  'Drink a glass of water — hydration resets momentum.',
  'Set a 2-minute timer and do one micro-step you cannot fail.',
  'Open your notes and paste the last thing you copied.',
  'Reply to one short message you have been avoiding.',
  'Put your phone face-down across the room for two minutes.',
  'Tidy a one-foot square area within reach.',
];

function anchorVoiceThresholdsSec(totalSec: number) {
  const out = new Set<number>();
  if (totalSec >= 60) out.add(60);
  for (let m = 10; m * 60 < totalSec; m += 10) out.add(m * 60);
  return [...out].sort((a, b) => b - a);
}

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
  const [moodOpen, setMoodOpen] = useState(false);
  const [pendingComplete, setPendingComplete] = useState<{ actual: number; planned: number } | null>(
    null,
  );
  const [stuckOpen, setStuckOpen] = useState(false);
  const [stuckHint, setStuckHint] = useState('');

  const prevRem = useRef(remaining);
  const prefsRef = useRef(user?.preferences);
  const tickRef = useRef<number | null>(null);
  const hbRef = useRef<number | null>(null);
  const endedRef = useRef(false);
  const muteRef = useRef(muteAll);

  useEffect(() => {
    prefsRef.current = user?.preferences;
  }, [user?.preferences]);

  useEffect(() => {
    muteRef.current = muteAll;
  }, [muteAll]);

  const taskId = loc.taskId;
  const taskTitle = loc.taskTitle;

  const buddy = user?.preferences?.buddyId || 'luna';
  const lang = user?.preferences?.language || 'en';
  const totalSec = minutes * 60;
  const progress = 1 - remaining / Math.max(totalSec, 1);

  const pulseScale = 1 + Math.sin(progress * Math.PI) * 0.06;
  const windDown = running && !paused && remaining <= 120 && remaining > 0;

  const boltLook =
    buddy === 'bolt'
      ? {
          body: user?.preferences?.boltBodyColor || '#81b29a',
          hat: !!user?.preferences?.boltAccessoryHat,
          glasses: !!user?.preferences?.boltAccessoryGlasses,
        }
      : undefined;

  const sendHeartbeat = useCallback(
    (focusing: boolean) => {
      void api('/api/presence/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ focusing }),
      }).catch(() => {});
    },
    [],
  );

  useEffect(() => {
    ambientAudio.setMutedAll(muteAll);
    tts.setMuted(muteAll);
  }, [muteAll]);

  useEffect(() => {
    ambientAudio.setVolume(vol);
  }, [vol]);

  useEffect(() => {
    ambientAudio.setKind(ambient);
  }, [ambient]);

  useEffect(() => {
    tts.setAnnouncementsEnabled(user?.preferences?.ttsEnabled !== false);
  }, [user?.preferences?.ttsEnabled]);

  useEffect(() => {
    const pr = user?.preferences;
    tts.setProsody({
      rate: typeof pr?.ttsRate === 'number' ? pr.ttsRate : 1,
      pitch: typeof pr?.ttsPitch === 'number' ? pr.ttsPitch : 1,
    });
  }, [user?.preferences?.ttsRate, user?.preferences?.ttsPitch]);

  useEffect(() => {
    const d = user?.preferences?.ambientDefault as AmbientKind | undefined;
    if (d === 'rain' || d === 'white' || d === 'brown' || d === 'off') {
      setAmbient(d);
    }
  }, [user?.preferences?.ambientDefault]);

  useEffect(() => {
    if (loc.minutes != null) return;
    const m = user?.preferences?.defaultFocusMinutes;
    if (m && m >= 1) {
      setMinutes(m);
      setRemaining(m * 60);
      prevRem.current = m * 60;
    }
  }, [user?.preferences?.defaultFocusMinutes, loc.minutes]);

  useEffect(() => {
    if (!running || paused) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      sendHeartbeat(false);
      return;
    }
    endedRef.current = false;
    prevRem.current = remaining;
    void ambientAudio.resume();
    sendHeartbeat(true);
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        const prev = prevRem.current;
        const next = Math.max(0, r - 1);
        const pr = prefsRef.current;
        const anchorOn = pr?.focusVoiceCuesEnabled !== false;
        const raw = pr?.ttsAlertMinutes;
        const mins = Array.isArray(raw) && raw.length ? raw : [10, 5, 1];
        const thresholdsSec = anchorOn
          ? anchorVoiceThresholdsSec(minutes * 60)
          : [...new Set(mins.map((m) => Math.min(180, Math.max(1, Math.round(Number(m)))) * 60))].sort(
              (a, b) => b - a,
            );
        tts.setProsody({
          rate: typeof pr?.ttsRate === 'number' ? pr.ttsRate : 1,
          pitch: typeof pr?.ttsPitch === 'number' ? pr.ttsPitch : 1,
        });
        tts.maybeAnnounceRemaining(prev, next, lang, thresholdsSec);
        prevRem.current = next;
        if (next === 0 && !endedRef.current) {
          endedRef.current = true;
          window.clearInterval(tickRef.current!);
          tickRef.current = null;
          setRunning(false);
          setPaused(false);
          sendHeartbeat(false);
          const prDone = prefsRef.current;
          const s = prDone?.sessionCompleteSound;
          const snd: SessionCompleteSound = s === 'digital' || s === 'nature' || s === 'lofi' ? s : 'lofi';
          playSessionCompleteSound(snd, muteRef.current);
          tts.announceComplete(lang);
          if (user?.preferences?.vibrationEnabled && 'vibrate' in navigator) {
            navigator.vibrate?.([30, 40, 30]);
          }
          setPendingComplete({ actual: minutes, planned: minutes });
          setMoodOpen(true);
        }
        return next;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [running, paused, lang, minutes, sendHeartbeat, user?.preferences?.vibrationEnabled]);

  useEffect(() => {
    if (!running || paused) {
      if (hbRef.current) window.clearInterval(hbRef.current);
      return;
    }
    hbRef.current = window.setInterval(() => sendHeartbeat(true), 20000);
    return () => {
      if (hbRef.current) window.clearInterval(hbRef.current);
    };
  }, [running, paused, sendHeartbeat]);

  async function finishSession(mood?: MoodValue, skipped?: boolean) {
    if (!pendingComplete) return;
    const localHour = new Date().getHours();
    try {
      await api('/api/sessions/focus/complete', {
        method: 'POST',
        body: JSON.stringify({
          plannedMinutes: pendingComplete.planned,
          actualMinutes: pendingComplete.actual,
          taskId: taskId || null,
          taskName: taskTitle || null,
          localHour,
          mood,
          moodSkipped: !!skipped || !mood,
        }),
      });
      await refreshUser();
    } catch {
      /* offline */
    }
    setMoodOpen(false);
    setPendingComplete(null);
    setRemaining(minutes * 60);
  }

  function applyPreset(m: number) {
    setMinutes(m);
    setRemaining(m * 60);
    setRunning(false);
    setPaused(false);
    endedRef.current = false;
    prevRem.current = m * 60;
  }

  async function patchFocusPreference(body: Record<string, unknown>) {
    await api('/api/preferences', { method: 'PUT', body: JSON.stringify(body) });
    await refreshUser();
  }

  function handleImStuck() {
    setPaused(true);
    setStuckHint(MICRO_TASKS[Math.floor(Math.random() * MICRO_TASKS.length)] ?? MICRO_TASKS[0]!);
    setStuckOpen(true);
  }

  const zenLayer = zen && (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 -z-10"
        animate={{
          background: [
            'radial-gradient(circle at 30% 30%, rgba(224,122,95,0.55), rgba(129,178,154,0.35) 55%, #0f172a)',
            `radial-gradient(circle at 70% 40%, rgba(242,204,143,0.5), rgba(224,122,95,0.45) 50%, #0f172a)`,
          ],
          scale: [1, pulseScale, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <p className="text-sm uppercase tracking-[0.3em] opacity-80">Zen</p>
      <p className="mt-2 text-2xl font-semibold">{taskTitle || 'Focus'}</p>
      <p className="mt-8 text-6xl font-black tabular-nums sm:text-7xl">
        {String(Math.floor(remaining / 60)).padStart(2, '0')}:
        {String(remaining % 60).padStart(2, '0')}
      </p>
      {running && (
        <button
          type="button"
          className="mt-8 rounded-[2rem] border border-white/30 bg-white/10 px-5 py-2 text-sm font-extrabold backdrop-blur"
          onClick={handleImStuck}
        >
          I&apos;m stuck
        </button>
      )}
      <button
        type="button"
        className="mt-10 rounded-[2rem] bg-white/15 px-6 py-3 text-sm font-bold backdrop-blur"
        onClick={() => setZen(false)}
      >
        Exit Zen
      </button>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      <MoodCheckIn
        open={moodOpen}
        title="How do you feel after that session?"
        onPick={(m) => void finishSession(m)}
        onSkip={() => void finishSession(undefined, true)}
      />
      <AnimatePresence>{zenLayer}</AnimatePresence>

      <AnimatePresence>
        {stuckOpen && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal
              aria-labelledby="stuck-title"
              className="w-full max-w-md rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-6 shadow-xl backdrop-blur-md"
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
            >
              <p className="text-xs font-bold uppercase tracking-wide opacity-60">Circuit breaker</p>
              <h2 id="stuck-title" className="mt-2 text-xl font-extrabold text-[color:var(--nudge-text)]">
                Gentle micro-task
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--nudge-text)]/90">{stuckHint}</p>
              <p className="mt-2 text-xs opacity-60">Timer is paused. Resume when you feel ready.</p>
              <button
                type="button"
                className="mt-6 w-full rounded-[2rem] bg-[color:var(--nudge-primary)] px-5 py-3 text-sm font-extrabold text-white shadow-lg"
                onClick={() => setStuckOpen(false)}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-6 shadow-xl backdrop-blur-md"
        animate={
          windDown
            ? {
                boxShadow: [
                  '0 25px 50px -12px rgba(224, 122, 95, 0.18)',
                  '0 28px 56px -10px rgba(129, 178, 154, 0.28)',
                  '0 25px 50px -12px rgba(224, 122, 95, 0.18)',
                ],
                scale: [1, 1.008, 1],
              }
            : { boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)', scale: 1 }
        }
        transition={{ duration: 2.5, repeat: windDown ? Infinity : 0, ease: 'easeInOut' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[color:var(--nudge-text)]">Focus timer</h1>
            {taskTitle && (
              <p className="mt-1 text-sm font-semibold text-[color:var(--nudge-primary)]">{taskTitle}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-2xl bg-black/5 px-3 py-2 text-sm font-bold"
              onClick={() => setZen((z) => !z)}
            >
              Zen mode
            </button>
            <button
              type="button"
              className="rounded-2xl bg-black/5 px-3 py-2 text-sm font-bold"
              onClick={() => setMuteAll((m) => !m)}
            >
              {muteAll ? 'Unmute' : 'Mute all'}
            </button>
            <button
              type="button"
              className={`rounded-2xl px-3 py-2 text-sm font-bold ${
                user?.preferences?.focusVoiceCuesEnabled !== false
                  ? 'bg-[color:var(--nudge-primary)] text-white shadow'
                  : 'bg-black/5'
              }`}
              onClick={() =>
                void patchFocusPreference({
                  focusVoiceCuesEnabled: !(user?.preferences?.focusVoiceCuesEnabled !== false),
                })
              }
            >
              Voice cues
            </button>
          </div>
        </div>

        {user?.preferences?.showFocusTips !== false && (
          <div className="mt-4 rounded-2xl border border-white/30 bg-white/50 p-4 text-left text-sm leading-relaxed text-[color:var(--nudge-text)]/90">
            <span className="font-extrabold text-[color:var(--nudge-primary)]">Nudge says: </span>
            Try a preset, pick ambient sound, then tap Start. Voice cues use gentle countdown marks; Zen mode keeps
            time visible and still offers the I&apos;m stuck pause.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: 'Quick 5', m: 5 },
            { label: 'Pomodoro 25', m: 25 },
            { label: 'Deep 50', m: 50 },
          ].map((p) => (
            <button
              key={p.m}
              type="button"
              disabled={running}
              onClick={() => applyPreset(p.m)}
              className="rounded-[2rem] bg-white/70 px-4 py-2 text-sm font-bold shadow-sm disabled:opacity-40"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center gap-6 lg:flex-row lg:items-start">
          <div className="flex-1 text-center">
            <label className="text-xs font-bold uppercase opacity-60">Minutes</label>
            <input
              type="number"
              min={1}
              disabled={running}
              className="mx-auto mt-1 block w-32 rounded-2xl border border-black/10 bg-white/80 py-2 text-center text-xl font-extrabold"
              value={minutes}
              onChange={(e) => {
                const v = Math.max(1, Number(e.target.value) || 1);
                setMinutes(v);
                if (!running) {
                  setRemaining(v * 60);
                  prevRem.current = v * 60;
                }
              }}
            />
            <div className="mt-6 text-6xl font-black tabular-nums text-[color:var(--nudge-text)] sm:text-7xl">
              {String(Math.floor(remaining / 60)).padStart(2, '0')}:
              {String(remaining % 60).padStart(2, '0')}
            </div>
            <div className="mx-auto mt-4 h-3 max-w-md overflow-hidden rounded-full bg-black/10">
              <motion.div
                className="h-full rounded-full bg-[color:var(--nudge-primary)]"
                animate={{ width: `${progress * 100}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {!running && (
                <button
                  type="button"
                  className="rounded-[2rem] bg-[color:var(--nudge-primary)] px-8 py-3 text-lg font-extrabold text-white shadow-lg"
                  onClick={() => {
                    endedRef.current = false;
                    prevRem.current = remaining;
                    setRunning(true);
                    setPaused(false);
                  }}
                >
                  Start
                </button>
              )}
              {running && (
                <>
                  <button
                    type="button"
                    className="rounded-[2rem] bg-[color:var(--nudge-accent)] px-6 py-3 text-lg font-extrabold text-[color:var(--nudge-text)] shadow"
                    onClick={() => setPaused((p) => !p)}
                  >
                    {paused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    type="button"
                    className="rounded-[2rem] border border-black/10 bg-white/90 px-5 py-3 text-sm font-extrabold text-[color:var(--nudge-text)] shadow"
                    onClick={handleImStuck}
                  >
                    I&apos;m stuck
                  </button>
                  <button
                    type="button"
                    className="rounded-[2rem] bg-white/70 px-6 py-3 text-lg font-extrabold shadow"
                    onClick={() => {
                      setRunning(false);
                      setPaused(false);
                      sendHeartbeat(false);
                      const spent = totalSec - remaining;
                      const actualMin = Math.max(1, Math.round(spent / 60));
                      setPendingComplete({ actual: actualMin, planned: minutes });
                      setMoodOpen(true);
                    }}
                  >
                    End early
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="w-full max-w-xs flex-1 text-center">
            <p className="text-sm font-bold text-[color:var(--nudge-text)]">Focus buddy</p>
            <FocusBuddy
              buddyId={buddy}
              active={running}
              paused={paused}
              className="mt-2"
              boltLook={boltLook}
            />
          </div>
        </div>
        {windDown && (
          <p className="mt-4 text-center text-xs font-bold uppercase tracking-wide text-[color:var(--nudge-primary)]">
            Wind down — about two minutes left
          </p>
        )}
      </motion.div>

      <div className="rounded-[2rem] border border-white/40 bg-white/50 p-5 shadow-md backdrop-blur-sm">
        <h3 className="text-lg font-extrabold text-[color:var(--nudge-text)]">Sensory lane</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['off', 'rain', 'white', 'brown'] as AmbientKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setAmbient(k)}
              className={`rounded-2xl px-4 py-2 text-sm font-bold capitalize ${
                ambient === k ? 'bg-[color:var(--nudge-primary)] text-white' : 'bg-white/80'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <label className="mt-4 block text-left text-sm font-semibold">
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
        <p className="mt-2 text-xs opacity-70">
          Voice alerts duck ambient audio automatically. Languages follow Settings → Language.
        </p>
      </div>
    </div>
  );
}
