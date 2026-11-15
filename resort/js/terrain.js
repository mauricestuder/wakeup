// First Chair: the mountain itself. Heights, slopes and forest. No rendering here,
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
    if (a > line || slope(cx, cz) > 0.85 || Math.hypot(cx - base.x, cz - base.z) < 7.5) continue;
    const want = dens > 0.58 ? 2 : dens > 0.5 ? 1 : (r1 < 0.035 ? 1 : 0);
    const ids = [];
    for (let n = 0; n < want; n++) {
      const x = i + 0.15 + (n ? r4 : r2) * 0.7, z = j + 0.15 + (n ? r5 : r3) * 0.7;
      ids.push(trees.length);
      trees.push({ x, z, y: height(x, z), s: 0.75 + (n ? r6 : r1) * 0.6 });
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

  return { N, W, H, top, h, base, height, slope, alt, inside, trees, alive, treesNear, noise, fbm };
}
