// Player-versus-world collision and ray casts.
//
// The body is an upright box. Walls and floors are boxes (one per tile), so
// doors, windows and half walls fall out of the same test. Ramps and roofs are
// height fields sampled under the body's centre.

import { C, L, N, H, SIZE, WT, RAMP_THICK, cellOf } from './grid.js';
import { surfaceAt } from './pieces.js';
import { T } from './tuning.js';

export const HW = 0.4;           // half width of the player
export const STAND = 1.8;
export const CROUCH = 1.2;
const STEP_SLOPE = 0.75;         // how far a ramp or roof may lift the feet
const STEP_BOX = 0.5;            // same for the top of a tile (ramp onto floor)
const SNAP = 0.3;                // stay glued when walking downhill
const EPS = 1e-4;
export const WALL_TOP = 15;      // height of the map walls

export function makeBody() {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, h: STAND, onGround: true, jumped: false,
    ci: 0, cj: 0, under: new Set(), lift: 0 };
}

function overlaps(b, x, y, z, h, hw = HW) {
  return x + hw > b.x0 + EPS && x - hw < b.x1 - EPS && z + hw > b.z0 + EPS && z - hw < b.z1 - EPS &&
    y + h > b.y0 + EPS && y < b.y1 - EPS;
}

export class World {
  constructor(pieces) {
    this.pieces = pieces;
    this.dummies = [];
    this.near = [];
    this.hit = { t: 0, kind: '', piece: null, bit: -1, dummy: null, head: false };
  }

  // Tile boxes around a point.
  collect(x, y, z, h, pad = 0.7) {
    const out = this.near, ps = this.pieces;
    out.length = 0;
    const r = HW + pad + 0.1;
    const i0 = Math.floor((x - r) / C), i1 = Math.floor((x + r) / C);
    const j0 = Math.floor((z - r) / C), j1 = Math.floor((z + r) / C);
    const k0 = Math.max(0, Math.floor((y - pad) / L)), k1 = Math.min(H, Math.floor((y + h + pad + WT) / L));
    for (let k = k0; k <= k1; k++) {
      for (let i = i0; i <= i1 + 1; i++) {
        for (let j = j0; j <= j1 + 1; j++) {
          if (i < 0 || j < 0 || i > N || j > N) continue;
          const a = ps.get('wx', i, k, j), b = ps.get('wz', i, k, j), f = ps.get('f', i, k, j);
          if (a) for (const t of a.boxes) out.push(t);
          if (b) for (const t of b.boxes) out.push(t);
          if (f) for (const t of f.boxes) out.push(t);
        }
      }
    }
    return out;
  }

  // Sort the ramps and roofs of the body's cell into "I am on top" and
  // "I am underneath".
  enterCell(b, x = b.x, z = b.z) {
    b.ci = cellOf(x);
    b.cj = cellOf(z);
    b.under.clear();
    for (let k = 0; k <= H; k++) {
      const r = this.pieces.get('r', b.ci, k, b.cj), c = this.pieces.get('c', b.ci, k, b.cj);
      if (r && b.y < surfaceAt(r, x, z) - STEP_SLOPE) b.under.add(r.id);
      if (c && b.y < surfaceAt(c, x, z) - STEP_SLOPE) b.under.add(c.id);
    }
  }

  place(b, x, y, z) {
    b.x = x; b.y = y; b.z = z;
    b.vx = b.vy = b.vz = 0;
    b.lift = 0;
    b.onGround = true;
    this.enterCell(b);
  }

