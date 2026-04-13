import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { MoodCheckIn } from '../components/MoodCheckIn';
import {
  ambientAudio,
  playSessionCompleteSound
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

  const [moodOpen, setMoodOpen] = useState(false);
  const [pendingComplete, setPendingComplete] = useState<{ actual: number; planned: number } | null>(null);

  const prevRem = useRef(remaining);
  const tickRef = useRef<number | null>(null);
  const endedRef = useRef(false);

  const lang = user?.preferences?.language || 'en';

  useEffect(() => {
    tts.unlock();
  }, []);

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
    sendHeartbeat(true);

    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        const next = Math.max(0, r - 1);

        if (next === 0 && !endedRef.current) {
          endedRef.current = true;

          if (tickRef.current) window.clearInterval(tickRef.current);

          setRunning(false);
          setPaused(false);
          sendHeartbeat(false);

          playSessionCompleteSound('lofi', false);

          setTimeout(() => {
            tts.announceComplete(lang);
          }, 300);

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
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  const progress = 1 - remaining / (minutes * 60);

  return (
    <div className="min-h-screen bg-[#f6f1ea] flex flex-col items-center px-4 py-6">

      <MoodCheckIn
        open={moodOpen}
        title="How do you feel after that session?"
        onPick={() => void finishSession()}
        onSkip={() => void finishSession()}
      />

      {/* TIMER CARD */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6">

        <h1 className="text-2xl font-bold text-green-800 mb-4">
          Focus timer
        </h1>

        {/* PRESETS */}
        <div className="flex justify-between mb-5">
          {[
            { label: 'Quick 5', val: 5 },
            { label: 'Pomodoro 25', val: 25 },
            { label: 'Deep 50', val: 50 },
          ].map((p) => (
            <button
              key={p.val}
              onClick={() => applyPreset(p.val)}
              className="px-4 py-2 rounded-full bg-gray-100 text-green-800"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* MINUTES */}
        <div className="text-center text-sm text-gray-500 mb-1">MINUTES</div>
        <div className="text-center text-lg mb-4">{minutes}</div>

        {/* TIMER */}
        <div className="text-center text-6xl font-bold text-green-800 mb-4">
          {mm}:{ss}
        </div>

        {/* PROGRESS */}
        <div className="h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-green-700 transition-all"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* BUTTONS */}
        {!running ? (
          <button
            onClick={() => {
              tts.unlock();
              setRunning(true);
              setPaused(false);
            }}
            className="w-full py-3 rounded-full bg-green-800 text-white text-lg"
          >
            Start
          </button>
        ) : (
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setPaused((p) => !p)}
              className="px-4 py-2 bg-green-300 rounded-full"
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={() => setRunning(false)}
              className="px-4 py-2 bg-gray-200 rounded-full"
            >
              End early
            </button>
          </div>
        )}
      </div>

      {/* FOCUS BUDDY CARD */}
      <div className="w-full max-w-md mt-6 bg-white rounded-3xl shadow-xl p-6 text-center">
        <h2 className="text-lg font-semibold text-green-800 mb-4">
          Focus buddy
        </h2>

        <BuddyAvatar />
      </div>

    </div>
  );
}

/* =========================
   BUDDY COMPONENT (SVG BASED)
   ========================= */

function BuddyAvatar() {
  const buddy = "luna"; // change to "bolt" or "sprout"

  return (
    <img
      src={`/buddies/${buddy}.svg`}
      alt="Focus buddy"
      className="w-40 h-40 mx-auto drop-shadow-md"
    />
  );
}