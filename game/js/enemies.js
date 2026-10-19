// Debt Bots and friends: building, AI, damage, and the round system.
import * as THREE from '../vendor/three.module.min.js';
import { sfx } from './audio.js';
import * as T from './textures.js';

const TYPES = {
  debt:  { name: 'Debt Bot',      color: 0x5d6670, eye: 0xff3b30, hpMul: 1,   scale: 1,    dmg: 40, label: 'DEBT', reward: 60 },
  tax:   { name: 'Tax Collector', color: 0x8b1e1e, eye: 0xffeb3b, hpMul: 0.6, scale: 0.85, dmg: 30, label: 'TAX',  reward: 70, speed: 4.6 },
  shark: { name: 'Loan Shark',    color: 0x1f3b57, eye: 0x00e5ff, hpMul: 8,   scale: 1.6,  dmg: 70, label: 'LOAN', reward: 500, speed: 1.7 },
};

const MAX_ALIVE = 24;

export function roundHp(r) { return r < 10 ? 150 + 100 * (r - 1) : 1050 * Math.pow(1.1, r - 9); }
export function roundCount(r) { return 4 + 2 * r + Math.floor(0.3 * r * r); }

export class Enemies {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.toSpawn = 0;
    this.spawnT = 0;
    this.breakT = 0;
    this.dropsThisRound = 0;
    this.sharksLeft = 0;

