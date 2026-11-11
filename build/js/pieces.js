// The piece store: every wall, floor, ramp and roof in the arena, with its
// health, its edit mask, its collision boxes and its mesh.

import * as THREE from '../../game/vendor/three.module.min.js';
import { C, L, WT, CONE_H, RAMP_THICK, slotKey, inBounds, edgesOf, Support, DIR_X, DIR_Z } from './grid.js';
import { T } from './tuning.js';

export const TW = C / 3;   // wall tile width
export const TH = L / 3;   // wall tile height
export const QW = C / 2;   // floor quarter width
export const FULL = { wx: 511, wz: 511, f: 15, r: 1, c: 1 };
const TILES = { wx: 9, wz: 9, f: 4 };

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

// One tile of a wall or floor as a world-space box. `grow` lengthens the end
// columns of a wall so that corners close for collision.
export function tileBox(type, i, k, j, bit, grow = 0) {
  if (type === 'f') {
    const a = bit & 1, b = bit >> 1;
    return { x0: i * C + a * QW, x1: i * C + (a + 1) * QW, y0: k * L - WT, y1: k * L, z0: j * C + b * QW, z1: j * C + (b + 1) * QW };
  }
  const row = Math.floor(bit / 3), col = bit % 3;
  const lo = col * TW - (col === 0 ? grow : 0), hi = (col + 1) * TW + (col === 2 ? grow : 0);
  const y0 = k * L + row * TH, y1 = y0 + TH;
  if (type === 'wx') return { x0: i * C - WT / 2, x1: i * C + WT / 2, y0, y1, z0: j * C + lo, z1: j * C + hi };
  return { x0: i * C + lo, x1: i * C + hi, y0, y1, z0: j * C - WT / 2, z1: j * C + WT / 2 };
}

