// Idle Lift: the valley road, the car park, and the cars and coaches that bring the guests.
import { THREE, merge, at } from './scene.js';
import { T } from '../tuning.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const PAINT = [0xd9372f, 0x2f7fe6, 0xf2f2ee, 0x3a3f47, 0xf2c230, 0x34b05a, 0x9aa1ab, 0xf2793a].map((c) => new THREE.Color(c));
const TAR = 0x7d7378, LINE = 0xfff4e4, GLASS = 0x1c2733, TYRE = 0x2a2326, SNOW = 0xfffaf4, POLE = 0x3a3f47;
const M = new THREE.Matrix4(), D = new THREE.Matrix4(), DM = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
const LIFT = 0.015; // the tarmac sits a hair above the ground under it

// White parts take the colour of the car, dark parts stay dark.
function carGeo() {
  const wheel = (x, z) => [box(0.14, 0.26, 0.3), TYRE, at(x, 0.13, z)];
  return merge([
    [box(0.72, 0.3, 1.5), 0xffffff, at(0, 0.33, 0)], [box(0.64, 0.26, 0.8), GLASS, at(0, 0.6, -0.08)], [box(0.66, 0.05, 0.84), 0xffffff, at(0, 0.75, -0.08)],
    [box(0.3, 0.12, 0.9), 0x23272e, at(0.08, 0.84, -0.08)], // ski box on the roof
    [box(0.5, 0.08, 0.04), 0xfff3c4, at(0, 0.38, 0.75)], [box(0.5, 0.08, 0.04), 0xd9372f, at(0, 0.38, -0.75)], // lights
    wheel(-0.33, 0.48), wheel(0.33, 0.48), wheel(-0.33, -0.48), wheel(0.33, -0.48),
  ]);
}
// A front door, hinged at its front edge (the origin), so it swings open around it.
function doorGeo() {
  return merge([[box(0.04, 0.26, 0.42), 0xffffff, at(0, 0, -0.21)], [box(0.035, 0.18, 0.36), GLASS, at(0, 0.2, -0.21)]]);
}
function busGeo() {
  const wheel = (x, z) => [box(0.16, 0.36, 0.5), TYRE, at(x, 0.18, z)];
  return merge([
    [box(1.0, 0.5, 4.0), 0xf2f4f7, at(0, 0.5, 0)], [box(1.0, 0.16, 4.0), 0xe5484d, at(0, 0.36, 0)], [box(0.96, 0.42, 3.8), GLASS, at(0, 0.94, 0)], [box(1.0, 0.1, 4.0), 0xf2f4f7, at(0, 1.2, 0)],
    [box(0.04, 0.7, 0.5), 0x2a3440, at(0.51, 0.6, 1.25)], // the door, on the kerb side
    wheel(-0.46, 1.3), wheel(0.46, 1.3), wheel(-0.46, -1.3), wheel(0.46, -1.3),
  ]);
}

// The parking sign: a blue P with the price under it. Drawn on a canvas, redrawn when the price changes.
function signTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 176;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.draw = (k) => {
    const g = c.getContext('2d'), p = T.PARK[k];
    g.clearRect(0, 0, 128, 176);
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(2, 2, 124, 124, 18); g.fill();
    g.fillStyle = '#2f6fd6'; g.beginPath(); g.roundRect(9, 9, 110, 110, 13); g.fill();
    g.fillStyle = '#ffffff'; g.font = 'bold 92px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', 64, 68);
    g.fillStyle = k === 0 ? '#2fa35a' : '#ffcf4d'; g.beginPath(); g.roundRect(6, 132, 116, 40, 10); g.fill();
    g.fillStyle = k === 0 ? '#ffffff' : '#3a2410'; g.font = 'bold 30px system-ui, sans-serif'; g.fillText(k === 0 ? 'FREE' : p.tag, 64, 153);
    tex.needsUpdate = true;
  };
  return tex;
}

