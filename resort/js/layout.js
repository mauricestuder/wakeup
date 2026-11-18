// Idle Lift: where the six lifts and their pistes go on a mountain.
// The plan is the same every time for the same mountain. Lifts form a small tree:
// some start at the car park, the others at the top of an earlier lift. Every
// piste runs from the top of its lift back down to the bottom of it.
import { liftGeom, pisteGeom, carveFeatures } from './network.js';

// from = the lift whose top this one starts at (-1 = the car park).
// off = bottom station, as steps away from that place. to = steps from bottom to top station.
// side = which way the piste swings out.
const PLAN = [
  { type: 'drag', from: -1, off: [-4.5, -6], to: [-6.5, -16], side: -1 },
  { type: 'drag', from: -1, off: [5, -6], to: [7.5, -18], side: 1 },
  { type: 'chair', from: 0, off: [-1.5, -3], to: [-9.5, -25], side: -1 },
  { type: 'chair', from: 1, off: [2, -3], to: [9.5, -25], side: 1 },
  { type: 'gondola', from: -1, off: [0.5, -9.5], to: [1, -35.5], side: 1 },
  { type: 'gondola', from: 4, off: [-0.5, -3.5], to: [-3, -30.5], side: -1 },
];

// A piste from the top station b back down to the bottom station a. It snakes across the slope:
// swings = how many times it changes side, amp = how far it swings out, bend = how far from the lift line.
function pisteFor(a, b, side, bend, swings = 0, amp = 0) {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
  const rx = -uz * side, rz = ux * side; // sideways from the lift line
  const wps = [{ x: b.x + rx * 2.2 + ux * 0.6, z: b.z + rz * 2.2 + uz * 0.6 }];
  // From the top (t = 1) down to the bottom (t = 0), swinging out and back in.
  const n = swings + 2;
  for (let k = 1; k <= n; k++) {
    const t = 1 - k / (n + 1), wave = k % 2 ? 1 : -1;
    const off = bend + 1 + (swings ? wave * amp : 0) * Math.sin(Math.PI * Math.min(1, t * 1.25));
    wps.push({ x: a.x + dx * t + rx * off, z: a.z + dz * t + rz * off });
  }
  wps.push({ x: a.x + rx * 2.6 - ux * 2.4, z: a.z + rz * 2.6 - uz * 2.4 });
  return { rx, rz, ux, uz, wps };
}

export function planLifts(ter, map) {
  const fx = map.flip ? -1 : 1, sp = map.spread || 1, out = [];
  for (let i = 0; i < PLAN.length; i++) {
    const p = PLAN[i], node = p.from < 0 ? ter.base : out[p.from].b;
    const a = { x: node.x + p.off[0] * fx, z: node.z + p.off[1] };
    // Top station: the planned spot, nudged to wherever nearby the lift climbs most.
    let b = null, best = -1e9;
    for (let ox = -4; ox <= 4; ox += 2) for (let oz = -4; oz <= 4; oz += 2) {
      const c = { x: a.x + p.to[0] * fx * sp + ox, z: a.z + p.to[1] + oz };
      if (!ter.inside(c.x, c.z, 9)) continue;
      const g = liftGeom(ter, a, c, p.type);
      // A drag lift pulls riders along the snow, so dips on the way count against it.
      let dip = 0;
      for (let k = 1; k < g.pts.length; k++) dip += Math.max(0, g.pts[k - 1].g - g.pts[k].g);
      const score = g.rise - dip * (p.type === 'drag' ? 3 : 1) - Math.hypot(ox, oz) * 0.12;
      if (score > best) { best = score; b = c; }
    }
    // Piste: try both sides, a few bends and snake shapes, keep the longest one that still runs
    // downhill all the way and stays on the mountain.
    let pick = null, bs = -1e9;
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    for (const side of [p.side * fx, -p.side * fx]) for (const bend of [4, 5.5, 7]) for (const swings of [2, 3, 4]) for (const amp of [3, 4.5, 6]) {
      if (amp > bend + 2) continue;
      const q = pisteFor(a, b, side, bend, swings, amp), g = pisteGeom(ter, q.wps);
      if (g.pts.some((t) => !ter.inside(t.x, t.z, 3))) continue;
      const ratio = g.len / Math.max(8, d);
      const score = Math.min(0, g.uphill + 0.01) * 60 - Math.abs(ratio - 1.9) * 1.5 - (side === p.side * fx ? 0 : 0.8) - Math.abs(bend - 5.5) * 0.05;
      if (score > bs) { bs = score; pick = q; }
    }
    out.push({ i, type: p.type, from: p.from, a, b, wps: pick.wps,
      hut: { x: a.x - pick.rx * 3.6 - pick.ux * 1.4, z: a.z - pick.rz * 3.6 - pick.uz * 1.4 }, cuts: [] });
  }
  // Shape the ground for the tunnels and bridges.
  return carveFeatures(ter, out);
}

