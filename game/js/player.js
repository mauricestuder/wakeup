// First-person movement, collision, health and regen.
import * as THREE from '../vendor/three.module.min.js';
import { sfx } from './audio.js';
import { PERKS } from './items.js';
import { lookSpeed } from './settings.js';

const EYE = 1.65;
const GRAVITY = 22;

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(0, 0, 6);
    this.vy = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.4;
    this.maxHp = 100;
    this.hp = 100;
    this.sinceHurt = 99;
    this.onGround = true;
    this.moving = false;
    this.sprinting = false;
    this.bob = 0;
    this.shake = 0;
  }

  look(dx, dy) {
    const sens = (this.game.aiming ? 0.0013 : 0.0022) * lookSpeed() * this.game.assistSlow;
    this.yaw -= dx * sens;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - dy * sens));
  }

  update(dt, keys) {
    const { world, camera } = this.game;
    // Arrow keys look around, for playing without a mouse (e.g. an iPad keyboard).
    const turn = (this.game.aiming ? 1.3 : 2.4) * lookSpeed() * dt;
    if (keys.ArrowLeft) this.yaw += turn;
    if (keys.ArrowRight) this.yaw -= turn;
    if (keys.ArrowUp) this.pitch = Math.min(1.5, this.pitch + turn * 0.7);
    if (keys.ArrowDown) this.pitch = Math.max(-1.5, this.pitch - turn * 0.7);

    let fx = 0, fz = 0;
    if (keys.KeyW) fz -= 1;
    if (keys.KeyS) fz += 1;
    if (keys.KeyA) fx -= 1;
    if (keys.KeyD) fx += 1;
    const tm = this.game.touchMove;
    if (tm) { fx += tm.x; fz += tm.y; }
    const len = Math.hypot(fx, fz);
    this.moving = len > 0.05;
    this.sprinting = this.moving && (keys.ShiftLeft || tm?.sprint) && fz < 0 && !this.game.aiming;
    if (this.moving) {
      const push = Math.min(1, len); // a half-pushed stick walks slower
      fx /= len; fz /= len;
      let speed = (this.sprinting ? 7.6 : 5) * push;
      if (this.game.aiming) speed *= 0.6;
      if (this.game.state.perks.has('liquid')) speed *= 1.2;
      speed *= this.game.arsenal.moveMul();
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      const dx = (fx * c + fz * s) * speed * dt;
      const dz = (-fx * s + fz * c) * speed * dt;
      world.moveCircle(this.pos, dx, dz, this.radius);
      this.bob += dt * (this.sprinting ? 13 : 9);
    }

    if (keys.Space && this.onGround) { this.vy = 7; this.onGround = false; }
    this.vy -= GRAVITY * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.onGround = true; }

    // Health regenerates after a few seconds without damage, like BO.
    this.sinceHurt += dt;
    if (this.sinceHurt > 3.5 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.5 * dt);

    this.shake = Math.max(0, this.shake - dt * 2.5);
    const bobY = this.moving && this.onGround ? Math.sin(this.bob) * 0.05 : 0;
    camera.position.set(
      this.pos.x + (Math.random() - 0.5) * this.shake * 0.25,
      this.pos.y + EYE + bobY + (Math.random() - 0.5) * this.shake * 0.25,
      this.pos.z,
    );
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  hurt(dmg) {
    if (this.game.state.mode !== 'playing') return;
    this.hp -= dmg;
    this.sinceHurt = 0;
    this.shake = Math.min(1, this.shake + 0.5);
    sfx.hurt();
    this.game.hud.flashDamage();
    if (this.hp <= 0 && this.game.state.perks.has('parachute')) this.bailOut();
    else if (this.hp <= 0) { this.hp = 0; this.game.gameOver(); }
  }

  // Golden Parachute: get back up once, blasting the undead around you away.
  bailOut() {
    const { state, hud, items, enemies } = this.game;
    state.perks.delete('parachute');
    hud.setPerks([...state.perks].map(k => PERKS[k]));
    this.hp = this.maxHp;
    this.sinceHurt = 99;
    for (const e of enemies.list) {
      if (e.state === 'dying') continue;
      if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 5) enemies.damage(e, 5000, false, null, true);
    }
    items.burst(this.pos.clone().setY(1.5), 40, 'money', 2);
    this.shake = 1;
    sfx.powerup();
    hud.announce('GOLDEN PARACHUTE', 'Second chance. Make it count.', 2.5);
  }
}
