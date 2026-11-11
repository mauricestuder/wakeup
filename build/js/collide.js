// Player-versus-world collision and ray casts.
//
// The body is an upright box. Walls and floors are boxes (one per tile), so
// doors, windows and half walls fall out of the same test. Ramps and roofs are
// height fields sampled under the body's centre.

import { C, L, N, H, SIZE, WT, RAMP_THICK, WALL_LEVELS, cellOf } from './grid.js';
import { surfaceAt } from './pieces.js';
import { inside } from './shapes.js';
import { T } from './tuning.js';

export const HW = 0.4;           // half width of the player
export const STAND = 1.55;
export const CROUCH = 1.05;
const STEP_SLOPE = 0.75;         // how far a ramp or roof may lift the feet
const STEP_BOX = 0.5;            // same for the top of a tile (ramp onto floor)
const SNAP = 0.3;                // stay glued when walking downhill
const EPS = 1e-4;
export const WALL_TOP = WALL_LEVELS * L;   // height of the map walls
const SLOPED = ['r', 'c'];
const THICK = { r: RAMP_THICK, c: 0.05 };
// Ramps and roofs only matter on the levels around the body.
const lo = (y) => Math.max(0, Math.floor((y - 3) / L) - 1);
const hi = (y, h) => Math.min(H, Math.floor((y + h + 3) / L));

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
    for (let k = lo(b.y), k1 = hi(b.y, b.h); k <= k1; k++) {
      for (const type of SLOPED) {
        const p = this.pieces.get(type, b.ci, k, b.cj);
        const s = p ? surfaceAt(p, x, z) : null;
        if (s !== null && b.y < s - STEP_SLOPE) b.under.add(p.id);
      }
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
      for (let k = lo(y), k1 = hi(y, b.h); k <= k1; k++) {
        for (const type of SLOPED) {
          const p = this.pieces.get(type, ci, k, cj);
          if (!p) continue;
          const s = surfaceAt(p, x, z);
          if (s === null) { b.under.delete(p.id); continue; }   // beside a narrow ramp: neither on it nor under it
          if (b.under.has(p.id)) continue;
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
    for (let k = lo(b.y), k1 = hi(b.y, b.h); k <= k1; k++) {
      for (const type of SLOPED) {
        const p = this.pieces.get(type, b.ci, k, b.cj);
        if (!p || !b.under.has(p.id)) continue;
        const top = surfaceAt(p, x, z);
        if (top === null) continue;
        const s = top - THICK[type];
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
    for (let k = lo(b.y), k1 = hi(b.y, b.h); k <= k1 && !stop; k++) {
      for (const type of SLOPED) {
        const p = this.pieces.get(type, ci, k, cj);
        if (!p) continue;
        const s = surfaceAt(p, nx, nz);
        if (s === null) continue;
        const so = changed ? null : surfaceAt(p, ox, oz);
        // coming in from outside decides it by height, otherwise it stays as it was
        const below = so === null ? b.y < s - STEP_SLOPE : b.under.has(p.id);
        if (!below) continue;
        under.add(p.id);
        // the slab would newly cut into the body
        const cuts = (h) => h !== null && h > b.y + EPS && h - THICK[type] < b.y + b.h - EPS;
        if (cuts(s) && !cuts(so)) { stop = true; break; }
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

  // Is a body of height h free of everything at this spot? (Used for mantling,
  // so it looks at the place itself and not at where the body is now.)
  clear(x, y, z, h) {
    for (const t of this.near) {
      if (t.y1 > y + 0.05 && overlaps(t, x, y, z, h)) return false;
    }
    const ci = cellOf(x), cj = cellOf(z);
    for (let k = lo(y), k1 = hi(y, h); k <= k1; k++) {
      for (const type of SLOPED) {
        const p = this.pieces.get(type, ci, k, cj);
        const s = p ? surfaceAt(p, x, z) : null;
        if (s !== null && s > y + 0.05 && s - THICK[type] < y + h) return false;
      }
    }
    return x >= HW && x <= SIZE - HW && z >= HW && z <= SIZE - HW;
  }

  // A ledge to pull up on: the lowest surface under (x, z) between yMin and
  // yMax that has room to stand on, with room to rise to it from where the
  // body is. Returns its height, or null.
  ledge(b, x, z, yMin, yMax) {
    this.collect(b.x, b.y, b.z, yMax - b.y + b.h + 0.5, 1.3);
    const tops = [];
    for (const t of this.near) {
      if (t.y1 > yMin && t.y1 <= yMax && x + HW > t.x0 + EPS && x - HW < t.x1 - EPS && z + HW > t.z0 + EPS && z - HW < t.z1 - EPS) tops.push(t.y1);
    }
    const ci = cellOf(x), cj = cellOf(z);
    for (let k = lo(b.y), k1 = hi(yMax, b.h); k <= k1; k++) {
      for (const type of SLOPED) {
        const p = this.pieces.get(type, ci, k, cj);
        const s = p ? surfaceAt(p, x, z) : null;
        if (s !== null && s > yMin && s <= yMax) tops.push(s);
      }
    }
    tops.sort((a, c) => a - c);
    for (const top of tops) {
      // room on top, and nothing over my head on the way up
      if (this.clear(x, top, z, b.h) && this.clear(b.x, b.y, b.z, top - b.y + b.h)) return top;
    }
    return null;
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
    if (s === null || b.y >= s - EPS) return;
    this.collect(b.x, s, b.z, b.h);
    if (s - b.y <= L + EPS && this.free(b, b.x, s, b.z, b.h)) {
      b.lift += s - b.y;
      b.y = s; b.vy = 0; b.onGround = true;
    } else {
      b.under.add(p.id);
    }
  }

  // A ramp or roof changed shape under or over the body: sort it again.
  onTurned(p, b) {
    if (p.i !== b.ci || p.j !== b.cj) return;
    const s = surfaceAt(p, b.x, b.z);
    if (s === null || b.y >= s - STEP_SLOPE) b.under.delete(p.id); else b.under.add(p.id);
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
    for (let k = lo(y), k1 = hi(y, 1.6); k <= k1; k++) {
      for (const type of SLOPED) {
        const p = this.pieces.get(type, ci, k, cj);
        if (!p) continue;
        const s = surfaceAt(p, x, z);
        if (s !== null && s <= y + 0.4 && s > g) g = s;
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
  //   pick      own walls and floors count with their full outline, openings
  //             included (the edit pick falls back on this)
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
      if (p.type === 'r' || p.type === 'c') {
        // each flat patch: y = base + c + gx * x + gz * z
        const bx = p.i * C, by = p.k * L, bz = p.j * C;
        for (const f of p.facets) {
          const den = dy - f.gx * dx - f.gz * dz;
          if (Math.abs(den) < 1e-9) continue;
          const t = (by + f.c + f.gx * (ox - bx) + f.gz * (oz - bz) - oy) / den;
          if (t < 0 || t >= best) continue;
          if (!inside(f, ox + dx * t - bx, oz + dz * t - bz, 1e-4)) continue;
          best = t; kind = 'piece'; piece = p; bit = -1; dummy = null;
        }
      } else if (pick && p.owner === 'me') {
        const t = boxT(p.aabb);
        if (t >= 0 && t < best) { best = t; kind = 'piece'; piece = p; bit = -1; dummy = null; }
      } else {
        for (const b of p.boxes) {
          const t = boxT(b);
          if (t >= 0 && t < best) { best = t; kind = 'piece'; piece = p; bit = -1; dummy = null; }
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
