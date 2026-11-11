// The player: movement, the over-the-shoulder camera and the character model.

import * as THREE from '../../game/vendor/three.module.min.js';
import { T } from './tuning.js';
import { makeBody, STAND, CROUCH } from './collide.js';
import { settings } from './settings.js';
import * as input from './input.js';
import { sfx } from './audio.js';

const SUIT = 0x1f7f86, DARK = 0x16323a, TRIM = 0xffb23e, SHELL = 0xeef2f5, VISOR = 0x10202c;

function part(mats, w, h, d, color, x, y, z) {
  const mat = mats[color] || (mats[color] = new THREE.MeshLambertMaterial({ color, transparent: true }));
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// A small box-built figure facing -z. Limbs hang from pivots so they can swing.
function buildModel() {
  const mats = {};
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(part(mats, 0.5, 0.56, 0.28, SUIT, 0, 1.1, 0));
  body.add(part(mats, 0.52, 0.1, 0.3, TRIM, 0, 0.84, 0));
  body.add(part(mats, 0.3, 0.38, 0.16, DARK, 0, 1.12, 0.2));          // pack
  body.add(part(mats, 0.08, 0.3, 0.02, TRIM, 0, 1.14, 0.29));
  const head = new THREE.Group();
  head.position.set(0, 1.42, 0);
  head.add(part(mats, 0.32, 0.3, 0.32, SHELL, 0, 0.16, 0));
  head.add(part(mats, 0.26, 0.12, 0.04, VISOR, 0, 0.17, -0.16));
  head.add(part(mats, 0.06, 0.06, 0.34, TRIM, 0, 0.33, 0));
  body.add(head);
  const limb = (x, y, len, w, color, foot) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    g.add(part(mats, w, len, w, color, 0, -len / 2, 0));
    if (foot) g.add(part(mats, w + 0.02, 0.1, w + 0.1, DARK, 0, -len + 0.05, -0.04));
    else g.add(part(mats, w + 0.02, 0.1, w + 0.02, SHELL, 0, -len + 0.05, 0));
    body.add(g);
    return g;
  };
  const legL = limb(-0.13, 0.8, 0.8, 0.17, DARK, true), legR = limb(0.13, 0.8, 0.8, 0.17, DARK, true);
  const armL = limb(-0.33, 1.34, 0.6, 0.13, SUIT, false), armR = limb(0.33, 1.34, 0.6, 0.13, SUIT, false);

  // What the right hand holds: one of three guns or the builder's plan.
  const tools = {};
  const hand = new THREE.Group();
  hand.position.set(0, -0.58, -0.02);
  armR.add(hand);
  const gun = (len, thick, color, extra) => {
    const g = new THREE.Group();
    g.add(part(mats, thick, len, thick + 0.03, color, 0, -len / 2 + 0.1, 0));
    g.add(part(mats, thick - 0.02, 0.07, 0.16, DARK, 0, 0.06, 0.09));
    if (extra) g.add(extra);
    hand.add(g);
    return g;
  };
  tools.brk = gun(0.62, 0.09, 0x6b4a34, part(mats, 0.11, 0.2, 0.1, DARK, 0, -0.18, 0));
  tools.rng = gun(0.74, 0.07, 0x39424e, part(mats, 0.05, 0.06, 0.2, TRIM, 0, -0.1, -0.08));
  tools.hrn = gun(0.42, 0.08, 0x4b5a3a, part(mats, 0.06, 0.07, 0.22, DARK, 0, -0.05, 0.1));
  const plan = new THREE.Group();
  plan.add(part(mats, 0.26, 0.02, 0.2, 0x8fb0d2, 0, -0.06, 0));
  hand.add(plan);
  tools.plan = plan;

  return { root, body, head, legL, legR, armL, armR, tools, mats: Object.values(mats) };
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
    this.eye = 1.55;
    this.liftOff = 0;
    this.camDist = settings.camDist;
    this.side = T.camRight;
    this.pivot = new THREE.Vector3();
    this.aim = { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: -1 };
    this.phase = 0;
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

    const crouch = input.down('crouch');
    if (crouch) b.h = CROUCH;
    else if (b.h !== STAND && this.world.canBe(b, STAND)) b.h = STAND;

    let f = (input.down('forward') ? 1 : 0) - (input.down('back') ? 1 : 0);
    let s = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    const len = Math.hypot(f, s);
    if (len) { f /= len; s /= len; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const speed = b.h === CROUCH && b.onGround ? T.crouchSpeed : T.runSpeed;
    const wx = (-sin * f + cos * s) * speed, wz = (-cos * f - sin * s) * speed;
    const rate = (len ? T.groundAccel : T.groundStop) * (b.onGround ? 1 : T.airControl) * dt;
    const ex = wx - b.vx, ez = wz - b.vz, e = Math.hypot(ex, ez);
    if (e <= rate || e === 0) { b.vx = wx; b.vz = wz; } else { b.vx += ex / e * rate; b.vz += ez / e * rate; }

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
    this.eye += ((b.h === CROUCH ? 1.15 : 1.55) - this.eye) * Math.min(1, dt * 16);
    this.kick *= Math.exp(-dt * 14);
    this.pivot.set(x, y + this.eye + this.liftOff, z);

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
    let room = settings.camDist;
    const h = w.ray(px, py, pz, sy * cp, -sp, cy * cp, room + 0.3);
    if (h) room = Math.max(0.12, h.t - 0.3);
    if (room < this.camDist) this.camDist = room;
    else this.camDist += (room - this.camDist) * Math.min(1, dt * 9);

    this.rig();
    this.camera.rotation.set(this.pitch + this.kick, this.yaw, 0, 'YXZ');

    // model
    const m = this.model;
    m.root.position.set(x, y + this.liftOff, z);
    m.root.rotation.y = this.yaw;
    const fade = Math.max(0, Math.min(1, (this.camDist - 0.55) / 0.8));
    m.root.visible = fade > 0.03;
    for (const mat of m.mats) mat.opacity = fade;
    const crouched = b.h === CROUCH;
    m.body.scale.y += ((crouched ? 0.7 : 1) - m.body.scale.y) * Math.min(1, dt * 16);
    const sp2 = Math.hypot(b.vx, b.vz), run = Math.min(1, sp2 / T.runSpeed);
    if (moving) this.phase += dt * (4 + sp2 * 1.6);
    const sw = b.onGround ? Math.sin(this.phase) * 0.75 * run : 0.35;
    m.legL.rotation.x = sw;
    m.legR.rotation.x = b.onGround ? -sw : -0.5;
    m.armL.rotation.x = b.onGround ? -sw * 0.7 : -0.6;
    m.armR.rotation.x = -1.35 - this.pitch * 0.8 + this.kick * 2;
    m.head.rotation.x = this.pitch * 0.5;
  }

  // Where tracers start.
  muzzle(out) {
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    return out.set(this.body.x + cy * 0.33 - sy * 0.55, this.body.y + (this.body.h === CROUCH ? 0.9 : 1.28), this.body.z - sy * 0.33 - cy * 0.55);
  }
}
