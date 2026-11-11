// The player: movement, the over-the-shoulder camera and the character model.

import * as THREE from '../../game/vendor/three.module.min.js';
import { T } from './tuning.js';
import { makeBody, STAND, CROUCH } from './collide.js';
import { settings } from './settings.js';
import * as input from './input.js';
import { sfx } from './audio.js';

const SUIT = 0x1f8f96, SUIT2 = 0x176a72, DARK = 0x16323a, TRIM = 0xffb23e, SHELL = 0xeef2f5, VISOR = 0x10202c,
  METAL = 0x39424e, STEEL = 0xc3ccd6, WOOD = 0x7a5238, OLIVE = 0x4b5a3a;

// Limb lengths: upper arm, forearm, thigh, shin, and the sole under the ankle.
const UA = 0.3, FA = 0.29, TL = 0.42, SL = 0.4, SOLE = 0.075;
const STANDING = TL + SL + SOLE;
// The figure is modelled 1.8 tall and shrunk to the body's real height.
const SCALE = STAND / 1.8, EYE = STAND - 0.22, EYE_LOW = CROUCH - 0.1;

// What the hands hold. `at` is where the grip sits (seen from the hips), `r`
// and `l` are where the right and left hand go on the tool, `twist` turns the
// chest for a gun stance, `muzzle` is how far the barrel reaches.
const TOOLS = {
  brk: { at: [0.14, 0.38, -0.16], r: [0, 0, 0], l: [0, 0.02, -0.3], twist: -0.35, muzzle: -0.62 },
  rng: { at: [0.14, 0.38, -0.16], r: [0, 0, 0], l: [0, 0.01, -0.3], twist: -0.35, muzzle: -0.66 },
  hrn: { at: [0.14, 0.38, -0.2], r: [0, 0, 0], l: [0, -0.02, -0.2], twist: -0.3, muzzle: -0.36 },
  pick: { at: [0.3, 0.36, -0.2], r: [0, 0, 0], l: null, twist: 0, muzzle: -0.3 },
  plan: { at: [0, 0.34, -0.38], r: [0.17, 0, 0.03], l: [-0.17, 0, 0.03], twist: 0, muzzle: -0.2 },
};