  // Height of the ground under the body, looking at most `step` above the feet.
  groundAt(b, x, y, z, step) {
    let g = 0;
    for (const t of this.near) {
      if (t.y1 > y + step + EPS) continue;
      if (x + HW > t.x0 + EPS && x - HW < t.x1 - EPS && z + HW > t.z0 + EPS && z - HW < t.z1 - EPS && t.y1 > g) g = t.y1;
    }
    const ci = cellOf(x), cj = cellOf(z);
    if (ci === b.ci && cj === b.cj) {
      for (let k = 0; k <= H; k++) {
        for (const type of ['r', 'c']) {
          const p = this.pieces.get(type, ci, k, cj);
          if (!p || b.under.has(p.id)) continue;
          const s = surfaceAt(p, x, z);
          if (s > y + STEP_SLOPE + EPS) { b.under.add(p.id); continue; }
          if (s > g) g = s;
        }
      }
    }
    return g;
  }

  // Lowest thing above the body that belongs to a ramp or roof it is under.
  ceilingAt(b, x, z) {
    let c = Infinity;
    for (let k = 0; k <= H; k++) {
      for (const type of ['r', 'c']) {
        const p = this.pieces.get(type, b.ci, k, b.cj);
        if (!p || !b.under.has(p.id)) continue;
        const s = surfaceAt(p, x, z) - (type === 'r' ? RAMP_THICK : 0);
        if (s < c) c = s;
      }
    }
    return c;
  }

  // Is there room for the body here? Boxes it already touches at (ox, oy, oz) don't count.
  free(b, x, y, z, h, ox = NaN, oy = 0, oz = 0) {
    for (const t of this.near) {
      if (t.y1 <= y + 0.1) continue;
      if (!overlaps(t, x, y, z, h)) continue;
      if (ox === ox && overlaps(t, ox, oy, oz, h)) continue;
      return false;
    }
    return this.ceilingAt(b, x, z) >= y + h - EPS;
  }

  // One horizontal move along x or z.
  slide(b, axis, d) {
    if (!d) return;
    const a0 = axis + '0', a1 = axis + '1';
    const ox = b.x, oz = b.z;
    let v = b[axis] + d;
    const step = b.onGround ? STEP_BOX : 0.1;
    let blocked = false;
    for (const t of this.near) {
      if (t.y1 <= b.y + step + EPS) continue;
      const nx = axis === 'x' ? v : ox, nz = axis === 'z' ? v : oz;
      if (!overlaps(t, nx, b.y, nz, b.h) || overlaps(t, ox, b.y, oz, b.h)) continue;
      v = d > 0 ? Math.min(v, t[a0] - HW) : Math.max(v, t[a1] + HW);
      blocked = true;
    }
    if (v < HW) { v = HW; blocked = true; }
    if (v > SIZE - HW) { v = SIZE - HW; blocked = true; }
    const nx = axis === 'x' ? v : ox, nz = axis === 'z' ? v : oz;

    // ramps and roofs
    const ci = cellOf(nx), cj = cellOf(nz);
    const changed = ci !== b.ci || cj !== b.cj;
    let under = b.under, stop = false;
    if (changed) under = new Set();
    for (let k = 0; k <= H && !stop; k++) {
      const r = this.pieces.get('r', ci, k, cj);
      if (r) {
        const s = surfaceAt(r, nx, nz);
        const below = changed ? b.y < s - STEP_SLOPE : b.under.has(r.id);
        if (below) {
          if (changed) under.add(r.id);
          // the slab would newly cut into the body
          if (s > b.y + EPS && s - RAMP_THICK < b.y + b.h - EPS) {
            const so = changed ? Infinity : surfaceAt(r, ox, oz);
            if (!(so > b.y + EPS && so - RAMP_THICK < b.y + b.h - EPS)) stop = true;
          }
        }
      }
      if (changed) {
        const c = this.pieces.get('c', ci, k, cj);
        if (c && b.y < surfaceAt(c, nx, nz) - STEP_SLOPE) under.add(c.id);
      }
    }
    if (!stop) {
      // would the ground here lift me into something?
      const keepUnder = b.under, keepI = b.ci, keepJ = b.cj;
      b.under = under; b.ci = ci; b.cj = cj;
      const g = this.groundAt(b, nx, b.y, nz, step);
      if (g > b.y + EPS && !this.free(b, nx, g, nz, b.h, ox, b.y, oz)) stop = true;
      if (stop) { b.under = keepUnder; b.ci = keepI; b.cj = keepJ; }
    }
    if (stop) { b['v' + axis] = 0; return; }
    b[axis] = v;
    if (blocked) b['v' + axis] = 0;
  }

