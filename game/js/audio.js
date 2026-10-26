// All sound effects are synthesized with Web Audio – no audio files.

let ac = null;
let master = null;
let noiseBuf = null;
let gunBus = null;
let volume = 0.5;

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v * 0.9;
}

export function initAudio() {
  if (ac) { ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = volume * 0.9;
  // A compressor keeps loud gunfire punchy without clipping.
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 8;
  comp.ratio.value = 6;
  comp.attack.value = 0.002;
  comp.release.value = 0.15;
  master.connect(comp).connect(ac.destination);
  // Gunshots go through a soft clipper so the boom gets a gritty, saturated edge.
  gunBus = ac.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 2.5) / Math.tanh(2.5); }
  gunBus.curve = curve;
  gunBus.oversample = '2x';
  gunBus.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function env(g, t, vol, dur, attack = 0.004) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone({ type = 'sine', freq = 440, freq2 = 0, dur = 0.1, vol = 0.2, delay = 0, attack, out = master }) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, t + dur);
  env(g, t, vol, dur, attack);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise({ dur = 0.2, vol = 0.2, type = 'lowpass', f1 = 2000, f2 = 0, q = 0.7, delay = 0, attack, out = master }) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f1, t);
  if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ac.createGain();
  env(g, t, vol, dur, attack);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

// Per gun: crack and body lengths, boom pitch in Hz, echo length and loudness.
const GUNS = {
  pistol:   { crack: 0.03,  body: 0.14, boom: 140, tail: 0.6,  vol: 0.55 },
  smg:      { crack: 0.022, body: 0.09, boom: 165, tail: 0.35, vol: 0.4 },
  assault:  { crack: 0.028, body: 0.12, boom: 120, tail: 0.5,  vol: 0.5 },
  minigun:  { crack: 0.018, body: 0.07, boom: 150, tail: 0.25, vol: 0.3 },
  shotgun:  { crack: 0.04,  body: 0.3,  boom: 95,  tail: 1.0,  vol: 0.7 },
  rifle:    { crack: 0.045, body: 0.28, boom: 85,  tail: 1.3,  vol: 0.75 },
  launcher: { crack: 0.02,  body: 0.22, boom: 70,  tail: 0.7,  vol: 0.5 },
};

