// Idle Lift: the idle game. The resort runs on its own: guests arrive, ride,
// ski and pay. The player spends the money on upgrades. Nothing in here touches
// three.js or the page, so the rules can be run in plain Node.
import { T, LIFTS, NEXT_TYPE } from './tuning.js';
import { mapAt } from './maps.js';
import { makeTerrain, rngFrom, clamp } from './terrain.js';
import { liftGeom, pisteGeom, pisteFeatures, along } from './network.js';
import { planLifts, placeSpecial } from './layout.js';

const tmp = { x: 0, y: 0, z: 0, i: 0 };
export const UPGRADES = ['lift', 'upgrade', 'speed', 'guests', 'ticket', 'hut', 'jump', 'cannon', 'school', 'night', 'resto', 'lodge'];
const LEVELS = ['speed', 'guests', 'ticket', 'hut', 'jump', 'cannon', 'school', 'night', 'resto', 'lodge'];

export const mapOf = (state) => mapAt(state.level);
export const costScale = (state) => Math.pow(T.NEXT_COST, state.level);
export const fameOf = (state) => Math.pow(T.FAME, state.level);
const fareScale = (state) => Math.pow(T.NEXT_FARE * T.FAME, state.level);

// ---------- state ----------

// life = totals over all mountains, unl = upgrades unlocked for good. Both move on to the next mountain.
export function newGame(level = 0, life = null, unl = null) {
  const up = {};
  for (const k of LEVELS) up[k] = 0;
  return {
    v: 3, level, money: Math.round(T.START_MONEY * T.MONEY * Math.pow(T.NEXT_COST, level)), earned: 0, rides: 0, tricks: 0, time: 0,
    open: 1, types: null, up, done: {}, rush: 0, rushWait: 0, event: null, evT: T.EVENT_FIRST, park: T.PARK_START,
    life: { rides: 0, time: 0, tricks: 0, ...(life || {}) }, unl: { ...(unl || {}) },
  };
}

export const toSave = (s) => ({
  v: 3, level: s.level, money: s.money, earned: s.earned, rides: s.rides, tricks: s.tricks, time: s.time,
  open: s.open, types: s.types.slice(), up: { ...s.up }, done: { ...s.done }, rushWait: Math.max(0, s.rushWait + s.rush),
  evT: Math.max(30, s.evT), park: s.park, savedAt: Date.now(),
  life: { ...s.life }, unl: { ...s.unl },
});

export function fromSave(d) {
  if (!d || (d.v !== 2 && d.v !== 3) || !Array.isArray(d.types) || !d.up) return null;
  const s = newGame(d.level | 0, d.life, d.unl);
  const old = d.v === 2 ? T.MONEY : 1; // saves from before every price was multiplied
  s.money = (+d.money || 0) * old; s.earned = (+d.earned || 0) * old; s.rides = +d.rides || 0; s.tricks = +d.tricks || 0; s.time = +d.time || 0;
  s.open = clamp(d.open | 0, 1, T.LIFT_COUNT);
  s.types = d.types.slice(0, T.LIFT_COUNT);
  for (const k of LEVELS) s.up[k] = Math.max(0, d.up[k] | 0);
  s.done = { ...(d.done || {}) };
  s.rushWait = Math.max(0, +d.rushWait || 0);
  // Saves from the version with cash boxes: what was still waiting in them goes to the bank.
  if (d.box) for (const v of Object.values(d.box)) if (+v > 0) s.money += +v;
  if (+d.evT > 0) s.evT = +d.evT;
  if (d.park !== undefined) s.park = clamp(d.park | 0, 0, T.PARK.length - 1);
  s.savedAt = +d.savedAt || 0;
  // Saves from before the totals existed: start them from this mountain's numbers.
  if (!d.life) { s.life.rides = s.rides; s.life.time = s.time; }
  return s;
}

// Builds everything that is not saved: the mountain, the lifts and pistes on it, the guests.
export function attach(state) {
  const map = mapOf(state), ter = makeTerrain(map);
  state.plan = planLifts(ter, map);
  // The mountain's own landmark, with room cleared for it.
  state.special = placeSpecial(ter, state.plan, map.special);
  if (state.special) for (const [x, z, r] of state.special.clear) clearTrees(ter, x, z, r);
  if (!state.types || state.types.length !== state.plan.length) state.types = state.plan.map((p) => p.type);
  state.lifts = []; state.pistes = []; state.buildings = []; state.guests = []; state.events = [];
  state.cars = []; state.nextCar = 1; state.left = 0; state.through = 3;
  state.liftById = {}; state.pisteById = {}; state.buildingById = {};
  state.rnd = rngFrom([(map.seed * 31 + state.level * 977 + Math.floor(state.time)) >>> 0]);
  state.nextGuest = 1; state.spawn = 0; state.goalT = 0;
  state.day = Math.floor(state.time / T.DAY_LENGTH);
  state.weather = weatherOf(state);
  for (let i = 0; i < state.open; i++) addLift(state, ter, i);
  syncHuts(state);
  syncJumps(state, ter);
  checkUnlocks(state);
  refreshRate(state);
  prefill(state, ter);
  state.events.length = 0;
  return ter;
}

function clearTrees(ter, x, z, r) {
  for (const id of ter.treesNear(x, z, r)) ter.alive[id] = 0;
}

function shapeLift(l, ter) {
  const g = liftGeom(ter, l.a, l.b, l.type);
  l.pts = g.pts; l.cum = g.cum; l.len = g.len;
}

function addLift(state, ter, i) {
  const p = state.plan[i];
  const l = { id: i + 1, i, type: state.types[i], a: p.a, b: p.b, from: p.from + 1, to: i + 1,
    dir: Math.atan2(p.b.x - p.a.x, p.b.z - p.a.z), queue: [], clock: 0, travel: 0, riders: 0, pop: 0, rate: 0 };
  shapeLift(l, ter);
  const g = pisteGeom(ter, p.wps);
  pisteFeatures(ter, g, i, p.cuts);
  const piste = { id: i + 1, i, pts: g.pts, cum: g.cum, sl: g.sl, len: g.len, diff: g.diff, to: p.from + 1, kick: 0, features: g.features };
  state.lifts.push(l); state.liftById[l.id] = l;
  state.pistes.push(piste); state.pisteById[piste.id] = piste;
  // Cut the forest for the piste, the lift line and the stations.
  for (const q of piste.pts) clearTrees(ter, q.x, q.z, T.PISTE_WIDTH / 2 + 0.7);
  for (const q of l.pts) clearTrees(ter, q.x, q.z, 1.3);
  clearTrees(ter, l.a.x, l.a.z, 3.4); clearTrees(ter, l.b.x, l.b.z, 2.8); clearTrees(ter, p.hut.x, p.hut.z, 2.4);
  state.events.push({ type: 'world' }, { type: 'trees' });
  return l;
}