  // One physics step. Velocities are set by the caller.
  step(b, dt) {
    this.collect(b.x, b.y, b.z, b.h);

    // A wall that appeared on top of me pushes me to its nearer side.
    let px = false, pz = false;
    for (const t of this.near) {
      const p = t.p;
      if (p.type === 'f' || !overlaps(t, b.x, b.y, b.z, b.h)) continue;
      if (p.type === 'wx' && !px) {
        const plane = p.i * C, s = b.x >= plane ? 1 : -1, goal = plane + s * (WT / 2 + HW);
        b.x += s * T.pushOut * dt;
        if ((b.x - goal) * s > 0) b.x = goal;
        px = true;
      } else if (p.type === 'wz' && !pz) {
        const plane = p.j * C, s = b.z >= plane ? 1 : -1, goal = plane + s * (WT / 2 + HW);
        b.z += s * T.pushOut * dt;
        if ((b.z - goal) * s > 0) b.z = goal;
        pz = true;
      }
    }
    if (px || pz) {
      b.x = Math.min(SIZE - HW, Math.max(HW, b.x));
      b.z = Math.min(SIZE - HW, Math.max(HW, b.z));
      if (cellOf(b.x) !== b.ci || cellOf(b.z) !== b.cj) this.enterCell(b);
    }

    this.slide(b, 'x', b.vx * dt);
    this.slide(b, 'z', b.vz * dt);

    // vertical
    const was = b.onGround && !b.jumped;
    b.jumped = false;
    b.vy -= T.gravity * dt;
    let ny = b.y + b.vy * dt;
    const g = this.groundAt(b, b.x, b.y, b.z, b.onGround ? STEP_BOX : 0.1);
    b.onGround = false;
    if (b.vy <= 0 || ny < g) {
      if (ny <= g) {
        if (g - b.y > 0.05) b.lift += g - b.y;
        ny = g; b.vy = 0; b.onGround = true;
      } else if (was && g >= b.y - SNAP) {
        ny = g; b.vy = 0; b.onGround = true;
      }
    } else {
      for (const t of this.near) {
        if (t.y1 <= b.y + 0.1) continue;
        if (overlaps(t, b.x, ny, b.z, b.h) && !overlaps(t, b.x, b.y, b.z, b.h)) { ny = Math.min(ny, t.y0 - b.h); b.vy = 0; }
      }
      const c = this.ceilingAt(b, b.x, b.z);
      if (ny + b.h > c && b.y + b.h <= c + 0.02) { ny = c - b.h; b.vy = 0; }
    }
    b.y = ny;
  }

  // Can the body be `h` tall where it is now (used to stand up again)?
  canBe(b, h) {
    this.collect(b.x, b.y, b.z, h);
    for (const t of this.near) {
      if (t.y1 <= b.y + 0.1) continue;
      if (overlaps(t, b.x, b.y, b.z, h) && !overlaps(t, b.x, b.y, b.z, b.h)) return false;
    }
    return this.ceilingAt(b, b.x, b.z) >= b.y + h - EPS;
  }

