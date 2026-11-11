// Building: which slot the crosshair picks, the preview ghost, and placing.

import * as THREE from '../../game/vendor/three.module.min.js';
import { C, L, N, H, SIZE, wallCrossings, levelCrossings, cellOf, facing, DIR_X, DIR_Z } from './grid.js';
import { pieceGeometry, centreOf, surfaceAt, FULL } from './pieces.js';
import { T } from './tuning.js';
import { sfx } from './audio.js';

const DOWN = -0.42;   // looking down further than this means "below me"

export class Builder {
  constructor(scene, pieces, world, player) {
    this.pieces = pieces;
    this.world = world;
    this.player = player;
    this.kind = 'wall';        // wall | floor | ramp | roof
    this.target = null;        // { type, i, k, j, dir, valid }
    this.lastPlace = -1;
    this.time = 0;
    this.geo = new Map();
    this.okMat = new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
    this.badMat = new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    this.ghost = new THREE.Mesh(new THREE.BufferGeometry(), this.okMat);
    this.ghost.visible = false;
    this.ghost.renderOrder = 2;
    scene.add(this.ghost);
    this.placed = 0;
  }

  hide() { this.ghost.visible = false; this.target = null; }

  // Finds the slot for the current look direction and moves the ghost there.
  aim() {
    const a = this.player.rig();
    const hit = this.world.ray(a.ox, a.oy, a.oz, a.dx, a.dy, a.dz, 40);
    const cut = hit ? hit.t + 0.35 : 40;
    let t = null;
    if (this.kind === 'wall') t = this.wall(a, cut);
    else if (this.kind === 'floor') t = this.floor(a, cut);
    else if (this.kind === 'ramp') t = this.ramp(a, cut);
    else t = this.roof(a, cut);
    this.target = t;
    if (!t) { this.ghost.visible = false; return null; }
    const key = t.type + t.dir;
    let g = this.geo.get(key);
    if (!g) this.geo.set(key, g = pieceGeometry(t.type, FULL[t.type], t.dir, 0.015));
    this.ghost.geometry = g;
    this.ghost.material = t.valid ? this.okMat : this.badMat;
    centreOf(t.type, t.i, t.k, t.j, this.ghost.position);
    this.ghost.visible = true;
    return t;
  }

  ok(type, i, k, j) { return this.pieces.canPlace(type, i, k, j); }

  wall(a, cut) {
    const ps = this.pieces, b = this.player.body;
    const feet = Math.max(0, Math.min(H - 1, Math.floor((b.y + 1) / L)));
    for (const cr of wallCrossings(a.ox, a.oz, a.dx, a.dz, 0, Math.min(T.reachWall, cut))) {
      const x = a.ox + a.dx * cr.t, y = a.oy + a.dy * cr.t, z = a.oz + a.dz * cr.t;
      if (y < 0) continue;
      const k = Math.min(H - 1, Math.floor(y / L));
      let type, i, j;
      if (cr.axis === 'x') { type = 'wx'; i = cr.n; j = Math.floor(z / C); if (j < 0 || j > N - 1) continue; }
      else { type = 'wz'; j = cr.n; i = Math.floor(x / C); if (i < 0 || i > N - 1) continue; }
      if (ps.has(type, i, k, j)) continue;     // seen through an edit hole: look further
      for (let kk = k; kk >= Math.min(k, feet); kk--) {
        if (this.ok(type, i, kk, j)) return { type, i, k: kk, j, dir: 0, valid: true };
      }
      return { type, i, k, j, dir: 0, valid: false };
    }
    // Looking steeply up or down: the wall on the edge of my cell, in the direction I face.
    const f = facing(a.dx, a.dz), ci = cellOf(b.x), cj = cellOf(b.z);
    const type = f === 0 || f === 2 ? 'wx' : 'wz';
    const i = f === 0 ? ci + 1 : ci, j = f === 1 ? cj + 1 : cj;
    let k = feet;
    if (ps.has(type, i, k, j) && a.dy > 0.3) k++;
    if (i < 0 || j < 0 || (type === 'wx' ? (i < 1 || i > N - 1) : (j < 1 || j > N - 1)) || k > H - 1) return null;
    if (ps.has(type, i, k, j)) return null;
    return { type, i, k, j, dir: 0, valid: this.ok(type, i, k, j) };
  }

