// First Chair: all guests as one instanced mesh, moved smoothly between simulation steps.
import { THREE, merge, at } from './scene.js';
import { LIFTS, T } from '../tuning.js';

const AIR = T.AIR_TIME;

const JACKETS = [0xe5484d, 0x2f7fe6, 0xf2c230, 0x34b05a, 0xf2793a, 0xa25be0, 0x24b8b0, 0xe85aa0, 0xf4f4f0, 0x7ad13a, 0x3a50c8, 0xc23a5a].map((c) => new THREE.Color(c));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), V = new THREE.Vector3(), S = new THREE.Vector3();
const SCALE = 1.55, SIDE = 0.36;

export function createGuestView(scene, cap = 440) {
  const geo = merge([
    [box(0.24, 0.3, 0.16), 0xffffff, at(0, 0.43, 0)],     // jacket
    [box(0.17, 0.17, 0.17), 0x8c8c8c, at(0, 0.67, 0)],    // helmet, a darker shade of the jacket
    [box(0.2, 0.28, 0.14), 0x3a3a3a, at(0, 0.16, 0)],     // trousers
    [box(0.06, 0.03, 0.66), 0x151515, at(-0.07, 0.015, 0.05)], [box(0.06, 0.03, 0.66), 0x151515, at(0.07, 0.015, 0.05)],
  ]);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), cap);
  mesh.castShadow = true; mesh.frustumCulled = false; mesh.count = 0;
  mesh.setColorAt(0, JACKETS[0]);
  const slot = new Int8Array(cap).fill(-1); slot[0] = 0;
  scene.add(mesh);

  function update(state, ter, dt, speed) {
    for (const l of state.lifts) for (let i = 0; i < l.queue.length; i++) l.queue[i].qi = i;
    // Positions come fresh from the rules every frame, so skiers are drawn where they are.
    // Only the hop between two states (queue to chair, chair to piste) and the queue itself are blended.
    const soft = 1 - Math.exp(-dt * 12 * Math.max(1, speed)), turn = 1 - Math.exp(-dt * 12);
    let n = 0, dirty = false;
    for (const g of state.guests) {
      let x = g.x, z = g.z, y, yaw = g.face, roll = 0, show = true, lift = 0, flip = 0;
      if (g.st === 'queue') {
        const l = state.liftById[g.lift];
        if (l) {
          // Three abreast, snaking back from the station.
          const row = Math.floor(g.qi / 3), col = g.qi % 3, dx = Math.sin(l.dir), dz = Math.cos(l.dir);
          const back = 1.4 + row * 0.44, across = (col - 1) * 0.4;
          x = l.a.x - dx * back + dz * across; z = l.a.z - dz * back - dx * across; yaw = l.dir;
        }
      } else if (g.st === 'ride') {
        const l = state.liftById[g.lift];
        if (l) {
          const L = LIFTS[l.type], dx = Math.sin(l.dir), dz = Math.cos(l.dir);
          const across = SIDE + (L.seats > 1 ? ((g.seat || 0) - (L.seats - 1) / 2) * 0.22 : 0);
          x += dz * across; z -= dx * across;
          y = L.ground ? ter.height(x, z) : g.y - 1.12 * 1; // sitting just under the cable
          if (l.type === 'gondola') show = false;
          if (l.type === 'chair') y = g.y - 1.0;
        }
      } else if (g.st === 'ski') {
        // Carving: swing left and right across the piste.
        const ph = g.s * 0.8 + g.seed * 6.28, sw = Math.sin(ph) * 0.75;
        x += Math.cos(g.face) * sw; z -= Math.sin(g.face) * sw;
        yaw = g.face + Math.cos(ph) * 0.55; roll = -Math.cos(ph) * 0.3;
        // Off a kicker: up in an arc, with a full spin.
        if (g.air > 0) { const t = 1 - g.air / AIR; lift = Math.sin(t * Math.PI) * 1.9; yaw = g.face + t * Math.PI * 2; roll = 0; flip = Math.sin(t * Math.PI) * 0.5; }
      } else if (g.st === 'eat') show = false;
      if (y === undefined) y = ter.height(x, z);
      y += lift;

      if (g.vx === undefined || Math.abs(g.vx - x) + Math.abs(g.vz - z) > 6) { g.vx = x; g.vy = y; g.vz = z; g.vyaw = yaw; g.vst = g.st; g.blend = 0; }
      if (g.vst !== g.st) { g.vst = g.st; g.blend = 0.3; }
      const k = g.air > 0 ? 1 : g.st === 'queue' || g.blend > 0 ? soft : 1;
      if (g.blend > 0) g.blend -= dt;
      g.vx += (x - g.vx) * k; g.vy += (y - g.vy) * k; g.vz += (z - g.vz) * k;
      let d = yaw - g.vyaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      g.vyaw += d * (g.air > 0 ? 1 : turn);
      g.shown = show;
      if (!show || n >= cap) continue;
      E.set(-flip, g.vyaw, roll);
      Q.setFromEuler(E);
      M.compose(V.set(g.vx, g.vy, g.vz), Q, S.set(SCALE, SCALE, SCALE));
      mesh.setMatrixAt(n, M);
      const c = g.col % JACKETS.length;
      if (slot[n] !== c) { slot[n] = c; mesh.setColorAt(n, JACKETS[c]); dirty = true; }
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (dirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true; // colours only when a slot changed hands
  }

  return { update, clear() { mesh.count = 0; }, color: (i) => '#' + JACKETS[i % JACKETS.length].getHexString() };
}
