// Persistence: one JSON settings object + the QR secret, all in localStorage.

const SETTINGS_KEY = 'wakeup.settings';
const QR_KEY = 'wakeup.qrSecret';
const ARMED_KEY = 'wakeup.armedFireAt';

export const DEFAULTS = {
  time: '06:30',
  repeatDaily: true,
  chain: ['math', 'qr'],
  math: { count: 3, difficulty: 2 },
  typing: { difficulty: 2 },
  abandonTimeout: 60,     // seconds without input before the alarm resumes
  recheckEnabled: true,
  recheckDelay: 5,        // minutes after finishing the chain
  rampSeconds: 30,
  startVolume: 0.2,
};

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
function remove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function loadSettings() {
  const saved = read(SETTINGS_KEY) || {};
  return {
    ...DEFAULTS,
    ...saved,
    math: { ...DEFAULTS.math, ...(saved.math || {}) },
    typing: { ...DEFAULTS.typing, ...(saved.typing || {}) },
    chain: Array.isArray(saved.chain) ? saved.chain : DEFAULTS.chain,
  };
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

export function getQrSecret() {
  return read(QR_KEY);
}

export function setQrSecret(secret) {
  write(QR_KEY, secret);
}

export function randomSecret(length = 16) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

// Remember an armed alarm across reloads so the home screen can warn the user.
export function getArmedFireAt() { return read(ARMED_KEY); }
export function setArmedFireAt(ts) { ts ? write(ARMED_KEY, ts) : remove(ARMED_KEY); }