// One hut per hut level, next to the lifts that are open.
function syncHuts(state) {
  const n = Math.min(state.open, state.up.hut);
  while (state.buildings.length < n) {
    const i = state.buildings.length, p = state.plan[i];
    const b = { id: i + 1, type: 'hut', x: p.hut.x, z: p.hut.z, rot: Math.atan2(p.a.x - p.hut.x, p.a.z - p.hut.z) };
    state.buildings.push(b); state.buildingById[b.id] = b;
    state.events.push({ type: 'world' });
  }
}

// One kicker per jump-park level, on the pistes that are open. kick = how far down the piste it stands.
function syncJumps(state, ter) {
  const n = Math.min(state.pistes.length, state.up.jump);
  for (let i = 0; i < n; i++) {
    const p = state.pistes[i];
    if (p.kick) continue;
    const park = p.features.find((f) => f.type === 'park');
    p.kick = park ? park.s0 + (park.s1 - park.s0) * 0.45 : p.len * 0.56;
    // Not on a bridge, in a tunnel or among the moguls.
    for (let tries = 0; tries < 40 && p.features.some((f) => f.type !== 'park' && p.kick > f.s0 - 2 && p.kick < f.s1 + 2); tries++) p.kick += (tries % 2 ? -1 : 1) * tries * 1.2;
    p.kick = clamp(p.kick, 4, p.len - 4);
    along(p.pts, p.cum, p.kick, tmp);
    const j = Math.min(p.pts.length - 2, tmp.i);
    p.kickAt = { x: tmp.x, z: tmp.z, y: tmp.y, yaw: Math.atan2(p.pts[j + 1].x - p.pts[j].x, p.pts[j + 1].z - p.pts[j].z) };
    state.events.push({ type: 'world' });
  }
}

// ---------- numbers ----------

export const rushing = (state) => state.rush > 0;
export const speedOf = (state) => (1 + T.SPEED_GAIN * state.up.speed) * (rushing(state) ? T.RUSH_SPEED : 1);
const capAt = (lvl) => Math.min(T.GUESTS_MAX, T.GUESTS_START + T.GUESTS_STEP * lvl);
export const parkOf = (state) => T.PARK[state.park ?? T.PARK_START];
export const guestCap = (state) => Math.min(T.GUESTS_SHOWN, Math.round(capAt(state.up.guests) * (rushing(state) ? T.RUSH_GUESTS : 1) * parkOf(state).g));
const ticketAt = (lvl) => Math.pow(T.TICKET_GAIN, lvl);
const eventIs = (state, id) => !!state.event && state.event.id === id;
const skiOf = (state) => (1 + T.CANNON_GAIN * state.up.cannon) * (eventIs(state, 'powder') ? T.POWDER_SKI : 1);
const closed = (state, l) => eventIs(state, 'storm') && state.event.lifts.includes(l.id);
// Everything that multiplies what a ride pays.
const bonusOf = (state) => (1 + T.HUT_GAIN * state.up.hut) * (1 + T.NIGHT_GAIN * state.up.night) * (1 + T.RESTO_GAIN * state.up.resto) * fareScale(state);
export const fare = (state, i) => T.FARE[i] * T.MONEY * ticketAt(state.up.ticket) * bonusOf(state);
export const trickPay = (state, i) => Math.max(1, Math.round(fare(state, i) * (T.TRICK_PAY + T.TRICK_PAY_STEP * state.up.jump)));
const trickChance = (lvl) => Math.min(T.TRICK_CHANCE_MAX, T.TRICK_CHANCE + T.TRICK_CHANCE_STEP * lvl);

// Income per second, worked out from the resort itself instead of counted at the lifts, so it
// stays the same until something is bought. Each lift sells as many rides as it can carry or
// as its share of the guests can take, whichever is less.
export function refreshRate(state) {
  // The steady figure first: no rush hour and no event. Offline earnings and event bonuses use it.
  const rush = state.rush, ev = state.event;
  state.rush = 0; state.event = null;
  sumRate(state);
  state.steady = state.rate;
  state.rush = rush; state.event = ev;
  sumRate(state);
}

function sumRate(state) {
  const sm = speedOf(state), guests = guestCap(state), ski = T.SKI * skiOf(state);
  let wsum = 0;
  for (const l of state.lifts) wsum += 1 + 0.25 * l.i;
  let total = 0, rides = 0;
  for (const l of state.lifts) {
    const L = LIFTS[l.type], p = state.pisteById[l.id];
    const carry = L.seats / L.interval * sm;
    const lap = l.len / (L.speed * sm) + p.len / ski + T.TURNAROUND;
    const want = guests * (1 + 0.25 * l.i) / wsum / lap;
    l.rides = closed(state, l) ? 0 : Math.min(carry, want);
    l.rate = l.rides * fare(state, l.i);
    total += l.rate; rides += l.rides;
  }
  state.lessons = guests * T.SCHOOL_PAY * T.MONEY * state.up.school * ticketAt(state.up.ticket) * bonusOf(state);
  // Parking: every guest pays a little per second, in fares of the average open lift.
  let avg = 0;
  for (const l of state.lifts) avg += fare(state, l.i);
  avg /= Math.max(1, state.lifts.length);
  state.parking = guests * parkOf(state).fee * T.PARK_PAY * avg;
  // A whole number of dollars, so the sign shows exactly what is paid.
  state.rate = Math.max(1, Math.round((total + state.lessons + state.parking) * (eventIs(state, 'powder') ? T.POWDER_PAY : 1)));
  state.rideRate = rides;
}

// What a parking price would give, without rush hour or an event: { rate, parking, guests }.
export function parkPreview(state, k) {
  const keep = { park: state.park, rush: state.rush, event: state.event };
  Object.assign(state, { park: k, rush: 0, event: null });
  sumRate(state);
  const o = { rate: state.rate, parking: Math.round(state.parking), guests: guestCap(state) };
  Object.assign(state, keep);
  refreshRate(state);
  return o;
}
export function setPark(state, k) {
  k = clamp(k | 0, 0, T.PARK.length - 1);
  if (k === state.park) return false;
  state.park = k;
  refreshRate(state);
  state.events.push({ type: 'park' });
  return true;
}

