// Idle Lift: the small things that make the mountain feel lived in. Benches, marker
// poles, boulders, snowmen, kickers and floodlights. Everything is baked into one mesh,
// rebuilt only when the resort changes, so it costs almost nothing to draw.
import { THREE, merge, at } from './scene.js';
import { rngFrom } from '../terrain.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const WOOD = 0x8a5a2b, DARK = 0x4a3220, SNOWY = 0xf4f8ff, ORANGE = 0xff7a1a, STONE = 0x7d8087, STEEL = 0x555b64;

// A matrix that turns around Y, tips around X, then moves.
const tipped = (x, y, z, ry, rx, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().makeRotationY(ry).multiply(new THREE.Matrix4().makeRotationX(rx)).scale(new THREE.Vector3(sx, sy, sz)).setPosition(x, y, z);

function bench(parts, x, y, z, ry) {
  const m = (dx, dy, dz, g, c) => parts.push([g, c, at(x, y, z, ry).multiply(at(dx, dy, dz))]);
  m(0, 0.34, 0, box(1.1, 0.07, 0.36), WOOD);
  m(0, 0.6, -0.17, box(1.1, 0.3, 0.06), WOOD);
  m(-0.45, 0.17, 0, box(0.08, 0.34, 0.34), DARK); m(0.45, 0.17, 0, box(0.08, 0.34, 0.34), DARK);
  m(0, 0.4, 0, box(1.0, 0.04, 0.3), SNOWY);
}

function snowman(parts, x, y, z, ry) {
  const ball = (r, yy) => parts.push([new THREE.SphereGeometry(r, 8, 6), SNOWY, at(x, y + yy, z)]);
  ball(0.42, 0.34); ball(0.3, 0.86); ball(0.2, 1.24);
  parts.push([new THREE.ConeGeometry(0.05, 0.22, 5), ORANGE, tipped(x + Math.sin(ry) * 0.24, y + 1.24, z + Math.cos(ry) * 0.24, ry, Math.PI / 2)]);
  parts.push([new THREE.CylinderGeometry(0.16, 0.16, 0.2, 8), 0x23272e, at(x, y + 1.5, z)]);
  parts.push([new THREE.CylinderGeometry(0.25, 0.25, 0.03, 8), 0x23272e, at(x, y + 1.41, z)]);
}

// A point on the piste at index i, with the direction across it (nx, nz) and its height.
function onPiste(p, i, side = 0) {
  const q = p.pts[Math.max(0, Math.min(p.pts.length - 1, i))], r = p.pts[Math.min(p.pts.length - 1, Math.max(1, i + 1))], o = p.pts[Math.max(0, Math.min(p.pts.length - 2, i))];
  const tx = r.x - o.x, tz = r.z - o.z, l = Math.hypot(tx, tz) || 1;
  return { x: q.x - tz / l * side, z: q.z + tx / l * side, y: q.y, yaw: Math.atan2(tx, tz), nx: -tz / l, nz: tx / l };
}

const RED = 0xe5484d, BLUE = 0x2f7fe6, RAIL = 0xb9c0c9, PARK = [0x8e5bd0, 0xf08a24, 0x24b8b0, 0xe85aa0];

// The things that make a piste exciting.
function feature(parts, ter, p, f, rnd) {
  const H = (x, z) => ter.height(x, z);
  if (f.type === 'bridge') {
    // A wooden bridge: deck, railings, and posts down into the gully.
    for (let i = f.i0; i < f.i1; i++) {
      const a = onPiste(p, i), b = onPiste(p, i + 1), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, my = (a.y + b.y) / 2, len = Math.hypot(b.x - a.x, b.z - a.z) + 0.05;
      const tip = Math.atan2(a.y - b.y, len);
      parts.push([box(3.5, 0.22, len), 0x8a5a2b, tipped(mx, my - 0.02, mz, a.yaw, tip)]);
      for (const side of [1.55, -1.55]) {
        parts.push([box(0.08, 0.08, len), 0x6b4423, tipped(mx + a.nx * side, my + 0.75, mz + a.nz * side, a.yaw, tip)]);
        parts.push([box(0.1, 0.8, 0.1), 0x6b4423, at(a.x + a.nx * side, a.y + 0.38, a.z + a.nz * side)]);
        const g = H(a.x + a.nx * side, a.z + a.nz * side);
        if (a.y - g > 0.3 && i > f.i0) parts.push([box(0.2, a.y - g + 0.6, 0.2), 0x5a3a1c, at(a.x + a.nx * side, (a.y + g) / 2 - 0.3, a.z + a.nz * side)]);
      }
    }
    return;
  }
  if (f.type === 'tunnel') {
    // Timber portals with rock piled on top, and a dark mouth.
    for (const [i, back] of [[f.i0, 1], [f.i1, -1]]) {
      const q = onPiste(p, i), y = q.y;
      for (const side of [1.55, -1.55]) parts.push([box(0.3, 2.1, 0.3), 0x5a3a1c, at(q.x + q.nx * side, y + 1.0, q.z + q.nz * side, q.yaw)]);
      parts.push([box(3.6, 0.35, 0.35), 0x5a3a1c, at(q.x, y + 2.1, q.z, q.yaw)]);
      parts.push([box(2.9, 1.9, 0.08), 0x16191d, at(q.x + Math.sin(q.yaw) * 0.25 * back, y + 0.95, q.z + Math.cos(q.yaw) * 0.25 * back, q.yaw)]);
      for (let k = 0; k < 5; k++) {
        const s = (k - 2) * 0.75, r = 0.45 + rnd() * 0.3;
        parts.push([new THREE.DodecahedronGeometry(r, 0), k % 2 ? STONE : 0x6b6e75, at(q.x + q.nx * s, y + 2.35 + r * 0.4, q.z + q.nz * s, rnd() * 6, 1.3, 0.8, 1.1)]);
      }
      parts.push([box(3.8, 0.12, 0.6), SNOWY, at(q.x, y + 2.35, q.z, q.yaw)]);
    }
    return;
  }
  if (f.type === 'moguls') {
    for (let i = f.i0; i < f.i1; i++) for (let k = 0; k < 3; k++) {
      const q = onPiste(p, i, (k - 1) * 0.75 + (i % 2) * 0.35), y = H(q.x, q.z);
      parts.push([new THREE.SphereGeometry(0.42, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0xeef3fb, at(q.x, y + 0.02, q.z, 0, 1.1, 0.42, 1)]);
    }
    return;
  }
  if (f.type === 'gates') {
    // Race gates, red and blue in turn, with a start banner.
    let n = 0;
    for (let s = f.s0 + 0.8; s < f.s1; s += 1.6, n++) {
      const i = p.cum.findIndex((c) => c >= s), side = n % 2 ? 0.85 : -0.85, q = onPiste(p, i, side), y = H(q.x, q.z), c = n % 2 ? RED : BLUE;
      for (const d of [-0.32, 0.32]) parts.push([new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), c, at(q.x + q.nx * d, y + 0.6, q.z + q.nz * d)]);
      parts.push([box(0.64, 0.42, 0.02), c, at(q.x, y + 0.95, q.z, q.yaw + Math.PI / 2)]);
    }
    const st = onPiste(p, f.i0);
    for (const side of [1.5, -1.5]) parts.push([box(0.12, 2.2, 0.12), 0x30343b, at(st.x + st.nx * side, st.y + 1.1, st.z + st.nz * side)]);
    parts.push([box(3.1, 0.45, 0.06), RED, at(st.x, st.y + 2.0, st.z, st.yaw)]);
    parts.push([box(2.0, 0.12, 0.07), 0xffffff, at(st.x, st.y + 2.0, st.z, st.yaw)]);
    return;
  }
  if (f.type === 'park') {
    const L = f.s1 - f.s0, idx = (u) => p.cum.findIndex((c) => c >= f.s0 + L * u);
    // Entrance arch with a banner.
    const e = onPiste(p, f.i0);
    for (const side of [1.7, -1.7]) parts.push([box(0.14, 2.4, 0.14), 0x30343b, at(e.x + e.nx * side, e.y + 1.2, e.z + e.nz * side)]);
    for (let k = 0; k < 4; k++) parts.push([box(0.85, 0.5, 0.06), PARK[k], at(e.x + e.nx * (k - 1.5) * 0.85, e.y + 2.15, e.z + e.nz * (k - 1.5) * 0.85, e.yaw)]);
    // Rails: a steel bar on two legs, along the piste.
    const rail = (u0, u1, side) => {
      const a = onPiste(p, idx(u0), side), b = onPiste(p, idx(u1), side), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, len = Math.hypot(b.x - a.x, b.z - a.z);
      const ya = H(a.x, a.z) + 0.42, yb = H(b.x, b.z) + 0.42;
      parts.push([box(0.07, 0.07, len), RAIL, tipped(mx, (ya + yb) / 2, mz, Math.atan2(b.x - a.x, b.z - a.z), Math.atan2(ya - yb, len))]);
      for (const q of [a, b]) parts.push([box(0.06, 0.42, 0.06), 0x555b64, at(q.x, H(q.x, q.z) + 0.2, q.z)]);
    };
    rail(0.08, 0.2, -0.8); rail(0.58, 0.68, -0.8);
    // A box to slide on.
    { const a = onPiste(p, idx(0.25), 0.8), b = onPiste(p, idx(0.33), 0.8), len = Math.hypot(b.x - a.x, b.z - a.z);
      const ya = H(a.x, a.z), yb = H(b.x, b.z);
      parts.push([box(0.5, 0.3, len), PARK[1], tipped((a.x + b.x) / 2, (ya + yb) / 2 + 0.15, (a.z + b.z) / 2, Math.atan2(b.x - a.x, b.z - a.z), Math.atan2(ya - yb, len))]); }
    // The halfpipe: two curved snow walls along the last part of the park.
    for (let i = idx(0.72); i < f.i1; i++) {
      const q = onPiste(p, i), r = onPiste(p, i + 1), len = Math.hypot(r.x - q.x, r.z - q.z) + 0.08;
      for (const side of [1, -1]) for (let k = 0; k < 3; k++) {
        const ang = (k + 0.5) / 3 * 1.2, d = 1.3 + Math.sin(ang) * 0.75, h = (1 - Math.cos(ang)) * 1.1;
        const x = (q.x + r.x) / 2 + q.nx * d * side, z = (q.z + r.z) / 2 + q.nz * d * side, y = H((q.x + r.x) / 2, (q.z + r.z) / 2) + h;
        const m = new THREE.Matrix4().makeRotationY(q.yaw).multiply(new THREE.Matrix4().makeRotationZ(-ang * side)).setPosition(x, y, z);
        parts.push([box(0.62, 0.2, len), k === 2 ? 0xdbe6f5 : 0xeef3fb, m]);
      }
      for (const side of [1, -1]) parts.push([box(0.12, 0.12, len), PARK[i % 4], at(q.x + q.nx * 2.15 * side, H(q.x, q.z) + 1.0, q.z + q.nz * 2.15 * side, q.yaw)]);
    }
  }
}

export function createExtraView(scene) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glow = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  let mesh = null, lamps = null, key = '';

  function clear() {
    for (const m of [mesh, lamps]) if (m) { scene.remove(m); m.geometry.dispose(); }
    mesh = lamps = null; key = '';
  }

  function sync(state, ter) {
    const k = [state.level, state.open, state.pistes.filter((p) => p.kick).length, state.up.night > 0 ? 1 : 0, state.buildings.length].join('/');
    if (k === key) return;
    clear(); key = k;
    const parts = [], lights = [], H = (x, z) => ter.height(x, z);
    const rnd = rngFrom([(ter.N * 7919 + state.level * 131 + 17) >>> 0]);
    const b = ter.base;

    // Around the car park: two benches, two snowmen, a rack of skis.
    bench(parts, b.x - 3.4, H(b.x - 3.4, b.z - 0.8), b.z - 0.8, 0.3);
    bench(parts, b.x + 3.6, H(b.x + 3.6, b.z - 0.9), b.z - 0.9, -0.35);
    snowman(parts, b.x - 5.6, H(b.x - 5.6, b.z - 1.6), b.z - 1.6, 0.6);
    snowman(parts, b.x + 6.8, H(b.x + 6.8, b.z + 0.2), b.z + 0.2, -0.8);
    for (let i = 0; i < 5; i++) parts.push([box(0.05, 0.9, 0.09), [0xe5484d, 0x2f7fe6, 0xf2c230, 0x34b05a, 0xf4f4f0][i], tipped(b.x + 2.1 + i * 0.16, H(b.x + 2.4, b.z - 2.4) + 0.42, b.z - 2.4, 0, -0.18)]);
    parts.push([box(1.0, 0.06, 0.06), DARK, at(b.x + 2.42, H(b.x + 2.4, b.z - 2.4) + 0.62, b.z - 2.3)]);

    for (const l of state.lifts) {
      const p = state.pisteById[l.id], dx = Math.sin(l.dir), dz = Math.cos(l.dir);
      // A bench with a view at the top of every lift, and a short fence by the queue.
      const bx = l.b.x - dz * 2.6 + dx * 1.2, bz = l.b.z + dx * 2.6 + dz * 1.2;
      bench(parts, bx, H(bx, bz), bz, l.dir + Math.PI);
      for (let i = 0; i < 4; i++) {
        const fx = l.a.x - dx * (1.2 + i * 0.9) + dz * 1.15, fz = l.a.z - dz * (1.2 + i * 0.9) - dx * 1.15;
        parts.push([box(0.07, 0.6, 0.07), WOOD, at(fx, H(fx, fz) + 0.3, fz)]);
        if (i < 3) parts.push([box(0.05, 0.05, 0.9), WOOD, at(fx - dx * 0.45, H(fx - dx * 0.45, fz - dz * 0.45) + 0.5, fz - dz * 0.45, l.dir)]);
      }
      // Marker poles down both edges of the piste.
      for (let i = 3; i < p.pts.length - 2; i += 5) {
        if (p.pts[i].deck) continue; // no poles on bridges or in tunnels
        const q = p.pts[i], n = p.pts[i + 1], tx = n.x - q.x, tz = n.z - q.z, len = Math.hypot(tx, tz) || 1;
        for (const side of [1, -1]) {
          const x = q.x - tz / len * 1.45 * side, z = q.z + tx / len * 1.45 * side;
          parts.push([new THREE.CylinderGeometry(0.035, 0.035, 0.95, 5), side > 0 ? ORANGE : 0x2f7fe6, at(x, H(x, z) + 0.47, z)]);
        }
      }
      // The kicker: a snow wedge with two flags.
      if (p.kick) {
        const kq = p.kickAt, kx = Math.sin(kq.yaw), kz = Math.cos(kq.yaw);
        parts.push([box(1.9, 0.5, 2.2), 0xe6eefb, tipped(kq.x, kq.y + 0.12, kq.z, kq.yaw, -0.3)]);
        parts.push([box(1.9, 0.08, 0.3), ORANGE, tipped(kq.x + kx * 1.0, kq.y + 0.62, kq.z + kz * 1.0, kq.yaw, -0.3)]);
        for (const side of [1, -1]) {
          const x = kq.x + kz * 1.25 * side, z = kq.z - kx * 1.25 * side;
          parts.push([new THREE.CylinderGeometry(0.03, 0.03, 1.5, 5), DARK, at(x, H(x, z) + 0.75, z)]);
          parts.push([box(0.5, 0.28, 0.03), 0xe5484d, at(x + kz * 0.25 * side, H(x, z) + 1.34, z - kx * 0.25 * side, kq.yaw + Math.PI / 2)]);
        }
      }
      for (const f of p.features || []) feature(parts, ter, p, f, rnd);
      // Night skiing: floodlights along the piste.
      if (state.up.night > 0) {
        for (let i = 6; i < p.pts.length - 3; i += 11) {
          const q = p.pts[i], n = p.pts[i + 1], tx = n.x - q.x, tz = n.z - q.z, len = Math.hypot(tx, tz) || 1;
          const x = q.x - tz / len * 2.1, z = q.z + tx / len * 2.1, y = H(x, z);
          parts.push([new THREE.CylinderGeometry(0.05, 0.08, 3.2, 6), STEEL, at(x, y + 1.6, z)]);
          parts.push([box(0.7, 0.16, 0.26), STEEL, at(x, y + 3.25, z, Math.atan2(tx, tz) + Math.PI / 2)]);
          lights.push([box(0.6, 0.05, 0.2), 0xffffff, at(x, y + 3.15, z, Math.atan2(tx, tz) + Math.PI / 2)]);
        }
      }
    }

    // Boulders scattered over the open slopes, away from pistes and lifts.
    const clearOf = (x, z) => {
      for (const p of state.plan) {
        if (Math.hypot(p.a.x - x, p.a.z - z) < 5 || Math.hypot(p.b.x - x, p.b.z - z) < 5) return false;
        for (const w of p.wps) if (Math.hypot(w.x - x, w.z - z) < 6) return false;
        const ax = p.a.x, az = p.a.z, ex = p.b.x - ax, ez = p.b.z - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
        if (Math.hypot(x - ax - ex * t, z - az - ez * t) < 3.5) return false;
      }
      return Math.hypot(b.x - x, b.z - z) > 9;
    };
    for (let n = 0, tries = 0; n < 16 && tries < 300; tries++) {
      const x = 6 + rnd() * (ter.N - 12), z = 8 + rnd() * (ter.N - 22), s = 0.35 + rnd() * 0.7;
      if (!clearOf(x, z)) continue;
      parts.push([new THREE.DodecahedronGeometry(0.7, 0), STONE, at(x, H(x, z) + s * 0.25, z, rnd() * 6, s * 1.2, s * 0.8, s)]);
      parts.push([new THREE.DodecahedronGeometry(0.55, 0), SNOWY, at(x, H(x, z) + s * 0.55, z, rnd() * 6, s * 1.1, s * 0.35, s * 0.9)]);
      n++;
    }

    mesh = new THREE.Mesh(merge(parts), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    if (lights.length) { lamps = new THREE.Mesh(merge(lights), glow); scene.add(lamps); }
  }

  return { sync, clear };
}
