// The mountain. One height function is shared by the physics and the meshes:
// a fall line that runs downhill along +z, wild noise outside the groomed park
// lane, and park features (kickers, cliffs, rails, boxes) added on top.
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

export function baseHeight(x, z) {
  const ax = Math.abs(x);
  const wild = smooth(LANE, LANE + 45, ax);
  let h = fallLine(z) + ax * 0.035;
  h += wild * ((fbm(x / 95, z / 95) - 0.5) * 22 + (vnoise(x / 32 + 50, z / 32) - 0.5) * 4);
  const e = Math.max(0, ax - 195);
  return h + e * e * 0.014;
}

// ---------- features ----------

export const features = [];
export const rails = [];

function kicker(x, z, H, L, T, Lnd, W, natural = false) {
  if (!natural) Lnd *= 2.1;
  const lip = z + L, knuckle = z + L + T;
  const f = {
    type: 'kick', x, z, H, L, T, Lnd, W, natural,
    Hk: H + fallLine(lip) - fallLine(knuckle),
    x0: x - W / 2 - 6, x1: x + W / 2 + 6, z0: z, z1: knuckle + Lnd,
  };
  features.push(f);
  return f;
}

function cliff(x, z, D, W) {
  features.push({ type: 'cliff', x, z, D, W, x0: x - W / 2 - 14, x1: x + W / 2 + 14, z0: z - 40, z1: z + 6 });
}

function rail(x, z, len, h, kind = 'rail', dx = 0) {
  const w = kind === 'box' ? 0.55 : 0.08;
  const a = new THREE.Vector3(x, baseHeight(x, z) + h, z);
  const b = new THREE.Vector3(x + dx, baseHeight(x + dx, z + len) + h, z + len);
  rails.push({ kind, a, b, w, h, len: a.distanceTo(b), dir: b.clone().sub(a).normalize() });
}

function featureOffset(f, x, z) {
  const u = z - f.z, v = Math.abs(x - f.x);
  if (f.type === 'cliff') {
    const p = f.D * smooth(-40, -24, u) * (1 - smooth(0, 4, u));
    return p * (1 - smooth(f.W / 2, f.W / 2 + 12, v));
  }
  let p, w;
  if (u < f.L) {
    const s = u / f.L;
    p = f.H * s * s;
    w = f.W;
  } else if (u < f.L + f.T) {
    p = f.H + fallLine(f.z + f.L) - fallLine(z); // table is flat in the world
    w = f.W;
  } else {
    const s = (u - f.L - f.T) / f.Lnd;
    p = f.Hk * (1 - smooth(0, 1, s));
    w = f.W + 7 * s;
  }
  return p * (1 - smooth(w / 2, w / 2 + (f.natural ? 5 : 1.8), v));
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
// Jib line
rail(-10, 560, 14, 0.5, 'box');
rail(10, 565, 16, 0.75);
kicker(0, 630, 2.4, 7, 7, 20, 9);
rail(-16, 720, 14, 0.75, 'rail', 3);
rail(16, 720, 14, 0.75, 'rail', -3);
rail(0, 800, 22, 0.5, 'box');
rail(-22, 870, 14, 0.8);
rail(22, 870, 14, 0.8);
kicker(0, 920, 2.6, 7, 7, 22, 9);
// Pro line
kicker(0, 1050, 3, 8, 9, 28, 10);
rail(-24, 1110, 16, 0.8);
rail(24, 1110, 16, 0.5, 'box');
kicker(0, 1175, 3.4, 9, 10, 30, 10);
kicker(0, 1310, 3.8, 10, 12, 34, 11);
rail(-24, 1300, 18, 0.85);
rail(24, 1300, 18, 0.85);
kicker(0, 1450, 4.2, 11, 13, 38, 12);
// Big air
kicker(0, 1610, 4.6, 12, 10, 44, 14);
// Backcountry: natural hits and cliff drops
kicker(-100, 300, 1.6, 6, 0, 10, 10, true);
kicker(130, 560, 2, 7, 0, 12, 12, true);
kicker(-170, 790, 2.2, 7, 0, 12, 12, true);
kicker(110, 1180, 2.5, 8, 0, 14, 12, true);
kicker(-95, 1530, 2.4, 7, 0, 14, 12, true);
kicker(160, 1450, 2, 7, 0, 12, 10, true);
cliff(-140, 470, 4.5, 26);
cliff(165, 900, 7, 30);
cliff(-120, 1290, 9, 30);
cliff(95, 1720, 5, 24);

export const dropIns = {
  summit: { x: 0, z: -60, label: 'Summit', speed: 0 },
  park: { x: 0, z: 120, label: 'Park', speed: 9 },
  pro: { x: 0, z: 990, label: 'Pro Line', speed: 16 },
  backcountry: { x: -150, z: 30, label: 'Backcountry', speed: 6 },
};

// ---------- trees and rocks ----------

export const obstacles = []; // { x, z, r, top }
const GRID = 12;
const grid = new Map();
function addObstacle(o) {
  obstacles.push(o);
  const k = Math.floor(o.x / GRID) + ',' + Math.floor(o.z / GRID);
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push(o);
}

export function obstacleHit(x, y, z, pad = 0.3) {
  const gx = Math.floor(x / GRID), gz = Math.floor(z / GRID);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const list = grid.get((gx + i) + ',' + (gz + j));
    if (!list) continue;
    for (const o of list) {
      const d = Math.hypot(x - o.x, z - o.z);
      if (d < o.r + pad && y < o.top) return o;
    }
  }
  return null;
}

