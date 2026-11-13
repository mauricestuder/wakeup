// The yeti guards the edge of the mountain. Ride out of bounds and it leaps
// out of the trees, grabs you, shakes you over its head, throws you back
// towards the slope and beats its chest about it.
import * as THREE from '../../game/vendor/three.module.min.js';
import { height } from './terrain.js';

// Past this distance from the middle of the mountain, the yeti comes.
export const YETI_LINE = 212;

const L = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e, flatShading: true });
const FUR = L(0xf2f5fa), FUR2 = L(0xdde5ef), SKIN = L(0x8fa3b8), HORN = L(0xe8dcc0), BLACK = L(0x101216),
  MOUTH = L(0x4a1022), WHITE = L(0xffffff);

function blob(r, sx, sy, sz, mat, x, y, z, detail = 1) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  return m;
}

function buildYeti() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(blob(1, 0.95, 1.2, 0.8, FUR, 0, 1.6, 0), blob(1, 0.6, 0.78, 0.32, FUR2, 0, 1.45, 0.52));
  // Shaggy tufts so it doesn't look like a snowman.
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, y = 0.9 + (i % 5) * 0.32;
    body.add(blob(0.22, 1, 1.4, 1, FUR, Math.sin(a) * 0.85, y, Math.cos(a) * 0.68, 0));
  }
  const head = new THREE.Group();
  head.position.y = 2.75;
  head.add(blob(0.58, 1, 0.95, 0.95, FUR, 0, 0, 0), blob(0.4, 1, 0.82, 0.45, SKIN, 0, -0.04, 0.38));
  for (const s of [1, -1]) {
    head.add(blob(0.07, 1, 1, 1, BLACK, s * 0.15, 0.08, 0.56, 0));
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.08), FUR);
    brow.position.set(s * 0.15, 0.2, 0.55); brow.rotation.z = s * 0.35; // angry
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 6), HORN);
    horn.position.set(s * 0.42, 0.42, -0.05); horn.rotation.z = -s * 0.6;
    head.add(brow, horn);
  }
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.17, 0.55);
  mouth.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), MOUTH));
  for (const s of [1, -1]) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 4), WHITE);
    tooth.position.set(s * 0.1, 0.04, 0.03); tooth.rotation.x = Math.PI;
    mouth.add(tooth);
  }
  head.add(mouth);
  body.add(head);
  const arms = [];
  for (const s of [1, -1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.95, 2.3, 0);
    arm.add(blob(0.36, 0.85, 1.9, 0.85, FUR, 0, -0.62, 0), blob(0.24, 1.1, 1, 1, SKIN, 0, -1.32, 0.05));
    body.add(arm);
    arms.push(arm);
    const leg = new THREE.Group();
    leg.position.set(s * 0.45, 0.75, 0);
    leg.add(blob(0.36, 1, 1.3, 1, FUR, 0, -0.3, 0), blob(0.24, 1.2, 0.6, 1.7, SKIN, 0, -0.68, 0.12));
    body.add(leg);
  }
  root.scale.setScalar(1.15);
  root.traverse((o) => { o.frustumCulled = false; });
  return { root, body, head, arms, mouth };
}

const _v = new THREE.Vector3();

export class Yeti {
  constructor(scene) {
    this.m = buildYeti();
    this.m.root.visible = false;
    scene.add(this.m.root);
    this.active = false;
    this.holding = false;
  }

  reset() { this.active = this.holding = false; this.m.root.visible = false; }

  // The rider crossed the line: come and get them. side is +1 or -1.
  start(skier) {
    const side = Math.sign(skier.p.x) || 1;
    this.side = side;
    this.t = 0;
    this.active = true;
    this.holding = true; // the rider is frozen from here until the throw
    this.thrown = false;
    this.grabbed = false;
    this.from = new THREE.Vector3(skier.p.x + side * 16, 0, skier.p.z + 8);
    this.to = new THREE.Vector3(skier.p.x + side * 1.8, 0, skier.p.z + 0.6);
    this.riderAt = skier.p.clone();
    skier.v.set(0, 0, 0);
    this.m.root.visible = true;
  }

  // Moves the yeti and, while it holds them, the rider. Returns 'grab' and
  // 'throw' on the frames those happen.
  update(dt, skier) {
    if (!this.active) return null;
    const M = this.m, t = (this.t += dt), side = this.side;
    let event = null;
    const place = (p, lift) => {
      M.root.position.set(p.x, height(p.x, p.z) + lift, p.z);
    };
    const face = (x, z) => { M.root.rotation.y = Math.atan2(x - M.root.position.x, z - M.root.position.z); };
    const [ar, al] = M.arms; // right and left arm
    M.mouth.scale.y = 1;

    if (t < 0.65) { // leap in out of the trees, arms up
      const k = t / 0.65;
      _v.lerpVectors(this.from, this.to, k);
      place(_v, Math.sin(Math.PI * k) * 5);
      face(this.riderAt.x, this.riderAt.z);
      ar.rotation.x = al.rotation.x = -2.6;
      M.mouth.scale.y = 2.5;
      skier.p.copy(this.riderAt);
    } else if (t < 1.75) { // grab, lift overhead and shake
      if (!this.grabbed) { this.grabbed = true; event = 'grab'; }
      place(this.to, Math.abs(Math.sin(t * 14)) * 0.15);
      face(this.to.x - side * 4, this.to.z + 2); // turn to face the slope
      const k = Math.min(1, (t - 0.65) / 0.3);
      ar.rotation.x = al.rotation.x = -3.0 * k;
      ar.rotation.z = al.rotation.z = 0;
      M.mouth.scale.y = 1 + Math.abs(Math.sin(t * 9)) * 2;
      // The rider in the yeti's hands, above its head, being shaken.
      M.root.updateMatrixWorld(true);
      _v.set(Math.sin(t * 32) * 0.35, 4.1 + Math.sin(t * 23) * 0.2, 0.2).applyMatrix4(M.root.matrixWorld);
      skier.p.lerp(_v.setY(_v.y - 0.9), Math.min(1, k * 1.5));
      skier.v.set(0, 0, 0);
    } else if (!this.thrown) { // the throw: back towards the slope, high and far
      this.thrown = true;
      this.holding = false;
      event = 'throw';
      skier.v.set(-side * 23, 15, 5);
      skier.crashT = -3; // keep spinning through the flight, get up after landing
      ar.rotation.x = al.rotation.x = -0.6;
    } else if (t < 3.6) { // beat its chest
      place(this.to, Math.max(0, Math.sin(t * 7)) * 0.4);
      face(skier.p.x, skier.p.z);
      ar.rotation.x = al.rotation.x = -1.2;
      ar.rotation.z = -0.9 + Math.max(0, Math.sin(t * 16)) * 0.5;
      al.rotation.z = 0.9 - Math.max(0, Math.sin(t * 16 + Math.PI)) * 0.5;
      M.mouth.scale.y = 1 + Math.abs(Math.sin(t * 5)) * 1.6;
      M.head.rotation.x = -0.35;
    } else if (t < 4.3) { // and back into the trees
      const k = (t - 3.6) / 0.7;
      _v.lerpVectors(this.to, this.from, k);
      place(_v, Math.sin(Math.PI * k) * 4);
      face(this.from.x, this.from.z);
      ar.rotation.z = al.rotation.z = 0;
      M.head.rotation.x = 0;
    } else this.reset();
    return event;
  }
}
