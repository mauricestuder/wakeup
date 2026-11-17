// Idle Lift: the shapes of lifts and pistes on the mountain.
import { T, LIFTS } from './tuning.js';
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

// ---------- piste features ----------

// Finds what makes a piste interesting and stores it as p.features = [{ type, s0, s1, i0, i1 }]:
// a tunnel where it cuts through a spur, a bridge where it crosses a gully (both keep the
// piste level instead of following the ground), moguls on the steepest stretch, race gates
// on lift 4's piste and a fun park on lift 2's. i = which lift the piste belongs to.
export function pisteFeatures(ter, p, i) {
  const pts = p.pts, n = pts.length - 1, feats = [];
  const busy = new Uint8Array(n + 1);
  const free = (a, b) => { for (let k = Math.max(0, a); k <= Math.min(n, b); k++) if (busy[k]) return false; return true; };
  const take = (type, a, b) => {
    for (let k = a; k <= b; k++) busy[k] = 1;
    feats.push({ type, i0: a, i1: b, s0: p.cum[a], s1: p.cum[b] });
  };
  // Tunnels and bridges: compare the ground with a straight line over a few tiles.
  const W = 5;
  const off = (k) => { const a = Math.max(0, k - W), b = Math.min(n, k + W); return pts[k].y - (pts[a].y + (pts[b].y - pts[a].y) * (k - a) / Math.max(1, b - a)); };
  for (const [type, sign, need] of [['tunnel', 1, 0.55], ['bridge', -1, 0.5], ['tunnel', 1, 0.45]]) {
    let best = null;
    for (let k = 4; k < n - 4; k++) {
      if (off(k) * sign < need) continue;
      let a = k, b = k;
      while (a > 3 && off(a - 1) * sign > need * 0.35) a--;
      while (b < n - 3 && off(b + 1) * sign > need * 0.35) b++;
      a--; b++;
      const peak = Math.max(...Array.from({ length: b - a + 1 }, (_, m) => off(a + m) * sign));
      if (b - a >= 3 && b - a <= 14 && free(a - 1, b + 1) && (!best || peak > best.peak)) best = { a, b, peak };
      k = b;
    }
    if (best) {
      // Level the piste between the two ends: through the rock, or over the gully.
      const ya = pts[best.a].y, yb = pts[best.b].y;
      for (let k = best.a; k <= best.b; k++) { pts[k].y = ya + (yb - ya) * (k - best.a) / (best.b - best.a); pts[k].deck = type; }
      take(type, best.a, best.b);
    }
  }
  // Slopes again, now that some stretches are level.
  for (let k = 1; k <= n; k++) p.sl[k - 1] = (pts[k - 1].y - pts[k].y) / Math.max(1e-6, p.cum[k] - p.cum[k - 1]);
  // A stretch for the race on lift 4, and the fun park on lift 2.
  const span = (from, to) => [Math.round(n * from), Math.round(n * to)];
  if (i === 3) for (const [x, y] of [[0.3, 0.55], [0.55, 0.8], [0.1, 0.35]]) { const [a, b] = span(x, y); if (free(a, b)) { take('gates', a, b); break; } }
  if (i === 1) {
    for (const [x, y] of [[0.22, 0.78], [0.15, 0.6], [0.4, 0.9], [0.1, 0.45], [0.55, 0.92]]) { const [a, b] = span(x, y); if (free(a, b)) { take('park', a, b); break; } }
  }
  // Moguls on the steepest free stretch, if it is steep enough.
  let mog = null;
  for (let k = 3; k < n - 9; k++) {
    let s = 0;
    for (let m = k; m < k + 6; m++) s += p.sl[m];
    if (free(k, k + 6) && (!mog || s > mog.s)) mog = { k, s };
  }
  if (mog && mog.s / 6 > 0.18) take('moguls', mog.k, mog.k + 6);
  p.features = feats;
  return feats;
}
// Which feature, if any, is at distance s along the piste.
export function featureAt(p, s) {
  for (const f of p.features || []) if (s >= f.s0 && s <= f.s1) return f;
  return null;
}
