// Practice dummies and the two enemy structures (a box and a small tower).

import * as THREE from '../../game/vendor/three.module.min.js';
import { isWall } from './pieces.js';
import { slotKey, C, L } from './grid.js';
import { O } from './arena.js';
import { T } from './tuning.js';
import { settings } from './settings.js';
import { sfx } from './audio.js';

// A closed box of `levels` storeys around cell (i, j), counted from the practice ground.
function boxAround(i, j, roof = true, levels = 1) {
  i += O; j += O;
  const s = [];
  for (let k = 0; k < levels; k++) s.push(['wx', i, k, j], ['wx', i + 1, k, j], ['wz', i, k, j], ['wz', i, k, j + 1]);
  if (roof) s.push(['f', i, levels, j]);
  return s;
}
// Middle of cell (i, j), standing on level k.
const at = (i, j, k = 0) => [(O + i + 0.5) * C, k * L, (O + j + 0.5) * C];

const SIZE = 0.86;   // the dummies are as tall as the player

class Dummy {
  constructor(scene, kind, x, y, z, slots) {
    this.kind = kind;
    this.home = { x, y, z };
    this.slots = slots;            // the structure that belongs to this dummy
    this.hw = 0.3 * SIZE;
    this.bodyH = 1.44 * SIZE;
    this.headY = 1.66 * SIZE;
    this.headR = 0.24 * SIZE;
    this.box = { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 };
    this.x = x; this.y = y; this.z = z;
    this.vy = 0;
    this.dir = 1;
    this.turnT = 1;
    this.hp = this.maxHp = T.dummyHp;
    this.alive = true;
    this.wait = 0;
    this.flash = 0;
    this.downs = 0;

    this.mat = new THREE.MeshLambertMaterial({ color: 0xf2993a });
    this.matHead = new THREE.MeshLambertMaterial({ color: 0xffd9a0 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x4a2f1a });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.04, 0.6), this.mat);
    body.position.y = 0.92;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 0.4, 10), dark);
    base.position.y = 0.2;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.62), dark);
    band.position.y = 1.02;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), this.matHead);
    head.position.y = 1.66;
    g.add(body, base, band, head);
    g.scale.setScalar(SIZE);
    scene.add(g);
    this.mesh = g;
    this.sync();
  }

  sync() { this.mesh.position.set(this.x, this.y, this.z); }

  // Returns true when this hit put the dummy down.
  hurt(amount) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.flash = 0.1;
    if (this.hp > 0) return false;
    this.hp = 0;
    this.alive = false;
    this.wait = T.dummyRespawn;
    this.mesh.visible = false;
    this.downs++;
    sfx.down();
    return true;
  }
}

export class Targets {
  constructor(scene, world, pieces) {
    this.world = world;
    this.pieces = pieces;
    this.time = 0;
    this.queue = [];          // enemy walls waiting to be put back
    this.downs = 0;
    this.list = [
      new Dummy(scene, 'strafe', ...at(3, 3), null),
      new Dummy(scene, 'tower', ...at(5, 5, 1), boxAround(5, 5)),
      new Dummy(scene, 'box', ...at(5, 3), boxAround(5, 3)),
      new Dummy(scene, 'strafe', ...at(8, -3), null),
      new Dummy(scene, 'tower', ...at(10, 2, 3), boxAround(10, 2, true, 3)),
      new Dummy(scene, 'far', ...at(13, 5), null),
    ];
    world.dummies = this.list;
    this.boxWalls = new Set(boxAround(5, 3, false).map((s) => slotKey(...s)));
  }

  raise(d, pop) {
    if (!d.slots) return;
    for (const [type, i, k, j] of d.slots) {
      if (!this.pieces.has(type, i, k, j)) this.pieces.add(type, i, k, j, { owner: 'enemy', pop });
    }
  }

  reset() {
    this.queue.length = 0;
    this.downs = 0;
    for (const d of this.list) {
      d.x = d.home.x; d.y = d.home.y; d.z = d.home.z;
      d.vy = 0;
      d.dir = 1;
      d.hp = d.maxHp = T.dummyHp;
      d.alive = true;
      d.downs = 0;
      d.mesh.visible = true;
      d.sync();
      this.raise(d, false);
    }
  }

  // A piece broke: the dummy in the box puts its walls back.
  onBreak(p) {
    if (p.owner !== 'enemy' || !isWall(p.type) || !this.boxWalls.has(p.id)) return;
    if (settings.rebuild === 'off' || !this.list[2].alive) return;
    this.queue.push({ type: p.type, i: p.i, k: p.k, j: p.j, at: this.time + (settings.rebuild === 'fast' ? 0.3 : 0.6) });
  }

  update(dt) {
    this.time += dt;
    for (let n = this.queue.length - 1; n >= 0; n--) {
      const q = this.queue[n];
      if (q.at > this.time) continue;
      this.queue.splice(n, 1);
      // only if the player didn't get a piece in first
      if (this.list[2].alive && this.pieces.canPlace(q.type, q.i, q.k, q.j)) {
        this.pieces.add(q.type, q.i, q.k, q.j, { owner: 'enemy' });
        sfx.enemyPlace();
      }
    }
    for (const d of this.list) {
      if (!d.alive) {
        d.wait -= dt;
        if (d.wait <= 0) {
          d.x = d.home.x; d.y = d.home.y; d.z = d.home.z;
          d.vy = 0;
          d.hp = d.maxHp = T.dummyHp;
          d.alive = true;
          d.mesh.visible = true;
          this.raise(d, true);
        }
        continue;
      }
      if (d.kind === 'strafe' && T.strafeSpeed > 0) {
        d.turnT -= dt;
        if (d.turnT <= 0) { d.turnT = 0.8 + Math.random() * 1.8; if (Math.random() < 0.5) d.dir = -d.dir; }
        const nz = d.z + d.dir * T.strafeSpeed * dt;
        if (Math.abs(nz - d.home.z) > 9 || this.world.blockedAt(d.x, d.y, nz, d.hw, d.bodyH)) d.dir = -d.dir;
        else d.z = nz;
      }
      const g = this.world.floorUnder(d.x, d.y, d.z, d.hw);
      if (d.y > g + 1e-3) {
        d.vy -= T.gravity * dt;
        d.y = Math.max(g, d.y + d.vy * dt);
      } else { d.y = g; d.vy = 0; }
      if (d.flash > 0) {
        d.flash -= dt;
        const e = Math.max(0, d.flash) * 6;
        d.mat.emissive.setScalar(e);
        d.matHead.emissive.setScalar(e);
      }
      d.sync();
    }
  }
}
