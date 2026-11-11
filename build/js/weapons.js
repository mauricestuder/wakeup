// Three hitscan guns. All their numbers come from tuning.js.

import * as THREE from '../../game/vendor/three.module.min.js';
import { T } from './tuning.js';
import { CROUCH } from './collide.js';
import { sfx } from './audio.js';

export const GUNS = [
  { id: 'brk', name: 'Breaker', kind: 'Shotgun', auto: false, falloff: 7, kick: 0.05 },
  { id: 'rng', name: 'Ranger', kind: 'Rifle', auto: true, falloff: 0, kick: 0.012 },
  { id: 'hrn', name: 'Hornet', kind: 'SMG', auto: true, falloff: 12, kick: 0.008 },
];

const RAD = Math.PI / 180;
const RANGE = 150;

export class Arsenal {
  constructor(scene, world, pieces, player, hud) {
    this.world = world;
    this.pieces = pieces;
    this.player = player;
    this.hud = hud;
    this.current = 0;
    this.ammo = GUNS.map((g) => T[g.id + 'Mag']);
    this.cool = 0;
    this.reloadT = 0;
    this.equipT = 0;
    this.bloom = 0;
    this.held = false;
    this.tap = 0;
    this.shots = 0;
    this.onDummyHit = null;

    // a small pool of tracer streaks
    this.tracers = [];
    const geo = new THREE.BoxGeometry(0.035, 0.035, 1);
    for (let n = 0; n < 20; n++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.tracers.push({ m, t: 0 });
    }
    this.nextTracer = 0;
    this.v = new THREE.Vector3();
    this.e = new THREE.Vector3();
  }

  get gun() { return GUNS[this.current]; }
  get mag() { return Math.round(T[this.gun.id + 'Mag']); }
  get reloading() { return this.reloadT > 0; }
  get reloadLeft() { return this.reloadT / T[this.gun.id + 'Reload']; }

  // Spread right now, in degrees (the crosshair shows it).
  get spread() {
    const id = this.gun.id;
    if (id === 'brk') return T.brkSpread;
    return Math.min(T[id + 'MaxSpread'], T[id + 'Spread'] + this.bloom);
  }

  select(n) {
    if (n === this.current && this.equipT <= 0) return;
    if (n !== this.current) { this.reloadT = 0; this.bloom = 0; sfx.swap(); }
    this.current = n;
    this.equipT = T.equipTime;
    this.tap = 0;
  }

  // Called when leaving build or edit mode for the gun.
  raise() { this.equipT = Math.max(this.equipT, T.equipTime * 0.5); }

  trigger(on) {
    this.held = on;
    if (on) this.tap = 0.2;
  }

  reload() {
    if (this.reloadT > 0 || this.ammo[this.current] >= this.mag) return;
    this.reloadT = T[this.gun.id + 'Reload'];
    sfx.reload();
  }

  refill() {
    for (let n = 0; n < GUNS.length; n++) this.ammo[n] = Math.round(T[GUNS[n].id + 'Mag']);
    this.reloadT = 0;
    this.cool = 0;
    this.bloom = 0;
  }

