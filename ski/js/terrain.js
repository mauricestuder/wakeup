// The mountain. One height function is shared by the physics and the meshes:
// a fall line that runs downhill along +z, wild noise outside the groomed park
// lane, park features (kickers, step-ups, gaps, rollers, rails, boxes) added on
// top, and a halfpipe off to the side.
import * as THREE from '../../game/vendor/three.module.min.js';

export const WORLD = { half: 250, top: -100, bottom: 2060, finishZ: 1965 };
export const LANE = 42; // half width of the groomed park lane

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function hash(i, j) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y);
  const fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const fbm = (x, y) => vnoise(x, y) * 0.6 + vnoise(x * 2.1 + 17, y * 2.1 + 9) * 0.3 + vnoise(x * 4.3 + 3, y * 4.3 + 41) * 0.1;

// Seeded random so the mountain is the same every time.
let seed = 7;
export const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------- fall line ----------

function slopeAt(z) {
  const run = 0.22 + 0.04 * Math.cos(z / 190) + 0.025 * Math.sin(z / 77);
  return 0.06 + (run - 0.06) * smooth(-50, 20, z) * (1 - smooth(1870, 1950, z));
}

const FALL = new Float32Array(WORLD.bottom - WORLD.top + 2);
for (let i = 1, y = 0; i < FALL.length; i++) {
  y -= slopeAt(WORLD.top + i - 0.5);
  FALL[i] = y;
}

export function fallLine(z) {
  const f = Math.min(FALL.length - 2, Math.max(0, z - WORLD.top));
  const i = Math.floor(f);
  return FALL[i] + (FALL[i + 1] - FALL[i]) * (f - i);
}

// ---------- halfpipe ----------

// A superpipe off to the skier's left of the park: flat bottom, round
// transitions that go almost vertical at the coping, a deck on each side.
export const PIPE = { x: 185, z0: 330, z1: 650, B: 6, R: 4.6, ang: 81 * Math.PI / 180, deck: 4, bank: 12 };
PIPE.lipD = PIPE.B + PIPE.R * Math.sin(PIPE.ang);
PIPE.H = PIPE.R * (1 - Math.cos(PIPE.ang));

export function inPipe(x, z, pad = 0) {
  return Math.abs(x - PIPE.x) < PIPE.lipD + PIPE.deck + pad && z > PIPE.z0 - pad && z < PIPE.z1 + pad;
}

function pipeOffset(x, z) {
  const P = PIPE, d = Math.abs(x - P.x);
  const t = smooth(P.z0, P.z0 + 22, z) * (1 - smooth(P.z1 - 10, P.z1 + 6, z)); // walls grow in and out
  let h;
  if (d < P.B) h = 0;
  else if (d < P.lipD) { const k = d - P.B; h = P.R - Math.sqrt(P.R * P.R - k * k); }
  else if (d < P.lipD + P.deck) h = P.H;
  else h = P.H * (1 - smooth(P.lipD + P.deck, P.lipD + P.deck + P.bank, d));
  return h * t;
}

export function baseHeight(x, z) {
  const ax = Math.abs(x);
  const wild = smooth(LANE, LANE + 45, ax);
  let h = fallLine(z) + ax * 0.035;
  h += wild * ((fbm(x / 95, z / 95) - 0.5) * 22 + (vnoise(x / 32 + 50, z / 32) - 0.5) * 4);
  const e = Math.max(0, ax - 195);
  h += e * e * 0.014;
  // The pipe sits on a smooth groomed plane.
  const pd = Math.abs(x - PIPE.x);
  if (pd < 46 && z > PIPE.z0 - 70 && z < PIPE.z1 + 60) {
    const m = (1 - smooth(32, 46, pd)) * smooth(PIPE.z0 - 70, PIPE.z0 - 30, z) * (1 - smooth(PIPE.z1 + 20, PIPE.z1 + 60, z));
    h += (fallLine(z) + PIPE.x * 0.035 - h) * m;
  }
  return h;
}

// ---------- features ----------

export const features = [];
export const rails = [];

// Each feature has its own axis: u runs along it (downhill unless turned by
// `ang`, which makes hip jumps), v runs across it.
function addFeature(f, u0, u1, hw) {
  f.ang = f.ang || 0;
  f.ca = Math.cos(f.ang); f.sa = Math.sin(f.ang);
  const xs = [], zs = [];
  for (const u of [u0, u1]) for (const v of [-hw, hw]) {
    xs.push(f.x + u * f.sa + v * f.ca);
    zs.push(f.z + u * f.ca - v * f.sa);
  }
  f.x0 = Math.min(...xs); f.x1 = Math.max(...xs);
  f.z0 = Math.min(...zs); f.z1 = Math.max(...zs);
  features.push(f);
  return f;
}
const fallAlong = (f, u) => fallLine(f.z + u * f.ca);

