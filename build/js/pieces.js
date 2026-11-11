// The piece store: every wall, floor, ramp and roof in the arena, with its
// health, its edit mask, its collision boxes and its mesh.

import * as THREE from '../../game/vendor/three.module.min.js';
import { C, L, WT, CONE_H, RAMP_THICK, slotKey, inBounds, edgesOf, Support } from './grid.js';
import { T } from './tuning.js';
import { WALLS, roofFacets, stairFacets, heightAt } from './shapes.js';

export const TW = C / 3;   // wall tile width
export const TH = L / 3;   // wall tile height
export const QW = C / 2;   // floor quarter width
// A fresh piece. Walls and floors: mask = the tiles that are there. Roofs:
// mask = the corners that are lifted. Ramps have a form instead (see shapes.js).
export const FULL = { wx: 511, wz: 511, f: 15, r: 0, c: 0 };

export function isWall(type) { return type === 'wx' || type === 'wz'; }

// Middle of a piece, the point its mesh is built around.
export function centreOf(type, i, k, j, out = new THREE.Vector3()) {
  switch (type) {
    case 'wx': return out.set(i * C, k * L + L / 2, j * C + C / 2);
    case 'wz': return out.set(i * C + C / 2, k * L + L / 2, j * C);
    case 'f': return out.set(i * C + C / 2, k * L - WT / 2, j * C + C / 2);
    case 'r': return out.set(i * C + C / 2, k * L + L / 2, j * C + C / 2);
    default: return out.set(i * C + C / 2, k * L + CONE_H / 2, j * C + C / 2);
  }
}

// One quarter of a floor as a world-space box.
export function tileBox(type, i, k, j, bit) {
  const a = bit & 1, b = bit >> 1;
  return { x0: i * C + a * QW, x1: i * C + (a + 1) * QW, y0: k * L - WT, y1: k * L, z0: j * C + b * QW, z1: j * C + (b + 1) * QW };
}

// The flat patches of a ramp or roof, inside its cell and measured from its base.
export function facetsOf(spec) {
  return spec.type === 'r' ? stairFacets(spec.form || 'F', spec.dir || 0, spec.side || 0) : roofFacets(spec.mask || 0);
}

// Height of a ramp or roof surface above a point, or null where it has none.
export function surfaceAt(p, x, z) {
  return heightAt(p.facets, x, z, p.i * C, p.k * L, p.j * C);
}

// ---------- geometry ----------
function quad(pos, uv, a, b, c, d, us = 1, vs = 1) {
  pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  uv.push(0, 0, us, 0, us, vs, 0, 0, us, vs, 0, vs);
}

