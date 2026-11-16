// First Chair: the idle game. The resort runs on its own: guests arrive, ride,
// ski and pay. The player spends the money on upgrades. Nothing in here touches
// three.js or the page, so the rules can be run in plain Node.
import { T, LIFTS, NEXT_TYPE } from './tuning.js';
import { MAPS } from './maps.js';
import { makeTerrain, rngFrom, clamp } from './terrain.js';
import { liftGeom, pisteGeom, along } from './network.js';
import { planLifts } from './layout.js';

const tmp = { x: 0, y: 0, z: 0, i: 0 };
export const UPGRADES = ['lift', 'upgrade', 'speed', 'guests', 'ticket', 'hut'];

export const mapOf = (state) => MAPS[state.level % MAPS.length];
export const costScale = (state) => Math.pow(T.NEXT_COST, state.level);
export const fameOf = (state) => Math.pow(T.FAME, state.level);
const fareScale = (state) => Math.pow(T.NEXT_FARE * T.FAME, state.level);

// ---------- state ----------

export function newGame(level = 0) {
  return {
    v: 2, level, money: T.START_MONEY * Math.pow(T.NEXT_COST, level), earned: 0, rides: 0, time: 0,
    open: 1, types: null, up: { speed: 0, guests: 0, ticket: 0, hut: 0 },
    done: {}, rush: 0, rushWait: 0,
  };
}

export const toSave = (s) => ({
  v: 2, level: s.level, money: s.money, earned: s.earned, rides: s.rides, time: s.time,
  open: s.open, types: s.types.slice(), up: { ...s.up }, done: { ...s.done }, rushWait: Math.max(0, s.rushWait + s.rush),
});

export function fromSave(d) {
  if (!d || d.v !== 2 || !Array.isArray(d.types) || !d.up) return null;
  const s = newGame(d.level | 0);
  s.money = +d.money || 0; s.earned = +d.earned || 0; s.rides = +d.rides || 0; s.time = +d.time || 0;
  s.open = clamp(d.open | 0, 1, T.LIFT_COUNT);
  s.types = d.types.slice(0, T.LIFT_COUNT);
  for (const k of Object.keys(s.up)) s.up[k] = Math.max(0, d.up[k] | 0);
  s.done = { ...(d.done || {}) };
  s.rushWait = Math.max(0, +d.rushWait || 0);
  return s;
}

// Builds everything that is not saved: the mountain, the lifts and pistes on it, the guests.
export function attach(state) {
  const map = mapOf(state), ter = makeTerrain(map);
  state.plan = planLifts(ter, map);
  if (!state.types || state.types.length !== state.plan.length) state.types = state.plan.map((p) => p.type);
  state.lifts = []; state.pistes = []; state.buildings = []; state.guests = []; state.events = [];
  state.liftById = {}; state.pisteById = {}; state.buildingById = {};
  state.rnd = rngFrom([(map.seed * 31 + state.level * 977 + Math.floor(state.time)) >>> 0]);
  state.nextGuest = 1; state.spawn = 0; state.rate = 0; state.bank = 0; state.bankT = 0; state.goalT = 0;
  state.day = Math.floor(state.time / T.DAY_LENGTH);
  state.weather = weatherOf(state);
  for (let i = 0; i < state.open; i++) addLift(state, ter, i);
  syncHuts(state);
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
    dir: Math.atan2(p.b.x - p.a.x, p.b.z - p.a.z), queue: [], clock: 0, travel: 0, riders: 0, pop: 0 };
  shapeLift(l, ter);
  const g = pisteGeom(ter, p.wps);
  const piste = { id: i + 1, i, pts: g.pts, cum: g.cum, sl: g.sl, len: g.len, diff: g.diff, to: p.from + 1 };
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

// ---------- numbers ----------

