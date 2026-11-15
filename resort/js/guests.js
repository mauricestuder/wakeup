// First Chair: the guests. Each one walks, queues, rides, skis, eats and leaves,
// and decides what to do next every time they reach a spot.
import { T, LIFTS, FUN, WEATHER } from './tuning.js';
import { clamp } from './terrain.js';
import { along, nearestSpot } from './network.js';
import { fairTicket } from './economy.js';

const tmp = { x: 0, y: 0, z: 0, i: 0 };

const SAY = {
  queue: 'This queue is far too long.',
  hard: 'That piste was way too hard for me!',
  snow: 'Barely any snow on that piste.',
  hungry: 'I am starving and there is nowhere to eat.',
  hutfull: 'The hut is full. No seat anywhere.',
  price: 'Pretty expensive here.',
  nothing: 'There is nothing here for my level.',
  stranded: 'I am stuck up here, no way down!',
  fedup: 'I have had enough. Going home.',
  injury: 'Ouch. That fall hurt.',
};
const PRAISE = ['What a run!', 'Perfect snow today.', 'I love this place.', 'One more lap!', 'Great piste.', 'Best day in ages.'];

export function complain(state, g, what) {
  if (g.said[what]) return;
  g.said[what] = 1;
  g.thought = SAY[what];
  state.today.complaints[what] = (state.today.complaints[what] || 0) + 1;
}

export function spawnGuest(state, ter, rnd) {
  const net = state.net;
  let skill = 0;
  const r = rnd();
  if (r > T.SKILL_MIX[0]) skill = r > T.SKILL_MIX[0] + T.SKILL_MIX[1] ? 2 : 1;
  // Skiers with nothing to ski here stay away.
  if (net.V[skill][net.idx.BASE] <= 0.05) { state.today.away[skill]++; return null; }

  const ratio = state.ticket / fairTicket(state);
  const g = {
    id: state.nextId++, skill, st: 'decide', spot: net.idx.BASE,
    x: ter.base.x + (rnd() - 0.5) * 2.4, z: ter.base.z + 1 + rnd() * 1.6, y: 0, face: Math.PI,
    energy: 0.72 + rnd() * 0.28, hunger: rnd() * 0.25,
    happy: clamp(0.62 + (rnd() - 0.5) * 0.14 + WEATHER[state.weather].mood - clamp((ratio - 1) * 0.3, -0.05, 0.3), 0.05, 1),
    wait: 0, runs: 0, leaving: false, said: {}, recent: [], thought: 'Just arrived.',
    lift: 0, piste: 0, s: 0, s1: 0, toKey: null, then: null, tx: 0, tz: 0, timer: 0, noFood: 0,
    col: (rnd() * 12) | 0, seed: rnd(),
  };
  if (ratio > 1.25) complain(state, g, 'price');
  state.money += state.ticket;
  state.today.income.tickets += state.ticket;
  state.today.arrived++;
  const shops = state.buildings.filter((b) => b.type === 'rental').length;
  if (state.today.rented < shops * T.RENT_PER_SHOP && rnd() < T.RENT_SHARE) {
    state.today.rented++;
    state.money += T.RENT;
    state.today.income.rental += T.RENT;
  }
  state.guests.push(g);
  return g;
}

function walkTo(g, x, z, then, toKey) {
  g.st = 'walk'; g.tx = x; g.tz = z; g.then = then; g.toKey = toKey;
}

// Send a guest whose lift, piste or target vanished to the nearest spot.
export function rehome(state, g) {
  const net = state.net, i = nearestSpot(net, g.x, g.z), sp = net.spots[i];
  walkTo(g, sp.x, sp.z, 'decide', sp.key);
}

function depart(state, g, quiet) {
  g.st = 'gone';
  if (!quiet) { state.today.departed++; state.today.satSum += g.happy; }
}

function follow(state, g, e) {
  const net = state.net;
  if (e.type === 'lift') {
    g.st = 'queue'; g.wait = 0; g.lift = e.lift.id;
    e.lift.queue.push(g);
    if (!g.leaving) g.thought = `Taking the ${e.lift.name}.`;
  } else if (e.type === 'piste') {
    along(e.piste.pts, e.piste.cum, e.s0, tmp);
    g.piste = e.piste.id; g.s = e.s0; g.s1 = e.s1;
    g.thought = g.leaving ? 'Last run, then home.' : `Off down ${e.piste.name}.`;
    walkTo(g, tmp.x, tmp.z, 'ski', net.spots[e.to].key);
  } else {
    const sp = net.spots[e.to];
    walkTo(g, sp.x + (g.seed - 0.5) * 0.8, sp.z + (g.seed * 7 % 1 - 0.5) * 0.8, 'decide', sp.key);
  }
}