  // A new piece showed up. Lift the body on top where that makes sense.
  onPlaced(p, b) {
    if (p.type === 'f') {
      const top = p.k * L;
      if (b.y >= top || top - b.y > 1.3) return;
      let over = false;
      for (const t of p.boxes) if (b.x + HW > t.x0 && b.x - HW < t.x1 && b.z + HW > t.z0 && b.z - HW < t.z1) over = true;
      if (!over) return;
      this.collect(b.x, top, b.z, b.h);
      if (!this.free(b, b.x, top, b.z, b.h)) return;
      b.lift += top - b.y;
      b.y = top; b.vy = 0; b.onGround = true;
      return;
    }
    if (p.type !== 'r' && p.type !== 'c') return;
    if (p.i !== b.ci || p.j !== b.cj) return;
    b.under.delete(p.id);
    const s = surfaceAt(p, b.x, b.z);
    if (b.y >= s - EPS) return;
    this.collect(b.x, s, b.z, b.h);
    if (s - b.y <= (p.type === 'r' ? L : 1.5) + EPS && this.free(b, b.x, s, b.z, b.h)) {
      b.lift += s - b.y;
      b.y = s; b.vy = 0; b.onGround = true;
    } else {
      b.under.add(p.id);
    }
  }

  // A ramp turned under or over the body: sort it again.
  onTurned(p, b) {
    if (p.i !== b.ci || p.j !== b.cj) return;
    const s = surfaceAt(p, b.x, b.z);
    if (b.y >= s - STEP_SLOPE) b.under.delete(p.id); else b.under.add(p.id);
  }

  // Simple helpers for the dummies.
  floorUnder(x, y, z, hw) {
    let g = 0;
    this.collect(x, y, z, 1.6, 0.3);
    for (const t of this.near) {
      if (t.y1 > y + 0.15) continue;
      if (x + hw > t.x0 && x - hw < t.x1 && z + hw > t.z0 && z - hw < t.z1 && t.y1 > g) g = t.y1;
    }
    const ci = cellOf(x), cj = cellOf(z);
    for (let k = 0; k <= H; k++) {
      for (const type of ['r', 'c']) {
        const p = this.pieces.get(type, ci, k, cj);
        if (!p) continue;
        const s = surfaceAt(p, x, z);
        if (s <= y + 0.4 && s > g) g = s;
      }
    }
    return g;
  }

  blockedAt(x, y, z, hw, h) {
    this.collect(x, y, z, h, 0.3);
    for (const t of this.near) {
      if (t.y1 <= y + 0.1) continue;
      if (overlaps(t, x, y, z, h, hw)) return true;
    }
    return false;
  }

