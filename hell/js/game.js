// The game simulation. No DOM in here: main.js drives it, draw.js paints it,
// and both read `events` for sounds and particles.

import { buildPath, posAt, canPlace } from './maps.js';
import { ETYPES, rbeOf, LINES } from './enemies.js';
import { TOWERS, computeStats, canUpgrade } from './towers.js';
import { roundSpawns, LAST_ROUND, bossHpMul } from './rounds.js';

export const DIFFS = {
  easy:   { name: 'Easy',   lives: 150, price: 0.85 },
  normal: { name: 'Normal', lives: 100, price: 1 },
  hard:   { name: 'Hard',   lives: 50,  price: 1.15 },
};
export const DT = 1 / 60;

export class Game {
  constructor(map, diffKey) {
    this.map = map;
    this.path = buildPath(map);
    this.diffKey = diffKey;
    this.diff = DIFFS[diffKey];
    this.cash = 650;
    this.lives = this.diff.lives;
    this.round = 0;           // rounds completed
    this.active = false;      // a round is running
    this.spawns = []; this.spawnI = 0; this.roundT = 0;
    this.enemies = []; this.towers = []; this.projs = []; this.events = [];
    this.time = 0; this.nextId = 1;
    this.over = false; this.won = false;
    this.tipShops = [];
    this.kidSink = null;
    this.sayCd = 3;
    this.pops = 0;
  }

  // ---------- money ----------
  price(c) { return Math.round(c * this.diff.price / 5) * 5; }
  towerCost(key) { return this.price(TOWERS[key].cost); }
  upgradeCost(t, p) {
    const u = TOWERS[t.key].paths[p][t.lvl[p]];
    return u ? this.price(u.cost) : null;
  }
  sellValue(t) { return Math.floor(t.spent * 0.7); }

  // ---------- towers ----------
  canPlaceAt(key, x, y) { return canPlace(this.map, this.path, this.towers, x, y, TOWERS[key].r); }

  place(key, x, y) {
    const D = TOWERS[key], cost = this.towerCost(key);
    if (this.cash < cost || !this.canPlaceAt(key, x, y)) return null;
    this.cash -= cost;
    const t = {
      id: this.nextId++, key, x, y, r: D.r, lvl: [0, 0], s: computeStats(key, [0, 0]),
      cdT: 0.1, mode: key === 'auditor' ? 2 : 0, ang: -Math.PI / 2, spent: cost, pops: 0,
      hold: 0, push: 0, hurt: 0, anim: 0, spin: 0,
    };
    this.towers.push(t);
    this.refreshTips();
    this.events.push({ k: 'place', x, y, key });
    return t;
  }

  upgrade(t, p) {
    if (!canUpgrade(t.lvl, p)) return false;
    const c = this.upgradeCost(t, p);
    if (c == null || this.cash < c) return false;
    this.cash -= c;
    t.spent += c;
    t.lvl[p]++;
    t.s = computeStats(t.key, t.lvl);
    this.refreshTips();
    this.events.push({ k: 'upgrade', x: t.x, y: t.y });
    return true;
  }

  sell(t) {
    const i = this.towers.indexOf(t);
    if (i < 0) return;
    this.cash += this.sellValue(t);
    this.towers.splice(i, 1);
    this.refreshTips();
    this.events.push({ k: 'sell', x: t.x, y: t.y, v: this.sellValue(t) });
  }

  refreshTips() { this.tipShops = this.towers.filter(t => t.key === 'shop' && t.s.tips); }

  // ---------- rounds ----------
  startRound() {
    if (this.active || this.over) return false;
    this.active = true;
    this.roundT = 0;
    this.spawnI = 0;
    this.spawns = roundSpawns(this.round + 1);
    this.events.push({ k: 'roundStart', n: this.round + 1 });
    return true;
  }

  endRound() {
    this.active = false;
    this.round++;
    const bonus = 100 + this.round;
    let income = 0;
    for (const t of this.towers) {
      if (t.key !== 'shop') continue;
      income += t.s.income;
      if (t.s.interest) income += Math.min(Math.floor(this.cash * t.s.interest), t.s.interestMax);
    }
    this.cash += bonus + income;
    this.events.push({ k: 'roundEnd', n: this.round, bonus, income });
    for (const t of this.towers) if (t.key === 'shop') this.events.push({ k: 'income', x: t.x, y: t.y });
    if (this.round === LAST_ROUND && !this.won) {
      this.won = true;
      this.events.push({ k: 'win' });
    }
  }

