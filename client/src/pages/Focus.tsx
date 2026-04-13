import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { MoodCheckIn, type MoodValue } from '../components/MoodCheckIn';
import {
  ambientAudio,
  playSessionCompleteSound,
  type AmbientKind,
  type SessionCompleteSound,
} from '../services/audioService';
import { tts } from '../services/ttsService';

type Loc = { minutes?: number };

export default function Focus() {
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const loc = (location.state || {}) as Loc;

  const [minutes, setMinutes] = useState(loc.minutes ?? 25);
  const [remaining, setRemaining] = useState(() => (loc.minutes ?? 25) * 60);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ambient, setAmbient] = useState<AmbientKind>('off');
  const [vol, setVol] = useState(0.35);
  const [muteAll, setMuteAll] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [pendingComplete, setPendingComplete] = useState<{ actual: number; planned: number } | null>(null);

  const prevRem = useRef(remaining);
  const prefsRef = useRef(user?.preferences);
  const tickRef = useRef<number | null>(null);
  const endedRef = useRef(false);
  const muteRef = useRef(muteAll);

  useEffect(() => {
    prefsRef.current = user?.preferences;
  }, [user?.preferences]);

  useEffect(() => {
    muteRef.current = muteAll;
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

  const lang = user?.preferences?.language || 'en';

  const sendHeartbeat = useCallback((focusing: boolean) => {
    void api('/api/presence/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ focusing }),
    }).catch(() => {});
  }, []);

  // ✅ TIMER
  useEffect(() => {
    if (!running || paused) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      sendHeartbeat(false);
      return;
    }

    endedRef.current = false;
    prevRem.current = remaining;

    ambientAudio.resume();
    sendHeartbeat(true);

    const prStart = prefsRef.current;

    // ✅ START + FORCE FIRST ANNOUNCEMENT
    if (prStart?.focusVoiceCuesEnabled !== false) {
      tts.announceStart?.(minutes, lang);

      // Force full duration announcement (fixes 5min/10min issue)
      tts.maybeAnnounceRemaining(
        minutes * 60 + 1,
        minutes * 60,
        lang,
        [minutes * 60]
      );
    }

    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        const prev = prevRem.current;
        const next = Math.max(0, r - 1);
        const pr = prefsRef.current;

        // ✅ PRESETS
        const raw = pr?.ttsAlertMinutes;

        const mins = Array.isArray(raw) && raw.length
          ? raw
          : [10, 5, 1];

        const thresholdsSec = [...new Set(
          mins.map((m) => Math.max(1, Math.round(Number(m))) * 60)
        )]
          .filter((t) => t <= minutes * 60)
          .sort((a, b) => b - a);

        // ✅ VOICE SETTINGS
        tts.setProsody({
          rate: typeof pr?.ttsRate === 'number' ? pr.ttsRate : 1,
          pitch: typeof pr?.ttsPitch === 'number' ? pr.ttsPitch : 1,
        });

        // ✅ ANNOUNCE DURING TIMER
        if (pr?.focusVoiceCuesEnabled !== false) {
          tts.maybeAnnounceRemaining(prev, next, lang, thresholdsSec);
        }

        prevRem.current = next;

        // ✅ END SESSION
        if (next === 0 && !endedRef.current) {
          endedRef.current = true;

          window.clearInterval(tickRef.current!);
          tickRef.current = null;

          setRunning(false);
          setPaused(false);
          sendHeartbeat(false);

          const prDone = prefsRef.current;
          const s = prDone?.sessionCompleteSound;

          const snd: SessionCompleteSound =
            s === 'digital' || s === 'nature' || s === 'lofi'
              ? s
              : 'lofi';

          playSessionCompleteSound(snd, muteRef.current);

          if (prDone?.focusVoiceCuesEnabled !== false) {
            tts.announceComplete(lang);
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
  }, [running, paused, minutes, lang, sendHeartbeat]);

  function applyPreset(m: number) {
    setMinutes(m);
    setRemaining(m * 60);
    setRunning(false);
    setPaused(false);
    endedRef.current = false;
    prevRem.current = m * 60;
  }

  async function finishSession(mood?: MoodValue) {
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
  }

  return (
    <div className="space-y-6">
      <MoodCheckIn
        open={moodOpen}
        title="How do you feel after that session?"
        onPick={(m) => void finishSession(m)}
        onSkip={() => void finishSession()}
      />

      <div className="p-6 rounded-2xl bg-white shadow">
        <h1 className="text-2xl font-bold">Focus Timer</h1>

        <div className="mt-4 text-5xl font-mono">
          {String(Math.floor(remaining / 60)).padStart(2, '0')}:
          {String(remaining % 60).padStart(2, '0')}
        </div>

        <div className="mt-4 flex gap-2">
          {[5, 25, 50].map((m) => (
            <button key={m} onClick={() => applyPreset(m)}>
              {m} min
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          {!running ? (
            <button
              onClick={() => {
                tts.unlock(); // 🔥 REQUIRED FOR MOBILE
                setRunning(true);
                setPaused(false);
              }}
            >
              Start
            </button>
          ) : (
            <>
              <button onClick={() => setPaused((p) => !p)}>
                {paused ? 'Resume' : 'Pause'}
              </button>
              <button onClick={() => setRunning(false)}>Stop</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}