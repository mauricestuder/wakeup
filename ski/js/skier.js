// The skier: a small rigged model, ground/air/rail physics and trick tracking.
import * as THREE from '../../game/vendor/three.module.min.js';
import { height, normal, rails, obstacleHit } from './terrain.js';

const G = 9.81;
const SPIN_MAX = 10.5;  // rad/s, about 600 degrees a second
const FLIP_MAX = 7.2;
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const DEG = 180 / Math.PI;

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

// Two-bone leg IK: hip above foot, knee bends forward.
function poseLeg(leg, hipY, footZ = 0) {
  const L = 0.46;
  const dy = hipY - 0.09, dz = footZ;
  const d = Math.min(2 * L - 0.001, Math.hypot(dy, dz));
  const bend = Math.acos(d / (2 * L));
  const aim = Math.atan2(dz, dy);
  leg.thigh.rotation.x = -bend - aim;
  leg.shin.rotation.x = 2 * bend;
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
    pts += 150 + g.t * 350;
  }
  if (!parts.length && air.t > 0.9) parts.push('Air');
  pts += air.t * 40;
  return { name: parts.join(' + '), points: Math.round(pts / 10) * 10 };
}

function grabName(x, y) {
  if (Math.hypot(x, y) < 0.4) return 'Safety';
  if (Math.abs(y) > Math.abs(x)) return y < 0 ? 'Mute' : 'Tail';
  return x < 0 ? 'Japan' : 'Truck Driver';
}

// ---------- skier ----------

export class Skier {
  constructor(scene) {
    this.model = buildModel();
    scene.add(this.model.root);
    this.p = new THREE.Vector3();
    this.v = new THREE.Vector3();
    this.q = new THREE.Quaternion();      // body orientation while airborne
    this.renderQ = new THREE.Quaternion();
    this.heading = 0;                     // direction the skis point along travel
    this.switch = false;
    this.state = 'ground';
    this.crouch = 0.25;
    this.charge = 0;
    this.lean = 0;
    this.skid = 0;
    this.scrub = 0;                       // how much snow the skis throw, for spray and sound
    this.events = [];                     // drained by main: takeoff, land, crash, grind...
    this.air = null;
    this.grind = null;
    this.crashT = 0;
    this.lastJumpRelease = -1;
    this.time = 0;

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
    this.state = 'ground';
    this.air = this.grind = null;
    this.charge = 0;
    this.groundQuat(this.renderQ);
  }

  get speed() { return this.v.length(); }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  groundQuat(out) {
    const n = normal(this.p.x, this.p.z, v1.clone());
    const f = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    if (this.switch) f.negate();
    return basisQuat(n, f.addScaledVector(n, -f.dot(n)).normalize(), out);
  }

  // input: { x, y, jump, grab, jumpReleased, grabPressed }
  step(dt, input) {
    this.time += dt;
    if (this.state === 'ground') this.stepGround(dt, input);
    else if (this.state === 'air') this.stepAir(dt, input);
    else if (this.state === 'grind') this.stepGrind(dt, input);
    else this.stepCrash(dt);
  }

  stepGround(dt, input) {
    const n = normal(this.p.x, this.p.z, new THREE.Vector3());
    const speed = this.v.length();
    const tuck = input.y < -0.35 && speed > 5;
    const brake = input.y > 0.3 ? (input.y - 0.3) / 0.7 : 0;

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
    let loss = removed * (0.25 + brake * 0.75) + (0.028 * G * n.y + drag * spd * spd + brake * 8) * dt;
    let newSpd = Math.max(0, spd - loss);
    // Skating: push forward when slow.
    let push = 0;
    if (input.y < -0.35 && spd < 7) push = 3.2 * dt;
    const scale = spd > 1e-4 ? newSpd / spd : 0;
    const vt = f.clone().multiplyScalar(vf * scale).addScaledVector(l, newL * scale);
    if (push) vt.addScaledVector(f, push);
    this.v.copy(vt).addScaledVector(n, vn);

    this.scrub = Math.min(1, removed / dt / 14 + brake * Math.min(1, spd / 8));
    this.lean += ((-input.x * Math.min(1, spd / 10) * 0.45) - this.lean) * (1 - Math.exp(-8 * dt));
    this.skid += ((brake * Math.min(1, spd / 4) * 1.1) - this.skid) * (1 - Math.exp(-6 * dt));

    // Crouch to load a jump.
    let target = tuck ? 0.8 : 0.22 + brake * 0.2;
    if (input.jump) { this.charge = Math.min(0.5, this.charge + dt); target = 0.75; }
    this.crouch += (target - this.crouch) * (1 - Math.exp(-10 * dt));

    if (input.jumpReleased && this.charge > 0) {
      const pop = 3.4 + this.charge * 5;
      this.v.addScaledVector(n, pop * 0.7).addScaledVector(Y, pop * 0.3);
      this.charge = 0;
      this.takeoff(true);
      this.p.addScaledVector(this.v, dt);
      return;
    }
    if (!input.jump) this.charge = 0;

    this.p.addScaledVector(this.v, dt);
    const gy = height(this.p.x, this.p.z);
    if (this.p.y > gy + 0.004) {
      this.takeoff(false);
      return;
    }
    this.p.y = gy;
    const n2 = normal(this.p.x, this.p.z, v2);
    this.v.addScaledVector(n2, -this.v.dot(n2));

    this.checkRails(true);
    if (this.state === 'ground') this.checkObstacles();
  }