const TABLE = { speed: T.SPEED, guests: T.GUESTS, ticket: T.TICKET, hut: T.HUT, jump: T.JUMP, cannon: T.CANNON, school: T.SCHOOL, night: T.NIGHT, resto: T.RESTO, lodge: T.LODGE };
export const NAMES = { lift: 'New lift', upgrade: 'Upgrade lift', speed: 'Lift speed', guests: 'More guests', ticket: 'Ticket price', hut: 'Ski hut', jump: 'Jump park', cannon: 'Snow guns', school: 'Ski school', night: 'Night skiing', resto: 'Restaurant', lodge: 'Lodge' };
const pct = (v) => Math.round(v * 100) + '%';

// What has to happen before an upgrade shows up for good.
const UNLOCKS = {
  jump: { text: 'Open lift 2', test: (s) => s.open >= 2 },
  cannon: { text: 'Sell 2,000 rides', test: (s) => s.life.rides >= T.UNLOCK_CANNON_RIDES },
  school: { text: 'Play 8 minutes', test: (s) => s.life.time >= T.UNLOCK_SCHOOL_TIME },
  night: { text: 'Open lift 4', test: (s) => s.open >= 4 },
  resto: { text: 'Open lift 5', test: (s) => s.open >= 5 },
  lodge: { text: 'Open lift 3', test: (s) => s.open >= 3 },
};
export const unlocked = (state, id) => !UNLOCKS[id] || !!state.unl[id];
export function checkUnlocks(state) {
  for (const id of Object.keys(UNLOCKS)) {
    if (state.unl[id] || !UNLOCKS[id].test(state)) continue;
    state.unl[id] = 1;
    state.events.push({ type: 'unlock', id, name: NAMES[id] });
  }
}

// What a button offers right now: { name, level, cost, note, maxed, locked }.
export function offer(state, id) {
  const cs = costScale(state) * T.MONEY;
  if (id === 'lift') {
    if (state.open >= T.LIFT_COUNT) return { name: 'New lift', maxed: true, note: 'All 6 lifts open' };
    const type = state.types[state.open];
    return { name: 'New lift', level: state.open, cost: Math.ceil(T.LIFT_COST[state.open] * cs),
      note: `Lift ${state.open + 1}: ${LIFTS[type].name.toLowerCase()}` };
  }
  if (id === 'upgrade') {
    const chairs = state.types.filter((t, i) => i < 2 && t !== 'drag').length;
    const gondolas = state.types.filter((t, i) => i < 4 && t === 'gondola').length;
    const drag = state.lifts.find((l) => l.type === 'drag'), chair = state.lifts.find((l) => l.type === 'chair');
    const opts = [];
    if (drag) opts.push({ lift: drag, cost: Math.ceil(T.CHAIR_COST[chairs] * cs) });
    if (chair) opts.push({ lift: chair, cost: Math.ceil(T.GONDOLA_COST[gondolas] * cs) });
    if (!opts.length) {
      return state.open >= T.LIFT_COUNT ? { name: 'Upgrade lift', maxed: true, note: 'Every lift is a gondola' }
        : { name: 'Upgrade lift', locked: true, note: 'Open another lift first' };
    }
    opts.sort((a, b) => a.cost - b.cost);
    const o = opts[0], to = NEXT_TYPE[o.lift.type];
    return { name: 'Upgrade lift', level: chairs + gondolas, cost: o.cost, target: o.lift,
      note: `Lift ${o.lift.i + 1} → ${LIFTS[to].name.toLowerCase()}` };
  }
  const name = NAMES[id];
  if (!unlocked(state, id)) return { name, locked: true, secret: true, note: UNLOCKS[id].text };
  const tb = TABLE[id], lvl = state.up[id];
  const base = { name, level: lvl, cost: Math.ceil(tb.base * Math.pow(tb.growth, lvl) * cs), maxed: lvl >= tb.max };
  if (id === 'speed') return { ...base, note: base.maxed ? 'Fastest' : `${pct(1 + T.SPEED_GAIN * lvl)} → ${pct(1 + T.SPEED_GAIN * (lvl + 1))}` };
  if (id === 'guests') {
    const full = base.maxed || capAt(lvl) >= T.GUESTS_MAX;
    return { ...base, maxed: full, note: full ? 'The mountain is full' : `${capAt(lvl)} → ${capAt(lvl + 1)} guests` };
  }
  if (id === 'ticket') return { ...base, note: `x${short(ticketAt(lvl))} → x${short(ticketAt(lvl + 1))}` };
  if (id === 'hut') return { ...base, note: base.maxed ? 'Best food in the Alps' : `Food +${pct(T.HUT_GAIN * (lvl + 1))}` };
  if (id === 'jump') {
    if (base.maxed) return { ...base, note: 'Biggest kickers' };
    return { ...base, note: lvl < state.pistes.length ? `Kicker, piste ${lvl + 1}` : `Tricks pay more` };
  }
  if (id === 'cannon') return { ...base, note: base.maxed ? 'Perfect snow' : `Skiing +${pct(T.CANNON_GAIN * (lvl + 1))}` };
  if (id === 'school') return { ...base, note: base.maxed ? 'Everyone can ski' : `Lessons level ${lvl + 1}` };
  if (id === 'night') return { ...base, note: base.maxed ? 'Open all night' : `Income +${pct(T.NIGHT_GAIN * (lvl + 1))}` };
  if (id === 'lodge') {
    const [a, h] = awayAt(lvl), [b, k] = awayAt(lvl + 1);
    return { ...base, note: base.maxed ? `Offline ${pct(a)} for ${h} h` : `Away ${pct(a)} → ${pct(b)}, ${h} → ${k} h` };
  }
  return { ...base, note: base.maxed ? 'Three stars' : `Income +${pct(T.RESTO_GAIN * (lvl + 1))}` };
}

// ---------- offline ----------

// [share of the income, hours] while the game is closed.
const awayAt = (lvl) => [T.OFFLINE_SHARE + T.OFFLINE_SHARE_STEP * lvl, T.OFFLINE_HOURS + T.OFFLINE_HOURS_STEP * lvl];
export const awayOf = (state) => awayAt(state.up.lodge);