// Kicker: ramp, table (or a gap to clear), landing. opts: natural, ang, gap, mult.
function kicker(x, z, H, L, T, Lnd, W, opts = {}) {
  const natural = !!opts.natural;
  Lnd *= opts.mult || (natural ? 1 : 2.1);
  const f = { type: 'kick', x, z, H, L, T, Lnd, W, natural, ang: opts.ang, gap: opts.gap || 0 };
  f.ca = Math.cos(f.ang || 0);
  f.Hk = H + fallLine(z + L * f.ca) - fallLine(z + (L + T) * f.ca);
  return addFeature(f, 0, L + T + Lnd, W / 2 + (opts.ang ? 18 : 6));
}

// Step-up: clear a gap onto a deck that sits higher than the lip, then roll off.
function stepUp(x, z, H, L, G, D, Lnd, W, up = 0.6) {
  const f = { type: 'step', x, z, H, L, G, D, Lnd, W };
  f.Hd = H + fallLine(z + L) - fallLine(z + L + G) + up;
  return addFeature(f, 0, L + G + D + Lnd, W / 2 + 6);
}

// Rollers: a run of smooth whoops to pump or pop off.
function rollers(x, z, A, wave, n, W) {
  return addFeature({ type: 'roll', x, z, A, wave, n, W }, 0, wave * n, W / 2 + 3);
}

function cliff(x, z, D, W) {
  return addFeature({ type: 'cliff', x, z, D, W }, -40, 6, W / 2 + 14);
}

function rail(x, z, len, h, kind = 'rail', dx = 0) {
  const w = kind === 'box' ? 0.55 : 0.08;
  const a = new THREE.Vector3(x, baseHeight(x, z) + h, z);
  const b = new THREE.Vector3(x + dx, baseHeight(x + dx, z + len) + h, z + len);
  rails.push({ kind, a, b, w, h, len: a.distanceTo(b), dir: b.clone().sub(a).normalize() });
}

function featureOffset(f, x, z) {
  if (f.type === 'pipe') return pipeOffset(x, z);
  const dx = x - f.x, dzz = z - f.z;
  const u = dzz * f.ca + dx * f.sa, v = Math.abs(dx * f.ca - dzz * f.sa);
  if (f.type === 'cliff') {
    const p = f.D * smooth(-40, -24, u) * (1 - smooth(0, 4, u));
    return p * (1 - smooth(f.W / 2, f.W / 2 + 12, v));
  }
  if (u < 0) return 0; // behind a turned feature's start
  if (f.type === 'roll') {
    const p = f.A * 0.5 * (1 - Math.cos(2 * Math.PI * u / f.wave));
    return p * (1 - smooth(f.W / 2, f.W / 2 + 2.5, v));
  }
  let p, w = f.W;
  if (u < f.L) {
    const s = u / f.L;
    p = f.H * s * Math.sqrt(s); // lip angle 1.5 H / L
  } else if (f.type === 'step') {
    const a = u - f.L;
    if (a < f.G) {
      p = f.H * (1 - smooth(0, 0.8, a)) + f.Hd * smooth(f.G - 1.6, f.G, a);
    } else if (a < f.G + f.D) {
      p = f.Hd;
    } else {
      const s = (a - f.G - f.D) / f.Lnd;
      p = f.Hd * (1 - smooth(0, 1, s));
      w = f.W + 6 * s;
    }
  } else if (u < f.L + f.T) {
    const table = f.H + fallAlong(f, f.L) - fallLine(z); // table is flat in the world
    if (f.gap) {
      const a = u - f.L;
      p = table + (-f.gap - table) * smooth(0, 0.8, a) * (1 - smooth(f.T - 0.9, f.T, a)) +
        (f.Hk - table) * smooth(f.T - 0.9, f.T, a);
    } else p = table;
  } else {
    const s = (u - f.L - f.T) / f.Lnd;
    p = f.Hk * (1 - smooth(0, 1, s));
    w = f.W + (f.ang ? 24 * Math.sqrt(s) : 7 * s); // hips open up early so a straight line still lands
  }
  return p * (1 - smooth(w / 2, w / 2 + (f.natural || f.ang ? 5 : 1.8), v));
}

function featuresAt(x, z) {
  let o = 0;
  for (const f of features) {
    if (x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1) o += featureOffset(f, x, z);
  }
  return o;
}

export function height(x, z) {
  return baseHeight(x, z) + featuresAt(x, z);
}

const _n = new THREE.Vector3();
export function normal(x, z, out = _n) {
  const e = 0.25;
  const hx = height(x + e, z) - height(x - e, z);
  const hz = height(x, z + e) - height(x, z - e);
  return out.set(-hx, 2 * e, -hz).normalize();
}

// ---------- park layout ----------

