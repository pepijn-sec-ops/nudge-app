import { ambientAudio } from './audioService';

const phrases: Record<string, Record<string, string>> = {
  en: {
    m10: 'Ten minutes remaining.',
    m5: 'Five minutes remaining.',
    m1: 'One minute remaining.',
    done: 'Session complete. Take a gentle pause.',
  },
  nl: {
    m10: 'Nog tien minuten.',
    m5: 'Nog vijf minuten.',
    m1: 'Nog één minuut.',
    done: 'Sessie voltooid. Neem een korte pauze.',
  },
  de: {
    m10: 'Noch zehn Minuten.',
    m5: 'Noch fünf Minuten.',
    m1: 'Noch eine Minute.',
    done: 'Sitzung beendet. Mach eine kurze Pause.',
  },
  es: {
    m10: 'Quedan diez minutos.',
    m5: 'Quedan cinco minutos.',
    m1: 'Queda un minuto.',
    done: 'Sesión terminada. Haz una pausa suave.',
  },
};

let muted = false;
let announcementsEnabled = true;
let rate = 1;
let pitch = 1;

function pick(lang: string) {
  const base = lang.split('-')[0] || 'en';
  return phrases[base] || phrases.en;
}

function speakMinutesRemaining(minutes: number, lang: string) {
  const base = lang.split('-')[0] || 'en';
  if (base === 'nl') return `Nog ${minutes} minuten.`;
  if (base === 'de') return `Noch ${minutes} Minuten.`;
  if (base === 'es') return `Quedan ${minutes} minutos.`;
  return `${minutes} minute${minutes === 1 ? '' : 's'} remaining.`;
}

function phraseForMinuteMark(minutes: number, lang: string) {
  const dict = pick(lang);
  if (minutes === 10 && dict.m10) return dict.m10;
  if (minutes === 5 && dict.m5) return dict.m5;
  if (minutes === 1 && dict.m1) return dict.m1;
  return speakMinutesRemaining(minutes, lang);
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

  speak(text: string, lang: string) {
    if (!announcementsEnabled || muted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
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

  /**
   * thresholdsSec: e.g. [600,300,60] for 10m,5m,1m — should be sorted descending.
   * Announces once when crossing each boundary (prev > T && cur <= T).
   */
  maybeAnnounceRemaining(prevSec: number, curSec: number, lang: string, thresholdsSec: number[]) {
    const sorted = [...thresholdsSec].filter((t) => t > 0).sort((a, b) => b - a);
    for (const secs of sorted) {
      if (prevSec > secs && curSec <= secs) {
        const minutes = Math.max(1, Math.round(secs / 60));
        this.speak(phraseForMinuteMark(minutes, lang), lang);
      }
    }
  },

  announceComplete(lang: string) {
    const dict = pick(lang);
    this.speak(dict.done, lang);
  },
};
