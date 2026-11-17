// Idle Lift: all guests as one instanced mesh, moved smoothly between simulation steps.
import { THREE, merge, at, toon } from './scene.js';
import { LIFTS, T } from '../tuning.js';
import { featureAt } from '../network.js';

const AIR = T.AIR_TIME;

const JACKETS = [0xe5484d, 0x2f7fe6, 0xf2c230, 0x34b05a, 0xf2793a, 0xa25be0, 0x24b8b0, 0xe85aa0, 0xf4f4f0, 0x7ad13a, 0x3a50c8, 0xc23a5a, 0xffc61a].map((c) => new THREE.Color(c));
// Skis, boards, poles and goggles: loud colours so they stand out on the snow.
const GEAR = [0xff4d1a, 0x1ec8ff, 0xb6f23a, 0xff2d78, 0xffd400, 0x8a5cff, 0x18e0a0, 0xff8a00].map((c) => new THREE.Color(c));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const tilt = (x, y, z, rx, rz = 0) => new THREE.Matrix4().makeRotationX(rx).multiply(new THREE.Matrix4().makeRotationZ(rz)).setPosition(x, y, z);
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), V = new THREE.Vector3(), S = new THREE.Vector3();
const SCALE = 1.85, SIDE = 0.36;

// The person: white parts take the jacket colour, the rest keeps its own.
function bodyParts(board) {
  const arm = board ? 0.5 : 0.25; // boarders hold their arms out for balance
  return [
    [box(0.24, 0.3, 0.17), 0xffffff, at(0, 0.45, 0)],                     // jacket
    [box(0.07, 0.24, 0.08), 0xffffff, tilt(-0.155, 0.47, 0.02, 0.35, arm)], // arms
    [box(0.07, 0.24, 0.08), 0xffffff, tilt(0.155, 0.47, 0.02, 0.35, -arm)],
    [box(0.075, 0.06, 0.08), 0x2a2a2a, tilt(-0.155 - Math.sin(arm) * 0.12, 0.36, 0.06, 0.35)], // gloves
    [box(0.075, 0.06, 0.08), 0x2a2a2a, tilt(0.155 + Math.sin(arm) * 0.12, 0.36, 0.06, 0.35)],
    [box(0.2, 0.13, 0.19), 0xf6c9a0, at(0, 0.66, 0.005)],                 // a big cartoon head
    [box(0.26, 0.16, 0.25), 0x8c8c8c, at(0, 0.8, -0.01)],                 // helmet, a darker shade of the jacket
    [box(0.035, 0.035, 0.02), 0x1e1610, at(-0.045, 0.69, 0.1)], [box(0.035, 0.035, 0.02), 0x1e1610, at(0.045, 0.69, 0.1)], // eyes
    [box(0.21, 0.29, 0.15), 0x3a3a3a, at(0, 0.17, 0)],                    // trousers
    [box(0.1, 0.06, 0.16), 0x202020, at(-0.055, 0.04, 0.01)], [box(0.1, 0.06, 0.16), 0x202020, at(0.055, 0.04, 0.01)], // boots
  ];
}
// The gear, in white so the instance colour paints it.
function gearParts(board) {
  const parts = [[box(0.24, 0.05, 0.03), 0xffffff, at(0, 0.745, 0.115)]]; // goggles, up on the helmet
  if (board) {
    parts.push([box(1.0, 0.04, 0.28), 0xffffff, at(0, 0.01, 0)]);          // the board, across the rider
    parts.push([box(0.12, 0.045, 0.3), 0x202020, at(-0.3, 0.015, 0)], [box(0.12, 0.045, 0.3), 0x202020, at(0.3, 0.015, 0)]); // tips
    parts.push([box(0.6, 0.012, 0.06), 0x303030, at(0, 0.035, 0)]);        // stripe
  } else {
    for (const sx of [-0.075, 0.075]) {
      parts.push([box(0.085, 0.035, 0.98), 0xffffff, at(sx, 0.0, 0.08)]);  // ski
      parts.push([box(0.085, 0.035, 0.12), 0xffffff, tilt(sx, 0.03, 0.6, -0.5)]); // tip turned up
      // Pole: from the glove down and back to the snow.
      parts.push([new THREE.CylinderGeometry(0.012, 0.012, 0.62, 4), 0x9a9a9a, tilt(sx * 2.6, 0.2, -0.02, -0.45)]);
      parts.push([new THREE.CylinderGeometry(0.035, 0.035, 0.01, 6), 0x9a9a9a, at(sx * 2.6, 0.015, -0.14)]);
    }
  }
  return parts;
}