export function decide(state, g, rnd) {
  const net = state.net;
  let si = g.spot;
  if (si == null || si < 0 || si >= net.spots.length) si = g.spot = nearestSpot(net, g.x, g.z);
  const sp = net.spots[si];

  if (g.energy < 0.1 || state.closing) g.leaving = true;
  if (g.happy < 0.15 && !g.leaving) { g.leaving = true; complain(state, g, 'fedup'); }

  if (g.leaving) {
    if (sp.kind === 'base') return depart(state, g);
    const e = net.toBase.next[si];
    if (e) return follow(state, g, e);
    // No way down from here: wait for the ski patrol.
    complain(state, g, 'stranded');
    g.st = 'stuck'; g.timer = 6;
    return;
  }

  // Food.
  if (g.hunger > 0.6 && g.noFood <= 0) {
    if (sp.kind === 'hut') {
      const hut = sp.ref;
      if (hut.busy < T.HUT_SEATS) {
        hut.busy++;
        g.st = 'eat'; g.timer = T.EAT_TIME * (0.8 + g.seed * 0.4); g.hut = hut.id;
        state.money += state.food; state.today.income.food += state.food;
        if (state.food > T.FOOD * 1.4) { g.happy -= 0.04; complain(state, g, 'price'); }
        g.thought = 'Lunch time.';
        return;
      }
      complain(state, g, 'hutfull'); g.happy -= 0.03; g.noFood = 25;
    } else if (net.toFood.dist[si] < 1e8) {
      return follow(state, g, net.toFood.next[si]);
    } else if (g.hunger > 0.85) {
      complain(state, g, 'hungry');
    }
  }

  // Otherwise: the most fun thing to do from here.
  let best = null, bs = -1e9;
  for (const e of sp.edges) {
    let s = e.r[g.skill] + net.gamma * net.V[g.skill][e.to] + rnd() * 0.5;
    if (e.type === 'lift') {
      const L = LIFTS[e.lift.type];
      s -= e.lift.queue.length * L.interval / L.seats / 22;
    } else if (e.type === 'piste') {
      const k = g.recent.indexOf(e.piste.id);
      if (k >= 0) s -= 0.3 - k * 0.1;
    }
    // Never choose a place with no way back down.
    if (net.toBase.dist[e.to] > 1e8) s -= 8;
    if (s > bs) { bs = s; best = e; }
  }
  const stay = sp.kind === 'base' ? 0.05 : -2.5;
  if (!best || bs < stay) {
    g.leaving = true;
    if (g.runs === 0) { complain(state, g, 'nothing'); g.happy -= 0.25; }
    return decide(state, g, rnd);
  }
  follow(state, g, best);
}

function finishRun(state, ter, g, p, rnd) {
  const f = FUN[g.skill][p.diff], q = p.quality ?? 1, seg = Math.abs(g.s1 - g.runFrom);
  g.runs++;
  state.today.runs++;
  p.runs = (p.runs || 0) + 1;
  p.wear = Math.min(0.5, (p.wear || 0) + T.WEAR);
  g.recent.unshift(p.id); if (g.recent.length > 3) g.recent.pop();
  if (f > 0) {
    g.happy += 0.034 * f * (0.35 + 0.65 * q) * Math.min(1, seg / 14);
    if (f > 0.6 && q > 0.6 && rnd() < 0.3) g.thought = PRAISE[(rnd() * PRAISE.length) | 0];
  } else {
    g.happy += 0.07 * f;
    complain(state, g, 'hard');
    // Far out of their depth: they may get hurt.
    if (p.diff >= g.skill + 2 && rnd() < 0.07) {
      state.today.injuries++;
      complain(state, g, 'injury');
      g.happy -= state.buildings.some((b) => b.type === 'firstaid') ? 0.1 : 0.4;
      return depart(state, g);
    }
  }
  if (q < 0.4) { g.happy -= 0.03; complain(state, g, 'snow'); }
  g.energy -= 0.012;
  g.happy = clamp(g.happy, 0, 1);
  const net = state.net;
  let ti = net.idx[g.toKey];
  if (ti == null) ti = nearestSpot(net, g.x, g.z);
  const sp = net.spots[ti];
  walkTo(g, sp.x + (g.seed - 0.5) * 0.9, sp.z + ((g.seed * 13) % 1 - 0.5) * 0.9, 'decide', sp.key);
}

export function updateLifts(state, dt) {
  for (const l of state.lifts) {
    const L = LIFTS[l.type];
    l.clock += dt;
    l.travel = (l.travel || 0) + L.speed * dt;
    while (l.clock >= L.interval) {
      l.clock -= L.interval;
      if (!l.open || l.storm) continue;
      for (let n = 0; n < L.seats && l.queue.length; n++) {
        const g = l.queue.shift();
        g.st = 'ride'; g.s = l.clock * L.speed; g.seat = n;
        l.riders++;
        state.today.rides++;
      }
    }
  }
}

