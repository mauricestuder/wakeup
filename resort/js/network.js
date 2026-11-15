// First Chair: shapes of lifts and pistes, and the network guests travel on.
// A "spot" is a place where a guest decides what to do next: the car park, the
// bottom and top of each lift, the end of each piste and every ski hut.
import { T, LIFTS, FUN } from './tuning.js';
import { clamp } from './terrain.js';

// ---------- lifts ----------

export function liftGeom(ter, a, b, type) {
  const L = LIFTS[type];
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
  const n = Math.max(2, Math.round(d / 2));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = a.x + dx * i / n, z = a.z + dz * i / n, g = ter.height(x, z);
    pts.push({ x, z, g, y: g + (i === 0 || i === n ? 1.15 : L.clear) });
  }
  // The cable spans hollows instead of diving into them.
  for (let k = 0; k < 60; k++) for (let i = 1; i < n; i++) {
    pts[i].y = Math.max(pts[i].y, (pts[i - 1].y + pts[i + 1].y) / 2 - 0.1);
  }
  // Riders travel along the cable, or along the ground on a drag lift.
  const cum = [0];
  for (let i = 1; i <= n; i++) {
    const p = pts[i - 1], q = pts[i];
    const dy = L.ground ? q.g - p.g : q.y - p.y;
    cum.push(cum[i - 1] + Math.hypot(q.x - p.x, dy, q.z - p.z));
  }
  return { pts, cum, len: cum[n], d, rise: pts[n].g - pts[0].g };
}

export function checkLift(state, ter, a, b, type) {
  const L = LIFTS[type];
  const geo = liftGeom(ter, a, b, type);
  const cost = Math.round((L.base + L.perTile * geo.d) / 10) * 10;
  let why = null;
  if (!ter.inside(a.x, a.z) || !ter.inside(b.x, b.z)) why = 'Too close to the edge of the map';
  else if (geo.d < L.minLen) why = 'Too short: move the top station further away';
  else if (geo.d > L.maxLen) why = `Too long for a ${L.name.toLowerCase()} (${Math.round(geo.d)} of ${L.maxLen} tiles)`;
  else if (geo.rise < 1.5) why = 'The top station has to be higher up the mountain';
  else if (geo.rise / geo.d > L.maxGrade) why = `Too steep for a ${L.name.toLowerCase()}`;
  else if (L.ground && geo.pts.some((p, i) => i && p.g < geo.pts[i - 1].g - 0.35)) why = 'A drag lift cannot cross a dip';
  else if (crowded(state, a.x, a.z, 2.6) || crowded(state, b.x, b.z, 2.6)) why = 'Too close to another station or building';
  return { ok: !why, why, cost, geo };
}

// Is there already a station or building within r of this point?
export function crowded(state, x, z, r, skip) {
  for (const l of state.lifts) {
    if (l === skip) continue;
    if (Math.hypot(l.a.x - x, l.a.z - z) < r || Math.hypot(l.b.x - x, l.b.z - z) < r) return true;
  }
  for (const b of state.buildings) if (b !== skip && Math.hypot(b.x - x, b.z - z) < r) return true;
  return false;
}

// ---------- pistes ----------

