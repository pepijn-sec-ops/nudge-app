import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { MoodCheckIn } from '../components/MoodCheckIn';
import {
  ambientAudio,
  playSessionCompleteSound
} from '../services/audioService';
import type {
  AmbientKind,
  SessionCompleteSound
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

  // keep these but don't cause TS errors
  const [ambient] = useState<AmbientKind>('off');
  const [vol] = useState(0.35);
  const [muteAll] = useState(false);

  const [moodOpen, setMoodOpen] = useState(false);
  const [pendingComplete, setPendingComplete] = useState<{ actual: number; planned: number } | null>(null);

  const prevRem = useRef(remaining);
  const prefsRef = useRef(user?.preferences);
  const tickRef = useRef<number | null>(null);
  const endedRef = useRef(false);
  const muteRef = useRef(muteAll);

  // 🔥 unlock TTS
  useEffect(() => {
	tts.unlock();
  }, []);

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

  // ⏱ TIMER
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

	if (prStart?.focusVoiceCuesEnabled !== false) {
	  setTimeout(() => {
		tts.announceStart(minutes, lang);
	  }, 400);
	}

	tickRef.current = window.setInterval(() => {
	  setRemaining((r) => {
		const prev = prevRem.current;
		const next = Math.max(0, r - 1);
		const pr = prefsRef.current;

		if (pr?.focusVoiceCuesEnabled !== false) {
		  tts.maybeAnnounceRemaining(prev, next, lang, [600, 300, 120, 60]);
		}

		prevRem.current = next;

		if (next === 0 && !endedRef.current) {
		  endedRef.current = true;

		  if (tickRef.current) window.clearInterval(tickRef.current);

		  setRunning(false);
		  setPaused(false);
		  sendHeartbeat(false);

		  const snd: SessionCompleteSound = 'lofi';
		  playSessionCompleteSound(snd, muteRef.current);

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
	endedRef.current = false;
	prevRem.current = m * 60;
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

  return (
	<div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-blue-50 to-white">

	  <MoodCheckIn
		open={moodOpen}
		title="How do you feel after that session?"
		onPick={() => void finishSession()}
		onSkip={() => void finishSession()}
	  />

	  {/* CARD */}
	  <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 text-center">

		<h1 className="text-xl font-semibold text-gray-700">Focus</h1>

		{/* TIMER */}
		<div className="mt-6 text-6xl font-mono font-bold text-gray-900">
		  {mm}:{ss}
		</div>

		{/* PRESETS */}
		<div className="mt-6 flex justify-center gap-3">
		  {[5, 25, 50].map((m) => (
			<button
			  key={m}
			  onClick={() => applyPreset(m)}
			  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium"
			>
			  {m}m
			</button>
		  ))}
		</div>

		{/* CONTROLS */}
		<div className="mt-6 flex justify-center gap-3">
		  {!running ? (
			<button
			  onClick={() => {
				tts.unlock();
				setRunning(true);
				setPaused(false);
			  }}
			  className="px-6 py-3 rounded-2xl bg-blue-500 text-white font-semibold shadow-md hover:bg-blue-600"
			>
			  Start
			</button>
		  ) : (
			<>
			  <button
				onClick={() => setPaused((p) => !p)}
				className="px-4 py-2 rounded-xl bg-yellow-400 text-white font-medium"
			  >
				{paused ? 'Resume' : 'Pause'}
			  </button>

			  <button
				onClick={() => setRunning(false)}
				className="px-4 py-2 rounded-xl bg-red-500 text-white font-medium"
			  >
				Stop
			  </button>
			</>
		  )}
		</div>

	  </div>
	</div>
  );
}
