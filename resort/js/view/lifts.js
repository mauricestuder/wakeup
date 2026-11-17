// Idle Lift: lifts on screen. Stations, pylons, cables and the moving bars, chairs and cabins.
import { THREE, merge, at, pixMat } from './scene.js';
import { LIFTS } from '../tuning.js';
import { along } from '../network.js';

const SIDE = 0.36; // the up and down lines run this far left and right of the centre
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const tmp = { x: 0, y: 0, z: 0, i: 0 }, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);

const cyl = (r1, r2, h, n = 8) => new THREE.CylinderGeometry(r1, r2, h, n);
const turn = (x, y, z, rx, ry = 0, rz = 0) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)).setPosition(x, y, z);
const STEEL = 0x2b2f36, METAL = 0x7c838d, GLASS = 0x9fd3f0;

function carrierGeo(type) {
  const c = LIFTS[type].color;
  if (type === 'drag') return merge([
    [box(0.03, 1.0, 0.03), STEEL, at(0, -0.5, 0)], [cyl(0.07, 0.07, 0.12), METAL, at(0, -0.05, 0)],
    [box(0.55, 0.05, 0.06), c, at(0, -1.0, 0)], [box(0.06, 0.12, 0.06), STEEL, at(0, -0.95, 0)],
  ]);
  if (type === 'chair') return merge([
    [cyl(0.06, 0.06, 0.1, 6), METAL, turn(0, 0, 0, 0, 0, Math.PI / 2)],      // grip on the cable
    [box(0.04, 0.95, 0.04), STEEL, at(0, -0.47, 0)], [box(1.05, 0.04, 0.04), STEEL, at(0, -0.06, -0.05)],
    [box(0.04, 0.9, 0.04), STEEL, at(-0.5, -0.5, -0.05)], [box(0.04, 0.9, 0.04), STEEL, at(0.5, -0.5, -0.05)],
    [box(1.04, 0.08, 0.38), c, at(0, -1.0, -0.02)],                          // seat
    [box(1.04, 0.42, 0.06), c, at(0, -0.78, -0.21)],                         // back
    [box(1.0, 0.03, 0.03), STEEL, at(0, -0.72, 0.28)],                       // safety bar
    [box(0.03, 0.3, 0.03), STEEL, at(-0.48, -0.86, 0.28)], [box(0.03, 0.3, 0.03), STEEL, at(0.48, -0.86, 0.28)],
    [box(0.9, 0.03, 0.14), STEEL, at(0, -1.25, 0.3)],                        // footrest
  ]);
  return merge([
    [cyl(0.07, 0.07, 0.14, 6), METAL, turn(0, 0, 0, 0, 0, Math.PI / 2)],
    [box(0.05, 0.42, 0.05), STEEL, at(0, -0.21, 0)], [box(0.5, 0.05, 0.05), STEEL, at(0, -0.42, 0)],
    [box(0.84, 0.6, 1.02), c, at(0, -1.14, 0)],                              // lower body
    [box(0.86, 0.36, 1.04), GLASS, at(0, -0.68, 0)],                         // windows all round
    [box(0.88, 0.03, 1.06), 0xffffff, at(0, -0.86, 0)],
    [box(0.04, 0.4, 1.06), c, at(0, -0.68, 0)],                              // middle post
    [box(0.9, 0.08, 1.08), 0xf2f4f7, at(0, -0.46, 0)], [box(0.7, 0.06, 0.86), 0xdfe3e8, at(0, -0.4, 0)], // roof
    [box(0.02, 0.62, 0.4), 0x222831, at(0.43, -1.0, 0)],                     // door
  ]);
}

