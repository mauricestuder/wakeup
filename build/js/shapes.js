// Which edits exist, and what each one turns a piece into. Pure data and
// math, no rendering, so it can be tested on its own.
//
//   walls   3 x 3 tiles, marked tiles are taken out. Only the patterns in
//           WALLS are real shapes; everything else is refused.
//   floors  2 x 2 tiles, marked tiles are taken out. Anything but "all four".
//   roofs   2 x 2 tiles, a marked tile lifts that corner. Anything but "all four".
//   ramps   the 8 outer tiles of a 3 x 3 grid, marked tiles are the path the
//           ramp takes, starting at the tile that was marked first.

import { C, L, CONE_H, DIR_X, DIR_Z } from './grid.js';

const TW = C / 3, TH = L / 3;

// ---------- walls ----------
const rect = (s0, y0, s1, y1) => [[s0, y0], [s1, y0], [s1, y1], [s0, y1]];
const cols = (list, h) => list.map((c) => rect(c * TW, 0, (c + 1) * TW, h));

// Pattern: top row first, X = tile taken out. 'm' = also exists mirrored.
// The last entry is the solid part when it is not simply "the tiles left over".
const WALL_DEFS = [
  ['Wall', '... ... ...'],
  ['Window', '... .X. ...'],
  ['Side window', '... X.. ...', 'm'],
  ['Two windows', '... X.X ...'],
  ['Door', '... .X. .X.'],
  ['Side door', '... X.. X..', 'm'],
  ['Door and window', '... X.X X..', 'm'],
  ['Arch', '... .X. XXX'],
  ['Wide arch', '... XXX XXX'],
  ['Half arch', '... .XX .XX', 'm'],
  ['Pillar', 'XX. XX. XX.', 'm'],
  ['Half wall', 'XXX ... ...', '', cols([0, 1, 2], L / 2)],
  ['Half wall with a gap', 'XXX .X. .X.', '', cols([0, 2], L / 2)],
  ['Half wall, gap at the side', 'XXX X.. X..', 'm', cols([1, 2], L / 2)],
  ['Half wall, narrow', 'XXX XX. XX.', 'm', cols([2], L / 2)],
  ['Low wall', 'XXX XXX ...', '', cols([0, 1, 2], L / 4)],
  ['Low wall, narrow', 'XXX XXX XX.', 'm', cols([2], L / 4)],
  ['Triangle', 'XX. X.. ...', 'm', [[[0, 0], [C, 0], [C, L]]]],
  ['Gable', 'X.X ... ...', '', [[[0, 0], [C, 0], [C / 2, L]]]],
  ['Brace', '..X .XX XXX', 'm', [[[0, L / 3], [2 * C / 3, L], [0, L]]]],
];

function wallBits(pattern) {
  const rows = pattern.split(' ');
  let m = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (rows[2 - r][c] === 'X') m |= 1 << (r * 3 + c);
  return m;
}

function mirrorBits(m) {
  let out = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (m & (1 << (r * 3 + c))) out |= 1 << (r * 3 + 2 - c);
  return out;
}

function leftover(removed) {
  const out = [];
  for (let bit = 0; bit < 9; bit++) {
    if (removed & (1 << bit)) continue;
    const r = Math.floor(bit / 3), c = bit % 3;
    out.push(rect(c * TW, r * TH, (c + 1) * TW, (r + 1) * TH));
  }
  return out;
}

function isRect(p) {
  return p.length === 4 && p[0][1] === p[1][1] && p[2][1] === p[3][1] && p[0][0] === p[3][0] && p[1][0] === p[2][0];
}