export const sfx = {
  // A real gunshot is a sharp crack, a deep chest-thump boom and the room echoing back.
  shoot(kind, gold) {
    const g = GUNS[kind] || GUNS.pistol;
    const p = gold ? 0.85 : 1; // gold guns sound a touch heavier
    const out = gunBus;
    noise({ dur: g.crack, vol: g.vol * 0.9, type: 'highpass', f1: 1400, attack: 0.001, out });
    noise({ dur: g.body, vol: g.vol, type: 'lowpass', f1: 2600 * p, f2: 140, attack: 0.001, out });
    tone({ type: 'sine', freq: g.boom * p, freq2: 32, dur: g.body * 1.3, vol: g.vol * 1.1, attack: 0.001, out });
    tone({ type: 'triangle', freq: g.boom * 2 * p, freq2: 60, dur: g.body * 0.6, vol: g.vol * 0.35, attack: 0.001, out });
    noise({ dur: g.tail, vol: g.vol * 0.16, type: 'lowpass', f1: 900 * p, f2: 70, attack: 0.02, delay: 0.02 });
    noise({ dur: g.tail * 0.7, vol: g.vol * 0.08, type: 'bandpass', f1: 500, q: 1.2, attack: 0.03, delay: 0.09 });
    if (kind === 'shotgun') tone({ type: 'sine', freq: 70, freq2: 28, dur: 0.5, vol: 0.4, attack: 0.002, out });
    if (kind === 'shotgun') noise({ dur: 0.06, vol: 0.12, type: 'bandpass', f1: 1200, q: 4, delay: 0.42 }); // pump
    if (kind === 'rifle') noise({ dur: 0.9, vol: 0.12, type: 'lowpass', f1: 500, f2: 50, attack: 0.05, delay: 0.15 });
    if (kind === 'launcher') {
      tone({ type: 'square', freq: 520, freq2: 380, dur: 0.12, vol: 0.05, delay: 0.08 }); // oink
      noise({ dur: 0.4, vol: 0.15, type: 'bandpass', f1: 2200, f2: 600, q: 2, delay: 0.03 }); // whoosh
    }
  },
  empty() { tone({ type: 'square', freq: 900, dur: 0.03, vol: 0.06 }); },
  reload() {
    noise({ dur: 0.05, vol: 0.2, type: 'bandpass', f1: 3000, q: 3 });
    tone({ type: 'triangle', freq: 2000, freq2: 1700, dur: 0.08, vol: 0.06, delay: 0.25 });
    noise({ dur: 0.06, vol: 0.25, type: 'bandpass', f1: 1800, q: 3, delay: 0.5 });
  },
  hit() { tone({ type: 'square', freq: 1400, freq2: 900, dur: 0.04, vol: 0.05 }); },
  headshot() { tone({ type: 'triangle', freq: 2600, freq2: 2000, dur: 0.07, vol: 0.09 }); },
  kaching(vol = 0.12) {
    noise({ dur: 0.05, vol: vol * 1.4, type: 'bandpass', f1: 4000, q: 2 });
    tone({ type: 'sine', freq: 2093, dur: 0.35, vol, delay: 0.04 });
    tone({ type: 'sine', freq: 2637, dur: 0.45, vol: vol * 0.9, delay: 0.09 });
  },
  explosion(vol = 0.6) {
    noise({ dur: 1.1, vol, type: 'lowpass', f1: 1800, f2: 60 });
    tone({ type: 'sine', freq: 90, freq2: 30, dur: 0.8, vol: vol * 0.8 });
    for (let i = 0; i < 6; i++) tone({ type: 'triangle', freq: 1800 + Math.random() * 2400, dur: 0.12, vol: 0.03, delay: 0.25 + i * 0.07 });
  },
  groan(vol = 0.08, pitch = 1) {
    if (!ac) return;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const lfo = ac.createOscillator();
    const lg = ac.createGain();
    const g = ac.createGain();
    const f = ac.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110 * pitch, t);
    o.frequency.linearRampToValueAtTime(70 * pitch, t + 0.7);
    lfo.frequency.value = 18; lg.gain.value = 14;
    lfo.connect(lg).connect(o.frequency);
    f.type = 'lowpass'; f.frequency.value = 700;
    env(g, t, vol, 0.8, 0.08);
    o.connect(f).connect(g).connect(master);
    o.start(t); lfo.start(t); o.stop(t + 0.85); lfo.stop(t + 0.85);
  },
  hurt() {
    tone({ type: 'sine', freq: 160, freq2: 60, dur: 0.25, vol: 0.4 });
    noise({ dur: 0.15, vol: 0.25, f1: 600 });
  },
  denied() {
    tone({ type: 'square', freq: 180, dur: 0.12, vol: 0.08 });
    tone({ type: 'square', freq: 140, dur: 0.18, vol: 0.08, delay: 0.13 });
  },
  powerup() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.18, vol: 0.12, delay: i * 0.07 }));
  },
  roundStart() {
    [392, 370, 311, 294].forEach((f, i) => tone({ type: 'sawtooth', freq: f, dur: 0.5, vol: 0.07, delay: i * 0.35 }));
    tone({ type: 'sine', freq: 98, dur: 1.8, vol: 0.2 });
  },
  roundEnd() {
    [294, 392, 523].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.6, vol: 0.09, delay: i * 0.25 }));
  },
  spin() {
    for (let i = 0; i < 18; i++) tone({ type: 'square', freq: 700 + (i % 3) * 200, dur: 0.05, vol: 0.04, delay: i * 0.13 });
  },
  // Paper Shredder trap: grinding motor plus ripping paper.
  shred(vol = 0.25) {
    noise({ dur: 0.5, vol, type: 'bandpass', f1: 900, f2: 1400, q: 2 });
    tone({ type: 'sawtooth', freq: 55, freq2: 62, dur: 0.5, vol: vol * 0.4 });
  },
  // Debt Collector throwing an invoice.
  toss() {
    noise({ dur: 0.15, vol: 0.18, type: 'highpass', f1: 2500, f2: 5000 });
    tone({ type: 'triangle', freq: 500, freq2: 300, dur: 0.12, vol: 0.05 });
  },
  // Rising chime for kill combos; higher with each kill.
  combo(n) {
    const f = 660 * Math.pow(1.122, Math.min(n, 12));
    tone({ type: 'triangle', freq: f, dur: 0.12, vol: 0.08 });
    tone({ type: 'triangle', freq: f * 1.5, dur: 0.16, vol: 0.06, delay: 0.06 });
  },
  // Secret piggy bank found.
  secret() {
    [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'sine', freq: f, dur: 0.4, vol: 0.1, delay: i * 0.12 }));
    noise({ dur: 0.2, vol: 0.15, type: 'bandpass', f1: 5000, q: 2, delay: 0.1 });
  },
  door() {
    noise({ dur: 1.0, vol: 0.3, type: 'lowpass', f1: 400, f2: 120 });
    tone({ type: 'sawtooth', freq: 60, freq2: 45, dur: 1.0, vol: 0.08 });
  },
  plate() {
    for (let i = 0; i < 10; i++) tone({ type: 'sine', freq: 400 + i * 120, dur: 0.2, vol: 0.06, delay: i * 0.12 });
    noise({ dur: 1.4, vol: 0.15, type: 'bandpass', f1: 800, f2: 4000, q: 2 });
  },
};
