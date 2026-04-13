import { ambientAudio } from './audioService';

let muted = false;
let announcementsEnabled = true;
let rate = 1;
let pitch = 1;

// ✅ MOBILE FIX
let unlocked = false;

function speakMinutesRemaining(minutes: number, lang: string) {
  const base = lang.split('-')[0] || 'en';

  if (base === 'nl') return `Nog ${minutes} minuut${minutes === 1 ? '' : 'en'}.`;
  if (base === 'de') return `Noch ${minutes} Minute${minutes === 1 ? '' : 'n'}.`;
  if (base === 'es') return `Quedan ${minutes} minuto${minutes === 1 ? '' : 's'}.`;

  return `${minutes} minute${minutes === 1 ? '' : 's'} remaining.`;
}

export const tts = {
  setMuted(m: boolean) {
    muted = m;
  },

  getMuted() {
    return muted;
  },

  setAnnouncementsEnabled(v: boolean) {
    announcementsEnabled = v;
  },

  setProsody(opts: { rate?: number; pitch?: number }) {
    if (typeof opts.rate === 'number' && Number.isFinite(opts.rate)) {
      rate = Math.min(2, Math.max(0.4, opts.rate));
    }
    if (typeof opts.pitch === 'number' && Number.isFinite(opts.pitch)) {
      pitch = Math.min(2, Math.max(0, opts.pitch));
    }
  },

  // ✅ MOBILE UNLOCK
  unlock() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (unlocked) return;

    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance('');
      window.speechSynthesis.speak(u);
      unlocked = true;
    } catch {}
  },

  speak(text: string, lang: string) {
    if (
      !announcementsEnabled ||
      muted ||
      !unlocked ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();
    ambientAudio.duckForSpeech();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang || 'en-US';
    u.rate = rate;
    u.pitch = pitch;

    u.onend = () => ambientAudio.releaseDuck();
    u.onerror = () => ambientAudio.releaseDuck();

    window.speechSynthesis.speak(u);
  },

  // ✅ WORKS FOR ANY PRESET
  maybeAnnounceRemaining(
    prevSec: number,
    curSec: number,
    lang: string,
    thresholdsSec: number[]
  ) {
    const sorted = [...new Set(thresholdsSec)]
      .filter((t) => t > 0)
      .sort((a, b) => b - a);

    for (const secs of sorted) {
      if (prevSec > secs && curSec <= secs) {
        const minutes = Math.max(1, Math.round(secs / 60));
        this.speak(speakMinutesRemaining(minutes, lang), lang);
      }
    }
  },

  announceStart(minutes: number, lang: string) {
    this.speak(`Focus session started for ${minutes} minutes.`, lang);
  },

  announceComplete(lang: string) {
    this.speak('Session complete. Take a gentle pause.', lang);
  },
};