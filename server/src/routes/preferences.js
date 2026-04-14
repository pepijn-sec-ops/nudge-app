import { Router } from 'express';
import { readDb, writeDb } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { THEME_IDS, unlockedThemesForLevel, levelFromXp } from '../gamification.js';

const router = Router();
router.use(requireAuth);

function normalizeBuddyId(raw) {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  const aliasToBuddy = {
    luna: 'luna',
    'luna the cat': 'luna',
    bolt: 'bolt',
    'bolt the bot': 'bolt',
    pip: 'pip',
    'pip the bird': 'pip',
    bruno: 'bruno',
    dog: 'bruno',
    'bruno the golden retriever': 'bruno',
  };
  return aliasToBuddy[key] || null;
}

router.get('/', async (req, res) => {
  const u = (await readDb()).users.find((x) => x.id === req.user.id);
  const normalizedBuddy = normalizeBuddyId(u?.preferences?.buddyId);
  if (normalizedBuddy && u?.preferences) u.preferences.buddyId = normalizedBuddy;
  res.json({ preferences: u.preferences });
});

router.put('/', async (req, res) => {
  const p = req.body || {};
  await writeDb((d) => {
    const u = d.users.find((x) => x.id === req.user.id);
    if (!u) return;
    const prefs = u.preferences || {};
    const level = levelFromXp(u.xp || 0);
    const allowedThemes = new Set(unlockedThemesForLevel(level));

    if (typeof p.themeId === 'string' && allowedThemes.has(p.themeId)) prefs.themeId = p.themeId;
    else if (typeof p.themeId === 'string' && THEME_IDS.includes(p.themeId)) {
      if (allowedThemes.has(p.themeId)) prefs.themeId = p.themeId;
    }
    if (typeof p.primaryColor === 'string') prefs.primaryColor = p.primaryColor;
    if (typeof p.avatarColor === 'string') prefs.avatarColor = p.avatarColor;
    if (typeof p.accentColor === 'string') prefs.accentColor = p.accentColor;
    if (typeof p.avatarId === 'string') prefs.avatarId = p.avatarId;
    const normalizedBuddy = normalizeBuddyId(p.buddyId);
    if (normalizedBuddy) prefs.buddyId = normalizedBuddy;
    if (Array.isArray(p.motivationalMessages)) {
      prefs.motivationalMessages = p.motivationalMessages
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 12);
    }
    if (typeof p.animationsEnabled === 'boolean') prefs.animationsEnabled = p.animationsEnabled;
    if (typeof p.vibrationEnabled === 'boolean') prefs.vibrationEnabled = p.vibrationEnabled;
    if (['sm', 'md', 'lg'].includes(p.fontSize)) prefs.fontSize = p.fontSize;
    if (typeof p.dailyGoalMinutes === 'number') {
      prefs.dailyGoalMinutes = Math.min(480, Math.max(5, Math.round(p.dailyGoalMinutes)));
    }
    if (typeof p.language === 'string' && p.language.length <= 12) prefs.language = p.language;
    if (typeof p.timezone === 'string' && p.timezone.length <= 64) prefs.timezone = p.timezone;
    if (typeof p.defaultFocusMinutes === 'number') {
      prefs.defaultFocusMinutes = Math.min(180, Math.max(5, Math.round(p.defaultFocusMinutes)));
    }
    if (typeof p.ttsEnabled === 'boolean') prefs.ttsEnabled = p.ttsEnabled;
    if (['off', 'rain', 'white', 'brown'].includes(p.ambientDefault)) prefs.ambientDefault = p.ambientDefault;
    if (typeof p.compactMode === 'boolean') prefs.compactMode = p.compactMode;
    if (typeof p.showFocusTips === 'boolean') prefs.showFocusTips = p.showFocusTips;
    if (typeof p.weekStartsOn === 'number' && p.weekStartsOn >= 0 && p.weekStartsOn <= 6) {
      prefs.weekStartsOn = Math.floor(p.weekStartsOn);
    }
    if (typeof p.highContrast === 'boolean') prefs.highContrast = p.highContrast;
    if (Array.isArray(p.ttsAlertMinutes)) {
      const cleaned = [
        ...new Set(
          p.ttsAlertMinutes
            .map((x) => Math.round(Number(x)))
            .filter((n) => Number.isFinite(n) && n >= 1 && n <= 180),
        ),
      ]
        .sort((a, b) => b - a)
        .slice(0, 10);
      prefs.ttsAlertMinutes = cleaned.length ? cleaned : [10, 5, 1];
    }
    if (typeof p.ttsRate === 'number' && Number.isFinite(p.ttsRate)) {
      prefs.ttsRate = Math.min(2, Math.max(0.4, p.ttsRate));
    }
    if (typeof p.ttsPitch === 'number' && Number.isFinite(p.ttsPitch)) {
      prefs.ttsPitch = Math.min(2, Math.max(0, p.ttsPitch));
    }
    if (['custom', 'coral', 'ocean', 'lavender', 'forest', 'sunset'].includes(p.interfaceAccent)) {
      prefs.interfaceAccent = p.interfaceAccent;
    }
    if (['nunito', 'system'].includes(p.fontFamily)) prefs.fontFamily = p.fontFamily;
    if (typeof p.focusVoiceCuesEnabled === 'boolean') prefs.focusVoiceCuesEnabled = p.focusVoiceCuesEnabled;
    if (['default', 'midnight', 'forest', 'sunset', 'dawn'].includes(p.uiColorPreset)) {
      prefs.uiColorPreset = p.uiColorPreset;
    }
    if (typeof p.boltBodyColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(p.boltBodyColor)) {
      prefs.boltBodyColor = p.boltBodyColor;
    }
    if (typeof p.boltAccessoryHat === 'boolean') {
      prefs.boltAccessoryHat = p.boltAccessoryHat ? level >= 2 : false;
    }
    if (typeof p.boltAccessoryGlasses === 'boolean') {
      prefs.boltAccessoryGlasses = p.boltAccessoryGlasses ? level >= 4 : false;
    }
    if (['lofi', 'digital', 'nature'].includes(p.sessionCompleteSound)) {
      prefs.sessionCompleteSound = p.sessionCompleteSound;
    }
    if (typeof p.profileHeadline === 'string') prefs.profileHeadline = p.profileHeadline.trim().slice(0, 90);
    if (typeof p.profilePronouns === 'string') prefs.profilePronouns = p.profilePronouns.trim().slice(0, 30);
    if (['leaf', 'spark', 'rocket', 'target', 'heart', 'star'].includes(p.profileLogoId)) {
      prefs.profileLogoId = p.profileLogoId;
    }
    if (typeof p.profileLogoColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(p.profileLogoColor)) {
      prefs.profileLogoColor = p.profileLogoColor;
    }
    if (typeof p.profileImageDataUrl === 'string') {
      if (!p.profileImageDataUrl) prefs.profileImageDataUrl = '';
      else if (p.profileImageDataUrl.startsWith('data:image/') && p.profileImageDataUrl.length <= 1200000) {
        prefs.profileImageDataUrl = p.profileImageDataUrl;
      }
    }
    u.preferences = prefs;
  });
  const u = (await readDb()).users.find((x) => x.id === req.user.id);
  res.json({ preferences: u.preferences });
});

export default router;