// A rounded figure facing -z, standing on y = 0. Arms and legs each have two
// joints; the hands are steered to the tool with a small two-bone solver.
function buildModel() {
  const mats = {};
  const mat = (color) => mats[color] || (mats[color] = new THREE.MeshLambertMaterial({ color, transparent: true }));
  const add = (parent, geo, color, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const group = (parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const cap = (r, len) => new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 5, 12);   // upright, `len` tall
  const ball = (r, sx = 1, sy = 1, sz = 1) => new THREE.SphereGeometry(r, 16, 12).scale(sx, sy, sz);
  const rod = (r0, r1, len) => new THREE.CylinderGeometry(r0, r1, len, 12);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const lying = (g) => g.rotateX(Math.PI / 2);   // turns an upright shape along z

  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  const hips = group(root, 0, STANDING, 0);
  add(hips, ball(0.165, 1.12, 0.85, 0.92), DARK, 0, 0.03, 0);
  const torso = group(hips);
  torso.rotation.order = 'YXZ';
  add(torso, cap(0.2, 0.6).scale(1.18, 1, 0.84), SUIT, 0, 0.31, 0);
  add(torso, rod(0.207, 0.2, 0.07).scale(1.16, 1, 0.84), TRIM, 0, 0.1, 0);        // belt
  add(torso, cap(0.125, 0.42).scale(1.35, 1, 0.85), DARK, 0, 0.33, 0.19);         // pack
  add(torso, cap(0.028, 0.26), TRIM, 0, 0.34, 0.3);
  add(torso, rod(0.07, 0.085, 0.1), DARK, 0, 0.6, 0);                             // neck
  const head = group(torso, 0, 0.74, 0);
  head.rotation.order = 'YXZ';
  add(head, ball(0.17, 1, 1.04, 1.02), SHELL);
  add(head, new THREE.SphereGeometry(0.177, 16, 8, Math.PI * 1.5 - 1.05, 2.1, 1.1, 0.62), VISOR);
  add(head, lying(cap(0.032, 0.3)), TRIM, 0, 0.158, 0.01);                        // crest
  add(head, rod(0.05, 0.05, 0.37).rotateZ(Math.PI / 2), DARK, 0, -0.01, 0.02);    // ear pieces

  const arm = (sx) => {
    const sh = group(torso, sx * 0.3, 0.52, 0);
    add(sh, ball(0.09), SUIT2);
    add(sh, cap(0.066, UA + 0.1), SUIT, 0, -UA / 2, 0);
    const el = group(sh, 0, -UA, 0);
    add(el, cap(0.058, FA + 0.08), SUIT, 0, -FA / 2 + 0.01, 0);
    add(el, rod(0.064, 0.064, 0.05), TRIM, 0, -FA + 0.07, 0);
    add(el, ball(0.068), SHELL, 0, -FA, 0);                                       // glove
    return { sh, el, sx };
  };
  const leg = (sx) => {
    const th = group(hips, sx * 0.105, 0, 0);
    add(th, cap(0.092, TL + 0.15), DARK, 0, -TL / 2, 0);
    const kn = group(th, 0, -TL, 0);
    add(kn, ball(0.082), SUIT2);                                                  // knee pad
    add(kn, cap(0.074, SL + 0.08), DARK, 0, -SL / 2, 0);
    const foot = group(kn, 0, -SL, 0);
    add(foot, lying(cap(SOLE, 0.3)).scale(1.08, 1, 1), SHELL, 0, 0, -0.06);       // boot
    add(foot, rod(0.082, 0.082, 0.05), TRIM, 0, 0.08, 0);
    return { th, kn, foot };
  };
  const armL = arm(-1), armR = arm(1), legL = leg(-1), legR = leg(1);

  // Tools point along -z with the grip at the origin.
  const hold = group(hips);
  hold.rotation.order = 'YXZ';
  const tools = {};
  let t = tools.brk = group(hold);
  add(t, lying(rod(0.026, 0.026, 0.56)), METAL, 0, 0.055, -0.34);                 // barrel
  add(t, lying(rod(0.02, 0.02, 0.4)), METAL, 0, 0.012, -0.3);
  add(t, lying(rod(0.042, 0.042, 0.17)), WOOD, 0, 0.014, -0.32);                  // pump
  add(t, box(0.06, 0.1, 0.26), METAL, 0, 0.035, 0.02);
  add(t, box(0.045, 0.12, 0.06).rotateX(0.3), WOOD, 0, -0.05, 0.03);
  add(t, box(0.05, 0.1, 0.24).rotateX(-0.12), WOOD, 0, 0.01, 0.25);               // stock
  t = tools.rng = group(hold);
  add(t, box(0.055, 0.1, 0.42), METAL, 0, 0.04, -0.1);
  add(t, lying(rod(0.017, 0.017, 0.36)), DARK, 0, 0.055, -0.48);                  // barrel
  add(t, lying(rod(0.03, 0.03, 0.07)), DARK, 0, 0.055, -0.63);
  add(t, box(0.042, 0.18, 0.075).rotateX(0.25), DARK, 0, -0.08, -0.12);           // magazine
  add(t, box(0.04, 0.11, 0.055).rotateX(0.3), DARK, 0, -0.05, 0.05);
  add(t, box(0.045, 0.085, 0.22), METAL, 0, 0.03, 0.22);                          // stock
  add(t, box(0.02, 0.035, 0.16), TRIM, 0, 0.105, -0.08);                          // sight
  t = tools.hrn = group(hold);
  add(t, box(0.06, 0.11, 0.3), OLIVE, 0, 0.03, -0.08);
  add(t, lying(rod(0.022, 0.022, 0.14)), DARK, 0, 0.045, -0.29);
  add(t, box(0.036, 0.22, 0.055), DARK, 0, -0.11, -0.1);                          // long magazine
  add(t, box(0.04, 0.1, 0.05).rotateX(0.3), DARK, 0, -0.05, 0.04);
  add(t, box(0.03, 0.03, 0.16), METAL, 0, 0.05, 0.15);
  add(t, box(0.018, 0.03, 0.08), TRIM, 0, 0.1, -0.1);
  t = tools.pick = group(hold);
  add(t, rod(0.022, 0.026, 0.8), WOOD, 0, 0.26, 0);                               // handle
  add(t, rod(0.031, 0.031, 0.13), DARK, 0, -0.05, 0);
  add(t, box(0.07, 0.09, 0.12), STEEL, 0, 0.64, 0);
  add(t, new THREE.ConeGeometry(0.042, 0.36, 8).rotateX(-Math.PI / 2 - 0.25), STEEL, 0, 0.62, -0.21);   // the long spike
  add(t, new THREE.ConeGeometry(0.046, 0.2, 8).rotateX(Math.PI / 2 + 0.2), STEEL, 0, 0.63, 0.14);
  add(t, rod(0.034, 0.034, 0.03), TRIM, 0, 0.56, 0);
  t = tools.plan = group(hold);
  add(t, box(0.36, 0.012, 0.26), 0x8fb0d2, 0, 0, 0);
  add(t, box(0.3, 0.014, 0.2), 0xdbe9f7, 0, 0.002, 0);
  add(t, lying(cap(0.012, 0.16)), TRIM, 0.19, 0.035, 0);                          // pencil

  // a soft round shadow on whatever is below
  const dot = document.createElement('canvas');
  dot.width = dot.height = 64;
  const g2 = dot.getContext('2d'), fade = g2.createRadialGradient(32, 32, 4, 32, 32, 32);
  fade.addColorStop(0, 'rgba(8,16,26,1)');
  fade.addColorStop(0.55, 'rgba(8,16,26,0.55)');
  fade.addColorStop(1, 'rgba(8,16,26,0)');
  g2.fillStyle = fade;
  g2.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(dot), transparent: true, opacity: 0.4, depthWrite: false }));
  root.add(shadow);

  return { root, hips, torso, head, armL, armR, legL, legR, hold, tools, shadow, mats: Object.values(mats) };
}