// Pays for the time since the last save. Call after attach(). Returns null when there is nothing to pay.
export function payAway(state, now = Date.now()) {
  const away = (now - (state.savedAt || 0)) / 1000;
  state.savedAt = 0;
  if (!(away >= 60) || away > 3600 * 24 * 400) return null; // no save time, or a clock that went wrong
  const [share, hours] = awayOf(state), t = Math.min(away, hours * 3600);
  const pay = Math.round(state.steady * share * t);
  state.money += pay; state.earned += pay;
  return { away, paid: t, share, hours, pay };
}

// ---------- events ----------

export const EVENTS = {
  powder: { name: 'Powder day', time: T.POWDER_TIME },
  storm: { name: 'Storm', time: T.STORM_TIME },
  celeb: { name: 'Celebrity visit', time: T.CELEB_TIME },
};

function startEvent(state, ter) {
  const r = state.rnd, can = ['powder', 'celeb'];
  if (state.open >= 2) can.push('storm');
  const id = can[(r() * can.length) | 0], e = { id, t: EVENTS[id].time, name: EVENTS[id].name };
  if (id === 'storm') {
    // The wind closes the highest lifts.
    e.lifts = state.lifts.slice().sort((a, b) => b.i - a.i).slice(0, state.open >= 5 ? 2 : 1).map((l) => l.id);
  }
  if (id === 'celeb') {
    // A famous skier starts at the top of the highest open piste.
    const p = state.pistes[state.pistes.length - 1];
    const g = spawnGuest(state, ter, p.pts[0].x, p.pts[0].z);
    Object.assign(g, { st: 'ski', piste: p.id, s: 0, node: p.to, col: 12, celeb: 1, board: 0, runs: 3 });
    e.guest = g.id;
  }
  state.event = e;
  refreshRate(state);
  state.events.push({ type: 'event', event: e });
}

function endEvent(state, how = 'time') {
  const e = state.event;
  if (!e) return;
  if (e.id === 'celeb') for (const g of state.guests) if (g.id === e.guest) g.celeb = 0;
  state.event = null;
  state.evT = T.EVENT_GAP[0] + state.rnd() * (T.EVENT_GAP[1] - T.EVENT_GAP[0]);
  refreshRate(state);
  state.events.push({ type: 'eventEnd', event: e, how });
}

function updateEvent(state, ter, dt) {
  if (state.event) {
    state.event.t -= dt;
    // The celebrity may leave the mountain before the time is up.
    if (state.event.id === 'celeb' && !state.guests.some((g) => g.id === state.event.guest)) state.event.t = 0;
    if (state.event.t <= 0) endEvent(state);
    return;
  }
  if (state.rush > 0) return;
  state.evT -= dt;
  if (state.evT <= 0) startEvent(state, ter);
}

// The action of the current event: secure the lifts in a storm, or meet the celebrity.
// Pays a number of seconds of the steady income. Returns what was paid, or 0.
export function eventAction(state, id) {
  const e = state.event;
  if (!e || e.id !== id || (id !== 'storm' && id !== 'celeb')) return 0;
  const pay = Math.round(state.steady * (id === 'storm' ? T.STORM_PAY : T.CELEB_PAY));
  state.money += pay; state.earned += pay;
  state.eventsDone = (state.eventsDone || 0) + 1;
  endEvent(state, 'done');
  state.events.push({ type: 'eventPay', id, pay });
  return pay;
}
export const celebGuest = (state) => state.event && state.event.id === 'celeb' ? state.guests.find((g) => g.id === state.event.guest) || null : null;

export function buy(state, ter, id) {
  const o = offer(state, id);
  if (o.maxed || o.locked || o.cost > state.money + 1e-9) return false;
  state.money -= o.cost;
  if (id === 'lift') {
    const l = addLift(state, ter, state.open);
    state.open++;
    syncHuts(state); syncJumps(state, ter);
    state.events.push({ type: 'lift', lift: l });
  } else if (id === 'upgrade') {
    const l = o.target;
    l.type = state.types[l.i] = NEXT_TYPE[l.type];
    shapeLift(l, ter);
    l.clock = 0;
    for (const g of state.guests) if (g.st === 'ride' && g.lift === l.id) g.s = Math.min(g.s, l.len - 0.01);
    state.events.push({ type: 'world' }, { type: 'upgraded', lift: l });
  } else {
    state.up[id]++;
    if (id === 'hut') syncHuts(state);
    if (id === 'jump') syncJumps(state, ter);
    if (id === 'night' && state.up.night === 1) state.events.push({ type: 'world' });
  }
  checkUnlocks(state);
  refreshRate(state);
  checkGoals(state);
  return true;
}

export function startRush(state) {
  if (state.rush > 0 || state.rushWait > 0) return false;
  state.rush = T.RUSH_TIME;
  refreshRate(state);
  return true;
}

// ---------- quests ----------

const gondolas = (s) => s.lifts.filter((l) => l.type === 'gondola').length;
export const GOALS = [
  { id: 'r25', text: 'Sell 25 rides', reward: 30, test: (s) => [s.rides, 25] },
  { id: 'g1', text: 'Buy More guests', reward: 40, test: (s) => [s.up.guests, 1] },
  { id: 'l2', text: 'Open lift 2', reward: 150, test: (s) => [s.open, 2] },
  { id: 'c1', text: 'Upgrade a lift to a chairlift', reward: 800, test: (s) => [s.lifts.filter((l) => l.i < 2 && l.type !== 'drag').length, 1] },
  { id: 's3', text: 'Lift speed level 3', reward: 200, test: (s) => [s.up.speed, 3] },
  { id: 'r500', text: 'Sell 500 rides', reward: 500, test: (s) => [s.rides, 500] },
  { id: 'h1', text: 'Build a ski hut', reward: 1500, test: (s) => [s.up.hut, 1] },
  { id: 'g100', text: 'Room for 100 guests', reward: 8000, test: (s) => [capAt(s.up.guests), 100] },
  { id: 'l3', text: 'Open lift 3', reward: 2000, test: (s) => [s.open, 3] },
  { id: 'j1', text: 'Build a jump park', reward: 400, test: (s) => [s.up.jump, 1] },
  { id: 't15', text: 'Ticket price level 15', reward: 5000, test: (s) => [s.up.ticket, 15] },
  { id: 'k10', text: 'See 10 tricks', reward: 1200, test: (s) => [s.tricks, 10] },
  { id: 'sn1', text: 'Buy snow guns', reward: 6000, test: (s) => [s.up.cannon, 1] },
  { id: 'sc3', text: 'Ski school level 3', reward: 12000, test: (s) => [s.up.school, 3] },
  { id: 'k100', text: 'See 100 tricks', reward: 150000, test: (s) => [s.tricks, 100] },
  { id: 'e1m', text: 'Earn $10M in total', reward: 200000, test: (s) => [s.earned, 1e7] },
  { id: 'l4', text: 'Open lift 4', reward: 25000, test: (s) => [s.open, 4] },
  { id: 'n1', text: 'Start night skiing', reward: 80000, test: (s) => [s.up.night, 1] },
  { id: 'p20', text: 'Play for 20 minutes', reward: 40000, test: (s) => [Math.floor(s.time / 60), 20] },
  { id: 'j10', text: 'Jump park level 10', reward: 1500000, test: (s) => [s.up.jump, 10] },
  { id: 'r10k', text: 'Sell 10,000 rides', reward: 60000, test: (s) => [s.rides, 10000] },
  { id: 'l5', text: 'Open lift 5, the first gondola', reward: 2000000, test: (s) => [s.open, 5] },
  { id: 're1', text: 'Open the restaurant', reward: 700000, test: (s) => [s.up.resto, 1] },
  { id: 'e1b', text: 'Earn $10B in total', reward: 20000000, test: (s) => [s.earned, 1e10] },
  { id: 'l6', text: 'Open lift 6 to the summit', reward: 100000000, test: (s) => [s.open, 6] },
  { id: 'all', text: 'Make every lift a gondola', reward: 1000000000, test: (s) => [gondolas(s), 6] },
];

