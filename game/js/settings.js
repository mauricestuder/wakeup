// Player settings, saved in the browser so they stick between visits.

const KEY = 'cashout.settings';

export const OPTIONS = {
  quality: { label: 'Picture quality', values: [216, 288, 360, 480], names: ['Retro', 'Medium', 'High', 'Sharp'] },
  effects: { label: 'Retro effects', values: [true, false], names: ['On', 'Off'] },
  fov:     { label: 'Field of view', values: [65, 70, 75, 80, 85, 90, 95] },
  look:    { label: 'Sensitivity', min: 1, max: 100, names: v => v + '%' },
  assist:  { label: 'Touch aim assist', values: [true, false], names: ['On', 'Off'] },
  volume:  { label: 'Volume', values: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], names: v => Math.round(v * 100) + '%' },
};

const DEFAULTS = { quality: 360, effects: true, fov: 75, look: 50, assist: true, volume: 0.5 };

export const settings = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  for (const k in DEFAULTS) if (saved && valid(k, saved[k])) settings[k] = saved[k];
  // Older saves kept look speed as a multiplier (0.4x to 3x) under "sens".
  if (saved && saved.look === undefined && saved.sens > 0) settings.look = clampPct(50 + 50 * Math.log(saved.sens) / Math.log(3));
} catch { /* private mode or blocked storage: use the defaults */ }

function valid(k, v) {
  const o = OPTIONS[k];
  return o.values ? o.values.includes(v) : Number.isInteger(v) && v >= o.min && v <= o.max;
}
function clampPct(v) { return Math.max(1, Math.min(100, Math.round(v))); }

// 50% is the normal speed; 1% is about a third of it and 100% three times it.
export function lookSpeed() { return 3 ** ((settings.look - 50) / 50); }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* not saved, still applied */ }
}

function valueName(k) {
  const o = OPTIONS[k], v = settings[k];
  if (Array.isArray(o.names)) return o.names[o.values.indexOf(v)];
  return o.names ? o.names(v) : String(v);
}

// Fill the settings screen with "‹ value ›" rows, or a slider for ranges. `apply` runs after each change.
export function initSettingsUI(list, apply) {
  for (const k in OPTIONS) {
    const row = document.createElement('div');
    row.className = 'setRow';
    if (!OPTIONS[k].values) {
      const o = OPTIONS[k];
      row.innerHTML = `<span>${o.label}</span><input type="range" min="${o.min}" max="${o.max}" step="1"><b></b>`;
      const input = row.querySelector('input'), out = row.querySelector('b');
      input.value = settings[k];
      input.setAttribute('aria-label', o.label);
      out.textContent = valueName(k);
      input.addEventListener('input', () => {
        settings[k] = Number(input.value);
        out.textContent = valueName(k);
        apply();
      });
      input.addEventListener('change', save);
      list.appendChild(row);
      continue;
    }
    row.innerHTML = `<span>${OPTIONS[k].label}</span><button class="arrow" data-d="-1">&lsaquo;</button><b></b><button class="arrow" data-d="1">&rsaquo;</button>`;
    const out = row.querySelector('b');
    out.textContent = valueName(k);
    for (const btn of row.querySelectorAll('button')) {
      btn.addEventListener('click', () => {
        const vals = OPTIONS[k].values;
        const i = Math.max(0, Math.min(vals.length - 1, vals.indexOf(settings[k]) + Number(btn.dataset.d)));
        settings[k] = vals[i];
        out.textContent = valueName(k);
        save();
        apply();
      });
    }
    list.appendChild(row);
  }
}
