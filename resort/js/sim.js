// First Chair: the game state, the day cycle and everything the player can do.
import { T, LIFTS, BUILDINGS, WEATHER } from './tuning.js';
import { mapById } from './maps.js';
import { makeTerrain, rngFrom, clamp } from './terrain.js';
import { liftGeom, checkLift, checkPiste, pisteGeom, buildNet, crowded, nearestOnPiste, nearestSpot } from './network.js';
import { spawnGuest, updateGuests, updateLifts, sendHome } from './guests.js';
import { pay, plannedGuests, updateQualities, closeDay } from './economy.js';
import { checkGoals } from './goals.js';

const NAMES = ['Adler', 'Murmeli', 'Gams', 'Steinbock', 'Enzian', 'Edelweiss', 'Sonnseite', 'Hexenkessel', 'Alpenrose',
  'Bergdohle', 'Schneehase', 'Panorama', 'Kanonenrohr', 'Talblick', 'Gipfel', 'Arven', 'Wildbach', 'Lerchen', 'Firn', 'Horn'];
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const freshToday = () => ({ arrived: 0, departed: 0, satSum: 0, runs: 0, rides: 0, rented: 0, injuries: 0, rescued: 0, peak: 0, built: 0, away: [0, 0, 0],
  income: { tickets: 0, food: 0, rental: 0, hotel: 0, bonus: 0 }, costs: { lifts: 0, buildings: 0, base: 0, interest: 0, rescue: 0 }, complaints: {} });

export function newState(mapId, sandbox = false) {
  const map = mapById(mapId);
  const state = {
    v: 1, mapId: map.id, sandbox, day: 1, clock: T.DAY_START, phase: 'day', closing: false,
    money: sandbox ? 9999999 : map.money, loan: 0, ticket: T.TICKET, food: T.FOOD, snow: map.snow,
    weather: 'sun', forecast: 'cloud', rating: 1, nextId: 1,
    lifts: [], pistes: [], buildings: [], cleared: [], guests: [],
    unlocks: Object.fromEntries(map.unlocked.map((k) => [k, 1])), goals: {},
    best: { guests: 0, profit: 0, stars: 1, runs: 0 }, today: freshToday(), history: [], last: null,
    rng: [map.seed * 7919 + 13], arrivals: [], arrIdx: 0, events: [],
  };
  if (sandbox) for (const k of [...Object.keys(LIFTS), ...Object.keys(BUILDINGS)]) state.unlocks[k] = 1;
  return state;
}

function hydrateLift(l, ter) {
  const geo = liftGeom(ter, l.a, l.b, l.type);
  Object.assign(l, { pts: geo.pts, cum: geo.cum, len: geo.len, dir: Math.atan2(l.b.x - l.a.x, l.b.z - l.a.z) });
  l.queue = l.queue || []; l.riders = l.riders || 0; l.clock = l.clock || 0; l.storm = !!l.storm;
}
function hydratePiste(p, ter) {
  const geo = pisteGeom(ter, p.wps);
  Object.assign(p, { pts: geo.pts, cum: geo.cum, sl: geo.sl, len: geo.len, diff: geo.diff, steep: geo.steep, avg: geo.avg });
  p.wear = p.wear || 0; p.runs = p.runs || 0;
  p.box = [Infinity, -Infinity, Infinity, -Infinity];
  for (const q of p.pts) { p.box[0] = Math.min(p.box[0], q.x); p.box[1] = Math.max(p.box[1], q.x); p.box[2] = Math.min(p.box[2], q.z); p.box[3] = Math.max(p.box[3], q.z); }
}

// Build everything that is not saved: the terrain, shapes, look-up tables and the network.
export function attach(state) {
  const map = mapById(state.mapId);
  const ter = makeTerrain(map);
  for (const id of state.cleared) ter.alive[id] = 0;
  for (const l of state.lifts) hydrateLift(l, ter);
  for (const p of state.pistes) hydratePiste(p, ter);
  for (const b of state.buildings) b.busy = 0;
  state.events = state.events || [];
  state.rnd = rngFrom(state.rng);
  state.map = map;
  applyStorm(state, ter);
  refresh(state, ter);
  return ter;
}