const V = new THREE.Vector3(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), INV = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0), XAXIS = new THREE.Vector3(1, 0, 0);

// Bends an arm so that its hand lands on `to` (a point in the chest's space).
function reach(arm, to) {
  to.sub(arm.sh.position);
  const d = Math.min(UA + FA - 0.004, Math.max(Math.abs(UA - FA) + 0.03, to.length()));
  to.normalize();
  const bend = Math.PI - Math.acos((UA * UA + FA * FA - d * d) / (2 * UA * FA));
  const lead = Math.acos((UA * UA + d * d - FA * FA) / (2 * UA * d));
  arm.sh.quaternion.copy(Q.setFromUnitVectors(DOWN, to)).multiply(Q2.setFromAxisAngle(XAXIS, -lead));
  arm.el.rotation.x = bend;
}

const smooth = (v) => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
// Pickaxe swing, s from 0 to 1: back over the shoulder, down hard, and home again.
function swingAngle(s) {
  if (s <= 0) return -0.35;
  if (s < 0.28) return -0.35 + 1.5 * smooth(s / 0.28);
  if (s < 0.46) return 1.15 - 2.7 * smooth((s - 0.28) / 0.18);
  return -1.55 + 1.2 * smooth((s - 0.46) / 0.54);
}

export class Player {
  constructor(scene, camera, world) {
    this.camera = camera;
    this.world = world;
    this.body = makeBody();
    this.prev = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.kick = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.eye = EYE;
    this.liftOff = 0;
    this.camDist = settings.camDist;
    this.side = T.camRight;
    this.pivot = new THREE.Vector3();
    this.aim = { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: -1 };
    this.phase = 0;
    this.ads = 0;              // 0..1, how far the aim-in has come
    this.adsWant = 0;
    this.zoom = 1;             // zoom of the gun in hand when fully aimed
    this.lookScale = 1;        // mouse speed factor while aiming
    this.swing = 0;            // 0..1 through a pickaxe swing
    this.stamina = 1;          // 0..1, what is left for sprinting
    this.spent = false;        // ran dry: wait for it to come back a bit
    this.sprinting = false;
    this.sprintK = 0;
    this.mantle = null;        // { t, dur, x0, y0, z0, x1, y1, z1 } while pulling up on a ledge
    this.crouchK = 0;
    this.legs = [0, 0.1, 0, 0.1];   // thigh and knee angles, left then right
    this.lean = 0;
    this.twist = 0;
    this.model = buildModel();
    this.tool = '';
    this.setTool('brk');
    scene.add(this.model.root);
  }

  spawn(x, y, z, yaw) {
    this.world.place(this.body, x, y, z);
    this.body.h = STAND;
    this.prev.x = x; this.prev.y = y; this.prev.z = z;
    this.yaw = yaw;
    this.pitch = 0;
    this.kick = 0;
    this.liftOff = 0;
    this.coyote = this.jumpBuf = 0;
    this.camDist = settings.camDist;
    this.ads = this.adsWant = 0;
    this.swing = 0;
    this.stamina = 1;
    this.spent = this.sprinting = false;
    this.mantle = null;
  }