// Beginner line
kicker(-12, 165, 1.1, 5, 4, 12, 6);
rail(14, 170, 11, 0.45, 'box');
kicker(12, 245, 1.3, 5, 4, 13, 6);
rail(-14, 255, 11, 0.45, 'box');
kicker(0, 330, 2, 6, 6, 18, 8);
rail(-20, 410, 12, 0.7);
rail(20, 410, 12, 0.7);
kicker(0, 455, 2.2, 6.5, 6, 19, 8);
rollers(0, 512, 0.8, 8, 4, 16);
// Jib line
rail(-10, 560, 14, 0.5, 'box');
rail(10, 565, 16, 0.75);
kicker(0, 630, 2.4, 7, 7, 20, 9);
kicker(0, 692, 1.4, 4, 0, 9, 9, { mult: 1 }); // spine
rail(-16, 720, 14, 0.75, 'rail', 3);
rail(16, 720, 14, 0.75, 'rail', -3);
rail(0, 800, 22, 0.5, 'box');
rail(-22, 870, 14, 0.8);
rail(22, 870, 14, 0.8);
kicker(0, 920, 2.6, 7, 7, 22, 9, { gap: 1.6 }); // gap jump
// Pro line
kicker(0, 1050, 3, 8, 9, 28, 10);
rail(-24, 1110, 16, 0.8);
rail(24, 1110, 16, 0.5, 'box');
stepUp(0, 1175, 3, 8, 7, 30, 26, 11);
rail(-24, 1262, 18, 0.85);
rail(24, 1262, 18, 0.85);
// Three sizes side by side: pick your line.
kicker(-20, 1310, 2.4, 7, 7, 20, 7);
kicker(0, 1310, 3.6, 10, 11, 32, 10);
kicker(21, 1310, 4.4, 11, 13, 38, 12);
kicker(-10, 1450, 4, 11, 12, 36, 12, { ang: 0.28 }); // hip
// Big air
kicker(0, 1610, 4.6, 12, 10, 44, 14);
// Backcountry: natural hits and cliff drops
kicker(-100, 300, 1.6, 6, 0, 10, 10, { natural: true });
kicker(130, 560, 2, 7, 0, 12, 12, { natural: true });
kicker(-170, 790, 2.2, 7, 0, 12, 12, { natural: true });
kicker(110, 1180, 2.5, 8, 0, 14, 12, { natural: true });
kicker(-95, 1530, 2.4, 7, 0, 14, 12, { natural: true });
kicker(160, 1450, 2, 7, 0, 12, 10, { natural: true });
cliff(-140, 470, 4.5, 26);
cliff(165, 900, 7, 30);
cliff(-120, 1290, 9, 30);
cliff(95, 1720, 5, 24);
features.push({ type: 'pipe', x: PIPE.x, z: PIPE.z0, x0: PIPE.x - 30, x1: PIPE.x + 30, z0: PIPE.z0, z1: PIPE.z1 + 6 });

export const dropIns = {
  summit: { x: 0, z: -60, label: 'Summit', speed: 0 },
  park: { x: 0, z: 120, label: 'Park', speed: 9 },
  pro: { x: 0, z: 990, label: 'Pro Line', speed: 16 },
  pipe: { x: PIPE.x, z: PIPE.z0 - 25, label: 'Halfpipe', speed: 14, finish: PIPE.z1 + 12 },
  backcountry: { x: -150, z: 30, label: 'Backcountry', speed: 6 },
};

// ---------- trees, rocks and other solid things ----------

// Each obstacle has a real shape: trees are a trunk plus a cone of branches,
// rocks are squashed domes, posts are upright cylinders, huts are boxes.
export const obstacles = [];
const GRID = 12;
const grid = new Map();
const solids = []; // big or long things checked every step
function addObstacle(o) {
  obstacles.push(o);
  const k = Math.floor(o.x / GRID) + ',' + Math.floor(o.z / GRID);
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push(o);
}

const cone = (h, base, tip, R) => R * Math.min(1, Math.max(0, (tip - h) / (tip - base)));

// Is a ball of radius r at (x, y, z) inside an obstacle? The skier's body is
// tested as a few of these balls from the knees to the head. Shapes are a
// touch smaller than they look so brushing past feels fair.
function hits(o, x, y, z, r) {
  if (o.kind === 'box') {
    return x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r && y < o.top;
  }
  const d = Math.hypot(x - o.x, z - o.z);
  if (o.kind === 'tree') {
    const s = o.s;
    if (d < 0.2 * s + r && y < o.g + 1.6 * s) return true; // trunk
    const h = (y - o.g) / s; // the three cones of branches, slightly trimmed
    if (h < 0.9 - r / s || h > 6.75) return false;
    const R = Math.max(cone(h, 0.9, 4.3, 2.1), cone(h, 2.7, 5.5, 1.6), cone(h, 4.45, 6.75, 1.0));
    return d < R * s * 0.85 + r;
  }
  if (o.kind === 'rock') {
    const a = o.s * 0.9 + r, b = o.s * 0.65 + r, dy = y - (o.g - 0.2 * o.s);
    return dy > -b && (d / a) ** 2 + (dy / b) ** 2 < 1;
  }
  return d < o.r + r && y < o.top; // post
}

