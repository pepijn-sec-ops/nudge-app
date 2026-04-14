import { ambientAudio } from './audioService';
import { Capacitor, registerPlugin } from '@capacitor/core';

type NativeTtsPlugin = {
  speak(options: { text: string; lang?: string; rate?: number; pitch?: number; volume?: number }): Promise<void>;
};

let muted = false;
let announcementsEnabled = true;
let rate = 1;
let pitch = 1;

let unlocked = false;
let voices: SpeechSynthesisVoice[] = [];
const nativeTtsAvailable = Capacitor.isNativePlatform();
const NativeTextToSpeech = registerPlugin<NativeTtsPlugin>('TextToSpeech');

function speakMinutesRemaining(minutes: number, lang: string) {
  const base = lang.split('-')[0] || 'en';

  if (base === 'nl') return `Nog ${minutes} minuut${minutes === 1 ? '' : 'en'}.`;
  if (base === 'de') return `Noch ${minutes} Minute${minutes === 1 ? '' : 'n'}.`;
  if (base === 'es') return `Quedan ${minutes} minuto${minutes === 1 ? '' : 's'}.`;

  return `${minutes} minute${minutes === 1 ? '' : 's'} remaining.`;
}

function speakMinutesElapsed(minutes: number, lang: string) {
  const base = lang.split('-')[0] || 'en';

  if (base === 'nl') return `${minutes} minuut${minutes === 1 ? '' : 'en'} voorbij.`;
  if (base === 'de') return `${minutes} Minute${minutes === 1 ? '' : 'n'} vorbei.`;
  if (base === 'es') return `${minutes} minuto${minutes === 1 ? '' : 's'} transcurridos.`;

  return `${minutes} minute${minutes === 1 ? '' : 's'} passed.`;
}

function speakSecondsRemaining(seconds: number, lang: string) {
  const base = lang.split('-')[0] || 'en';

  if (base === 'nl') return `Nog ${seconds} seconden.`;
  if (base === 'de') return `Noch ${seconds} Sekunden.`;
  if (base === 'es') return `Quedan ${seconds} segundos.`;

  return `${seconds} seconds remaining.`;
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

  unlock() {
	if (nativeTtsAvailable) {
	  unlocked = true;
	  return;
	}
	if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
	if (unlocked) {
	  // Refresh voices list if it arrives later.
	  const latest = window.speechSynthesis.getVoices();
	  if (latest.length) voices = latest;
	  return;
	}

	const synth = window.speechSynthesis;
	unlocked = true; // User interaction already happened; allow fallback speaking.

	const loadVoices = () => {
	  const v = synth.getVoices();
	  if (v.length > 0) {
		voices = v;
		console.log('TTS ready ✅', voices.length);
	  }
	};

	// Try immediately
	loadVoices();

	// Async load (Chrome fix)
	synth.onvoiceschanged = () => {
	  loadVoices();
	};

	// Kickstart engine
	try {
	  const u = new SpeechSynthesisUtterance(' ');
	  synth.speak(u);
	} catch {}
  },

  speak(text: string, lang: string) {
	if (
	  !announcementsEnabled ||
	  muted ||
	  typeof window === 'undefined'
	) {
	  console.log('TTS blocked ❌');
	  return;
	}
	if (nativeTtsAvailable) {
	  if (!unlocked) this.unlock();
	  ambientAudio.duckForSpeech();
	  void NativeTextToSpeech.speak({
		text,
		lang: lang || 'en-US',
		rate,
		pitch,
		volume: 1,
	  })
		.catch(() => {
		  // Keep app flow stable even when native TTS fails on a device.
		})
		.finally(() => {
		  ambientAudio.releaseDuck();
		});
	  return;
	}
	if (!('speechSynthesis' in window)) return;

	const synth = window.speechSynthesis;

	// Ensure unlock was attempted from a user gesture.
	if (!unlocked) {
	  this.unlock();
	  console.log('TTS not ready yet… retrying');
	  setTimeout(() => this.speak(text, lang), 300);
	  return;
	}

	console.log('Speaking:', text);

	synth.cancel();
	ambientAudio.duckForSpeech();

	const u = new SpeechSynthesisUtterance(text);
	u.lang = lang || 'en-US';
	u.rate = rate;
	u.pitch = pitch;

	// Pick best voice when available; otherwise use platform default voice.
	const match =
	  voices.find((v) => v.lang.startsWith(lang)) ||
	  voices.find((v) => v.lang.startsWith('en'));

	if (match) u.voice = match;

	u.onend = () => ambientAudio.releaseDuck();
	u.onerror = () => ambientAudio.releaseDuck();

	synth.speak(u);
  },

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

  maybeAnnounceElapsed(
    prevElapsedSec: number,
    curElapsedSec: number,
    lang: string,
    marksMinutes: number[]
  ) {
    const sorted = [...new Set(marksMinutes)]
      .filter((m) => Number.isFinite(m) && m > 0)
      .sort((a, b) => a - b);

    for (const mins of sorted) {
      const secs = Math.round(mins) * 60;
      if (prevElapsedSec < secs && curElapsedSec >= secs) {
        this.speak(speakMinutesElapsed(Math.max(1, Math.round(mins)), lang), lang);
      }
    }
  },

  maybeAnnounceCountdown(
    prevSec: number,
    curSec: number,
    lang: string,
    options?: { countdownFrom?: number; extraMarksSec?: number[] }
  ) {
    const countdownFrom = Math.max(1, options?.countdownFrom ?? 10);
    const extraMarks = [...new Set(options?.extraMarksSec ?? [])]
      .filter((s) => Number.isFinite(s) && s > countdownFrom)
      .sort((a, b) => b - a);

    for (const secs of extraMarks) {
      if (prevSec > secs && curSec <= secs) {
        this.speak(speakSecondsRemaining(Math.round(secs), lang), lang);
      }
    }

    for (let sec = countdownFrom; sec >= 1; sec -= 1) {
      if (prevSec > sec && curSec <= sec) {
        this.speak(String(sec), lang);
        break;
      }
    }
  },

  announceStart(minutes: number, lang: string) {
	setTimeout(() => {
	  this.speak(`Focus session started for ${minutes} minutes.`, lang);
	}, 400);
  },

  announceComplete(lang: string) {
	setTimeout(() => {
	  this.speak('Session complete. Take a gentle pause.', lang);
	}, 200);
  },
};