function stationGeo(type, top) {
  const c = LIFTS[type].color, big = type === 'gondola' ? 1.35 : type === 'chair' ? 1.1 : 0.8;
  const w = 1.4 * big, d = 1.9 * big, h = 1.5 * big;
  const parts = [
    [box(1.6 * big, 1.6, 2.1 * big), 0x6a6f78, at(0, -0.75, 0)],               // foundation into the slope
    [box(1.5 * big, 0.12, 2.2 * big), 0x8d8f94, at(0, 0.06, 0)],               // concrete platform
  ];
  // Four steel legs, cross-braced.
  for (const sx of [-0.6, 0.6]) for (const sz of [-0.75, 0.75]) parts.push([box(0.14, h, 0.14), 0x3a3f47, at(sx * big, h / 2, sz * big)]);
  for (const sz of [-0.75, 0.75]) parts.push([box(0.06, 0.06, 1.7 * big), 0x3a3f47, turn(0, h * 0.5, sz * big, 0.7, Math.PI / 2)]);
  // The housing over the bull wheel, with its colour band and a snowy roof.
  parts.push([box(w, 0.42, d), 0xe9edf2, at(0, h + 0.05, 0)], [box(w + 0.04, 0.12, d + 0.04), c, at(0, h - 0.12, 0)]);
  parts.push([box(w + 0.1, 0.1, d + 0.1), 0xf4f7fb, at(0, h + 0.31, 0)], [box(w * 0.6, 0.2, d * 0.7), 0xf4f7fb, at(0, h + 0.44, 0)]);
  parts.push([cyl(0.48 * big, 0.48 * big, 0.08, 16), 0x23272e, at(0, 1.12, 0)], [cyl(0.1, 0.1, 0.4, 8), METAL, at(0, 1.3, 0)]);
  // Loading ramp and railings on the passenger side.
  const ramp = top ? -1 : 1;
  parts.push([box(1.0 * big, 0.08, 1.4), 0xb9a07a, turn(0, 0.12, ramp * (1.1 * big + 0.6), -0.12 * ramp)]);
  for (const sx of [-0.55, 0.55]) {
    parts.push([box(0.05, 0.05, 1.4), 0xffd400, at(sx * big, 0.65, ramp * (1.1 * big + 0.6))]);
    parts.push([box(0.05, 0.6, 0.05), 0x3a3f47, at(sx * big, 0.35, ramp * (1.1 * big + 1.2))]);
  }
  // Operator's cabin with a window and a flat roof, at the side.
  const cx = 1.1 * big;
  parts.push([box(0.8, 1.0, 0.9), top ? 0xd9dee5 : 0xe8e2d4, at(cx, 0.55, 0)], [box(0.82, 0.38, 0.6), 0x26384d, at(cx, 0.7, 0)]);
  parts.push([box(0.95, 0.08, 1.05), c, at(cx, 1.08, 0)], [box(0.97, 0.06, 1.07), 0xf4f7fb, at(cx, 1.14, 0)]);
  // A sign board on a post.
  parts.push([box(0.06, 1.5, 0.06), 0x3a3f47, at(-1.0 * big, 0.75, ramp * 1.2 * big)], [box(0.8, 0.42, 0.05), c, at(-1.0 * big, 1.45, ramp * 1.2 * big)], [box(0.6, 0.08, 0.06), 0xffffff, at(-1.0 * big, 1.45, ramp * 1.2 * big)]);
  return merge(parts);
}

// A lattice pylon of the given height with a cross-arm and sheave wheels.
function pylonParts(p, hgt, dir, type) {
  const parts = [], base = p.g - 0.6, top = base + hgt, w = type === 'drag' ? 0.12 : 0.2;
  const legs = [[-w, -w], [w, -w], [-w, w], [w, w]];
  for (const [lx, lz] of legs) parts.push([box(0.06, hgt, 0.06), METAL, at(p.x + lx, base + hgt / 2, p.z + lz)]);
  // Cross braces every metre and a little.
  for (let y = base + 0.6; y < top - 0.3; y += 1.1) {
    parts.push([box(w * 2, 0.04, 0.04), METAL, at(p.x, y, p.z - w, 0)], [box(w * 2, 0.04, 0.04), METAL, at(p.x, y, p.z + w, 0)]);
    parts.push([box(0.04, 0.04, w * 2), METAL, at(p.x - w, y, p.z)], [box(0.04, 0.04, w * 2), METAL, at(p.x + w, y, p.z)]);
  }
  parts.push([box(0.04, hgt * 0.9, 0.12), 0x3a3f47, at(p.x - w - 0.05, base + hgt * 0.45, p.z)]); // ladder
  parts.push([box(SIDE * 2 + 0.4, 0.1, 0.14), STEEL, at(p.x, top + 0.04, p.z, dir)]);
  for (const s of [1, -1]) {
    const sx = p.x + Math.cos(dir) * SIDE * s, sz = p.z - Math.sin(dir) * SIDE * s;
    parts.push([cyl(0.09, 0.09, 0.05, 8), 0x23272e, turn(sx, top + 0.1, sz, 0, dir, Math.PI / 2)]);
  }
  return parts;
}