export function obstacleHit(x, y, z, r = 0.3) {
  const gx = Math.floor(x / GRID), gz = Math.floor(z / GRID);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const list = grid.get((gx + i) + ',' + (gz + j));
    if (!list) continue;
    for (const o of list) if (hits(o, x, y, z, r)) return o;
  }
  for (const o of solids) if (hits(o, x, y, z, r)) return o;
  return null;
}

const LIFT_X = 62;
function nearFeature(x, z, m) {
  for (const f of features) if (x > f.x0 - m && x < f.x1 + m && z > f.z0 - m && z < f.z1 + m) return true;
  if (Math.abs(x - PIPE.x) < 40 && z > PIPE.z0 - 60 && z < PIPE.z1 + 30) return true;
  return Math.abs(x - LIFT_X) < 7 || (z < 10 && Math.abs(x) < 30);
}

const trees = [], rocks = [];
for (let i = 0; i < 9000 && trees.length < 2600; i++) {
  const x = (rand() * 2 - 1) * 238, z = WORLD.top + 20 + rand() * (WORLD.bottom - WORLD.top - 40);
  const ax = Math.abs(x);
  if (ax < LANE + 4) continue;
  const edge = ax < LANE + 16 ? 0.25 : 0; // a loose tree line along the park
  if (vnoise(x / 40 + 300, z / 40) + edge < 0.52 && ax < 205) continue;
  if (nearFeature(x, z, 6)) continue;
  const s = 0.75 + rand() * 0.7;
  trees.push({ x, z, s });
  addObstacle({ kind: 'tree', x, z, s, g: height(x, z) - 0.2 });
}
for (let i = 0; i < 260; i++) {
  const x = (rand() * 2 - 1) * 230, z = rand() * WORLD.bottom;
  if (Math.abs(x) < LANE + 12 || nearFeature(x, z, 4)) continue;
  const s = 0.5 + rand() * 1.4;
  rocks.push({ x, z, s, r: rand() * 6 });
  addObstacle({ kind: 'rock', x, z, s, g: height(x, z) });
}

// ---------- meshes ----------

// Tileable snow detail: fine grain in red, soft drifts in green, sparkle
// flecks in blue. The shader below mixes it at three scales so it never
// looks like a repeating tile.
function snowTexture() {
  const N = 256, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  const tn = (x, y, p) => { // value noise that wraps every p cells
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const h = (a, b) => hash(((a % p) + p) % p, ((b % p) + p) % p + 911);
    const A = h(i, j), B = h(i + 1, j), C = h(i, j + 1), D = h(i + 1, j + 1);
    return A + (B - A) * u + (C - A) * v + (A - B - C + D) * u * v;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const fx = x / N, fy = y / N;
    const grain = tn(fx * 64, fy * 64, 64) * 0.55 + tn(fx * 128, fy * 128, 128) * 0.45;
    const drift = tn(fx * 4, fy * 4, 4) * 0.5 + tn(fx * 8, fy * 8, 8) * 0.3 + tn(fx * 16, fy * 16, 16) * 0.2;
    const k = (y * N + x) * 4;
    img.data[k] = grain * 255;
    img.data[k + 1] = drift * 255;
    img.data[k + 2] = hash(x, y + 5000) > 0.993 ? 255 : 0;
    img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Snow material: vertex colours for shape and shade, the detail texture in
// world space, and corduroy lines on groomed snow that fade out with distance.
function snowMaterial(tex, extra = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, ...extra });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.detail = { value: tex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float groom; varying float vGroom; varying vec3 vW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroom = groom; vW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D detail; varying float vGroom; varying vec3 vW;')
      .replace('#include <map_fragment>', `
        vec4 d1 = texture2D(detail, vW.xz / 2.6);
        vec4 d2 = texture2D(detail, vW.xz / 14.0 + 0.37);
        vec4 d3 = texture2D(detail, vW.xz / 83.0 + 0.71);
        float fine = 1.0 - smoothstep(0.08, 0.5, fwidth(vW.x) + fwidth(vW.z));
        float tone = (d1.r - 0.5) * 0.22 * fine + (d2.g - 0.5) * 0.26 + (d3.g - 0.5) * 0.3;
        float off = 1.0 - vGroom;
        tone += (d1.g - 0.5) * 0.2 * off * fine + (d2.r - 0.5) * 0.1 * off; // wind-blown powder is rougher
        float cx = vW.x / 0.42;
        float cord = abs(fract(cx) - 0.5) * 2.0 - 0.5;
        cord *= 1.0 - smoothstep(0.3, 0.8, fwidth(cx));
        tone += cord * 0.16 * vGroom;
        diffuseColor.rgb *= 1.0 + tone;
        diffuseColor.rgb += vec3(0.5) * d1.b * fine * 0.6;
      `);
  };
  return m;
}

