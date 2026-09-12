// App coordinator: alarm state machine, screen routing, settings UI.
//
// Alarm lifecycle (`state`):
//   IDLE → ARMED → RINGING → CHALLENGE → RECHECK_WAIT → RECHECK_PROMPT → DONE
// Settings / QR setup / practice runs are just screens layered over IDLE.

import * as store from './storage.js';
import * as alarm from './alarm.js';
import { challenges, CHALLENGE_IDS } from './challenges/index.js';
import { QR_PREFIX } from './challenges/qr.js';
import { mountRecheckPrompt, unmountRecheckPrompt } from './recheck.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const RECHECK_ANSWER_MS = 60_000;
const TEST_ALARM_MS = 10_000;
const DISARM_HOLD_MS = 3_000;

const SCREENS = {
  IDLE: 'screen-home',
  ARMED: 'screen-armed',
  RINGING: 'screen-ringing',
  CHALLENGE: 'screen-challenge',
  RECHECK_WAIT: 'screen-recheck-wait',
  RECHECK_PROMPT: 'screen-recheck-prompt',
  DONE: 'screen-done',
  SETTINGS: 'screen-settings',
  QR_SETUP: 'screen-qr-setup',
};

let settings = store.loadSettings();
let state = 'IDLE';
let screen = 'IDLE';
let fireAt = null;          // ms timestamp the alarm rings
let isTest = false;         // fired from "Test alarm" → don't auto re-arm afterwards
let chain = [];             // challenge ids for this run
let chainIndex = 0;
let active = null;          // mounted challenge module
let practiceId = null;      // challenge being tried from settings
let lastActivity = 0;
let recheckAt = null;
let promptDeadline = null;

// ── helpers ─────────────────────────────────────────────────────────────

function showScreen(name) {
  screen = name;
  for (const [key, id] of Object.entries(SCREENS)) {
    document.getElementById(id).hidden = key !== name;
  }
}

function setState(next) {
  state = next;
  showScreen(next);
  tick();
}

let toastTimer = null;
function toast(msg, ms = 3000) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

function effectiveChain() {
  const ids = settings.chain.filter(id => CHALLENGE_IDS.includes(id));
  return ids.length ? ids : ['math'];
}

function chainLabel() {
  return effectiveChain().map(id => challenges[id].label).join(' → ');
}

function unmountActive() {
  if (active) { active.unmount(); active = null; }
  $('#challenge-container').innerHTML = '';
}

// ── arming ──────────────────────────────────────────────────────────────

async function arm({ test = false } = {}) {
  if (!test) {
    const time = $('#home-time').value;
    if (!time) { toast('Pick an alarm time first'); return; }
    settings.time = time;
    store.saveSettings(settings);
  }
  if (effectiveChain().includes('qr') && !store.getQrSecret()) {
    toast('Set up your QR code first (Settings → QR code)', 4000);
    return;
  }
  const soundOk = await alarm.unlockAudio();
  if (!soundOk) toast('Sound could not be enabled – tap Arm again', 4000);

  isTest = test;
  fireAt = test ? Date.now() + TEST_ALARM_MS : alarm.nextFireAt(settings.time);
  if (!test) store.setArmedFireAt(fireAt);
  chainIndex = 0;
  chain = effectiveChain();

  const lock = await alarm.requestWakeLock();
  if (!lock) toast('Screen may turn off – disable auto-lock tonight', 4000);

  $('#armed-time').textContent = alarm.formatTime(fireAt);
  $('#armed-time-2').textContent = alarm.formatTime(fireAt);
  $('#armed-controls').hidden = true;
  setState('ARMED');
}

function disarm() {
  fireAt = null;
  store.setArmedFireAt(null);
  alarm.releaseWakeLock();
  setState('IDLE');
  toast('Alarm disarmed');
}

// ── ringing & challenges ────────────────────────────────────────────────