const rewardOf = (state, g) => Math.round(g.reward * costScale(state) * T.MONEY);
// Only a few quests are open at a time: the first ones on the list that are not done yet.
const openGoals = (state) => GOALS.filter((g) => !state.done[g.id]).slice(0, T.QUESTS_OPEN);

// Finishing a quest pays its reward and opens the next one on the list.
export function checkGoals(state) {
  for (let again = true; again;) {
    again = false;
    for (const g of openGoals(state)) {
      const [have, want] = g.test(state);
      if (have < want) continue;
      state.done[g.id] = 1;
      const reward = rewardOf(state, g);
      state.money += reward;
      state.events.push({ type: 'goal', goal: g, reward });
      again = true;
    }
  }
}

// Every quest with where it stands, for the quest list. state = 'done', 'open' or 'locked'.
export function questList(state) {
  const open = openGoals(state);
  return GOALS.map((g) => {
    const [have, want] = g.test(state), done = !!state.done[g.id];
    return { id: g.id, text: g.text, done, state: done ? 'done' : open.includes(g) ? 'open' : 'locked',
      have: done ? want : Math.min(have, want), want, reward: rewardOf(state, g) };
  });
}
export const currentGoal = (state) => questList(state).find((q) => q.state === 'open') || null;

export const canMoveOn = (state) => state.open >= T.LIFT_COUNT && state.lifts.every((l) => l.type === 'gondola');
export const nextGame = (state) => newGame(state.level + 1, state.life, state.unl);

// ---------- guests ----------

function walkTo(g, x, z, then) { g.st = 'walk'; g.tx = x; g.tz = z; g.then = then; }

// from = the middle of the car or coach the guest climbs out of: they step out to (x, z) first.
function spawnGuest(state, ter, x, z, from = null) {
  const r = state.rnd, b = ter.base;
  const g = { id: state.nextGuest++, col: (r() * 12) | 0, seed: r(), x, z, y: ter.ground(x, z), face: Math.PI, board: r() < T.BOARDERS ? 1 : 0,
    st: 'walk', node: 0, runs: T.RUNS[0] + ((r() * (T.RUNS[1] - T.RUNS[0] + 1)) | 0), lift: 0, piste: 0, s: 0, seat: 0, air: 0, k: 1 };
  walkTo(g, b.x + (r() - 0.5) * 4, b.z - 2.2 - r() * 1.5, 'decide');
  if (from) Object.assign(g, { st: 'alight', t: 0, fx: from.x, fz: from.z, dx: x, dz: z, x: from.x, z: from.z, k: STEP_K });
  state.guests.push(g);
  return g;
}

// ---------- cars and coaches (looks only) ----------
// Guests come by road. A car drives in, finds a free bay (close to the village if it can) and
// its people climb out one by one. When they have had enough they walk back, climb in, and the
// car backs out and drives off. When many are wanted at once, or the car park is full, a coach
// brings them instead, and guests without a car wait at the stop for a coach home.
// Each bay has a path: a rounded line of points from the start of the road into the bay.
// s = metres along it. Leaving cars back out to the aisle and follow a second path out.
const STEP_K = 0.35, STEP_T = 0.45; // how small a guest is when inside, how long climbing in or out takes