export const rushing = (state) => state.rush > 0;
export const speedOf = (state) => (1 + T.SPEED_GAIN * state.up.speed) * (rushing(state) ? T.RUSH_SPEED : 1);
const capAt = (lvl) => Math.min(T.GUESTS_MAX, T.GUESTS_START + T.GUESTS_STEP * lvl);
export const guestCap = (state) => Math.round(capAt(state.up.guests) * (rushing(state) ? T.RUSH_GUESTS : 1));
const ticketAt = (lvl) => Math.pow(T.TICKET_GAIN, lvl);
export const fare = (state, i) => T.FARE[i] * ticketAt(state.up.ticket) * (1 + T.HUT_GAIN * state.up.hut) * fareScale(state);

const TABLE = { speed: T.SPEED, guests: T.GUESTS, ticket: T.TICKET, hut: T.HUT };
const pct = (v) => Math.round(v * 100) + '%';

// What a button offers right now: { name, level, cost, now, next, note, maxed, locked }.
export function offer(state, id) {
  const cs = costScale(state);
  if (id === 'lift') {
    if (state.open >= T.LIFT_COUNT) return { name: 'New lift', maxed: true, note: 'All 6 lifts open' };
    const type = state.types[state.open];
    return { name: 'New lift', level: state.open, cost: T.LIFT_COST[state.open] * cs,
      note: `Lift ${state.open + 1}: ${LIFTS[type].name.toLowerCase()}` };
  }
  if (id === 'upgrade') {
    const chairs = state.types.filter((t, i) => i < 2 && t !== 'drag').length;
    const gondolas = state.types.filter((t, i) => i < 4 && t === 'gondola').length;
    const drag = state.lifts.find((l) => l.type === 'drag'), chair = state.lifts.find((l) => l.type === 'chair');
    const opts = [];
    if (drag) opts.push({ lift: drag, cost: T.CHAIR_COST[chairs] * cs });
    if (chair) opts.push({ lift: chair, cost: T.GONDOLA_COST[gondolas] * cs });
    if (!opts.length) {
      return state.open >= T.LIFT_COUNT ? { name: 'Upgrade lift', maxed: true, note: 'Every lift is a gondola' }
        : { name: 'Upgrade lift', locked: true, note: 'Open another lift first' };
    }
    opts.sort((a, b) => a.cost - b.cost);
    const o = opts[0], to = NEXT_TYPE[o.lift.type];
    return { name: 'Upgrade lift', level: chairs + gondolas, cost: o.cost, target: o.lift,
      note: `Lift ${o.lift.i + 1} → ${LIFTS[to].name.toLowerCase()}` };
  }
  const tb = TABLE[id], lvl = state.up[id];
  const base = { level: lvl, cost: tb.base * Math.pow(tb.growth, lvl) * cs, maxed: lvl >= tb.max };
  if (id === 'speed') return { ...base, name: 'Lift speed', note: base.maxed ? 'Fastest' : `${pct(1 + T.SPEED_GAIN * lvl)} → ${pct(1 + T.SPEED_GAIN * (lvl + 1))}` };
  if (id === 'guests') {
    const full = base.maxed || capAt(lvl) >= T.GUESTS_MAX;
    return { ...base, maxed: full, name: 'More guests', note: full ? 'The mountain is full' : `${capAt(lvl)} → ${capAt(lvl + 1)} guests` };
  }
  if (id === 'ticket') return { ...base, name: 'Ticket price', note: `x${short(ticketAt(lvl))} → x${short(ticketAt(lvl + 1))}` };
  return { ...base, name: 'Ski hut', note: base.maxed ? 'Best food in the Alps' : `Food +${pct(T.HUT_GAIN * lvl)} → +${pct(T.HUT_GAIN * (lvl + 1))}` };
}

export function buy(state, ter, id) {
  const o = offer(state, id);
  if (o.maxed || o.locked || o.cost > state.money + 1e-9) return false;
  state.money -= o.cost;
  if (id === 'lift') {
    const l = addLift(state, ter, state.open);
    state.open++;
    syncHuts(state);
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
  }
  checkGoals(state);
  return true;
}

