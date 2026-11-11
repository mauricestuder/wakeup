// Options, and the three settings pages: Game, Controls and the Feel lab.

import { DEFS, T, setTune, resetTuning, changed } from './tuning.js';
import { ACTIONS, binds, setBind, resetBinds, codeLabel, codeOfEvent, whenLabelsChange } from './input.js';

const KEY = 'highground.settings';

export const OPTIONS = [
  { k: 'sens', label: 'Mouse sensitivity', min: 0.1, max: 4, step: 0.05, v: 1 },
  { k: 'buildSens', label: 'While building', unit: '×', min: 0.3, max: 2, step: 0.05, v: 1 },
  { k: 'editSens', label: 'While editing', unit: '×', min: 0.3, max: 2, step: 0.05, v: 1 },
  { k: 'aimSens', label: 'While aiming', unit: '×', min: 0.3, max: 2, step: 0.05, v: 1 },
  { k: 'invertY', label: 'Invert up / down', choices: [[false, 'Off'], [true, 'On']], v: false },
  { k: 'editRelease', label: 'Edit on release', choices: [[false, 'Off'], [true, 'On']], v: false },
  { k: 'fov', label: 'Field of view', unit: '°', min: 60, max: 110, step: 1, v: 80 },
  { k: 'camDist', label: 'Camera distance', unit: ' m', min: 1.5, max: 5, step: 0.1, v: 2.8 },
  { k: 'glass', label: 'See-through builds', unit: '%', min: 0, max: 85, step: 5, v: 55 },
  { k: 'volume', label: 'Volume', unit: '%', min: 0, max: 100, step: 5, v: 70 },
  { k: 'rebuild', label: 'Enemy puts broken walls back', choices: [['off', 'Off'], ['slow', 'Slow'], ['fast', 'Fast']], v: 'fast' },
  { k: 'hints', label: 'Key hints on screen', choices: [[false, 'Off'], [true, 'On']], v: true },
];

const VERSION = 2, OLD_DEFAULTS = { camDist: [3.2, 3.4] };

export const settings = {};
for (const o of OPTIONS) settings[o.k] = o.v;
try {
  const saved = JSON.parse(localStorage.getItem(KEY)) || {};
  for (const o of OPTIONS) {
    const v = saved[o.k];
    // a value that was only ever the old default moves along with the new default
    if ((saved.v || 1) < VERSION && OLD_DEFAULTS[o.k]?.includes(v)) continue;
    if (o.choices) { if (o.choices.some((c) => c[0] === v)) settings[o.k] = v; }
    else if (typeof v === 'number' && isFinite(v)) settings[o.k] = Math.min(o.max, Math.max(o.min, v));
  }
} catch { /* first visit or private mode */ }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...settings, v: VERSION })); } catch { /* private mode */ }
}

