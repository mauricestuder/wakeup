// Idle Lift: the cash boxes at the stations, as piles of gold coins that grow while money waits,
// and bounce when it is collected. The tappable bubbles over them are HTML, see main.js.
import { THREE, merge, at, toon } from './scene.js';
import { STATIONS, boxCap, managed } from '../idle.js';

const PILES = 3, PER = 6;
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

// Where a station's cash sits on the ground: beside the bottom station of its lift, or by the car-park booth.
export function cashSpot(state, ter, key) {
  if (key === 'till') { const R = ter.road; return { x: R.lot.inX - 2.9, z: R.z + 2.6, y: R.y }; }
  const l = state.liftById[+key];
  if (!l) return null;
  const px = Math.cos(l.dir), pz = -Math.sin(l.dir), x = l.a.x + px * 2.3 - Math.sin(l.dir) * 0.6, z = l.a.z + pz * 2.3 - Math.cos(l.dir) * 0.6;
  return { x, z, y: ter.ground(x, z) };
}

export function createCashView(scene) {
  const geo = merge([
    [new THREE.CylinderGeometry(0.3, 0.3, 0.1, 14), 0xf2ae12, null],
    [new THREE.CylinderGeometry(0.22, 0.22, 0.104, 14), 0xffd84a, null],
  ]);
  const mat = toon({ vertexColors: true });
  const coins = new THREE.InstancedMesh(geo, mat, STATIONS.length * PILES * PER);
  coins.castShadow = true; coins.frustumCulled = false; coins.count = 0;
  coins.userData.olw = 0.8;
  scene.add(coins);
  const bounce = {}, shown = {};

  function update(state, ter, dt) {
    let n = 0;
    for (const k of STATIONS) {
      if (bounce[k] > 0) bounce[k] = Math.max(0, bounce[k] - dt);
      const have = state.box[k] || 0, b = bounce[k] || 0;
      if (!b && (managed(state, k) || have < 1)) { shown[k] = 0; continue; }
      const spot = cashSpot(state, ter, k);
      if (!spot) continue;
      const cap = boxCap(state, k), part = (state.steadyParts || {})[k] || 1;
      const f = Math.min(1, isFinite(cap) ? have / cap : have / (part * 600));
      // Just collected: the coins that were there jump up, spin and shrink away.
      const count = b > 0 ? shown[k] || 0 : (shown[k] = Math.max(1, Math.ceil(f * PILES * PER)));
      const u = b > 0 ? 1 - b / 0.5 : 0, up = u * u * 5, sc = 1.3 * (1 - u * 0.9);
      for (let i = 0; i < count; i++) {
        const p = i % PILES, h = Math.floor(i / PILES);
        const ox = (p - 1) * 0.55 * (1 + u), oz = p === 1 ? -0.35 : 0.1;
        Q.setFromAxisAngle(UP, i * 0.7 + u * 9);
        M.compose(V.set(spot.x + ox, spot.y + 0.06 + h * 0.105 * (1 + u) + up, spot.z + oz), Q, S.set(sc, sc, sc));
        coins.setMatrixAt(n++, M);
      }
    }
    coins.count = n;
    coins.instanceMatrix.needsUpdate = true;
  }

  return { update, bump(k) { bounce[k] = 0.5; }, sync() {}, clear() { coins.count = 0; } };
}
