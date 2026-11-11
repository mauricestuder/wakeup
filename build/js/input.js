// Actions and what they are bound to. A bind is a physical key
// (KeyboardEvent.code), a mouse button (Mouse0..Mouse4) or the wheel
// (WheelUp / WheelDown). Everything can be rebound and is saved on the device.

const KEY = 'highground.binds';

export const ACTIONS = [
  { id: 'forward', label: 'Move forward', def: 'KeyW', g: 'Movement' },
  { id: 'back', label: 'Move back', def: 'KeyS' },
  { id: 'left', label: 'Move left', def: 'KeyA' },
  { id: 'right', label: 'Move right', def: 'KeyD' },
  { id: 'jump', label: 'Jump', def: 'Space' },
  { id: 'crouch', label: 'Crouch', def: 'ShiftLeft' },
  { id: 'fire', label: 'Shoot / place / select', def: 'Mouse0', g: 'Actions' },
  { id: 'reload', label: 'Reload', def: 'KeyR' },
  { id: 'gun1', label: 'Breaker (shotgun)', def: 'Digit1', g: 'Guns' },
  { id: 'gun2', label: 'Ranger (rifle)', def: 'Digit2' },
  { id: 'gun3', label: 'Hornet (SMG)', def: 'Digit3' },
  { id: 'wall', label: 'Wall', def: 'KeyQ', g: 'Building' },
  { id: 'floor', label: 'Floor', def: 'KeyC' },
  { id: 'ramp', label: 'Ramp', def: 'KeyE' },
  { id: 'roof', label: 'Roof', def: 'KeyV' },
  { id: 'edit', label: 'Edit / confirm', def: 'KeyF', g: 'Editing' },
  { id: 'editReset', label: 'Reset edit', def: 'Mouse2' },
  { id: 'resetArena', label: 'Reset arena', def: 'KeyT', g: 'Other' },
];
let group = '';
for (const a of ACTIONS) { if (a.g) group = a.g; else a.g = group; }

// Keys the game keeps for itself.
const RESERVED = new Set(['Escape', 'MetaLeft', 'MetaRight', 'F5', 'F11', 'F12']);

export const binds = {};
for (const a of ACTIONS) binds[a.id] = a.def;
try {
  const saved = JSON.parse(localStorage.getItem(KEY)) || {};
  for (const a of ACTIONS) if (typeof saved[a.id] === 'string') binds[a.id] = saved[a.id];
} catch { /* first visit or private mode */ }

let byCode = new Map();
function index() {
  byCode = new Map();
  for (const a of ACTIONS) if (binds[a.id]) byCode.set(binds[a.id], a.id);
}
index();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(binds)); } catch { /* private mode */ }
}

// Whatever had this key before gets the old key of the action, so nothing is
// ever left without a bind.
export function setBind(id, code) {
  if (RESERVED.has(code) || !(id in binds)) return false;
  const other = byCode.get(code);
  if (other && other !== id) binds[other] = binds[id];
  binds[id] = code;
  index();
  save();
  return true;
}

export function resetBinds() {
  for (const a of ACTIONS) binds[a.id] = a.def;
  index();
  save();
}

// ---------- labels ----------
let layout = null;
navigator.keyboard?.getLayoutMap?.().then((m) => { layout = m; onLabels?.(); }).catch(() => {});
let onLabels = null;
export function whenLabelsChange(fn) { onLabels = fn; }

const NAMES = { Space: 'Space', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl',
  AltLeft: 'L Alt', AltRight: 'R Alt', Tab: 'Tab', CapsLock: 'Caps', Enter: 'Enter', Backspace: 'Backspace',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5', WheelUp: 'Wheel ↑', WheelDown: 'Wheel ↓' };

export function codeLabel(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  const mapped = layout?.get(code);
  if (mapped) return mapped.length === 1 ? mapped.toUpperCase() : mapped;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
export function label(id) { return codeLabel(binds[id]); }

// ---------- state ----------
const held = new Set();      // actions that are down
export function down(id) { return held.has(id); }
export function releaseAll() { held.clear(); }

// The game sets these.
export const handlers = { press: null, release: null };

// Returns true when the code belongs to an action.
export function press(code, repeat = false) {
  const id = byCode.get(code);
  if (!id) return false;
  if (repeat || held.has(id)) return true;
  held.add(id);
  handlers.press?.(id);
  return true;
}
export function release(code) {
  const id = byCode.get(code);
  if (!id || !held.has(id)) return false;
  held.delete(id);
  handlers.release?.(id);
  return true;
}
// The wheel has no "up" event, so it is a press and a release in one.
export function tap(code) {
  const id = byCode.get(code);
  if (!id) return false;
  handlers.press?.(id);
  handlers.release?.(id);
  return true;
}

// For the "press a key" prompt in the settings.
export function codeOfEvent(e) {
  if (e.type === 'keydown') return e.code;
  if (e.type === 'mousedown') return 'Mouse' + e.button;
  if (e.type === 'wheel') return e.deltaY < 0 ? 'WheelUp' : 'WheelDown';
  return '';
}