  takeoff(popped) {
    const vh = v1.set(this.v.x, 0, this.v.z);
    const dir = vh.lengthSq() > 0.01 ? vh.normalize().clone() : new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.state = 'air';
    this.groundQuat(this.q);
    this.air = {
      t: 0, total: 0, off: 0, flip: 0, spinRate: 0, flipRate: 0,
      switchTakeoff: this.switch, grabs: [], grab: null, popped,
      left: new THREE.Vector3().crossVectors(Y, dir), fromSlide: false,
    };
    this.emit('takeoff', { popped });
  }

  stepAir(dt, input) {
    const a = this.air;
    a.t += dt;
    if (input.jumpReleased && !a.popped && a.t < 0.18 && this.charge > 0) {
      // Late pop off a lip still counts.
      this.v.y += 2.5 + this.charge * 4;
      a.popped = true;
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
      this.q.premultiply(q1);
      a.total += wl * dt;
      a.off += Math.acos(Math.min(1, Math.abs(a.spinRate) / wl)) * wl * dt;
      a.flip += a.flipRate * dt;
    }
    // Landing assist: with the stick centred, settle toward an upright stance.
    const up = v2.copy(Y).applyQuaternion(this.q);
    if (Math.abs(sx) + Math.abs(sy) < 0.05 && up.y > 0.6) {
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

    // Grabs
    if (input.grab && !a.grab && a.t > 0.06) {
      a.grab = { name: grabName(input.x, input.y), t: 0 };
      a.grabs.push(a.grab);
      this.emit('grab', { name: a.grab.name });
    }
    if (a.grab) {
      if (input.grab) a.grab.t += dt; else a.grab = null;
    }
    this.crouch += ((a.grab ? 1 : 0.45) - this.crouch) * (1 - Math.exp(-10 * dt));

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
    this.heading = Math.atan2(axis.x, axis.z);
    const keep = 1 - 0.25 * (1 - Math.abs(align)) - Math.max(0, impact - 6) * 0.012;
    this.v.copy(vt).multiplyScalar(keep);
    this.state = 'ground';
    this.crouch = Math.min(1, 0.4 + impact * 0.05);
    this.lean = 0;
    const clean = upDot > 0.92 && Math.abs(align) > 0.94;
    const sketchy = !!a.grab || upDot < 0.75 || Math.abs(align) < 0.8;
    this.air = null;
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
    }
  }

  startGrind(r, t) {
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
      const vh = new THREE.Vector3(this.v.x, 0, this.v.z).normalize();
      const travel = new THREE.Vector3(Math.sin(g.yaw), 0, Math.cos(g.yaw));
      this.air = {
        t: 0, total: 0, off: 0, flip: 0, spinRate: 0, flipRate: 0,
        switchTakeoff: travel.dot(vh) < -0.5, grabs: [], grab: null, popped: true,
        left: new THREE.Vector3().crossVectors(Y, vh), fromSlide: g.slide,
      };
      this.p.y += 0.05;
      this.grind = null;
    }
  }

  checkObstacles() {
    const o = obstacleHit(this.p.x, this.p.y, this.p.z);
    if (!o) return false;
    const away = new THREE.Vector3(this.p.x - o.x, 0, this.p.z - o.z).normalize();
    this.p.x = o.x + away.x * (o.r + 1.2);
    this.p.z = o.z + away.z * (o.r + 1.2);
    this.crash(o.top - height(o.x, o.z) > 2 ? 'Tree!' : 'Rock!');
    return true;
  }

  crash(reason) {
    this.state = 'crash';
    this.crashT = 0;
    this.air = this.grind = null;
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
      const h = vh.lengthSq() > 0.5 ? Math.atan2(vh.x, vh.z) * 0.3 : 0;
      for (const r of rails) {
        // Don't respawn standing inside a rail or box.
        const lat = Math.abs(this.p.x - (r.a.x + r.b.x) / 2);
        if (lat < 1.2 && this.p.z > r.a.z - 1 && this.p.z < r.b.z + 1) this.p.x += 1.6 * Math.sign(this.p.x - r.a.x || 1);
      }
      this.spawn(this.p.x, this.p.z, h);
      this.emit('respawn');
    }
  }

  // ---------- render ----------

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
    M.root.position.copy(this.p);
    M.root.quaternion.copy(this.renderQ);

    // Body pose
    const c = this.state === 'crash' ? 0.9 : this.crouch;
    const hipY = 0.97 - c * 0.42;
    M.hips.position.y = hipY;
    for (const leg of M.legs) poseLeg(leg, hipY, 0.0);
    M.torso.rotation.x = 0.15 + c * 0.55;
    M.head.rotation.x = -0.1 - c * 0.45;
    M.body.rotation.y = this.state === 'ground' ? this.skid * (this.switch ? -1 : 1) : 0;
    for (const s of M.skis) s.rotation.y = this.state === 'ground' ? this.skid * 0.8 * (this.switch ? -1 : 1) : 0;
    const grab = this.state === 'air' && this.air.grab;
    for (const arm of M.arms) {
      const reach = grab && (arm.side > 0 || this.air.grab.name === 'Truck Driver' || this.air.grab.name === 'Mute');
      if (reach) {
        arm.upper.rotation.set(1.1, 0, 0);
        arm.fore.rotation.set(0.6, 0, 0);
        arm.pole.rotation.x = 1.6;
      } else {
        arm.upper.rotation.set(0.35 + c * 0.4, 0, -arm.side * 0.25);
        arm.fore.rotation.set(-0.7 - c * 0.3, 0, 0);
        arm.pole.rotation.x = 1.1 + c * 0.3;
      }
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