  setTool(name) {
    if (name === this.tool) return;
    this.tool = name;
    for (const k in this.model.tools) this.model.tools[k].visible = k === name;
  }

  look(dx, dy, speed) {
    this.yaw -= dx * speed;
    this.pitch -= dy * speed * (settings.invertY ? -1 : 1);
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
  }

  pressJump() { this.jumpBuf = Math.max(T.jumpBuffer, 0.012); }

  // One fixed physics step.
  step(dt) {
    const b = this.body;
    this.prev.x = b.x; this.prev.y = b.y; this.prev.z = b.z;

    // Pulling up on a ledge: first up along it, then over the edge.
    if (this.mantle) {
      const m = this.mantle;
      m.t += dt;
      const u = Math.min(1, m.t / m.dur), up = smooth(u / 0.62), over = smooth((u - 0.5) / 0.5);
      b.x = m.x0 + (m.x1 - m.x0) * over;
      b.z = m.z0 + (m.z1 - m.z0) * over;
      b.y = m.y0 + (m.y1 - m.y0) * up;
      b.vx = b.vy = b.vz = 0;
      this.jumpBuf = 0;
      if (u >= 1) { this.mantle = null; this.world.place(b, m.x1, m.y1, m.z1); }
      return;
    }

    const crouch = input.down('crouch');
    if (crouch) b.h = CROUCH;
    else if (b.h !== STAND && this.world.canBe(b, STAND)) b.h = STAND;

    let f = (input.down('forward') ? 1 : 0) - (input.down('back') ? 1 : 0);
    let s = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    const len = Math.hypot(f, s);
    if (len) { f /= len; s /= len; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // Sprinting: forward only, not crouched, not aimed in, and only while there is breath left.
    if (this.spent && this.stamina > 0.25) this.spent = false;
    this.sprinting = input.down('sprint') && f > 0 && b.h !== CROUCH && this.adsWant === 0 && !this.spent;
    if (this.sprinting) {
      this.stamina -= dt / T.sprintTime;
      if (this.stamina <= 0) { this.stamina = 0; this.spent = true; this.sprinting = false; }
    } else this.stamina = Math.min(1, this.stamina + dt / T.sprintRest);
    const max = b.h === CROUCH && b.onGround ? T.crouchSpeed : this.sprinting ? T.sprintSpeed : T.runSpeed;
    const ctrl = b.onGround ? 1 : T.airControl;
    const sp = Math.hypot(b.vx, b.vz);
    if (len) {
      const dx = -sin * f + cos * s, dz = -cos * f - sin * s;
      // Turning is quick: the speed there already is swings round to the new direction ...
      const k = Math.min(1, T.grip * ctrl * dt);
      b.vx += (dx * sp - b.vx) * k;
      b.vz += (dz * sp - b.vz) * k;
      // ... but picking up speed takes a moment.
      const along = b.vx * dx + b.vz * dz;
      const want = along > max ? Math.max(max, along - T.groundStop * ctrl * dt) : Math.min(max, along + T.groundAccel * ctrl * dt);
      b.vx += dx * (want - along);
      b.vz += dz * (want - along);
      const now = Math.hypot(b.vx, b.vz), cap = Math.max(max, sp);
      if (now > cap) { b.vx *= cap / now; b.vz *= cap / now; }
    } else if (sp > 0) {
      // No key held: the character runs out over a short distance.
      const k = Math.max(0, sp - T.groundStop * ctrl * dt) / sp;
      b.vx *= k;
      b.vz *= k;
    }

    this.coyote = b.onGround ? T.coyote + 1e-3 : this.coyote - dt;
    this.jumpBuf -= dt;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      b.vy = T.jumpSpeed;
      b.onGround = false;
      b.jumped = true;
      this.coyote = 0;
      this.jumpBuf = 0;
      sfx.jump();
    }

    const air = !b.onGround, vy = b.vy;
    this.world.step(b, dt);
    if (air && b.onGround && vy < -5) sfx.land();
    if (b.lift) { this.liftOff -= b.lift; b.lift = 0; }

    // In the air, pushing forward at a ledge that the jump doesn't quite reach: grab it.
    if (!b.onGround && T.mantleReach > 0 && f > 0 && b.vy < 3) {
      const px = b.x - sin * 0.75, pz = b.z - cos * 0.75;
      const top = this.world.ledge(b, px, pz, b.y + 0.2, b.y + T.mantleReach);
      if (top !== null) {
        this.mantle = { t: 0, dur: 0.24 + 0.11 * (top - b.y), x0: b.x, y0: b.y, z0: b.z, x1: px, y1: top, z1: pz };
        b.vx = b.vy = b.vz = 0;
        sfx.mantle();
      }
    }
  }

