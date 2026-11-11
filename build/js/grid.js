// Pure grid math for the building system. No rendering in here, so it can be
// tested on its own.
//
// The arena is N x N cells of C metres, with levels of L metres. A piece sits
// in a slot:
//   wx  wall in the plane x = i*C, between z = j*C and (j+1)*C
//   wz  wall in the plane z = j*C, between x = i*C and (i+1)*C
//   f   floor panel at y = k*L over cell (i, j)
//   r   ramp inside cell (i, j), from y = k*L up to (k+1)*L
//   c   roof (low pyramid) with its base at y = k*L over cell (i, j)

export const C = 4;          // cell width
export const L = 3;          // level height
export const N = 7;          // cells per side
export const H = 5;          // build height in levels
export const WT = 0.2;       // wall and floor thickness
export const CONE_H = 1.5;   // roof height
export const RAMP_THICK = 0.25;
export const SIZE = N * C;

const TYPE_ID = { wx: 0, wz: 1, f: 2, r: 3, c: 4 };
export const TYPES = ['wx', 'wz', 'f', 'r', 'c'];

export function slotKey(type, i, k, j) { return (TYPE_ID[type] << 12) | (i << 8) | (k << 4) | j; }

// The outer ring of walls belongs to the map, so player walls start one line in.
export function inBounds(type, i, k, j) {
  if (!Number.isInteger(i) || !Number.isInteger(k) || !Number.isInteger(j)) return false;
  switch (type) {
    case 'wx': return i >= 1 && i <= N - 1 && j >= 0 && j <= N - 1 && k >= 0 && k <= H - 1;
    case 'wz': return i >= 0 && i <= N - 1 && j >= 1 && j <= N - 1 && k >= 0 && k <= H - 1;
    case 'f': return i >= 0 && i <= N - 1 && j >= 0 && j <= N - 1 && k >= 1 && k <= H;
    case 'r': return i >= 0 && i <= N - 1 && j >= 0 && j <= N - 1 && k >= 0 && k <= H - 1;
    case 'c': return i >= 0 && i <= N - 1 && j >= 0 && j <= N - 1 && k >= 1 && k <= H;
    default: return false;
  }
}

// Lattice edges hold the structure together. axis 0 runs along x, 1 along z,
// 2 straight up, each starting at grid corner (i, k, j).
const EX = 0, EZ = 1, EY = 2;
export function edgeKey(axis, i, k, j) { return (axis << 12) | (i << 8) | (k << 4) | j; }

function square(i, k, j) {
  return [edgeKey(EX, i, k, j), edgeKey(EX, i, k, j + 1), edgeKey(EZ, i, k, j), edgeKey(EZ, i + 1, k, j)];
}

export function edgesOf(type, i, k, j) {
  switch (type) {
    case 'f':
    case 'c': return square(i, k, j);
    case 'wx': return [edgeKey(EZ, i, k, j), edgeKey(EZ, i, k + 1, j), edgeKey(EY, i, k, j), edgeKey(EY, i, k, j + 1)];
    case 'wz': return [edgeKey(EX, i, k, j), edgeKey(EX, i, k + 1, j), edgeKey(EY, i, k, j), edgeKey(EY, i + 1, k, j)];
    case 'r': return square(i, k, j).concat(square(i, k + 1, j));
    default: return [];
  }
}

// An edge is anchored when it lies on the ground or on the outer map walls.
export function edgeAnchored(e) {
  const axis = e >> 12, i = (e >> 8) & 15, k = (e >> 4) & 15, j = e & 15;
  if (axis === EX) return k === 0 || j === 0 || j === N;
  if (axis === EZ) return k === 0 || i === 0 || i === N;
  return i === 0 || i === N || j === 0 || j === N;
}

// Tracks which edges are in use and answers "would this stand?" and "what is
// floating now?".
export class Support {
  constructor() {
    this.use = new Map();    // edge -> Set of piece ids
    this.edges = new Map();  // piece id -> its edges
  }

  clear() { this.use.clear(); this.edges.clear(); }

  add(id, edges) {
    this.edges.set(id, edges);
    for (const e of edges) {
      let s = this.use.get(e);
      if (!s) this.use.set(e, s = new Set());
      s.add(id);
    }
  }

  remove(id) {
    const edges = this.edges.get(id);
    if (!edges) return;
    for (const e of edges) {
      const s = this.use.get(e);
      if (s) { s.delete(id); if (!s.size) this.use.delete(e); }
    }
    this.edges.delete(id);
  }

  // A new piece with these edges stands if one edge is anchored or shared.
  supported(edges) {
    for (const e of edges) if (edgeAnchored(e) || this.use.has(e)) return true;
    return false;
  }

  // Ids of pieces with no chain of shared edges down to an anchor.
  floating() {
    const seen = new Set();
    let frontier = [];
    for (const [id, edges] of this.edges) {
      if (edges.some(edgeAnchored)) { seen.add(id); frontier.push(id); }
    }
    while (frontier.length) {
      const next = [];
      for (const id of frontier) {
        for (const e of this.edges.get(id)) {
          for (const other of this.use.get(e)) {
            if (!seen.has(other)) { seen.add(other); next.push(other); }
          }
        }
      }
      frontier = next;
    }
    const out = [];
    for (const id of this.edges.keys()) if (!seen.has(id)) out.push(id);
    return out;
  }

  // How many steps each floating piece is away from the edges of what just
  // broke, so a collapse can ripple outwards.
  depths(floating, fromEdges) {
    const set = new Set(floating), depth = new Map();
    let frontier = [];
    for (const e of fromEdges) {
      for (const id of this.use.get(e) || []) {
        if (set.has(id) && !depth.has(id)) { depth.set(id, 0); frontier.push(id); }
      }
    }
    let d = 0;
    while (frontier.length) {
      const next = [];
      d++;
      for (const id of frontier) {
        for (const e of this.edges.get(id)) {
          for (const other of this.use.get(e)) {
            if (set.has(other) && !depth.has(other)) { depth.set(other, d); next.push(other); }
          }
        }
      }
      frontier = next;
    }
    for (const id of floating) if (!depth.has(id)) depth.set(id, d + 1);
    return depth;
  }
}

// Where a ray crosses the inner wall planes, nearest first.
// Each entry: { t, axis: 'x' | 'z', n } with the plane at n*C.
export function wallCrossings(ox, oz, dx, dz, tMin, tMax) {
  const out = [];
  for (let n = 1; n <= N - 1; n++) {
    if (Math.abs(dx) > 1e-9) {
      const t = (n * C - ox) / dx;
      if (t > tMin && t <= tMax) out.push({ t, axis: 'x', n });
    }
    if (Math.abs(dz) > 1e-9) {
      const t = (n * C - oz) / dz;
      if (t > tMin && t <= tMax) out.push({ t, axis: 'z', n });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

// Where a ray crosses the floor levels 1..H, nearest first: { t, k }.
export function levelCrossings(oy, dy, tMin, tMax) {
  const out = [];
  if (Math.abs(dy) < 1e-9) return out;
  for (let k = 1; k <= H; k++) {
    const t = (k * L - oy) / dy;
    if (t > tMin && t <= tMax) out.push({ t, k });
  }
  return out.sort((a, b) => a.t - b.t);
}

export function cellOf(v) { return Math.max(0, Math.min(N - 1, Math.floor(v / C))); }

// 0 = +x, 1 = +z, 2 = -x, 3 = -z
export function facing(dx, dz) {
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 0 : 2;
  return dz >= 0 ? 1 : 3;
}
export const DIR_X = [1, 0, -1, 0];
export const DIR_Z = [0, 1, 0, -1];
