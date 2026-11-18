// Idle Lift: the shapes of lifts and pistes on the mountain.
import { T, LIFTS } from './tuning.js';
import { clamp, smooth } from './terrain.js';

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

const TUNNEL_ROCK = 3.4;  // how far the hill rises above a tunnel
const GULLY_DEPTH = 2.6;  // how far a gully drops below a bridge

// Where a tunnel or bridge would change the ground, and by how much: [k, change] per grid point.
function cutShape(ter, pts, c) {
  const W = ter.W, out = [];
  const seg = pts.slice(c.i0, c.i1 + 1), n = seg.length - 1;
  const ya = seg[0].y, yb = seg[n].y, deck = (k) => ya + (yb - ya) * k / n;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const q of seg) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); }
  const R = 8;
  const i0 = Math.max(0, Math.floor(x0 - R)), i1 = Math.min(ter.N, Math.ceil(x1 + R)), j0 = Math.max(0, Math.floor(z0 - R)), j1 = Math.min(ter.N, Math.ceil(z1 + R));
  if (c.type === 'tunnel') {
    // A hill across the piste: full height a little way in from each portal, fading out to the sides.
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      let bd = 1e9, bk = 0;
      for (let k = 0; k < n; k++) {
        const a = seg[k], b = seg[k + 1], ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1e-6;
        const t = clamp(((i - a.x) * ex + (j - a.z) * ez) / L2, 0, 1), d = Math.hypot(i - a.x - ex * t, j - a.z - ez * t);
        if (d < bd) { bd = d; bk = k + t; }
      }
      const f = smooth(0, 1.8, bk) * smooth(0, 1.8, n - bk), g = 1 - smooth(2.4, 5, bd);
      if (f <= 0 || g <= 0) continue;
      const v = ter.h[j * W + i], up = Math.max(0, deck(bk) + TUNNEL_ROCK * f - v) * g;
      if (up > 0.02) out.push([j * W + i, up]);
    }
  } else {
    // A gully across the piste, under the middle of the bridge, running away down both sides.
    const m = seg[n >> 1], mb = seg[Math.min(n, (n >> 1) + 1)], ma = seg[Math.max(0, (n >> 1) - 1)];
    const tl = Math.hypot(mb.x - ma.x, mb.z - ma.z) || 1, tx = (mb.x - ma.x) / tl, tz = (mb.z - ma.z) / tl;
    const half = n / 2 - 0.7, sink = Math.max(0, ter.height(m.x, m.z) - deck(n / 2)) + GULLY_DEPTH;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const a = (i - m.x) * tx + (j - m.z) * tz, b = -(i - m.x) * tz + (j - m.z) * tx;
      const f = (1 - smooth(half * 0.3, half, Math.abs(a))) * (1 - smooth(2.5, 5.5, Math.abs(b)));
      if (f > 0.02) out.push([j * W + i, -sink * f]);
    }
  }
  return out;
}

