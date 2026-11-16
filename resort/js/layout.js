// First Chair: where the six lifts and their pistes go on a mountain.
// The plan is the same every time for the same mountain. Lifts form a small tree:
// some start at the car park, the others at the top of an earlier lift. Every
// piste runs from the top of its lift back down to the bottom of it.
import { liftGeom, pisteGeom } from './network.js';

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

function pisteFor(a, b, side, bend) {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
  const rx = -uz * side, rz = ux * side; // sideways from the lift line
  return {
    rx, rz, ux, uz,
    wps: [
      { x: b.x + rx * 2.2 + ux * 0.6, z: b.z + rz * 2.2 + uz * 0.6 },
      { x: a.x + dx * 0.66 + rx * (bend + 1), z: a.z + dz * 0.66 + rz * (bend + 1) },
      { x: a.x + dx * 0.3 + rx * bend, z: a.z + dz * 0.3 + rz * bend },
      { x: a.x + rx * 2.6 - ux * 2.4, z: a.z + rz * 2.6 - uz * 2.4 },
    ],
  };
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
    // Piste: try both sides and a few bends, keep the one that runs downhill best.
    let pick = null, bs = -1e9;
    for (const side of [p.side * fx, -p.side * fx]) for (const bend of [3.5, 5, 6.5, 8]) {
      const q = pisteFor(a, b, side, bend), g = pisteGeom(ter, q.wps);
      if (g.pts.some((t) => !ter.inside(t.x, t.z, 3))) continue;
      const score = Math.min(0, g.uphill) * 40 - (side === p.side * fx ? 0 : 0.6) - Math.abs(bend - 5) * 0.05;
      if (score > bs) { bs = score; pick = q; }
    }
    out.push({ i, type: p.type, from: p.from, a, b, wps: pick.wps,
      hut: { x: a.x - pick.rx * 3.6 - pick.ux * 1.4, z: a.z - pick.rz * 3.6 - pick.uz * 1.4 } });
  }
  return out;
}

// The finished shapes, for checking a plan without starting a game.
export function shapes(ter, plan) {
  return plan.map((p) => ({ lift: liftGeom(ter, p.a, p.b, p.type), piste: pisteGeom(ter, p.wps) }));
}