export function createCarView(scene, cap = 160) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const cars = new THREE.InstancedMesh(carGeo(), mat, cap), buses = new THREE.InstancedMesh(busGeo(), mat, 8), doors = new THREE.InstancedMesh(doorGeo(), mat, cap);
  for (const m of [cars, buses, doors]) { m.castShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); }
  cars.setColorAt(0, PAINT[0]); doors.setColorAt(0, PAINT[0]);
  const slot = new Int8Array(cap).fill(-1), dslot = new Int8Array(cap).fill(-1); slot[0] = 0; dslot[0] = 0;
  const tex = signTexture(), signMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
  let road = null, signs = [], key = -1, price = -1;

  // The road, the car park and the coach stop: built once per mountain.
  function sync(state, ter) {
    if (road && key === ter) return;
    clear(); key = ter;
    const R = ter.road, L = R.lot, y = R.y, top = y + LIFT, A = R.bays.filter((b) => b.row === 0);
    const slab = (x0, x1, z0, z1, c = TAR) => [box(x1 - x0, 0.6, z1 - z0), c, at((x0 + x1) / 2, top - 0.3, (z0 + z1) / 2)];
    const parts = [
      [box(1100, 0.6, R.half * 2), TAR, at(ter.N / 2, top - 0.3, R.z)],
      slab(A[0].x - 0.6, A[A.length - 1].x + 0.6, R.bayZ - 1.3, R.z - R.half + 0.01),
      [box(15, 0.6, 1.9), TAR, at(R.stop, top - 0.3, R.z - 1.9)],
      slab(L.x0, L.x1, L.z0 - 0.05, L.z1),
      // Bus stop: a small shelter with a sign.
      [box(2.4, 0.08, 0.9), 0x6b4a2f, at(R.stop, y + 1.25, R.z - 3.3)], [box(2.44, 0.07, 0.94), SNOW, at(R.stop, y + 1.32, R.z - 3.3)],
      [box(2.4, 1.2, 0.07), 0x8a5a2b, at(R.stop, y + 0.6, R.z - 3.72)], [box(2.2, 0.08, 0.3), 0x6b4a2f, at(R.stop, y + 0.4, R.z - 3.55)],
      [box(0.08, 1.25, 0.08), 0x6b4a2f, at(R.stop - 1.1, y + 0.62, R.z - 2.9)], [box(0.08, 1.25, 0.08), 0x6b4a2f, at(R.stop + 1.1, y + 0.62, R.z - 2.9)],
      [box(0.06, 1.7, 0.06), POLE, at(R.stop + 2.2, y + 0.85, R.z - 2.95)], [box(0.5, 0.5, 0.05), 0xf2c230, at(R.stop + 2.2, y + 1.6, R.z - 2.95)],
    ];
    // Bay lines, row by row, with a coloured stop at the head of each bay.
    const ROWC = [0xffffff, 0x2f7fe6, 0xf2c230, 0x34b05a];
    for (let row = 0; row < 4; row++) {
      const B = R.bays.filter((b) => b.row === row);
      if (!B.length) continue;
      const z = B[0].z, nose = B[0].nose;
      for (let i = 0; i <= B.length; i++) parts.push([box(0.06, 0.02, 1.75), LINE, at(B[0].x - 0.525 + i * 1.05, top + 0.01, z)]);
      if (row > 0) for (const b of B) parts.push([box(0.5, 0.07, 0.1), ROWC[row], at(b.x, top + 0.035, z + nose * 0.82)]);
    }
    // Lane markings: a dashed centre line on the road and arrows in the car park.
    for (let x = -120; x <= ter.N + 120; x += 3) parts.push([box(1.2, 0.02, 0.09), LINE, at(x, top + 0.01, R.z + 0.2)]);
    const arrow = (x, z, yaw) => {
      parts.push([box(0.12, 0.02, 0.9), LINE, at(x, top + 0.01, z, yaw)]);
      for (const s of [-1, 1]) parts.push([box(0.1, 0.02, 0.45), LINE, at(x + Math.sin(yaw + s * 0.6) * 0.32 + Math.sin(yaw) * 0.2, top + 0.01, z + Math.cos(yaw + s * 0.6) * 0.32 + Math.cos(yaw) * 0.2, yaw + Math.PI + s * 0.6)]);
    };
    for (const a of L.aisles) for (let x = L.inX + 4; x < L.outX - 2; x += 8) arrow(x, a, Math.PI / 2);
    arrow(L.inX, R.z + 2.6, 0); arrow(L.outX, R.z + 2.6, Math.PI);
    // A snow bank pushed up by the plough around three sides, with gaps for the lanes.
    const bank = (x0, x1, z0, z1) => parts.push([box(x1 - x0, 0.36, z1 - z0), SNOW, at((x0 + x1) / 2, top + 0.1, (z0 + z1) / 2)]);
    bank(L.x0 - 0.5, L.x1 + 0.5, L.z1, L.z1 + 0.6);
    bank(L.x0 - 0.5, L.x0, L.z0 + 1.2, L.z1); bank(L.x1, L.x1 + 0.5, L.z0 + 1.2, L.z1);
    bank(L.x0 + 2.2, L.x1 - 2.2, L.z0 - 0.02, L.z0 + 0.12);
    // Lamp posts down the middle, and a ticket booth with a barrier at the way in.
    for (let x = L.inX + 3; x < L.outX - 1; x += 7) {
      const z = (R.bays.find((b) => b.row === 2).z + R.bays.find((b) => b.row === 3).z) / 2;
      parts.push([box(0.08, 2.4, 0.08), POLE, at(x, top + 1.2, z)], [box(0.5, 0.06, 0.16), POLE, at(x, top + 2.4, z)], [box(0.42, 0.08, 0.14), 0xffe9a8, at(x, top + 2.35, z)]);
    }
    parts.push([box(0.9, 1.0, 0.8), 0xf2c230, at(L.inX - 1.6, top + 0.5, R.z + 2.3)], [box(1.0, 0.08, 0.9), SNOW, at(L.inX - 1.6, top + 1.04, R.z + 2.3)],
      [box(0.7, 0.36, 0.05), GLASS, at(L.inX - 1.6, top + 0.66, R.z + 2.72)],
      [box(0.1, 0.6, 0.1), POLE, at(L.inX - 1.05, top + 0.3, R.z + 1.65)]);
    for (let k = 0; k < 4; k++) parts.push([box(0.4, 0.07, 0.07), k % 2 ? 0xffffff : 0xe5484d, at(L.inX - 0.8 + k * 0.4, top + 0.62, R.z + 1.65)]);
    road = new THREE.Mesh(merge(parts), mat);
    road.receiveShadow = true;
    scene.add(road);
    // Two parking signs that show the price: at the way in, and by the village bays.
    const sign = (x, z) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(merge([[box(0.09, 2.2, 0.09), POLE, at(0, 1.1, -0.06)]]), mat));
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), signMat);
      p.position.set(0, 2.55, 0); g.add(p);
      g.position.set(x, top, z); scene.add(g); signs.push(g);
    };
    sign(L.inX - 2.7, R.z + 1.7); sign(A[0].x - 1.5, R.bayZ + 0.4);
    price = -1;
  }

  function update(state, ter) {
    let n = 0, b = 0, d = 0, dirty = false, ddirty = false;
    const y = ter.road.y + LIFT;
    const park = state.park ?? T.PARK_START;
    if (park !== price) { price = park; tex.draw(park); }
    for (const c of state.cars) {
      Q.setFromAxisAngle(UP, c.yaw);
      M.compose(V.set(c.x, y, c.z), Q, S);
      if (c.kind === 'bus') { if (b < 8) buses.setMatrixAt(b++, M); continue; }
      if (n >= cap) continue;
      cars.setMatrixAt(n, M);
      const k = c.col % PAINT.length;
      if (slot[n] !== k) { slot[n] = k; cars.setColorAt(n, PAINT[k]); dirty = true; }
      n++;
      // The doors swing open while somebody climbs in or out.
      if (c.door > 0.03 && d < cap - 1) {
        for (const side of [-1, 1]) {
          D.makeRotationY(-side * c.door * 1.15).setPosition(side * 0.37, 0.42, 0.33);
          doors.setMatrixAt(d, DM.multiplyMatrices(M, D));
          if (dslot[d] !== k) { dslot[d] = k; doors.setColorAt(d, PAINT[k]); ddirty = true; }
          d++;
        }
      }
    }
    cars.count = n; buses.count = b; doors.count = d;
    cars.instanceMatrix.needsUpdate = true; buses.instanceMatrix.needsUpdate = true; doors.instanceMatrix.needsUpdate = true;
    if (dirty && cars.instanceColor) cars.instanceColor.needsUpdate = true;
    if (ddirty && doors.instanceColor) doors.instanceColor.needsUpdate = true;
  }

  function clear() {
    if (road) { scene.remove(road); road.geometry.dispose(); road = null; }
    for (const g of signs) scene.remove(g);
    signs = [];
    cars.count = 0; buses.count = 0; doors.count = 0; key = -1;
  }

  return { sync, update, clear };
}