// Height of a ramp or roof surface above a point of its cell.
export function surfaceAt(p, x, z) {
  if (p.type === 'r') {
    let u;
    if (p.dir === 0) u = x - p.i * C; else if (p.dir === 1) u = z - p.j * C;
    else if (p.dir === 2) u = (p.i + 1) * C - x; else u = (p.j + 1) * C - z;
    return p.k * L + L * Math.min(1, Math.max(0, u / C));
  }
  const dx = Math.abs(x - (p.i + 0.5) * C), dz = Math.abs(z - (p.j + 0.5) * C);
  return p.k * L + CONE_H * (1 - Math.min(1, Math.max(dx, dz) / (C / 2)));
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

// Geometry of a piece around its centre. `pad` makes it a little fatter (used
// for the ghost and the edit overlay so they don't flicker against the piece).
export function pieceGeometry(type, mask, dir = 0, pad = 0) {
  const pos = [], uv = [];
  if (type === 'f') {
    for (let bit = 0; bit < 4; bit++) {
      if (!(mask & (1 << bit))) continue;
      const a = bit & 1, b = bit >> 1;
      box(pos, uv, (a - 1) * QW, -WT / 2 - pad, (b - 1) * QW, a * QW, WT / 2 + pad, b * QW);
    }
  } else if (type === 'wx' || type === 'wz') {
    for (let bit = 0; bit < 9; bit++) {
      if (!(mask & (1 << bit))) continue;
      const row = Math.floor(bit / 3), col = bit % 3;
      const s0 = col * TW - C / 2, s1 = s0 + TW, y0 = row * TH - L / 2, y1 = y0 + TH, h = WT / 2 + pad;
      if (type === 'wx') box(pos, uv, -h, y0, s0, h, y1, s1);
      else box(pos, uv, s0, y0, -h, s1, y1, h);
    }
  } else if (type === 'r') {
    const dx = DIR_X[dir], dz = DIR_Z[dir], h = C / 2, t = RAMP_THICK;
    // u runs up the slope, v across it
    const P = (u, y, v) => [u * dx - v * dz, y, u * dz + v * dx];
    const A = P(-h, -L / 2 + pad, -h), B = P(-h, -L / 2 + pad, h), Cc = P(h, L / 2 + pad, h), D = P(h, L / 2 + pad, -h);
    const A2 = P(-h, -L / 2 - t, -h), B2 = P(-h, -L / 2 - t, h), C2 = P(h, L / 2 - t, h), D2 = P(h, L / 2 - t, -h);
    quad(pos, uv, A, B, Cc, D, 3, 3);
    quad(pos, uv, B2, A2, D2, C2, 3, 3);
    quad(pos, uv, A2, B2, B, A, 3, 0.2);
    quad(pos, uv, C2, D2, D, Cc, 3, 0.2);
    quad(pos, uv, B2, C2, Cc, B, 3, 0.2);
    quad(pos, uv, D2, A2, A, D, 3, 0.2);
  } else {
    const h = C / 2 + pad, y0 = -CONE_H / 2, top = [0, CONE_H / 2 + pad, 0];
    const c = [[-h, y0, -h], [-h, y0, h], [h, y0, h], [h, y0, -h]];
    for (let n = 0; n < 4; n++) {
      pos.push(...c[n], ...c[(n + 1) % 4], ...top);
      uv.push(0, 0, 2, 0, 1, 1.2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// A panel with a seam around it, so single tiles stay readable.
function panelTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(40,60,90,0.10)';
  g.fillRect(6, 6, 52, 52);
  g.strokeStyle = 'rgba(20,35,60,0.55)';
  g.lineWidth = 4;
  g.strokeRect(1, 1, 62, 62);
  g.fillStyle = 'rgba(20,35,60,0.45)';
  for (const [x, y] of [[9, 9], [55, 9], [9, 55], [55, 55]]) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
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
      boxes: [], aabb: null, mesh: null, born: pop ? this.time : -1, flash: 0, doom: null };
    const mat = new THREE.MeshLambertMaterial({ map: this.tex, color: COLORS[owner] || COLORS.me,
      side: isWall(type) || type === 'f' ? THREE.FrontSide : THREE.DoubleSide });
    p.base = mat.color.clone();
    p.mesh = new THREE.Mesh(pieceGeometry(type, p.mask, dir), mat);
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

  // Collision boxes and bounds for the current mask.
  shape(p) {
    const { type, i, k, j } = p;
    p.boxes.length = 0;
    if (TILES[type]) {
      for (let bit = 0; bit < TILES[type]; bit++) {
        if (!(p.mask & (1 << bit))) continue;
        const b = tileBox(type, i, k, j, bit, 0.1);
        b.p = p;
        b.bit = bit;
        p.boxes.push(b);
      }
    }
    if (type === 'wx') p.aabb = { x0: i * C - WT / 2, x1: i * C + WT / 2, y0: k * L, y1: (k + 1) * L, z0: j * C - 0.1, z1: (j + 1) * C + 0.1 };
    else if (type === 'wz') p.aabb = { x0: i * C - 0.1, x1: (i + 1) * C + 0.1, y0: k * L, y1: (k + 1) * L, z0: j * C - WT / 2, z1: j * C + WT / 2 };
    else if (type === 'f') p.aabb = { x0: i * C, x1: (i + 1) * C, y0: k * L - WT, y1: k * L, z0: j * C, z1: (j + 1) * C };
    else if (type === 'r') p.aabb = { x0: i * C, x1: (i + 1) * C, y0: k * L - RAMP_THICK, y1: (k + 1) * L, z0: j * C, z1: (j + 1) * C };
    else p.aabb = { x0: i * C, x1: (i + 1) * C, y0: k * L, y1: k * L + CONE_H, z0: j * C, z1: (j + 1) * C };
  }

  setMask(p, mask) {
    if (!TILES[p.type] || !mask || mask === p.mask) return;
    p.mask = mask & FULL[p.type];
    this.rebuild(p);
  }

  rotate(p) {
    if (p.type !== 'r') return;
    p.dir = (p.dir + 1) % 4;
    this.rebuild(p);
  }

  rebuild(p) {
    p.mesh.geometry.dispose();
    p.mesh.geometry = pieceGeometry(p.type, p.mask, p.dir);
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