// Lowest and highest point of a convex outline above s.
function span(poly, s) {
  let lo = Infinity, hi = -Infinity;
  for (let n = 0; n < poly.length; n++) {
    const a = poly[n], b = poly[(n + 1) % poly.length];
    if ((a[0] - s) * (b[0] - s) > 0 || a[0] === b[0]) continue;
    const y = a[1] + (b[1] - a[1]) * (s - a[0]) / (b[0] - a[0]);
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  return [lo, hi];
}

// Collision boxes [s0, y0, s1, y1]. Slanted outlines become a row of slabs.
function boxesOf(polys) {
  const out = [], SLABS = 8;
  for (const p of polys) {
    if (isRect(p)) { out.push([p[0][0], p[0][1], p[2][0], p[2][1]]); continue; }
    let s0 = Infinity, s1 = -Infinity;
    for (const [s] of p) { if (s < s0) s0 = s; if (s > s1) s1 = s; }
    const w = (s1 - s0) / SLABS;
    for (let n = 0; n < SLABS; n++) {
      const [lo, hi] = span(p, s0 + (n + 0.5) * w);
      if (hi - lo > 0.02) out.push([s0 + n * w, lo, s0 + (n + 1) * w, hi]);
    }
  }
  return out;
}

// removed-tiles mask -> { name, polys, boxes }
export const WALLS = new Map();
for (const [name, pattern, flag, solid] of WALL_DEFS) {
  const removed = wallBits(pattern), polys = solid || leftover(removed);
  WALLS.set(removed, { name, polys, boxes: boxesOf(polys) });
  if (flag === 'm') {
    const mp = polys.map((p) => p.map(([s, y]) => [C - s, y]).reverse());
    WALLS.set(mirrorBits(removed), { name, polys: mp, boxes: boxesOf(mp) });
  }
}

// ---------- sloped pieces ----------
// A facet is a flat patch: corner points [x, y, z] inside the cell (0..C), in
// order around the patch, plus its plane y = c + gx * x + gz * z.
function facet(pts) {
  const [a, b, d] = [pts[0], pts[1], pts[pts.length - 1]];
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
  const det = ux * vz - uz * vx;
  const gx = (uy * vz - uz * vy) / det, gz = (ux * vy - uy * vx) / det;
  return { pts, gx, gz, c: a[1] - gx * a[0] - gz * a[2] };
}

// Height of a list of facets above (x, z), or null where there is none.
export function heightAt(facets, x, z, ox = 0, oy = 0, oz = 0) {
  const lx = x - ox, lz = z - oz;
  for (const f of facets) if (inside(f, lx, lz)) return oy + f.c + f.gx * lx + f.gz * lz;
  return null;
}

export function inside(f, x, z, eps = 1e-6) {
  const p = f.pts;
  let sign = 0;
  for (let n = 0; n < p.length; n++) {
    const a = p[n], b = p[(n + 1) % p.length];
    const cr = (b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0]);
    if (cr > eps) { if (sign < 0) return false; sign = 1; } else if (cr < -eps) { if (sign > 0) return false; sign = -1; }
  }
  return true;
}

// Roofs. A bit of the mask lifts one corner: bit = a + 2 * b for the corner at
// x = a * C, z = b * C. No bit set is the plain pyramid.
export const ROOF_NAMES = ['Pyramid', 'Corner up', 'Slope', 'Three corners up', 'Ridge'];
export function roofValid(mask) { return mask >= 0 && mask < 15; }

export function roofFacets(mask) {
  const P = (a, b, h) => [a * C, h * CONE_H, b * C];
  const corner = (n) => [n & 1, n >> 1];
  const up = [0, 1, 2, 3].filter((n) => mask & (1 << n)), down = [0, 1, 2, 3].filter((n) => !(mask & (1 << n)));
  const pt = (n) => P(...corner(n), mask & (1 << n) ? 1 : 0);
  const RING = [0, 1, 3, 2];                       // the corners in order around the cell
  const out = [];
  if (!up.length) {
    for (let n = 0; n < 4; n++) out.push(facet([pt(RING[n]), pt(RING[(n + 1) % 4]), P(0.5, 0.5, 1)]));
  } else if (up.length === 2 && up[0] + up[1] !== 3) {
    out.push(facet(RING.map(pt)));                 // two neighbours up: one slope
  } else {
    // Split along a diagonal: through the single odd corner, or along the ridge.
    const through = up.length === 1 ? up[0] : up.length === 3 ? down[0] : up[0];
    const at = RING.indexOf(through), a = RING[(at + 1) % 4], opp = RING[(at + 2) % 4], b = RING[(at + 3) % 4];
    out.push(facet([pt(through), pt(a), pt(opp)]), facet([pt(through), pt(opp), pt(b)]));
  }
  return out;
}