  // Camera position for the current look direction. Also fills the aim ray,
  // which starts where the view line passes the character.
  rig() {
    const sp = Math.sin(this.pitch), cp = Math.cos(this.pitch), sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fx = -sy * cp, fy = sp, fz = -cy * cp;
    const px = this.pivot.x + cy * this.side, py = this.pivot.y + T.camUp, pz = this.pivot.z - sy * this.side;
    const cam = this.camera.position;
    cam.set(px - fx * this.camDist, py - fy * this.camDist, pz - fz * this.camDist);
    const t = Math.max(0, (this.pivot.x - cam.x) * fx + (this.pivot.y - cam.y) * fy + (this.pivot.z - cam.z) * fz);
    const a = this.aim;
    a.ox = cam.x + fx * t; a.oy = cam.y + fy * t; a.oz = cam.z + fz * t;
    a.dx = fx; a.dy = fy; a.dz = fz;
    return a;
  }

  // Once per rendered frame. alpha blends the last two physics steps.
  view(alpha, dt, moving = true) {
    const b = this.body, w = this.world;
    const x = this.prev.x + (b.x - this.prev.x) * alpha, y = this.prev.y + (b.y - this.prev.y) * alpha,
      z = this.prev.z + (b.z - this.prev.z) * alpha;

    this.liftOff = T.camLift > 0 ? this.liftOff * Math.exp(-dt / (T.camLift / 2.5)) : 0;
    if (Math.abs(this.liftOff) < 0.002) this.liftOff = 0;
    this.eye += ((b.h === CROUCH ? EYE_LOW : EYE) - this.eye) * Math.min(1, dt * 16);
    this.kick *= Math.exp(-dt * 14);
    this.pivot.set(x, y + this.eye + this.liftOff, z);

    // aiming in: narrower view, camera closer, slower mouse
    this.ads += (this.adsWant - this.ads) * Math.min(1, dt * 15);
    if (!this.adsWant && this.ads < 0.003) this.ads = 0;
    const zoom = 1 + (this.zoom - 1) * this.ads;
    this.sprintK += ((this.sprinting ? 1 : 0) - this.sprintK) * Math.min(1, dt * 8);
    const wide = Math.min(125, settings.fov * (1 + 0.07 * this.sprintK));   // the view opens up a little at a sprint
    const fov = 2 * Math.atan(Math.tan(wide * Math.PI / 360) / zoom) * 180 / Math.PI;
    if (Math.abs(fov - this.camera.fov) > 0.004) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.lookScale = 1 + (settings.aimSens / this.zoom - 1) * this.ads;

    const sp = Math.sin(this.pitch), cp = Math.cos(this.pitch), sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    // shoulder offset, pulled in next to a wall
    let side = T.camRight;
    if (side > 0) {
      const h = w.ray(this.pivot.x, this.pivot.y, this.pivot.z, cy, 0, -sy, side + 0.25);
      if (h) side = Math.max(0, h.t - 0.25);
    }
    this.side = side;
    const px = this.pivot.x + cy * side, py = this.pivot.y + T.camUp, pz = this.pivot.z - sy * side;
    // distance, pulled in at once when something is behind, eased back out
    let room = settings.camDist + (Math.min(settings.camDist, T.aimDist) - settings.camDist) * this.ads;
    const h = w.ray(px, py, pz, sy * cp, -sp, cy * cp, room + 0.3);
    if (h) room = Math.max(0.12, h.t - 0.3);
    if (room < this.camDist) this.camDist = room;
    else this.camDist += (room - this.camDist) * Math.min(1, dt * 9);

    this.rig();
    this.camera.rotation.set(this.pitch + this.kick, this.yaw, 0, 'YXZ');
    this.pose(dt, x, y, z, moving);
  }

