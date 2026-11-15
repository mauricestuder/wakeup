// First Chair: synthesised sound. Mountain wind, a murmur that grows with the crowd, and small
// clicks and chimes. No audio files needed.

let ctx = null, master = null, wind = null, windF = null, crowd = null, volume = 0.7;

export function setVolume(v) { volume = v; if (master) master.gain.value = v * 0.9; }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = volume * 0.9; master.connect(ctx.destination);
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2 + w * 0.12; }
  const loop = (type, freq, q) => {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(master); s.start();
    return [g, f];
  };
  [wind, windF] = loop('lowpass', 420, 0.6);
  [crowd] = loop('bandpass', 900, 0.8);
}

// height 0..1 = how far the camera is zoomed out, storm 0..1, people = guests on the mountain.
export function setAmbience(height, storm, people, paused) {
  if (!ctx) return;
  const t = ctx.currentTime;
  wind.gain.setTargetAtTime(paused ? 0.02 : 0.05 + height * 0.08 + storm * 0.22, t, 0.4);
  windF.frequency.setTargetAtTime(300 + height * 250 + storm * 700, t, 0.4);
  crowd.gain.setTargetAtTime(paused ? 0 : Math.min(0.05, people / 4000) * (1 - height * 0.7), t, 0.5);
}

function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slide = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  click: () => tone(660, 0.05, 'triangle', 0.1),
  tick: () => tone(880, 0.06, 'sine', 0.12),
  buzz: () => { tone(150, 0.16, 'sawtooth', 0.1); tone(110, 0.2, 'sawtooth', 0.08, 0.06); },
  build: () => { tone(140, 0.2, 'triangle', 0.3, 0, -70); tone(523, 0.12, 'triangle', 0.14, 0.08); tone(784, 0.2, 'triangle', 0.14, 0.17); },
  remove: () => { tone(220, 0.25, 'sawtooth', 0.12, 0, -150); },
  cash: () => { tone(1320, 0.09, 'square', 0.06); tone(1760, 0.2, 'square', 0.06, 0.07); },
  goal: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.32, 'triangle', 0.16, i * 0.09)),
  day: () => [392, 523, 659].forEach((f, i) => tone(f, 0.5, 'sine', 0.14, i * 0.14)),
  morning: () => [659, 784].forEach((f, i) => tone(f, 0.35, 'sine', 0.1, i * 0.12)),
};
