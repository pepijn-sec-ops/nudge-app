const TOKEN_KEY = 'nudge_token';
const OFFLINE_QUEUE_KEY = 'nudge_offline_queue_v1';
const OFFLINE_QUEUE_EVENT = 'nudge:offline-queue-updated';

/** Base URL for API (no trailing slash). */
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://nudge-app-iim0.onrender.com';

export function apiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const token = options.token ?? getToken();

  const headers: Record<string, string> = {
	'Content-Type': 'application/json',
	...(options.headers as Record<string, string>),
  };

  if (token) {
	headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(apiUrl(path), {
	...options,
	headers,
	credentials: 'include', // 🔥 IMPORTANT FIX (CORS + cookies)
  });

  if (!res.ok) {
	let msg = res.statusText;

	try {
	  const j = await res.json();
	  if (j?.error) msg = j.error;
	} catch {
	  // ignore
	}

	console.error('API ERROR:', msg);
	throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export type OfflineMutation = {
  id: string;
  path: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: string;
  createdAt: string;
};

function isOfflineError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const msg = String(error.message || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed')
  );
}

function readOfflineQueue(): OfflineMutation[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is OfflineMutation =>
        x &&
        typeof x === 'object' &&
        typeof x.id === 'string' &&
        typeof x.path === 'string' &&
        typeof x.method === 'string' &&
        typeof x.body === 'string' &&
        typeof x.createdAt === 'string',
    );
  } catch {
    return [];
  }
}

function writeOfflineQueue(queue: OfflineMutation[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT, { detail: { count: queue.length } }));
  } catch {
    /* ignore storage failures */
  }
}

export function getOfflineQueueCount() {
  return readOfflineQueue().length;
}

export async function queueOfflineMutation(
  path: string,
  options: { method: OfflineMutation['method']; body: string },
) {
  const queue = readOfflineQueue();
  queue.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    path,
    method: options.method,
    body: options.body,
    createdAt: new Date().toISOString(),
  });
  writeOfflineQueue(queue);
}

let flushingOfflineQueue = false;
export async function flushOfflineQueue() {
  if (flushingOfflineQueue) return;
  flushingOfflineQueue = true;
  try {
    let queue = readOfflineQueue();
    while (queue.length > 0) {
      const token = getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const next = queue[0];
      const res = await fetch(apiUrl(next.path), {
        method: next.method,
        headers,
        body: next.body,
        credentials: 'include',
      });
      if (!res.ok) {
        // Keep failed items; user can retry later.
        break;
      }
      queue = queue.slice(1);
      writeOfflineQueue(queue);
    }
  } catch {
    /* still offline */
  } finally {
    flushingOfflineQueue = false;
  }
}

export function onOfflineQueueChange(callback: (count: number) => void) {
  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ count?: number }>;
    callback(typeof custom.detail?.count === 'number' ? custom.detail.count : getOfflineQueueCount());
  };
  window.addEventListener(OFFLINE_QUEUE_EVENT, handler);
  return () => window.removeEventListener(OFFLINE_QUEUE_EVENT, handler);
}

export async function apiWithOfflineQueue(
  path: string,
  options: RequestInit & { method: OfflineMutation['method']; body: string },
) {
  try {
    await api(path, options);
    return { queued: false as const };
  } catch (e) {
    if (!isOfflineError(e)) throw e;
    await queueOfflineMutation(path, { method: options.method, body: options.body });
    return { queued: true as const };
  }
}

/* ================= TYPES ================= */

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  xp: number;
  badges: string[];
  preferences: Preferences;
  currentWorkSession: WorkSessionState | null;
  currentFocusSession: FocusSessionState | null;
};

export type Preferences = {
  themeId: string;
  primaryColor: string;
  avatarColor: string;
  accentColor: string;
  avatarId: string;
  buddyId: 'luna' | 'bolt' | 'pip' | 'bruno';
  motivationalMessages: string[];
  animationsEnabled: boolean;
  vibrationEnabled: boolean;
  fontSize: 'sm' | 'md' | 'lg';
  dailyGoalMinutes: number;
  language: string;
  timezone: string;
  defaultFocusMinutes?: number;
  ttsEnabled?: boolean;
  ambientDefault?: 'off' | 'rain' | 'white' | 'brown';
  compactMode?: boolean;
  showFocusTips?: boolean;
  weekStartsOn?: number;
  highContrast?: boolean;
  ttsAlertMinutes?: number[];
  ttsRate?: number;
  ttsPitch?: number;
  interfaceAccent?: 'custom' | 'coral' | 'ocean' | 'lavender' | 'forest' | 'sunset';
  fontFamily?: 'nunito' | 'system';
  focusVoiceCuesEnabled?: boolean;
  uiColorPreset?: 'default' | 'midnight' | 'forest' | 'sunset' | 'dawn';
  boltBodyColor?: string;
  boltAccessoryHat?: boolean;
  boltAccessoryGlasses?: boolean;
  sessionCompleteSound?: 'lofi' | 'digital' | 'nature';
  profileHeadline?: string;
  profilePronouns?: string;
  profileLogoId?: 'leaf' | 'spark' | 'rocket' | 'target' | 'heart' | 'star';
  profileLogoColor?: string;
  profileImageDataUrl?: string;
};

export type Task = {
  id: string;
  userId: string;
  title: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  estimateMinutes: number;
  pinned: boolean;
  completed: boolean;
  actualMinutesLogged: number;
  createdAt: string;
  updatedAt?: string;
};

export type WorkSessionState = {
  projectName: string;
  startedAt: string;
  accumulatedActiveMs: number;
  isPaused: boolean;
  pauseStartedAt: string | null;
  sessionRef?: string;
};

export type FocusSessionState = {
  plannedMinutes: number;
  remainingSeconds: number;
  isPaused: boolean;
  endsAt: string | null;
  stuckBreakEndAt: string | null;
  updatedAt: string;
  sessionRef?: string;
};

export type Note = {
  id: string;
  userId: string;
  content: string;
  pinned: boolean;
  context: 'focus' | 'work' | 'general';
  createdAt: string;
  updatedAt?: string;
  linkedSessionRef?: string | null;
  linkedTaskId?: string | null;
  linkedTaskTitle?: string | null;
  linkedProjectName?: string | null;
};
