// Synthesized sound effects and a cheesy hold-music loop. No audio files.

let ac = null, master = null, sfxGain = null, musicGain = null, noiseBuf = null;
let vol = 0.8, musicVol = 0.5;
const last = {};

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = vol; master.connect(ac.destination);
  sfxGain = ac.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
  musicGain = ac.createGain(); musicGain.gain.value = musicVol * 0.35; musicGain.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setVolume(v) { vol = v; if (master) master.gain.value = v; }
export function setMusicVolume(v) { musicVol = v; if (musicGain) musicGain.gain.value = v * 0.35; }

function throttle(name, ms) {
  const now = performance.now();
  if (last[name] && now - last[name] < ms) return true;
  last[name] = now;
  return false;
}

function tone(type, f0, f1, dur, g = 0.3, when = 0, dest = sfxGain) {
  const t = ac.currentTime + when;
  const o = ac.createOscillator(), a = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  a.gain.setValueAtTime(0.0001, t);
  a.gain.exponentialRampToValueAtTime(g, t + 0.008);
  a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(a); a.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, freq, q, g = 0.3, type = 'bandpass', when = 0, f1) {
  const t = ac.currentTime + when;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const a = ac.createGain();
  a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(a); a.connect(sfxGain);
  s.start(t); s.stop(t + dur + 0.02);
}

export function sfx(name) {
  if (!ac || ac.state !== 'running') return;
  switch (name) {
    case 'pop':
      if (throttle('pop', 35)) return;
      noise(0.08, 900 + Math.random() * 900, 1.2, 0.25);
      tone('sine', 500 + Math.random() * 300, 160, 0.08, 0.12);
      break;
    case 'throw': if (throttle('throw', 60)) return; tone('triangle', 260, 120, 0.06, 0.08); break;
    case 'spin': if (throttle('spin', 120)) return; noise(0.12, 2500, 2, 0.08, 'bandpass', 0, 800); break;
    case 'clang': if (throttle('clang', 90)) return; tone('square', 1300, 1250, 0.09, 0.06); tone('sine', 2600, 2500, 0.15, 0.05); break;
    case 'erupt': if (throttle('erupt', 90)) return; noise(0.35, 300, 0.8, 0.25, 'lowpass', 0, 90); tone('sine', 120, 50, 0.3, 0.2); break;
    case 'boom': if (throttle('boom', 70)) return; noise(0.3, 600, 0.7, 0.3, 'lowpass', 0, 80); break;
    case 'shot': if (throttle('shot', 50)) return; tone('square', 1800, 900, 0.05, 0.05); tone('sine', 2400, 2400, 0.04, 0.05, 0.03); break;
    case 'hold': tone('sine', 660, 660, 0.18, 0.12); tone('sine', 880, 880, 0.25, 0.1, 0.16); break;
    case 'press1': tone('sine', 697, 697, 0.12, 0.1); tone('sine', 1209, 1209, 0.12, 0.08); break;
    case 'place': tone('triangle', 180, 90, 0.12, 0.3); noise(0.06, 400, 1, 0.2); break;
    case 'upgrade': [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.12, 0.15, i * 0.06)); break;
    case 'sell': case 'cash': tone('square', 1568, 1568, 0.06, 0.06); tone('square', 2093, 2093, 0.18, 0.06, 0.07); break;
    case 'leak': // heavenly harp: they got away
      if (throttle('leak', 250)) return;
      [784, 988, 1175, 1568].forEach((f, i) => tone('sine', f, f, 0.4, 0.07, i * 0.05));
      break;
    case 'bossHit': if (throttle('bossHit', 80)) return; tone('sine', 140, 90, 0.08, 0.15); break;
    case 'bossPop': noise(0.8, 500, 0.6, 0.4, 'lowpass', 0, 60); tone('sawtooth', 220, 40, 0.8, 0.12); break;
    case 'roundStart': tone('sine', 1320, 1320, 0.5, 0.18); tone('sine', 990, 990, 0.7, 0.14, 0.18); break;
    case 'roundEnd': [392, 523, 659].forEach((f, i) => tone('triangle', f, f, 0.2, 0.14, i * 0.08)); break;
    case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.3, 0.18, i * 0.14)); break;
    case 'lose': [392, 370, 349, 330].forEach((f, i) => tone('sawtooth', f, f * (i === 3 ? 0.7 : 1), i === 3 ? 0.9 : 0.35, 0.1, i * 0.38)); break;
    case 'click': tone('triangle', 900, 700, 0.04, 0.1); break;
    case 'nope': tone('square', 160, 120, 0.15, 0.08); break;
  }
}

// ---------- hold music: cheesy elevator jazz on a loop ----------
const CHORDS = [
  [261.6, 329.6, 392.0, 493.9], // Cmaj7
  [220.0, 261.6, 329.6, 392.0], // Am7
  [293.7, 349.2, 440.0, 523.3], // Dm7
  [196.0, 246.9, 293.7, 349.2], // G7
];
const MELODY = [659, 784, 880, 784, 659, 587, 523, 587, 659, 0, 523, 440, 587, 659, 587, 494];
let musicOn = false, nextBeat = 0, beat = 0, timer = null;

export function startMusic() {
  if (!ac || musicOn) return;
  musicOn = true;
  nextBeat = ac.currentTime + 0.1;
  timer = setInterval(scheduleMusic, 100);
}
export function stopMusic() { musicOn = false; clearInterval(timer); }

function scheduleMusic() {
  if (!musicOn || !ac) return;
  const spb = 0.42;
  while (nextBeat < ac.currentTime + 0.4) {
    const bar = Math.floor(beat / 4) % 4, chord = CHORDS[bar];
    if (beat % 4 === 0) chord.forEach(f => tone('sine', f, f, spb * 3.6, 0.05, nextBeat - ac.currentTime, musicGain));
    if (beat % 2 === 0) tone('triangle', chord[0] / 2, chord[0] / 2, spb * 0.9, 0.12, nextBeat - ac.currentTime, musicGain);
    const m = MELODY[beat % 16];
    if (m) tone('sine', m, m * 0.995, spb * 0.8, 0.06, nextBeat - ac.currentTime, musicGain);
    nextBeat += spb;
    beat++;
  }
}
