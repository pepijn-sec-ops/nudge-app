export type AmbientKind = 'off' | 'rain' | 'white' | 'brown';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseNode: AudioNode | null = null;
let volume = 0.35;
let kind: AmbientKind = 'off';
let mutedAll = false;
let duckDepth = 0;

function ensureCtx() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = mutedAll ? 0 : volume;
    master.connect(ctx.destination);
  }
  return ctx;
}

function disconnectNoise() {
  if (noiseNode && 'stop' in noiseNode && typeof (noiseNode as AudioBufferSourceNode).stop === 'function') {
    try {
      ;(noiseNode as AudioBufferSourceNode).stop();
    } catch {
      /* ignore */
    }
  }
  noiseNode = null;
}

function makeBuffer(len: number, fn: (i: number) => number) {
  const c = ensureCtx();
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let idx = 0; idx < len; idx += 1) data[idx] = fn(idx);
  return buf;
}

function startWhiteBrown(type: 'white' | 'brown') {
  const c = ensureCtx();
  disconnectNoise();
  const len = c.sampleRate * 2;
  const buf = makeBuffer(len, (_i) => {
    const w = Math.random() * 2 - 1;
    // Keep ambient lanes closer in perceived loudness.
    if (type === 'white') return w * 0.1;
    return w * 0.1;
  });
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  if (type === 'brown') {
    const biquad = c.createBiquadFilter();
    biquad.type = 'lowpass';
    biquad.frequency.value = 400;
    src.connect(biquad);
    biquad.connect(master!);
  } else {
    src.connect(master!);
  }
  src.start();
  noiseNode = src;
}

function startRain() {
  const c = ensureCtx();
  disconnectNoise();
  const len = c.sampleRate * 2;
  const buf = makeBuffer(len, () => (Math.random() * 2 - 1) * 0.1);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 400;
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.35;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 350;
  lfo.connect(lfoGain);
  lfoGain.connect(lp.frequency);
  src.connect(lp);
  lp.connect(hp);
  hp.connect(master!);
  lfo.start();
  src.start();
  noiseNode = src;
}

function applyGain() {
  if (!master) return;
  const ducked = duckDepth > 0 ? Math.min(volume, 0.04) : volume;
  master.gain.value = mutedAll ? 0 : ducked;
}

export const ambientAudio = {
  async resume() {
    const c = ensureCtx();
    if (c.state === 'suspended') await c.resume();
  },

  setMutedAll(m: boolean) {
    mutedAll = m;
    applyGain();
  },

  setVolume(v: number) {
    volume = Math.max(0, Math.min(1, v));
    applyGain();
  },

  setKind(k: AmbientKind) {
    kind = k;
    disconnectNoise();
    if (k === 'off' || mutedAll) return;
    void ensureCtx().resume();
    if (k === 'white' || k === 'brown') startWhiteBrown(k);
    if (k === 'rain') startRain();
  },

  duckForSpeech() {
    duckDepth += 1;
    applyGain();
  },

  releaseDuck() {
    duckDepth = Math.max(0, duckDepth - 1);
    applyGain();
  },

  getKind() {
    return kind;
  },
};

export type SessionCompleteSound = 'lofi' | 'digital' | 'nature';

let sfxCtx: AudioContext | null = null;

function sfxContext() {
  if (!sfxCtx) sfxCtx = new AudioContext();
  return sfxCtx;
}

/** Short completion chime (separate from ambient lanes). */
export function playSessionCompleteSound(kind: SessionCompleteSound, mutedAll: boolean) {
  if (mutedAll || typeof window === 'undefined') return;
  const c = sfxContext();
  void c.resume();
  const master = c.createGain();
  master.gain.value = 0.22;
  master.connect(c.destination);
  const now = c.currentTime;

  if (kind === 'digital') {
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + 0.14);
    const osc2 = c.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1320, now + 0.08);
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.0001, now + 0.08);
    g2.gain.exponentialRampToValueAtTime(0.1, now + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc2.connect(g2);
    g2.connect(master);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.24);
    return;
  }

  if (kind === 'nature') {
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.35), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * 0.25 * (1 - i / d.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(420, now);
    bp.Q.setValueAtTime(0.7, now);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.35, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    src.connect(bp);
    bp.connect(g);
    g.connect(master);
    src.start(now);
    src.stop(now + 0.36);
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(196, now);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, now);
    og.gain.exponentialRampToValueAtTime(0.08, now + 0.05);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(og);
    og.connect(master);
    osc.start(now);
    osc.stop(now + 0.42);
    return;
  }

  // lofi — soft stacked fifths
  const freqs = [392, 523.25];
  freqs.forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, now);
    const g = c.createGain();
    const t0 = now + i * 0.04;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.58);
  });
}