// A smooth line through the tapped points, as points one tile apart.
export function pisteGeom(ter, wps) {
  const P = (i) => wps[clamp(i, 0, wps.length - 1)];
  const dense = [];
  for (let i = 0; i < wps.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const steps = Math.max(4, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) * 2));
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      dense.push({ x: cr(p0.x, p1.x, p2.x, p3.x), z: cr(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  dense.push({ x: P(wps.length - 1).x, z: P(wps.length - 1).z });

  const pts = [{ x: dense[0].x, z: dense[0].z }];
  let need = 1;
  for (let i = 1; i < dense.length; i++) {
    let ax = dense[i - 1].x, az = dense[i - 1].z;
    const bx = dense[i].x, bz = dense[i].z;
    let seg = Math.hypot(bx - ax, bz - az);
    while (seg >= need && seg > 0) {
      const f = need / seg;
      ax += (bx - ax) * f; az += (bz - az) * f;
      pts.push({ x: ax, z: az });
      seg -= need; need = 1;
    }
    need -= seg;
  }
  const last = dense[dense.length - 1], tail = pts[pts.length - 1];
  if (Math.hypot(last.x - tail.x, last.z - tail.z) > 0.4) pts.push({ x: last.x, z: last.z });

  const cum = [0], sl = [];
  for (const p of pts) { p.x = clamp(p.x, 0, ter.N); p.z = clamp(p.z, 0, ter.N); p.y = ter.height(p.x, p.z); }
  for (let i = 1; i < pts.length; i++) {
    const ds = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) || 1e-6;
    cum.push(cum[i - 1] + ds);
    sl.push((pts[i - 1].y - pts[i].y) / ds); // positive = downhill
  }
  const len = cum[cum.length - 1];
  // Steepest and flattest stretch, averaged over four tiles so one bump does not decide.
  let steep = -9, uphill = 9;
  for (let i = 0; i < sl.length; i++) {
    let s = 0, n = 0;
    for (let k = i; k < Math.min(sl.length, i + 4); k++) { s += sl[k]; n++; }
    steep = Math.max(steep, s / n); uphill = Math.min(uphill, s / n);
  }
  const drop = pts[0].y - pts[pts.length - 1].y;
  const avg = drop / Math.max(1, len);
  const r = 0.65 * steep + 0.35 * avg;
  const diff = r < T.GREEN ? 0 : r < T.BLUE ? 1 : r < T.RED ? 2 : 3;
  return { pts, cum, sl, len, steep, avg, uphill, drop, diff };
}

export function checkPiste(state, ter, wps) {
  const geo = pisteGeom(ter, wps);
  const trees = [];
  for (let i = 0; i < geo.pts.length; i++) ter.treesNear(geo.pts[i].x, geo.pts[i].z, T.PISTE_WIDTH / 2 + 0.5, trees);
  const cost = Math.round((geo.len * T.PISTE_COST + trees.length * T.TREE_COST) / 10) * 10;
  let why = null;
  if (geo.pts.some((p) => !ter.inside(p.x, p.z, 0.8))) why = 'Too close to the edge of the map';
  else if (geo.len < T.PISTE_MIN) why = 'Too short: add a point further down';
  else if (geo.len > T.PISTE_MAX) why = 'Too long: finish this piste and start another';
  else if (geo.uphill < -0.045) why = 'Part of it runs uphill. Pistes have to go down all the way';
  else if (geo.drop < 1) why = 'It is nearly flat. Start higher up';
  return { ok: !why, why, cost, geo, trees };
}

// Nearest point of a piste to (x, z): distance and how far along the piste it is.
export function nearestOnPiste(p, x, z) {
  let best = 1e9, s = 0;
  const pts = p.pts;
  // Quick way out: far outside the box around the piste, the exact distance never matters.
  if (p.box && (x < p.box[0] - 12 || x > p.box[1] + 12 || z < p.box[2] - 12 || z > p.box[3] + 12)) return { d: 1e9, s: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x, az = pts[i].z, bx = pts[i + 1].x - ax, bz = pts[i + 1].z - az;
    const l2 = bx * bx + bz * bz || 1e-9;
    const t = clamp(((x - ax) * bx + (z - az) * bz) / l2, 0, 1);
    const d = Math.hypot(x - ax - bx * t, z - az - bz * t);
    if (d < best) { best = d; s = p.cum[i] + Math.sqrt(l2) * t; }
  }
  return { d: best, s };
}

// Position at distance s along a list of points with running lengths.
export function along(pts, cum, s, out, useGround) {
  const n = pts.length - 1;
  if (s <= 0) { out.x = pts[0].x; out.z = pts[0].z; out.y = useGround ? pts[0].g : pts[0].y; out.i = 0; return out; }
  if (s >= cum[n]) { out.x = pts[n].x; out.z = pts[n].z; out.y = useGround ? pts[n].g : pts[n].y; out.i = n - 1; return out; }
  let lo = 0, hi = n;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const f = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
  const p = pts[lo], q = pts[hi];
  out.x = p.x + (q.x - p.x) * f; out.z = p.z + (q.z - p.z) * f;
  out.y = useGround ? p.g + (q.g - p.g) * f : p.y + (q.y - p.y) * f;
  out.i = lo;
  return out;
}

// ---------- the network ----------

const GAMMA = 0.85;

export function buildNet(state, ter) {
  const spots = [], idx = {};
  const add = (key, kind, x, z, ref) => { idx[key] = spots.length; spots.push({ key, kind, x, z, ref, edges: [] }); };
  add('BASE', 'base', ter.base.x, ter.base.z, null);
  for (const l of state.lifts) { add('LB:' + l.id, 'lb', l.a.x, l.a.z, l); add('LT:' + l.id, 'lt', l.b.x, l.b.z, l); }
  for (const p of state.pistes) {
    const e = p.pts[p.pts.length - 1];
    add('PE:' + p.id, 'pe', e.x, e.z, p);
    add('PS:' + p.id, 'ps', p.pts[0].x, p.pts[0].z, p); // lets skiers fork off another piste onto this one
  }
  for (const b of state.buildings) if (b.type === 'hut') add('B:' + b.id, 'hut', b.x, b.z, b);

  for (const l of state.lifts) {
    if (!l.open || l.storm) continue;
    const ride = l.len / LIFTS[l.type].speed;
    spots[idx['LB:' + l.id]].edges.push({ type: 'lift', lift: l, to: idx['LT:' + l.id], cost: ride + 8,
      r: [-0.05 - ride / 120, -0.05 - ride / 120, -0.05 - ride / 120] });
  }

  for (const p of state.pistes) {
    // Where a skier can leave this piste: lift bottoms, huts and the car park next to it, and its end.
    const exits = [{ s: p.len, to: idx['PE:' + p.id] }];
    for (let i = 0; i < spots.length; i++) {
      const sp = spots[i];
      if (sp.kind !== 'lb' && sp.kind !== 'hut' && sp.kind !== 'base' && sp.kind !== 'ps') continue;
      if (sp.ref === p) continue;
      const n = nearestOnPiste(p, sp.x, sp.z);
      if (n.d <= (sp.kind === 'base' ? T.R_BASE_EXIT : T.R_EXIT)) exits.push({ s: n.s, to: i });
    }
    for (let i = 0; i < spots.length; i++) {
      const sp = spots[i];
      const n = nearestOnPiste(p, sp.x, sp.z);
      if (n.d > (sp.kind === 'base' ? T.R_BASE_EXIT : T.R_ENTER)) continue;
      for (const ex of exits) {
        if (ex.to === i || ex.s - n.s < 3) continue;
        const seg = ex.s - n.s, q = 0.5 + 0.5 * (p.quality ?? 1);
        sp.edges.push({ type: 'piste', piste: p, s0: n.s, s1: ex.s, to: ex.to, cost: seg / 3.5 + p.diff * 4,
          r: FUN.map((f) => f[p.diff] * Math.min(2, seg / 18) * (f[p.diff] > 0 ? q : 1)) });
      }
    }
  }

  for (let i = 0; i < spots.length; i++) for (let j = 0; j < spots.length; j++) {
    if (i === j) continue;
    const k = spots[j].kind;
    if (k !== 'lb' && k !== 'hut' && k !== 'base') continue;
    const d = Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z);
    // The car park is a whole village: everything around it is within walking distance.
    if (d <= (k === 'base' || spots[i].kind === 'base' ? T.R_BASE : T.R_WALK)) spots[i].edges.push({ type: 'walk', to: j, d, cost: d / T.WALK + 1, r: [-0.1 - d / 40, -0.1 - d / 40, -0.1 - d / 40] });
  }

  // What each spot is worth to each kind of skier: the best fun reachable from there.
  const V = [0, 1, 2].map((k) => {
    const v = new Float32Array(spots.length);
    for (let it = 0; it < 60; it++) {
      let change = 0;
      for (let i = 0; i < spots.length; i++) {
        const sp = spots[i];
        let best = sp.kind === 'base' ? 0 : sp.edges.length ? -1e9 : -4;
        for (const e of sp.edges) { const c = e.r[k] + GAMMA * v[e.to]; if (c > best) best = c; }
        best = Math.max(-6, best);
        change = Math.max(change, Math.abs(best - v[i]));
        v[i] = best;
      }
      if (change < 0.002) break;
    }
    return v;
  });

  return { spots, idx, V, toBase: routeTo(spots, (s) => s.kind === 'base'), toFood: routeTo(spots, (s) => s.kind === 'hut'), gamma: GAMMA };
}