function ring({ escalate = false, note = '' } = {}) {
  unmountActive();
  unmountRecheckPrompt();
  alarm.startSiren({
    volume: escalate ? 1 : settings.startVolume,
    rampSeconds: escalate ? 0 : settings.rampSeconds,
  });
  $('#ringing-note').textContent = note;
  setState('RINGING');
}

function startChallenges() {
  alarm.stopSiren();
  lastActivity = Date.now(); // before setState, which ticks immediately
  setState('CHALLENGE');
  mountChallenge();
}

function mountChallenge() {
  unmountActive();
  const id = chain[chainIndex];
  const ch = challenges[id];
  $('#challenge-step').textContent = `Step ${chainIndex + 1} of ${chain.length} · ${ch.label}`;
  $('#challenge-abandon').hidden = false;
  $('#challenge-exit').hidden = true;
  lastActivity = Date.now();
  active = ch;
  ch.mount($('#challenge-container'), settings, {
    onPass: () => { if (active === ch) challengePassed(); },
    onActivity: () => { lastActivity = Date.now(); },
  });
}

function challengePassed() {
  unmountActive();
  if (practiceId) {
    practiceId = null;
    toast('Passed ✔');
    showScreen('SETTINGS');
    return;
  }
  chainIndex++;
  if (chainIndex < chain.length) {
    mountChallenge();
  } else if (settings.recheckEnabled) {
    recheckAt = Date.now() + settings.recheckDelay * 60_000;
    setState('RECHECK_WAIT');
  } else {
    finish();
  }
}

function startRecheckPrompt() {
  alarm.playChime();
  promptDeadline = Date.now() + RECHECK_ANSWER_MS;
  setState('RECHECK_PROMPT');
  mountRecheckPrompt($('#recheck-container'), {
    onPass: () => { unmountRecheckPrompt(); finish(); },
    onActivity: () => {},
  });
}

function finish() {
  alarm.stopSiren();
  unmountActive();
  unmountRecheckPrompt();
  store.setArmedFireAt(null);
  chainIndex = 0;

  if (settings.repeatDaily && !isTest) {
    fireAt = alarm.nextFireAt(settings.time);
    store.setArmedFireAt(fireAt);
    $('#done-note').textContent = `You're up. Alarm re-armed for ${alarm.formatTime(fireAt)} – keep the app open tonight.`;
  } else {
    fireAt = null;
    $('#done-note').textContent = isTest ? 'Test complete.' : "You're up. Arm the alarm again tonight.";
  }
  setState('DONE');
}

function doneOk() {
  if (fireAt) {
    $('#armed-time').textContent = alarm.formatTime(fireAt);
    $('#armed-time-2').textContent = alarm.formatTime(fireAt);
    $('#armed-controls').hidden = true;
    setState('ARMED');
  } else {
    alarm.releaseWakeLock();
    setState('IDLE');
  }
}

// ── practice from settings ──────────────────────────────────────────────

function tryChallenge(id) {
  if (id === 'qr' && !store.getQrSecret()) { openQrSetup(); return; }
  practiceId = id;
  chain = [id];
  chainIndex = 0;
  showScreen('CHALLENGE');
  unmountActive();
  const ch = challenges[id];
  $('#challenge-step').textContent = `Practice · ${ch.label}`;
  $('#challenge-abandon').hidden = true;
  $('#challenge-exit').hidden = false;
  active = ch;
  ch.mount($('#challenge-container'), settings, {
    onPass: () => { if (active === ch) challengePassed(); },
    onActivity: () => {},
  });
}

// ── tick ────────────────────────────────────────────────────────────────

function updateClocks(now) {
  const text = alarm.formatTime(now);
  for (const el of $$('[data-clock]')) if (el.textContent !== text) el.textContent = text;
}

