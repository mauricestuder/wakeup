// Idle Lift: things that make the valley lively and colourful. A village of painted chalets and
// a church along the road, flags at the base, hot-air balloons drifting over the slopes,
// paragliders spiralling down from the top, and skaters on the frozen lakes. Looks only.
import { THREE, merge, at, GLOW } from './scene.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// Cozy village colours: warm timber, cream and soft painted pastels, with lit windows.
const SNOWY = 0xfffaf4, STONE = 0x8a8088, GLASS = GLOW, WOOD = 0x7a5238;
const WALLS = [0xa86f45, 0x8f5a36, 0xb87c4e, 0xfff0d8, 0xf3d9b8, 0xe98a7c, 0x9cc7b4, 0xa9c3e6, 0xf2c38a, 0xd9a3c4];
const SHUTTERS = [0x4f7a5e, 0x9a4a3f, 0x4f628a, 0x6b4a2f, 0xfff4e6];
const ROOFS = [0xa4473a, 0x5a6f96, 0x5a8566, 0x7a4f3a, 0x8f5068, 0x5a5560];
// Chimney tops of the chalets, where the smoke comes out.
const CHIMNEYS = [];
const BRIGHT = [0xff4d4d, 0xffc61a, 0x2f8cff, 0x34c46a, 0xff7ad1, 0xff8a1a, 0x9a5cff, 0x18c8c8];

// A rnd() that is the same for the same mountain every time.
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// A pitched roof with its ridge along x.
function gable(w, d, h) {
  const x = w / 2, z = d / 2, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    -x, 0, z, x, 0, z, x, h, 0, -x, 0, z, x, h, 0, -x, h, 0,
    x, 0, -z, -x, 0, -z, -x, h, 0, x, 0, -z, -x, h, 0, x, h, 0,
    -x, 0, -z, -x, 0, z, -x, h, 0, x, 0, z, x, 0, -z, x, h, 0], 3));
  return g;
}

// A chalet facing +z: painted walls on a stone base, shutters, a balcony and a snowy roof.
function chalet(r, m) {
  const w = 2.2 + r() * 1.6, d = 1.8 + r() * 0.8, rh = 0.75 + r() * 0.3, floors = r() < 0.45 ? 2 : 1, h = 0.95 * floors + 0.3;
  const wall = WALLS[(r() * WALLS.length) | 0], shut = SHUTTERS[(r() * SHUTTERS.length) | 0];
  const p = [
    [box(w + 0.15, 1.2, d + 0.15), STONE, at(0, -0.5, 0)],
    [box(w, h, d), wall, at(0, h / 2, 0)],
    // A coloured tin roof with snow on it: the colour shows along the edges.
    [gable(w + 0.6, d + 0.62, rh), ROOFS[(r() * ROOFS.length) | 0], at(0, h, 0)],
    [gable(w + 0.2, d + 0.2, rh), SNOWY, at(0, h + 0.08, 0)],
    [box(0.45, 0.65, 0.05), 0x3b2616, at(-w * 0.28, 0.33, d / 2 + 0.01)],
    [box(0.28, 0.5, 0.28), STONE, at(w * 0.3, h + 0.55, -d * 0.15)], [box(0.34, 0.06, 0.34), SNOWY, at(w * 0.3, h + 0.82, -d * 0.15)],
  ];
  CHIMNEYS.push(new THREE.Vector3(w * 0.3, h + 0.9, -d * 0.15).applyMatrix4(m));
  for (let f = 0; f < floors; f++) {
    const y = 0.55 + f * 0.95;
    for (const x of f ? [-w * 0.25, w * 0.25] : [w * 0.18, w * 0.38]) {
      p.push([box(0.36, 0.34, 0.05), GLASS, at(x, y, d / 2 + 0.01)]);
      p.push([box(0.12, 0.38, 0.06), shut, at(x - 0.26, y, d / 2 + 0.02)], [box(0.12, 0.38, 0.06), shut, at(x + 0.26, y, d / 2 + 0.02)]);
      p.push([box(0.4, 0.08, 0.12), BRIGHT[(r() * BRIGHT.length) | 0], at(x, y - 0.22, d / 2 + 0.06)]); // flower box
    }
  }
  if (floors === 2) p.push([box(w * 0.9, 0.08, 0.4), WOOD, at(0, 1.05, d / 2 + 0.2)], [box(w * 0.9, 0.3, 0.05), WOOD, at(0, 1.22, d / 2 + 0.4)]);
  return p.map(([g, c, mm]) => [g, c, m.clone().multiply(mm)]);
}