// A line through the corners, with each corner rounded off. backS = where the last turn starts.
function roundPath(corners, r = 1) {
  const pts = [corners[0]];
  let back = 0;
  for (let i = 1; i < corners.length - 1; i++) {
    const a = corners[i - 1], p = corners[i], b = corners[i + 1];
    const la = Math.hypot(p.x - a.x, p.z - a.z), lb = Math.hypot(b.x - p.x, b.z - p.z), rr = Math.min(r, la / 2, lb / 2);
    const s = { x: p.x + (a.x - p.x) / la * rr, z: p.z + (a.z - p.z) / la * rr }, e = { x: p.x + (b.x - p.x) / lb * rr, z: p.z + (b.z - p.z) / lb * rr };
    back = pts.length;
    for (let k = 0; k <= 6; k++) { const t = k / 6, u = 1 - t; pts.push({ x: u * u * s.x + 2 * u * t * p.x + t * t * e.x, z: u * u * s.z + 2 * u * t * p.z + t * t * e.z }); }
  }
  pts.push(corners[corners.length - 1]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { pts, cum, len: cum[cum.length - 1], backS: cum[back], roadS: cum[Math.min(1, pts.length - 1)] };
}
// Fills c.x, c.z and c.yaw at s metres along a path. The car always faces the way the path goes.
function onPath(p, s, c) {
  s = clamp(s, 0, p.len);
  let i = 0;
  while (i < p.pts.length - 2 && p.cum[i + 1] < s) i++;
  const a = p.pts[i], b = p.pts[i + 1], t = (s - p.cum[i]) / Math.max(1e-6, p.cum[i + 1] - p.cum[i]);
  c.x = a.x + (b.x - a.x) * t; c.z = a.z + (b.z - a.z) * t;
  if (Math.abs(b.x - a.x) + Math.abs(b.z - a.z) > 1e-6) c.yaw = Math.atan2(b.x - a.x, b.z - a.z);
}
const pathIn = (ter, n) => {
  const R = ter.road, b = R.bays[n];
  R.paths ||= [];
  if (!R.paths[n]) {
    const pts = b.aisle < 0 ? [{ x: R.x0, z: R.z }, { x: b.x, z: R.z }, { x: b.x, z: b.z }]
      : [{ x: R.x0, z: R.z }, { x: R.lot.inX, z: R.z }, { x: R.lot.inX, z: R.lot.aisles[b.aisle] }, { x: b.x, z: R.lot.aisles[b.aisle] }, { x: b.x, z: b.z }];
    R.paths[n] = roundPath(pts);
    R.paths[n].roadS = b.aisle < 0 ? R.paths[n].backS : R.lot.inX - R.x0 - 1;
  }
  return R.paths[n];
};
const pathOut = (ter, n) => {
  const R = ter.road, b = R.bays[n];
  R.exits ||= [];
  if (!R.exits[n]) {
    const from = { x: b.x - 1, z: b.aisle < 0 ? R.z : R.lot.aisles[b.aisle] };
    const pts = b.aisle < 0 ? [from, { x: R.x1, z: R.z }] : [from, { x: R.lot.outX, z: from.z }, { x: R.lot.outX, z: R.z }, { x: R.x1, z: R.z }];
    R.exits[n] = roundPath(pts);
    R.exits[n].roadS = b.aisle < 0 ? 0 : R.exits[n].len - (R.x1 - R.lot.outX) + 1;
  }
  return R.exits[n];
};

// Where a vehicle is right now: fills c.x, c.z, c.yaw.
export function placeCar(ter, c) {
  const R = ter.road;
  if (c.kind === 'bus') {
    // The coach pulls into a lay-by at the stop.
    const e = 0.5;
    const off = (x) => 1.6 * smoothstep(R.stop - 9, R.stop - 2, x) * (1 - smoothstep(R.stop + 2, R.stop + 9, x));
    c.z = R.z - off(c.x);
    c.yaw = Math.atan2(1, -(off(c.x + e) - off(c.x - e)) / (2 * e));
    return;
  }
  if (c.bay < 0) { c.z = R.z; c.yaw = Math.PI / 2; return; }
  onPath(c.st === 'leave' ? pathOut(ter, c.bay) : pathIn(ter, c.bay), c.s, c);
}
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// load = people still inside to climb out, pax = how many it came with (and takes home).
function addCar(state, ter, kind, load, bay) {
  const r = state.rnd, R = ter.road;
  const c = { id: state.nextCar++, kind, col: (r() * 8) | 0, load, pax: load, bay, st: 'in', s: 0, x: R.x0, z: R.z, yaw: Math.PI / 2,
    wait: 0, t: 0, taken: 0, inside: 0, busy: 0, door: 0, v: 0 };
  state.cars.push(c);
  return c;
}

// The door a guest uses: cars on both sides in turn, the coach at its front door.
function doorOf(c, n) {
  if (c.kind === 'bus') return { x: c.x + 1.25, z: c.z - 0.78 };
  const lx = n % 2 ? -0.6 : 0.6, lz = 0.12, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
  return { x: c.x + lx * cs + lz * sn, z: c.z - lx * sn + lz * cs };
}
const seatOf = (c) => (c.kind === 'bus' ? { x: c.x + 1.25, z: c.z - 0.15 } : { x: c.x, z: c.z });

// Free bays near the village and the road fill first, with a little chance in it.
const freeBay = (state, ter) => {
  const used = new Set(state.cars.map((c) => c.bay)), B = ter.road.bays, bx = ter.base.x;
  let best = -1, score = Infinity;
  for (let i = 0; i < B.length; i++) {
    if (used.has(i)) continue;
    const s = Math.abs(B[i].x - bx) + B[i].row * 5 + state.rnd() * 10;
    if (s < score) { score = s; best = i; }
  }
  return best;
};

// A game that is opened or loaded starts with people already on the mountain and cars in the bays.
function prefill(state, ter) {
  const b = ter.base, r = state.rnd, n = Math.round(guestCap(state) * 0.6);
  for (let i = 0; i < n; i++) {
    const g = spawnGuest(state, ter, b.x - 4 + r() * 8, b.z + 0.4 + r() * 2.6);
    g.x = g.tx; g.z = g.tz; g.y = ter.ground(g.x, g.z); g.st = 'decide';
  }
  for (let i = 0, cars = Math.min(ter.road.bays.length - 4, Math.ceil(n / 2.5)); i < cars; i++) {
    const c = addCar(state, ter, 'car', 0, freeBay(state, ter));
    c.pax = 1 + ((r() * 4) | 0);
    c.st = 'park'; c.s = pathIn(ter, c.bay).len;
    placeCar(ter, c);
  }
}

// A guest who is done for the day: a car that still has a free seat (one already filling up
// first), or else the coach stop.
function rideHome(state, ter, g) {
  let best = null;
  for (const c of state.cars) {
    if (c.kind !== 'car' || c.st !== 'park' || c.load > 0 || c.taken >= c.pax) continue;
    if (!best || (c.taken > 0) > (best.taken > 0) || ((c.taken > 0) === (best.taken > 0) && c.id < best.id)) best = c;
  }
  if (best) {
    const d = doorOf(best, best.taken);
    best.taken++; g.car = best.id;
    walkTo(g, d.x, d.z, 'board');
    return;
  }
  const R = ter.road, r = state.rnd;
  g.car = 0;
  walkTo(g, R.stop - 1.6 + r() * 3.2, R.z - 2.75 - r() * 0.55, 'wait');
}

function updateCars(state, ter, dt) {
  const R = ter.road, r = state.rnd, cars = state.cars;
  // Who is still wanted on the mountain, minus those already on their way.
  let coming = 0, bus = false;
  for (const c of cars) { coming += c.load; if (c.kind === 'bus' && (c.st === 'in' || c.st === 'stop')) bus = true; }
  const need = guestCap(state) - state.guests.length - coming;
  state.spawn += dt;
  if (state.spawn >= 1.1) {
    state.spawn = 0;
    // People at the stop: a coach comes for them when enough are waiting, or one waited long.
    let waiting = 0, long = 0;
    for (const g of state.guests) if (g.st === 'wait') { waiting++; long = Math.max(long, state.time - g.since); }
    if (need > 0) {
      const bay = freeBay(state, ter);
      if ((need >= 12 || bay < 0) && !bus) addCar(state, ter, 'bus', Math.min(30, need), -1);
      else if (bay >= 0) addCar(state, ter, 'car', Math.min(need, 1 + ((r() * 4) | 0)), bay);
    } else if (!bus && (waiting >= 8 || (waiting && long > 18))) addCar(state, ter, 'bus', 0, -1);
    else if ((state.through -= 1.1) <= 0) {
      // Now and then somebody just drives past.
      state.through = 5 + r() * 9;
      addCar(state, ter, 'car', 0, -1);
    }
  }
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    c.busy = Math.max(0, c.busy - dt);
    c.door += ((c.busy > 0 ? 1 : 0) - c.door) * (1 - Math.exp(-dt * 9));
    let gone = false;
    if (c.kind === 'bus') {
      if (c.st === 'in') {
        c.x += Math.min(12, 1.2 + (R.stop - c.x) * 0.9) * dt;
        if (c.x >= R.stop - 0.05) { c.st = 'stop'; c.wait = 2.5; c.t = 0.4; }
      } else if (c.st === 'stop') {
        c.wait -= dt; c.t -= dt;
        // People climb out one after the other, then those at the stop climb in.
        if (c.load > 0 && c.t <= 0) { const d = doorOf(c, 0); spawnGuest(state, ter, d.x + (r() - 0.5) * 0.3, d.z - r() * 0.3, seatOf(c)); c.load--; c.t = 0.16; c.busy = 0.5; }
        if (c.load <= 0) {
          for (const g of state.guests) if (g.st === 'wait' && c.taken < 30) { const d = doorOf(c, 0); g.car = c.id; c.taken++; walkTo(g, d.x, d.z, 'board'); }
        }
        if (c.wait <= 0 && c.load <= 0 && c.inside >= c.taken) c.st = 'out';
      } else { c.x += Math.min(12, 1.2 + (c.x - R.stop) * 0.9) * dt; gone = c.x > R.x1; }
    } else if (c.bay < 0) { c.x += 11 * dt; gone = c.x > R.x1; } // just driving past
    else if (c.st === 'in') {
      // Fast along the road, slow in the car park, braking into the bay.
      const p = pathIn(ter, c.bay), v = c.s < p.roadS ? Math.min(12, 3.2 + (p.roadS - c.s) * 0.9) : Math.min(3.2, 1 + (p.len - c.s) * 0.9);
      c.s = Math.min(p.len, c.s + v * dt);
      if (c.s >= p.len - 0.01) { c.s = p.len; c.st = 'park'; c.t = 0.25; }
    } else if (c.st === 'park') {
      c.t -= dt;
      if (c.load > 0 && c.t <= 0) {
        const d = doorOf(c, c.pax - c.load);
        spawnGuest(state, ter, d.x, d.z, seatOf(c));
        c.load--; c.t = 0.4; c.busy = STEP_T + 0.25;
      }
      // Somebody got in and nobody else is on the way to it: off it goes.
      if (c.load <= 0 && c.taken > 0 && c.inside >= c.taken) { c.wait += dt; if (c.wait > 0.6) c.st = 'back'; } else c.wait = 0;
    } else if (c.st === 'back') {
      const p = pathIn(ter, c.bay);
      c.s -= 1.8 * dt;
      if (c.s <= p.backS) { c.st = 'leave'; c.s = 0; c.v = 0.5; }
    } else if (c.st === 'leave') {
      const p = pathOut(ter, c.bay);
      c.v = Math.min(c.s < p.roadS ? 3.2 : 11, c.v + 5 * dt);
      c.s += c.v * dt;
      gone = c.s >= p.len;
    }
    if (gone) { cars[i] = cars[cars.length - 1]; cars.pop(); continue; }
    placeCar(ter, c);
  }
}

