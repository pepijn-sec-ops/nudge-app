const TOKEN_KEY = 'nudge_token';

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
};

export type Note = {
  id: string;
  userId: string;
  content: string;
  pinned: boolean;
  context: 'focus' | 'work' | 'general';
  createdAt: string;
  updatedAt?: string;
};
