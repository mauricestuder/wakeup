// The skier: a small rigged model, ground/air/rail physics and trick tracking.
import * as THREE from '../../game/vendor/three.module.min.js';
import { height, normal, rails, obstacleHit, inPipe, PIPE } from './terrain.js';

const G = 9.81;
const SPIN_MAX = 10.5;  // rad/s, about 600 degrees a second
const FLIP_MAX = 7.2;
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const DEG = 180 / Math.PI;
const PIVOT = 0.85; // height of the body's centre above the feet

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const m1 = new THREE.Matrix4(), q1 = new THREE.Quaternion();

function basisQuat(up, fwd, out) {
  const left = v3.crossVectors(up, fwd).normalize();
  const f = v2.crossVectors(left, up).normalize();
  m1.makeBasis(left, up, f);
  return out.setFromRotationMatrix(m1);
}

// ---------- model ----------

function box(w, h, d, color, y = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, y, 0), new THREE.MeshLambertMaterial({ color }));
  return m;
}

function buildModel() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // everything except skis; turned for slides and stops
  root.add(body);
  const jacket = 0xff4f1f, pants = 0x22303f, dark = 0x15181c;

  const skis = [];
  for (const side of [1, -1]) {
    const ski = new THREE.Group();
    const plank = box(0.1, 0.035, 1.72, 0x1e88e5);
    const tip = box(0.1, 0.035, 0.22, 0x1e88e5);
    tip.position.set(0, 0.05, 0.92); tip.rotation.x = -0.5;
    const tail = box(0.1, 0.035, 0.2, 0x1e88e5);
    tail.position.set(0, 0.04, -0.92); tail.rotation.x = 0.45;
    const boot = box(0.13, 0.22, 0.3, dark, 0.11);
    ski.add(plank, tip, tail, boot);
    ski.position.set(side * 0.13, 0.02, 0);
    root.add(ski);
    skis.push(ski);
  }

  const hips = new THREE.Group();
  body.add(hips);
  const legs = [];
  for (const side of [1, -1]) {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.12, 0, 0);
    thigh.add(box(0.15, 0.46, 0.17, pants, -0.23));
    const shin = new THREE.Group();
    shin.position.y = -0.46;
    shin.add(box(0.14, 0.46, 0.16, pants, -0.23));
    thigh.add(shin);
    hips.add(thigh);
    legs.push({ thigh, shin, side });
  }
  const torso = new THREE.Group();
  hips.add(torso);
  torso.add(box(0.4, 0.56, 0.25, jacket, 0.28));
  const head = new THREE.Group();
  head.position.y = 0.66;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 9), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  const goggles = box(0.24, 0.07, 0.05, 0x111111);
  goggles.position.set(0, 0, 0.12);
  const lens = box(0.2, 0.05, 0.02, 0xffb02e);
  lens.position.set(0, 0, 0.145);
  head.add(helmet, goggles, lens);
  torso.add(head);
  const arms = [];
  for (const side of [1, -1]) {
    const upper = new THREE.Group();
    upper.position.set(side * 0.25, 0.52, 0);
    upper.add(box(0.12, 0.34, 0.13, jacket, -0.17));
    const fore = new THREE.Group();
    fore.position.y = -0.34;
    fore.add(box(0.11, 0.32, 0.12, jacket, -0.16));
    const glove = box(0.11, 0.1, 0.12, dark, -0.36);
    fore.add(glove);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.15, 5).translate(0, -0.5, 0),
      new THREE.MeshLambertMaterial({ color: 0xcfd4da }));
    pole.position.y = -0.36;
    pole.rotation.x = 0.9;
    fore.add(pole);
    upper.add(fore);
    torso.add(upper);
    arms.push({ upper, fore, pole, side });
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { root, body, hips, torso, legs, arms, skis, head };
}

// Two-bone IK for arms and legs: `tgt` is in the parent's space, the chain
// hangs along -y at rest and the middle joint bends toward `bend`.
const REST = new THREE.Vector3(0, -1, 0);
const _t = new THREE.Vector3(), _ax = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _iq = new THREE.Quaternion();
function twoBone(upper, lower, tgt, L1, L2, bend) {
  _t.copy(tgt).sub(upper.position);
  const raw = _t.length() || 1e-3;
  _t.divideScalar(raw);
  const d = Math.min(L1 + L2 - 1e-3, Math.max(Math.abs(L1 - L2) + 1e-3, raw));
  const a = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  _ax.crossVectors(_t, bend);
  if (_ax.lengthSq() < 1e-6) _ax.set(1, 0, 0);
  _ax.normalize();
  _u.copy(_t).applyAxisAngle(_ax, a);
  upper.quaternion.setFromUnitVectors(REST, _u);
  _f.copy(_t).multiplyScalar(d).addScaledVector(_u, -L1).normalize();
  _f.applyQuaternion(_iq.copy(upper.quaternion).invert());
  lower.quaternion.setFromUnitVectors(REST, _f);
}

// ---------- tricks ----------