// At the car park or at the top of a lift: take a lift from here, ski down, or go home.
function decide(state, ter, g) {
  const r = state.rnd, here = [];
  for (const l of state.lifts) if (l.from === g.node) here.push(l);
  let pick = null;
  if (g.runs > 0 && here.length) {
    let sum = g.node > 0 ? 0.45 : 0;
    const w = here.map((l) => { const v = (1 + 0.25 * l.i) / (1 + l.queue.length / (LIFTS[l.type].seats * 3)); sum += v; return v; });
    let x = r() * sum;
    for (let k = 0; k < here.length; k++) { x -= w[k]; if (x <= 0) { pick = here[k]; break; } }
  }
  if (pick) {
    g.lift = pick.id;
    walkTo(g, pick.a.x - Math.sin(pick.dir) * 1.5 + (g.seed - 0.5), pick.a.z - Math.cos(pick.dir) * 1.5 + ((g.seed * 7) % 1 - 0.5), 'queue');
  } else if (g.node > 0) {
    const p = state.pisteById[g.node];
    g.piste = p.id; g.s = 0;
    walkTo(g, p.pts[0].x, p.pts[0].z, 'ski');
  } else rideHome(state, ter, g);
}

// The lifts carry guests for the picture. What they earn is paid by the clock, see tick().
function updateLifts(state, dt) {
  const sm = speedOf(state);
  for (const l of state.lifts) {
    if (closed(state, l)) continue; // the wind has stopped it
    const L = LIFTS[l.type], every = L.interval / sm;
    l.clock += dt;
    l.travel += L.speed * sm * dt;
    l.pop += l.rate * dt;
    while (l.clock >= every) {
      l.clock -= every;
      for (let n = 0; n < L.seats && l.queue.length; n++) {
        const g = l.queue.shift();
        g.st = 'ride'; g.s = l.clock * L.speed * sm; g.seat = n;
        l.riders++;
      }
    }
  }
}