// A grid mesh sampling fn(x, z); colorFn picks each vertex colour.
function gridMesh(x0, x1, z0, z1, step, fn, colorFn, mat, stepZ = step) {
  const nx = Math.ceil((x1 - x0) / step) + 1, nz = Math.ceil((z1 - z0) / stepZ) + 1;
  const pos = new Float32Array(nx * nz * 3), nor = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), groom = new Float32Array(nx * nz);
  const c = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    const x = Math.min(x1, x0 + i * step), z = Math.min(z1, z0 + j * stepZ);
    const y = fn(x, z);
    const e = 0.3;
    const n = new THREE.Vector3(fn(x - e, z) - fn(x + e, z), 2 * e, fn(x, z - e) - fn(x, z + e)).normalize();
    pos.set([x, y, z], k * 3);
    nor.set([n.x, n.y, n.z], k * 3);
    uv.set([x / 9, z / 9], k * 2);
    groom[k] = groomedAt(x, z);
    colorFn(x, z, n, c);
    col.set([c.r, c.g, c.b], k * 3);
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let p = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
    idx.set([a, d, b, b, d, e], p);
    p += 6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('groom', new THREE.BufferAttribute(groom, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return new THREE.Mesh(g, mat);
}

// 1 on the machine-groomed park lane and in the pipe, 0 in the powder.
const groomedAt = (x, z) => Math.max(1 - smooth(LANE - 4, LANE + 6, Math.abs(x)), inPipe(x, z, PIPE.deck + 2) ? 1 : 0);

const ROCK = new THREE.Color(0.32, 0.31, 0.33), PARK_SHADE = new THREE.Color(0.62, 0.72, 0.88);
function snowColor(x, z, n, c, built = false) {
  const steep = 1 - n.y;
  const groomed = 1 - smooth(LANE - 4, LANE + 10, Math.abs(x));
  // Groomed snow is a touch warmer and brighter, powder a cooler blue, so the
  // lane reads at a glance. Both stay a little below pure white so the shading
  // and the detail show instead of burning out.
  c.setRGB(0.74 + groomed * 0.07, 0.8 + groomed * 0.05, 0.93 - groomed * 0.01);
  // Shade slopes facing uphill (toward the rider) so jumps and rollers read.
  c.multiplyScalar(1 - smooth(0.02, 0.5, -n.z) * (built ? 0.16 : 0.26) - smooth(0.05, 0.35, steep) * 0.1);
  if (steep > 0.35) c.lerp(built ? PARK_SHADE : ROCK, smooth(0.35, 0.6, steep) * (built ? 0.6 : 1));
}

export function buildTerrain(scene) {
  const tex = snowTexture();
  const mat = snowMaterial(tex);
  const W = WORLD;
  scene.add(gridMesh(-W.half, W.half, W.top, W.bottom, 4, baseHeight, snowColor, mat));

  // Features get their own fine meshes laid over the coarse mountain.
  const fmat = snowMaterial(tex, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const blue = new THREE.Color(0.2, 0.45, 0.95), orange = new THREE.Color(1, 0.42, 0.12);
  for (const f of features) {
    if (f.type === 'pipe') {
      const pipeColor = (x, z, n, c) => {
        const d = Math.abs(x - PIPE.x);
        c.setRGB(0.9, 0.93, 0.98);
        c.multiplyScalar(1 - smooth(0.3, 0.95, 1 - n.y) * 0.12);
        if (Math.abs(d - PIPE.lipD) < 0.3) c.copy(blue); // coping
        if (Math.abs(d - PIPE.lipD - PIPE.deck) < 0.25) c.copy(orange); // deck edge
      };
      scene.add(gridMesh(f.x0, f.x1, f.z0, f.z1, 0.4, height, pipeColor, fmat, 1));
      continue;
    }
    // Paint the lines a rider reads: lip, knuckle, the gap edge and the deck.
    const marks = [];
    if (f.type === 'kick' && !f.natural) marks.push(f.L, f.L + f.T);
    if (f.type === 'step') marks.push(f.L, f.L + f.G, f.L + f.G + f.D);
    const colorFn = (x, z, n, c) => {
      snowColor(x, z, n, c, f.type !== 'cliff' && !f.natural);
      if (!marks.length) return;
      const dx = x - f.x, dzz = z - f.z;
      const u = dzz * f.ca + dx * f.sa, v = Math.abs(dx * f.ca - dzz * f.sa);
      if (v > f.W / 2) return;
      for (const m of marks) if (Math.abs(u - m) < 0.35) c.copy(blue);
      if (f.gap && u > f.L + 0.6 && u < f.L + f.T - 0.6) c.copy(orange);
    };
    scene.add(gridMesh(f.x0, f.x1, f.z0, f.z1, 0.5, height, colorFn, fmat));
  }

  // Rails and boxes
  const metal = new THREE.MeshLambertMaterial({ color: 0xd8dde4 });
  const post = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const boxMat = new THREE.MeshLambertMaterial({ color: 0x1e88e5 });
  const boxTop = new THREE.MeshLambertMaterial({ color: 0xf2f4f7 });
  const up = new THREE.Vector3(0, 1, 0);
  for (const r of rails) {
    const mid = r.a.clone().add(r.b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), r.dir);
    if (r.kind === 'rail') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, r.len, 10).rotateX(Math.PI / 2), metal);
      m.position.copy(mid).y -= 0.05;
      m.quaternion.copy(q);
      scene.add(m);
      for (const t of [0.06, 0.5, 0.94]) {
        const p = r.a.clone().lerp(r.b, t);
        const g = height(p.x, p.z);
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, p.y - g + 0.3, 0.08), post);
        s.position.set(p.x, (p.y + g) / 2 - 0.15, p.z);
        scene.add(s);
      }
    } else {
      const depth = r.h + 1;
      const body = new THREE.Mesh(new THREE.BoxGeometry(r.w, depth, r.len), boxMat);
      body.position.copy(mid).addScaledVector(up, -depth / 2 - 0.03);
      body.quaternion.copy(q);
      const top = new THREE.Mesh(new THREE.BoxGeometry(r.w + 0.02, 0.04, r.len), boxTop);
      top.position.copy(mid).y -= 0.02;
      top.quaternion.copy(q);
      scene.add(body, top);
    }
  }

  buildTrees(scene);
  buildRocks(scene);
  buildLift(scene);
  buildDecor(scene);
  return { update(dt) { updateLift(dt); flagMat.uniforms.time.value += dt; } };
}