export function createLiftView(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const views = new Map();
  const mat = pixMat({ vertexColors: true }, 14);
  const cableMat = new THREE.LineBasicMaterial({ color: 0x1d2229 });
  const geos = {};
  const geo = (k, f) => geos[k] || (geos[k] = f());

  function make(ter, l) {
    const L = LIFTS[l.type], g = new THREE.Group();
    const dx = Math.sin(l.dir), dz = Math.cos(l.dir), px = dz, pz = -dx; // p = to the right of the travel direction
    const n = l.pts.length - 1;
    for (const [i, top] of [[0, false], [n, true]]) {
      const m = new THREE.Mesh(geo(l.type + (top ? 'T' : 'B'), () => stationGeo(l.type, top)), mat);
      m.position.set(l.pts[i].x, l.pts[i].g, l.pts[i].z);
      m.rotation.y = l.dir;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
    // Pylons: one every other point, each exactly as tall as the cable is high there.
    const pyl = [];
    const stepN = l.type === 'gondola' ? 3 : 2;
    for (let i = stepN; i < n - 1; i += stepN) {
      const p = l.pts[i], hgt = p.y - p.g + 0.6;
      pyl.push(...pylonParts(p, hgt, l.dir, l.type));
    }
    if (pyl.length) { const m = new THREE.Mesh(merge(pyl), mat); m.castShadow = true; g.add(m); }
    for (const s of [1, -1]) {
      const v = l.pts.map((p) => new THREE.Vector3(p.x + px * SIDE * s, p.y, p.z + pz * SIDE * s));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(v), cableMat));
    }
    const spacing = L.speed * L.interval, count = (Math.ceil(l.len / spacing) + 1) * 2;
    const car = new THREE.InstancedMesh(geo('car' + l.type, () => carrierGeo(l.type)), mat, count);
    car.castShadow = true; car.frustumCulled = false;
    g.add(car);
    g.userData = { car, spacing, px, pz, cap: count, type: l.type };
    return g;
  }

  function update(state) {
    for (const l of state.lifts) {
      const v = views.get(l.id);
      if (!v) continue;
      const { car, spacing, px, pz, cap } = v.userData;
      const off = (l.travel || 0) % spacing;
      let n = 0;
      for (const side of [1, -1]) {
        for (let d = off; d < l.len && n < cap; d += spacing) {
          along(l.pts, l.cum, side > 0 ? d : l.len - d, tmp, false);
          Q.setFromAxisAngle(UP, side > 0 ? l.dir : l.dir + Math.PI);
          M.compose(V.set(tmp.x + px * SIDE * side, tmp.y, tmp.z + pz * SIDE * side), Q, S);
          car.setMatrixAt(n++, M);
        }
      }
      car.count = n;
      car.instanceMatrix.needsUpdate = true;
      v.visible = true;
    }
  }

  return {
    SIDE, update,
    sync(state, ter) {
      // Gone, or rebuilt as another kind of lift.
      for (const [id, v] of views) if (!state.liftById[id] || state.liftById[id].type !== v.userData.type) { group.remove(v); views.delete(id); }
      for (const l of state.lifts) if (!views.has(l.id)) { const v = make(ter, l); views.set(l.id, v); group.add(v); }
    },
    clear() { for (const v of views.values()) group.remove(v); views.clear(); },
  };
}