function box(pos, uv, x0, y0, z0, x1, y1, z1) {
  quad(pos, uv, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
  quad(pos, uv, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
  quad(pos, uv, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
  quad(pos, uv, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  quad(pos, uv, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  quad(pos, uv, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
}

// One flat outline of a wall, given in the wall's own plane, as a slab.
function slab(pos, uv, type, poly, half) {
  const at = type === 'wx' ? (s, y, d) => [d, y - L / 2, s - C / 2] : (s, y, d) => [s - C / 2, y - L / 2, d];
  const n = poly.length;
  for (const d of [half, -half]) {
    for (let m = 1; m < n - 1; m++) {
      for (const q of [poly[0], poly[m], poly[m + 1]]) { pos.push(...at(q[0], q[1], d)); uv.push(q[0] / TW, q[1] / TH); }
    }
  }
  for (let m = 0; m < n; m++) {
    const a = poly[m], b = poly[(m + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]) / TW;
    quad(pos, uv, at(a[0], a[1], -half), at(b[0], b[1], -half), at(b[0], b[1], half), at(a[0], a[1], half), len, 0.15);
  }
}

// Geometry of a piece around its centre. spec = { type, mask, dir, form, side }.
// `pad` makes it a little fatter (used for the ghost so it doesn't flicker
// against what is already there).
export function pieceGeometry(spec, pad = 0) {
  const { type, mask } = spec;
  const pos = [], uv = [];
  if (type === 'f') {
    for (let bit = 0; bit < 4; bit++) {
      if (!(mask & (1 << bit))) continue;
      const a = bit & 1, b = bit >> 1;
      box(pos, uv, (a - 1) * QW, -WT / 2 - pad, (b - 1) * QW, a * QW, WT / 2 + pad, b * QW);
    }
  } else if (type === 'wx' || type === 'wz') {
    const shape = WALLS.get(511 & ~mask);
    if (shape) for (const poly of shape.polys) slab(pos, uv, type, poly, WT / 2 + pad);
  } else {
    const ramp = type === 'r', t = ramp ? RAMP_THICK : 0, y0 = ramp ? L / 2 : CONE_H / 2;
    for (const f of facetsOf(spec)) {
      const top = f.pts.map((q) => [q[0] - C / 2, q[1] - y0 + pad, q[2] - C / 2]), n = top.length;
      for (let m = 1; m < n - 1; m++) {
        for (const q of [top[0], top[m], top[m + 1]]) { pos.push(...q); uv.push((q[0] + C / 2) / TW, (q[2] + C / 2) / TW); }
      }
      if (!t) continue;
      const low = top.map((q) => [q[0], q[1] - t - pad, q[2]]);
      for (let m = 1; m < n - 1; m++) {
        for (const q of [low[0], low[m + 1], low[m]]) { pos.push(...q); uv.push((q[0] + C / 2) / TW, (q[2] + C / 2) / TW); }
      }
      for (let m = 0; m < n; m++) {
        const a = m, b = (m + 1) % n;
        quad(pos, uv, low[a], low[b], top[b], top[a], Math.hypot(top[b][0] - top[a][0], top[b][2] - top[a][2]) / TW, 0.2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// A panel with a seam around it, so single tiles stay readable. `clear` is how
// see-through the middle of a panel is (0 = solid); the seams always stay.
function paintPanel(c, clear) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = `rgba(255,255,255,${1 - clear})`;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(40,60,90,0.10)';
  g.fillRect(6, 6, 52, 52);
  g.strokeStyle = clear ? 'rgba(225,240,255,0.9)' : 'rgba(20,35,60,0.55)';
  g.lineWidth = 4;
  g.strokeRect(1, 1, 62, 62);
  g.fillStyle = clear ? 'rgba(225,240,255,0.9)' : 'rgba(20,35,60,0.45)';
  for (const [x, y] of [[9, 9], [55, 9], [9, 55], [55, 55]]) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
}

function panelTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  paintPanel(c, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const COLORS = { me: 0x8fb0d2, enemy: 0xd98478, map: 0x4a5261 };
const DARK = new THREE.Color(0x2b3340);

export class Pieces {
  constructor(scene) {
    this.map = new Map();
    this.support = new Support();
    this.group = new THREE.Group();
    scene.add(this.group);
    this.tex = panelTexture();
    this.glass = 0;            // how see-through the builds are, 0..1
    this.time = 0;
    this.live = new Set();     // pieces that are popping in or flashing
    this.doomed = new Set();   // pieces that lost their support
    this.fx = [];              // meshes of broken pieces, fading out
    this.onBreak = null;       // (piece, cause) => {}
    this.onAdd = null;         // (piece) => {}
  }

  get(type, i, k, j) { return this.map.get(slotKey(type, i, k, j)); }
  has(type, i, k, j) { return this.map.has(slotKey(type, i, k, j)); }

  // Would a new piece stand in this slot?
  canPlace(type, i, k, j) {
    return inBounds(type, i, k, j) && !this.has(type, i, k, j) && this.support.supported(edgesOf(type, i, k, j));
  }

  add(type, i, k, j, { dir = 0, owner = 'me', pop = true } = {}) {
    if (!inBounds(type, i, k, j) || this.has(type, i, k, j)) return null;
    const hp = isWall(type) ? T.wallHp : T.otherHp;
    const p = { id: slotKey(type, i, k, j), type, i, k, j, dir, owner, hp, maxHp: hp, mask: FULL[type],
      form: 'F', side: 0, boxes: [], facets: [], aabb: null, mesh: null, born: pop ? this.time : -1, flash: 0, doom: null };
    const mat = new THREE.MeshLambertMaterial({ map: this.tex, color: COLORS[owner] || COLORS.me,
      side: type === 'f' ? THREE.FrontSide : THREE.DoubleSide, transparent: this.glass > 0, depthWrite: !this.glass });
    p.base = mat.color.clone();
    p.mesh = new THREE.Mesh(pieceGeometry(p), mat);
    centreOf(type, i, k, j, p.mesh.position);
    p.mesh.matrixAutoUpdate = false;
    this.group.add(p.mesh);
    this.shape(p);
    this.map.set(p.id, p);
    this.support.add(p.id, edgesOf(type, i, k, j));
    if (pop && T.placePop > 0) { this.live.add(p); p.mesh.scale.setScalar(0.86); }
    p.mesh.updateMatrix();
    this.onAdd?.(p);
    return p;
  }

  // See-through builds: the panels turn to glass, the seams stay.
  setGlass(clear) {
    clear = Math.max(0, Math.min(0.9, clear));
    if (clear === this.glass) return;
    this.glass = clear;
    paintPanel(this.tex.image, clear);
    this.tex.needsUpdate = true;
    for (const p of this.map.values()) {
      const m = p.mesh.material;
      m.transparent = clear > 0;
      m.depthWrite = !clear;
      m.needsUpdate = true;
    }
  }

  // Collision boxes, surface patches and bounds for the current shape.
  shape(p) {
    const { type, i, k, j } = p;
    p.boxes.length = 0;
    p.facets = [];
    if (type === 'f') {
      for (let bit = 0; bit < 4; bit++) {
        if (!(p.mask & (1 << bit))) continue;
        const b = tileBox(type, i, k, j, bit);
        b.p = p;
        p.boxes.push(b);
      }
    } else if (isWall(type)) {
      // The ends reach a little past the cell so that corners close.
      for (const [s0, y0, s1, y1] of WALLS.get(511 & ~p.mask).boxes) {
        const lo = s0 - (s0 < 1e-6 ? 0.1 : 0), hi = s1 + (s1 > C - 1e-6 ? 0.1 : 0);
        p.boxes.push(type === 'wx'
          ? { x0: i * C - WT / 2, x1: i * C + WT / 2, y0: k * L + y0, y1: k * L + y1, z0: j * C + lo, z1: j * C + hi, p }
          : { x0: i * C + lo, x1: i * C + hi, y0: k * L + y0, y1: k * L + y1, z0: j * C - WT / 2, z1: j * C + WT / 2, p });
      }
    } else {
      p.facets = facetsOf(p);
    }
    if (type === 'wx') p.aabb = { x0: i * C - WT / 2, x1: i * C + WT / 2, y0: k * L, y1: (k + 1) * L, z0: j * C - 0.1, z1: (j + 1) * C + 0.1 };
    else if (type === 'wz') p.aabb = { x0: i * C - 0.1, x1: (i + 1) * C + 0.1, y0: k * L, y1: (k + 1) * L, z0: j * C - WT / 2, z1: j * C + WT / 2 };
    else if (type === 'f') p.aabb = { x0: i * C, x1: (i + 1) * C, y0: k * L - WT, y1: k * L, z0: j * C, z1: (j + 1) * C };
    else if (type === 'r') p.aabb = { x0: i * C, x1: (i + 1) * C, y0: k * L - RAMP_THICK, y1: (k + 1) * L, z0: j * C, z1: (j + 1) * C };
    else p.aabb = { x0: i * C, x1: (i + 1) * C, y0: k * L, y1: k * L + CONE_H, z0: j * C, z1: (j + 1) * C };
  }

  // Walls and floors: the tiles that stay. Roofs: the corners that are lifted.
  setMask(p, mask) {
    if (p.type === 'r' || mask === p.mask) return;
    p.mask = mask;
    this.rebuild(p);
  }

  setRamp(p, form, dir, side) {
    if (p.type !== 'r') return;
    p.form = form; p.dir = dir; p.side = side;
    this.rebuild(p);
  }

  rebuild(p) {
    p.mesh.geometry.dispose();
    p.mesh.geometry = pieceGeometry(p);
    this.shape(p);
  }

  // Returns true when the piece broke.
  damage(p, amount) {
    if (!this.map.has(p.id) || p.owner === 'map') return false;
    p.hp -= amount;
    if (p.hp <= 0) { this.breakPiece(p, 'shot'); return true; }
    p.flash = 0.09;
    this.live.add(p);
    p.mesh.material.color.copy(p.base).lerp(DARK, 0.55 * (1 - p.hp / p.maxHp));
    return false;
  }

  breakPiece(p, cause = 'shot') {
    if (this.map.get(p.id) !== p) return;
    const edges = this.support.edges.get(p.id) || [];
    this.map.delete(p.id);
    this.support.remove(p.id);
    this.live.delete(p);
    this.doomed.delete(p);
    p.mesh.material.transparent = true;
    p.mesh.material.depthWrite = false;
    p.mesh.material.emissive.setScalar(0);
    p.mesh.matrixAutoUpdate = true;
    this.fx.push({ mesh: p.mesh, t: 0 });
    this.onBreak?.(p, cause);
    // Whatever hung on it follows, rippling outwards.
    const floating = this.support.floating();
    if (floating.length) {
      const depth = this.support.depths(floating, edges);
      for (const id of floating) {
        const q = this.map.get(id);
        if (q && q.doom === null) { q.doom = this.time + 0.07 * (depth.get(id) + 1); this.doomed.add(q); }
      }
    }
  }

  update(dt) {
    this.time += dt;
    if (this.doomed.size) {
      let due = null;
      for (const p of this.doomed) if (p.doom <= this.time) (due ||= []).push(p);
      if (due) {
        const floating = new Set(this.support.floating());
        for (const p of due) {
          if (this.map.get(p.id) !== p) { this.doomed.delete(p); continue; }
          if (floating.has(p.id)) this.breakPiece(p, 'collapse');
          else { p.doom = null; this.doomed.delete(p); }   // someone propped it up in time
        }
      }
    }
    for (const p of this.live) {
      let busy = false;
      if (p.born >= 0) {
        const a = T.placePop > 0 ? (this.time - p.born) / T.placePop : 1;
        if (a >= 1) { p.mesh.scale.setScalar(1); p.born = -1; }
        else { p.mesh.scale.setScalar(0.86 + 0.14 * (1 - (1 - a) * (1 - a))); busy = true; }
        p.mesh.updateMatrix();
      }
      if (p.flash > 0) {
        p.flash -= dt;
        p.mesh.material.emissive.setScalar(Math.max(0, p.flash) * 4);
        busy = busy || p.flash > 0;
      }
      if (!busy) this.live.delete(p);
    }
    for (let n = this.fx.length - 1; n >= 0; n--) {
      const f = this.fx[n];
      f.t += dt;
      const a = f.t / 0.22;
      if (a >= 1) {
        this.group.remove(f.mesh);
        f.mesh.geometry.dispose();
        f.mesh.material.dispose();
        this.fx.splice(n, 1);
        continue;
      }
      f.mesh.material.opacity = 1 - a;
      f.mesh.scale.setScalar(1 + 0.12 * a);
      f.mesh.position.y -= dt * 1.5 * a;
    }
  }

  clear() {
    for (const p of this.map.values()) {
      this.group.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    for (const f of this.fx) {
      this.group.remove(f.mesh);
      f.mesh.geometry.dispose();
      f.mesh.material.dispose();
    }
    this.map.clear();
    this.support.clear();
    this.live.clear();
    this.doomed.clear();
    this.fx.length = 0;
  }
}