export function nameTrick(air) {
  const total = air.total * DEG;
  const off = air.total > 0 ? air.off / air.total * DEG : 0;
  let rot = '', base = 0, flipDir = air.flip >= 0 ? 'Front' : 'Back';
  if (total < 140) {
    rot = '';
  } else if (off < 16) {
    let deg = Math.round(total / 180) * 180;
    if (air.fromSlide) deg = Math.max(90, Math.round((total - 90) / 180) * 180 + 90);
    rot = deg + (air.fromSlide ? ' Out' : '');
    base = deg / 180 * 140 + Math.pow(deg / 360, 2) * 120;
  } else if (off > 64) {
    const n = Math.max(1, Math.round(total / 360));
    rot = (n === 1 ? '' : n <= 4 ? ['', '', 'Double ', 'Triple ', 'Quad '][n] : n + 'x ') + flipDir + 'flip';
    base = 500 * n * n;
  } else {
    const deg = Math.max(360, Math.round(total / 180) * 180);
    const corks = deg <= 720 ? 1 : deg <= 1260 ? 2 : 3;
    const kind = air.flip >= 0 ? 'Misty' : 'Cork';
    rot = ['', '', 'Double ', 'Triple '][corks] + kind + ' ' + deg;
    base = (deg / 180 * 160 + Math.pow(deg / 360, 2) * 160) * (1 + 0.5 * corks);
  }
  const parts = [];
  if (rot) parts.push((air.switchTakeoff ? 'Switch ' : '') + rot);
  let pts = base * (air.switchTakeoff && rot ? 1.2 : 1);
  for (const g of air.grabs) {
    if (g.t < 0.2) continue;
    parts.push(g.name);
    const def = GRABS[g.name] || STYLES[g.name];
    pts += (150 + Math.min(g.t, 1.5) * 350) * (def ? def.k : 1);
  }
  if (!rot && air.pipe && air.t > 0.5) parts.unshift('Straight Air');
  else if (!parts.length && air.t > 0.9) parts.push('Air');
  pts += air.t * 40;
  if (air.pipe && air.t > 0.4) pts += 100 + air.t * 60;
  return { name: parts.join(' + '), points: Math.round(pts / 10) * 10 };
}

// Grabs and style moves. Each has a pose: ski offsets (position and
// rotation, per ski: 0 is the left ski, 1 the right), hands that hold a point
// on a ski [hand, ski, z along the ski, x across it] or reach to a spot near
// the body, a torso lean, and a points multiplier.
const GRABS = {
  Safety: { k: 0.8, hands: [[1, 1, 0.0, -0.06]], skis: [{ y: 0.3 }, { y: 0.32, rz: 0.15 }], torso: { z: -0.2 } },
  Mute: { k: 1, hands: [[0, 1, 0.28, -0.06]], skis: [{ y: 0.25, ry: -0.1 }, { y: 0.32, ry: 0.2, rz: 0.2 }], torso: { y: -0.3, z: 0.1 } },
  Tail: { k: 1, hands: [[1, 1, -0.62, -0.05]], skis: [{ y: 0.25, rx: -0.45 }, { y: 0.3, rx: -0.5 }], torso: { y: 0.35 } },
  'Truck Driver': { k: 1.1, hands: [[0, 0, 0.3, 0.06], [1, 1, 0.3, -0.06]], skis: [{ y: 0.35, z: 0.15, rx: -0.35 }, { y: 0.35, z: 0.15, rx: -0.35 }], torso: { x: 0.35 } },
  Japan: { k: 1.3, hands: [[0, 1, 0.3, 0.06]], skis: [{ y: 0.2 }, { y: 0.5, z: -0.25, rx: -1.0, ry: 0.35 }], torso: { x: 0.25, y: -0.25 } },
  Nose: { k: 1.2, hands: [[1, 1, 0.8, 0]], skis: [{ y: 0.15 }, { y: 0.5, z: 0.15, rx: -0.95 }], torso: { x: 0.3 } },
  Blunt: { k: 1.4, hands: [[1, 1, -0.8, 0]], skis: [{ y: 0.2 }, { y: 0.55, z: -0.1, rx: 0.95 }], torso: { x: -0.1, y: 0.4 } },
  Critical: { k: 1.4, hands: [[1, 0, -0.25, 0.06]], skis: [{ y: 0.45, z: -0.3, rx: 0.3, ry: -0.2 }, { y: 0.2 }], torso: { y: -0.45 } },
  Seatbelt: { k: 1.3, hands: [[0, 1, -0.55, 0.06]], skis: [{ y: 0.2 }, { y: 0.4, z: 0.25, rx: -0.6 }], torso: { y: -0.5, x: 0.2 } },
};
const STYLES = {
  'Iron Cross': { k: 1, crouch: 0.3, hands: [[0, 'out'], [1, 'out']], skis: [{ y: 0.15, rx: 0.25, ry: -0.55 }, { y: 0.15, rx: 0.25, ry: 0.55 }], torso: {} },
  'Spread Eagle': { k: 1.1, crouch: 0.05, hands: [[0, 'up'], [1, 'up']], skis: [{ x: 0.5, y: 0.2, rz: 0.7 }, { x: -0.5, y: 0.2, rz: -0.7 }], torso: { x: -0.15 } },
  Daffy: { k: 1.2, crouch: 0.25, hands: [[0, 'out'], [1, 'out']], skis: [{ y: 0.15, z: 0.5, rx: -0.55 }, { y: 0.25, z: -0.5, rx: 0.6 }], torso: {} },
  Backscratcher: { k: 1.2, crouch: 0.45, hands: [[0, 'up'], [1, 'up']], skis: [{ y: 0.55, z: -0.35, rx: 1.25 }, { y: 0.55, z: -0.35, rx: 1.25 }], torso: { x: -0.3 } },
};
export const GRAB_NAMES = Object.keys(GRABS), STYLE_NAMES = Object.keys(STYLES);

// Eight stick directions plus centre pick the grab.
function grabName(x, y) {
  if (Math.hypot(x, y) < 0.4) return 'Safety';
  const a = Math.atan2(-y, x) / (Math.PI / 4);
  const i = ((Math.round(a) % 8) + 8) % 8;
  return ['Truck Driver', 'Critical', 'Mute', 'Nose', 'Japan', 'Blunt', 'Tail', 'Seatbelt'][i];
}
function styleName(x, y) {
  if (Math.hypot(x, y) < 0.4) return 'Iron Cross';
  if (Math.abs(x) > Math.abs(y)) return 'Spread Eagle';
  return y < 0 ? 'Daffy' : 'Backscratcher';
}

// ---------- skier ----------

const X = new THREE.Vector3(1, 0, 0);
const sk = (side) => ({ x: side * 0.13, y: 0.02, z: 0, rx: 0, ry: 0, rz: 0 });
const POP_KINDS = ['tuck', 'stretch', 'kick'];