export function updateGuests(state, ter, dt, rnd) {
  const net = state.net, guests = state.guests;
  for (let i = guests.length - 1; i >= 0; i--) {
    const g = guests[i];
    g.hunger = Math.min(1, g.hunger + T.HUNGER * dt);
    g.energy -= T.ENERGY * dt;
    if (g.noFood > 0) g.noFood -= dt;
    if (g.hunger > 0.9) g.happy -= 0.002 * dt;

    switch (g.st) {
      case 'decide':
        decide(state, g, rnd);
        break;
      case 'walk': {
        const dx = g.tx - g.x, dz = g.tz - g.z, d = Math.hypot(dx, dz), step = T.WALK * dt;
        if (d > 0.01) g.face = Math.atan2(dx, dz);
        if (d <= step) {
          g.x = g.tx; g.z = g.tz;
          if (g.then === 'ski') {
            const p = state.pisteById[g.piste];
            if (p) { g.st = 'ski'; g.runFrom = g.s; } else rehome(state, g);
          } else {
            const si = net.idx[g.toKey];
            if (si == null) rehome(state, g); else { g.spot = si; g.st = 'decide'; }
          }
        } else { g.x += dx / d * step; g.z += dz / d * step; }
        g.y = ter.height(g.x, g.z);
        break;
      }
      case 'queue': {
        const l = state.liftById[g.lift];
        if (!l || !l.open || l.storm) { if (l) { const k = l.queue.indexOf(g); if (k >= 0) l.queue.splice(k, 1); } g.spot = null; rehome(state, g); break; }
        g.wait += dt;
        if (g.wait > T.QUEUE_OK) g.happy -= T.QUEUE_PAIN * dt;
        if (g.wait > 28) complain(state, g, 'queue');
        g.x = l.a.x; g.z = l.a.z; g.y = l.pts[0].g;
        break;
      }
      case 'ride': {
        const l = state.liftById[g.lift];
        if (!l) { rehome(state, g); break; }
        const L = LIFTS[l.type];
        g.s += L.speed * dt;
        along(l.pts, l.cum, g.s, tmp, L.ground);
        g.x = tmp.x; g.z = tmp.z; g.y = tmp.y;
        g.face = l.dir;
        if (g.s >= l.len) {
          l.riders--;
          g.y = ter.height(g.x, g.z);
          g.spot = net.idx['LT:' + l.id];
          g.st = 'decide';
        }
        break;
      }
      case 'ski': {
        const p = state.pisteById[g.piste];
        if (!p) { rehome(state, g); break; }
        along(p.pts, p.cum, g.s, tmp);
        const sl = p.sl[Math.min(p.sl.length - 1, tmp.i)];
        const scared = FUN[g.skill][p.diff] < 0 ? 0.55 : 1;
        const v = (T.SKI + T.SKI_SKILL * g.skill) * (0.75 + clamp(sl * 2.2, -0.3, 1.25)) * scared;
        g.s += v * dt;
        const nx = tmp.x, nz = tmp.z;
        along(p.pts, p.cum, Math.min(g.s, g.s1), tmp);
        if (Math.hypot(tmp.x - nx, tmp.z - nz) > 1e-4) g.face = Math.atan2(tmp.x - nx, tmp.z - nz);
        g.x = tmp.x; g.z = tmp.z; g.y = tmp.y;
        if (g.s >= g.s1) finishRun(state, ter, g, p, rnd);
        break;
      }
      case 'eat':
        g.timer -= dt;
        if (g.timer <= 0) {
          const hut = state.buildingById[g.hut];
          if (hut) hut.busy = Math.max(0, hut.busy - 1);
          g.hunger = 0; g.energy = Math.min(1, g.energy + 0.18); g.happy = Math.min(1, g.happy + 0.05);
          g.st = 'decide';
        }
        break;
      case 'stuck':
        g.timer -= dt;
        if (g.timer <= 0) {
          // Re-check first: the player may have built a way down in the meantime.
          if (net.toBase.next[g.spot] || net.spots[g.spot]?.kind === 'base') { g.st = 'decide'; break; }
          state.today.rescued++;
          state.money -= T.RESCUE_COST; state.today.costs.rescue += T.RESCUE_COST;
          g.happy = Math.max(0, g.happy - 0.3);
          depart(state, g);
        }
        break;
    }
    if (g.st === 'gone') { guests[i] = guests[guests.length - 1]; guests.pop(); }
  }
}

// Closing time or the end of the day: everyone still here goes home.
export function sendHome(state) {
  for (const g of state.guests) { state.today.departed++; state.today.satSum += g.happy; }
  state.guests.length = 0;
  for (const l of state.lifts) { l.queue.length = 0; l.riders = 0; }
  for (const b of state.buildings) b.busy = 0;
}