// Radians per pixel of mouse movement.
export function lookSpeed(mode) {
  const m = mode === 'build' ? settings.buildSens : mode === 'edit' ? settings.editSens : 1;
  return 0.0022 * settings.sens * m;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function fmt(v, step) {
  const d = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return v.toFixed(d);
}

function slider(o, get, set) {
  const row = el('label', 'row');
  row.append(el('span', 'name', o.label));
  const input = el('input');
  input.type = 'range';
  input.min = o.min; input.max = o.max; input.step = o.step;
  const val = el('span', 'val');
  const show = () => {
    input.value = get();
    val.textContent = fmt(get(), o.step) + (o.unit || '');
    row.classList.toggle('changed', get() !== o.v);
  };
  input.addEventListener('input', () => { set(parseFloat(input.value)); show(); });
  row.append(input, val);
  show();
  row.refresh = show;
  return row;
}

function choice(o, onChange) {
  const row = el('div', 'row');
  row.append(el('span', 'name', o.label));
  const box = el('span', 'choices');
  const btns = o.choices.map(([v, text]) => {
    const b = el('button', 'chip', text);
    b.type = 'button';
    b.addEventListener('click', () => { settings[o.k] = v; save(); show(); onChange(); });
    box.append(b);
    return [v, b];
  });
  const show = () => { for (const [v, b] of btns) b.classList.toggle('on', settings[o.k] === v); };
  row.append(box);
  show();
  return row;
}

export function initSettingsUI(root, onChange) {
  const tabs = el('div', 'tabs');
  const pages = {};
  const names = [['game', 'Game'], ['controls', 'Controls'], ['feel', 'Feel lab']];
  const open = (id) => {
    for (const [k] of names) { pages[k].hidden = k !== id; tabBtns[k].classList.toggle('on', k === id); }
  };
  const tabBtns = {};
  for (const [id, text] of names) {
    const b = el('button', 'tab', text);
    b.type = 'button';
    b.addEventListener('click', () => open(id));
    tabs.append(b);
    tabBtns[id] = b;
    pages[id] = el('div', 'page');
  }
  root.append(tabs, pages.game, pages.controls, pages.feel);

  // ----- Game -----
  for (const o of OPTIONS) {
    pages.game.append(o.choices ? choice(o, onChange)
      : slider(o, () => settings[o.k], (v) => { settings[o.k] = v; save(); onChange(); }));
  }

  // ----- Controls -----
  let listening = null;   // { id, btn }
  const bindBtns = {};
  const showBinds = () => { for (const a of ACTIONS) bindBtns[a.id].textContent = codeLabel(binds[a.id]); };
  let g = '';
  for (const a of ACTIONS) {
    if (a.g !== g) { g = a.g; pages.controls.append(el('h3', '', g)); }
    const row = el('div', 'row');
    row.append(el('span', 'name', a.label));
    const b = el('button', 'bind');
    b.type = 'button';
    b.addEventListener('click', (e) => {
      if (listening) return;
      e.stopPropagation();
      listening = { id: a.id, btn: b };
      b.textContent = 'press a key…';
      b.classList.add('wait');
    });
    bindBtns[a.id] = b;
    row.append(b);
    pages.controls.append(row);
  }
  const capture = (e) => {
    if (!listening) return;
    e.preventDefault();
    e.stopPropagation();
    const code = codeOfEvent(e);
    if (code && code !== 'Escape') setBind(listening.id, code);
    listening.btn.classList.remove('wait');
    listening = null;
    showBinds();
    onChange();
  };
  addEventListener('keydown', capture, true);
  addEventListener('mousedown', capture, true);
  addEventListener('wheel', capture, { capture: true, passive: false });
  const resetB = el('button', 'btn small', 'Default controls');
  resetB.type = 'button';
  resetB.addEventListener('click', () => { resetBinds(); showBinds(); onChange(); });
  pages.controls.append(el('p', 'note', 'Click a key, then press the new key, mouse button or wheel. Esc cancels.'), resetB);
  showBinds();
  whenLabelsChange(() => { showBinds(); onChange(); });

  // ----- Feel lab -----
  pages.feel.append(el('p', 'note',
    'Every number behind how the game feels. Changes apply at once and are saved on this device. ' +
    'Happy with your values? Copy them and send them over, then they can become the defaults.'));
  const bar = el('div', 'bar');
  const copyB = el('button', 'btn small', 'Copy my values');
  const defB = el('button', 'btn small', 'Back to defaults');
  copyB.type = defB.type = 'button';
  bar.append(copyB, defB);
  pages.feel.append(bar);
  const rows = [];
  g = '';
  for (const d of DEFS) {
    if (d.g !== g) { g = d.g; pages.feel.append(el('h3', '', g)); }
    const row = slider(d, () => T[d.k], (v) => { setTune(d.k, v); onChange(); });
    rows.push(row);
    pages.feel.append(row);
  }
  defB.addEventListener('click', () => { resetTuning(); for (const r of rows) r.refresh(); onChange(); });
  copyB.addEventListener('click', async () => {
    const text = JSON.stringify(changed(), null, 1);
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { /* no clipboard access */ }
    copyB.textContent = ok ? 'Copied!' : 'Could not copy';
    setTimeout(() => { copyB.textContent = 'Copy my values'; }, 1500);
  });

  open('game');
  return { isListening: () => !!listening };
}
