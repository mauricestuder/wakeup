// The pickaxe: hold the button to keep swinging. Each swing hits whatever the
// crosshair is on, if it is close enough. It never runs out.

import { T } from './tuning.js';
import { sfx } from './audio.js';

const IMPACT = 0.42;   // how far into the swing the hit lands

export class Pickaxe {
  constructor(world, pieces, player, hud) {
    this.world = world;
    this.pieces = pieces;
    this.player = player;
    this.hud = hud;
    this.t = -1;           // time into the running swing, -1 = none
    this.landed = false;
    this.swings = 0;
    this.onDummyHit = null;
  }

  get busy() { return this.t >= 0; }

  stop() { this.t = -1; this.player.swing = 0; }

  update(dt, active, held) {
    if (!active) { if (this.t >= 0) this.stop(); return; }
    const len = 1 / T.pickRate;
    if (this.t < 0) {
      if (!held) return;
      this.t = 0;
      this.landed = false;
      this.swings++;
      sfx.swing();
    } else this.t += dt;
    if (!this.landed && this.t >= len * IMPACT) { this.landed = true; this.hit(); }
    if (this.t >= len) { this.stop(); return; }
    this.player.swing = this.t / len;
  }

  hit() {
    const a = this.player.rig();
    const h = this.world.ray(a.ox, a.oy, a.oz, a.dx, a.dy, a.dz, T.pickReach, { dummies: true });
    if (!h) return;
    if (h.kind === 'dummy') {
      const amount = Math.round(T.pickDummyDmg), d = h.dummy;
      const x = a.ox + a.dx * h.t, y = a.oy + a.dy * h.t, z = a.oz + a.dz * h.t;
      const dead = d.hurt(amount);
      this.hud.number(x, y, z, amount, false);
      this.hud.hit(false);
      this.onDummyHit?.(d, amount, false, dead);
      sfx.hit();
      sfx.pickHit();
    } else if (h.kind === 'piece') {
      if (!this.pieces.damage(h.piece, T.pickDmg)) sfx.pickHit();
    } else sfx.pickHit(true);
    this.player.kick += 0.012 * T.recoil;
  }
}