  // ---------- sinners ----------
  spawn(type, d, camo, hpMul = 1) {
    const T = ETYPES[type];
    const hp = T.boss ? Math.round(T.hp * hpMul) : T.hp;
    const e = {
      id: this.nextId++, t: type, hp, maxHp: hp, d, camo: !!camo && !T.boss, r: T.r,
      slowF: 1, slowT: 0, stunT: 0, burnT: 0, burnTick: 0, burnSrc: null,
      x: 0, y: 0, dx: 1, alive: true, flash: 0, say: null, sayT: 0,
      seed: (this.nextId * 7.13) % 6.28, hpMul,
    };
    posAt(this.path, d, e);
    this.enemies.push(e);
    if (this.kidSink) this.kidSink.push(e.id);
    return e;
  }

  // Returns false if the hit bounced off.
  damage(e, dmg, kind, src) {
    if (!e.alive) return false;
    if (kind === 'sharp' && ETYPES[e.t].noSharp) {
      this.events.push({ k: 'clang', x: e.x, y: e.y });
      return false;
    }
    this.pop(e, dmg, src);
    return true;
  }

  pop(e, dmg, src) {
    e.hp -= dmg;
    const T = ETYPES[e.t];
    if (e.hp > 0) {
      e.flash = 0.08;
      if (T.boss) this.events.push({ k: 'bossHit', x: e.x, y: e.y });
      return;
    }
    const over = -e.hp;
    e.alive = false;
    let cash = T.boss ? Math.round(e.maxHp / 4) : 1;
    for (const s of this.tipShops) {
      const dx = s.x - e.x, dy = s.y - e.y;
      if (dx * dx + dy * dy < s.s.range * s.s.range) cash++;
    }
    this.cash += cash;
    this.pops++;
    if (src) src.pops++;
    this.events.push({ k: 'pop', x: e.x, y: e.y, t: e.t, boss: !!T.boss });
    const n = T.kids.length;
    for (let i = 0; i < n; i++) {
      const kd = Math.max(0, e.d + (i - (n - 1) / 2) * (T.boss ? 16 : 8));
      const c = this.spawn(T.kids[i], kd, e.camo, e.hpMul);
      c.burnT = e.burnT; c.burnTick = e.burnTick; c.burnSrc = e.burnSrc;
      c.slowF = e.slowF; c.slowT = e.slowT;
      if (over > 0) this.pop(c, over, src);
    }
  }

  inRange(t, e, range = t.s.range) {
    const dx = e.x - t.x, dy = e.y - t.y, r = range + e.r;
    return dx * dx + dy * dy <= r * r;
  }

  score(t, e) {
    switch (t.mode) {
      case 1: return -e.d;
      case 2: return rbeOf(e) * 1e5 + e.d;
      case 3: return -((e.x - t.x) ** 2 + (e.y - t.y) ** 2);
      default: return e.d;
    }
  }

  pickTargets(t, n = 1) {
    const list = [];
    for (const e of this.enemies) {
      if (!e.alive || e.d < 0 || (e.camo && !t.s.detect) || !this.inRange(t, e)) continue;
      list.push(e);
    }
    if (n === 1) {
      let best = null, bs = -Infinity;
      for (const e of list) { const s = this.score(t, e); if (s > bs) { bs = s; best = e; } }
      return best ? [best] : list;
    }
    return list.sort((a, b) => this.score(t, b) - this.score(t, a)).slice(0, n);
  }

  anyInRange(t, needDetect) {
    for (const e of this.enemies)
      if (e.alive && (!needDetect || !e.camo || t.s.detect) && this.inRange(t, e)) return true;
    return false;
  }