function church(m) {
  const p = [
    [box(3.2, 1.2, 5.2), STONE, at(0, -0.5, 0)],
    [box(3, 2.2, 5), 0xfaf6ee, at(0, 1.1, 0)], [gable(5.4, 3.4, 1.4), 0xb3412f, at(0, 2.2, 0, Math.PI / 2)],
    [box(1.4, 5.2, 1.4), 0xfaf6ee, at(0, 2.6, 3.0)], [new THREE.ConeGeometry(1.05, 2.4, 4), 0x2f8a5a, at(0, 6.4, 3.0, Math.PI / 4)],
    [new THREE.SphereGeometry(0.16, 8, 6), 0xffcf4d, at(0, 7.7, 3.0)],
    [new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16), 0xffffff, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 4.4, 3.71)],
    [box(0.04, 0.3, 0.02), 0x222222, at(0, 4.5, 3.75)], [box(0.22, 0.04, 0.02), 0x222222, at(0.08, 4.4, 3.75)],
    [box(0.7, 1.1, 0.06), 0x5c3a22, at(0, 0.55, 3.71)],
  ];
  for (const z of [-1.6, -0.3, 1]) for (const s of [-1, 1]) p.push([box(0.06, 0.8, 0.45), 0x3a6bb0, at(s * 1.51, 1.3, z)]);
  return p.map(([g, c, mm]) => [g, c, m.clone().multiply(mm)]);
}

// A striped hot-air balloon: each slice of the envelope in its own colour.
function balloonGeo(colors) {
  const g = new THREE.SphereGeometry(2.2, 16, 12).toNonIndexed();
  g.scale(1, 1.15, 1);
  const pos = g.attributes.position, col = [], c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const k = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 16) % colors.length;
    c.set(colors[k]);
    for (let v = 0; v < 3; v++) col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const rest = merge([
    [new THREE.CylinderGeometry(0.75, 0.4, 0.9, 10, 1, true), colors[0], at(0, -2.6, 0)],
    [box(0.7, 0.5, 0.7), 0x8a5a2b, at(0, -4.2, 0)],
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [box(0.03, 1.3, 0.03), 0x3a2a1a, at(sx * 0.32, -3.4, sz * 0.32)]),
    [box(0.18, 0.25, 0.18), 0xff9a2a, at(0, -3.05, 0)],
  ]);
  const out = merge([[g, 0xffffff, null]]);
  // merge() paints one colour per part, so put the striped colours back on the envelope.
  out.attributes.color.array.set(col);
  return mergeGeos(out, rest);
}
function mergeGeos(a, b) {
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'color']) {
    const x = a.attributes[k].array, y = b.attributes[k].array, z = new Float32Array(x.length + y.length);
    z.set(x); z.set(y, x.length);
    g.setAttribute(k, new THREE.BufferAttribute(z, 3));
  }
  return g;
}

// A paraglider: a curved wing of coloured cells, lines, and the pilot hanging below.
function gliderGeo(colors) {
  const p = [];
  for (let i = 0; i < 9; i++) {
    const a = (i - 4) * 0.17;
    p.push([box(0.55, 0.12, 1.1), colors[i % colors.length], new THREE.Matrix4().makeRotationZ(-a).setPosition(Math.sin(a) * 3, Math.cos(a) * 3 - 3, 0)]);
  }
  p.push([box(0.04, 2.6, 0.04), 0xdddddd, at(-0.6, -1.4, 0)], [box(0.04, 2.6, 0.04), 0xdddddd, at(0.6, -1.4, 0)]);
  p.push([box(0.35, 0.5, 0.3), 0x2a2f37, at(0, -2.8, 0)], [box(0.25, 0.22, 0.25), 0xf2c230, at(0, -2.42, 0)]);
  return merge(p);
}

function skaterGeo() {
  return merge([
    [box(0.2, 0.3, 0.14), 0xffffff, at(0, 0.45, 0)], [box(0.18, 0.28, 0.12), 0x2a2f37, at(0, 0.16, 0)],
    [box(0.13, 0.13, 0.13), 0xf0c8a0, at(0, 0.66, 0)], [box(0.15, 0.08, 0.15), 0xffffff, at(0, 0.75, 0)],
    [box(0.5, 0.05, 0.06), 0xffffff, at(0, 0.5, 0)],
  ]);
}