export function startRush(state) {
  if (state.rush > 0 || state.rushWait > 0) return false;
  state.rush = T.RUSH_TIME;
  return true;
}

// ---------- milestones ----------

export const GOALS = [
  { id: 'r25', text: 'Sell 25 rides', reward: 30, test: (s) => [s.rides, 25] },
  { id: 'g1', text: 'Buy More guests', reward: 40, test: (s) => [s.up.guests, 1] },
  { id: 'l2', text: 'Open lift 2', reward: 150, test: (s) => [s.open, 2] },
  { id: 's3', text: 'Lift speed level 3', reward: 200, test: (s) => [s.up.speed, 3] },
  { id: 'r500', text: 'Sell 500 rides', reward: 500, test: (s) => [s.rides, 500] },
  { id: 'c1', text: 'Upgrade a lift to a chairlift', reward: 800, test: (s) => [s.lifts.filter((l) => l.i < 2 && l.type !== 'drag').length, 1] },
  { id: 'l3', text: 'Open lift 3', reward: 2000, test: (s) => [s.open, 3] },
  { id: 'h1', text: 'Build a ski hut', reward: 1500, test: (s) => [s.up.hut, 1] },
  { id: 't20', text: 'Ticket price level 15', reward: 5000, test: (s) => [s.up.ticket, 15] },
  { id: 'g100', text: 'Room for 100 guests', reward: 8000, test: (s) => [capAt(s.up.guests), 100] },
  { id: 'l4', text: 'Open lift 4', reward: 25000, test: (s) => [s.open, 4] },
  { id: 'r10k', text: 'Sell 10,000 rides', reward: 60000, test: (s) => [s.rides, 10000] },
  { id: 'l5', text: 'Open lift 5, the first gondola', reward: 400000, test: (s) => [s.open, 5] },
  { id: 'l6', text: 'Open lift 6 to the summit', reward: 5000000, test: (s) => [s.open, 6] },
  { id: 'all', text: 'Make every lift a gondola', reward: 50000000, test: (s) => [s.lifts.filter((l) => l.type === 'gondola').length, 6] },
];

export function checkGoals(state) {
  for (const g of GOALS) {
    if (state.done[g.id]) continue;
    const [have, want] = g.test(state);
    if (have >= want) {
      state.done[g.id] = 1;
      const reward = g.reward * costScale(state);
      state.money += reward;
      state.events.push({ type: 'goal', goal: g, reward });
    }
  }
}

export function currentGoal(state) {
  const g = GOALS.find((q) => !state.done[q.id]);
  if (!g) return null;
  const [have, want] = g.test(state);
  return { goal: g, have: Math.min(have, want), want, reward: g.reward * costScale(state) };
}

export const canMoveOn = (state) => state.open >= T.LIFT_COUNT && state.lifts.every((l) => l.type === 'gondola');
export const nextGame = (state) => newGame(state.level + 1);

// ---------- guests ----------

function walkTo(g, x, z, then) { g.st = 'walk'; g.tx = x; g.tz = z; g.then = then; }

function spawnGuest(state, ter) {
  const r = state.rnd, b = ter.base;
  const g = { id: state.nextGuest++, col: (r() * 12) | 0, seed: r(), x: b.x - 4 + r() * 8, z: b.z + 1.3 + r() * 2.4, y: 0, face: Math.PI,
    st: 'walk', node: 0, runs: T.RUNS[0] + ((r() * (T.RUNS[1] - T.RUNS[0] + 1)) | 0), lift: 0, piste: 0, s: 0, seat: 0 };
  walkTo(g, b.x + (r() - 0.5) * 4, b.z - 2.2 - r() * 1.5, 'decide');
  state.guests.push(g);
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
  } else {
    walkTo(g, ter.base.x - 4 + g.seed * 8, ter.base.z + 2.2, 'gone');
  }
}