const LIFT_X = 62;
function nearFeature(x, z, m) {
  for (const f of features) if (x > f.x0 - m && x < f.x1 + m && z > f.z0 - m && z < f.z1 + m) return true;
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
  addObstacle({ x, z, r: 0.75 * s, top: height(x, z) + 7 * s });
}
for (let i = 0; i < 260; i++) {
  const x = (rand() * 2 - 1) * 230, z = rand() * WORLD.bottom;
  if (Math.abs(x) < LANE + 12 || nearFeature(x, z, 4)) continue;
  const s = 0.5 + rand() * 1.4;
  rocks.push({ x, z, s, r: rand() * 6 });
  addObstacle({ x, z, r: 0.9 * s, top: height(x, z) + 0.7 * s });
}

// ---------- meshes ----------

function snowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 232 + Math.random() * 23;
    img.data[i] = n - 4; img.data[i + 1] = n - 2; img.data[i + 2] = n;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// A grid mesh sampling fn(x, z); colorFn picks each vertex colour.
function gridMesh(x0, x1, z0, z1, step, fn, colorFn, mat) {
  const nx = Math.ceil((x1 - x0) / step) + 1, nz = Math.ceil((z1 - z0) / step) + 1;
  const pos = new Float32Array(nx * nz * 3), nor = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
  const c = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    const x = Math.min(x1, x0 + i * step), z = Math.min(z1, z0 + j * step);
    const y = fn(x, z);
    const e = 0.3;
    const n = new THREE.Vector3(fn(x - e, z) - fn(x + e, z), 2 * e, fn(x, z - e) - fn(x, z + e)).normalize();
    pos.set([x, y, z], k * 3);
    nor.set([n.x, n.y, n.z], k * 3);
    uv.set([x / 9, z / 9], k * 2);
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
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return new THREE.Mesh(g, mat);
}

function snowColor(x, z, n, c) {
  const steep = 1 - n.y;
  const groomed = 1 - smooth(LANE - 4, LANE + 10, Math.abs(x));
  c.setRGB(0.86 - groomed * 0.02, 0.9 - groomed * 0.01, 0.97);
  // Darken slopes facing uphill (toward the rider) so jumps and rollers read.
  c.multiplyScalar(1 - smooth(0.02, 0.5, -n.z) * 0.28 - smooth(0.05, 0.35, steep) * 0.1);
  if (steep > 0.35) c.lerp(new THREE.Color(0.32, 0.31, 0.33), smooth(0.35, 0.6, steep));
}

export function buildTerrain(scene) {
  const tex = snowTexture();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex });
  const W = WORLD;
  scene.add(gridMesh(-W.half, W.half, W.top, W.bottom, 4, baseHeight, snowColor, mat));

  // Features get their own fine meshes laid over the coarse mountain.
  const fmat = new THREE.MeshLambertMaterial({
    vertexColors: true, map: tex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  const blue = new THREE.Color(0.2, 0.45, 0.95);
  for (const f of features) {
    const colorFn = (x, z, n, c) => {
      snowColor(x, z, n, c);
      if (f.type !== 'kick' || f.natural) return;
      const u = z - f.z, side = Math.abs(x - f.x) < f.W / 2;
      if (side && (Math.abs(u - f.L) < 0.35 || Math.abs(u - f.L - f.T) < 0.35)) c.copy(blue); // lip and knuckle lines
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
  return { update: updateLift };
}

function buildTrees(scene) {
  const leaf = new THREE.MeshLambertMaterial({ color: 0x1f4a35, flatShading: true });
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

function arch(scene, z, text, bg, fg) {
  const pole = new THREE.MeshLambertMaterial({ color: 0x333840 });
  for (const x of [-9, 9]) {
    const g = height(x, z);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), pole);
    p.position.set(x, g + 2.6, z);
    scene.add(p);
  }
  const g = height(0, z);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(18, 3.4),
    new THREE.MeshBasicMaterial({ map: bannerTexture(text, bg, fg), side: THREE.DoubleSide }));
  b.position.set(0, g + 5, z);
  b.rotation.y = Math.PI;
  scene.add(b);
}

function buildDecor(scene) {
  arch(scene, 110, 'TERRAIN PARK', '#ff5a1f', '#ffffff');
  arch(scene, 1010, 'PRO LINE', '#111418', '#ffcf33');
  arch(scene, WORLD.finishZ, 'FINISH', '#1e88e5', '#ffffff');

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

  // Far mountains so the horizon isn't empty.
  const far = new THREE.MeshBasicMaterial({ color: 0xc9d6e6, fog: false });
  const farDark = new THREE.MeshBasicMaterial({ color: 0x9fb1c6, fog: false });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand() * 0.2;
    const d = 1500 + rand() * 300;
    const h = 260 + rand() * 380;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(320 + rand() * 200, h, 5), i % 3 ? far : farDark);
    cone.position.set(Math.sin(a) * d, -300 + h / 2 - 120, 900 + Math.cos(a) * d);
    cone.rotation.y = rand() * 3;
    scene.add(cone);
  }
}