// Cheapest way from every spot to the nearest spot that passes the test.
function routeTo(spots, test) {
  const dist = new Float32Array(spots.length).fill(Infinity), next = new Array(spots.length).fill(null);
  for (let i = 0; i < spots.length; i++) if (test(spots[i])) dist[i] = 0;
  for (let changed = true, guard = 0; changed && guard < 400; guard++) {
    changed = false;
    for (let i = 0; i < spots.length; i++) for (const e of spots[i].edges) {
      const nd = e.cost + dist[e.to];
      if (nd < dist[i] - 1e-6) { dist[i] = nd; next[i] = e; changed = true; }
    }
  }
  return { dist, next };
}

export function nearestSpot(net, x, z) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < net.spots.length; i++) {
    const d = Math.hypot(net.spots[i].x - x, net.spots[i].z - z);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// ---------- hints for the build tools: what does this point touch? ----------

function touching(state, ter, x, z) {
  const near = (list, f, r) => list.find((o) => { const p = f(o); return Math.hypot(p.x - x, p.z - z) <= r; });
  const dBase = Math.hypot(ter.base.x - x, ter.base.z - z);
  let piste = null;
  for (const p of state.pistes) { const n = nearestOnPiste(p, x, z); if (n.d <= T.R_EXIT && (!piste || n.d < piste.d)) piste = { p, s: n.s, d: n.d }; }
  return { dBase, piste,
    top: near(state.lifts, (l) => l.b, T.R_ENTER), bottom: near(state.lifts, (l) => l.a, T.R_EXIT),
    hut: near(state.buildings.filter((b) => b.type === 'hut'), (b) => b, T.R_EXIT) };
}

// Each returns { ok, text }.
export function hintPisteStart(state, ter, x, z) {
  const t = touching(state, ter, x, z);
  if (t.top) return { ok: true, text: `Starts at the top of ${t.top.name}` };
  if (t.piste) return { ok: true, text: `Branches off ${t.piste.p.name}` };
  if (t.hut) return { ok: true, text: 'Starts at a ski hut' };
  if (t.dBase <= T.R_BASE_EXIT) return { ok: true, text: 'Starts at the car park' };
  return { ok: false, text: 'The start is not next to a lift top, so nobody can reach it' };
}
export function hintPisteEnd(state, ter, x, z) {
  const t = touching(state, ter, x, z);
  if (t.bottom) return { ok: true, text: `Ends at the bottom of ${t.bottom.name}` };
  if (t.dBase <= T.R_BASE_EXIT) return { ok: true, text: 'Ends at the car park' };
  if (t.hut) return { ok: true, text: 'Ends at a ski hut' };
  if (t.piste && t.piste.p.len - t.piste.s >= 3) return { ok: true, text: `Joins ${t.piste.p.name}` };
  return { ok: false, text: 'The end touches nothing: guests would be stranded there' };
}
export function hintLiftBottom(state, ter, x, z) {
  const t = touching(state, ter, x, z);
  if (t.dBase <= T.R_BASE) return { ok: true, text: 'Bottom is next to the car park' };
  if (t.piste) return { ok: true, text: `Bottom is on ${t.piste.p.name}` };
  if (state.lifts.some((l) => Math.hypot(l.b.x - x, l.b.z - z) <= T.R_WALK)) return { ok: true, text: 'Bottom is next to another lift' };
  return { ok: false, text: 'Bottom touches no piste or car park yet' };
}
export function hintLiftTop(state, ter, x, z) {
  const t = touching(state, ter, x, z);
  if (t.piste) return { ok: true, text: `Top reaches ${t.piste.p.name}` };
  return { ok: null, text: 'Then build a piste down from the top' };
}