    this.geo = {
      body: new THREE.BoxGeometry(0.7, 0.8, 0.45),
      head: new THREE.BoxGeometry(0.42, 0.36, 0.4),
      eye: new THREE.BoxGeometry(0.09, 0.05, 0.02),
      limb: new THREE.BoxGeometry(0.16, 0.65, 0.16),
      leg: new THREE.BoxGeometry(0.2, 0.7, 0.2),
      antenna: new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6),
      dollar: new THREE.PlaneGeometry(0.16, 0.16),
      hat: new THREE.CylinderGeometry(0.17, 0.17, 0.32, 14),
      brim: new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16),
      fin: new THREE.ConeGeometry(0.18, 0.5, 4),
      label: new THREE.PlaneGeometry(0.5, 0.2),
    };
    this.shared = {
      dark: new THREE.MeshLambertMaterial({ color: 0x2a2d31 }),
      black: new THREE.MeshLambertMaterial({ color: 0x111111 }),
      dollar: new THREE.MeshBasicMaterial({ map: T.labelTex('$', { w: 64, h: 64, bg: null, fg: '#21ff7a', font: 'bold 56px sans-serif' }), transparent: true }),
      labels: {},
      eyes: {},
    };
    for (const [k, t] of Object.entries(TYPES)) {
      this.shared.labels[k] = new THREE.MeshBasicMaterial({ map: T.labelTex(t.label, { w: 256, h: 100, bg: '#151515', fg: '#ff4040', font: 'bold 70px Impact, sans-serif' }) });
      this.shared.eyes[k] = new THREE.MeshBasicMaterial({ color: t.eye });
    }
  }

  // ---------- rounds ----------
  startRound(r) {
    const state = this.game.state;
    state.round = r;
    this.toSpawn = roundCount(r);
    this.sharksLeft = r % 5 === 0 ? 1 + Math.floor(r / 10) : 0;
    this.spawnT = 1;
    this.dropsThisRound = 0;
    this.game.hud.setRound(r);
    if (r > 1) this.game.hud.announce('ROUND ' + r, r % 5 === 0 ? 'The Loan Sharks are coming…' : '', 3);
    else this.game.hud.announce('ROUND 1', 'Cash is king. Survive.', 3.5);
    sfx.roundStart();
    if (r > 1) state.grenades = Math.min(4, state.grenades + 2);
  }

  updateRounds(dt) {
    if (this.breakT > 0) {
      this.breakT -= dt;
      if (this.breakT <= 0) this.startRound(this.game.state.round + 1);
      return;
    }
    if (this.toSpawn > 0) {
      this.spawnT -= dt;
      const alive = this.list.filter(e => e.state !== 'dying').length;
      if (this.spawnT <= 0 && alive < MAX_ALIVE) {
        this.spawn();
        const r = this.game.state.round;
        this.spawnT = Math.max(0.4, 1.7 - r * 0.1) * (0.6 + Math.random() * 0.8);
      }
    } else if (this.list.length === 0) {
      this.breakT = 8;
      sfx.roundEnd();
      this.game.hud.announce('ROUND ' + this.game.state.round + ' SURVIVED', 'Spend your cash!', 3);
    }
  }

  // ---------- spawning ----------
  spawn() {
    const { world, player, state } = this.game;
    const r = state.round;
    let type = 'debt';
    if (this.sharksLeft > 0 && (this.toSpawn <= this.sharksLeft || Math.random() < 0.25)) { type = 'shark'; this.sharksLeft--; }
    else if (r >= 4 && Math.random() < Math.min(0.35, 0.1 + r * 0.02)) type = 'tax';

    const points = world.spawnPoints.filter(s => world.isUnlocked(s.area))
      .map(s => ({ s, d: Math.hypot(s.x - player.pos.x, s.z - player.pos.z) }))
      .filter(o => o.d > 6)
      .sort((a, b) => a.d - b.d);
    if (!points.length) return;
    const pick = points[Math.floor(Math.random() * Math.min(4, points.length))].s;

    const t = TYPES[type];
    const runnerChance = Math.max(0, Math.min(0.85, (r - 2) * 0.15));
    let speed = t.speed || (Math.random() < runnerChance ? 3.1 + Math.random() * 0.8 : 1.4 + Math.random() * 0.4);
    if (type === 'tax') speed += Math.min(1, r * 0.05);
    const hp = roundHp(r) * t.hpMul;

    const e = this.build(type);
    e.group.position.set(pick.x + (Math.random() - 0.5) * 0.6, -2.2 * t.scale, pick.z + (Math.random() - 0.5) * 0.6);
    Object.assign(e, {
      type, def: t, hp, maxHp: hp, speed, state: 'rising', t: 0, attackT: 0, attackCd: 0,
      phase: Math.random() * 6, groanT: 1 + Math.random() * 5, stuckT: 0, detourT: 0, detourSide: 1,
      flashT: 0, pos: e.group.position, radius: 0.38 * t.scale,
    });
    this.list.push(e);
    this.toSpawn--;
  }

  build(type) {
    const t = TYPES[type];
    const s = this.shared;
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: t.color, emissive: 0x000000 });
    const mesh = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

    const inner = new THREE.Group();
    g.add(inner);
    const body = mesh(this.geo.body, bodyMat, 0, 1.15, 0, inner);
    const label = mesh(this.geo.label, s.labels[type], 0, 1.25, 0.231, inner);
    mesh(this.geo.dollar, s.dollar, 0, 0.98, 0.231, inner);
    const head = mesh(this.geo.head, bodyMat, 0, 1.75, 0, inner);
    mesh(this.geo.eye, s.eyes[type], -0.1, 1.78, 0.205, inner);
    mesh(this.geo.eye, s.eyes[type], 0.1, 1.78, 0.205, inner);

    const armL = new THREE.Group(); armL.position.set(-0.45, 1.45, 0); inner.add(armL);
    const armR = new THREE.Group(); armR.position.set(0.45, 1.45, 0); inner.add(armR);
    mesh(this.geo.limb, s.dark, 0, -0.3, 0, armL);
    mesh(this.geo.limb, s.dark, 0, -0.3, 0, armR);
    armL.rotation.x = armR.rotation.x = -1.35; // zombie arms reaching forward
    const legL = new THREE.Group(); legL.position.set(-0.18, 0.75, 0); inner.add(legL);
    const legR = new THREE.Group(); legR.position.set(0.18, 0.75, 0); inner.add(legR);
    mesh(this.geo.leg, s.dark, 0, -0.35, 0, legL);
    mesh(this.geo.leg, s.dark, 0, -0.35, 0, legR);

    if (type === 'debt') {
      mesh(this.geo.antenna, s.dark, 0, 2.05, 0, inner);
      const tip = mesh(new THREE.SphereGeometry(0.04, 8, 6), s.eyes.debt, 0, 2.18, 0, inner);
      tip.scale.setScalar(1);
    } else if (type === 'tax') {
      mesh(this.geo.brim, s.black, 0, 1.94, 0, inner);
      mesh(this.geo.hat, s.black, 0, 2.1, 0, inner);
    } else {
      const fin = mesh(this.geo.fin, bodyMat, 0, 2.15, -0.05, inner);
      fin.scale.set(0.3, 1, 1.4);
    }
    inner.scale.setScalar(t.scale);
    this.game.scene.add(g);
    return { group: g, inner, body, head, label, armL, armR, legL, legR, bodyMat };
  }

  // ---------- AI ----------
  update(dt) {
    const { player, world } = this.game;
    const pArea = world.areaAt(player.pos.x, player.pos.z);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.t += dt;
      if (e.flashT > 0) { e.flashT -= dt; e.bodyMat.emissive.setHex(e.flashT > 0 ? 0x553333 : 0x000000); }

      if (e.state === 'dying') {
        e.inner.rotation.x = Math.max(-Math.PI / 2, e.inner.rotation.x - dt * 5);
        if (e.t > 0.6) e.pos.y -= dt * 1.5;
        if (e.t > 1.6) { this.game.scene.remove(e.group); this.list.splice(i, 1); }
        continue;
      }
      if (e.state === 'rising') {
        e.pos.y = Math.min(0, -2.2 * e.def.scale * (1 - e.t / 1.2));
        e.inner.rotation.z = Math.sin(e.t * 20) * 0.1;
        if (e.t >= 1.2) { e.state = 'chasing'; e.pos.y = 0; e.inner.rotation.z = 0; }
        this.facePlayer(e, dt);
        continue;
      }

      const dxp = player.pos.x - e.pos.x, dzp = player.pos.z - e.pos.z;
      const distP = Math.hypot(dxp, dzp);
      const eArea = world.areaAt(e.pos.x, e.pos.z);

      // Groan now and then; louder when close.
      e.groanT -= dt;
      if (e.groanT <= 0) {
        e.groanT = 3 + Math.random() * 6;
        if (distP < 25) sfx.groan(0.09 * (1 - distP / 25), e.type === 'shark' ? 0.6 : e.type === 'tax' ? 1.4 : 1);
      }

      const reach = 1.25 * e.def.scale;
      if (distP < reach && Math.abs(player.pos.y - e.pos.y) < 1.6) {
        // Attack: wind up, then swipe.
        e.attackT += dt;
        e.armL.rotation.x = -1.35 - Math.sin(Math.min(1, e.attackT / 0.5) * Math.PI) * 1.2;
        e.armR.rotation.x = e.armL.rotation.x;
        if (e.attackT >= 0.5 && e.attackCd <= 0) {
          player.hurt(e.def.dmg);
          e.attackCd = 1.0;
        }
        if (e.attackT > 1.0) e.attackT = 0;
        e.attackCd -= dt;
        this.facePlayer(e, dt);
        continue;
      }
      e.attackT = 0;
      e.attackCd = Math.max(0, e.attackCd - dt);
      e.armL.rotation.x = e.armR.rotation.x = -1.35 + Math.sin(e.t * 3) * 0.1;

      let tx = player.pos.x, tz = player.pos.z;
      if (eArea !== pArea) {
        const wp = world.pathTarget(e.pos, eArea, pArea);
        if (wp) { tx = wp.x; tz = wp.z; }
      }
      let dx = tx - e.pos.x, dz = tz - e.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d; dz /= d;
      if (e.detourT > 0) {
        e.detourT -= dt;
        const sx = -dz * e.detourSide, sz = dx * e.detourSide;
        dx = dx * 0.3 + sx; dz = dz * 0.3 + sz;
        const n = Math.hypot(dx, dz); dx /= n; dz /= n;
      }
      // Keep a little space from other bots.
      for (const o of this.list) {
        if (o === e || o.state === 'dying') continue;
        const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z;
        const od = Math.hypot(ox, oz);
        const min = e.radius + o.radius + 0.1;
        if (od > 0.001 && od < min) { dx += (ox / od) * 0.8; dz += (oz / od) * 0.8; }
      }
      const step = e.speed * dt;
      const bx = e.pos.x, bz = e.pos.z;
      world.moveCircle(e.pos, dx * step, dz * step, e.radius);
      const moved = Math.hypot(e.pos.x - bx, e.pos.z - bz);
      if (moved < step * 0.3) {
        e.stuckT += dt;
        if (e.stuckT > 0.25 && e.detourT <= 0) { e.detourT = 0.9; e.detourSide = Math.random() < 0.5 ? 1 : -1; e.stuckT = 0; }
      } else e.stuckT = 0;

      const targetYaw = Math.atan2(dx, dz);
      e.group.rotation.y = lerpAngle(e.group.rotation.y, targetYaw, Math.min(1, dt * 8));
      e.phase += dt * e.speed * 3.2;
      e.legL.rotation.x = Math.sin(e.phase) * 0.7;
      e.legR.rotation.x = -Math.sin(e.phase) * 0.7;
      e.inner.position.y = Math.abs(Math.sin(e.phase)) * 0.05;
    }
  }

  facePlayer(e, dt) {
    const p = this.game.player.pos;
    e.group.rotation.y = lerpAngle(e.group.rotation.y, Math.atan2(p.x - e.pos.x, p.z - e.pos.z), Math.min(1, dt * 8));
  }

  // ---------- damage ----------
  raycast(o, d, maxDist) {
    const hits = [];
    for (const e of this.list) {
      if (e.state === 'dying') continue;
      const s = e.def.scale;
      const bodyT = raySphere(o, d, e.pos.x, e.pos.y + 1.05 * s, e.pos.z, 0.5 * s);
      const headT = raySphere(o, d, e.pos.x, e.pos.y + 1.78 * s, e.pos.z, 0.27 * s);
      let t = Infinity, head = false;
      if (bodyT !== null) t = bodyT;
      if (headT !== null && headT <= t + 0.05) { t = headT; head = true; }
      if (t < maxDist) hits.push({ enemy: e, dist: t, head, point: o.clone().addScaledVector(d, t) });
    }
    return hits.sort((a, b) => a.dist - b.dist);
  }

  damage(e, amount, head, point, explosive = false) {
    if (e.state === 'dying') return;
    const game = this.game;
    if (game.state.instaT > 0) amount = e.hp + 1;
    e.hp -= amount * (head ? 2 : 1);
    e.flashT = 0.08;
    game.addCash(10, null, true);
    if (!explosive) { game.hud.hitmarker(head); head ? sfx.headshot() : sfx.hit(); }
    if (point) game.items.burst(point, head ? 6 : 3, 'spark');
    if (e.hp <= 0) this.kill(e, head, explosive);
  }

  kill(e, head, silent = false) {
    const game = this.game;
    e.state = 'dying';
    e.t = 0;
    game.state.kills++;
    if (head) game.state.headshots++;
    const reward = e.def.reward + (head ? 40 : 0);
    game.addCash(reward, e.pos.clone().setY(1.6));
    if (!silent) sfx.kaching(0.06);
    game.items.burst(e.pos.clone().setY(1.2), e.type === 'shark' ? 40 : 14, 'money');
    if (e.type === 'shark') game.items.dropPowerup(e.pos.clone(), 'maxammo');
    else if (this.dropsThisRound < 4 && Math.random() < 0.035) {
      this.dropsThisRound++;
      game.items.dropPowerup(e.pos.clone());
    }
  }

  killAll() {
    for (const e of this.list) if (e.state !== 'dying') this.kill(e, false, true);
  }

  aliveCount() { return this.list.filter(e => e.state !== 'dying').length + this.toSpawn; }
}

function raySphere(o, d, cx, cy, cz, r) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = -b - sq;
  if (t < 0) t = -b + sq;
  return t < 0 ? null : t;
}

function lerpAngle(a, b, k) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * k;
}