  update(dt, active) {
    const g = this.gun;
    this.cool -= dt;
    this.equipT -= dt;
    this.tap -= dt;
    if (this.bloom > 0 && this.cool < -0.05) this.bloom = Math.max(0, this.bloom - dt * 7);
    if (this.ammo[this.current] > this.mag) this.ammo[this.current] = this.mag;
    if (this.reloadT > 0 && active) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { this.ammo[this.current] = this.mag; sfx.reloadDone(); }
    }
    for (const tr of this.tracers) {
      if (!tr.m.visible) continue;
      tr.t -= dt;
      if (tr.t <= 0) tr.m.visible = false; else tr.m.material.opacity = tr.t / 0.07;
    }
    if (!active) return;
    const want = g.auto ? this.held || this.tap > 0 : this.tap > 0;
    if (!want || this.cool > 0 || this.equipT > 0 || this.reloadT > 0) return;
    this.tap = 0;
    if (this.ammo[this.current] <= 0) {
      this.reload();
      if (this.reloadT <= 0) sfx.dry();
      this.cool = 0.15;
      return;
    }
    this.fire();
  }

  fire() {
    const g = this.gun, id = g.id, pl = this.player, b = pl.body, w = this.world;
    this.ammo[this.current]--;
    this.cool = id === 'brk' ? T.brkDelay : 1 / T[id + 'Rate'];
    this.shots++;
    const a = pl.rig();
    const spread = Math.tan(this.spread * RAD);
    const pellets = id === 'brk' ? Math.round(T.brkPellets) : 1;
    const dmg = T[id + 'Dmg'];

    // two directions at right angles to the view line
    let rx = -a.dz, rz = a.dx;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl; rz /= rl;
    const ux = -rz * a.dy, uy = rz * a.dx - rx * a.dz, uz = rx * a.dy;

    const cy = b.y + (b.h === CROUCH ? 0.8 : 1.2);
    const dummies = new Map(), pieces = new Map();
    pl.muzzle(this.v);
    for (let n = 0; n < pellets; n++) {
      const r = spread * Math.sqrt(Math.random()), th = Math.random() * 6.2832;
      const sx = r * Math.cos(th), sy = r * Math.sin(th);
      let dx = a.dx + rx * sx + ux * sy, dy = a.dy + uy * sy, dz = a.dz + rz * sx + uz * sy;
      const dl = Math.hypot(dx, dy, dz);
      dx /= dl; dy /= dl; dz /= dl;
      let h = w.ray(a.ox, a.oy, a.oz, dx, dy, dz, RANGE, { dummies: true });
      const t1 = h ? h.t : RANGE;
      let ex = a.ox + dx * t1, ey = a.oy + dy * t1, ez = a.oz + dz * t1;
      let kind = h ? h.kind : '', piece = h ? h.piece : null, dummy = h ? h.dummy : null, head = h ? h.head : false;
      // Shoot again from the chest: whatever is in the way there gets hit instead.
      let vx = ex - b.x, vy = ey - cy, vz = ez - b.z;
      const len = Math.hypot(vx, vy, vz);
      if (len > 0.2) {
        vx /= len; vy /= len; vz /= len;
        h = w.ray(b.x, cy, b.z, vx, vy, vz, len - 0.08, { dummies: true });
        if (h) {
          kind = h.kind; piece = h.piece; dummy = h.dummy; head = h.head;
          ex = b.x + vx * h.t; ey = cy + vy * h.t; ez = b.z + vz * h.t;
        }
      }
      const dist = Math.hypot(ex - b.x, ey - cy, ez - b.z);
      const fall = g.falloff && dist > g.falloff ? Math.max(0.35, 1 - (dist - g.falloff) / (g.falloff * 2.5)) : 1;
      if (kind === 'dummy') {
        const e = dummies.get(dummy) || { dmg: 0, head: false, x: ex, y: ey, z: ez };
        e.dmg += dmg * fall * (head ? T.headMult : 1);
        e.head = e.head || head;
        dummies.set(dummy, e);
      } else if (kind === 'piece') {
        pieces.set(piece, (pieces.get(piece) || 0) + dmg * fall);
      }
      if (n < 6) this.tracer(this.v, this.e.set(ex, ey, ez));
    }

    let any = false, anyHead = false;
    for (const [d, e] of dummies) {
      const amount = Math.round(e.dmg);
      const dead = d.hurt(amount);
      this.hud.number(e.x, e.y, e.z, amount, e.head);
      this.onDummyHit?.(d, amount, e.head, dead);
      any = true;
      anyHead = anyHead || e.head;
    }
    let chipped = false;
    for (const [p, amount] of pieces) { if (!this.pieces.damage(p, amount)) chipped = true; }
    if (any) { this.hud.hit(anyHead); if (anyHead) sfx.head(); else sfx.hit(); } else if (chipped) sfx.hitPiece();

    if (id === 'brk') { sfx.shotgun(); if (this.ammo[this.current] > 0) sfx.pump(); } else if (id === 'rng') sfx.rifle(); else sfx.smg();
    if (id !== 'brk') this.bloom = Math.min(T[id + 'MaxSpread'], this.bloom + T[id + 'Bloom']);
    pl.kick += g.kick * T.recoil;
    if (this.ammo[this.current] <= 0) this.reload();
  }

  tracer(from, to) {
    const tr = this.tracers[this.nextTracer];
    this.nextTracer = (this.nextTracer + 1) % this.tracers.length;
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    tr.m.position.copy(from).add(to).multiplyScalar(0.5);
    tr.m.scale.set(1, 1, len);
    tr.m.lookAt(to);
    tr.m.material.opacity = 1;
    tr.m.visible = true;
    tr.t = 0.07;
  }
}
