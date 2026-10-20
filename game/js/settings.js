// Player settings, saved in the browser so they stick between visits.

const KEY = 'cashout.settings';

export const OPTIONS = {
  quality: { label: 'Picture quality', values: [216, 288, 360, 480], names: ['Retro', 'Medium', 'High', 'Sharp'] },
  effects: { label: 'Retro effects', values: [true, false], names: ['On', 'Off'] },
  fov:     { label: 'Field of view', values: [65, 70, 75, 80, 85, 90, 95] },
  sens:    { label: 'Look speed', values: [0.4, 0.6, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3], names: v => v + 'x' },
  volume:  { label: 'Volume', values: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], names: v => Math.round(v * 100) + '%' },
};

const DEFAULTS = { quality: 360, effects: true, fov: 75, sens: 1, volume: 0.5 };

export const settings = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  for (const k in DEFAULTS) if (saved && OPTIONS[k].values.includes(saved[k])) settings[k] = saved[k];
} catch { /* private mode or blocked storage: use the defaults */ }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* not saved, still applied */ }
}

function valueName(k) {
  const o = OPTIONS[k], v = settings[k];
  if (Array.isArray(o.names)) return o.names[o.values.indexOf(v)];
  return o.names ? o.names(v) : String(v);
}

// Fill the settings screen with "‹ value ›" rows. `apply` runs after each change.
export function initSettingsUI(list, apply) {
  for (const k in OPTIONS) {
    const row = document.createElement('div');
    row.className = 'setRow';
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
