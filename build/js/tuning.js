// Every "feel" number of the game lives here. The Feel lab in the settings
// changes them live and saves the changes in the browser.

const KEY = 'highground.tuning';

// g = group heading, k = name used in code, v = default value.
export const DEFS = [
  { g: 'Movement', k: 'runSpeed', label: 'Run speed', unit: 'm/s', min: 3, max: 9, step: 0.1, v: 5.6 },
  { k: 'crouchSpeed', label: 'Crouch speed', unit: 'm/s', min: 1, max: 6, step: 0.1, v: 3 },
  { k: 'groundAccel', label: 'Acceleration (higher = snappier start)', min: 4, max: 150, step: 1, v: 20 },
  { k: 'groundStop', label: 'Stopping power (higher = shorter slide)', min: 4, max: 150, step: 1, v: 18 },
  { k: 'grip', label: 'Turning grip', min: 2, max: 40, step: 1, v: 10 },
  { k: 'airControl', label: 'Air control', min: 0, max: 1, step: 0.05, v: 0.7 },
  { k: 'gravity', label: 'Gravity', min: 10, max: 45, step: 0.5, v: 26 },
  { k: 'jumpSpeed', label: 'Jump power', min: 5, max: 12, step: 0.1, v: 8.2 },
  { k: 'coyote', label: 'Late jump window', unit: 's', min: 0, max: 0.25, step: 0.01, v: 0.09 },
  { k: 'jumpBuffer', label: 'Early jump window', unit: 's', min: 0, max: 0.25, step: 0.01, v: 0.1 },

  { g: 'Camera', k: 'camRight', label: 'Shoulder offset (to the right)', unit: 'm', min: 0, max: 1.6, step: 0.05, v: 0.8 },
  { k: 'camUp', label: 'Camera height (above the head)', unit: 'm', min: -0.2, max: 1.2, step: 0.05, v: 0.4 },
  { k: 'aimDist', label: 'Camera distance while aiming', unit: 'm', min: 0.8, max: 3, step: 0.1, v: 1.7 },
  { k: 'aimSpread', label: 'Spread while aiming', unit: '×', min: 0.2, max: 1, step: 0.05, v: 0.55 },
  { k: 'camLift', label: 'Lift smoothing', unit: 's', min: 0, max: 0.2, step: 0.01, v: 0.07 },
  { k: 'recoil', label: 'Camera kick', min: 0, max: 3, step: 0.1, v: 1 },

  { g: 'Building', k: 'reachWall', label: 'Wall reach', unit: 'm', min: 3, max: 8, step: 0.25, v: 5 },
  { k: 'reachFloor', label: 'Floor reach', unit: 'm', min: 3, max: 8, step: 0.25, v: 5 },
  { k: 'rampFocus', label: 'Ramp / roof distance', unit: 'm', min: 0.5, max: 4, step: 0.1, v: 1.6 },
  { k: 'buildRepeat', label: 'Hold-to-build repeat', unit: 's', min: 0, max: 0.3, step: 0.01, v: 0.05 },
  { k: 'placePop', label: 'Pop-in time', unit: 's', min: 0, max: 0.25, step: 0.01, v: 0.07 },
  { k: 'pushOut', label: 'Push-out speed', unit: 'm/s', min: 2, max: 30, step: 1, v: 9 },
  { k: 'wallHp', label: 'Wall health', min: 50, max: 400, step: 10, v: 150 },
  { k: 'otherHp', label: 'Floor / ramp / roof health', min: 50, max: 400, step: 10, v: 140 },

  { g: 'Editing', k: 'editReach', label: 'Edit reach', unit: 'm', min: 3, max: 10, step: 0.25, v: 6 },

  { g: 'Pickaxe', k: 'pickDmg', label: 'Damage to builds', min: 10, max: 150, step: 5, v: 50 },
  { k: 'pickDummyDmg', label: 'Damage to dummies', min: 5, max: 100, step: 5, v: 20 },
  { k: 'pickRate', label: 'Swings per second', min: 1, max: 5, step: 0.1, v: 2.2 },
  { k: 'pickReach', label: 'Reach', unit: 'm', min: 1.5, max: 6, step: 0.25, v: 2.75 },

  { g: 'Breaker (shotgun)', k: 'brkZoom', label: 'Zoom while aiming', unit: '×', min: 1, max: 3, step: 0.05, v: 1.25 },
  { k: 'brkDmg', label: 'Damage per pellet', min: 4, max: 25, step: 1, v: 11 },
  { k: 'brkPellets', label: 'Pellets', min: 1, max: 14, step: 1, v: 9 },
  { k: 'brkDelay', label: 'Time between shots', unit: 's', min: 0.2, max: 1.5, step: 0.05, v: 0.85 },
  { k: 'brkMag', label: 'Shells', min: 1, max: 12, step: 1, v: 5 },
  { k: 'brkReload', label: 'Reload time', unit: 's', min: 0.5, max: 4, step: 0.1, v: 2.1 },
  { k: 'brkSpread', label: 'Spread', unit: '°', min: 0.5, max: 8, step: 0.1, v: 3.2 },

  { g: 'Ranger (rifle)', k: 'rngZoom', label: 'Zoom while aiming', unit: '×', min: 1, max: 4, step: 0.05, v: 1.8 },
  { k: 'rngDmg', label: 'Damage', min: 10, max: 60, step: 1, v: 28 },
  { k: 'rngRate', label: 'Shots per second', min: 2, max: 12, step: 0.5, v: 5.5 },
  { k: 'rngMag', label: 'Magazine', min: 5, max: 60, step: 1, v: 30 },
  { k: 'rngReload', label: 'Reload time', unit: 's', min: 0.5, max: 4, step: 0.1, v: 2.2 },
  { k: 'rngSpread', label: 'First-shot spread', unit: '°', min: 0, max: 3, step: 0.05, v: 0.25 },
  { k: 'rngBloom', label: 'Spread added per shot', unit: '°', min: 0, max: 1.5, step: 0.05, v: 0.3 },
  { k: 'rngMaxSpread', label: 'Largest spread', unit: '°', min: 0.5, max: 6, step: 0.1, v: 2.4 },

  { g: 'Hornet (SMG)', k: 'hrnZoom', label: 'Zoom while aiming', unit: '×', min: 1, max: 3, step: 0.05, v: 1.4 },
  { k: 'hrnDmg', label: 'Damage', min: 5, max: 40, step: 1, v: 15 },
  { k: 'hrnRate', label: 'Shots per second', min: 5, max: 20, step: 0.5, v: 12 },
  { k: 'hrnMag', label: 'Magazine', min: 10, max: 60, step: 1, v: 30 },
  { k: 'hrnReload', label: 'Reload time', unit: 's', min: 0.5, max: 4, step: 0.1, v: 1.9 },
  { k: 'hrnSpread', label: 'First-shot spread', unit: '°', min: 0, max: 4, step: 0.05, v: 1 },
  { k: 'hrnBloom', label: 'Spread added per shot', unit: '°', min: 0, max: 1.5, step: 0.05, v: 0.2 },
  { k: 'hrnMaxSpread', label: 'Largest spread', unit: '°', min: 0.5, max: 8, step: 0.1, v: 3.2 },

  { g: 'All guns', k: 'headMult', label: 'Headshot multiplier', min: 1, max: 3, step: 0.05, v: 1.5 },
  { k: 'equipTime', label: 'Pull-out time', unit: 's', min: 0, max: 0.8, step: 0.05, v: 0.25 },

  { g: 'Targets', k: 'dummyHp', label: 'Dummy health', min: 50, max: 500, step: 10, v: 200 },
  { k: 'dummyRespawn', label: 'Respawn time', unit: 's', min: 0.5, max: 6, step: 0.1, v: 1.5 },
  { k: 'strafeSpeed', label: 'Strafe speed', unit: 'm/s', min: 0, max: 7, step: 0.1, v: 3 },
];

let group = '';
for (const d of DEFS) { if (d.g) group = d.g; else d.g = group; }

export const T = {};
for (const d of DEFS) T[d.k] = d.v;

let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { saved = {}; }
for (const d of DEFS) {
  const v = saved[d.k];
  if (typeof v === 'number' && isFinite(v)) T[d.k] = Math.min(d.max, Math.max(d.min, v));
}

// Only values that differ from the defaults are stored.
export function changed() {
  const out = {};
  for (const d of DEFS) if (T[d.k] !== d.v) out[d.k] = T[d.k];
  return out;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(changed())); } catch { /* private mode */ }
}

export function setTune(k, v) {
  const d = DEFS.find((x) => x.k === k);
  if (!d || typeof v !== 'number' || !isFinite(v)) return;
  T[k] = Math.min(d.max, Math.max(d.min, v));
  save();
}

export function resetTuning() {
  for (const d of DEFS) T[d.k] = d.v;
  save();
}
