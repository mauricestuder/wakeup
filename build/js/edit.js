// Editing: pick one of your own pieces, mark tiles, confirm. The marked tiles
// are the ones that get removed.

import * as THREE from '../../game/vendor/three.module.min.js';
import { C, L, WT } from './grid.js';
import { TW, TH, QW, FULL, centreOf, isWall } from './pieces.js';
import { T } from './tuning.js';
import { sfx } from './audio.js';

export class Editor {
  constructor(scene, pieces, world, player) {
    this.pieces = pieces;
    this.world = world;
    this.player = player;
    this.piece = null;
    this.sel = 0;            // tiles marked for removal
    this.paint = null;       // while dragging: true = marking, false = unmarking
    this.changed = false;
    this.hover = -1;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.renderOrder = 3;
    scene.add(this.group);
    this.keep = new THREE.MeshBasicMaterial({ color: 0x4fb4ff, transparent: true, opacity: 0.62, depthWrite: false });
    this.keepHot = new THREE.MeshBasicMaterial({ color: 0xa6dcff, transparent: true, opacity: 0.8, depthWrite: false });
    this.cut = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false });
    this.cutHot = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false });
    this.tiles = [];
  }

  get active() { return !!this.piece; }

  // The own piece under the crosshair, if it is in reach.
  pick() {
    const a = this.player.rig();
    const h = this.world.ray(a.ox, a.oy, a.oz, a.dx, a.dy, a.dz, T.editReach, { pick: true });
    if (!h || h.kind !== 'piece' || h.piece.owner !== 'me' || h.piece.type === 'c') return null;
    return h.piece;
  }

  // Edit key outside edit mode. Returns 'edit', 'turned' or null.
  start() {
    const p = this.pick();
    if (!p) { sfx.deny(); return null; }
    if (p.type === 'r') {
      this.pieces.rotate(p);
      this.world.onTurned(p, this.player.body);
      sfx.turn();
      return 'turned';
    }
    this.piece = p;
    this.sel = FULL[p.type] & ~p.mask;
    this.paint = null;
    this.changed = false;
    this.buildOverlay();
    p.mesh.visible = false;
    sfx.editOpen();
    return 'edit';
  }

  buildOverlay() {
    const p = this.piece;
    for (const m of this.tiles) { this.group.remove(m); m.geometry.dispose(); }
    this.tiles.length = 0;
    const n = p.type === 'f' ? 4 : 9, t = WT + 0.06;
    for (let bit = 0; bit < n; bit++) {
      let g;
      const m = new THREE.Mesh(undefined, this.keep);
      if (p.type === 'f') {
        g = new THREE.BoxGeometry(QW * 0.94, t, QW * 0.94);
        m.position.set(((bit & 1) - 0.5) * QW, 0, ((bit >> 1) - 0.5) * QW);
      } else {
        const row = Math.floor(bit / 3), col = bit % 3, s = (col - 1) * TW, y = (row - 1) * TH;
        if (p.type === 'wx') { g = new THREE.BoxGeometry(t, TH * 0.92, TW * 0.94); m.position.set(0, y, s); }
        else { g = new THREE.BoxGeometry(TW * 0.94, TH * 0.92, t); m.position.set(s, y, 0); }
      }
      m.geometry = g;
      m.renderOrder = 3;
      this.group.add(m);
      this.tiles.push(m);
    }
    centreOf(p.type, p.i, p.k, p.j, this.group.position);
    this.group.visible = true;
    this.paintOverlay();
  }

  paintOverlay() {
    for (let bit = 0; bit < this.tiles.length; bit++) {
      const cut = !!(this.sel & (1 << bit)), hot = bit === this.hover;
      this.tiles[bit].material = cut ? (hot ? this.cutHot : this.cut) : (hot ? this.keepHot : this.keep);
    }
  }

  // Which tile of the piece the crosshair is on, or -1.
  tileAt() {
    const p = this.piece, a = this.player.rig();
    let t;
    if (p.type === 'wx') t = (p.i * C - a.ox) / a.dx;
    else if (p.type === 'wz') t = (p.j * C - a.oz) / a.dz;
    else t = (p.k * L - WT / 2 - a.oy) / a.dy;
    if (!(t > 0) || t > T.editReach + 4) return -1;
    const x = a.ox + a.dx * t, y = a.oy + a.dy * t, z = a.oz + a.dz * t;
    if (p.type === 'f') {
      const u = Math.floor((x - p.i * C) / QW), v = Math.floor((z - p.j * C) / QW);
      return u < 0 || u > 1 || v < 0 || v > 1 ? -1 : u + 2 * v;
    }
    const col = Math.floor(((p.type === 'wx' ? z - p.j * C : x - p.i * C)) / TW), row = Math.floor((y - p.k * L) / TH);
    return col < 0 || col > 2 || row < 0 || row > 2 ? -1 : row * 3 + col;
  }

  press() {
    if (!this.piece) return;
    const bit = this.tileAt();
    if (bit < 0) { this.paint = null; return; }
    this.paint = !(this.sel & (1 << bit));
    this.set(bit, this.paint);
  }

  set(bit, on) {
    const had = !!(this.sel & (1 << bit));
    if (had === on) return;
    this.sel = on ? this.sel | (1 << bit) : this.sel & ~(1 << bit);
    this.changed = true;
    sfx.editTile(on);
    this.paintOverlay();
  }

  // Every frame while editing. Dragging with the button held paints tiles.
  update(held) {
    if (!this.piece) return false;
    if (this.pieces.map.get(this.piece.id) !== this.piece) { this.close(); return false; }   // it broke meanwhile
    const bit = this.tileAt();
    if (bit !== this.hover) { this.hover = bit; this.paintOverlay(); }
    if (held && this.paint !== null && bit >= 0) this.set(bit, this.paint);
    if (!held) this.paint = null;
    return true;
  }

  reset() {
    if (!this.piece) return;
    if (this.sel) sfx.editReset();
    this.sel = 0;
    this.changed = true;
    this.paint = null;
    this.paintOverlay();
  }

  // Returns true when the edit mode ends.
  confirm() {
    const p = this.piece;
    if (!p) return true;
    const mask = FULL[p.type] & ~this.sel;
    if (!mask) { sfx.deny(); return false; }      // at least one tile has to stay
    if (mask !== p.mask) { this.pieces.setMask(p, mask); sfx.editConfirm(); }
    this.close();
    return true;
  }

  close() {
    if (this.piece?.mesh) this.piece.mesh.visible = true;
    this.piece = null;
    this.paint = null;
    this.hover = -1;
    this.group.visible = false;
  }

  describe() {
    const p = this.piece;
    return p ? (isWall(p.type) ? 'wall' : 'floor') : '';
  }
}