function updateLifts(state, dt) {
  const sm = speedOf(state);
  for (const l of state.lifts) {
    const L = LIFTS[l.type], every = L.interval / sm;
    l.clock += dt;
    l.travel += L.speed * sm * dt;
    while (l.clock >= every) {
      l.clock -= every;
      for (let n = 0; n < L.seats && l.queue.length; n++) {
        const g = l.queue.shift();
        g.st = 'ride'; g.s = l.clock * L.speed * sm; g.seat = n;
        l.riders++;
        const f = fare(state, l.i);
        state.money += f; state.earned += f; state.bank += f; l.pop += f;
        state.rides++;
      }
    }
  }
}

function updateGuests(state, ter, dt) {
  const guests = state.guests, sm = speedOf(state);
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
          else g.st = g.then;
        } else { g.x += dx / d * step; g.z += dz / d * step; }
        g.y = ter.height(g.x, g.z);
        break;
      }
      case 'queue': {
        const l = state.liftById[g.lift];
        g.x = l.a.x; g.z = l.a.z; g.y = l.pts[0].g;
        break;
      }
      case 'ride': {
        const l = state.liftById[g.lift], L = LIFTS[l.type];
        g.s += L.speed * sm * dt;
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
        const p = state.pisteById[g.piste];
        along(p.pts, p.cum, g.s, tmp);
        const sl = p.sl[Math.min(p.sl.length - 1, tmp.i)];
        g.s += T.SKI * (0.85 + 0.3 * g.seed) * (0.8 + clamp(sl * 1.6, -0.2, 0.9)) * dt;
        const ox = tmp.x, oz = tmp.z;
        along(p.pts, p.cum, Math.min(g.s, p.len), tmp);
        if (Math.hypot(tmp.x - ox, tmp.z - oz) > 1e-4) g.face = Math.atan2(tmp.x - ox, tmp.z - oz);
        g.x = tmp.x; g.z = tmp.z; g.y = tmp.y;
        if (g.s >= p.len) { g.node = p.to; g.st = 'decide'; }
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
  state.time += dt;
  if (state.rush > 0) { state.rush -= dt; if (state.rush <= 0) { state.rush = 0; state.rushWait = T.RUSH_WAIT; state.events.push({ type: 'rushEnd' }); } }
  else if (state.rushWait > 0) state.rushWait = Math.max(0, state.rushWait - dt);

  const day = Math.floor(state.time / T.DAY_LENGTH);
  if (day !== state.day) { state.day = day; state.weather = weatherOf(state); state.events.push({ type: 'weather' }); }

  // New guests keep coming until the mountain holds as many as it has room for.
  const cap = guestCap(state);
  state.spawn += dt * Math.max(1.2, cap / 12);
  while (state.spawn >= 1) { state.spawn -= 1; if (state.guests.length < cap) spawnGuest(state, ter); }

  updateLifts(state, dt);
  updateGuests(state, ter, dt);

  // Income per second, smoothed over a few seconds.
  state.bankT += dt;
  if (state.bankT >= 1) {
    const now = state.bank / state.bankT;
    state.rate += (now - state.rate) * (state.rate === 0 ? 1 : 0.25);
    state.bank = 0; state.bankT = 0;
  }
  state.goalT += dt;
  if (state.goalT >= 0.5) { state.goalT = 0; checkGoals(state); }
}

// ---------- showing numbers ----------

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
export function short(n) {
  if (!isFinite(n)) return '∞';
  const neg = n < 0; n = Math.abs(n);
  if (n < 1000) { const v = n < 10 ? Math.round(n * 10) / 10 : Math.round(n); return (neg ? '-' : '') + (v >= 1000 ? '1K' : String(v)); }
  let u = Math.min(UNITS.length - 1, Math.floor(Math.log10(n) / 3)), v = n / Math.pow(1000, u);
  if (v >= 999.5 && u < UNITS.length - 1) { u++; v /= 1000; }
  return (neg ? '-' : '') + (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + UNITS[u];
}
