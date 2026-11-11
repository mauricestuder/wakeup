// Editing: pick one of your own pieces, mark tiles, confirm.
//   wall / floor   marked tiles are taken out
//   roof           marked tiles lift that corner
//   ramp           marked tiles are the path, starting at the first one
// Only the shapes listed in shapes.js exist. Anything else is refused.

import * as THREE from '../../game/vendor/three.module.min.js';
import { C, L, WT } from './grid.js';
import { TW, TH, QW, FULL, centreOf, isWall } from './pieces.js';
import { WALLS, roofValid, resolveStair, stairTiles, ROOF_NAMES, STAIR_NAMES } from './shapes.js';
import { T } from './tuning.js';
import { sfx } from './audio.js';

const NAMES = { wx: 'wall', wz: 'wall', f: 'floor', r: 'ramp', c: 'roof' };

export class Editor {
  constructor(scene, pieces, world, player) {
    this.pieces = pieces;
    this.world = world;
    this.player = player;
    this.piece = null;
    this.sel = 0;            // marked tiles
    this.first = -1;         // ramps: the tile marked first
    this.paint = null;       // while dragging: true = marking, false = unmarking
    this.changed = false;
    this.hover = -1;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.renderOrder = 3;
    scene.add(this.group);
    const mat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    // tile there / tile taken out, each also in a "crosshair is on it" version
    this.keep = mat(0x4fb4ff, 0.62);
    this.keepHot = mat(0xa6dcff, 0.8);
    this.cut = mat(0xffffff, 0.1);
    this.cutHot = mat(0xffffff, 0.28);
    // roofs and ramps: a marked tile is something added, so it lights up instead
    this.on = mat(0xffb23e, 0.78);
    this.onHot = mat(0xffd591, 0.9);
    this.dead = mat(0x1c2733, 0.35);
    this.tiles = [];
  }

  get active() { return !!this.piece; }

  // The own piece under the crosshair, if it is in reach. An opening counts as
  // open: looking through a window picks what stands behind it, so two pieces
  // can be edited one after the other. With nothing of mine behind it, the
  // opened piece itself is picked, so it can be closed again.
  pick() {
    const a = this.player.rig(), w = this.world;
    let h = w.ray(a.ox, a.oy, a.oz, a.dx, a.dy, a.dz, T.editReach);
    if (h && h.kind === 'piece' && h.piece.owner === 'me') return h.piece;
    h = w.ray(a.ox, a.oy, a.oz, a.dx, a.dy, a.dz, T.editReach, { pick: true });
    if (!h || h.kind !== 'piece' || h.piece.owner !== 'me') return null;
    return h.piece;
  }

  // One press: the own piece under the crosshair goes back to how it was
  // placed. Returns false when there is no such piece.
  resetPiece() {
    const p = this.pick(), ps = this.pieces;
    if (!p) return false;
    const before = p.mesh.geometry;
    if (p.type === 'r') { if (p.form !== 'F') ps.setRamp(p, 'F', p.dir, 0); } else ps.setMask(p, FULL[p.type]);
    if (p.mesh.geometry !== before) {
      sfx.editReset();
      if (p.type === 'r' || p.type === 'c') this.world.onTurned(p, this.player.body);
    }
    return true;
  }

  // Edit key outside edit mode. Returns true when editing started.
  start() {
    const p = this.pick();
    if (!p) { sfx.deny(); return false; }
    this.piece = p;
    this.first = -1;
    if (p.type === 'r') {
      const t = stairTiles(p.form, p.dir, p.side);
      this.sel = t.mask;
      this.first = t.start;
    } else if (p.type === 'c') this.sel = p.mask;
    else this.sel = FULL[p.type] & ~p.mask;
    this.paint = null;
    this.changed = false;
    this.buildOverlay();
    p.mesh.visible = false;
    sfx.editOpen();
    return true;
  }

