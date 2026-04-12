import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

const accentPresets: Record<string, { primary: string; accent: string; avatar: string }> = {
  coral: { primary: '#e07a5f', accent: '#f2cc8f', avatar: '#81b29a' },
  ocean: { primary: '#2563eb', accent: '#93c5fd', avatar: '#14b8a6' },
  lavender: { primary: '#7c3aed', accent: '#ddd6fe', avatar: '#a78bfa' },
  forest: { primary: '#166534', accent: '#bbf7d0', avatar: '#ca8a04' },
  sunset: { primary: '#ea580c', accent: '#fed7aa', avatar: '#db2777' },
};

/** Quick palette presets: override core CSS variables without a full page reload. */
const uiColorPresets: Record<string, { bg: string; text: string; card: string; primary: string; accent: string }> = {
  midnight: {
    bg: 'linear-gradient(165deg,#0f172a 0%,#1e1b4b 48%,#312e81 100%)',
    text: '#f1f5f9',
    card: 'rgba(255,255,255,0.09)',
    primary: '#818cf8',
    accent: '#c4b5fd',
  },
  forest: {
    bg: 'linear-gradient(165deg,#ecfdf5 0%,#d1fae5 45%,#bbf7d0 100%)',
    text: '#14532d',
    card: 'rgba(255,255,255,0.78)',
    primary: '#166534',
    accent: '#86efac',
  },
  sunset: {
    bg: 'linear-gradient(165deg,#fff7ed 0%,#ffedd5 40%,#fecdd3 100%)',
    text: '#7c2d12',
    card: 'rgba(255,255,255,0.82)',
    primary: '#ea580c',
    accent: '#fb923c',
  },
  dawn: {
    bg: 'linear-gradient(165deg,#fefce8 0%,#e0f2fe 50%,#fae8ff 100%)',
    text: '#4c1d95',
    card: 'rgba(255,255,255,0.78)',
    primary: '#a855f7',
    accent: '#f9a8d4',
  },
};

const themes: Record<
  string,
  { bg: string; text: string; card: string; gradient: string }
> = {
  cozy: {
    bg: 'linear-gradient(165deg,#fff5f0 0%,#fef9e8 50%,#f0faf3 100%)',
    text: '#3d405b',
    card: 'rgba(255,255,255,0.72)',
    gradient: 'from-[#e07a5f]/25 via-[#f2cc8f]/30 to-[#81b29a]/25',
  },
  midnight: {
    bg: 'linear-gradient(165deg,#1a1b2e 0%,#16213e 55%,#0f3460 100%)',
    text: '#f8f5f2',
    card: 'rgba(255,255,255,0.08)',
    gradient: 'from-indigo-500/20 via-purple-500/15 to-cyan-500/20',
  },
  night_owl: {
    bg: 'linear-gradient(165deg,#2d1b4e 0%,#1b263b 50%,#0d1b2a 100%)',
    text: '#e8e6f0',
    card: 'rgba(255,255,255,0.07)',
    gradient: 'from-violet-500/25 via-fuchsia-500/15 to-sky-500/20',
  },
  minimal_zen: {
    bg: 'linear-gradient(180deg,#fafafa 0%,#f0f4f4 100%)',
    text: '#2c2c2c',
    card: 'rgba(255,255,255,0.9)',
    gradient: 'from-stone-200/40 via-white/20 to-teal-100/30',
  },
};

const ThemeContext = createContext<{ className: string; style: React.CSSProperties } | null>(
  null,
);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const tid = user?.preferences?.themeId || 'cozy';
  const t = themes[tid] || themes.cozy;
  const accentId = user?.preferences?.interfaceAccent || 'custom';
  const preset =
    accentId && accentId !== 'custom' && accentPresets[accentId] ? accentPresets[accentId] : null;
  const uiPresetId = user?.preferences?.uiColorPreset;
  const uiPreset =
    uiPresetId && uiPresetId !== 'default' && uiColorPresets[uiPresetId] ? uiColorPresets[uiPresetId] : null;
  const primary = uiPreset?.primary ?? preset?.primary ?? user?.preferences?.primaryColor;
  const accentCol = uiPreset?.accent ?? preset?.accent ?? user?.preferences?.accentColor;
  const avatarCol = preset?.avatar ?? user?.preferences?.avatarColor;

  const value = useMemo(() => {
    const style: React.CSSProperties = {
      ['--nudge-bg' as string]: uiPreset?.bg ?? t.bg,
      ['--nudge-text' as string]: uiPreset?.text ?? t.text,
      ['--nudge-card' as string]: uiPreset?.card ?? t.card,
      ['--nudge-primary' as string]: primary || '#e07a5f',
      ['--nudge-accent' as string]: accentCol || '#f2cc8f',
      ['--nudge-avatar' as string]: avatarCol || '#81b29a',
    };
    const hc = user?.preferences?.highContrast ? 'nudge-high-contrast' : '';
    const compact = user?.preferences?.compactMode ? 'nudge-compact' : '';
    const sysFont = user?.preferences?.fontFamily === 'system' ? 'nudge-font-system' : '';
    return {
      style,
      className: `min-h-dvh ${hc} ${compact} ${sysFont} ${user?.preferences?.fontSize === 'sm' ? 'font-sm' : ''} ${
        user?.preferences?.fontSize === 'lg' ? 'font-lg' : 'font-md'
      }`.trim(),
    };
  }, [
    t,
    primary,
    accentCol,
    avatarCol,
    user?.preferences?.fontSize,
    user?.preferences?.highContrast,
    user?.preferences?.compactMode,
    user?.preferences?.fontFamily,
    user?.preferences?.interfaceAccent,
    user?.preferences?.uiColorPreset,
    uiPreset,
  ]);

  return (
    <ThemeContext.Provider value={value}>
      <div className={value.className} style={value.style}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useThemeShell() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('ThemeProvider missing');
  return ctx;
}

export function themeGradientClass(themeId: string) {
  return themes[themeId]?.gradient || themes.cozy.gradient;
}
