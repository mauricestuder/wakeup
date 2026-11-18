// Idle Lift 2D: the rules. No drawing here, so it can be tested in Node.
// Each mountain has one lift. A lift earns its ticket price for every ride it gives.
// Upgrading a lift adds rides; at milestone levels its speed doubles. The resort-wide
// upgrades (more guests from the car park, a bigger ski hut) multiply everything.

export const T = {
  RIDES: 0.4,           // rides per second per lift level
  GROW: 1.14,           // each lift level costs this much more than the one before
  MILES: [10, 25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500],
  G_X: 1.1, G_COST: 150, G_GROW: 2.1,    // car park: +10% income per level
  H_X: 1.4, H_COST: 5000, H_GROW: 40,    // ski hut: x1.4 income per level
  RUSH_X: 2, RUSH_TIME: 30, RUSH_WAIT: 90,
  TAP_X: 2, TAP_TIME: 3,                  // tapping a lift station speeds it up for a moment
  OFFLINE_MAX: 3 * 3600,
};

const LIFT_NAMES = { drag: 'Drag lift', chair: 'Chairlift', gondola: 'Gondola' };
export const PEAKS = [
  { name: 'Bunny Hill', lift: 'drag', diff: 0, h: 180 },
  { name: 'Pine Ridge', lift: 'drag', diff: 0, h: 220 },
  { name: 'Fox Valley', lift: 'chair', diff: 1, h: 260 },
  { name: 'Eagle Peak', lift: 'chair', diff: 1, h: 300 },
  { name: 'Crystal Bowl', lift: 'chair', diff: 2, h: 335 },
  { name: 'Glacier Point', lift: 'gondola', diff: 2, h: 370 },
  { name: 'Thunder Face', lift: 'gondola', diff: 3, h: 400 },
  { name: 'Sky Summit', lift: 'gondola', diff: 3, h: 430 },
].map((p, i) => ({
  ...p, i, liftName: LIFT_NAMES[p.lift],
  price: 2 * Math.pow(6, i),               // ticket per ride
  cost0: 6 * Math.pow(6.4, i),             // first upgrade
  unlock: i ? 400 * Math.pow(25, i - 1) : 0,
}));

export function newGame() {
  return { v: 1, money: 0, earned: 0, time: 0, lv: PEAKS.map((_, i) => (i ? 0 : 1)), G: 0, H: 0, rush: 0, rushWait: 0, tap: PEAKS.map(() => 0), saved: Date.now() };
}

// ---------- lifts ----------
export const miles = (L) => { let m = 0; for (const x of T.MILES) if (L >= x) m++; return m; };
export const nextMile = (L) => T.MILES.find((x) => x > L) || null;
export const rides = (L) => (L > 0 ? T.RIDES * L * Math.pow(2, miles(L)) : 0);
export const globalX = (s) => Math.pow(T.G_X, s.G) * Math.pow(T.H_X, s.H) * (s.rush > 0 ? T.RUSH_X : 1);
// What one lift earns per second, without the short tap boost.
export const liftRate = (s, i, L = s.lv[i]) => rides(L) * PEAKS[i].price * globalX(s);
export const rateOf = (s) => PEAKS.reduce((sum, _, i) => sum + liftRate(s, i) * (s.tap[i] > 0 ? T.TAP_X : 1), 0);
export const baseRate = (s) => PEAKS.reduce((sum, _, i) => sum + liftRate(s, i), 0);

const geo = (c0, r, from, n) => c0 * Math.pow(r, from) * (Math.pow(r, n) - 1) / (r - 1);
export const upCost = (s, i, n = 1) => geo(PEAKS[i].cost0, T.GROW, s.lv[i] - 1, n);
export function maxBuy(s, i) {
  if (!s.lv[i]) return 0;
  let n = 0;
  while (n < 1000 && upCost(s, i, n + 1) <= s.money) n++;
  return n;
}
export function upgrade(s, i, n = 1) {
  if (!s.lv[i] || n < 1) return false;
  const c = upCost(s, i, n);
  if (c > s.money) return false;
  s.money -= c; s.lv[i] += n;
  return true;
}
// The next mountain you can build, or -1 when all are open.
export const nextPeak = (s) => s.lv.findIndex((L) => L === 0);
export function unlock(s, i) {
  if (i !== nextPeak(s) || PEAKS[i].unlock > s.money) return false;
  s.money -= PEAKS[i].unlock; s.lv[i] = 1;
  return true;
}

// ---------- resort ----------
export const gCost = (s, n = 1) => geo(T.G_COST, T.G_GROW, s.G, n);
export const hCost = (s) => T.H_COST * Math.pow(T.H_GROW, s.H);
export function buyG(s, n = 1) { const c = gCost(s, n); if (c > s.money) return false; s.money -= c; s.G += n; return true; }
export function buyH(s) { const c = hCost(s); if (c > s.money) return false; s.money -= c; s.H++; return true; }
export function maxG(s) { let n = 0; while (n < 500 && gCost(s, n + 1) <= s.money) n++; return n; }

export function rush(s) {
  if (s.rush > 0 || s.rushWait > 0) return false;
  s.rush = T.RUSH_TIME; return true;
}
export function tap(s, i) { if (s.lv[i]) s.tap[i] = T.TAP_TIME; }

export function tick(s, dt) {
  const pay = rateOf(s) * dt;
  s.money += pay; s.earned += pay; s.time += dt;
  for (let i = 0; i < s.tap.length; i++) if (s.tap[i] > 0) s.tap[i] = Math.max(0, s.tap[i] - dt);
  if (s.rush > 0) { s.rush -= dt; if (s.rush <= 0) { s.rush = 0; s.rushWait = T.RUSH_WAIT; } }
  else if (s.rushWait > 0) s.rushWait = Math.max(0, s.rushWait - dt);
  return pay;
}

// ---------- saving ----------
export function toSave(s) { return JSON.stringify({ ...s, saved: Date.now() }); }
export function fromSave(text) {
  const d = JSON.parse(text), s = newGame();
  if (!d || d.v !== 1) return s;
  for (const k of ['money', 'earned', 'time', 'G', 'H', 'rushWait', 'saved']) if (typeof d[k] === 'number' && isFinite(d[k])) s[k] = d[k];
  if (Array.isArray(d.lv)) PEAKS.forEach((_, i) => { s.lv[i] = Math.max(i ? 0 : 1, Math.floor(+d.lv[i] || 0)); });
  // A lift is only open if the one before it is.
  for (let i = 1; i < s.lv.length; i++) if (!s.lv[i - 1]) s.lv[i] = 0;
  return s;
}
// Money earned while the game was closed, at the normal rate (no rush, no taps).
export function offline(s, now = Date.now()) {
  const away = Math.min(T.OFFLINE_MAX, Math.max(0, (now - s.saved) / 1000));
  const pay = away > 30 ? baseRate({ ...s, rush: 0 }) * away : 0;
  s.money += pay; s.earned += pay; s.saved = now;
  return { away, pay };
}

const UNITS = ['', 'K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae', 'af'];
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n).toString();
  let u = 0;
  while (n >= 1000 && u < UNITS.length - 1) { n /= 1000; u++; }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n).toString()) + UNITS[u];
}
