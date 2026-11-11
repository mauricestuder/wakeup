// Actions and what they are bound to. A bind is a physical key
// (KeyboardEvent.code), a mouse button (Mouse0..Mouse4) or the wheel
// (WheelUp / WheelDown). Everything can be rebound and is saved on the device.

const KEY = 'highground.binds';

// ctx: an action that only means something in one mode may share its key with
// an action of another mode (right mouse aims with a gun and resets an edit).
export const ACTIONS = [
  { id: 'forward', label: 'Move forward', def: 'KeyW', g: 'Movement' },
  { id: 'back', label: 'Move back', def: 'KeyS' },
  { id: 'left', label: 'Move left', def: 'KeyA' },
  { id: 'right', label: 'Move right', def: 'KeyD' },
  { id: 'jump', label: 'Jump', def: 'Space' },
  { id: 'sprint', label: 'Sprint (hold)', def: 'ShiftLeft' },
  { id: 'crouch', label: 'Crouch', def: 'KeyX' },
  { id: 'fire', label: 'Shoot / swing / place / select', def: 'Mouse0', g: 'Actions' },
  { id: 'aim', label: 'Aim (zoom in)', def: 'Mouse2', ctx: 'gun' },
  { id: 'reload', label: 'Reload', def: 'KeyR' },
  { id: 'pick', label: 'Pickaxe', def: 'Digit1', g: 'Tools' },
  { id: 'gun1', label: 'Breaker (shotgun)', def: 'Digit2' },
  { id: 'gun2', label: 'Ranger (rifle)', def: 'Digit3' },
  { id: 'gun3', label: 'Hornet (SMG)', def: 'Digit4' },
  { id: 'wall', label: 'Wall', def: 'KeyQ', g: 'Building' },
  { id: 'floor', label: 'Floor', def: 'KeyC' },
  { id: 'ramp', label: 'Ramp', def: 'KeyE' },
  { id: 'roof', label: 'Roof', def: 'KeyV' },
  { id: 'edit', label: 'Edit / confirm', def: 'KeyF', g: 'Editing' },
  { id: 'editReset', label: 'Reset tiles while editing', def: 'Mouse2', ctx: 'edit' },
  { id: 'quickReset', label: 'Reset piece in one press', def: 'WheelDown' },
  { id: 'resetArena', label: 'Reset arena', def: 'KeyT', g: 'Other' },
];
let group = '';
for (const a of ACTIONS) { if (a.g) group = a.g; else a.g = group; }

// Keys the game keeps for itself.
const RESERVED = new Set(['Escape', 'MetaLeft', 'MetaRight', 'F5', 'F11', 'F12']);

const byId = new Map(ACTIONS.map((a) => [a.id, a]));
// Other actions that would fire together with `id` if it sat on `code`.
function clashes(id, code) {
  const a = byId.get(id), out = [];
  if (!code) return out;
  for (const o of ACTIONS) {
    if (o.id !== id && binds[o.id] === code && (!a.ctx || !o.ctx || a.ctx === o.ctx)) out.push(o.id);
  }
  return out;
}

export const binds = {};
for (const a of ACTIONS) binds[a.id] = a.def;
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved && typeof saved === 'object') {
    for (const a of ACTIONS) binds[a.id] = typeof saved[a.id] === 'string' ? saved[a.id] : '';
    // Actions that are newer than the saved keys take their usual key, or the next free one.
    const spare = ['KeyX', 'KeyZ', 'KeyG', 'KeyB', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
    for (const a of ACTIONS) {
      if (typeof saved[a.id] === 'string') continue;
      binds[a.id] = [a.def, ...spare].find((code) => !clashes(a.id, code).length) || '';
    }
  }
} catch { /* first visit or private mode */ }

let byCode = new Map();
function index() {
  byCode = new Map();
  for (const a of ACTIONS) {
    const code = binds[a.id];
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(a.id);
  }
}
index();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(binds)); } catch { /* private mode */ }
}

// Whatever had this key before gets the old key of the action, so that as
// good as nothing is ever left without a bind.
export function setBind(id, code) {
  if (RESERVED.has(code) || !(id in binds)) return false;
  const old = binds[id], others = clashes(id, code);
  binds[id] = code;
  for (const o of others) binds[o] = clashes(o, old).length ? '' : old;
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
  const ids = byCode.get(code);
  if (!ids) return false;
  for (const id of ids) {
    if (repeat || held.has(id)) continue;
    held.add(id);
    handlers.press?.(id);
  }
  return true;
}
export function release(code) {
  const ids = byCode.get(code);
  if (!ids) return false;
  let any = false;
  for (const id of ids) {
    if (!held.delete(id)) continue;
    handlers.release?.(id);
    any = true;
  }
  return any;
}
// The wheel has no "up" event, so it is a press and a release in one.
export function tap(code) {
  const ids = byCode.get(code);
  if (!ids) return false;
  for (const id of ids) { handlers.press?.(id); handlers.release?.(id); }
  return true;
}

// For the "press a key" prompt in the settings.
export function codeOfEvent(e) {
  if (e.type === 'keydown') return e.code;
  if (e.type === 'mousedown') return 'Mouse' + e.button;
  if (e.type === 'wheel') return e.deltaY < 0 ? 'WheelUp' : 'WheelDown';
  return '';
}
