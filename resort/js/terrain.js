// Idle Lift: the mountain itself. Heights, slopes and forest. No rendering here,
// so the rules can be tested without a browser.
import { T } from './tuning.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Small seeded random generator (mulberry32). `state` is a one-element array so it can be saved.
export function rngFrom(state) {
  return () => {
    state[0] = (state[0] + 0x6D2B79F5) >>> 0;
    let t = state[0];
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const hash = (i, j) => {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x, y) => {
    const i = Math.floor(x), j = Math.floor(y);
    let fx = x - i, fy = y - j;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const fbm = (x, y, oct = 4) => {
    let s = 0, a = 0.5, n = 0;
    for (let o = 0; o < oct; o++) { s += a * noise(x, y); n += a; x *= 2.03; y *= 2.03; a *= 0.5; }
    return s / n;
  };
  return { noise, fbm };
}

export function makeTerrain(map) {
  const N = T.N, W = N + 1, H = map.H;
  const { noise, fbm } = makeNoise(map.seed);
  let h = new Float32Array(W * W);
  const FLAT = 9; // depth of the valley floor at the front
  const base = { x: N / 2, z: N - 4.5 };

  for (let j = 0; j < W; j++) {
    for (let i = 0; i < W; i++) {
      const t = clamp((N - FLAT - j) / (N - FLAT), 0, 1);
      let v = H * (0.1 * t + 0.9 * Math.pow(t, map.curve));
      // The massif narrows towards the summit, and its crest wanders left and right.
      const crest = (noise(j * 0.045, 7.7) - 0.5) * 0.7 * t;
      const u = (i - N / 2) / (N / 2) - crest;
      v *= 1 - map.narrow * t * Math.min(1, u * u);
      // Ridges and gullies along the fall line, then smaller bumps.
      const rise = smooth(0, 0.14, t);
      v += (fbm(i * 0.075, j * 0.028 + 3, 3) - 0.5) * H * map.ridge * (0.3 + t) * rise * 2;
      v += (fbm(i * 0.2, j * 0.2, 3) - 0.5) * H * 0.045 * rise;
      v = Math.max(0, v) + noise(i * 0.3, j * 0.3 + 40) * 0.25;
      // A level patch for the car park and the village.
      const d = Math.hypot(i - base.x, j - base.z);
      v = v * smooth(3, 9, d) + 0.15 * (1 - smooth(3, 9, d));
      h[j * W + i] = v;
    }
  }
  // One soft blur so nothing is spiky.
  const b = new Float32Array(W * W);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    let s = 0, n = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const x = i + di, y = j + dj;
      if (x < 0 || y < 0 || x >= W || y >= W) continue;
      const w = di === 0 && dj === 0 ? 4 : 1;
      s += h[y * W + x] * w; n += w;
    }
    b[j * W + i] = s / n;
  }
  h = b;
  let top = 0;
  for (let k = 0; k < h.length; k++) top = Math.max(top, h[k]);

  // Height on the same two triangles per tile that the 3D mesh draws, so nothing floats or sinks.
  const height = (x, z) => {
    x = clamp(x, 0, N - 0.0001); z = clamp(z, 0, N - 0.0001);
    const i = x | 0, j = z | 0, fx = x - i, fz = z - j, k = j * W + i;
    const a = h[k], bb = h[k + 1], c = h[k + W], d = h[k + W + 1];
    return fx + fz <= 1 ? a + (bb - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (bb - d) * (1 - fz);
  };
  // Steepness: height change per tile along the steepest direction.
  const slope = (x, z) => Math.hypot(height(x + 0.5, z) - height(x - 0.5, z), height(x, z + 0.5) - height(x, z - 0.5));
  const alt = (x, z) => clamp(height(x, z) / top, 0, 1);
  const inside = (x, z, m = 1.5) => x >= m && z >= m && x <= N - m && z <= N - m;

  // Forest: below a wandering treeline, in patches, never on cliffs or the car park.
  const rnd = rngFrom([map.seed ^ 0x51ed]);
  const trees = [], byTile = new Map();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const cx = i + 0.5, cz = j + 0.5, a = alt(cx, cz);
    const line = map.treeline + (noise(cx * 0.13, cz * 0.13 + 9) - 0.5) * 0.22;
    const dens = fbm(cx * 0.085 + 50, cz * 0.085 + 50, 3);
    const r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd(), r5 = rnd(), r6 = rnd();
    if (a > line || slope(cx, cz) > 0.85 || Math.hypot(cx - base.x, cz - base.z) < 7.5 || cz > N - 2.5) continue;
    // The forest thins out gradually: dense cores, loose edges, and single trees and
    // small groups across the open slopes, fewer towards the treeline.
    const edge = smooth(0.34, 0.56, dens), high = 1 - smooth(line - 0.22, line, a);
    const grove = fbm(cx * 0.31 + 7, cz * 0.31 + 3, 2) > 0.6 ? 0.22 : 0;
    const chance = (0.045 + edge * 0.62 + grove) * (0.35 + 0.65 * high);
    const want = dens > 0.63 && r6 < 0.55 ? 2 : r1 < chance ? 1 : 0;
    const ids = [];
    for (let n = 0; n < want; n++) {
      const x = i + 0.15 + (n ? r4 : r2) * 0.7, z = j + 0.15 + (n ? r5 : r3) * 0.7;
      ids.push(trees.length);
      // Young trees stand in the open, tall ones deep in the forest.
      trees.push({ x, z, y: height(x, z), s: (0.5 + edge * 0.35) + (n ? r5 : r3) * (0.45 + edge * 0.35) });
    }
    if (ids.length) byTile.set(j * N + i, ids);
  }
  const alive = new Uint8Array(trees.length).fill(1);

  // Trees standing within r of a point. Used both to count and to clear them.
  const treesNear = (x, z, r, out = []) => {
    const i0 = Math.max(0, Math.floor(x - r)), i1 = Math.min(N - 1, Math.floor(x + r));
    const j0 = Math.max(0, Math.floor(z - r)), j1 = Math.min(N - 1, Math.floor(z + r));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const ids = byTile.get(j * N + i);
      if (!ids) continue;
      for (const id of ids) {
        if (alive[id] && Math.hypot(trees[id].x - x, trees[id].z - z) <= r && !out.includes(id)) out.push(id);
      }
    }
    return out;
  };

  // ---------- the land around the mountain ----------
  // Outside the N x N square the ground carries on: a flat valley floor in front, where
  // the road runs, and other ridges to the sides, behind the summit and across the valley.
  const FRONT = 12;
  const far = (x, z) => {
    const cx = clamp(x, 0, N), cz = clamp(z, 0, N), e = height(cx, cz);
    const dx = Math.abs(x - cx), db = Math.max(0, -z), df = Math.max(0, z - N), side = Math.hypot(dx, db);
    const up = smooth(N - 1, N - 13, z); // 0 in the valley, 1 on the mountain side
    const f = smooth(0, 3, df);
    let v = df > 0 ? e * (1 - f) + 0.2 * f : e * (1 - 0.5 * smooth(0, 90, db));
    v += smooth(3, 110, side) * H * (0.3 + 1.6 * fbm(x * 0.011 + 20, z * 0.011 + 20, 3)) * up;
    v += smooth(FRONT, FRONT + 110, df) * H * (0.2 + 1.1 * fbm(x * 0.012 + 70, z * 0.012 + 70, 3));
    v += (fbm(x * 0.06 + 5, z * 0.06 + 5, 2) - 0.5) * 4 * smooth(2, 30, side * up + Math.max(0, df - FRONT));
    return Math.max(0.05, v);
  };
  const ground = (x, z) => (x >= 0 && z >= 0 && x <= N && z <= N ? height(x, z) : far(x, z));
  // How thick the forest is at a spot (0 to 1), given the ground height there.
  const woods = (x, z, y) => {
    const a = clamp(y / top, 0, 1), line = map.treeline + (noise(x * 0.13, z * 0.13 + 9) - 0.5) * 0.22;
    if (a > line) return 0;
    return smooth(0.34, 0.56, fbm(x * 0.085 + 50, z * 0.085 + 50, 3)) * (0.35 + 0.65 * (1 - smooth(line - 0.22, line, a)));
  };
  // Trees just outside the square, so the forest does not stop at a line. They are never cut.
  const outer = [], RING = 46, r2 = rngFrom([map.seed ^ 0x77aa]);
  for (let j = -RING; j < N + RING; j++) for (let i = -RING; i < N + RING; i++) {
    const a = r2(), b2 = r2(), c2 = r2();
    if (i >= 0 && j >= 0 && i < N && j < N) continue;
    const x = i + 0.15 + b2 * 0.7, z = j + 0.15 + c2 * 0.7;
    if (z > N - 2.5 && z < N + FRONT + 1) continue; // the valley floor stays open
    const out = Math.hypot(Math.max(0, -x, x - N), Math.max(0, -z, z - N)), y = far(x, z);
    const w = woods(x, z, y);
    if (a > (0.02 + w * 0.26) * (1 - smooth(RING * 0.5, RING, out))) continue;
    if (Math.hypot(far(x + 0.5, z) - far(x - 0.5, z), far(x, z + 0.5) - far(x, z - 0.5)) > 0.85) continue;
    outer.push({ x, z, y, s: 0.55 + w * 0.35 + c2 * 0.6 });
  }
  // The road along the valley, the parking bays beside it and the coach stop.
  const road = { z: N + 2.6, y: 0.4, x0: -115, x1: N + 130, bays: [], bayZ: N + 0.3, stop: base.x + 16 };
  for (let i = 0; i < 20; i++) road.bays.push(base.x - 9.975 + i * 1.05);

  return { N, W, H, top, h, base, height, slope, alt, inside, trees, alive, byTile, treesNear, noise, fbm, far, ground, woods, outer, road };
}