// Soft shadows under trees and rocks, thrown away from the sun, so they sit on
// the snow instead of floating on it.
let blobTex = null;
function blobShadows(scene, list, size) {
  if (!blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    r.addColorStop(0, 'rgba(30,50,100,0.6)'); r.addColorStop(0.55, 'rgba(30,50,100,0.32)'); r.addColorStop(1, 'rgba(40,60,110,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
  }
  const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
    list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
  list.forEach((o, i) => {
    const k = o.s * size;
    const x = o.x + 0.35 * k, z = o.z - 0.25 * k;
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal(x, z, n));
    m.compose(p.set(x, height(x, z) + 0.12, z), q, sc.set(k * 1.25, 1, k));
    inst.setMatrixAt(i, m);
  });
  inst.renderOrder = 1;
  scene.add(inst);
}

function buildTrees(scene) {
  const leaf = new THREE.MeshLambertMaterial({ color: 0x2c6146, flatShading: true });
  const snowy = new THREE.MeshLambertMaterial({ color: 0xe8eef5, flatShading: true });
  const trunk = new THREE.MeshLambertMaterial({ color: 0x4a3426 });
  const parts = [
    [new THREE.CylinderGeometry(0.18, 0.25, 1.6, 6).translate(0, 0.8, 0), trunk],
    [new THREE.ConeGeometry(2.1, 3.4, 7).translate(0, 2.6, 0), leaf],
    [new THREE.ConeGeometry(1.6, 2.8, 7).translate(0, 4.1, 0), leaf],
    [new THREE.ConeGeometry(1.0, 2.3, 7).translate(0, 5.6, 0), snowy],
  ];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (const [geo, mat] of parts) {
    const inst = new THREE.InstancedMesh(geo, mat, trees.length);
    trees.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.x * 13.7);
      m.compose(p.set(t.x, height(t.x, t.z) - 0.2, t.z), q, s.setScalar(t.s));
      inst.setMatrixAt(i, m);
    });
    scene.add(inst);
  }
  blobShadows(scene, trees, 4.6);
}

function buildRocks(scene) {
  const inst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshLambertMaterial({ color: 0x5d5a58, flatShading: true }), rocks.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  rocks.forEach((r, i) => {
    q.setFromEuler(e.set(r.r, r.r * 2, r.r * 0.5));
    m.compose(new THREE.Vector3(r.x, height(r.x, r.z) - 0.2 * r.s, r.z), q, new THREE.Vector3(r.s, r.s * 0.7, r.s));
    inst.setMatrixAt(i, m);
  });
  scene.add(inst);
  blobShadows(scene, rocks, 2.6);
}

// ---------- chairlift ----------

const lift = { towers: [], chairs: null, len: 0, t: 0 };
function liftPoint(s, side, out) {
  // s runs uphill on one cable (side 1) and downhill on the other (side -1).
  const T = lift.towers;
  const z = side > 0 ? W_bottomLift - s : W_topLift + s;
  const f = Math.min(T.length - 1.0001, Math.max(0, (z - W_topLift) / LIFT_SPACING));
  const i = Math.floor(f);
  const y = T[i].y + (T[i + 1].y - T[i].y) * (f - i) - Math.sin((f - i) * Math.PI) * 1.2;
  return out.set(LIFT_X + side * 1.6, y - 2.2, z);
}
const LIFT_SPACING = 110, W_topLift = -40, W_bottomLift = W_topLift + LIFT_SPACING * 18;

