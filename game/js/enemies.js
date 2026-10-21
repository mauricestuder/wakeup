// The undead staff of the bank: building, AI, damage, and the round system.
import * as THREE from '../vendor/three.module.min.js';
import { sfx } from './audio.js';
import * as T from './textures.js';

// Type keys stay short internally: debt = Salesman, tax = Tax Auditor,
// shark = Bank President (boss), collector = Debt Collector (throws invoices).
const TYPES = {
  debt:  { name: 'Salesman',       suit: 0x6b4a2b, pants: 0x3b2a1a, skin: 0x8fa07a, eye: 0xff3b30, hpMul: 1,   scale: 1,    dmg: 40, reward: 60 },
  tax:   { name: 'Tax Auditor',    suit: 0xd8d4c4, pants: 0x3a3d45, skin: 0xa3a594, eye: 0xffeb3b, hpMul: 0.6, scale: 0.9,  dmg: 30, reward: 70, speed: 4.6 },
  shark: { name: 'Bank President', suit: 0x1d2238, pants: 0x14172a, skin: 0xb49a8a, eye: 0x00e5ff, hpMul: 8,   scale: 1.6,  dmg: 70, reward: 500, speed: 1.7 },
  collector: { name: 'Debt Collector', suit: 0x5a0f12, pants: 0x1a1a1a, skin: 0x7f8f6f, eye: 0xff7a00, hpMul: 1.4, scale: 1.05, dmg: 35, reward: 100, speed: 1.5, ranged: true },
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
    this.comboN = 0;
    this.comboT = 0;

    this.geo = {
      body: new THREE.BoxGeometry(0.62, 0.8, 0.36),
      head: new THREE.BoxGeometry(0.4, 0.42, 0.38),
      eye: new THREE.BoxGeometry(0.07, 0.045, 0.02),
      sleeve: new THREE.BoxGeometry(0.17, 0.6, 0.17),
      hand: new THREE.BoxGeometry(0.13, 0.15, 0.13),
      leg: new THREE.BoxGeometry(0.21, 0.66, 0.22),
      shoe: new THREE.BoxGeometry(0.22, 0.09, 0.32),
      hat: new THREE.CylinderGeometry(0.17, 0.17, 0.34, 12),
      brim: new THREE.CylinderGeometry(0.28, 0.28, 0.03, 12),
      band: new THREE.CylinderGeometry(0.175, 0.175, 0.06, 12),
      visor: new THREE.BoxGeometry(0.44, 0.02, 0.24),
      case: new THREE.BoxGeometry(0.1, 0.32, 0.42),
      board: new THREE.BoxGeometry(0.03, 0.4, 0.3),
      cigar: new THREE.BoxGeometry(0.035, 0.035, 0.16),
    };
    const lambert = (color, extra) => new THREE.MeshLambertMaterial({ color, ...extra });
    this.shared = {
      black: lambert(0x111111),
      leather: lambert(0x4a2c14),
      paper: lambert(0xe9e4d4),
      gold: lambert(0xd4a017),
      red: lambert(0xb3121b),
      invoice: lambert(0xff5a4a, { emissive: 0x401010 }),
      visor: lambert(0x1e9e4a, { transparent: true, opacity: 0.75 }),
      ember: new THREE.MeshBasicMaterial({ color: 0xff7a1a }),
      // kept for items.js, which reuses the green dollar sign
      dollar: new THREE.MeshBasicMaterial({ map: T.labelTex('$', { w: 64, h: 64, bg: null, fg: '#21ff7a', font: 'bold 56px sans-serif' }), transparent: true }),
      kinds: {},
    };
    const hair = { debt: 0x17120e, tax: 0xa3a594, shark: 0xe6e2d8, collector: 0x1a1a1a };
    for (const [k, t] of Object.entries(TYPES)) {
      this.shared.kinds[k] = {
        skin: lambert(t.skin, { emissive: 0x161616 }), pants: lambert(t.pants), hair: lambert(hair[k]),
        // a faint self-glow keeps the faces readable in the dark
        face: (() => { const m = T.npcFace(k); return lambert(0xffffff, { map: m, emissive: 0x3a3a3a, emissiveMap: m }); })(),
        front: T.npcSuit(k),
        eye: new THREE.MeshBasicMaterial({ color: t.eye }),
      };
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
    if (r > 1) this.game.hud.announce('ROUND ' + r, r % 5 === 0 ? 'The Bank President wants a word…' : '', 3);
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
    else if (r >= 6 && Math.random() < Math.min(0.25, 0.08 + (r - 6) * 0.02)) type = 'collector';
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
      throwCd: 1.5 + Math.random() * 2, throwT: 0,
    });
    this.list.push(e);
    this.toSpawn--;
  }

  build(type) {
    const t = TYPES[type];
    const s = this.shared, k = s.kinds[type];
    const g = new THREE.Group();
    // Per-enemy suit materials so a hit can flash just this one.
    const suitMat = new THREE.MeshLambertMaterial({ color: t.suit });
    const frontMat = new THREE.MeshLambertMaterial({ map: k.front });
    const mesh = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

    const inner = new THREE.Group();
    g.add(inner);
    // Box faces: +x, -x, +y, -y, +z (front), -z
    const body = mesh(this.geo.body, [suitMat, suitMat, suitMat, suitMat, frontMat, suitMat], 0, 1.15, 0, inner);
    const head = mesh(this.geo.head, [k.skin, k.skin, type === 'tax' ? k.skin : k.hair, k.skin, k.face, type === 'tax' ? k.skin : k.hair], 0, 1.76, 0, inner);
    mesh(this.geo.eye, k.eye, -0.09, 1.8, 0.195, inner);
    mesh(this.geo.eye, k.eye, 0.09, 1.8, 0.195, inner);

    const arm = (x) => {
      const a = new THREE.Group(); a.position.set(x, 1.48, 0); inner.add(a);
      mesh(this.geo.sleeve, type === 'tax' ? k.skin : suitMat, 0, -0.28, 0, a); // auditors wear short sleeves
      mesh(this.geo.hand, k.skin, 0, -0.62, 0, a);
      return a;
    };
    const armL = arm(-0.4), armR = arm(0.4);
    armL.rotation.x = armR.rotation.x = -1.35; // zombie arms reaching forward
    const leg = (x) => {
      const l = new THREE.Group(); l.position.set(x, 0.75, 0); inner.add(l);
      mesh(this.geo.leg, k.pants, 0, -0.33, 0, l);
      mesh(this.geo.shoe, s.black, 0, -0.7, 0.05, l);
      return l;
    };
    const legL = leg(-0.16), legR = leg(0.16);

    if (type === 'debt') {
      const bc = mesh(this.geo.case, s.leather, 0.02, -0.72, 0, armR); // briefcase
      mesh(new THREE.BoxGeometry(0.04, 0.06, 0.12), s.gold, 0.06, 0.12, 0, bc);
    } else if (type === 'tax') {
      mesh(this.geo.visor, s.visor, 0, 1.93, 0.14, inner);
      const cb = mesh(this.geo.board, s.leather, 0, -0.72, 0, armL); // clipboard
      mesh(new THREE.BoxGeometry(0.01, 0.34, 0.26), s.paper, 0.02, -0.01, 0, cb);
    } else if (type === 'collector') {
      mesh(new THREE.BoxGeometry(0.43, 0.1, 0.41), s.black, 0, 2.0, 0, inner); // beanie
      const pad = mesh(new THREE.BoxGeometry(0.05, 0.28, 0.22), s.invoice, 0, -0.74, 0, armR); // invoice pad
      pad.rotation.x = 0.3;
    } else {
      mesh(this.geo.brim, s.black, 0, 1.98, 0, inner);
      mesh(this.geo.hat, s.black, 0, 2.15, 0, inner);
      mesh(this.geo.band, s.red, 0, 2.03, 0, inner);
      mesh(this.geo.cigar, s.leather, 0.07, 1.66, 0.26, inner);
      mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), s.ember, 0.07, 1.66, 0.345, inner);
    }
    inner.scale.setScalar(t.scale);
    if (type === 'shark') inner.scale.x *= 1.15; // portly
    this.game.scene.add(g);
    return { group: g, inner, body, head, armL, armR, legL, legR, flashMats: [suitMat, frontMat] };
  }

  // ---------- AI ----------
  update(dt) {
    const { player, world } = this.game;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.comboN = 0; }
    const pArea = world.areaAt(player.pos.x, player.pos.z);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.t += dt;
      if (e.flashT > 0) {
        e.flashT -= dt;
        for (const m of e.flashMats) m.emissive.setHex(e.flashT > 0 ? 0x553333 : 0x000000);
      }

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

      if (e.def.ranged && this.rangedAttack(e, dt, distP, eArea === pArea)) continue;
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
      // Keep a little space from each other.
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

  // Debt Collectors stop at range and throw invoices. Returns true while busy throwing.
  rangedAttack(e, dt, distP, sameArea) {
    const { player, world, items } = this.game;
    if (e.throwT > 0) {
      e.throwT -= dt;
      this.facePlayer(e, dt);
      e.armR.rotation.x = -1.35 - Math.min(1, (0.6 - e.throwT) / 0.6) * 1.6;
      e.legL.rotation.x = e.legR.rotation.x = 0;
      if (e.throwT <= 0) {
        const s = e.def.scale;
        const from = new THREE.Vector3(e.pos.x, e.pos.y + 1.7 * s, e.pos.z);
        items.throwInvoice(from, player.pos.clone().setY(player.pos.y + 1.3), e.def.dmg * 0.6);
        sfx.toss();
        e.throwCd = 2.2 + Math.random() * 1.8;
      }
      return true;
    }
    e.throwCd -= dt;
    if (e.throwCd > 0 || !sameArea || distP < 3.5 || distP > 16) return false;
    // Only throw with a clear line of sight.
    const from = new THREE.Vector3(e.pos.x, e.pos.y + 1.7 * e.def.scale, e.pos.z);
    const to = player.pos.clone().setY(player.pos.y + 1.4);
    const dir = to.clone().sub(from);
    const dist = dir.length();
    dir.divideScalar(dist);
    if (world.raycast(from, dir, dist) < dist - 0.3) { e.throwCd = 0.4; return false; }
    e.throwT = 0.6;
    return true;
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

  // `combo` is false for mass kills (Market Crash, the shredder) so they don't pay combo bonuses.
  kill(e, head, silent = false, combo = true) {
    const game = this.game;
    e.state = 'dying';
    e.t = 0;
    game.state.kills++;
    if (head) game.state.headshots++;
    const reward = e.def.reward + (head ? 40 : 0);
    game.addCash(reward, e.pos.clone().setY(1.6));
    if (!silent) sfx.kaching(0.06);
    if (!combo) return this.drop(e);
    // Kills less than 2.5 s apart build a combo; from 3 kills it pays a bonus.
    this.comboN = this.comboT > 0 ? this.comboN + 1 : 1;
    this.comboT = 2.5;
    game.state.bestCombo = Math.max(game.state.bestCombo, this.comboN);
    if (this.comboN >= 3) {
      const bonus = 25 * (this.comboN - 2);
      game.addCash(bonus);
      game.hud.combo(this.comboN, bonus);
      sfx.combo(this.comboN);
    }
    this.drop(e);
  }

  // Cash burst and maybe a power-up where an enemy died.
  drop(e) {
    const game = this.game;
    game.items.burst(e.pos.clone().setY(1.2), e.type === 'shark' ? 40 : 14, 'money');
    if (e.type === 'shark') game.items.dropPowerup(e.pos.clone(), 'maxammo');
    else if (this.dropsThisRound < 4 && Math.random() < 0.035) {
      this.dropsThisRound++;
      game.items.dropPowerup(e.pos.clone());
    }
  }

  killAll() {
    for (const e of this.list) if (e.state !== 'dying') this.kill(e, false, true, false);
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
