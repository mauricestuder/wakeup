// First Chair: money, demand, snow on the pistes and the resort rating.
import { T, LIFTS, BUILDINGS, WEATHER } from './tuning.js';
import { clamp } from './terrain.js';

export const pisteLength = (state) => state.pistes.reduce((s, p) => s + p.len, 0);
export const count = (state, type) => state.buildings.reduce((n, b) => n + (b.type === type ? 1 : 0), 0);

// What a day ticket is worth here. Charging more than this costs guests and mood.
export function fairTicket(state) {
  return 14 + 7 * state.rating + 0.05 * Math.min(400, pisteLength(state));
}

export function pay(state, cost) {
  if (state.sandbox) return true;
  if (state.money < cost) return false;
  state.money -= cost;
  state.today.built += cost;
  return true;
}

export const hotelShare = (state) => clamp(0.35 + state.rating * 0.12, 0, 0.95);

// How many guests set out for the resort today.
export function plannedGuests(state, map) {
  const ratio = state.ticket / fairTicket(state);
  const price = clamp(1.6 - 0.8 * ratio, 0, 1.3);
  const attract = Math.min(3, 0.3 + pisteLength(state) / 240);
  const weekday = (state.day - 1) % 7;
  const weekend = weekday >= 5 ? 1.35 : 1;
  const walkIns = map.crowd * (0.2 + 0.32 * state.rating) * attract * price * WEATHER[state.weather].demand * weekend;
  const overnight = count(state, 'hotel') * T.HOTEL_BEDS * hotelShare(state) * 0.8;
  return Math.round(walkIns + overnight);
}

export const snowDepth = (state, ter, x, z) => state.snow + T.SNOW_ALT * ter.alt(x, z);

// Snow and grooming decide how good each piste is today (0 to 1).
export function updateQualities(state, ter) {
  const cannons = state.buildings.filter((b) => b.type === 'cannon');
  const cover = state.weather === 'thaw' ? T.CANNON_DEPTH * 0.7 : T.CANNON_DEPTH;
  let reach = count(state, 'groomer') * T.GROOM_REACH;
  const byTraffic = [...state.pistes].sort((a, b) => (b.runsYesterday || 0) - (a.runsYesterday || 0));
  for (const p of byTraffic) {
    let sum = 0;
    for (const pt of p.pts) {
      let d = snowDepth(state, ter, pt.x, pt.z);
      for (const c of cannons) if (Math.hypot(c.x - pt.x, c.z - pt.z) <= T.CANNON_R) { d = Math.max(d, cover); break; }
      sum += clamp(d / T.SNOW_GOOD, 0, 1);
    }
    p.snowQ = sum / p.pts.length;
    p.groomed = reach >= p.len;
    if (p.groomed) reach -= p.len;
    p.quality = clamp(p.snowQ * (p.groomed ? 1 : 0.74) * (1 - (p.wear || 0)), 0.05, 1);
  }
}

export function dailyCosts(state) {
  let lifts = 0, buildings = 0;
  for (const l of state.lifts) lifts += LIFTS[l.type].run * (l.open && !l.storm ? 1 : 0.4);
  for (const b of state.buildings) buildings += BUILDINGS[b.type].upkeep;
  const interest = Math.round(state.loan * T.INTEREST + Math.max(0, -state.money) * T.OVERDRAFT);
  return { lifts, buildings, base: T.BASE_UPKEEP, interest };
}

export function ratingTarget(state, sat) {
  const diffs = new Set(state.pistes.map((p) => p.diff)).size;
  const variety = 0.6 * diffs / 4 + 0.4 * Math.min(1, pisteLength(state) / 300);
  const service = (count(state, 'hut') ? 0.4 : 0) + (count(state, 'rental') ? 0.2 : 0)
    + (count(state, 'firstaid') ? 0.2 : 0) + (count(state, 'hotel') ? 0.2 : 0);
  const mood = clamp((sat - 0.45) / 0.45, 0, 1);
  return { stars: 5 * (0.6 * mood + 0.25 * variety + 0.15 * service), mood, variety, service };
}

// Close the books for the day. Returns the summary shown to the player.
export function closeDay(state) {
  const t = state.today;
  const c = dailyCosts(state);
  Object.assign(t.costs, { lifts: c.lifts, buildings: c.buildings, base: c.base, interest: c.interest });
  t.income.hotel = Math.round(count(state, 'hotel') * T.HOTEL_BEDS * hotelShare(state) * T.HOTEL_NIGHT);
  state.money += t.income.hotel - c.lifts - c.buildings - c.base - c.interest;
  const income = Object.values(t.income).reduce((a, b) => a + b, 0) - t.income.bonus;
  const costs = Object.values(t.costs).reduce((a, b) => a + b, 0);
  const profit = Math.round(income - costs);
  const sat = t.departed >= 5 ? t.satSum / t.departed : null;
  const before = state.rating;
  if (sat !== null) {
    const target = ratingTarget(state, sat).stars - Math.min(0.6, t.injuries * 0.05 + t.rescued * 0.03);
    state.rating = clamp(state.rating + (target - state.rating) * 0.35, 0.5, 5);
  } else {
    state.rating = Math.max(0.5, state.rating - 0.05);
  }
  state.best.guests = Math.max(state.best.guests, t.arrived);
  state.best.profit = Math.max(state.best.profit, profit);
  state.best.stars = Math.max(state.best.stars, state.rating);
  state.history.push({ day: state.day, profit, guests: t.arrived, sat, rating: state.rating });
  if (state.history.length > 90) state.history.shift();
  for (const p of state.pistes) { p.runsYesterday = p.runs || 0; p.runs = 0; p.wear = p.groomed ? 0 : (p.wear || 0) * 0.5; }
  return { day: state.day, weather: state.weather, guests: t.arrived, income: Math.round(income), costs: Math.round(costs), profit,
    sat, rating: state.rating, ratingBefore: before, complaints: { ...t.complaints }, injuries: t.injuries, rescued: t.rescued,
    runs: t.runs, peak: t.peak, away: [...t.away], detail: { income: { ...t.income }, costs: { ...t.costs } }, built: t.built };
}
