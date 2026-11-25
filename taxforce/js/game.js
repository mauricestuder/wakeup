// The game simulation. No DOM in here: main.js drives it, draw.js paints it,
// and both read `events` for sounds and particles.

import { buildPaths, posAt, canPlace, isUnder } from './maps.js';
import { ETYPES, rbeOf, LINES, SHOUTS } from './enemies.js';
import { TOWERS, computeStats, canUpgrade, PATHS } from './towers.js';
import { roundSpawns, LAST_ROUND, bossHpMul } from './rounds.js';

export const DIFFS = {
  easy:   { name: 'Easy',   lives: 150, price: 0.85 },
  normal: { name: 'Normal', lives: 100, price: 1 },
  hard:   { name: 'Hard',   lives: 50,  price: 1.15 },
};
export const DT = 1 / 60;
const isBoss = e => !!ETYPES[e.t].boss;

export class Game {
  constructor(map, diffKey) {
    this.map = map;
    this.paths = buildPaths(map);       // one or more roads from manholes to the bank
    this.path = this.paths[0];
    this.spawnCount = 0;
    this.diffKey = diffKey;
    this.diff = DIFFS[diffKey];
    this.cash = 650;
    this.lives = this.diff.lives;
    this.round = 0;           // rounds completed
    this.active = false;      // a round is running
    this.spawns = []; this.spawnI = 0; this.roundT = 0;
    this.enemies = []; this.towers = []; this.projs = []; this.traps = []; this.events = [];
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
  canPlaceAt(key, x, y) { return canPlace(this.map, this.paths, this.towers, x, y, TOWERS[key].r); }

  place(key, x, y) {
    const D = TOWERS[key], cost = this.towerCost(key);
    if (this.cash < cost || !this.canPlaceAt(key, x, y)) return null;
    this.cash -= cost;
    const lvl = new Array(PATHS).fill(0);
    const t = {
      id: this.nextId++, key, x, y, r: D.r, lvl, s: computeStats(key, lvl), es: null,
      cdT: 0.1, mode: { chad: 2, collector: 2, kicker: 3 }[key] ?? 0, ang: Math.PI / 2, spent: cost, pops: 0, say: null, sayT: 0,
      hold: 0, push: 0, hurt: 0, anim: 0, spin: 0, rageClock: 0, raging: false, smashT: 2, pullT: 0, rizzT: 0, alt: 0, pathDs: [],
      droneA: Math.random() * 6.28, dpos: [],
    };
    this.towers.push(t);
    this.refresh();
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
    this.refresh();
    this.events.push({ k: 'upgrade', x: t.x, y: t.y });
    return true;
  }

  sell(t) {
    const i = this.towers.indexOf(t);
    if (i < 0) return;
    this.cash += this.sellValue(t);
    this.towers.splice(i, 1);
    for (const tr of this.traps) if (tr.src === t) tr.life = Math.min(tr.life, 0.5);
    this.refresh();
    this.events.push({ k: 'sell', x: t.x, y: t.y, v: this.sellValue(t) });
  }

  // Recompute everything that depends on which bros stand where:
  // tip jars, buff auras (effective stats `es`) and road spots for droppers.
  refresh() {
    this.tipShops = this.towers.filter(t => t.s.tips);
    const sources = this.towers.filter(t => t.s.buff);
    for (const t of this.towers) {
      let b = null;
      for (const src of sources) {
        if (src === t || Math.hypot(src.x - t.x, src.y - t.y) > src.s.range) continue;
        const sb = src.s.buff;
        b = b || { cd: 1, dmg: 0, rng: 0, detect: false };
        b.cd = Math.min(b.cd, sb.cd); b.dmg = Math.max(b.dmg, sb.dmg); b.rng = Math.max(b.rng, sb.rng); b.detect = b.detect || sb.detect;
      }
      t.buffed = !!b;
      if (!b) { t.es = t.s; }
      else {
        const s = t.es = { ...t.s };
        if (s.cd) s.cd *= b.cd;
        if (s.ringCd) s.ringCd *= b.cd;
        if (s.dmg != null && !t.s.buff) s.dmg += b.dmg;
        if (s.range && s.range < 2000 && !t.s.buff) s.range += b.rng;
        if (b.detect) s.detect = true;
      }
      if (t.key === 'treadmill') {
        t.pathDs = [];
        const r = t.es.range;
        for (const path of this.paths)
          for (let i = 0; i < path.n; i += 4)
            if (!isUnder(path, i * 2) && Math.hypot(path.px[i] - t.x, path.py[i] - t.y) < r) t.pathDs.push({ path, d: i * 2 });
      }
    }
  }

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
      if (t.s.income) { income += t.s.income; this.events.push({ k: 'income', x: t.x, y: t.y }); }
      if (t.s.interest) income += Math.min(Math.floor(this.cash * t.s.interest), t.s.interestMax);
    }
    this.cash += bonus + income;
    this.events.push({ k: 'roundEnd', n: this.round, bonus, income });
    if (this.round === LAST_ROUND && !this.won) {
      this.won = true;
      this.events.push({ k: 'win' });
    }
  }

  // ---------- rats ----------
  spawn(type, d, camo, hpMul = 1, path = null) {
    const T = ETYPES[type];
    const hp = T.boss ? Math.round(T.hp * hpMul) : T.hp;
    const e = {
      id: this.nextId++, t: type, hp, maxHp: hp, d, camo: !!camo && !T.boss, r: T.r,
      slowF: 1, slowT: 0, stunT: 0, burnT: 0, burnTick: 0, burnSrc: null, burnDmg: 1,
      expT: 0, expAdd: 0, expMul: 1,
      x: 0, y: 0, dx: 1, ang: 0, fa: null, alive: true, flash: 0, say: null, sayT: 0,
      seed: (this.nextId * 7.13) % 6.28, hpMul, under: true,
      p: path || this.paths[this.spawnCount++ % this.paths.length],
    };
    posAt(e.p, d, e);
    e.under = isUnder(e.p, d);
    this.enemies.push(e);
    if (this.kidSink) this.kidSink.push(e.id);
    return e;
  }

  // Returns false if the hit bounced off.
  damage(e, dmg, kind, src) {
    if (!e.alive || e.under) return false;
    if (kind === 'sharp' && ETYPES[e.t].noSharp) {
      this.events.push({ k: 'clang', x: e.x, y: e.y });
      return false;
    }
    if (e.expT > 0) dmg = (dmg + e.expAdd) * e.expMul;
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
      if (dx * dx + dy * dy < s.s.range * s.s.range) cash += s.s.tips;
    }
    this.cash += cash;
    this.pops++;
    if (src) src.pops++;
    this.events.push({ k: 'pop', x: e.x, y: e.y, t: e.t, boss: !!T.boss });
    const n = T.kids.length;
    for (let i = 0; i < n; i++) {
      const kd = Math.max(0, e.d + (i - (n - 1) / 2) * (T.boss ? 16 : 8));
      const c = this.spawn(T.kids[i], kd, e.camo, e.hpMul, e.p);
      c.burnT = e.burnT; c.burnTick = e.burnTick; c.burnSrc = e.burnSrc; c.burnDmg = e.burnDmg;
      c.slowF = e.slowF; c.slowT = e.slowT;
      c.expT = e.expT; c.expAdd = e.expAdd; c.expMul = e.expMul;
      if (over > 0) this.pop(c, over, src);
    }
  }

  // status helpers
  slow(e, f, time) {
    e.slowF = e.slowT > 0 ? Math.min(e.slowF, f) : f;
    e.slowT = Math.max(e.slowT, time);
  }
  stun(e, time) { e.stunT = Math.max(e.stunT, isBoss(e) ? time * 0.25 : time); }
  burn(e, src, dmg = 1) {
    e.burnT = 3; e.burnSrc = src; e.burnDmg = Math.max(e.burnDmg, dmg);
    if (e.burnTick <= 0) e.burnTick = 0.9;
  }

  inRange(t, e, range = t.es.range) {
    if (e.under) return false;          // still in the manhole or in a tunnel
    const dx = e.x - t.x, dy = e.y - t.y, r = range + e.r;
    return dx * dx + dy * dy <= r * r;
  }

  score(t, e) {
    switch (t.mode) {
      case 1: return e.p.len - e.d;
      case 2: return rbeOf(e) * 1e5 + e.d - e.p.len;
      case 3: return -((e.x - t.x) ** 2 + (e.y - t.y) ** 2);
      default: return e.d - e.p.len;     // first = closest to the bank
    }
  }

  pickTargets(t, n = 1) {
    const list = [];
    for (const e of this.enemies) {
      if (!e.alive || e.d < 0 || (e.camo && !t.es.detect) || !this.inRange(t, e)) continue;
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
      if (e.alive && !e.under && (!needDetect || !e.camo || t.es.detect) && this.inRange(t, e)) return true;
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
        this.spawn(s.type, 0, s.camo, mul * s.hp);
      }
    }

    for (const e of this.enemies) {
      if (e.slowT > 0 && (e.slowT -= dt) <= 0) e.slowF = 1;
      if (e.expT > 0) e.expT -= dt;
    }

    for (const t of this.towers) this.updateTower(t, dt);
    this.updateProjs(dt);
    this.updateTraps(dt);

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.sayT > 0 && (e.sayT -= dt) <= 0) e.say = null;
      if (e.burnT > 0) {
        e.burnT -= dt;
        if ((e.burnTick -= dt) <= 0) {
          e.burnTick = 0.9;
          this.damage(e, e.burnDmg, 'fire', e.burnSrc);
          if (!e.alive) continue;
        }
      }
      if (e.stunT > 0) e.stunT -= dt;
      else e.d = Math.max(0, e.d + ETYPES[e.t].speed * e.slowF * dt);
      posAt(e.p, e.d, e);
      e.under = isUnder(e.p, e.d);
      if (e.fa == null) e.fa = e.ang;
      else { let da = e.ang - e.fa; da = Math.atan2(Math.sin(da), Math.cos(da)); e.fa += da * Math.min(1, dt * 9); }
      if (e.d >= e.p.len) {
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
    for (const t of this.towers) if (t.sayT > 0 && (t.sayT -= dt) <= 0) t.say = null;
    if ((this.sayCd -= dt) > 0) return;
    this.sayCd = 2.0 + Math.random() * 2.5;
    if (this.towers.length && (Math.random() < 0.4 || !this.enemies.length)) {
      if (!this.active) return;
      const t = this.towers[(Math.random() * this.towers.length) | 0];
      if (!t.say) { t.say = SHOUTS[(Math.random() * SHOUTS.length) | 0]; t.sayT = 1.8; }
      return;
    }
    if (!this.enemies.length) return;
    let talking = 0;
    for (const e of this.enemies) if (e.say) talking++;
    if (talking >= 2) return;
    const e = this.enemies[(Math.random() * this.enemies.length) | 0];
    if (e.say || e.x < 60 || e.x > 1220) return;
    const lines = LINES[e.t];
    e.say = lines[(Math.random() * lines.length) | 0];
    e.sayT = 2.4;
  }

  // ---------- projectiles: they lock on and steer, so they don't miss ----------
  shoot(t, k, a, tgt, o) {
    const s = t.es, speed = o.speed;
    this.projs.push({
      k, x: (o.ox ?? t.x) + Math.cos(a) * 14, y: (o.oy ?? t.y) + Math.sin(a) * 14, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, speed,
      tgt, hit: new Set(), src: t, rot: a, age: 0, life: o.life, dmg: o.dmg ?? s.dmg, pierce: o.pierce ?? s.pierce,
      kind: o.kind ?? s.kind, r: o.r ?? 10, detect: !!s.detect, retarget: o.retarget ?? 150, turn: o.turn ?? 10,
      burn: !!s.burn, burnDmg: s.burnDmg || 1, big: !!o.big, bossMul: s.bossMul || 1, cashPerHit: s.cashPerHit || 0,
      stunHit: s.stunHit || 0, slowHit: s.slowHit || 0, slowHitT: s.slowHitT || 0, blastHit: s.blastHit || 0, trail: [],
    });
  }

  nearestUnhit(p, radius) {
    let best = null, bd = radius * radius;
    for (const e of this.enemies) {
      if (!e.alive || e.under || p.hit.has(e.id) || (e.camo && !p.detect)) continue;
      const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d2 < bd) { bd = d2; best = e; }
    }
    return best;
  }

  // Cooldown after an attack, including rage mode.
  reload(t, cd) { t.cdT = cd * (t.raging ? t.es.rage.mul : 1); }

  updateTower(t, dt) {
    const s = t.es || t.s;
    t.cdT -= dt;
    if (t.anim > 0) t.anim -= dt;
    if (s.rage) { t.rageClock += dt; t.raging = (t.rageClock % s.rage.every) < s.rage.dur; }
    switch (t.key) {
      case 'dumbbell': {
        if (t.cdT > 0) break;
        const targets = this.pickTargets(t, s.count);
        if (!targets.length) break;
        this.reload(t, s.cd);
        t.anim = 0.18;
        t.ang = Math.atan2(targets[0].y - t.y, targets[0].x - t.x);
        for (let i = 0; i < s.count; i++) {
          const a = t.ang + (i - (s.count - 1) / 2) * 0.35;
          this.shoot(t, 'dumbbell', a, targets[i % targets.length],
            { speed: s.speed, life: (s.range + 120) / s.speed, r: s.psize, big: s.kind === 'magic' || s.dmg >= 6 });
        }
        this.events.push({ k: 'throw' });
        break;
      }
      case 'spinner': {
        if (s.smash && (t.smashT -= dt) <= 0) {
          const [e] = this.pickTargets({ ...t, mode: 2 });
          if (e) {
            t.smashT = s.smash.cd;
            const hitOne = (z) => this.damage(z, s.smash.dmg * (isBoss(z) ? s.smash.bossMul : 1), 'blast', t);
            hitOne(e);
            if (s.smash.blast) for (const z of this.enemies) if (z !== e && z.alive && !z.under && Math.hypot(z.x - e.x, z.y - e.y) < s.smash.blast + z.r) hitOne(z);
            this.events.push({ k: 'smash', x: e.x, y: e.y, big: !!s.smash.blast });
          }
        }
        if (s.pull && (t.pullT -= dt) <= 0 && this.anyInRange(t, false)) {
          t.pullT = s.pull.cd;
          const list = this.enemies.filter(e => e.alive && !isBoss(e) && this.inRange(t, e)).sort((a, b) => b.d - a.d).slice(0, s.pull.n);
          for (const e of list) e.d = Math.max(0, e.d - s.pull.d);
          if (list.length) this.events.push({ k: 'pull', x: t.x, y: t.y, r: s.range });
        }
        if (s.ring) {
          t.spin += dt * 6;
          if (t.cdT > 0 || !this.anyInRange(t, false)) break;
          t.cdT = s.ringCd;
          t.anim = 0.2;
          let n = 0;
          for (const e of this.enemies) {
            if (n >= 40) break;
            if (e.alive && this.inRange(t, e)) { this.damage(e, s.dmg * (isBoss(e) ? s.bossMul || 1 : 1), 'fire', t); n++; }
          }
          this.events.push({ k: 'ring', x: t.x, y: t.y, r: s.range });
          break;
        }
        if (t.cdT > 0 || !this.anyInRange(t, true)) break;
        this.reload(t, s.cd);
        t.anim = 0.25;
        t.spin += Math.PI / s.count;
        // Every plate flies out in its own direction, then curves onto the rat closest to that direction.
        const cands = this.enemies.filter(e => e.alive && (!e.camo || s.detect) && this.inRange(t, e, s.range + 30))
          .map(e => ({ e, a: Math.atan2(e.y - t.y, e.x - t.x) }));
        for (let i = 0; i < s.count; i++) {
          const a = t.spin + i * Math.PI * 2 / s.count;
          let tgt = null, best = 1.25;
          for (const c of cands) {
            const da = Math.abs(Math.atan2(Math.sin(c.a - a), Math.cos(c.a - a)));
            if (da < best) { best = da; tgt = c.e; }
          }
          if (!tgt && cands.length) tgt = cands[i % cands.length].e;   // boomerang back onto someone
          this.shoot(t, 'plate', a, tgt, { speed: s.speed, life: (s.range + 30) / s.speed, r: s.psize, turn: 14, retarget: s.range + 60 });
        }
        this.events.push({ k: 'spin' });
        break;
      }
      case 'shake': {
        if (t.cdT > 0) break;
        const targets = this.pickTargets(t, s.targets);
        if (!targets.length) break;
        this.reload(t, s.cd);
        t.anim = 0.3;
        t.ang = Math.atan2(targets[0].y - t.y, targets[0].x - t.x);
        for (const e of targets) {
          this.projs.push({
            k: 'shake', sx: t.x, sy: t.y, tx: e.x, ty: e.y, x: t.x, y: t.y, h: 0, tt: 0, T: 0.45, tgt: e, trail: [], src: t,
          });
        }
        this.events.push({ k: 'erupt' });
        break;
      }
      case 'dj': {
        const bossF = s.bossSlow ? s.slow : 1 - (1 - s.slow) * 0.5;
        const hears = (e) => s.hearAll || !ETYPES[e.t].noSlow;
        let any = false;
        for (const e of this.enemies) {
          if (!e.alive || !hears(e) || !this.inRange(t, e)) continue;
          any = true;
          this.slow(e, isBoss(e) ? bossF : s.slow, 0.1);
        }
        t.anim = any ? 0.2 : t.anim;
        if (s.holdCd && (t.hold -= dt) <= 0 && any) {
          t.hold = s.holdCd;
          for (const e of this.enemies) if (e.alive && hears(e) && this.inRange(t, e)) this.stun(e, s.holdT);
          this.events.push({ k: 'hold', x: t.x, y: t.y, r: s.range });
        }
        if (s.pushCd && (t.push -= dt) <= 0 && any) {
          t.push = s.pushCd;
          const list = this.enemies.filter(e => e.alive && hears(e) && (!isBoss(e) || s.pushBoss) && this.inRange(t, e))
            .sort((a, b) => b.d - a.d).slice(0, s.pushN);
          for (const e of list) e.d = Math.max(0, e.d - (isBoss(e) ? s.pushBoss : s.push));
          if (list.length) this.events.push({ k: 'press1', x: t.x, y: t.y });
        }
        if (s.hurtCd && (t.hurt -= dt) <= 0 && any) {
          t.hurt = s.hurtCd;
          for (const e of this.enemies) if (e.alive && hears(e) && this.inRange(t, e)) this.damage(e, s.hurtDmg || 1, 'magic', t);
        }
        break;
      }
      case 'chad': {
        if (s.rizz && (t.rizzT -= dt) <= 0 && this.enemies.length) {
          t.rizzT = s.rizz.cd;
          for (const e of this.enemies) if (e.alive && !e.under) e.stunT = Math.max(e.stunT, isBoss(e) ? 0.5 : s.rizz.t);
          this.events.push({ k: 'rizz', x: t.x, y: t.y });
        }
        if (t.cdT > 0) break;
        const targets = this.pickTargets(t, s.multi);
        if (!targets.length) break;
        this.reload(t, s.cd);
        t.anim = 0.25;
        t.ang = Math.atan2(targets[0].y - t.y, targets[0].x - t.x);
        for (const e of targets) {
          const a = Math.atan2(e.y - t.y, e.x - t.x);
          this.shoot(t, 'frisbee', a, e, { speed: 1150, life: 3, r: 11, retarget: s.pierce > 1 ? 200 : 2000, turn: 16 });
        }
        this.events.push({ k: 'shot' });
        break;
      }
      case 'influencer': {
        if (s.reveal) for (const e of this.enemies) if (e.camo && e.alive && this.inRange(t, e)) { e.camo = false; this.events.push({ k: 'reveal', x: e.x, y: e.y }); }
        if (t.cdT > 0 || !this.anyInRange(t, false)) break;
        this.reload(t, s.cd);
        t.anim = 0.35;
        let n = 0;
        for (const e of this.enemies) {
          if (!e.alive || !this.inRange(t, e)) continue;
          n++;
          this.stun(e, s.flashT);
          if (s.expose || s.exposeMul > 1) {
            if (!isBoss(e) || s.exposeBoss || s.exposeMul > 1) { e.expT = 3; e.expAdd = Math.max(e.expAdd, s.expose); e.expMul = Math.max(e.expMul, s.exposeMul); }
          }
          if (s.flashDmg) this.damage(e, s.flashDmg, 'magic', t);
        }
        if (s.cashPerStun) this.cash += Math.min(n, 30) * s.cashPerStun;
        this.events.push({ k: 'flash', x: t.x, y: t.y, r: s.range });
        break;
      }
      case 'legs': {
        if (t.cdT > 0 || !this.anyInRange(t, false)) break;
        this.reload(t, s.cd);
        t.anim = 0.3;
        let n = 0;
        for (const e of this.enemies) {
          if (n >= s.pierce) break;
          if (!e.alive || !this.inRange(t, e)) continue;
          n++;
          if (s.stun) this.stun(e, s.stun);
          if (s.slowHit) this.slow(e, s.slowHit, s.slowHitT);
          if (s.knock) e.d = Math.max(0, e.d - (isBoss(e) ? (s.knockBoss || 0) : s.knock));
          this.damage(e, s.dmg * (isBoss(e) ? s.bossMul || 1 : 1), 'blast', t);
        }
        this.events.push({ k: 'stomp', x: t.x, y: t.y, r: s.range, shake: s.shake });
        break;
      }
      case 'kicker': {
        if (t.cdT > 0) break;
        const targets = this.pickTargets(t, s.targets);
        if (!targets.length) break;
        this.reload(t, s.cd);
        t.anim = 0.22;
        t.ang = Math.atan2(targets[0].y - t.y, targets[0].x - t.x);
        for (const e of targets) {
          // kick first, so the robbers that fall out of him land further back too
          const kb = isBoss(e) ? s.knockBoss : s.knock;
          if (kb) { e.d = Math.max(0, e.d - kb); posAt(e.p, e.d, e); }
          if (s.stun) this.stun(e, s.stun);
          if (this.damage(e, s.dmg * (isBoss(e) ? s.bossMul : 1), s.kind, t) && s.cashPerHit) this.cash += s.cashPerHit;
          this.events.push({ k: 'kick', x: e.x, y: e.y });
        }
        break;
      }
      case 'collector': {
        if (t.cdT > 0) break;
        const targets = this.pickTargets({ ...t, mode: 2 }, s.targets);
        if (!targets.length) break;
        this.reload(t, s.cd);
        t.anim = 0.4;
        t.ang = Math.atan2(targets[0].y - t.y, targets[0].x - t.x);
        for (const e of targets) {
          this.stun(e, s.stun);
          this.events.push({ k: 'grab', x: e.x, y: e.y, fx: t.x, fy: t.y });
          if (this.damage(e, s.dmg * (isBoss(e) ? s.bossMul : 1), s.kind, t) && s.cashPerHit) this.cash += s.cashPerHit;
        }
        break;
      }
      case 'cannon': {
        if (t.cdT > 0) break;
        const targets = this.pickTargets(t, s.targets);
        if (!targets.length) break;
        this.reload(t, s.cd);
        t.anim = 0.35;
        t.ang = Math.atan2(targets[0].y - t.y, targets[0].x - t.x);
        for (const e of targets)
          this.projs.push({ k: 'ball', sx: t.x + Math.cos(t.ang) * 26, sy: t.y + Math.sin(t.ang) * 26, tx: e.x, ty: e.y, x: t.x, y: t.y, h: 0, tt: 0, T: s.flight, tgt: e, trail: [], src: t });
        this.events.push({ k: 'cannon', x: t.x, y: t.y });
        break;
      }
      case 'drone': {
        // the drones fly a lap around their spot; everything happens from up there
        const n = s.drones || 1;
        t.droneA += dt * 220 / s.orbit;
        t.dpos = [];
        for (let i = 0; i < n; i++) {
          const a = t.droneA + i * Math.PI * 2 / n;
          t.dpos.push({ x: t.x + Math.cos(a) * s.orbit, y: t.y + Math.sin(a) * s.orbit * 0.8, a: a + Math.PI / 2 });
        }
        if (s.reveal) for (const e of this.enemies)
          if (e.camo && e.alive && t.dpos.some(d => this.inRange({ x: d.x, y: d.y, es: s }, e))) { e.camo = false; this.events.push({ k: 'reveal', x: e.x, y: e.y }); }
        if (t.cdT > 0) break;
        let fired = false;
        for (const d of t.dpos) {
          const eye = { x: d.x, y: d.y, es: s, mode: t.mode };
          const targets = this.pickTargets(eye, s.count || 1);
          for (let i = 0; i < targets.length; i++) {
            const e = targets[i], a = Math.atan2(e.y - d.y, e.x - d.x);
            this.shoot(t, 'letter', a, e, { speed: 620, life: 1.4, r: 9, ox: d.x, oy: d.y, retarget: 120, turn: 14 });
            fired = true;
          }
        }
        if (fired) { this.reload(t, s.cd); t.anim = 0.2; this.events.push({ k: 'throw' }); }
        break;
      }
      case 'treadmill': {
        if (t.cdT > 0 || !t.pathDs.length || !this.active) break;
        const mine = this.traps.reduce((n, tr) => n + (tr.src === t), 0);
        if (mine >= s.maxTraps) break;
        this.reload(t, s.cd);
        t.anim = 0.3;
        let front = null;
        if (s.smart) for (const e of this.enemies) if (e.alive && this.inRange(t, e) && (!front || e.d - e.p.len > front.d - front.p.len)) front = e;
        for (let i = 0; i < s.perDrop && mine + i < s.maxTraps; i++) {
          let spot;
          if (front) spot = { path: front.p, d: front.d + 30 + i * 26 };
          else spot = t.pathDs[(Math.random() * t.pathDs.length) | 0];
          const kb = (t.alt++ % 2) === 1;
          this.dropTrap(t, kb ? 'kb' : 'tm', Math.min(spot.d, spot.path.len - 10), {}, spot.path);
        }
        break;
      }
    }
  }

  dropTrap(t, k, d, o = {}, path = this.path) {
    const s = t.es, pos = posAt(path, d, { x: 0, y: 0, dx: 1, ang: 0 });
    const tr = { k, d, x: pos.x, y: pos.y, ang: pos.ang, src: t, hit: new Set(), tickT: 0, age: 0 };
    if (k === 'kb') Object.assign(tr, { r: 12, life: s.kbLife * s.lifeMul, pierce: s.kbPierce, dmg: s.kbDmg * s.trapMul, kind: s.kbKind, blast: s.kbBlast });
    else if (k === 'tm') Object.assign(tr, { r: 24, life: s.tmLife * s.lifeMul, slow: s.tmSlow, dmg: s.tmDmg * s.trapMul, tick: 0.5, boss: s.tmBoss });
    else Object.assign(tr, o);
    tr.maxLife = tr.life;
    this.traps.push(tr);
    this.events.push({ k: 'drop', x: tr.x, y: tr.y });
  }

  updateTraps(dt) {
    for (const tr of this.traps) {
      tr.life -= dt; tr.age += dt;
      if (tr.life <= 0) continue;
      if (tr.k === 'kb') {
        for (const e of this.enemies) {
          if (!e.alive || e.under || tr.hit.has(e.id) || Math.hypot(e.x - tr.x, e.y - tr.y) > tr.r + e.r) continue;
          if (tr.blast) {   // minefield: blow up on the first rat
            for (const z of this.enemies) if (z.alive && !z.under && Math.hypot(z.x - tr.x, z.y - tr.y) < tr.blast + z.r) this.damage(z, tr.dmg, 'blast', tr.src);
            this.events.push({ k: 'boom', x: tr.x, y: tr.y, r: tr.blast });
            tr.life = 0;
            break;
          }
          tr.hit.add(e.id);
          this.kidSink = [];
          const ok = this.damage(e, tr.dmg, tr.kind, tr.src);
          for (const id of this.kidSink) tr.hit.add(id);
          this.kidSink = null;
          if (ok) this.events.push({ k: 'decal', x: e.x, y: e.y });
          if (--tr.pierce <= 0) { tr.life = 0; break; }
        }
      } else {          // treadmill or puddle: works on everyone standing on it
        const tick = tr.dmg && (tr.tickT -= dt) <= 0;
        if (tick) tr.tickT = tr.tick;
        for (const e of this.enemies) {
          if (!e.alive || e.under || Math.hypot(e.x - tr.x, e.y - tr.y) > tr.r + e.r * 0.5) continue;
          if (tr.slow != null && tr.slow < 1) {
            if (!isBoss(e)) this.slow(e, tr.slow, 0.1);
            else if (tr.boss) this.slow(e, 0.5, 0.1);
          }
          if (tick) this.damage(e, tr.dmg, 'magic', tr.src);
        }
      }
    }
    let j = 0;
    for (let i = 0; i < this.traps.length; i++) if (this.traps[i].life > 0) this.traps[j++] = this.traps[i];
    this.traps.length = j;
  }

  updateProjs(dt) {
    for (const p of this.projs) {
      p.trail.push(p.x, p.y);
      if (p.trail.length > 12) p.trail.splice(0, 2);
      if (p.k === 'shake' || p.k === 'ball') {
        // The cup / ball keeps aiming at its rat until it lands on it.
        if (p.tgt && p.tgt.alive) { p.tx = p.tgt.x; p.ty = p.tgt.y; }
        p.tt += dt;
        const f = Math.min(1, p.tt / p.T);
        p.x = p.sx + (p.tx - p.sx) * f;
        p.y = p.sy + (p.ty - p.sy) * f;
        p.h = Math.sin(f * Math.PI);
        if (f < 1) continue;
        p.dead = true;
        const s = p.src.es || p.src.s;
        let n = 0;
        for (const e of this.enemies) {
          if (n >= s.pierce) break;
          if (!e.alive || e.under) continue;
          const dx = e.x - p.tx, dy = e.y - p.ty, r = s.blast + e.r;
          if (dx * dx + dy * dy > r * r) continue;
          n++;
          if (s.stun) this.stun(e, s.stun);
          if (s.slowHit) this.slow(e, s.slowHit, s.slowHitT);
          if (s.burn) this.burn(e, p.src);
          this.damage(e, s.dmg * (isBoss(e) ? s.bossMul || 1 : 1), 'blast', p.src);
        }
        if (s.puddle) // gross puddle where it landed
          this.dropTrap(p.src, 'puddle', 0, { x: p.tx, y: p.ty, ang: 0, r: s.puddle.r, life: s.puddle.life, dmg: s.puddle.dmg, tick: s.puddle.tick, slow: s.puddle.slow, coins: !!s.puddle.coins });
        this.events.push({ k: 'boom', x: p.tx, y: p.ty, r: s.blast, shake: s.shake, coin: p.k === 'ball' });
        continue;
      }
      p.age += dt;
      // steer toward the locked target; find a new one if it died
      if (p.tgt && (!p.tgt.alive || p.hit.has(p.tgt.id))) p.tgt = this.nearestUnhit(p, p.retarget);
      if (p.tgt) {
        const dx = p.tgt.x - p.x, dy = p.tgt.y - p.y, d = Math.hypot(dx, dy) || 1;
        const k = p.age > 0.6 ? 1 : Math.min(1, p.turn * dt);
        p.vx += (dx / d * p.speed - p.vx) * k;
        p.vy += (dy / d * p.speed - p.vy) * k;
        const v = Math.hypot(p.vx, p.vy) || 1;
        p.vx = p.vx / v * p.speed; p.vy = p.vy / v * p.speed;
        if (p.age < 3) p.life = Math.max(p.life, 0.2);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot = Math.atan2(p.vy, p.vx);
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      for (const e of this.enemies) {
        if (!e.alive || e.under || p.hit.has(e.id)) continue;
        const dx = e.x - p.x, dy = e.y - p.y, r = e.r + p.r;
        if (dx * dx + dy * dy > r * r) continue;
        p.hit.add(e.id);
        const blocked = p.kind === 'sharp' && ETYPES[e.t].noSharp;
        if (!blocked) {
          if (p.burn) this.burn(e, p.src, p.burnDmg);
          if (p.stunHit) this.stun(e, p.stunHit);
          if (p.slowHit) this.slow(e, p.slowHit, p.slowHitT);
        }
        this.kidSink = [];
        const dmg = p.dmg * (ETYPES[e.t].boss ? p.bossMul : 1);
        const ok = this.damage(e, dmg, p.kind, p.src);
        if (ok && p.blastHit) {   // aura farming: the frisbee explodes
          let n = 0;
          for (const z of this.enemies) {
            if (n >= 5) break;
            if (z === e || !z.alive || z.under || p.hit.has(z.id) || Math.hypot(z.x - p.x, z.y - p.y) > p.blastHit + z.r) continue;
            n++; this.damage(z, dmg, 'blast', p.src);
          }
          this.events.push({ k: 'boom', x: p.x, y: p.y, r: p.blastHit });
        }
        for (const id of this.kidSink) p.hit.add(id);
        this.kidSink = null;
        if (ok && p.cashPerHit) this.cash += p.cashPerHit;
        if (ok) this.events.push({ k: 'decal', x: e.x, y: e.y, big: p.big, p: p.k });
        p.pierce = ok ? p.pierce - 1 : 0;
        if (p.pierce <= 0) { p.dead = true; break; }
        // keep going: lock onto the next rat nearby
        p.tgt = this.nearestUnhit(p, p.retarget);
        if (!p.tgt) p.life = Math.min(p.life, 0.25);
      }
    }
    let j = 0;
    for (let i = 0; i < this.projs.length; i++) if (!this.projs[i].dead) this.projs[j++] = this.projs[i];
    this.projs.length = j;
  }
}