function tick() {
  const now = Date.now();
  updateClocks(now);

  switch (state) {
    case 'ARMED':
      if (now >= fireAt) ring();
      break;

    case 'CHALLENGE': {
      if (practiceId) break;
      const left = settings.abandonTimeout * 1000 - (now - lastActivity);
      const pill = $('#challenge-abandon');
      pill.textContent = `⏱ ${alarm.formatCountdown(left)}`;
      pill.classList.toggle('urgent', left < 10_000);
      if (left <= 0) ring({ escalate: true, note: 'You stopped. Alarm resumed at full volume.' });
      break;
    }

    case 'RECHECK_WAIT':
      $('#recheck-countdown').textContent = alarm.formatCountdown(recheckAt - now);
      if (now >= recheckAt) startRecheckPrompt();
      break;

    case 'RECHECK_PROMPT': {
      const left = promptDeadline - now;
      const pill = $('#recheck-deadline');
      pill.textContent = `⏱ ${alarm.formatCountdown(left)}`;
      pill.classList.toggle('urgent', left < 10_000);
      if (left <= 0) {
        chainIndex = 0;
        ring({ escalate: true, note: 'Re-check missed. Back to the start.' });
      }
      break;
    }
  }
}

// ── settings UI ─────────────────────────────────────────────────────────

const form = () => $('#settings-form');

function fillSettingsForm() {
  const f = form();
  const chainOptions = ['<option value="">— none —</option>']
    .concat(CHALLENGE_IDS.map(id => `<option value="${id}">${challenges[id].label}</option>`))
    .join('');
  for (let i = 0; i < 3; i++) {
    const sel = f.elements[`chain${i}`];
    sel.innerHTML = chainOptions;
    sel.value = settings.chain[i] || '';
  }
  f.elements.mathCount.value = settings.math.count;
  f.elements.mathDifficulty.value = settings.math.difficulty;
  f.elements.typingDifficulty.value = settings.typing.difficulty;
  f.elements.abandonTimeout.value = settings.abandonTimeout;
  f.elements.recheckEnabled.checked = settings.recheckEnabled;
  f.elements.recheckDelay.value = settings.recheckDelay;
  f.elements.startVolume.value = settings.startVolume;
  f.elements.rampSeconds.value = settings.rampSeconds;
  f.elements.repeatDaily.checked = settings.repeatDaily;
}

function readSettingsForm() {
  const f = form();
  const num = (name, fallback) => { const v = Number(f.elements[name].value); return Number.isFinite(v) && f.elements[name].value !== '' ? v : fallback; };
  settings = {
    ...settings,
    chain: [0, 1, 2].map(i => f.elements[`chain${i}`].value).filter(Boolean),
    math: { count: num('mathCount', 3), difficulty: num('mathDifficulty', 2) },
    typing: { difficulty: num('typingDifficulty', 2) },
    abandonTimeout: num('abandonTimeout', 60),
    recheckEnabled: f.elements.recheckEnabled.checked,
    recheckDelay: num('recheckDelay', 5),
    startVolume: num('startVolume', 0.2),
    rampSeconds: num('rampSeconds', 30),
    repeatDaily: f.elements.repeatDaily.checked,
  };
  store.saveSettings(settings);
  $('#home-chain').textContent = chainLabel();
}

// ── QR setup ────────────────────────────────────────────────────────────

function drawQr(secret) {
  const holder = $('#qr-holder');
  holder.innerHTML = '';
  const code = window.qrcode(0, 'M');
  code.addData(QR_PREFIX + secret);
  code.make();
  const n = code.getModuleCount();
  const scale = 8, margin = 4;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = (n + margin * 2) * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (code.isDark(r, c)) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
    }
  }
  holder.appendChild(canvas);
  $('#qr-secret').textContent = secret;
  return canvas;
}

function openQrSetup() {
  let secret = store.getQrSecret();
  if (!secret) { secret = store.randomSecret(); store.setQrSecret(secret); }
  drawQr(secret);
  showScreen('QR_SETUP');
}