// Call after anything on the mountain changed.
export function refresh(state, ter) {
  const old = state.net;
  state.liftById = Object.fromEntries(state.lifts.map((l) => [l.id, l]));
  state.pisteById = Object.fromEntries(state.pistes.map((p) => [p.id, p]));
  state.buildingById = Object.fromEntries(state.buildings.map((b) => [b.id, b]));
  updateQualities(state, ter);
  state.net = buildNet(state, ter);
  for (const g of state.guests) {
    if (g.st !== 'decide' && g.st !== 'stuck') continue;
    const key = old && old.spots[g.spot] ? old.spots[g.spot].key : null;
    g.spot = key != null && state.net.idx[key] != null ? state.net.idx[key] : nearestSpot(state.net, g.x, g.z);
  }
  state.events.push({ type: 'net' });
}

function applyStorm(state, ter) {
  for (const l of state.lifts) l.storm = state.weather === 'storm' && ter.alt(l.b.x, l.b.z) > LIFTS[l.type].storm;
}

function rollWeather(state) {
  const w = { ...state.map.weather }, d = (state.day % T.SEASON_DAYS) + 1;
  if (d <= 5) { w.snow *= 1.6; w.thaw *= 0.3; }
  if (d >= 24) { w.thaw *= 2.2; w.snow *= 0.7; }
  let total = 0;
  for (const k in w) total += w[k];
  let r = state.rnd() * total;
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'cloud';
}

export const dayInSeason = (state) => ((state.day - 1) % T.SEASON_DAYS) + 1;
export const seasonOf = (state) => Math.floor((state.day - 1) / T.SEASON_DAYS) + 1;

// Morning: set the weather, the snow and who is on the way.
export function startDay(state, ter, first = false) {
  if (!first) {
    state.day++;
    state.weather = state.forecast;
    if (dayInSeason(state) === 1) { state.snow = state.map.snow; state.events.push({ type: 'season', season: seasonOf(state) }); }
  }
  state.forecast = rollWeather(state);
  state.clock = T.DAY_START; state.phase = 'day'; state.closing = false;
  state.today = freshToday();
  applyStorm(state, ter);
  refresh(state, ter);
  planArrivals(state);
  if (state.lifts.some((l) => l.storm)) state.events.push({ type: 'toast', text: 'Storm: the high lifts stay closed today.', bad: true });
  state.events.push({ type: 'dayStart' });
}

function planArrivals(state) {
  const n = plannedGuests(state, state.map);
  const span = T.LAST_ARRIVAL - T.DAY_START - 12;
  state.arrivals = [];
  for (let i = 0; i < n; i++) state.arrivals.push(T.DAY_START + 12 + span * Math.pow(state.rnd(), 1.7));
  state.arrivals.sort((a, b) => a - b);
  state.arrIdx = 0;
  // After a reload in the middle of the day, the guests who already came do not come twice.
  while (state.arrIdx < state.arrivals.length && state.arrivals[state.arrIdx] < state.clock) state.arrIdx++;
}

export function endDay(state, ter) {
  sendHome(state);
  state.last = closeDay(state);
  state.snow = clamp(state.snow + WEATHER[state.forecast].snow, -70, 160);
  state.last.forecast = state.forecast;
  state.last.seasonEnd = dayInSeason(state) === T.SEASON_DAYS;
  checkGoals(state);
  state.phase = 'summary';
  state.events.push({ type: 'dayEnd' });
}

let goalTick = 0;
export function tick(state, ter, dt) {
  if (state.phase !== 'day') return;
  state.clock += dt * T.MIN_PER_SEC;
  while (state.arrIdx < state.arrivals.length && state.arrivals[state.arrIdx] <= state.clock) {
    state.arrIdx++;
    if (state.guests.length < T.MAX_GUESTS && !state.closing) spawnGuest(state, ter, state.rnd);
  }
  if (!state.closing && state.clock >= T.CLOSING) {
    state.closing = true;
    state.events.push({ type: 'closing' });
  }
  updateLifts(state, dt);
  updateGuests(state, ter, dt, state.rnd);
  if (state.guests.length > state.today.peak) state.today.peak = state.guests.length;
  if (state.today.runs > state.best.runs) state.best.runs = state.today.runs;
  if (state.today.arrived > state.best.guests) state.best.guests = state.today.arrived; // guest goals tick off during the day
  if (++goalTick % 10 === 0) checkGoals(state);
  if (state.clock >= T.DAY_END || (state.closing && state.guests.length === 0)) endDay(state, ter);
}

