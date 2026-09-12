// Alarm engine: scheduling helpers, Web Audio siren with volume ramp,
// vibration, and the screen wake lock. No UI here.

let ctx = null;
let master = null;
let sirenNodes = null;
let vibrateTimer = null;
let wakeLock = null;

// ── scheduling ──────────────────────────────────────────────────────────

/** Next timestamp (ms) at which "HH:MM" occurs, strictly after `from`. */
export function nextFireAt(timeStr, from = Date.now()) {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(from);
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= from) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// ── audio ───────────────────────────────────────────────────────────────

function ensureContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  return ctx;
}

// iOS mutes Web Audio when the silent switch is on, but not "media" playback.
// Two ways to be treated as media: the Audio Session API (Safari 17+), and
// keeping a silent <audio> element looping, which older Safari also honours.
let silentLoop = null;

function silentWavUrl() {
  // 0.5 s of 8-bit mono silence at 8 kHz.
  const samples = 4000;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, samples, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

function becomeMediaSession() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* unsupported */ }
  if (!silentLoop) {
    silentLoop = new Audio(silentWavUrl());
    silentLoop.loop = true;
    silentLoop.setAttribute('playsinline', '');
    silentLoop.volume = 0.01;
  }
  silentLoop.play().catch(() => { /* needs a gesture; we are inside one */ });
}

/**
 * Must be called from a user gesture (the "Arm" click). iOS/Safari refuse to
 * play anything later unless the context was resumed inside a gesture.
 */
export async function unlockAudio() {
  const c = ensureContext();
  becomeMediaSession();
  if (c.state === 'suspended') await c.resume();
  // Play a short silent buffer to fully unlock on iOS.
  const buf = c.createBuffer(1, 1, c.sampleRate);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
  return c.state === 'running';
}

/**
 * Start the siren. `volume` is the starting gain (0–1); it ramps linearly to 1
 * over `rampSeconds`. Calling again restarts with the new parameters.
 */
export function startSiren({ volume = 0.2, rampSeconds = 30 } = {}) {
  stopSiren();
  const c = ensureContext();
  becomeMediaSession();
  if (c.state === 'suspended') c.resume();

  const now = c.currentTime;
  const gain = c.createGain();
  gain.gain.setValueAtTime(Math.max(0.01, volume), now);
  gain.gain.linearRampToValueAtTime(1, now + Math.max(0, rampSeconds));
  gain.connect(master);

  // Two-tone siren: a square wave whose pitch is switched by a slow LFO.
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 780;

  const lfo = c.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 2.5;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain).connect(osc.frequency);

  // Gate on/off so it is a beeping siren rather than a constant drone.
  const gate = c.createGain();
  const gateLfo = c.createOscillator();
  gateLfo.type = 'square';
  gateLfo.frequency.value = 5;
  const gateDepth = c.createGain();
  gateDepth.gain.value = 0.5;
  gate.gain.value = 0.5;
  gateLfo.connect(gateDepth).connect(gate.gain);

  osc.connect(gate).connect(gain);
  osc.start(now);
  lfo.start(now);
  gateLfo.start(now);

  sirenNodes = { osc, lfo, gateLfo, gain };
  startVibration();
}

export function stopSiren() {
  if (sirenNodes) {
    const { osc, lfo, gateLfo, gain } = sirenNodes;
    try { osc.stop(); lfo.stop(); gateLfo.stop(); } catch { /* already stopped */ }
    gain.disconnect();
    sirenNodes = null;
  }
  stopVibration();
}

export function isRinging() {
  return sirenNodes !== null;
}

/** Short attention chime (used for the re-check prompt). */
export function playChime() {
  const c = ensureContext();
  if (c.state === 'suspended') c.resume();
  const now = c.currentTime;
  [880, 1175, 1568].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, now + i * 0.18);
    g.gain.exponentialRampToValueAtTime(0.8, now + i * 0.18 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.5);
    o.connect(g).connect(master);
    o.start(now + i * 0.18);
    o.stop(now + i * 0.18 + 0.55);
  });
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// ── vibration ───────────────────────────────────────────────────────────

function startVibration() {
  if (!navigator.vibrate) return;
  stopVibration();
  const buzz = () => navigator.vibrate([500, 300]);
  buzz();
  vibrateTimer = setInterval(buzz, 800);
}

function stopVibration() {
  if (vibrateTimer) { clearInterval(vibrateTimer); vibrateTimer = null; }
  if (navigator.vibrate) navigator.vibrate(0);
}

// ── wake lock ───────────────────────────────────────────────────────────

export async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return false;
  try {
    if (wakeLock && !wakeLock.released) return true;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
    return true;
  } catch {
    return false;
  }
}

export async function releaseWakeLock() {
  if (wakeLock) {
    try { await wakeLock.release(); } catch { /* ignore */ }
    wakeLock = null;
  }
}

export function hasWakeLock() {
  return !!wakeLock && !wakeLock.released;
}