function saveQrImage() {
  const canvas = $('#qr-holder canvas');
  if (!canvas) return;
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wakeup-qr.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

// ── wiring ──────────────────────────────────────────────────────────────

function onAction(action, target) {
  switch (action) {
    case 'arm': arm(); break;
    case 'disarm': break; // handled by press-and-hold below
    case 'start-challenges': startChallenges(); break;
    case 'done-ok': doneOk(); break;
    case 'settings': fillSettingsForm(); showScreen('SETTINGS'); break;
    case 'back': showScreen('IDLE'); break;
    case 'qr-setup': openQrSetup(); break;
    case 'qr-print': window.print(); break;
    case 'qr-save': saveQrImage(); break;
    case 'qr-regenerate':
      if (confirm('Generate a new code? The old printout will stop working.')) {
        const s = store.randomSecret();
        store.setQrSecret(s);
        drawQr(s);
      }
      break;
    case 'test-alarm':
      showScreen('IDLE');
      arm({ test: true }).then(() => { if (state === 'ARMED') toast('Test alarm rings in 10 seconds'); });
      break;
    case 'try': tryChallenge(target.dataset.challenge); break;
    case 'practice-exit': practiceId = null; unmountActive(); showScreen('SETTINGS'); break;
  }
}

function setupDisarmHold() {
  const btn = $('[data-action="disarm"]');
  const label = btn.textContent;
  let timer = null;
  let started = 0;
  let raf = null;
  const reset = () => {
    clearTimeout(timer); timer = null;
    cancelAnimationFrame(raf);
    btn.textContent = label;
    btn.style.background = '';
  };
  const progress = () => {
    const pct = Math.min(100, ((Date.now() - started) / DISARM_HOLD_MS) * 100);
    btn.style.background = `linear-gradient(90deg, rgba(255,77,77,.35) ${pct}%, transparent ${pct}%)`;
    raf = requestAnimationFrame(progress);
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    started = Date.now();
    btn.textContent = 'Keep holding…';
    progress();
    timer = setTimeout(() => { reset(); disarm(); }, DISARM_HOLD_MS);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, reset);
}

function init() {
  // Home screen
  $('#home-time').value = settings.time;
  $('#home-time').addEventListener('change', (e) => {
    if (e.target.value) { settings.time = e.target.value; store.saveSettings(settings); }
  });
  $('#home-chain').textContent = chainLabel();

  const previous = store.getArmedFireAt();
  if (previous && previous > Date.now()) {
    const notice = $('#home-notice');
    notice.textContent = `An alarm for ${alarm.formatTime(previous)} was armed before this page reloaded. Tap Arm to re-activate it.`;
    notice.hidden = false;
  } else if (previous) {
    store.setArmedFireAt(null);
  }

  // Delegated button actions
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) onAction(btn.dataset.action, btn);
  });
  setupDisarmHold();

  // Dim screen: tap to reveal controls for a few seconds
  let hideControls = null;
  $('#screen-armed').addEventListener('click', (e) => {
    if (e.target.closest('#armed-controls')) return;
    $('#armed-controls').hidden = false;
    clearTimeout(hideControls);
    hideControls = setTimeout(() => { $('#armed-controls').hidden = true; }, 6000);
  });

  // Settings save on every change
  form().addEventListener('input', readSettingsForm);
  form().addEventListener('change', readSettingsForm);
  form().addEventListener('submit', (e) => e.preventDefault());

  // Any interaction on the challenge screen counts as activity
  for (const ev of ['pointerdown', 'keydown']) {
    $('#screen-challenge').addEventListener(ev, () => { lastActivity = Date.now(); });
  }

  // Keep the wake lock and the clock honest when the tab comes back
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (state !== 'IDLE') alarm.requestWakeLock();
      tick();
    }
  });
  window.addEventListener('focus', tick);

  window.addEventListener('beforeunload', (e) => {
    if (state !== 'IDLE') { e.preventDefault(); e.returnValue = ''; }
  });

  setInterval(tick, 500);
  tick();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }
}

init();
