// Tiny synthesized sound effects for Bud — no audio assets, just WebAudio
// oscillators. Everything is gated by a module-level enabled flag (synced from the
// AssistantContext "sound effects" preference, off by default) and every call is a
// safe no-op when audio is unavailable (jsdom, autoplay-blocked, or no user gesture
// yet). Volumes are deliberately tiny; Bud whispers, he doesn't beep at you.

let enabled = false;
let ctx = null;

export function setSoundEnabled(v) {
  enabled = Boolean(v);
}

export function isSoundEnabled() {
  return enabled;
}

// Lazily create (and reuse) the AudioContext. Returns null when audio can't run.
function audio() {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      ctx = new AC();
    }
    // Browsers suspend contexts created before a user gesture; nudge it awake.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx.state === 'running' || ctx.state === 'suspended' ? ctx : null;
  } catch {
    return null;
  }
}

// One oscillator note with an attack/decay gain envelope.
function note(a, { type = 'sine', from = 440, to = from, dur = 0.1, gain = 0.05, delay = 0 }) {
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// A soft rising blip when Bud's speech bubble pops open.
export function pop() {
  const a = audio();
  if (!a) return;
  try {
    note(a, { type: 'sine', from: 380, to: 640, dur: 0.09, gain: 0.05 });
  } catch { /* never let a sound effect break the app */ }
}

// A short scratchy burst for the lighter sparking up.
export function flick() {
  const a = audio();
  if (!a) return;
  try {
    const t0 = a.currentTime;
    const len = Math.floor(a.sampleRate * 0.06);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const filter = a.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2400;
    const g = a.createGain();
    g.gain.value = 0.06;
    src.connect(filter).connect(g).connect(a.destination);
    src.start(t0);
  } catch { /* ignore */ }
}

// A gentle two-tone snore while Bud dozes (called once per breath cycle).
export function snore() {
  const a = audio();
  if (!a) return;
  try {
    note(a, { type: 'triangle', from: 95, to: 62, dur: 0.5, gain: 0.035 });
    note(a, { type: 'sine', from: 130, to: 88, dur: 0.45, gain: 0.02, delay: 0.05 });
  } catch { /* ignore */ }
}
