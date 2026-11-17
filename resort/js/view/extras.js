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