  // ---------- rays ----------
  // Returns the nearest hit within tMax, or null. The result object is reused.
  //   dummies   also test the targets
  //   pick      own walls and floors count with their full outline (edit pick)
  //   skip      a piece to ignore
  ray(ox, oy, oz, dx, dy, dz, tMax, { dummies = false, pick = false, skip = null } = {}) {
    const hit = this.hit;
    let best = tMax, kind = '', piece = null, bit = -1, dummy = null, head = false;

    if (dy < -1e-9) { const t = -oy / dy; if (t >= 0 && t < best) { best = t; kind = 'ground'; } }
    if (dx > 1e-9) { const t = (SIZE - ox) / dx; if (t >= 0 && t < best && oy + dy * t < WALL_TOP) { best = t; kind = 'map'; } }
    if (dx < -1e-9) { const t = -ox / dx; if (t >= 0 && t < best && oy + dy * t < WALL_TOP) { best = t; kind = 'map'; } }
    if (dz > 1e-9) { const t = (SIZE - oz) / dz; if (t >= 0 && t < best && oy + dy * t < WALL_TOP) { best = t; kind = 'map'; } }
    if (dz < -1e-9) { const t = -oz / dz; if (t >= 0 && t < best && oy + dy * t < WALL_TOP) { best = t; kind = 'map'; } }

    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    const boxT = (b) => {
      let t0 = 0, t1 = best, a, c;
      a = (b.x0 - ox) * ix; c = (b.x1 - ox) * ix; if (a > c) { const s = a; a = c; c = s; }
      if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1;
      a = (b.y0 - oy) * iy; c = (b.y1 - oy) * iy; if (a > c) { const s = a; a = c; c = s; }
      if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1;
      a = (b.z0 - oz) * iz; c = (b.z1 - oz) * iz; if (a > c) { const s = a; a = c; c = s; }
      if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1;
      return t0;
    };

    for (const p of this.pieces.map.values()) {
      if (p === skip || boxT(p.aabb) < 0) continue;
      if (p.type === 'r') {
        // plane y = base + slope * u
        let gx = 0, gz = 0, c0;
        const s = L / C;
        if (p.dir === 0) { gx = s; c0 = -p.i * C * s; } else if (p.dir === 1) { gz = s; c0 = -p.j * C * s; }
        else if (p.dir === 2) { gx = -s; c0 = (p.i + 1) * C * s; } else { gz = -s; c0 = (p.j + 1) * C * s; }
        const den = dy - gx * dx - gz * dz;
        if (Math.abs(den) < 1e-9) continue;
        const t = (p.k * L + c0 + gx * ox + gz * oz - oy) / den;
        if (t < 0 || t >= best) continue;
        const x = ox + dx * t, z = oz + dz * t;
        if (x < p.aabb.x0 - EPS || x > p.aabb.x1 + EPS || z < p.aabb.z0 - EPS || z > p.aabb.z1 + EPS) continue;
        best = t; kind = 'piece'; piece = p; bit = -1; dummy = null;
      } else if (p.type === 'c') {
        const cx = (p.i + 0.5) * C, cz = (p.j + 0.5) * C, s = 1.5 / (C / 2), top = p.k * L + 1.5;
        for (let f = 0; f < 4; f++) {
          // face f: y = top - s * (sign * (x - cx))   or the same along z
          const sx = f === 0 ? s : f === 2 ? -s : 0, sz = f === 1 ? s : f === 3 ? -s : 0;
          const den = dy + sx * dx + sz * dz;
          if (Math.abs(den) < 1e-9) continue;
          const t = (top - sx * (ox - cx) - sz * (oz - cz) - oy) / den;
          if (t < 0 || t >= best) continue;
          const x = ox + dx * t - cx, z = oz + dz * t - cz;
          const m = sx ? Math.sign(sx) * x : Math.sign(sz) * z;
          if (m < -EPS || m > C / 2 + EPS || Math.abs(sx ? z : x) > m + EPS) continue;
          best = t; kind = 'piece'; piece = p; bit = -1; dummy = null;
        }
      } else if (pick && p.owner === 'me') {
        const t = boxT(p.aabb);
        if (t >= 0 && t < best) { best = t; kind = 'piece'; piece = p; bit = -1; dummy = null; }
      } else {
        for (const b of p.boxes) {
          const t = boxT(b);
          if (t >= 0 && t < best) { best = t; kind = 'piece'; piece = p; bit = b.bit; dummy = null; }
        }
      }
    }

    if (dummies) {
      for (const d of this.dummies) {
        if (!d.alive) continue;
        // head: a sphere
        const hx = d.x - ox, hy = d.y + d.headY - oy, hz = d.z - oz;
        const tc = hx * dx + hy * dy + hz * dz;
        const d2 = hx * hx + hy * hy + hz * hz - tc * tc, r2 = d.headR * d.headR;
        if (tc > 0 && d2 < r2) {
          const t = tc - Math.sqrt(r2 - d2);
          if (t >= 0 && t < best) { best = t; kind = 'dummy'; dummy = d; head = true; piece = null; }
        }
        d.box.x0 = d.x - d.hw; d.box.x1 = d.x + d.hw; d.box.z0 = d.z - d.hw; d.box.z1 = d.z + d.hw;
        d.box.y0 = d.y; d.box.y1 = d.y + d.bodyH;
        const t = boxT(d.box);
        if (t >= 0 && t < best) { best = t; kind = 'dummy'; dummy = d; head = false; piece = null; }
      }
    }

    if (!kind) return null;
    hit.t = best; hit.kind = kind; hit.piece = piece; hit.bit = bit; hit.dummy = dummy; hit.head = head;
    return hit;
  }
}