// ---------- what the player can do ----------

const noMoney = { ok: false, why: 'Not enough money' };
const nameFor = (state, kind) => NAMES[(state.nextId * 7 + kind) % NAMES.length];

function clear(state, ter, ids) {
  for (const id of ids) if (ter.alive[id]) { ter.alive[id] = 0; state.cleared.push(id); }
  state.events.push({ type: 'trees' });
}

export function buildLift(state, ter, type, a, b) {
  const c = checkLift(state, ter, a, b, type);
  if (!c.ok) return c;
  if (!state.unlocks[type]) return { ok: false, why: 'Not unlocked yet' };
  if (!pay(state, c.cost)) return noMoney;
  const l = { id: state.nextId++, type, a: { x: a.x, z: a.z }, b: { x: b.x, z: b.z }, open: true, cost: c.cost,
    name: nameFor(state, 1) + (type === 'drag' ? 'lift' : 'bahn') };
  hydrateLift(l, ter);
  state.lifts.push(l);
  const ids = [];
  for (const p of l.pts) ter.treesNear(p.x, p.z, 1.1, ids);
  ter.treesNear(a.x, a.z, 2, ids); ter.treesNear(b.x, b.z, 2, ids);
  clear(state, ter, ids);
  applyStorm(state, ter);
  refresh(state, ter);
  checkGoals(state);
  return { ok: true, item: l, cost: c.cost };
}

export function buildPiste(state, ter, wps) {
  const c = checkPiste(state, ter, wps);
  if (!c.ok) return c;
  if (!pay(state, c.cost)) return noMoney;
  const p = { id: state.nextId++, wps: wps.map((w) => ({ x: w.x, z: w.z })), cost: c.cost, name: nameFor(state, 3) };
  hydratePiste(p, ter);
  state.pistes.push(p);
  clear(state, ter, c.trees);
  refresh(state, ter);
  checkGoals(state);
  return { ok: true, item: p, cost: c.cost };
}

export function checkBuilding(state, ter, type, x, z) {
  const B = BUILDINGS[type];
  let why = null;
  if (!ter.inside(x, z, 2)) why = 'Too close to the edge of the map';
  else if (ter.slope(x, z) > (type === 'cannon' ? 0.7 : 0.42)) why = 'Too steep here. Look for flatter ground';
  else if (crowded(state, x, z, type === 'cannon' ? 1.6 : 2.8)) why = 'Too close to another station or building';
  else if (Math.hypot(x - ter.base.x, z - ter.base.z) < 3) why = 'That is the car park';
  else if (state.pistes.some((p) => nearestOnPiste(p, x, z).d < (type === 'cannon' ? 1.4 : 1.9))) why = 'That is in the middle of a piste';
  return { ok: !why, why, cost: B.cost };
}

export function buildBuilding(state, ter, type, x, z) {
  const c = checkBuilding(state, ter, type, x, z);
  if (!c.ok) return c;
  if (!state.unlocks[type]) return { ok: false, why: 'Not unlocked yet' };
  if (!pay(state, c.cost)) return noMoney;
  const b = { id: state.nextId++, type, x, z, cost: c.cost, busy: 0, rot: Math.atan2(ter.base.x - x, ter.base.z - z) };
  state.buildings.push(b);
  clear(state, ter, ter.treesNear(x, z, type === 'cannon' ? 0.9 : 2));
  refresh(state, ter);
  checkGoals(state);
  return { ok: true, item: b, cost: c.cost };
}

export function demolish(state, ter, kind, id) {
  const list = kind === 'lift' ? state.lifts : kind === 'piste' ? state.pistes : state.buildings;
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return { ok: false, why: 'Already gone' };
  const refund = state.sandbox ? 0 : Math.round(list[i].cost * T.REFUND);
  state.money += refund;
  list.splice(i, 1);
  refresh(state, ter);
  return { ok: true, refund };
}

export function toggleLift(state, ter, id) {
  const l = state.liftById[id];
  if (!l) return;
  l.open = !l.open;
  refresh(state, ter);
}

export function setLoan(state, delta) {
  const next = clamp(state.loan + delta, 0, T.LOAN_MAX);
  const d = next - state.loan;
  if (d < 0 && state.money < -d) return false;
  state.loan = next; state.money += d;
  return d !== 0;
}