function buildLift(scene) {
  const steel = new THREE.MeshLambertMaterial({ color: 0x6c737c });
  const tower = new THREE.BoxGeometry(0.6, 10, 0.6).translate(0, 5, 0);
  const arm = new THREE.BoxGeometry(4.4, 0.3, 0.3);
  for (let i = 0; i <= 18; i++) {
    const z = W_topLift + i * LIFT_SPACING, g = height(LIFT_X, z);
    const t = new THREE.Mesh(tower, steel);
    t.position.set(LIFT_X, g - 0.5, z);
    const a = new THREE.Mesh(arm, steel);
    a.position.set(LIFT_X, g + 9.4, z);
    scene.add(t, a);
    lift.towers.push({ y: g + 9.4 });
    solids.push({ kind: 'post', x: LIFT_X, z, r: 0.45, top: g + 9.5 });
  }
  lift.len = W_bottomLift - W_topLift;
  const pts = [[], []];
  const v = new THREE.Vector3();
  for (let s = 0; s <= lift.len; s += 10) {
    pts[0].push(liftPoint(s, 1, v).clone().setY(v.y + 2.2));
    pts[1].push(liftPoint(s, -1, v).clone().setY(v.y + 2.2));
  }
  const lineMat = new THREE.LineBasicMaterial({ color: 0x222222 });
  for (const p of pts) scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), lineMat));

  const seat = new THREE.BoxGeometry(1.4, 0.12, 0.6);
  const back = new THREE.BoxGeometry(1.4, 0.7, 0.1).translate(0, 0.35, -0.28);
  const hang = new THREE.BoxGeometry(0.06, 2.2, 0.06).translate(0, 1.1, -0.28);
  const merged = [seat, back, hang];
  // Small manual merge to keep it one draw call.
  const pos = [], nor = [], idx = [];
  let off = 0;
  for (const g of merged) {
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    for (const k of g.index.array) idx.push(k + off);
    off += g.attributes.position.count;
  }
  const chair = new THREE.BufferGeometry();
  chair.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  chair.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  chair.setIndex(idx);
  lift.chairs = new THREE.InstancedMesh(chair, new THREE.MeshLambertMaterial({ color: 0x2b2f36 }), 80);
  lift.chairs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  lift.chairs.frustumCulled = false;
  scene.add(lift.chairs);
  updateLift(0);
}

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
const _qUp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
function updateLift(dt) {
  lift.t = (lift.t + dt * 2.4) % (lift.len / 40);
  for (let i = 0; i < 80; i++) {
    const side = i < 40 ? 1 : -1;
    const s = (i % 40) * lift.len / 40 + lift.t;
    liftPoint(s, side, _p);
    _m.compose(_p, side > 0 ? _qUp : _q.identity(), _s);
    lift.chairs.setMatrixAt(i, _m);
  }
  lift.chairs.instanceMatrix.needsUpdate = true;
}

// ---------- decor ----------

function bannerTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = fg;
  g.font = 'italic 900 58px system-ui, -apple-system, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function arch(scene, z, text, bg, fg, cx = 0, half = 9) {
  const pole = new THREE.MeshLambertMaterial({ color: 0x333840 });
  let top = -Infinity;
  for (const x of [cx - half, cx + half]) {
    const g = height(x, z);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), pole);
    p.position.set(x, g + 2.6, z);
    scene.add(p);
    solids.push({ kind: 'post', x, z, r: 0.2, top: g + 5.6 });
    top = Math.max(top, g);
  }
  const b = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 3.4),
    new THREE.MeshBasicMaterial({ map: bannerTexture(text, bg, fg), side: THREE.DoubleSide }));
  b.position.set(cx, Math.max(top, height(cx, z)) + 5, z);
  b.rotation.y = Math.PI;
  scene.add(b);
}

// A jagged ring of peaks: noise for the ridge line, snow above the rock.
function ridgeRing(scene, radius, base, peak, seedOff, rock, snow, haze) {
  const N = 220, ROWS = 6, pos = [], col = [], idx = [];
  const cRock = new THREE.Color(rock), cSnow = new THREE.Color(snow), cHaze = new THREE.Color(haze), c = new THREE.Color();
  const snowLine = base + peak * 0.62;
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2;
    const t = i / N * 24;
    const n = fbm(t + seedOff, seedOff * 0.37) * 0.7 + vnoise(t * 3.1 + seedOff, 9) * 0.3;
    const h = base + Math.pow(n, 1.6) * peak * 1.9;
    const x = Math.sin(a) * radius, z = 900 + Math.cos(a) * radius;
    // Rows from deep below the horizon up to the ridge; colour follows height.
    for (let r = 0; r <= ROWS; r++) {
      const y = r === 0 ? base - 900 : base + (h - base) * (r / ROWS);
      pos.push(x, y, z);
      c.copy(cRock).lerp(cSnow, smooth(snowLine - 60, snowLine + 30, y)).lerp(cHaze, 0.25 + 0.5 * (1 - smooth(base - 200, h, y)));
      col.push(c.r, c.g, c.b);
    }
    if (i < N) {
      for (let r = 0; r < ROWS; r++) {
        const k = i * (ROWS + 1) + r, k2 = k + ROWS + 1;
        idx.push(k, k2, k + 1, k + 1, k2, k2 + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })));
}