// Ramps. Local view: `a` runs up the first flight (0..3 tiles), `s` across from
// left to right. side 1 mirrors left and right.
//   F  full ramp          R  narrow ramp along one side
//   T  up one side, then a turn across the far end
//   U  up one side, across the far end, back up the other side
const T3 = C / 3;
const STAIR_PARTS = {
  F: [[0, 3, 0, 3, 'a', 0, 1]],
  R: [[0, 3, 0, 1, 'a', 0, 1]],
  T: [[0, 2, 0, 1, 'a', 0, 1 / 2], [2, 3, 0, 1, '', 1 / 2, 1 / 2], [2, 3, 1, 3, 's', 1 / 2, 1]],
  U: [[0, 2, 0, 1, 'a', 0, 1 / 3], [2, 3, 0, 1, '', 1 / 3, 1 / 3], [2, 3, 1, 2, 's', 1 / 3, 2 / 3],
    [2, 3, 2, 3, '', 2 / 3, 2 / 3], [0, 2, 2, 3, 'a', 1, 2 / 3]],
};
const STAIR_TILES = {     // [a, s] of the tiles the path covers, first one is the start
  F: [],
  R: [[0, 0], [1, 0], [2, 0]],
  T: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
  U: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2]],
};
export const STAIR_NAMES = { F: 'Ramp', R: 'Narrow ramp', T: 'Ramp with a turn', U: 'Ramp that turns back' };

function toCell(dir, side, a, s) {
  if (side) s = C - s;
  const fx = DIR_X[dir], fz = DIR_Z[dir];
  return [C / 2 + fx * (a - C / 2) - fz * (s - C / 2), C / 2 + fz * (a - C / 2) + fx * (s - C / 2)];
}

export function stairFacets(form, dir, side) {
  const out = [];
  for (const [a0, a1, s0, s1, rise, h0, h1] of STAIR_PARTS[form]) {
    const pt = (a, s) => {
      const t = rise === 'a' ? (a - a0) / (a1 - a0) : rise === 's' ? (s - s0) / (s1 - s0) : 0;
      const [x, z] = toCell(dir, side, a * T3, s * T3);
      return [x, (h0 + (h1 - h0) * t) * L, z];
    };
    out.push(facet([pt(a0, s0), pt(a1, s0), pt(a1, s1), pt(a0, s1)]));
  }
  return out;
}

// Tile bit in the cell's own 3 x 3 grid: column along x, row along z.
function tileBit(dir, side, a, s) {
  const [x, z] = toCell(dir, side, (a + 0.5) * T3, (s + 0.5) * T3);
  return Math.floor(z / T3) * 3 + Math.floor(x / T3);
}

// The marked tiles and the start tile of a ramp as it is now.
export function stairTiles(form, dir, side) {
  let mask = 0;
  for (const [a, s] of STAIR_TILES[form]) mask |= 1 << tileBit(dir, side, a, s);
  return { mask, start: form === 'F' ? -1 : tileBit(dir, side, 0, 0) };
}

// Every pattern that makes a narrow or turning ramp.
const STAIRS = [];
for (let dir = 0; dir < 4; dir++) {
  for (const form of ['R', 'T', 'U']) {
    for (let side = 0; side < 2; side++) {
      const t = stairTiles(form, dir, side);
      STAIRS.push({ mask: t.mask, start: t.start, form, dir, side });
    }
  }
}

const gridDist = (a, b) => Math.abs(a % 3 - b % 3) + Math.abs(Math.floor(a / 3) - Math.floor(b / 3));
const fromPoint = (bit, px, pz) => Math.hypot((bit % 3 + 0.5) * T3 - px, (Math.floor(bit / 3) + 0.5) * T3 - pz);

// Marked tiles -> { form, dir, side }, or null when they make no ramp.
//   two tiles next to each other   the full ramp, turned to rise from the first to the second
//   one whole side                 a narrow ramp along it
//   two or three sides             a ramp with one or two turns
// The ramp starts at the tile marked first. When that doesn't decide it, it
// starts at the end nearest to (px, pz), a point inside the cell.
export function resolveStair(mask, first, px, pz) {
  if (mask & 16) return null;            // the middle tile is never part of a ramp
  const bits = [];
  for (let b = 0; b < 9; b++) if (mask & (1 << b)) bits.push(b);
  if (bits.length === 2) {
    if (gridDist(bits[0], bits[1]) !== 1) return null;
    let from = bits[0], to = bits[1];
    if (first === to || (first !== from && fromPoint(to, px, pz) < fromPoint(from, px, pz))) [from, to] = [to, from];
    const dx = to % 3 - from % 3, dz = Math.floor(to / 3) - Math.floor(from / 3);
    return { form: 'F', dir: dx > 0 ? 0 : dz > 0 ? 1 : dx < 0 ? 2 : 3, side: 0 };
  }
  let best = null, score = Infinity;
  for (const c of STAIRS) {
    if (c.mask !== mask) continue;
    const sc = (first >= 0 ? gridDist(c.start, first) : 0) * 100 + fromPoint(c.start, px, pz);
    if (sc < score) { score = sc; best = c; }
  }
  return best && { form: best.form, dir: best.dir, side: best.side };
}
