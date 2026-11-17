// Idle Lift: lifts on screen. Stations, pylons, cables and the moving bars, chairs and cabins.
import { THREE, merge, at } from './scene.js';
import { LIFTS } from '../tuning.js';
import { along } from '../network.js';

const SIDE = 0.36; // the up and down lines run this far left and right of the centre
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const tmp = { x: 0, y: 0, z: 0, i: 0 }, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);

function carrierGeo(type) {
  const c = LIFTS[type].color;
  if (type === 'drag') return merge([[box(0.03, 1.0, 0.03), 0x2b2f36, at(0, -0.5, 0)], [box(0.5, 0.04, 0.04), 0x2b2f36, at(0, -1.0, 0)]]);
  if (type === 'chair') return merge([
    [box(0.04, 0.95, 0.04), 0x2b2f36, at(0, -0.47, 0)], [box(1.0, 0.07, 0.34), c, at(0, -1.0, -0.02)],
    [box(1.0, 0.4, 0.06), 0x2b2f36, at(0, -0.8, -0.2)], [box(1.0, 0.03, 0.03), 0x2b2f36, at(0, -0.78, 0.2)],
  ]);
  return merge([
    [box(0.05, 0.6, 0.05), 0x2b2f36, at(0, -0.3, 0)], [box(0.82, 0.86, 1.0), c, at(0, -1.0, 0)],
    [box(0.86, 0.36, 0.86), 0x1c2a3a, at(0, -0.84, 0)], [box(0.9, 0.06, 1.06), 0xf2f4f7, at(0, -0.56, 0)],
  ]);
}

function stationGeo(type, top) {
  const c = LIFTS[type].color, big = type === 'gondola' ? 1.35 : type === 'chair' ? 1.1 : 0.8;
  return merge([
    [box(1.5 * big, 1.6, 1.5 * big), 0x6a6f78, at(0, -0.75, 0)],                 // foundation into the slope
    [box(1.4 * big, 0.14, 1.9 * big), c, at(0, 1.5 * big, 0)],                     // roof
    [box(1.44 * big, 0.08, 1.94 * big), 0xf4f7fb, at(0, 1.5 * big + 0.1, 0)],      // snow on the roof
    [box(0.16, 1.5 * big, 0.16), 0x3a3f47, at(-0.6 * big, 0.75 * big, -0.75 * big)],
    [box(0.16, 1.5 * big, 0.16), 0x3a3f47, at(0.6 * big, 0.75 * big, -0.75 * big)],
    [box(0.16, 1.5 * big, 0.16), 0x3a3f47, at(-0.6 * big, 0.75 * big, 0.75 * big)],
    [box(0.16, 1.5 * big, 0.16), 0x3a3f47, at(0.6 * big, 0.75 * big, 0.75 * big)],
    [box(0.9 * big, 0.9 * big, 0.5), top ? 0xd9dee5 : 0xe8e2d4, at(0, 0.45 * big, top ? 0.55 * big : -0.55 * big)], // operator's cabin
    [new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12), 0x23272e, at(0, 1.12, 0)], // bull wheel
  ]);
}

export function createLiftView(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const views = new Map();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
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
      pyl.push([new THREE.CylinderGeometry(0.07, 0.11, hgt, 6), 0x7c838d, at(p.x, p.g - 0.6 + hgt / 2, p.z)]);
      pyl.push([box(SIDE * 2 + 0.3, 0.09, 0.12), 0x7c838d, at(p.x, p.y + 0.04, p.z, l.dir)]);
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