function updateGuests(state, ter, dt) {
  const guests = state.guests, sm = speedOf(state), ski = T.SKI * skiOf(state);
  for (let i = guests.length - 1; i >= 0; i--) {
    const g = guests[i];
    switch (g.st) {
      case 'decide':
        decide(state, ter, g);
        break;
      case 'walk': {
        const dx = g.tx - g.x, dz = g.tz - g.z, d = Math.hypot(dx, dz), step = T.WALK * dt;
        if (d > 0.01) g.face = Math.atan2(dx, dz);
        if (d <= step) {
          g.x = g.tx; g.z = g.tz;
          if (g.then === 'queue') { const l = state.liftById[g.lift]; l.queue.push(g); g.st = 'queue'; }
          else { g.st = g.then; g.t = 0; g.since = state.time; }
        } else { g.x += dx / d * step; g.z += dz / d * step; }
        g.y = ter.ground(g.x, g.z);
        break;
      }
      case 'queue': {
        const l = state.liftById[g.lift];
        g.x = l.a.x; g.z = l.a.z; g.y = l.pts[0].g;
        break;
      }
      case 'ride': {
        const l = state.liftById[g.lift], L = LIFTS[l.type];
        if (!closed(state, l)) g.s += L.speed * sm * dt;
        along(l.pts, l.cum, g.s, tmp, L.ground);
        g.x = tmp.x; g.z = tmp.z; g.y = tmp.y; g.face = l.dir;
        if (g.s >= l.len) {
          l.riders--; g.runs--;
          g.y = ter.height(g.x, g.z);
          g.node = l.to; g.st = 'decide';
        }
        break;
      }
      case 'ski': {
        const p = state.pisteById[g.piste], before = g.s;
        along(p.pts, p.cum, g.s, tmp);
        const sl = p.sl[Math.min(p.sl.length - 1, tmp.i)];
        g.s += ski * (0.85 + 0.3 * g.seed) * (0.8 + clamp(sl * 1.6, -0.2, 0.9)) * dt;
        const ox = tmp.x, oz = tmp.z;
        along(p.pts, p.cum, Math.min(g.s, p.len), tmp);
        if (Math.hypot(tmp.x - ox, tmp.z - oz) > 1e-4) g.face = Math.atan2(tmp.x - ox, tmp.z - oz);
        g.x = tmp.x; g.z = tmp.z; g.y = tmp.y;
        if (g.air > 0) g.air = Math.max(0, g.air - dt);
        // Passing the kicker: now and then somebody takes it, and the crowd pays for the show.
        if (p.kick && before < p.kick && g.s >= p.kick && state.rnd() < trickChance(state.up.jump)) {
          g.air = T.AIR_TIME;
          const pay = trickPay(state, p.i);
          state.money += pay; state.earned += pay; state.tricks++; state.life.tricks++;
          state.events.push({ type: 'trick', x: g.x, z: g.z, y: g.y, pay });
        }
        if (g.s >= p.len) { g.node = p.to; g.air = 0; g.st = 'decide'; }
        break;
      }
      case 'alight': {
        // Out of the car: from the seat to the door, growing to full size, then off to the lifts.
        g.t += dt;
        const u = Math.min(1, g.t / STEP_T);
        g.x = g.fx + (g.dx - g.fx) * u; g.z = g.fz + (g.dz - g.fz) * u; g.k = STEP_K + (1 - STEP_K) * u;
        g.face = Math.atan2(g.dx - g.fx, g.dz - g.fz); g.y = ter.ground(g.x, g.z);
        if (u >= 1) { g.k = 1; g.st = 'walk'; }
        break;
      }
      case 'board': {
        // Into the car: from the door to the seat, shrinking away.
        const c = state.cars.find((v) => v.id === g.car);
        if (!c) { g.st = 'gone'; break; }
        if (g.t === 0) { g.fx = g.x; g.fz = g.z; }
        g.t += dt; c.busy = Math.max(c.busy, 0.3);
        const u = Math.min(1, g.t / STEP_T), to = seatOf(c);
        g.x = g.fx + (to.x - g.fx) * u; g.z = g.fz + (to.z - g.fz) * u; g.k = 1 - (1 - STEP_K) * u;
        g.face = Math.atan2(to.x - g.fx, to.z - g.fz); g.y = ter.ground(g.x, g.z);
        if (u >= 1) { c.inside++; g.st = 'gone'; }
        break;
      }
    }
    if (g.st === 'gone') { guests[i] = guests[guests.length - 1]; guests.pop(); }
  }
}

// ---------- the clock ----------

// Looks only: what the sky does today.
function weatherOf(state) {
  const r = rngFrom([(state.day * 7919 + mapOf(state).seed) >>> 0])();
  return state.day === 0 || r < 0.5 ? 'sun' : r < 0.74 ? 'cloud' : 'snow';
}
// Minutes since midnight, for the position of the sun.
export const clockOf = (state) => 500 + ((state.time % T.DAY_LENGTH) / T.DAY_LENGTH) * 500;

export function tick(state, ter, dt) {
  state.time += dt; state.life.time += dt;
  if (state.rush > 0) { state.rush -= dt; if (state.rush <= 0) { state.rush = 0; state.rushWait = T.RUSH_WAIT; refreshRate(state); state.events.push({ type: 'rushEnd' }); } }
  else if (state.rushWait > 0) state.rushWait = Math.max(0, state.rushWait - dt);

  const day = Math.floor(state.time / T.DAY_LENGTH);
  if (day !== state.day) { state.day = day; state.weather = weatherOf(state); state.events.push({ type: 'weather' }); }

  // The steady income: the same every second until something is bought.
  const pay = state.rate * dt, sold = state.rideRate * dt;
  state.money += pay; state.earned += pay;
  state.rides += sold; state.life.rides += sold;

  // New guests keep coming by road until the mountain holds as many as it has room for.
  updateCars(state, ter, dt);
  updateEvent(state, ter, dt);

  updateLifts(state, dt);
  updateGuests(state, ter, dt);

  state.goalT += dt;
  if (state.goalT >= 0.5) { state.goalT = 0; checkUnlocks(state); checkGoals(state); }
}

// ---------- showing numbers ----------

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
export function short(n) {
  if (!isFinite(n)) return '∞';
  const neg = n < 0; n = Math.abs(n);
  if (n < 1000) { const v = n < 10 ? Math.round(n * 100) / 100 : n < 100 ? Math.round(n * 10) / 10 : Math.round(n); return (neg ? '-' : '') + (v >= 1000 ? '1K' : String(v)); }
  let u = Math.min(UNITS.length - 1, Math.floor(Math.log10(n) / 3)), v = n / Math.pow(1000, u);
  if (v >= 999.5 && u < UNITS.length - 1) { u++; v /= 1000; }
  return (neg ? '-' : '') + (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + UNITS[u];
}
// Money: always whole dollars, with a dollar sign. $7, $850, $5.60K, $15.1M.
export function money(n) {
  const neg = n < 0; n = Math.abs(n);
  if (n < 999.5) return (neg ? '-$' : '$') + Math.round(n);
  return (neg ? '-$' : '$') + short(Math.max(1000, n));
}