// Tunnels and bridges need real ground: a hill to go through, a gully to cross. They are chosen
// once per mountain, on straight stretches where nothing else is close, and the ground is shaped
// for them before anything is built. Sets plan[i].cuts = [{ type, i0, i1 }].
export function carveFeatures(ter, plan) {
  const geos = plan.map((p) => pisteGeom(ter, p.wps));
  // What a hill or gully must stay clear of: [x, z, r, piste, k].
  const keep = [];
  plan.forEach((p, i) => {
    geos[i].pts.forEach((q, k) => keep.push([q.x, q.z, 2.2, i, k]));
    // A chairlift or gondola cable spans a hill or a gully; a drag lift runs on the snow.
    const d = Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z);
    if (p.type === 'drag') for (let s = 0; s <= d; s += 1) keep.push([p.a.x + (p.b.x - p.a.x) * s / d, p.a.z + (p.b.z - p.a.z) * s / d, 1.5, -1, 0]);
    keep.push([p.a.x, p.a.z, 4, -1, 0], [p.b.x, p.b.z, 4, -1, 0], [p.hut.x, p.hut.z, 3, -1, 0]);
  });
  keep.push([ter.base.x, ter.base.z, 12, -1, 0]);
  for (const l of ter.lakes) keep.push([l.x, l.z, l.r + 3, -1, 0]);
  const clash = (shape, i, c) => {
    for (const [k, v] of shape) {
      if (Math.abs(v) < 0.3) continue;
      const x = k % ter.W, z = (k / ter.W) | 0;
      for (const [ox, oz, r, pi, pk] of keep) {
        if (pi === i && pk >= c.i0 - 2 && pk <= c.i1 + 2) continue;
        if (Math.abs(ox - x) < r && Math.abs(oz - z) < r && Math.hypot(ox - x, oz - z) < r) return true;
      }
    }
    return false;
  };
  const taken = [];
  plan.forEach((p, i) => {
    const pts = geos[i].pts, n = pts.length - 1;
    // How far the ground stands above (+) or below (-) a straight line over a few tiles.
    const off = (k) => { const a = Math.max(0, k - 5), b = Math.min(n, k + 5); return pts[k].y - (pts[a].y + (pts[b].y - pts[a].y) * (k - a) / Math.max(1, b - a)); };
    const yaw = (k) => Math.atan2(pts[k + 1].x - pts[k].x, pts[k + 1].z - pts[k].z);
    const cands = [];
    for (const [type, sign] of [['tunnel', 1], ['bridge', -1]]) for (const len of [5, 6, 7]) for (let a = 6; a + len <= n - 6; a++) {
      const b = a + len;
      // Straight enough that the bridge deck or tunnel runs true.
      let turn = 0;
      for (let k = a; k < b - 1; k++) turn += Math.abs(((yaw(k + 1) - yaw(k) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      if (turn > 0.55) continue;
      // Best where the ground already rises (tunnel) or dips (bridge).
      let bump = 0;
      for (let k = a + 1; k < b; k++) bump += off(k) * sign;
      bump /= len - 1;
      // A bridge on a steep stretch looks like a staircase: keep them on gentler ground.
      const steep = Math.abs(pts[a].y - pts[b].y) / len;
      if (type === 'bridge' && steep > 0.5) continue;
      cands.push({ type, i0: a, i1: b, score: bump - turn * 0.5 + (len - 5) * 0.04 - (type === 'bridge' ? steep * 0.8 : 0) });
    }
    cands.sort((x, y) => y.score - x.score);
    for (const c of cands) {
      // At most two tunnels and two bridges on a mountain, so they stay special.
      if (taken.filter((t) => t.type === c.type).length >= 2) continue;
      const shape = cutShape(ter, pts, c);
      if (clash(shape, i, c)) continue;
      // Nothing else may be shaped in the same place.
      if (taken.some((t) => shape.some((sh) => t.keys.has(sh[0])))) continue;
      for (const [k, v] of shape) ter.h[k] += v;
      taken.push({ type: c.type, keys: new Set(shape.map((sh) => sh[0])) });
      p.cuts = [{ type: c.type, i0: c.i0, i1: c.i1 }];
      break;
    }
  });
  // Trees stand on the new ground.
  if (taken.length) for (const t of ter.trees) t.y = ter.height(t.x, t.z);
  return plan;
}

// Stores what makes a piste interesting as p.features = [{ type, s0, s1, i0, i1 }]: the tunnel
// or bridge chosen for it (both keep the piste level instead of following the ground), moguls
// on the steepest stretch, race gates on lift 4's piste and a fun park on lift 2's.
// i = which lift the piste belongs to.
export function pisteFeatures(ter, p, i, cuts = []) {
  const pts = p.pts, n = pts.length - 1, feats = [];
  const busy = new Uint8Array(n + 1);
  const free = (a, b) => { for (let k = Math.max(0, a); k <= Math.min(n, b); k++) if (busy[k]) return false; return true; };
  const take = (type, a, b) => {
    for (let k = a; k <= b; k++) busy[k] = 1;
    feats.push({ type, i0: a, i1: b, s0: p.cum[a], s1: p.cum[b] });
  };
  for (const c of cuts) {
    if (c.i1 > n) continue;
    // Level the piste between the two ends: through the hill, or over the gully.
    const ya = pts[c.i0].y, yb = pts[c.i1].y;
    for (let k = c.i0; k <= c.i1; k++) { pts[k].y = ya + (yb - ya) * (k - c.i0) / (c.i1 - c.i0); pts[k].deck = c.type; }
    take(c.type, c.i0, c.i1);
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