  // ---------- main step ----------
  step() {
    if (this.over) return;
    const dt = DT;
    this.time += dt;

    if (this.active) {
      this.roundT += dt;
      const mul = bossHpMul(this.round + 1);
      while (this.spawnI < this.spawns.length && this.spawns[this.spawnI].t <= this.roundT) {
        const s = this.spawns[this.spawnI++];
        this.spawn(s.type, 0, s.camo, mul);
      }
    }

    for (const e of this.enemies) if (e.slowT > 0 && (e.slowT -= dt) <= 0) e.slowF = 1;

    for (const t of this.towers) this.updateTower(t, dt);
    this.updateProjs(dt);

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.sayT > 0 && (e.sayT -= dt) <= 0) e.say = null;
      if (e.burnT > 0) {
        e.burnT -= dt;
        if ((e.burnTick -= dt) <= 0) {
          e.burnTick = 0.9;
          this.damage(e, 1, 'fire', e.burnSrc);
          if (!e.alive) continue;
        }
      }
      if (e.stunT > 0) e.stunT -= dt;
      else e.d += ETYPES[e.t].speed * e.slowF * dt;
      posAt(this.path, e.d, e);
      if (e.d >= this.path.len) {
        e.alive = false;
        const lost = rbeOf(e);
        this.lives -= lost;
        this.events.push({ k: 'leak', n: lost, t: e.t, boss: !!ETYPES[e.t].boss });
        if (this.lives <= 0) {
          this.lives = 0;
          this.over = true;
          this.events.push({ k: 'lose' });
          return;
        }
      }
    }
    // compact in place
    let j = 0;
    for (let i = 0; i < this.enemies.length; i++) if (this.enemies[i].alive) this.enemies[j++] = this.enemies[i];
    this.enemies.length = j;

    this.updateSpeech(dt);

    if (this.active && this.spawnI >= this.spawns.length && this.enemies.length === 0) this.endRound();
  }

  updateSpeech(dt) {
    if ((this.sayCd -= dt) > 0 || !this.enemies.length) return;
    this.sayCd = 2.2 + Math.random() * 2.5;
    let talking = 0;
    for (const e of this.enemies) if (e.say) talking++;
    if (talking >= 2) return;
    const e = this.enemies[(Math.random() * this.enemies.length) | 0];
    if (e.say || e.x < 60 || e.x > 1220) return;
    const lines = LINES[e.t];
    e.say = lines[(Math.random() * lines.length) | 0];
    e.sayT = 2.4;
  }

  updateTower(t, dt) {
    const s = t.s;
    t.cdT -= dt;
    if (t.anim > 0) t.anim -= dt;
    switch (t.key) {
      case 'stamp': {
        if (t.cdT > 0) break;
        const [e] = this.pickTargets(t);
        if (!e) break;
        t.cdT = s.cd;
        t.anim = 0.15;
        t.ang = Math.atan2(e.y - t.y, e.x - t.x);
        for (let i = 0; i < s.count; i++) {
          const a = t.ang + (i - (s.count - 1) / 2) * s.spread * Math.PI / 180;
          this.projs.push({
            k: 'stamp', x: t.x, y: t.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
            life: (s.range + 60) / s.speed, dmg: s.dmg, pierce: s.pierce, kind: s.kind, r: s.psize,
            hit: new Set(), src: t, rot: a, big: s.kind === 'magic',
          });
        }
        this.events.push({ k: 'throw' });
        break;
      }
      case 'fork': {
        if (s.ring) {
          t.spin += dt * 6;
          if (t.cdT > 0 || !this.anyInRange(t, false)) break;
          t.cdT = s.ringCd;
          t.anim = 0.2;
          let n = 0;
          for (const e of this.enemies) {
            if (n >= 40) break;
            if (e.alive && this.inRange(t, e)) { this.damage(e, s.dmg, 'fire', t); n++; }
          }
          this.events.push({ k: 'ring', x: t.x, y: t.y, r: s.range });
          break;
        }
        if (t.cdT > 0 || !this.anyInRange(t, true)) break;
        t.cdT = s.cd;
        t.anim = 0.25;
        t.spin += Math.PI / s.count;
        for (let i = 0; i < s.count; i++) {
          const a = t.spin + i * Math.PI * 2 / s.count;
          this.projs.push({
            k: 'fork', x: t.x, y: t.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
            life: (s.range + 20) / s.speed, dmg: s.dmg, pierce: s.pierce, kind: s.kind, r: s.psize,
            hit: new Set(), src: t, rot: a, burn: s.burn,
          });
        }
        this.events.push({ k: 'spin' });
        break;
      }
      case 'lava': {
        if (t.cdT > 0) break;
        const targets = this.pickTargets(t, s.targets);
        if (!targets.length) break;
        t.cdT = s.cd;
        t.anim = 0.3;
        const lead = { x: 0, y: 0, dx: 1 };
        for (const e of targets) {
          const T = 0.38;
          posAt(this.path, e.stunT > 0 ? e.d : e.d + ETYPES[e.t].speed * e.slowF * T, lead);
          this.projs.push({
            k: 'lava', sx: t.x, sy: t.y - 10, tx: lead.x, ty: lead.y, x: t.x, y: t.y, tt: 0, T,
            dmg: s.dmg, pierce: s.pierce, blast: s.blast, stun: s.stun, shake: s.shake, src: t,
          });
        }
        this.events.push({ k: 'erupt' });
        break;
      }
      case 'phone': {
        const bossF = s.bossSlow ? s.slow : 1 - (1 - s.slow) * 0.5;
        let any = false;
        for (const e of this.enemies) {
          if (!e.alive || ETYPES[e.t].noSlow || !this.inRange(t, e)) continue;
          any = true;
          const f = ETYPES[e.t].boss ? bossF : s.slow;
          e.slowF = e.slowT > 0 ? Math.min(e.slowF, f) : f;
          e.slowT = 0.1;
        }
        t.anim = any ? 0.2 : t.anim;
        if (s.holdCd && (t.hold -= dt) <= 0 && any) {
          t.hold = s.holdCd;
          for (const e of this.enemies)
            if (e.alive && !ETYPES[e.t].noSlow && this.inRange(t, e))
              e.stunT = Math.max(e.stunT, ETYPES[e.t].boss ? 0.25 : s.holdT);
          this.events.push({ k: 'hold', x: t.x, y: t.y, r: s.range });
        }
        if (s.pushCd && (t.push -= dt) <= 0 && any) {
          t.push = s.pushCd;
          const list = this.enemies.filter(e => e.alive && !ETYPES[e.t].noSlow && !ETYPES[e.t].boss && this.inRange(t, e))
            .sort((a, b) => b.d - a.d).slice(0, s.pushN);
          for (const e of list) e.d = Math.max(0, e.d - s.push);
          if (list.length) this.events.push({ k: 'press1', x: t.x, y: t.y });
        }
        if (s.hurtCd && (t.hurt -= dt) <= 0 && any) {
          t.hurt = s.hurtCd;
          for (const e of this.enemies)
            if (e.alive && !ETYPES[e.t].noSlow && this.inRange(t, e)) this.damage(e, 1, 'magic', t);
        }
        break;
      }
      case 'auditor': {
        if (t.cdT > 0) break;
        const targets = this.pickTargets(t, s.multi);
        if (!targets.length) break;
        t.cdT = s.cd;
        t.anim = 0.2;
        t.ang = Math.atan2(targets[0].y - t.y, targets[0].x - t.x);
        for (const e of targets) {
          this.events.push({ k: 'shot', x1: t.x, y1: t.y, x2: e.x, y2: e.y });
          const dmg = s.dmg * (ETYPES[e.t].boss ? s.bossMul : 1);
          if (this.damage(e, dmg, s.kind, t) && s.cashPerHit) this.cash += s.cashPerHit;
        }
        break;
      }
    }
  }

  updateProjs(dt) {
    for (const p of this.projs) {
      if (p.k === 'lava') {
        p.tt += dt;
        const f = Math.min(1, p.tt / p.T);
        p.x = p.sx + (p.tx - p.sx) * f;
        p.y = p.sy + (p.ty - p.sy) * f - Math.sin(f * Math.PI) * 70;
        if (f < 1) continue;
        p.dead = true;
        let n = 0;
        for (const e of this.enemies) {
          if (n >= p.pierce) break;
          if (!e.alive) continue;
          const dx = e.x - p.tx, dy = e.y - p.ty, r = p.blast + e.r;
          if (dx * dx + dy * dy > r * r) continue;
          n++;
          if (p.stun) e.stunT = Math.max(e.stunT, ETYPES[e.t].boss ? p.stun * 0.25 : p.stun);
          this.damage(e, p.dmg, 'blast', p.src);
        }
        this.events.push({ k: 'boom', x: p.tx, y: p.ty, r: p.blast, shake: p.shake });
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      for (const e of this.enemies) {
        if (!e.alive || p.hit.has(e.id)) continue;
        const dx = e.x - p.x, dy = e.y - p.y, r = e.r + p.r;
        if (dx * dx + dy * dy > r * r) continue;
        p.hit.add(e.id);
        if (p.burn && !(p.kind === 'sharp' && ETYPES[e.t].noSharp)) {
          e.burnT = 3; e.burnSrc = p.src; if (e.burnTick <= 0) e.burnTick = 0.9;
        }
        this.kidSink = [];
        const ok = this.damage(e, p.dmg, p.kind, p.src);
        for (const id of this.kidSink) p.hit.add(id);
        this.kidSink = null;
        if (ok && p.k === 'stamp') this.events.push({ k: 'decal', x: e.x, y: e.y, big: p.big });
        p.pierce = ok ? p.pierce - 1 : 0;
        if (p.pierce <= 0) { p.dead = true; break; }
      }
    }
    let j = 0;
    for (let i = 0; i < this.projs.length; i++) if (!this.projs[i].dead) this.projs[j++] = this.projs[i];
    this.projs.length = j;
  }
}
