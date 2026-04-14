import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { api, apiWithOfflineQueue, type User, type WorkSessionState } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { MoodCheckIn, type MoodValue } from '../components/MoodCheckIn';

function displayFromServer(s: WorkSessionState) {
  if (s.isPaused) return s.accumulatedActiveMs;
  const seg = Date.now() - new Date(s.startedAt).getTime();
  return s.accumulatedActiveMs + Math.max(0, seg);
}

export default function Work() {
  const { user, refreshUser, setUserLocal } = useAuth();
  const [project, setProject] = useState('Deep work block');
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [accMs, setAccMs] = useState(0);
  const [segmentStart, setSegmentStart] = useState<number | null>(null);
  const [displayMs, setDisplayMs] = useState(0);
  const [ideaNote, setIdeaNote] = useState('');
  const [sessionRef, setSessionRef] = useState<string | null>(null);
  const [moodOpen, setMoodOpen] = useState(false);
  const finishRef = useRef<(m?: MoodValue, skipped?: boolean) => void>(() => {});

  const setCurrentWorkSessionLocal = useCallback(
    (currentWorkSession: WorkSessionState | null) => {
      if (!user) return;
      setUserLocal({
        ...user,
        currentWorkSession,
      });
    },
    [user, setUserLocal],
  );

  const syncServer = useCallback(async (payload: WorkSessionState | { clear: true }) => {
    try {
      await apiWithOfflineQueue('/api/sessions/work/active', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    const s = user?.currentWorkSession;
    if (!s) return;
    setProject(s.projectName);
    setRunning(true);
    setPaused(s.isPaused);
    setAccMs(s.accumulatedActiveMs);
    setSegmentStart(s.isPaused ? null : new Date(s.startedAt).getTime());
    setDisplayMs(displayFromServer(s));
    setSessionRef(s.sessionRef || null);
  }, [user?.currentWorkSession]);

  useEffect(() => {
    let active = true;
    void api<{ currentWorkSession: WorkSessionState | null }>('/api/sessions/work/active')
      .then((data) => {
        if (!active) return;
        const s = data.currentWorkSession;
        if (!s) return;
        setProject(s.projectName);
        setRunning(true);
        setPaused(s.isPaused);
        setAccMs(s.accumulatedActiveMs);
        setSegmentStart(s.isPaused ? null : new Date(s.startedAt).getTime());
        setDisplayMs(displayFromServer(s));
        setSessionRef(s.sessionRef || null);
        setCurrentWorkSessionLocal(s);
      })
      .catch(() => {
        /* offline */
      });
    return () => {
      active = false;
    };
  }, [setCurrentWorkSessionLocal]);

  useEffect(() => {
    if (!running || paused || segmentStart == null) {
      setDisplayMs(accMs);
      return;
    }
    const tick = () => setDisplayMs(accMs + (Date.now() - segmentStart));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [running, paused, segmentStart, accMs]);

  async function handleStart() {
    const now = Date.now();
    const ref = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_work`;
    const payload: WorkSessionState = {
      projectName: project,
      startedAt: new Date(now).toISOString(),
      accumulatedActiveMs: 0,
      isPaused: false,
      pauseStartedAt: null,
      sessionRef: ref,
    };
    setAccMs(0);
    setSegmentStart(now);
    setPaused(false);
    setRunning(true);
    setDisplayMs(0);
    setSessionRef(ref);
    setCurrentWorkSessionLocal(payload);
    await syncServer(payload);
  }

  async function togglePause() {
    const now = Date.now();
    if (!paused && segmentStart != null) {
      const nextAcc = accMs + (now - segmentStart);
      setAccMs(nextAcc);
      setSegmentStart(null);
      setPaused(true);
      setDisplayMs(nextAcc);
      setCurrentWorkSessionLocal({
        projectName: project,
        startedAt: new Date(now).toISOString(),
        accumulatedActiveMs: nextAcc,
        isPaused: true,
        pauseStartedAt: new Date(now).toISOString(),
        sessionRef: sessionRef || undefined,
      });
      await syncServer({
        projectName: project,
        startedAt: new Date(now).toISOString(),
        accumulatedActiveMs: nextAcc,
        isPaused: true,
        pauseStartedAt: new Date(now).toISOString(),
        sessionRef: sessionRef || undefined,
      });
    } else if (paused) {
      setPaused(false);
      setSegmentStart(now);
      setCurrentWorkSessionLocal({
        projectName: project,
        startedAt: new Date(now).toISOString(),
        accumulatedActiveMs: accMs,
        isPaused: false,
        pauseStartedAt: null,
        sessionRef: sessionRef || undefined,
      });
      await syncServer({
        projectName: project,
        startedAt: new Date(now).toISOString(),
        accumulatedActiveMs: accMs,
        isPaused: false,
        pauseStartedAt: null,
        sessionRef: sessionRef || undefined,
      });
    }
  }

  function beginFinishFlow() {
    const now = Date.now();
    let total = accMs;
    if (!paused && segmentStart != null) total += now - segmentStart;
    const minutes = Math.max(1, Math.round(total / 60000));
    finishRef.current = async (mood?: MoodValue, skipped?: boolean) => {
      const localHour = new Date().getHours();
      try {
        await apiWithOfflineQueue('/api/sessions/work/complete', {
          method: 'POST',
          body: JSON.stringify({
            actualMinutes: minutes,
            projectName: project,
            localHour,
            mood,
            moodSkipped: !!skipped || !mood,
            sessionRef: sessionRef || null,
          }),
        });
        const me = await api<{ user: User }>('/api/auth/me');
        if (me.user) setUserLocal(me.user);
        else await refreshUser();
      } catch {
        /* offline */
      }
      setMoodOpen(false);
      setRunning(false);
      setPaused(false);
      setAccMs(0);
      setSegmentStart(null);
      setDisplayMs(0);
      setSessionRef(null);
      setCurrentWorkSessionLocal(null);
    };
    setRunning(false);
    setPaused(false);
    setAccMs(total);
    setSegmentStart(null);
    setDisplayMs(total);
    setMoodOpen(true);
  }

  async function saveIdeaNote(pinned = false) {
    const content = ideaNote.trim();
    if (!content) return;
    try {
      await apiWithOfflineQueue('/api/notes', {
        method: 'POST',
        body: JSON.stringify({
          content,
          context: 'work',
          pinned,
          linkedSessionRef: sessionRef || null,
          linkedProjectName: project || null,
        }),
      });
      setIdeaNote('');
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6">
      <MoodCheckIn
        open={moodOpen}
        title="How did that work block feel?"
        onPick={(m) => void finishRef.current(m)}
        onSkip={() => void finishRef.current(undefined, true)}
      />
      <div className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-6 shadow-xl backdrop-blur-md">
        <h1 className="text-2xl font-extrabold text-[color:var(--nudge-text)]">Work tracker</h1>
        <p className="mt-1 text-sm opacity-75">
          Open-ended sessions with pause and resume. Your session restores after refresh.
        </p>
        <label className="mt-6 block text-left text-sm font-bold">
          What are you working on?
          <input
            className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 font-semibold outline-none ring-[color:var(--nudge-primary)] focus:ring-2"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            disabled={running}
          />
        </label>
        <motion.div
          className="mt-8 text-6xl font-black tabular-nums text-[color:var(--nudge-text)] sm:text-7xl"
          initial={{ scale: 0.98, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {String(Math.floor(displayMs / 3600000)).padStart(2, '0')}:
          {String(Math.floor((displayMs % 3600000) / 60000)).padStart(2, '0')}:
          {String(Math.floor((displayMs % 60000) / 1000)).padStart(2, '0')}
        </motion.div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {!running && (
            <button
              type="button"
              className="rounded-[2rem] bg-[color:var(--nudge-primary)] px-8 py-3 text-lg font-extrabold text-white shadow-lg"
              onClick={() => void handleStart()}
            >
              Start
            </button>
          )}
          {running && (
            <>
              <button
                type="button"
                className="rounded-[2rem] bg-[color:var(--nudge-accent)] px-6 py-3 text-lg font-extrabold text-[color:var(--nudge-text)] shadow"
                onClick={() => void togglePause()}
              >
                {paused ? 'Resume' : 'Pause'}
              </button>
              <button
                type="button"
                className="rounded-[2rem] bg-white/80 px-6 py-3 text-lg font-extrabold shadow"
                onClick={() => beginFinishFlow()}
              >
                Finish & log
              </button>
            </>
          )}
        </div>
      </div>
      <div className="rounded-[2rem] border border-white/40 bg-[color:var(--nudge-card)] p-6 shadow-xl backdrop-blur-md">
        <h2 className="text-lg font-extrabold text-[color:var(--nudge-text)]">Capture idea</h2>
        <p className="mt-1 text-sm opacity-75">Keep your thought, then continue working.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={ideaNote}
            onChange={(e) => setIdeaNote(e.target.value)}
            className="flex-1 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 font-semibold"
            placeholder="Write your idea..."
          />
          <button
            type="button"
            onClick={() => void saveIdeaNote(false)}
            className="rounded-[2rem] bg-[color:var(--nudge-primary)] px-4 py-2 text-sm font-extrabold text-white shadow"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => void saveIdeaNote(true)}
            className="rounded-[2rem] bg-white/80 px-4 py-2 text-sm font-extrabold shadow"
          >
            Pin
          </button>
        </div>
      </div>
    </div>
  );
}
