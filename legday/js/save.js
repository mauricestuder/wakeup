// Settings and best rounds, kept in localStorage. Works without it too.

const KEY = 'leg-day-of-the-dead';
const DEFAULTS = { vol: 0.8, music: 0.5, auto: false, best: {}, seenTips: {} };

export const save = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* private mode or blocked storage */ }
  return structuredClone(DEFAULTS);
}

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

export function recordBest(mapId, diff, round) {
  const k = `${mapId}-${diff}`;
  if (!(save.best[k] >= round)) { save.best[k] = round; persist(); }
}