  floor(a, cut) {
    const ps = this.pieces, b = this.player.body, list = [];
    for (const cr of levelCrossings(a.oy, a.dy, 0, Math.min(T.reachFloor, cut))) {
      const x = a.ox + a.dx * cr.t, z = a.oz + a.dz * cr.t;
      if (x < 0 || z < 0 || x >= SIZE || z >= SIZE) continue;
      list.push([Math.floor(x / C), cr.k, Math.floor(z / C)]);
    }
    const feet = Math.floor((b.y + 1.2) / L), f = facing(a.dx, a.dz), ci = cellOf(b.x), cj = cellOf(b.z);
    list.push([ci, feet, cj], [ci + DIR_X[f], feet, cj + DIR_Z[f]], [ci, feet + 1, cj]);
    let first = null;
    for (const [i, k, j] of list) {
      if (i < 0 || j < 0 || i > N - 1 || j > N - 1 || k < 1 || k > H || ps.has('f', i, k, j)) continue;
      if (this.ok('f', i, k, j)) return { type: 'f', i, k, j, dir: 0, valid: true };
      first ||= { type: 'f', i, k, j, dir: 0, valid: false };
    }
    return first;
  }

  // The cell a little ahead of me along the view line, or just in front of what I look at.
  focus(a, cut) {
    const t = Math.max(0, Math.min(T.rampFocus, cut - 0.45));
    const x = a.ox + a.dx * t, z = a.oz + a.dz * t;
    return [cellOf(x), cellOf(z)];
  }

  ramp(a, cut) {
    const ps = this.pieces, b = this.player.body;
    const [i, j] = this.focus(a, cut);
    const f = facing(a.dx, a.dz), ci = cellOf(b.x), cj = cellOf(b.z);
    // The level follows what I stand on. On a ramp, the next cell continues the staircase.
    let k = Math.floor((b.y + 1) / L);
    if (b.onGround) {
      for (let kk = 0; kk < H; kk++) {
        const r = ps.get('r', ci, kk, cj);
        if (!r || b.under.has(r.id) || Math.abs(surfaceAt(r, b.x, b.z) - b.y) > 0.05) continue;
        if (i === ci && j === cj) return null;
        k = b.y - kk * L > 0.4 ? kk + 1 : kk;
        break;
      }
    }
    if (k < 0 || k > H - 1) return null;
    // From a ledge, looking down: a ramp that leads down from here.
    if (a.dy < DOWN && k >= 1 && (i !== ci || j !== cj) && !ps.has('f', i, k, j) && !ps.has('r', i, k, j)) {
      if (ps.has('r', i, k - 1, j)) return null;
      return { type: 'r', i, k: k - 1, j, dir: (f + 2) % 4, valid: this.ok('r', i, k - 1, j) };
    }
    if (ps.has('r', i, k, j)) return null;
    for (let kk = k; kk >= 0; kk--) {
      if (this.ok('r', i, kk, j)) return { type: 'r', i, k: kk, j, dir: f, valid: true };
    }
    return { type: 'r', i, k, j, dir: f, valid: false };
  }

  roof(a, cut) {
    const ps = this.pieces, b = this.player.body;
    const [i, j] = this.focus(a, cut);
    const feet = Math.floor((b.y + 1) / L);
    const k = Math.max(1, Math.min(H, a.dy < DOWN ? feet : feet + 1));
    if (ps.has('c', i, k, j)) return null;
    for (let kk = k; kk >= 1; kk--) {
      if (this.ok('c', i, kk, j)) return { type: 'c', i, k: kk, j, dir: 0, valid: true };
    }
    return { type: 'c', i, k, j, dir: 0, valid: false };
  }

  // Places at the current target. Returns the new piece, or null.
  place() {
    const t = this.aim();
    if (!t || !t.valid) return null;
    const p = this.pieces.add(t.type, t.i, t.k, t.j, { dir: t.dir, owner: 'me' });
    if (!p) return null;
    this.world.onPlaced(p, this.player.body);
    this.lastPlace = this.time;
    this.placed++;
    sfx.place(t.type);
    this.aim();
    return p;
  }

  // While the button is held: place whenever there is a valid target.
  hold(dt, held) {
    this.time += dt;
    if (held && this.target?.valid && this.time - this.lastPlace >= T.buildRepeat) this.place();
  }
}