  // Puts the figure where the body is and moves its limbs.
  pose(dt, x, y, z, moving) {
    const m = this.model, b = this.body, def = TOOLS[this.tool] || TOOLS.plan;
    m.root.position.set(x, y + this.liftOff, z);
    m.root.rotation.y = this.yaw;
    const fade = Math.max(0, Math.min(1, (this.camDist - 0.5) / 0.9));   // see-through when the camera is close
    m.root.visible = fade > 0.03;
    for (const mat of m.mats) mat.opacity = fade;

    const k = Math.min(1, dt * 16);
    this.crouchK += ((b.h === CROUCH ? 1 : 0) - this.crouchK) * k;
    const cr = this.crouchK, speed = Math.hypot(b.vx, b.vz), run = Math.min(1, speed / T.runSpeed);
    if (moving) this.phase += dt * (4 + speed * 1.6);
    const s = Math.sin(this.phase), c = Math.cos(this.phase);

    // legs: thigh forward and knee bend, left then right
    const stride = 0.6 * run * (1 - 0.35 * cr) * (1 + 0.3 * this.sprintK);
    const want = b.onGround
      ? [stride * s + 1.1 * cr, 0.1 + 1.15 * run * Math.max(0, c) + 2.05 * cr,
        -stride * s + 1.1 * cr, 0.1 + 1.15 * run * Math.max(0, -c) + 2.05 * cr]
      : this.mantle ? [0.9, 1.3, 0.1, 0.5] : [0.6, 1.05, -0.2, 0.65];
    const g = this.legs;
    for (let n = 0; n < 4; n++) g[n] += (want[n] - g[n]) * k;
    let hip = 0;
    for (const [leg, n] of [[m.legL, 0], [m.legR, 2]]) {
      const th = g[n], kn = g[n + 1];
      leg.th.rotation.x = th;
      leg.kn.rotation.x = -kn;
      leg.foot.rotation.x = (kn - th) * 0.75;
      hip = Math.max(hip, TL * Math.cos(th) + SL * Math.cos(th - kn) + SOLE);
    }
    m.hips.position.y = hip + (STANDING - hip) * 0.35 * (1 - cr);

    // chest: leans into the run, turns for a gun stance
    this.lean += ((b.onGround ? 0.12 * run + 0.62 * cr + 0.12 * this.sprintK : this.mantle ? 0.3 : 0.16) - this.lean) * k;
    this.twist += (def.twist * (1 + 0.25 * this.ads) - this.twist) * k;
    const pitch = Math.max(-1.1, Math.min(1.1, this.pitch));
    m.torso.rotation.set(-this.lean, this.twist, 0);
    m.head.rotation.set(pitch * 0.55 + this.lean, -this.twist, 0);

    // the tool, then the hands on it
    const hold = m.hold;
    hold.position.set(def.at[0], def.at[1] + 0.09 * this.ads - 0.1 * cr, def.at[2] + this.kick * 1.2);
    if (this.tool === 'pick') {
      const a = swingAngle(this.swing), up = Math.max(0, a + 0.35) / 1.5, out = Math.max(0, -a - 0.35) / 1.2;
      hold.rotation.set(a + pitch * 0.4, 0, 0);
      hold.position.y += 0.22 * up - 0.04 * out;
      hold.position.z += 0.1 * up - 0.22 * out;
    } else if (this.tool === 'plan') hold.rotation.set(0.5 + pitch * 0.4, 0, 0);
    else hold.rotation.set(pitch + this.kick * 1.5, 0, 0);
    INV.copy(m.torso.quaternion).invert();
    const hand = (arm, off) => reach(arm, V.set(off[0], off[1], off[2]).applyQuaternion(hold.quaternion).add(hold.position).applyQuaternion(INV));
    hand(m.armR, def.r);
    if (this.mantle) {
      // one hand up on the ledge
      m.armL.sh.rotation.set(2.7, 0, -0.15);
      m.armL.el.rotation.x = 0.35;
    } else if (def.l) hand(m.armL, def.l);
    else {
      // the free arm swings against its leg
      m.armL.sh.rotation.set(b.onGround ? -g[0] * 0.9 + 0.5 * cr : 0.5, 0, b.onGround ? -0.1 : -0.5);
      m.armL.el.rotation.x = 0.3 + 0.6 * run;
    }

    // shadow on the ground below, smaller and fainter from high up
    const hit = this.world.ray(x, y + 0.4, z, 0, -1, 0, 60);
    const drop = hit ? Math.max(0, hit.t - 0.4) : 60, size = 1 / (1 + drop * 0.22);
    m.shadow.position.y = (0.03 - drop - this.liftOff) / SCALE;
    m.shadow.scale.setScalar(size);
    m.shadow.material.opacity = 0.5 * fade * size;
    m.root.updateMatrixWorld(true);
  }

  // Where tracers start: the end of the barrel.
  muzzle(out) {
    return this.model.hold.localToWorld(out.set(0, 0.05, (TOOLS[this.tool] || TOOLS.brk).muzzle));
  }
}