export function createGuestView(scene, cap = 440) {
  const mat = toon({ vertexColors: true });
  const make = (geo, colors) => {
    const mesh = new THREE.InstancedMesh(geo, mat, cap);
    mesh.castShadow = true; mesh.frustumCulled = false; mesh.count = 0;
    mesh.setColorAt(0, colors[0]);
    scene.add(mesh);
    const slot = new Int8Array(cap).fill(-1); slot[0] = 0;
    return { mesh, slot, colors };
  };
  // Two kinds, skiers and snowboarders, each as a body and its gear.
  const kinds = [0, 1].map((board) => ({ body: make(merge(bodyParts(board)), JACKETS), gear: make(merge(gearParts(board)), GEAR), n: 0, dirty: false }));
  const paint = (part, n, c) => { if (part.slot[n] !== c) { part.slot[n] = c; part.mesh.setColorAt(n, part.colors[c]); return true; } return false; };

  function update(state, ter, dt, speed) {
    for (const l of state.lifts) for (let i = 0; i < l.queue.length; i++) l.queue[i].qi = i;
    // Positions come fresh from the rules every frame, so skiers are drawn where they are.
    // Only the hop between two states (queue to chair, chair to piste) and the queue itself are blended.
    const soft = 1 - Math.exp(-dt * 12 * Math.max(1, speed)), turn = 1 - Math.exp(-dt * 12);
    for (const k of kinds) { k.n = 0; k.dirty = false; }
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
          y = L.ground ? ter.ground(x, z) : g.y - 1.12 * 1; // sitting just under the cable
          if (l.type === 'gondola') show = false;
          if (l.type === 'chair') y = g.y - 1.0;
        }
      } else if (g.st === 'ski') {
        // Carving: swing left and right across the piste.
        // Snowboarders stand sideways and draw longer, wider turns.
        const ph = g.s * (g.board ? 0.55 : 0.8) + g.seed * 6.28, sw = Math.sin(ph) * (g.board ? 0.95 : 0.75);
        x += Math.cos(g.face) * sw; z -= Math.sin(g.face) * sw;
        yaw = g.face + Math.cos(ph) * 0.55; roll = -Math.cos(ph) * 0.3;
        if (g.board) { yaw += 1.25; flip = -Math.cos(ph) * 0.28; roll = 0; }
        // What the piste has here: moguls, gates, the fun park, a bridge or a tunnel.
        const f = featureAt(state.pisteById[g.piste], g.s);
        if (f) {
          const u = (g.s - f.s0) / Math.max(1, f.s1 - f.s0), across = (w) => { x = g.x + Math.cos(g.face) * w; z = g.z - Math.sin(g.face) * w; };
          if (f.type === 'bridge' || f.type === 'tunnel') { across(sw * 0.4); y = g.y; }
          else if (f.type === 'moguls') lift = Math.abs(Math.sin(g.s * 3.3)) * 0.2;
          else if (f.type === 'gates') { const w = Math.sin((g.s - f.s0) / 1.6 * Math.PI + Math.PI / 2) * 0.75; across(w); yaw = g.face - Math.cos((g.s - f.s0) / 1.6 * Math.PI + Math.PI / 2) * 0.7; roll = -w * 0.5; }
          else if (f.type === 'park') {
            const rail = (u > 0.08 && u < 0.2) || (u > 0.58 && u < 0.68), box = u > 0.25 && u < 0.33;
            if ((rail || box) && g.seed < 0.55) { across(rail ? -0.8 : 0.8); lift = rail ? 0.42 : 0.3; yaw = g.face + Math.PI / 2; roll = 0; flip = 0; }
            else if (u > 0.72) { const w = Math.sin(g.s * 1.1 + g.seed * 6) * 1.45; across(w); lift = (w / 1.45) * (w / 1.45) * 0.95; roll = -w * 0.55; yaw = g.face + Math.cos(g.s * 1.1 + g.seed * 6) * 0.9; }
          }
        }
        // Off a kicker: up in an arc, with a full spin.
        if (g.air > 0) { const t = 1 - g.air / AIR; lift = Math.sin(t * Math.PI) * 1.9; yaw = g.face + t * Math.PI * 2; roll = g.board ? Math.sin(t * Math.PI) * 0.6 : 0; flip = Math.sin(t * Math.PI) * 0.5; }
      } else if (g.st === 'eat') show = false;
      if (y === undefined) y = ter.ground(x, z);
      y += lift;

      if (g.vx === undefined || Math.abs(g.vx - x) + Math.abs(g.vz - z) > 6) { g.vx = x; g.vy = y; g.vz = z; g.vyaw = yaw; g.vst = g.st; g.blend = 0; }
      if (g.vst !== g.st) { g.vst = g.st; g.blend = 0.3; }
      if (g.st === 'alight' || g.st === 'board') g.blend = 0; // follow the door exactly
      const k = g.air > 0 ? 1 : g.st === 'queue' || g.blend > 0 ? soft : 1;
      if (g.blend > 0) g.blend -= dt;
      g.vx += (x - g.vx) * k; g.vy += (y - g.vy) * k; g.vz += (z - g.vz) * k;
      let d = yaw - g.vyaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      g.vyaw += d * (g.air > 0 ? 1 : turn);
      g.shown = show;
      const kd = kinds[g.board ? 1 : 0];
      if (!show || kd.n >= cap) continue;
      E.set(-flip, g.vyaw, roll);
      Q.setFromEuler(E);
      const sc = SCALE * (g.st === 'alight' || g.st === 'board' ? g.k : 1); // smaller while climbing in or out of a car
      M.compose(V.set(g.vx, g.vy, g.vz), Q, S.set(sc, sc, sc));
      kd.body.mesh.setMatrixAt(kd.n, M); kd.gear.mesh.setMatrixAt(kd.n, M);
      if (paint(kd.body, kd.n, g.col % JACKETS.length)) kd.dirty = true;
      if (paint(kd.gear, kd.n, ((g.seed * 97) | 0) % GEAR.length)) kd.dirty = true;
      kd.n++;
    }
    for (const k of kinds) for (const part of [k.body, k.gear]) {
      part.mesh.count = k.n;
      part.mesh.instanceMatrix.needsUpdate = true;
      if (k.dirty && part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true; // colours only when a slot changed hands
    }
  }

  return { update, clear() { for (const k of kinds) { k.body.mesh.count = 0; k.gear.mesh.count = 0; } }, color: (i) => '#' + JACKETS[i % JACKETS.length].getHexString() };
}