  buildOverlay() {
    const p = this.piece;
    for (const m of this.tiles) { this.group.remove(m); m.geometry.dispose(); }
    this.tiles.length = 0;
    const n = p.type === 'f' || p.type === 'c' ? 4 : 9, t = WT + 0.06;
    this.group.rotation.set(0, 0, 0);
    for (let bit = 0; bit < n; bit++) {
      let g;
      const m = new THREE.Mesh(undefined, this.keep);
      if (n === 4) {
        g = new THREE.BoxGeometry(QW * 0.94, p.type === 'f' ? t : 0.04, QW * 0.94);
        m.position.set(((bit & 1) - 0.5) * QW, 0, ((bit >> 1) - 0.5) * QW);
      } else if (p.type === 'r') {
        // laid on the slope of the plain ramp
        const gx = bit % 3 - 1, gz = Math.floor(bit / 3) - 1, s = L / C;
        const sx = p.dir === 0 ? s : p.dir === 2 ? -s : 0, sz = p.dir === 1 ? s : p.dir === 3 ? -s : 0;
        g = new THREE.BoxGeometry(TW * 0.94, 0.04, TW * 0.94);
        m.position.set(gx * TW, (gx * sx + gz * sz) * TW + 0.06, gz * TW);
        m.rotation.set(-Math.atan(sz), 0, Math.atan(sx));
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
    if (p.type === 'c') this.group.position.y = p.k * L + 0.03;
    this.group.visible = true;
    this.paintOverlay();
  }

  paintOverlay() {
    const adds = this.piece.type === 'c' || this.piece.type === 'r';
    for (let bit = 0; bit < this.tiles.length; bit++) {
      const marked = !!(this.sel & (1 << bit)), hot = bit === this.hover;
      let m;
      if (this.piece.type === 'r' && bit === 4) m = this.dead;
      else if (adds) m = marked ? (hot ? this.onHot : this.on) : (hot ? this.keepHot : this.keep);
      else m = marked ? (hot ? this.cutHot : this.cut) : (hot ? this.keepHot : this.keep);
      this.tiles[bit].material = m;
    }
  }

  // Which tile of the piece the crosshair is on, or -1.
  tileAt() {
    const p = this.piece, a = this.player.rig();
    let t;
    if (p.type === 'wx') t = (p.i * C - a.ox) / a.dx;
    else if (p.type === 'wz') t = (p.j * C - a.oz) / a.dz;
    else if (p.type === 'f') t = (p.k * L - WT / 2 - a.oy) / a.dy;
    else if (p.type === 'c') t = (p.k * L - a.oy) / a.dy;
    else {
      // the slope of the plain ramp: y = base + s * (distance up the ramp)
      const s = L / C, sx = p.dir === 0 ? s : p.dir === 2 ? -s : 0, sz = p.dir === 1 ? s : p.dir === 3 ? -s : 0;
      const cx = (p.i + 0.5) * C, cz = (p.j + 0.5) * C, cy = p.k * L + L / 2;
      t = (cy + sx * (a.ox - cx) + sz * (a.oz - cz) - a.oy) / (a.dy - sx * a.dx - sz * a.dz);
    }
    if (!(t > 0) || t > T.editReach + 4) return -1;
    const x = a.ox + a.dx * t, y = a.oy + a.dy * t, z = a.oz + a.dz * t;
    if (p.type === 'f' || p.type === 'c') {
      const u = Math.floor((x - p.i * C) / QW), v = Math.floor((z - p.j * C) / QW);
      return u < 0 || u > 1 || v < 0 || v > 1 ? -1 : u + 2 * v;
    }
    if (p.type === 'r') {
      const u = Math.floor((x - p.i * C) / TW), v = Math.floor((z - p.j * C) / TW);
      return u < 0 || u > 2 || v < 0 || v > 2 || (u === 1 && v === 1) ? -1 : v * 3 + u;
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
    if (on && !this.sel) this.first = bit;
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
    this.first = -1;
    this.changed = true;
    this.paint = null;
    this.paintOverlay();
  }

  // What the marked tiles would make: { name, apply() }, or null when that is no real shape.
  result() {
    const p = this.piece, ps = this.pieces, sel = this.sel;
    if (isWall(p.type)) {
      const shape = WALLS.get(sel);
      return shape ? { name: shape.name, apply: () => ps.setMask(p, 511 & ~sel) } : null;
    }
    if (p.type === 'f') return sel === 15 ? null : { name: sel ? 'Floor with a cut' : 'Floor', apply: () => ps.setMask(p, 15 & ~sel) };
    if (p.type === 'c') {
      if (!roofValid(sel)) return null;
      const n = (sel & 1) + (sel >> 1 & 1) + (sel >> 2 & 1) + (sel >> 3 & 1);
      return { name: ROOF_NAMES[n === 2 && (sel === 6 || sel === 9) ? 4 : n], apply: () => ps.setMask(p, sel) };
    }
    // No tile marked is the plain ramp, the way it points now.
    const b = this.player.body;
    const r = sel ? resolveStair(sel, this.first, b.x - p.i * C, b.z - p.j * C) : { form: 'F', dir: p.dir, side: 0 };
    if (!r) return null;
    const same = r.form === p.form && r.dir === p.dir && r.side === p.side;
    return { name: STAIR_NAMES[r.form], apply: () => { if (!same) ps.setRamp(p, r.form, r.dir, r.side); } };
  }

  // Ends the edit. A selection that is no real shape leaves the piece as it was.
  confirm() {
    const p = this.piece;
    if (!p) return;
    const r = this.result();
    if (!r) sfx.deny();
    else {
      const before = p.mesh.geometry;
      r.apply();
      if (p.mesh.geometry !== before) {
        sfx.editConfirm();
        if (p.type === 'r' || p.type === 'c') this.world.onTurned(p, this.player.body);
      }
    }
    this.close();
  }

  close() {
    if (this.piece?.mesh) this.piece.mesh.visible = true;
    this.piece = null;
    this.paint = null;
    this.hover = -1;
    this.group.visible = false;
  }

  describe() { return this.piece ? NAMES[this.piece.type] : ''; }

  // Name of the shape the marked tiles make, or '' when there is none.
  label() {
    if (!this.piece) return '';
    return this.result()?.name || '';
  }
}
