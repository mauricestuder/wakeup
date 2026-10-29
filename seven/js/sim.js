// Team strength and match simulation. Goals arrive minute by minute from a
// Poisson process whose rate comes from attack vs. the other side's defence.

import { SQUADS } from './data.js';
import { slotsFor, fitRating } from './formations.js';

const W = {
  att: { ST: 1, LW: .9, RW: .9, AM: .85, CM: .35, DM: .1, LB: .15, RB: .15, CB: .05, GK: 0 },
  mid: { CM: 1, DM: .8, AM: .8, LW: .3, RW: .3, LB: .2, RB: .2, ST: .1, CB: .1, GK: 0 },
  def: { GK: 1.6, CB: 1, LB: .75, RB: .75, DM: .7, CM: .25, AM: .05, LW: .05, RW: .05, ST: 0 },
};
const SCORER = { ST: 5, LW: 3, RW: 3, AM: 3, CM: 1.4, DM: .6, LB: .5, RB: .5, CB: .45, GK: 0 };

export const ROUNDS = ['Group · Match 1', 'Group · Match 2', 'Group · Match 3', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'];
export const SHORT = ['G1', 'G2', 'G3', 'R16', 'QF', 'SF', 'F'];

export function chemistry(slots) {
  const nations = {}, squads = {};
  for (const s of slots) if (s.player) {
    nations[s.player.nation] = (nations[s.player.nation] || 0) + 1;
    const k = s.player.nation + s.player.year;
    squads[k] = (squads[k] || 0) + 1;
  }
  let c = 0;
  for (const n of Object.values(nations)) c += Math.max(0, n - 1) * 0.5;
  for (const n of Object.values(squads)) c += Math.max(0, n - 1) * 0.5;
  return Math.min(4, c);
}

export function teamRating(slots) {
  const chem = chemistry(slots);
  const out = { chem };
  for (const zone of ['att', 'mid', 'def']) {
    let sum = 0, wsum = 0;
    for (const s of slots) {
      const w = W[zone][s.role];
      if (!w || !s.player) continue;
      sum += w * fitRating(s.player, s.role);
      wsum += w;
    }
    out[zone] = wsum ? sum / wsum + chem : 0;
  }
  out.ovr = (out.att + out.mid + out.def) / 3;
  return out;
}

// Best 4-3-3 the CPU can field from one squad (greedy, hardest slots first).
function cpuTeam(squad, boost) {
  const slots = slotsFor('4-3-3');
  const used = new Set();
  for (const role of ['GK', 'ST', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'LW', 'RW']) {
    const slot = slots.find((s) => s.role === role && !s.player);
    let best = null, bestR = -1;
    for (const p of squad.players) {
      const r = used.has(p) ? null : fitRating(p, role);
      if (r !== null && r > bestR) { best = p; bestR = r; }
    }
    if (best) { used.add(best); slot.player = best; }
  }
  const rating = teamRating(slots);
  for (const z of ['att', 'mid', 'def', 'ovr']) rating[z] += boost;
  return { name: squad.nation, year: squad.year, flag: squad.flag, slots, rating };
}

let ranked = null;
function rankedSquads() {
  if (!ranked) ranked = SQUADS.map((s) => ({ s, ovr: cpuTeam(s, 0).rating.ovr })).sort((a, b) => a.ovr - b.ovr);
  return ranked;
}

// Seven opponents, weaker squads in the group, the strongest late on.
// Opponents always come from different squads than each other.
const WINDOW = [[0, .55], [0, .6], [.1, .7], [.3, .85], [.45, 1], [.6, 1], [.7, 1]];
const BOOST = [-4, -3.5, -3, -1.5, -0.5, 0.5, 1.5];
export function drawOpponents() {
  const list = rankedSquads(), taken = new Set(), opps = [];
  WINDOW.forEach(([a, b], r) => {
    const lo = Math.floor(a * list.length), hi = Math.ceil(b * list.length);
    let pick;
    do pick = list[lo + Math.floor(Math.random() * (hi - lo))]; while (taken.has(pick.s.id));
    taken.add(pick.s.id);
    opps.push(cpuTeam(pick.s, BOOST[r]));
  });
  return opps;
}

const xg = (a, b) => Math.min(3.6, 1.25 * Math.exp((a.att - b.def) / 9 + (a.mid - b.mid) / 18));

function pickScorer(slots) {
  const pool = slots.filter((s) => s.player && SCORER[s.role]);
  const weights = pool.map((s) => SCORER[s.role] * (fitRating(s.player, s.role) / 80) ** 4);
  let r = Math.random() * weights.reduce((x, y) => x + y, 0);
  for (let i = 0; i < pool.length; i++) if ((r -= weights[i]) <= 0) return pool[i].player.n;
  return pool[0].player.n;
}

function play(team, opp, from, to, rateA, rateB, events) {
  for (let m = from; m <= to; m++) {
    if (Math.random() < rateA) events.push({ m, side: 0, who: pickScorer(team.slots) });
    if (Math.random() < rateB) events.push({ m, side: 1, who: pickScorer(opp.slots) });
  }
}

const gkOf = (t) => t.slots.find((s) => s.role === 'GK')?.player?.r ?? 75;
const takers = (t) => t.slots.filter((s) => s.player && s.role !== 'GK')
  .sort((a, b) => SCORER[b.role] * b.player.r - SCORER[a.role] * a.player.r).map((s) => s.player);

function shootout(team, opp) {
  const kick = (shooter, gk) => Math.random() < 0.74 + (shooter.r - gk) / 250;
  const ta = takers(team), tb = takers(opp), ga = gkOf(team), gb = gkOf(opp);
  const kicks = [];
  let a = 0, b = 0;
  for (let i = 0; i < 30; i++) {
    const sa = kick(ta[i % ta.length], gb), sb = kick(tb[i % tb.length], ga);
    a += sa; b += sb;
    kicks.push([sa, sb]);
    if (i < 5) {
      const left = 4 - i;
      if (a > b + left || b > a + left) break;
    } else if (a !== b) break;
  }
  return { a, b, kicks };
}

// team = { slots, rating }, opp from drawOpponents(). Knockout games can't draw.
export function simulate(team, opp, knockout) {
  const A = team.rating, B = opp.rating;
  const ra = xg(A, B) / 90, rb = xg(B, A) / 90;
  const events = [];
  play(team, opp, 1, 90, ra, rb, events);
  const score = () => events.reduce((s, e) => (s[e.side]++, s), [0, 0]);
  let [gf, ga] = score(), et = false, pens = null;
  if (knockout && gf === ga) {
    et = true;
    play(team, opp, 91, 120, ra * .85, rb * .85, events);
    [gf, ga] = score();
    if (gf === ga) pens = shootout(team, opp);
  }
  const won = gf > ga || (pens && pens.a > pens.b);
  const lost = gf < ga || (pens && pens.a < pens.b);
  return { gf, ga, et, pens, events, result: won ? 'W' : lost ? 'L' : 'D' };
}
