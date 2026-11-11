// All sounds are made on the spot with oscillators and noise, no audio files.

let ctx = null, master = null, noiseBuf = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let n = 0; n < d.length; n++) d[n] = Math.random() * 2 - 1;
}

let volume = 0.7;
export function setVolume(percent) {
  volume = Math.max(0, Math.min(1, percent / 100));
  if (master) master.gain.value = volume;
}

function env(peak, attack, decay, at) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(master);
  return g;
}

function tone(type, f0, f1, peak, decay, delay = 0, attack = 0.004) {
  if (!ctx) return;
  const at = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, at);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + attack + decay);
  o.connect(env(peak, attack, decay, at));
  o.start(at);
  o.stop(at + attack + decay + 0.02);
}

function noise(filter, f0, f1, peak, decay, delay = 0, q = 0.8) {
  if (!ctx) return;
  const at = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, at);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), at + decay);
  s.connect(f).connect(env(peak, 0.002, decay, at));
  s.start(at, Math.random() * 0.3);
  s.stop(at + decay + 0.03);
}

export const sfx = {
  place(type) {
    const f = type === 'r' ? 150 : type === 'f' ? 125 : type === 'c' ? 175 : 105;
    tone('triangle', f * 2, f, 0.5, 0.09);
    noise('bandpass', 900, 400, 0.22, 0.05);
  },
  enemyPlace() { tone('square', 150, 95, 0.16, 0.1); noise('bandpass', 700, 300, 0.2, 0.06); },
  breakPiece() { noise('lowpass', 2600, 300, 0.5, 0.22); tone('triangle', 190, 60, 0.3, 0.16); },
  collapse() { noise('lowpass', 1500, 200, 0.28, 0.18); },
  hitPiece() { noise('bandpass', 1500, 700, 0.16, 0.05, 0, 2); },
  editOpen() { tone('sine', 520, 780, 0.18, 0.07); },
  editTile(on) { tone('sine', on ? 880 : 620, on ? 880 : 620, 0.14, 0.04); },
  editConfirm() { tone('triangle', 700, 1050, 0.22, 0.08); tone('triangle', 1050, 1400, 0.16, 0.08, 0.05); },
  editReset() { tone('sine', 700, 420, 0.18, 0.09); },
  turn() { tone('triangle', 300, 420, 0.22, 0.07); },
  swing() { noise('bandpass', 500, 1500, 0.12, 0.13, 0.04, 1.2); },
  pickHit(dull) { noise('bandpass', dull ? 500 : 1100, dull ? 250 : 500, 0.4, 0.07, 0, 1.5); tone('triangle', dull ? 120 : 240, dull ? 70 : 110, 0.35, 0.08); },
  aim(on) { noise('bandpass', on ? 1800 : 1300, on ? 2400 : 900, 0.05, 0.05, 0, 2); },
  deny() { tone('square', 150, 120, 0.12, 0.09); },
  shotgun() {
    noise('lowpass', 3200, 250, 0.9, 0.24);
    tone('sawtooth', 150, 45, 0.55, 0.18);
    noise('highpass', 3000, 3000, 0.18, 0.05);
  },
  pump() { noise('bandpass', 1300, 800, 0.16, 0.05, 0.3, 3); noise('bandpass', 1700, 1000, 0.16, 0.05, 0.42, 3); },
  rifle() { noise('lowpass', 4200, 500, 0.6, 0.12); tone('square', 210, 70, 0.3, 0.09); },
  smg() { noise('lowpass', 5200, 900, 0.42, 0.07); tone('square', 320, 120, 0.2, 0.05); },
  dry() { tone('square', 900, 700, 0.07, 0.025); },
  reload() { noise('bandpass', 1900, 1200, 0.16, 0.04, 0, 3); noise('bandpass', 1100, 800, 0.2, 0.06, 0.18, 3); },
  reloadDone() { noise('bandpass', 2300, 1500, 0.2, 0.04, 0, 3); tone('sine', 1300, 1300, 0.06, 0.04); },
  swap() { noise('bandpass', 1500, 900, 0.1, 0.05, 0, 2); },
  hit() { tone('sine', 1250, 1250, 0.16, 0.05); },
  head() { tone('sine', 1900, 1900, 0.2, 0.07); tone('sine', 2850, 2850, 0.1, 0.09, 0.02); },
  down() { tone('triangle', 620, 930, 0.22, 0.1); tone('triangle', 930, 1400, 0.22, 0.14, 0.08); },
  mantle() { noise('lowpass', 700, 300, 0.14, 0.14); noise('bandpass', 1400, 900, 0.07, 0.05, 0.12, 2); },
  jump() { noise('lowpass', 500, 900, 0.07, 0.08); },
  land() { noise('lowpass', 420, 150, 0.16, 0.09); },
  reset() { tone('sine', 440, 660, 0.14, 0.1); tone('sine', 660, 880, 0.12, 0.1, 0.07); },
  ui() { tone('sine', 700, 700, 0.1, 0.04); },
};