export class Skier {
  constructor(scene) {
    this.model = buildModel();
    scene.add(this.model.root);
    this.p = new THREE.Vector3();
    this.v = new THREE.Vector3();
    this.q = new THREE.Quaternion();      // body orientation while airborne
    this.renderQ = new THREE.Quaternion();
    this.pivotUp = new THREE.Vector3(0, 1, 0); // body up at takeoff; air spins turn around a point this far up
    this.heading = 0;                     // direction of travel along the snow
    this.switch = false;                  // riding backwards
    this.wallF = null;                    // travel direction while on a pipe wall
    this.state = 'ground';
    this.crouch = 0.25;
    this.charge = 0;
    this.lean = 0;
    this.skid = 0;
    this.scrub = 0;                       // how much snow the skis throw, for spray and sound
    this.events = [];                     // drained by main: takeoff, land, crash, grind...
    this.air = null;
    this.grind = null;
    this.press = null;
    this.tuck = false;
    this.crashT = 0;
    this.time = 0;
    this.popCount = 0;
    this.landAnim = null;
    this.pose = {
      crouch: 0.25, tx: 0.3, ty: 0, tz: 0, press: 0,
      skis: [sk(1), sk(-1)],
      hands: [new THREE.Vector3(0.34, 0.9, 0.35), new THREE.Vector3(-0.34, 0.9, 0.35)],
      poles: [new THREE.Vector3(0.1, -0.75, -0.65), new THREE.Vector3(-0.1, -0.75, -0.65)],
    };

    const shadowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const r = g.createRadialGradient(32, 32, 2, 32, 32, 32);
      r.addColorStop(0, 'rgba(20,30,60,0.55)'); r.addColorStop(1, 'rgba(20,30,60,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    scene.add(this.shadow);
  }

  spawn(x, z, heading = 0, speed = 0) {
    this.p.set(x, height(x, z), z);
    this.v.set(Math.sin(heading) * speed, 0, Math.cos(heading) * speed);
    this.v.addScaledVector(normal(x, z, v1), -this.v.dot(v1));
    this.heading = heading;
    this.switch = false;
    this.wallF = null;
    this.state = 'ground';
    this.air = this.grind = this.press = this.landAnim = null;
    this.charge = 0;
    this.groundQuat(this.renderQ);
    this.pivotUp.set(0, 1, 0).applyQuaternion(this.renderQ);
  }

  get speed() { return this.v.length(); }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  groundQuat(out) {
    const n = normal(this.p.x, this.p.z, v1.clone());
    const f = this.wallF ? this.wallF.clone() : new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    if (this.switch) f.negate();
    return basisQuat(n, f.addScaledVector(n, -f.dot(n)).normalize(), out);
  }

  // input: { x, y, jump, grab, style, tuck, jumpReleased }
  step(dt, input) {
    this.time += dt;
    if (this.landAnim && (this.landAnim.t += dt) > 0.6) this.landAnim = null;
    if (this.state === 'ground') this.stepGround(dt, input);
    else if (this.state === 'air') this.stepAir(dt, input);
    else if (this.state === 'grind') this.stepGrind(dt, input);
    else this.stepCrash(dt);
  }

  // Hold STYLE on the snow to press: nose press, or tail press with the stick pulled back.
  updatePress(dt, input, speed) {
    if (input.style && !this.press && speed > 3) {
      this.press = { t: 0, nose: input.y <= 0.3 };
      this.emit('press', { name: this.press.nose ? 'Nose Press' : 'Tail Press' });
    }
    if (this.press) {
      if (input.style && speed > 1.5) this.press.t += dt;
      else this.endPress();
    }
  }

  endPress() {
    const p = this.press;
    if (!p) return;
    this.press = null;
    this.emit('pressEnd', { name: p.nose ? 'Nose Press' : 'Tail Press', time: p.t });
  }

  // Pop: the take-off animation changes from jump to jump.
  pop(n) {
    const pop = 3.4 + this.charge * 5;
    this.v.addScaledVector(n, pop * 0.7).addScaledVector(Y, pop * 0.3);
    this.popKind = this.press ? (this.press.nose ? 'kick' : 'tuck') : this.charge >= 0.5 ? 'tuck' : POP_KINDS[this.popCount++ % 3];
    this.endPress();
    this.charge = 0;
    this.takeoff(true);
    this.p.addScaledVector(this.v, 1 / 120);
  }

  // The slope the skis are on, sampled a little behind them so a sharp lip
  // throws the skier into the air instead of bending them down its far side.
  surfaceNormal() {
    const h = Math.hypot(this.v.x, this.v.z);
    const k = h > 0.5 ? 0.3 / h : 0;
    return normal(this.p.x - this.v.x * k, this.p.z - this.v.z * k, new THREE.Vector3());
  }

  stepGround(dt, input) {
    const n = this.surfaceNormal();
    if (n.y < 0.8 && inPipe(this.p.x, this.p.z, 2)) { this.stepWall(dt, input, n); return; }
    this.wallF = null;
    const speed = this.v.length();
    const tuck = (input.y < -0.35 || input.tuck) && speed > 5;
    this.tuck = tuck;
    const brake = input.y > 0.3 && !this.press ? (input.y - 0.3) / 0.7 : 0;
    this.updatePress(dt, input, speed);

    const turn = (2.1 - Math.min(speed, 28) / 28 * 0.9) * (tuck ? 0.55 : 1) * (1 + brake * 0.4);
    this.heading -= input.x * turn * dt;

    const fH = v1.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    const f = fH.clone().addScaledVector(n, -fH.dot(n)).normalize();
    const l = new THREE.Vector3().crossVectors(n, f);

    this.v.y -= G * dt;
    const vn = this.v.dot(n);
    const vf = this.v.dot(f), vl = this.v.dot(l);
    const grip = 7 - brake * 3.5;
    const newL = vl * Math.exp(-grip * dt);
    const removed = Math.abs(vl) - Math.abs(newL);
    const spd = Math.hypot(vf, newL);
    const drag = tuck ? 0.0028 : 0.005;
    const pipe = inPipe(this.p.x, this.p.z, 2);
    let loss = removed * ((pipe ? 0.08 : 0.25) + brake * 0.75) + (0.028 * G * n.y + drag * spd * spd + brake * 8) * dt;
    let newSpd = Math.max(0, spd - loss);
    // Skating: push forward when slow.
    let push = 0;
    if ((input.y < -0.35 || input.tuck) && spd < 7) push = 3.2 * dt;
    const scale = spd > 1e-4 ? newSpd / spd : 0;
    const vt = f.clone().multiplyScalar(vf * scale).addScaledVector(l, newL * scale);
    if (push) vt.addScaledVector(f, push);
    this.v.copy(vt).addScaledVector(n, vn);

    this.scrub = Math.min(1, removed / dt / 14 + brake * Math.min(1, spd / 8) + (this.press ? 0.25 : 0));
    this.lean += ((-input.x * Math.min(1, spd / 10) * 0.45) - this.lean) * (1 - Math.exp(-8 * dt));
    this.skid += ((brake * Math.min(1, spd / 4) * 1.1) - this.skid) * (1 - Math.exp(-6 * dt));

    // Crouch to load a jump.
    let target = tuck ? 0.8 : this.press ? 0.35 : 0.22 + brake * 0.2;
    if (input.jump) { this.charge = Math.min(0.5, this.charge + dt); target = 0.75; }
    this.crouch += (target - this.crouch) * (1 - Math.exp(-10 * dt));

    if (input.jumpReleased && this.charge > 0) { this.pop(n); return; }
    if (!input.jump) this.charge = 0;

    this.p.addScaledVector(this.v, dt);
    const gy = height(this.p.x, this.p.z);
    if (this.p.y > gy + 0.004) {
      this.endPress();
      this.takeoff(false);
      return;
    }
    this.p.y = gy;
    const n2 = this.surfaceNormal();
    const into = this.v.dot(n2);
    // Running into a wall (the face of a step-up, the far side of a gap) is a crash.
    if (into < -7 && n2.y < 0.6) { this.crash('Bonk'); return; }
    this.v.addScaledVector(n2, -into);

    this.checkRails(true);
    if (this.state === 'ground') this.checkObstacles();
  }

  // Riding the steep part of the halfpipe: the skis simply follow the
  // direction of travel and gravity does the rest.
  stepWall(dt, input, n) {
    this.tuck = false;
    this.endPress();
    this.v.y -= G * dt;
    const vn = this.v.dot(n);
    const vt = this.v.clone().addScaledVector(n, -vn);
    const spd = vt.length();
    if (spd > 0.5) vt.applyAxisAngle(n, -input.x * 1.2 * dt);
    // Pumping the transition on the way down gives back a little speed.
    const gain = this.v.y < 0 ? 1.6 * dt : 0;
    const loss = (0.02 * G * Math.max(0, n.y) + 0.004 * spd * spd) * dt - gain;
    if (spd > 1e-4) vt.multiplyScalar(Math.max(0, spd - loss) / spd);
    this.v.copy(vt).addScaledVector(n, vn);
    if (spd > 0.6) {
      const dir = vt.clone().normalize();
      if (this.wallF && dir.dot(this.wallF) < -0.3) this.switch = !this.switch; // came back down backwards
      this.wallF = dir;
      if (Math.hypot(dir.x, dir.z) > 0.2) this.heading = Math.atan2(dir.x, dir.z);
    }
    this.scrub = 0.12;
    this.lean *= Math.exp(-6 * dt);
    this.skid *= Math.exp(-6 * dt);
    let target = 0.45;
    if (input.jump) { this.charge = Math.min(0.5, this.charge + dt); target = 0.75; }
    this.crouch += (target - this.crouch) * (1 - Math.exp(-10 * dt));
    if (input.jumpReleased && this.charge > 0) { this.pop(n); return; }
    if (!input.jump) this.charge = 0;

    this.p.addScaledVector(this.v, dt);
    const gy = height(this.p.x, this.p.z);
    if (this.p.y > gy + 0.004) { this.takeoff(false); return; }
    this.p.y = gy;
    const n2 = normal(this.p.x, this.p.z, v2);
    this.v.addScaledVector(n2, -this.v.dot(n2));
  }

  takeoff(popped) {
    const vh = v1.set(this.v.x, 0, this.v.z);
    const dir = vh.lengthSq() > 0.01 ? vh.normalize().clone() : new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const n = normal(this.p.x, this.p.z, new THREE.Vector3());
    this.state = 'air';
    this.groundQuat(this.q);
    this.air = {
      t: 0, total: 0, off: 0, flip: 0, spinRate: 0, flipRate: 0,
      switchTakeoff: this.switch, grabs: [], grab: null, popped,
      left: new THREE.Vector3().crossVectors(Y, dir), fromSlide: false,
      pipe: n.y < 0.85 && inPipe(this.p.x, this.p.z, 2), side: Math.sign(this.p.x - PIPE.x) || 1,
    };
    if (this.air.pipe) {
      // In the pipe the body leans with the wall on the way up and back down.
      // Spins happen in an upright frame (qb) that the lean is applied on top of.
      const a = this.air;
      a.vy0 = Math.max(1.5, this.v.y);
      a.tilt = new THREE.Quaternion().setFromUnitVectors(Y, n);
      a.qb = a.tilt.clone().invert().multiply(this.q);
    }
    if (!popped) this.popKind = null;
    this.wallF = null;
    this.emit('takeoff', { popped });
  }

  stepAir(dt, input) {
    const a = this.air;
    a.t += dt;
    if (input.jumpReleased && !a.popped && a.t < 0.18 && this.charge > 0) {
      // Late pop off a lip still counts.
      this.v.y += 2.5 + this.charge * 4;
      a.popped = true;
      this.popKind = POP_KINDS[this.popCount++ % 3];
    }
    if (!input.jump) this.charge = 0;

    const dz = (x) => (Math.abs(x) < 0.22 ? 0 : (x - Math.sign(x) * 0.22) / 0.78);
    const sx = dz(input.x), sy = dz(input.y);
    const slow = a.grab ? 0.8 : 1;
    const k = 1 - Math.exp(-12 * dt);
    a.spinRate += (-sx * SPIN_MAX * slow - a.spinRate) * k;
    a.flipRate += (-sy * FLIP_MAX * slow - a.flipRate) * k;
    const w = v1.copy(Y).multiplyScalar(a.spinRate).addScaledVector(a.left, a.flipRate);
    const wl = w.length();
    if (wl > 1e-4) {
      q1.setFromAxisAngle(w.clone().divideScalar(wl), wl * dt);
      (a.pipe ? a.qb : this.q).premultiply(q1);
      a.total += wl * dt;
      a.off += Math.acos(Math.min(1, Math.abs(a.spinRate) / wl)) * wl * dt;
      a.flip += a.flipRate * dt;
    }
    const up = v2.copy(Y).applyQuaternion(this.q);
    if (a.pipe) {
      // Halfpipe: drift back over the coping, stand up on the way up and lay
      // back into the wall on the way down.
      const side = a.side, d = (this.p.x - PIPE.x) * side;
      if (d > PIPE.lipD - 2.5 && this.v.x * side > -0.9) this.v.x += (-0.9 * side - this.v.x) * (1 - Math.exp(-5 * dt));
      if (this.v.y < 0 && Math.abs(sx) + Math.abs(sy) < 0.05) {
        // Landing assist: turn (in the upright frame) so the skis point down
        // the wall when we touch it, forward or fakie, whichever is closer.
        const n0 = v3.set(0, 1, 0).applyQuaternion(a.tilt);
        const d = this.v.clone().addScaledVector(n0, -this.v.dot(n0)).applyQuaternion(a.tilt.clone().invert()).setY(0);
        const fb = new THREE.Vector3(0, 0, 1).applyQuaternion(a.qb).setY(0);
        if (d.lengthSq() > 0.01 && fb.lengthSq() > 0.01) {
          d.normalize().multiplyScalar(Math.sign(fb.dot(d)) || 1);
          a.qb.slerp(basisQuat(Y, d, new THREE.Quaternion()), 1 - Math.exp(-6 * dt));
        }
      }
      const lean = Math.min(1, Math.abs(this.v.y) / a.vy0);
      this.q.copy(new THREE.Quaternion().slerp(a.tilt, lean)).multiply(a.qb);
    } else if (Math.abs(sx) + Math.abs(sy) < 0.05 && up.y > 0.6) {
      // Landing assist: with the stick centred, settle toward an upright stance.
      const fwd = v3.copy(Z).applyQuaternion(this.q).setY(0);
      if (fwd.lengthSq() > 0.01) {
        fwd.normalize();
        // Also line the skis up with the direction of travel, forward or switch.
        const travel = new THREE.Vector3(this.v.x, 0, this.v.z);
        if (travel.lengthSq() > 1) {
          travel.normalize();
          const d = fwd.dot(travel);
          if (Math.abs(d) > 0.45) fwd.copy(travel).multiplyScalar(Math.sign(d));
        }
        const target = basisQuat(Y, fwd.clone(), new THREE.Quaternion());
        this.q.slerp(target, 1 - Math.exp(-5 * dt));
      }
    }

    // Grabs (GRAB) and style moves (STYLE); the stick picks which one.
    if (!a.grab && a.t > 0.06 && (input.grab || input.style)) {
      const style = !input.grab;
      a.grab = { name: style ? styleName(input.x, input.y) : grabName(input.x, input.y), t: 0, style };
      a.grabs.push(a.grab);
      this.emit('grab', { name: a.grab.name });
    }
    if (a.grab) {
      if (a.grab.style ? input.style : input.grab) a.grab.t += dt; else a.grab = null;
    }
    const ct = a.grab ? (a.grab.style ? STYLES[a.grab.name].crouch : 1) : 0.45;
    this.crouch += (ct - this.crouch) * (1 - Math.exp(-10 * dt));

    this.v.y -= G * dt;
    this.v.multiplyScalar(1 - 0.0016 * this.v.length() * dt);
    this.p.addScaledVector(this.v, dt);
    this.scrub = 0;

    this.checkRails(false);
    if (this.state !== 'air') return;
    if (this.checkObstacles()) return;
    const gy = height(this.p.x, this.p.z);
    if (this.p.y <= gy) {
      this.p.y = gy;
      this.land();
    }
  }

  land() {
    const a = this.air;
    const n = normal(this.p.x, this.p.z, new THREE.Vector3());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.q);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.q);
    const impact = -this.v.dot(n);
    const vt = this.v.clone().addScaledVector(n, -this.v.dot(n));
    const speed = vt.length();
    const vdir = speed > 0.5 ? vt.clone().divideScalar(speed) : fwd.clone().addScaledVector(n, -fwd.dot(n)).normalize();
    const fp = fwd.clone().addScaledVector(n, -fwd.dot(n));
    const flat = fp.length();
    fp.normalize();
    const align = fp.dot(vdir);
    const upDot = up.dot(n);
    const trick = nameTrick(a);
    if (upDot < 0.55 || flat < 0.35 || Math.abs(align) < 0.6 || impact > 17) {
      this.crash(impact > 17 ? 'Too hard' : 'Wipeout');
      return;
    }
    this.switch = align < 0;
    const axis = this.switch ? fp.clone().negate() : fp;
    this.wallF = n.y < 0.8 && inPipe(this.p.x, this.p.z, 2) ? vdir.clone() : null;
    if (Math.hypot(vdir.x, vdir.z) > 0.2) this.heading = Math.atan2(vdir.x, vdir.z);
    else this.heading = Math.atan2(axis.x, axis.z);
    const keep = 1 - 0.25 * (1 - Math.abs(align)) - Math.max(0, impact - 6) * 0.012;
    this.v.copy(vt).multiplyScalar(keep);
    this.state = 'ground';
    this.crouch = Math.min(1, 0.4 + impact * 0.05);
    this.lean = 0;
    const clean = upDot > 0.92 && Math.abs(align) > 0.94;
    const sketchy = !!a.grab || upDot < 0.75 || Math.abs(align) < 0.8;
    this.air = null;
    if (a.t > 0.3) this.landAnim = { t: 0, kind: sketchy ? 'windmill' : 'stomp' };
    this.emit('land', { trick, clean, sketchy, impact, airtime: a.t });
  }

  checkRails(grounded) {
    for (const r of rails) {
      const ax = this.p.x - r.a.x, az = this.p.z - r.a.z;
      const dx = r.b.x - r.a.x, dzz = r.b.z - r.a.z;
      const L2 = dx * dx + dzz * dzz;
      const t = (ax * dx + az * dzz) / L2;
      if (t < 0 || t > 1) continue;
      const lat = Math.abs(ax * dzz - az * dx) / Math.sqrt(L2);
      if (lat > r.w / 2 + 0.35) continue;
      const ry = r.a.y + (r.b.y - r.a.y) * t;
      const dy = this.p.y - ry;
      if (grounded) {
        if (dy < -0.12 && dy > -1.4) {
          if (r.kind === 'box' && t < 0.15 && this.speed > 4) { this.startGrind(r, t); return; }
          if (lat < r.w / 2 + 0.2) { this.crash('Bonk'); return; }
        }
        continue;
      }
      if (this.v.y <= 0.3 && dy < 0.25 && dy > -0.45 && t < 0.97) { this.startGrind(r, t); return; }
      // Flying into the side of a rail or box below its top.
      if (dy <= -0.45 && dy > -r.h - 0.15 && lat < r.w / 2 + 0.15) { this.crash('Bonk'); return; }
    }
  }

  startGrind(r, t) {
    this.endPress();
    const along = this.v.dot(r.dir);
    const sign = along >= 0 ? 1 : -1;
    const travel = r.dir.clone().multiplyScalar(sign);
    const body = new THREE.Vector3(0, 0, 1).applyQuaternion(this.state === 'air' ? this.q : this.groundQuat(new THREE.Quaternion()));
    const th = Math.atan2(body.x, body.z) - Math.atan2(travel.x, travel.z);
    const snap = Math.round(th / (Math.PI / 2));
    const slide = Math.abs(snap) % 2 === 1;
    const prevAir = this.air;
    this.state = 'grind';
    this.grind = {
      r, s: t * r.len, u: Math.max(3, Math.abs(along)) * sign, t: 0,
      yaw: Math.atan2(travel.x, travel.z) + snap * Math.PI / 2, slide,
      name: (r.kind === 'box' ? 'Box ' : 'Rail ') + (slide ? 'Slide' : '50-50'),
      airTrick: prevAir && prevAir.t > 0.25 ? nameTrick(prevAir) : null,
    };
    this.air = null;
    this.emit('grind', { name: this.grind.name, airTrick: this.grind.airTrick });
  }

  stepGrind(dt, input) {
    const g = this.grind, r = g.r;
    g.t += dt;
    g.u += -G * r.dir.y * dt;
    g.u -= Math.sign(g.u) * 1.2 * dt;
    g.s += g.u * dt;
    this.p.copy(r.a).addScaledVector(r.dir, g.s);
    this.v.copy(r.dir).multiplyScalar(g.u);
    this.crouch += (0.45 - this.crouch) * (1 - Math.exp(-10 * dt));
    this.lean = Math.sin(this.time * 7) * 0.05 + input.x * -0.15;
    const fwd = new THREE.Vector3(Math.sin(g.yaw), 0, Math.cos(g.yaw));
    basisQuat(Y, fwd, this.q);
    const done = g.s < 0 || g.s > r.len || Math.abs(g.u) < 0.4;
    if (done || input.jumpReleased) {
      if (input.jumpReleased) this.v.y += 4;
      this.v.y = Math.max(this.v.y, 0.5);
      this.emit('grindEnd', { name: g.name, time: g.t });
      this.state = 'air';
      this.charge = 0;
      this.popKind = input.jumpReleased ? POP_KINDS[this.popCount++ % 3] : null;
      const vh = new THREE.Vector3(this.v.x, 0, this.v.z).normalize();
      const travel = new THREE.Vector3(Math.sin(g.yaw), 0, Math.cos(g.yaw));
      this.air = {
        t: 0, total: 0, off: 0, flip: 0, spinRate: 0, flipRate: 0,
        switchTakeoff: travel.dot(vh) < -0.5, grabs: [], grab: null, popped: true,
        left: new THREE.Vector3().crossVectors(Y, vh), fromSlide: g.slide, pipe: false, side: 1,
      };
      this.p.y += 0.05;
      this.grind = null;
    }
  }

  checkObstacles() {
    const o = obstacleHit(this.p.x, this.p.y, this.p.z);
    if (!o) return false;
    const cx = o.kind === 'box' ? (o.x0 + o.x1) / 2 : o.x, cz = o.kind === 'box' ? (o.z0 + o.z1) / 2 : o.z;
    const away = new THREE.Vector3(this.p.x - cx, 0, this.p.z - cz);
    if (away.lengthSq() < 1e-4) away.set(1, 0, 0);
    away.normalize();
    const r = o.kind === 'box' ? Math.hypot(o.x1 - o.x0, o.z1 - o.z0) / 2 : o.kind === 'tree' ? 1.6 * o.s : o.kind === 'rock' ? o.s : o.r;
    this.p.x = cx + away.x * (r + 1.2);
    this.p.z = cz + away.z * (r + 1.2);
    this.crash(o.kind === 'tree' ? 'Tree!' : o.kind === 'rock' ? 'Rock!' : 'Bonk');
    return true;
  }

  crash(reason) {
    this.state = 'crash';
    this.crashT = 0;
    this.air = this.grind = this.press = this.landAnim = null;
    this.wallF = null;
    this.tumbleAxis = new THREE.Vector3(Math.random() - 0.5, 0.3, Math.random() - 0.5).normalize();
    this.emit('crash', { reason });
  }

  stepCrash(dt) {
    this.crashT += dt;
    this.v.y -= G * dt;
    const vh = new THREE.Vector3(this.v.x, 0, this.v.z);
    vh.multiplyScalar(Math.exp(-2.2 * dt));
    this.v.x = vh.x; this.v.z = vh.z;
    this.p.addScaledVector(this.v, dt);
    const gy = height(this.p.x, this.p.z);
    if (this.p.y < gy) { this.p.y = gy; this.v.y = Math.max(0, -this.v.y * 0.25); }
    this.scrub = Math.min(1, vh.length() / 10);
    if (this.crashT > 1.7) {
      let h = vh.lengthSq() > 0.5 ? Math.atan2(vh.x, vh.z) * 0.3 : 0;
      for (const r of rails) {
        // Don't respawn standing inside a rail or box.
        const lat = Math.abs(this.p.x - (r.a.x + r.b.x) / 2);
        if (lat < 1.2 && this.p.z > r.a.z - 1 && this.p.z < r.b.z + 1) this.p.x += 1.6 * Math.sign(this.p.x - r.a.x || 1);
      }
      // In the pipe, get back up on the flat bottom facing down it.
      if (inPipe(this.p.x, this.p.z, 4)) { this.p.x = PIPE.x + Math.sign(this.p.x - PIPE.x) * 2; h = 0; }
      this.spawn(this.p.x, this.p.z, h);
      this.emit('respawn');
    }
  }

  // ---------- animation ----------

  // What the body should be doing right now. Hands are either a point in the
  // skier's own space or a point on one of the skis.
  poseTargets() {
    const c = this.state === 'crash' ? 0.9 : this.crouch;
    const hipY = 0.97 - c * 0.42;
    const sw = this.switch ? -1 : 1;
    const T = {
      crouch: c, tx: 0.15 + c * 0.55, ty: 0, tz: 0, press: 0, rate: 14,
      skis: [sk(1), sk(-1)],
      hands: [new THREE.Vector3(0.34, hipY + 0.15, 0.35), new THREE.Vector3(-0.34, hipY + 0.15, 0.35)],
      poles: [new THREE.Vector3(0.1, -0.75, -0.65), new THREE.Vector3(-0.1, -0.75, -0.65)],
    };
    const both = (fn) => { for (let i = 0; i < 2; i++) fn(i ? -1 : 1, i); };
    const t = this.time;

    if (this.state === 'ground') {
      both((s, i) => { T.skis[i].ry = this.skid * 0.8 * sw; });
      if (this.tuck) {
        both((s, i) => { T.hands[i].set(s * 0.12, hipY + 0.25, 0.5); T.poles[i].set(s * 0.05, -0.15, -1); });
      }
      if (this.press) {
        T.press = this.press.nose ? 0.22 : -0.26;
        T.tx += this.press.nose ? 0.3 : -0.25;
        both((s, i) => T.hands[i].set(s * 0.65, hipY + 0.4, 0.05));
      }
      const L = this.landAnim;
      if (L && L.kind === 'windmill') {
        both((s, i) => T.hands[i].set(s * 0.6, hipY + 0.5 + 0.35 * Math.sin(L.t * 14 + s), 0.35 * Math.cos(L.t * 14 + s)));
      } else if (L) {
        both((s, i) => T.hands[i].set(s * 0.3, hipY + 0.1, 0.45));
      }
    } else if (this.state === 'grind') {
      both((s, i) => { T.hands[i].set(s * 0.7, hipY + 0.45, 0.1); T.poles[i].set(s * 0.5, -0.7, -0.3); });
    } else if (this.state === 'crash') {
      both((s, i) => {
        T.hands[i].set(s * 0.7, hipY + 0.4 + 0.4 * Math.sin(t * 13 + s * 2), 0.3 * Math.cos(t * 11 + s));
        T.skis[i].ry = s * 0.5 * Math.sin(t * 5);
      });
    } else if (this.state === 'air') {
      const a = this.air, g = a.grab;
      both((s, i) => { T.skis[i].y += 0.18; T.hands[i].set(s * 0.5, hipY + 0.45, 0.2); T.poles[i].set(s * 0.4, -0.6, -0.6); });
      if (g) {
        const def = g.style ? STYLES[g.name] : GRABS[g.name];
        const k = Math.min(1, g.t / 0.12), tw = 1 + Math.min(1, g.t / 0.7) * 0.4; // tweak it the longer you hold
        T.rate = 22;
        def.skis.forEach((o, i) => { for (const key in o) T.skis[i][key] += o[key] * k * tw; });
        T.tx += (def.torso.x || 0) * k; T.ty += (def.torso.y || 0) * k; T.tz += (def.torso.z || 0) * k;
        both((s, i) => T.hands[i].set(s * 0.6, hipY + 0.5, -0.1));
        for (const h of def.hands) {
          if (h[1] === 'out') T.hands[h[0]].set((h[0] ? -1 : 1) * 0.85, hipY + 0.55, 0.05);
          else if (h[1] === 'up') T.hands[h[0]].set((h[0] ? -1 : 1) * 0.45, hipY + 1.1, 0);
          else T.hands[h[0]] = { ski: h[1], z: h[2], x: h[3] };
        }
      } else if (this.popKind && a.t < 0.45) {
        const k = Math.sin(Math.min(1, a.t / 0.45) * Math.PI);
        if (this.popKind === 'tuck') { both((s, i) => { T.skis[i].y += 0.3 * k; }); T.crouch = Math.max(c, 0.6 + 0.35 * k); }
        if (this.popKind === 'stretch') { T.crouch = c * (1 - k); both((s, i) => T.hands[i].set(s * 0.35, hipY + 1.05, 0.15)); }
        if (this.popKind === 'kick') both((s, i) => { T.skis[i].rx -= 0.4 * k; T.skis[i].z += 0.12 * k; T.hands[i].set(s * 0.4, hipY + 0.2, -0.35); });
      }
    }
    return T;
  }

  render(dt) {
    const M = this.model;
    const target = new THREE.Quaternion();
    if (this.state === 'air' || this.state === 'grind') {
      target.copy(this.q);
      this.renderQ.copy(target);
    } else if (this.state === 'crash') {
      q1.setFromAxisAngle(this.tumbleAxis, dt * 9 * Math.max(0, 1 - this.crashT / 0.9));
      this.renderQ.premultiply(q1);
    } else {
      this.groundQuat(target);
      q1.setFromAxisAngle(Z, this.switch ? -this.lean : this.lean);
      target.multiply(q1);
      this.renderQ.slerp(target, 1 - Math.exp(-18 * dt));
    }

    // Blend the pose toward its targets.
    const T = this.poseTargets(), P = this.pose;
    const k = 1 - Math.exp(-T.rate * dt);
    for (const key of ['crouch', 'tx', 'ty', 'tz', 'press']) P[key] += (T[key] - P[key]) * k;
    for (let i = 0; i < 2; i++) {
      for (const key in P.skis[i]) P.skis[i][key] += (T.skis[i][key] - P.skis[i][key]) * k;
      P.poles[i].lerp(T.poles[i], k);
    }

    // Spin and flip around the middle of the body, not the feet. On the snow the
    // pivot follows the body up, so the offset is zero there; in the air it stays
    // put, and it eases back after landing so there's no pop.
    const up = v1.set(0, 1, 0).applyQuaternion(this.renderQ);
    if (this.state === 'ground' || this.state === 'grind') this.pivotUp.lerp(up, 1 - Math.exp(-10 * dt)).normalize();
    M.root.position.copy(this.p).addScaledVector(this.pivotUp, PIVOT).addScaledVector(up, -PIVOT);
    M.root.quaternion.copy(this.renderQ);
    if (Math.abs(P.press) > 1e-3) {
      // Presses pivot on the tip or tail of the skis.
      const pivot = v1.set(0, 0, P.press > 0 ? 0.86 : -0.86);
      const before = pivot.clone().applyQuaternion(this.renderQ);
      q1.setFromAxisAngle(X, P.press);
      M.root.quaternion.multiply(q1);
      M.root.position.add(before.sub(pivot.applyQuaternion(M.root.quaternion)));
    }

    const hipY = 0.97 - P.crouch * 0.42;
    M.hips.position.y = hipY;
    M.torso.rotation.set(P.tx, P.ty, P.tz);
    M.head.rotation.x = -0.1 - P.crouch * 0.45;
    M.body.rotation.y = this.state === 'ground' ? this.skid * (this.switch ? -1 : 1) : 0;
    M.skis.forEach((ski, i) => {
      const s = P.skis[i];
      ski.position.set(s.x, s.y, s.z);
      ski.rotation.set(s.rx, s.ry, s.rz);
      ski.updateMatrix();
    });
    // Hands that hold a ski follow it exactly; free hands ease into place.
    for (let i = 0; i < 2; i++) {
      const h = T.hands[i];
      if (h.ski !== undefined) {
        const pt = new THREE.Vector3(h.x, 0.05, h.z).applyMatrix4(M.skis[h.ski].matrix);
        P.hands[i].lerp(pt, 1 - Math.exp(-30 * dt));
      } else P.hands[i].lerp(h, k);
    }
    M.root.updateMatrixWorld(true);

    const w = new THREE.Vector3(), wq = new THREE.Quaternion();
    for (let i = 0; i < 2; i++) {
      const leg = M.legs[i];
      M.hips.worldToLocal(M.skis[i].localToWorld(w.set(0, 0.09, 0)));
      twoBone(leg.thigh, leg.shin, w, 0.46, 0.46, v2.set(leg.side * 0.15, 0, 1));
      const arm = M.arms[i];
      M.torso.worldToLocal(M.root.localToWorld(w.copy(P.hands[i])));
      twoBone(arm.upper, arm.fore, w, 0.34, 0.36, v2.set(arm.side * 0.8, -0.2, -0.6));
      arm.upper.updateMatrixWorld(true);
      arm.fore.getWorldQuaternion(wq);
      w.copy(P.poles[i]).applyQuaternion(M.root.quaternion).normalize().applyQuaternion(wq.invert());
      arm.pole.quaternion.setFromUnitVectors(REST, w);
    }

    // Blob shadow on the ground (or rail) below.
    const gy = height(this.p.x, this.p.z);
    const above = Math.max(0, this.p.y - gy);
    const n = normal(this.p.x, this.p.z, v1);
    this.shadow.position.set(this.p.x, gy + 0.03, this.p.z);
    this.shadow.quaternion.setFromUnitVectors(Z, n);
    const fwd = v2.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    q1.setFromAxisAngle(n, Math.atan2(fwd.x, fwd.z));
    this.shadow.quaternion.premultiply(q1);
    this.shadow.material.opacity = Math.max(0.15, 1 - above / 14);
    const s = 1 + above * 0.05;
    this.shadow.scale.set(s, s, s);
  }
}
