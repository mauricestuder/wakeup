// Synthesised sound: wind that rises with speed, carving hiss, landings and
// a little chime when a trick lands. No audio files needed.

let ctx = null, master, wind, windFilter, carve, carveFilter;

function noiseBuffer() {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02; // brown-ish noise
    d[i] = last * 3.5 * 0.5 + w * 0.5;
  }
  return b;
}

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  const buf = noiseBuffer();

  const src = (filter) => {
    const s = ctx.createBufferSource();
    s.buffer = buf; s.loop = true;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(filter); filter.connect(g); g.connect(master);
    s.start();
    return g;
  };
  windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass'; windFilter.frequency.value = 400;
  wind = src(windFilter);
  carveFilter = ctx.createBiquadFilter();
  carveFilter.type = 'bandpass'; carveFilter.frequency.value = 1800; carveFilter.Q.value = 0.7;
  carve = src(carveFilter);
}

export function setMix(speed, scrub, grounded, muted) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const s = Math.min(1, speed / 30);
  wind.gain.setTargetAtTime(muted ? 0 : 0.05 + s * s * 0.5, t, 0.15);
  windFilter.frequency.setTargetAtTime(250 + s * 1400, t, 0.2);
  const c = muted || !grounded ? 0 : Math.min(1, speed / 12) * (0.06 + scrub * 0.5);
  carve.gain.setTargetAtTime(c, t, 0.06);
  carveFilter.frequency.setTargetAtTime(1200 + scrub * 1600 + s * 600, t, 0.1);
}

function burst(freq, dur, vol, type = 'lowpass') {
  if (!ctx) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur);
}

function tone(freq, at, dur, vol, type = 'triangle') {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  land(impact) { burst(500 + impact * 40, 0.25, Math.min(0.9, 0.2 + impact * 0.05)); },
  pop() { burst(900, 0.08, 0.25, 'bandpass'); },
  crash() { burst(300, 0.6, 0.9); burst(1500, 0.35, 0.3, 'bandpass'); },
  grind() { if (!ctx) return; tone(2400, 0, 0.12, 0.05, 'square'); },
  trick(level) {
    if (!ctx) return;
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < Math.min(4, 1 + level); i++) tone(notes[i], i * 0.07, 0.25, 0.12);
  },
  bank() { if (ctx) { tone(784, 0, 0.18, 0.1); tone(1175, 0.09, 0.3, 0.1); } },
};
