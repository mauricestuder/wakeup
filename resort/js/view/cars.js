// Idle Lift: the valley road, the parking bays, and the cars and coaches that bring the guests.
import { THREE, merge, at } from './scene.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const PAINT = [0xd9372f, 0x2f7fe6, 0xf2f2ee, 0x3a3f47, 0xf2c230, 0x34b05a, 0x9aa1ab, 0xf2793a].map((c) => new THREE.Color(c));
const TAR = 0x4b4f56, LINE = 0xe9edf2, GLASS = 0x1c2733, TYRE = 0x15171a;
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);

// White parts take the colour of the car, dark parts stay dark.
function carGeo() {
  const wheel = (x, z) => [box(0.14, 0.26, 0.3), TYRE, at(x, 0.13, z)];
  return merge([
    [box(0.72, 0.3, 1.5), 0xffffff, at(0, 0.33, 0)], [box(0.64, 0.26, 0.8), GLASS, at(0, 0.6, -0.08)], [box(0.66, 0.05, 0.84), 0xffffff, at(0, 0.75, -0.08)],
    [box(0.3, 0.12, 0.9), 0x23272e, at(0.08, 0.84, -0.08)], // ski box on the roof
    wheel(-0.33, 0.48), wheel(0.33, 0.48), wheel(-0.33, -0.48), wheel(0.33, -0.48),
  ]);
}
function busGeo() {
  const wheel = (x, z) => [box(0.16, 0.36, 0.5), TYRE, at(x, 0.18, z)];
  return merge([
    [box(1.0, 0.5, 4.0), 0xf2f4f7, at(0, 0.5, 0)], [box(1.0, 0.16, 4.0), 0xe5484d, at(0, 0.36, 0)], [box(0.96, 0.42, 3.8), GLASS, at(0, 0.94, 0)], [box(1.0, 0.1, 4.0), 0xf2f4f7, at(0, 1.2, 0)],
    wheel(-0.46, 1.3), wheel(0.46, 1.3), wheel(-0.46, -1.3), wheel(0.46, -1.3),
  ]);
}

export function createCarView(scene, cap = 64) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const cars = new THREE.InstancedMesh(carGeo(), mat, cap), buses = new THREE.InstancedMesh(busGeo(), mat, 8);
  for (const m of [cars, buses]) { m.castShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); }
  cars.setColorAt(0, PAINT[0]);
  const slot = new Int8Array(cap).fill(-1); slot[0] = 0;
  let road = null, key = -1;

  // The road, the bays and the coach stop: built once per mountain.
  function sync(state, ter) {
    if (road && key === ter) return;
    clear(); key = ter;
    const R = ter.road, y = R.y, w = R.bays.length * 1.05 + 0.5, cx = (R.bays[0] + R.bays[R.bays.length - 1]) / 2;
    const parts = [
      [box(1100, 0.6, 2.6), TAR, at(ter.N / 2, y - 0.3, R.z)],
      [box(w, 0.6, 2.4), TAR, at(cx, y - 0.3, R.bayZ - 0.1)],
      [box(15, 0.6, 1.9), TAR, at(R.stop, y - 0.3, R.z - 1.9)],
      // Bus stop: a small shelter with a sign.
      [box(2.4, 0.08, 0.9), 0x6b4a2f, at(R.stop, y + 1.25, R.z - 3.3)], [box(2.44, 0.07, 0.94), 0xf4f8ff, at(R.stop, y + 1.32, R.z - 3.3)],
      [box(2.4, 1.2, 0.07), 0x8a5a2b, at(R.stop, y + 0.6, R.z - 3.72)],
      [box(0.08, 1.25, 0.08), 0x6b4a2f, at(R.stop - 1.1, y + 0.62, R.z - 2.9)], [box(0.08, 1.25, 0.08), 0x6b4a2f, at(R.stop + 1.1, y + 0.62, R.z - 2.9)],
      [box(0.06, 1.7, 0.06), 0x3a3f47, at(R.stop + 2.2, y + 0.85, R.z - 2.95)], [box(0.5, 0.5, 0.05), 0x2f7fe6, at(R.stop + 2.2, y + 1.6, R.z - 2.95)],
    ];
    for (let i = 0; i <= R.bays.length; i++) parts.push([box(0.06, 0.02, 1.7), LINE, at(R.bays[0] - 0.525 + i * 1.05, y + 0.01, R.bayZ - 0.25)]);
    for (let x = -120; x <= ter.N + 120; x += 3) parts.push([box(1.2, 0.02, 0.09), LINE, at(x, y + 0.01, R.z + 0.2)]);
    road = new THREE.Mesh(merge(parts), mat);
    road.receiveShadow = true;
    scene.add(road);
  }

  function update(state, ter) {
    let n = 0, b = 0, dirty = false;
    const y = ter.road.y;
    for (const c of state.cars) {
      Q.setFromAxisAngle(UP, c.yaw);
      M.compose(V.set(c.x, y, c.z), Q, S);
      if (c.kind === 'bus') { if (b < 8) buses.setMatrixAt(b++, M); continue; }
      if (n >= cap) continue;
      cars.setMatrixAt(n, M);
      const k = c.col % PAINT.length;
      if (slot[n] !== k) { slot[n] = k; cars.setColorAt(n, PAINT[k]); dirty = true; }
      n++;
    }
    cars.count = n; buses.count = b;
    cars.instanceMatrix.needsUpdate = true; buses.instanceMatrix.needsUpdate = true;
    if (dirty && cars.instanceColor) cars.instanceColor.needsUpdate = true;
  }

  function clear() {
    if (road) { scene.remove(road); road.geometry.dispose(); road = null; }
    cars.count = 0; buses.count = 0; key = -1;
  }

  return { sync, update, clear };
}