// Flags on the lane edges that flap in the wind.
export const flagMat = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: { time: { value: 0 } },
  vertexShader: `attribute vec3 tint; varying vec3 vc; uniform float time;
    void main(){ vc = tint; vec3 p = position; float k = p.x / 1.6;
      p.z += sin(time * 6.0 + p.x * 3.0 + instanceMatrix[3][2] * 0.2) * 0.25 * k;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0); }`,
  fragmentShader: 'varying vec3 vc; void main(){ gl_FragColor = vec4(vc, 1.0); }',
});

function buildDecor(scene) {
  arch(scene, 110, 'TERRAIN PARK', '#ff5a1f', '#ffffff');
  arch(scene, 1010, 'PRO LINE', '#111418', '#ffcf33');
  arch(scene, WORLD.finishZ, 'FINISH', '#1e88e5', '#ffffff');
  arch(scene, PIPE.z0 - 8, 'SUPERPIPE', '#ff5a1f', '#ffffff', PIPE.x, PIPE.lipD + PIPE.deck + 2);
  arch(scene, PIPE.z1 + 12, 'FINISH', '#1e88e5', '#ffffff', PIPE.x, PIPE.lipD + PIPE.deck + 2);

  // Start hut at the summit
  const hutY = height(-14, -70);
  const wood = new THREE.MeshLambertMaterial({ color: 0x7a4b2a });
  const roof = new THREE.MeshLambertMaterial({ color: 0xeef3f8 });
  const hut = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 6), wood);
  hut.position.set(-16, hutY + 1.8, -70);
  const r = new THREE.Mesh(new THREE.ConeGeometry(6.2, 2.6, 4).rotateY(Math.PI / 4), roof);
  r.scale.set(1, 1, 0.8);
  r.position.set(-16, hutY + 5, -70);
  scene.add(hut, r);
  solids.push({ kind: 'box', x: -16, z: -70, x0: -20, x1: -12, z0: -73, z1: -67, top: hutY + 6 });

  // Orange marker poles down both sides of the park lane give a sense of speed.
  const geo = new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5).translate(0, 0.8, 0);
  const n = Math.floor((WORLD.finishZ - 20) / 25) * 2;
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xff6a1a }), n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const x = (i % 2 ? 1 : -1) * (LANE + 1), z = 20 + Math.floor(i / 2) * 25;
    m.makeTranslation(x, height(x, z) - 0.1, z);
    inst.setMatrixAt(i, m);
  }
  scene.add(inst);

  // Flags every 50 m along the lane and both pipe decks.
  const spots = [];
  for (let z = 60; z < WORLD.finishZ; z += 50) spots.push([-(LANE + 3), z], [LANE + 3, z]);
  for (let z = PIPE.z0 + 20; z < PIPE.z1; z += 30) for (const sgn of [-1, 1]) spots.push([PIPE.x + sgn * (PIPE.lipD + PIPE.deck - 0.6), z]);
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 5).translate(0, 1.6, 0),
    new THREE.MeshLambertMaterial({ color: 0xe8ecf0 }), spots.length);
  const flagGeo = new THREE.PlaneGeometry(1.6, 0.9, 6, 1).translate(0.8, 2.7, 0);
  const tints = new Float32Array(spots.length * 3);
  const palette = [[1, 0.35, 0.12], [0.12, 0.53, 0.9], [1, 0.81, 0.2], [0.95, 0.97, 1]];
  spots.forEach((p, i) => tints.set(palette[i % palette.length], i * 3));
  flagGeo.setAttribute('tint', new THREE.InstancedBufferAttribute(tints, 3));
  const flags = new THREE.InstancedMesh(flagGeo, flagMat, spots.length);
  spots.forEach(([x, z], i) => {
    m.makeTranslation(x, height(x, z) - 0.1, z);
    pole.setMatrixAt(i, m);
    flags.setMatrixAt(i, m);
  });
  scene.add(pole, flags);

  // Three rings of peaks fading into the haze.
  ridgeRing(scene, 2150, -380, 520, 3, 0x7d8ea6, 0xf3f6fb, 0xb9cbe0);
  ridgeRing(scene, 1750, -460, 380, 11, 0x5d6f88, 0xeef2f8, 0xc6d5e6);
  ridgeRing(scene, 1450, -560, 300, 23, 0x4c5d74, 0xe6edf5, 0xd3dfec);
}