// The finished shapes, for checking a plan without starting a game.
export function shapes(ter, plan) {
  return plan.map((p) => ({ lift: liftGeom(ter, p.a, p.b, p.type), piste: pisteGeom(ter, p.wps) }));
}

// Where the mountain's landmark goes. Summit landmarks stand on the highest free spot; a ski
// jump, a glacier and an igloo village need a free stretch of slope. Returns
// { kind, x, z, yaw, len, clear: [[x, z, r], ...] } or null when there is no room.
const ON_TOP = { cross: 1, weather: 1, panorama: 1, observatory: 1, skywalk: 1 };
export function placeSpecial(ter, plan, kind) {
  if (!kind) return null;
  const keep = [];
  for (const p of plan) {
    for (const q of pisteGeom(ter, p.wps).pts) keep.push([q.x, q.z, 3.2]);
    const d = Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z);
    for (let s = 0; s <= d; s += 1) keep.push([p.a.x + (p.b.x - p.a.x) * s / d, p.a.z + (p.b.z - p.a.z) * s / d, 2.4]);
    keep.push([p.a.x, p.a.z, 5], [p.b.x, p.b.z, 5], [p.hut.x, p.hut.z, 4]);
  }
  keep.push([ter.base.x, ter.base.z, 16]);
  for (const l of ter.lakes) keep.push([l.x, l.z, l.r + 3]);
  const free = (x, z, r) => ter.inside(x, z, 3) && keep.every(([kx, kz, kr]) => Math.hypot(kx - x, kz - z) >= kr + r);
  // Straight down the fall line from a spot.
  const down = (x, z) => {
    const gx = ter.height(x + 1, z) - ter.height(x - 1, z), gz = ter.height(x, z + 1) - ter.height(x, z - 1), l = Math.hypot(gx, gz) || 1;
    return { dx: -gx / l, dz: -gz / l };
  };
  const N = ter.N;
  const top = () => {
    let best = null;
    // Not right at the back edge, where the camera cannot reach and nobody would see it.
    for (let j = 12; j <= N - 20; j++) for (let i = 8; i <= N - 8; i++) {
      let y = ter.height(i, j);
      // A skywalk wants a big drop in front of it, not just the highest spot.
      if (kind === 'skywalk') { const d = down(i, j); y += (y - ter.height(i + d.dx * 8, j + d.dz * 8)) * 2; }
      if ((!best || y > best.y) && free(i, j, kind === 'cross' ? 2.5 : 4.5)) best = { x: i, z: j, y };
    }
    if (!best) return null;
    const { dx, dz } = down(best.x, best.z);
    return { kind, x: best.x, z: best.z, yaw: Math.atan2(dx, dz), len: 0, clear: [[best.x, best.z, kind === 'cross' ? 3 : 5.5]] };
  };
  if (ON_TOP[kind]) return top();
  // Along the slope: the ski jump in the middle of the mountain, the glacier up high, the igloos lower down.
  const len = kind === 'jump' ? 20 : kind === 'glacier' ? 16 : 0;
  const band = kind === 'jump' ? [0.25, 0.7] : kind === 'glacier' ? [0.55, 0.95] : [0.15, 0.55];
  let best = null;
  for (let j = 11; j <= N - 12; j += 1) for (let i = 8; i <= N - 8; i += 1) {
    const a = ter.alt(i, j);
    if (a < band[0] || a > band[1]) continue;
    const { dx, dz } = down(i, j);
    let ok = true, drop = 0;
    if (len) {
      for (let s = 0; s <= len && ok; s += 1.5) ok = free(i + dx * s, j + dz * s, kind === 'glacier' ? 3 + s * 0.15 : 2.5);
      if (!ok) continue;
      drop = ter.height(i, j) - ter.height(i + dx * len, j + dz * len);
      if (drop < len * 0.25) continue;
    } else {
      if (!free(i, j, 6) || ter.slope(i, j) > 0.35) continue;
      for (let k = 0; k < 8 && ok; k++) ok = ter.slope(i + Math.cos(k) * 3, j + Math.sin(k) * 3) < 0.45;
      if (!ok) continue;
    }
    // Somewhere you can see it: near the middle, and for a jump, a steady steep slope.
    const score = -Math.abs(i - N / 2) * (len ? 0.05 : 0.15) + (len ? Math.min(drop / len, 0.7) * 4 : -ter.slope(i, j) * 4) + (kind === 'glacier' ? a * 3 : 0);
    if (!best || score > best.score) best = { x: i, z: j, dx, dz, score };
  }
  // No room on the slope: the summit always has some.
  if (!best) return kind === 'igloo' ? top() : null;
  const clear = [];
  if (len) for (let s = 0; s <= len; s += 2) clear.push([best.x + best.dx * s, best.z + best.dz * s, kind === 'glacier' ? 3.5 + s * 0.2 : 3]);
  else clear.push([best.x, best.z, 7]);
  return { kind, x: best.x, z: best.z, yaw: Math.atan2(best.dx, best.dz), len, clear };
}