export function createDecoView(scene) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const group = new THREE.Group();
  scene.add(group);
  let key = null, t = 0;
  const balloons = [], gliders = [], skaters = [];
  let skateMesh = null, smoke = null;
  const PUFFS = 6;
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(1, 1, 1), tmpE = new THREE.Euler(0, 0, 0, 'YXZ');

  function sync(state, ter) {
    if (key === ter) return;
    clear(); key = ter;
    CHIMNEYS.length = 0;
    const R = ter.road, L = R.lot, N = ter.N, b = ter.base, r = rng(Math.round(ter.top * 1000) + N);
    const parts = [];
    // Clear the forest where a building stands (the trees are drawn after this).
    const clearing = (x, z, rad) => { for (const id of ter.treesNear(x, z, rad)) ter.alive[id] = 0; };
    const place = (x, z, yaw, fn) => { clearing(x, z, 2.6); parts.push(...fn(r, at(x, ter.ground(x, z), z, yaw))); };
    // Chalets along the road on both sides of the car park, facing the road.
    for (const side of [-1, 1]) {
      for (let k = 0, x = side < 0 ? L.x0 - 4 : L.x1 + 4; k < 7; k++, x += side * (4.4 + r() * 1.6)) {
        place(x, R.z + 4.2 + r() * 0.8, Math.PI, chalet);
        if (r() < 0.7) place(x + side * 1.5, R.z + 9.5 + r() * 2.5, Math.PI + (r() - 0.5) * 0.4, chalet);
      }
    }
    // A few on the mountain side of the road, beyond the bays and the coach stop.
    for (const x of [b.x - 15, b.x - 20, b.x - 25.5, b.x - 31, R.stop + 10, R.stop + 15, R.stop + 20.5]) place(x, R.z - 4.4 - r() * 1.2, 0, chalet);
    // The church stands on the mountain side, behind the houses, so it never hides the car park.
    const cx = b.x - 38, cz = N - 6;
    clearing(cx, cz, 5);
    parts.push(...church(at(cx, ter.ground(cx, cz), cz, 0)));
    // Flag poles along the front of the village square.
    for (let k = 0; k < 7; k++) {
      const x = b.x - 4.2 + k * 1.4, z = b.z + 3.9, y = ter.ground(x, z);
      parts.push([box(0.07, 3, 0.07), 0xd9dde2, at(x, y + 1.5, z)], [box(0.9, 0.55, 0.03), BRIGHT[k % BRIGHT.length], at(x + 0.47, y + 2.65, z)]);
      if (k === 3) parts.push([box(0.9, 0.55, 0.035), 0xff2a2a, at(x + 0.47, y + 2.65, z)], [box(0.12, 0.38, 0.04), 0xffffff, at(x + 0.47, y + 2.65, z)], [box(0.38, 0.12, 0.04), 0xffffff, at(x + 0.47, y + 2.65, z)]);
    }
    // Strings of little flags across the road at the ways in and out of the car park.
    for (const x of [L.inX - 3.5, L.outX + 3.5]) {
      for (const z of [R.z - 1.7, R.z + 1.7]) parts.push([box(0.08, 3.2, 0.08), 0x8a5a2b, at(x, R.y + 1.6, z)]);
      for (let k = 0; k < 9; k++) {
        const z = R.z - 1.5 + k * 0.38, y = R.y + 3.0 - Math.sin((k / 8) * Math.PI) * 0.35;
        parts.push([new THREE.ConeGeometry(0.14, 0.32, 3), BRIGHT[k % BRIGHT.length], new THREE.Matrix4().makeRotationX(Math.PI).setPosition(x, y, z)]);
      }
    }
    const m = new THREE.Mesh(merge(parts), mat);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);

    // Soft smoke curling up from every chimney.
    smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22, 1), new THREE.MeshLambertMaterial({ color: 0xf6eee8, transparent: true, opacity: 0.55, depthWrite: false }), CHIMNEYS.length * PUFFS);
    smoke.frustumCulled = false; smoke.chim = CHIMNEYS.map((p) => ({ p: p.clone(), ph: r() }));
    group.add(smoke);

    // Balloons drift in big slow loops over the lower and middle slopes.
    const sets = [[0xff4d4d, 0xffc61a], [0x2f8cff, 0xffffff, 0x34c46a], [0xff7ad1, 0x9a5cff, 0xffc61a], [0xff8a1a, 0x18c8c8]];
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(balloonGeo(sets[i]), mat);
      mesh.castShadow = true;
      group.add(mesh);
      balloons.push({ mesh, cx: N * (0.2 + 0.2 * i), cz: N * (0.55 + 0.12 * (i % 2)), rx: 16 + 6 * r(), rz: 9 + 5 * r(), sp: (0.012 + 0.008 * r()) * (i % 2 ? 1 : -1), ph: r() * 6.28, lift: 18 + 8 * r(), y: 0 });
    }
    // Paragliders start near the top and spiral down to the valley, then start again.
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(gliderGeo([BRIGHT[i], BRIGHT[(i + 3) % 8], BRIGHT[(i + 5) % 8]]), mat);
      group.add(mesh);
      gliders.push({ mesh, life: 70 + 20 * r(), age: r() * 70, x0: N * (0.3 + 0.2 * i), z0: N * 0.18, ph: r() * 6.28, y: 0 });
    }
    // Skaters going round on each frozen lake.
    skateMesh = new THREE.InstancedMesh(skaterGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }), ter.lakes.length * 5);
    skateMesh.castShadow = true; skateMesh.frustumCulled = false;
    const c = new THREE.Color();
    let n = 0;
    for (const l of ter.lakes) for (let k = 0; k < 5; k++) { skaters.push({ l, ph: r() * 6.28, rad: l.r * (0.35 + 0.45 * r()), sp: (0.5 + 0.4 * r()) * (k % 2 ? 1 : -1) }); skateMesh.setColorAt(n++, c.set(BRIGHT[(k * 3 + n) % 8])); }
    group.add(skateMesh);
    update(0);
  }

  function update(dt) {
    if (!key) return;
    t += dt;
    const ter = key, N = ter.N;
    for (const b of balloons) {
      const a = b.ph + t * b.sp, x = b.cx + Math.cos(a) * b.rx, z = b.cz + Math.sin(a) * b.rz;
      const want = ter.ground(Math.max(0, Math.min(N, x)), Math.max(0, Math.min(N, z))) + b.lift + Math.sin(t * 0.3 + b.ph) * 1.5;
      b.y = b.y ? b.y + (want - b.y) * Math.min(1, dt * 0.25) : want;
      b.mesh.position.set(x, b.y, z);
      b.mesh.rotation.y = t * 0.05 + b.ph;
    }
    for (const g of gliders) {
      g.age += dt;
      if (g.age > g.life) { g.age = 0; g.ph = Math.random() * 6.28; }
      const u = g.age / g.life, a = g.ph + g.age * 0.32;
      const x = g.x0 + Math.cos(a) * 9 * (0.6 + u) + Math.sin(u * 3) * 6, z = g.z0 + u * (N * 0.78) + Math.sin(a) * 6;
      const cx = Math.max(0, Math.min(N, x)), cz = Math.max(0, Math.min(N, z)), floor = ter.ground(cx, cz);
      const want = Math.max(floor + 6, ter.top * (1 - u) + 10 * (1 - u) + floor * u + 6);
      g.y = g.age < dt * 2 ? want : g.y + (want - g.y) * Math.min(1, dt * 0.8);
      g.mesh.position.set(x, g.y, z);
      // Facing along the turn, banked into it.
      tmpE.set(0, a + Math.PI, Math.sin(a * 2) * 0.1 - 0.25, 'YXZ');
      g.mesh.rotation.copy(tmpE);
      g.mesh.visible = u < 0.98;
    }
    if (smoke) {
      let i = 0;
      for (const c of smoke.chim) for (let k = 0; k < PUFFS; k++) {
        const u = (t * 0.16 + c.ph + k / PUFFS) % 1, sz = (0.45 + u * 1.5) * (1 - Math.max(0, u - 0.7) / 0.3);
        tmpM.compose(tmpV.set(c.p.x + Math.sin(u * 4 + c.ph * 6) * 0.3 + u * 1.1, c.p.y + u * 3.4, c.p.z + u * 0.5), tmpQ.identity(), tmpS.set(sz, sz, sz));
        smoke.setMatrixAt(i++, tmpM);
      }
      smoke.instanceMatrix.needsUpdate = true;
    }
    if (skateMesh) {
      skaters.forEach((s, i) => {
        const a = s.ph + t * s.sp * (2.2 / s.rad), x = s.l.x + Math.cos(a) * s.rad, z = s.l.z + Math.sin(a) * s.rad;
        tmpQ.setFromEuler(tmpE.set(0, a + (s.sp > 0 ? Math.PI : 0), Math.sin(t * 3 + i) * 0.15, 'YXZ'));
        tmpM.compose(tmpV.set(x, s.l.y + 0.05, z), tmpQ, tmpS.set(1.7, 1.7, 1.7));
        skateMesh.setMatrixAt(i, tmpM);
      });
      skateMesh.instanceMatrix.needsUpdate = true;
    }
  }

  function clear() {
    for (const o of [...group.children]) { group.remove(o); o.geometry?.dispose(); }
    balloons.length = 0; gliders.length = 0; skaters.length = 0; skateMesh = null; smoke = null; key = null;
  }

  return { sync, update, clear };
}
