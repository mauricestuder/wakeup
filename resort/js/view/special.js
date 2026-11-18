// Idle Lift: every mountain's own landmark. A summit cross, a ski jump, a weather station, an
// igloo village, a panorama restaurant, a glacier, an observatory and a skywalk. Each is baked
// into one mesh (plus one for the parts that glow) when the mountain is built.
import { THREE, merge, at, GLOW } from './scene.js';
import { rngFrom } from '../terrain.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n);
const dome = (r, n = 14) => new THREE.SphereGeometry(r, n, 7, 0, Math.PI * 2, 0, Math.PI / 2);
const WOOD = 0x8a5a2b, DARK = 0x4a3220, SNOW = 0xf4f8ff, STONE = 0x7d8087, STEEL = 0x6a717b, WHITE = 0xf7f4ee, RED = 0xe5484d;
const ICE = [0xbfe6fa, 0x9fd6f2, 0xd9f2ff, 0x8cc8ea];
const GLASS = 0xa9d4ea;

// Turn around Y, then tip around X.
const tipped = (x, y, z, ry, rx) => new THREE.Matrix4().makeRotationY(ry).multiply(new THREE.Matrix4().makeRotationX(rx)).setPosition(x, y, z);

function cairn(parts, x, y, z, rnd) {
  for (let k = 0; k < 5; k++) {
    const a = k * 1.3, r = 0.45 + rnd() * 0.25;
    parts.push([new THREE.DodecahedronGeometry(r, 0), k % 2 ? STONE : 0x6b6e75, at(x + Math.cos(a) * 0.55, y + r * 0.5, z + Math.sin(a) * 0.55, rnd() * 6)]);
  }
}

function flag(parts, x, y, z, h, c, ry = 0) {
  parts.push([cyl(0.05, 0.06, h, 6), STEEL, at(x, y + h / 2, z)]);
  parts.push([box(0.9, 0.55, 0.04), c, at(x + Math.cos(ry) * 0.45, y + h - 0.35, z - Math.sin(ry) * 0.45, ry)]);
}

const BUILD = {
  // A big wooden cross on a pile of stones, with a bench to rest on.
  cross(parts, glow, s, H, rnd) {
    const y = H(s.x, s.z);
    cairn(parts, s.x, y, s.z, rnd);
    parts.push([box(0.38, 5.2, 0.38), WOOD, at(s.x, y + 2.7, s.z, s.yaw)]);
    parts.push([box(2.6, 0.36, 0.36), WOOD, at(s.x, y + 4.0, s.z, s.yaw)]);
    parts.push([box(0.5, 0.12, 0.5), SNOW, at(s.x, y + 5.35, s.z, s.yaw)]);
    // A small golden sun where the beams meet.
    glow.push([new THREE.IcosahedronGeometry(0.32, 0), 0xffd36b, at(s.x + Math.sin(s.yaw) * 0.22, y + 4.0, s.z + Math.cos(s.yaw) * 0.22)]);
    const bx = s.x + Math.sin(s.yaw) * 2.2, bz = s.z + Math.cos(s.yaw) * 2.2;
    parts.push([box(1.4, 0.08, 0.4), WOOD, at(bx, H(bx, bz) + 0.4, bz, s.yaw + Math.PI / 2)]);
    for (const d of [-0.55, 0.55]) parts.push([box(0.08, 0.4, 0.36), DARK, at(bx + Math.cos(s.yaw) * d, H(bx, bz) + 0.2, bz - Math.sin(s.yaw) * d, s.yaw + Math.PI / 2)]);
  },

  // A ski jump: a tower, a wooden in-run down to the take-off, and a landing hill with distance lines.
  jump(parts, glow, s, H) {
    const dx = Math.sin(s.yaw), dz = Math.cos(s.yaw), P = (d) => ({ x: s.x + dx * d, z: s.z + dz * d });
    const y0 = H(s.x, s.z), top = y0 + 5.5, run = 9, lip = H(P(run).x, P(run).z) + 1.0;
    // The in-run curves from steep at the top to flat at the take-off.
    const yAt = (d) => { const t = d / run; return lip + (top - lip) * (1 - t) * (1 - t * 0.35); };
    for (let d = 0; d < run; d += 0.75) {
      const a = P(d), b = P(d + 0.75), ya = yAt(d), yb = yAt(d + 0.75), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      const len = Math.hypot(0.75, ya - yb) + 0.04, tip = Math.atan2(ya - yb, 0.75);
      parts.push([box(1.6, 0.2, len), WOOD, tipped(mx, (ya + yb) / 2, mz, s.yaw, tip)]);
      parts.push([box(1.2, 0.05, len), SNOW, tipped(mx, (ya + yb) / 2 + 0.12, mz, s.yaw, tip)]);
      for (const side of [0.8, -0.8]) parts.push([box(0.08, 0.35, len), RED, tipped(mx + dz * side, (ya + yb) / 2 + 0.25, mz - dx * side, s.yaw, tip)]);
      // Legs down to the ground.
      if (Math.round(d / 0.75) % 2 === 0) for (const side of [0.65, -0.65]) {
        const x = a.x + dz * side, z = a.z - dx * side, g = H(x, z);
        if (ya - g > 0.3) parts.push([box(0.18, ya - g, 0.18), DARK, at(x, (ya + g) / 2, z, s.yaw)]);
      }
    }
    // The tower at the top, with a hut for the jumpers and a flag.
    parts.push([box(2.4, top - y0 + 0.2, 2.4), 0xa86b35, at(s.x - dx * 1.0, (top + y0) / 2, s.z - dz * 1.0, s.yaw)]);
    parts.push([box(2.8, 1.6, 2.8), 0xd8574a, at(s.x - dx * 1.0, top + 0.9, s.z - dz * 1.0, s.yaw)]);
    parts.push([box(3.1, 0.3, 3.1), SNOW, at(s.x - dx * 1.0, top + 1.85, s.z - dz * 1.0, s.yaw)]);
    glow.push([box(2.82, 0.5, 0.6), GLOW, at(s.x - dx * 1.0, top + 1.0, s.z - dz * 1.0, s.yaw)]);
    flag(parts, s.x - dx * 1.0, top + 2, s.z - dz * 1.0, 1.6, RED, s.yaw);
    // The landing hill: lines across it every few tiles, red for the record.
    for (const [d, c] of [[run + 4, 0x2f7fe6], [run + 7, 0x2f7fe6], [run + 10, RED]]) {
      const q = P(d);
      for (let k = -2; k <= 2; k++) {
        const x = q.x + dz * k * 0.6, z = q.z - dx * k * 0.6;
        parts.push([box(0.6, 0.06, 0.16), c, at(x, H(x, z) + 0.04, z, s.yaw + Math.PI / 2)]);
      }
      for (const side of [2.2, -2.2]) { const x = q.x + dz * side, z = q.z - dx * side; parts.push([cyl(0.04, 0.04, 0.9, 5), c, at(x, H(x, z) + 0.45, z)]); }
    }
    // The judges' box beside the landing hill.
    const j = P(run + 4), jx = j.x + dz * 4, jz = j.z - dx * 4, jy = H(jx, jz);
    parts.push([box(1.4, 3.2, 1.4), 0xa86b35, at(jx, jy + 1.6, jz, s.yaw)]);
    parts.push([box(1.8, 1.2, 1.8), WHITE, at(jx, jy + 3.8, jz, s.yaw)]);
    glow.push([box(1.82, 0.4, 1.4), GLOW, at(jx, jy + 3.9, jz, s.yaw)]);
    parts.push([box(2.0, 0.2, 2.0), SNOW, at(jx, jy + 4.5, jz, s.yaw)]);
  },

  // A weather station: a little hut, a mast with wind cups and a wind sock, and a radar dome.
  weather(parts, glow, s, H) {
    const dx = Math.sin(s.yaw), dz = Math.cos(s.yaw), y = H(s.x, s.z);
    parts.push([box(3.0, 2.0, 2.4), 0xdcd6cc, at(s.x, y + 1.0, s.z, s.yaw)]);
    parts.push([box(3.3, 0.25, 2.7), 0x5b6470, at(s.x, y + 2.1, s.z, s.yaw)]);
    glow.push([box(0.9, 0.6, 0.05), GLOW, at(s.x + dx * 1.22, y + 1.2, s.z + dz * 1.22, s.yaw)]);
    // The radar dome on its round tower.
    const rx = s.x - dz * 2.8, rz = s.z + dx * 2.8, ry = H(rx, rz);
    parts.push([cyl(1.1, 1.3, 2.4, 12), 0xc9c4ba, at(rx, ry + 1.2, rz)]);
    parts.push([new THREE.SphereGeometry(1.7, 16, 10), 0xfbfbf8, at(rx, ry + 3.3, rz)]);
    // The mast.
    const mx = s.x + dz * 2.4, mz = s.z - dx * 2.4, my = H(mx, mz);
    parts.push([cyl(0.08, 0.12, 6.5, 6), STEEL, at(mx, my + 3.25, mz)]);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.09;
      parts.push([box(0.6, 0.04, 0.04), STEEL, at(mx + Math.cos(a) * 0.3, my + 6.3, mz + Math.sin(a) * 0.3, -a)]);
      parts.push([new THREE.SphereGeometry(0.12, 6, 4), RED, at(mx + Math.cos(a) * 0.6, my + 6.3, mz + Math.sin(a) * 0.6)]);
    }
    parts.push([new THREE.ConeGeometry(0.25, 1.1, 8, 1, true), 0xff7a1a, tipped(mx + 0.5, my + 4.6, mz, Math.PI / 2, Math.PI / 2)]);
    glow.push([new THREE.SphereGeometry(0.12, 6, 4), 0xff4040, at(mx, my + 6.6, mz)]);
  },

  // Igloos around a campfire, with log benches.
  igloo(parts, glow, s, H, rnd) {
    const y0 = H(s.x, s.z);
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + rnd() * 0.4, r = 3.4 + rnd() * 0.8, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r, y = H(x, z), size = 1.2 + rnd() * 0.4;
      parts.push([dome(size), k % 2 ? SNOW : 0xe9f1fb, at(x, y - 0.05, z)]);
      // The way in faces the fire.
      const face = Math.atan2(s.x - x, s.z - z), ex = x + Math.sin(face) * size * 0.95, ez = z + Math.cos(face) * size * 0.95;
      parts.push([new THREE.CylinderGeometry(0.5, 0.5, 0.9, 10, 1, false, 0, Math.PI), 0xdfe9f6, new THREE.Matrix4().makeRotationY(face).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)).setPosition(ex, y, ez)]);
      glow.push([new THREE.CircleGeometry(0.36, 10, 0, Math.PI), GLOW, new THREE.Matrix4().makeRotationY(face).setPosition(ex + Math.sin(face) * 0.46, y, ez + Math.cos(face) * 0.46)]);
    }
    // The fire, and logs to sit on.
    for (let k = 0; k < 4; k++) parts.push([cyl(0.08, 0.08, 0.9, 6), DARK, tipped(s.x, y0 + 0.12, s.z, k * 0.8, Math.PI / 2)]);
    glow.push([new THREE.ConeGeometry(0.32, 0.8, 7), 0xffa040, at(s.x, y0 + 0.5, s.z)]);
    glow.push([new THREE.ConeGeometry(0.18, 0.5, 6), 0xffe080, at(s.x, y0 + 0.5, s.z, 0.5)]);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.09 + 0.5, x = s.x + Math.cos(a) * 1.5, z = s.z + Math.sin(a) * 1.5;
      parts.push([cyl(0.16, 0.16, 1.1, 7), WOOD, tipped(x, H(x, z) + 0.16, z, Math.atan2(s.x - x, s.z - z) + Math.PI / 2, Math.PI / 2)]);
    }
  },

  // A round restaurant with a glass wall all the way round, and a terrace.
  panorama(parts, glow, s, H) {
    const y = H(s.x, s.z);
    parts.push([cyl(3.6, 3.9, 1.4, 20), 0x9a8f86, at(s.x, y + 0.5, s.z)]);
    parts.push([cyl(3.9, 3.9, 0.15, 20), 0xc8a77d, at(s.x, y + 1.25, s.z)]);
    parts.push([cyl(2.8, 2.8, 1.9, 20), GLASS, at(s.x, y + 2.25, s.z)]);
    glow.push([cyl(2.82, 2.82, 0.35, 20), GLOW, at(s.x, y + 2.0, s.z)]);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; parts.push([box(0.14, 1.9, 0.14), 0x4b4f57, at(s.x + Math.cos(a) * 2.82, y + 2.25, s.z + Math.sin(a) * 2.82)]); }
    parts.push([cyl(3.4, 3.1, 0.35, 20), 0x6b4a33, at(s.x, y + 3.35, s.z)]);
    parts.push([new THREE.ConeGeometry(3.3, 1.2, 20), SNOW, at(s.x, y + 4.1, s.z)]);
    // The railing round the terrace.
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; parts.push([box(0.06, 0.6, 0.06), 0x4b4f57, at(s.x + Math.cos(a) * 3.75, y + 1.6, s.z + Math.sin(a) * 3.75)]); }
    parts.push([new THREE.TorusGeometry(3.75, 0.05, 4, 32), 0x4b4f57, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(s.x, y + 1.9, s.z)]);
    flag(parts, s.x, y + 4.5, s.z, 1.8, 0xf2c230, s.yaw);
  },

  // A glacier tongue running down from up high: a sheet of blue ice with cracks across it,
  // broken into ice towers at its edges and at the snout.
  glacier(parts, glow, s, H, rnd) {
    const dx = Math.sin(s.yaw), dz = Math.cos(s.yaw), step = 1.1;
    for (let d = 0; d < s.len; d += step) {
      const w = 2.2 + d * 0.16, c0x = s.x + dx * d, c0z = s.z + dz * d, c1x = c0x + dx * step, c1z = c0z + dz * step;
      // The sheet: a slab per step, laid on the slope, a little above the highest ground under it.
      for (const side of [-0.5, 0.5]) {
        const ox = dz * side * w, oz = -dx * side * w;
        let y0 = -1e9, y1 = -1e9;
        for (const t of [-0.5, 0, 0.5]) { y0 = Math.max(y0, H(c0x + ox + dz * t * w, c0z + oz - dx * t * w)); y1 = Math.max(y1, H(c1x + ox + dz * t * w, c1z + oz - dx * t * w)); }
        const len = Math.hypot(step, y0 - y1) + 0.1;
        parts.push([box(w * 1.02, 0.5, len), d % 3 < 1.5 ? ICE[2] : ICE[0], tipped((c0x + c1x) / 2 + ox, (y0 + y1) / 2 + 0.05, (c0z + c1z) / 2 + oz, s.yaw, Math.atan2(y0 - y1, step))]);
      }
      // A crack across the ice now and then.
      if (Math.round(d / step) % 3 === 2) parts.push([box(w * 1.4, 0.08, 0.22), 0x2f6f9a, at(c0x, H(c0x, c0z) + 0.32, c0z, s.yaw)]);
      // Ice towers along both edges, more of them towards the snout.
      for (const side of [-1, 1]) if (rnd() < 0.45 + d / s.len * 0.4) {
        const off = side * (w + rnd() * 0.6), x = c0x + dz * off, z = c0z - dx * off, y = H(x, z);
        const sx = 0.7 + rnd() * 0.8, sy = 0.9 + rnd() * 1.4, sz = 0.7 + rnd() * 0.8;
        parts.push([box(sx, sy, sz), ICE[(rnd() * 4) | 0], new THREE.Matrix4().makeRotationY(rnd() * 3).multiply(new THREE.Matrix4().makeRotationZ((rnd() - 0.5) * 0.3)).setPosition(x, y + sy * 0.4, z)]);
        parts.push([box(sx * 0.95, 0.14, sz * 0.95), SNOW, at(x, y + sy * 0.9, z)]);
      }
    }
    // The snout: a wall of broken ice where the glacier ends.
    const ex = s.x + dx * s.len, ez = s.z + dz * s.len, w = 2.2 + s.len * 0.16;
    for (let k = -3; k <= 3; k++) {
      const x = ex + dz * k * w / 3.2, z = ez - dx * k * w / 3.2, y = H(x, z), sy = 1.2 + rnd() * 1.3;
      parts.push([box(1.1 + rnd() * 0.5, sy, 1.0 + rnd() * 0.5), ICE[(rnd() * 4) | 0], at(x, y + sy * 0.35, z, s.yaw + (rnd() - 0.5) * 0.6)]);
    }
  },

  // An observatory: a white tower with a silver dome, its shutter open and the telescope looking out.
  observatory(parts, glow, s, H) {
    const y = H(s.x, s.z), dx = Math.sin(s.yaw), dz = Math.cos(s.yaw);
    parts.push([cyl(2.4, 2.6, 3.0, 18), WHITE, at(s.x, y + 1.5, s.z)]);
    parts.push([dome(2.5, 18), 0xc9d1dc, at(s.x, y + 3.0, s.z)]);
    parts.push([box(0.9, 2.6, 2.6), 0x23303f, new THREE.Matrix4().makeRotationY(s.yaw).multiply(new THREE.Matrix4().makeRotationX(-0.6)).setPosition(s.x + dx * 1.2, y + 4.3, s.z + dz * 1.2)]);
    parts.push([cyl(0.35, 0.45, 3.4, 10), 0x30343b, tipped(s.x + dx * 1.3, y + 4.7, s.z + dz * 1.3, s.yaw, 0.8)]);
    glow.push([box(0.7, 0.9, 0.05), GLOW, at(s.x + dx * 2.45, y + 1.0, s.z + dz * 2.45, s.yaw)]);
    // A little house next door for the astronomers.
    const hx = s.x - dz * 4, hz = s.z + dx * 4, hy = H(hx, hz);
    parts.push([box(2.2, 1.6, 1.8), 0xd9c3a5, at(hx, hy + 0.8, hz, s.yaw)]);
    parts.push([box(2.5, 0.25, 2.1), 0x5b6470, at(hx, hy + 1.7, hz, s.yaw)]);
    glow.push([box(0.6, 0.5, 0.05), GLOW, at(hx + dx * 0.92, hy + 0.9, hz + dz * 0.92, s.yaw)]);
  },

  // A glass platform out over the drop, on a steel frame, with a flag at the end.
  skywalk(parts, glow, s, H) {
    const dx = Math.sin(s.yaw), dz = Math.cos(s.yaw), L = 7;
    // Level, and never in the ground, even if the slope rises again somewhere along it.
    let y = H(s.x, s.z) + 0.6;
    for (let d = 1; d <= L + 1; d++) y = Math.max(y, H(s.x + dx * d, s.z + dz * d) + 0.4);
    parts.push([box(3.0, y - H(s.x, s.z) + 1.0, 3.0), 0x8d8f94, at(s.x, (y + H(s.x, s.z)) / 2 - 0.5, s.z, s.yaw)]);
    const mx = s.x + dx * (L / 2 + 1), mz = s.z + dz * (L / 2 + 1);
    parts.push([box(2.2, 0.12, L), GLASS, at(mx, y + 0.1, mz, s.yaw)]);
    for (const side of [1.1, -1.1]) {
      parts.push([box(0.12, 0.3, L), STEEL, at(mx + dz * side, y - 0.05, mz - dx * side, s.yaw)]);
      parts.push([box(0.06, 0.06, L), STEEL, at(mx + dz * side, y + 1.1, mz - dx * side, s.yaw)]);
      for (let k = 0; k <= 7; k++) parts.push([box(0.05, 1.05, 0.05), STEEL, at(mx + dz * side + dx * (k / 7 - 0.5) * (L - 0.1), y + 0.6, mz - dx * side + dz * (k / 7 - 0.5) * (L - 0.1))]);
    }
    // Struts back to the rock.
    for (const side of [0.9, -0.9]) {
      const ax = s.x + dz * side + dx * 1.5, az = s.z - dx * side + dz * 1.5, g = H(ax, az) - 2.5, ty = y - 0.1;
      const ex = mx + dz * side + dx * 1.5, ez = mz - dx * side + dz * 1.5, len = Math.hypot(ex - ax, ez - az, ty - g);
      const m = new THREE.Matrix4().makeRotationY(s.yaw).multiply(new THREE.Matrix4().makeRotationX(-Math.atan2(ty - g, Math.hypot(ex - ax, ez - az))));
      parts.push([box(0.14, 0.14, len), STEEL, m.setPosition((ax + ex) / 2, (g + ty) / 2, (az + ez) / 2)]);
    }
    const fx = s.x + dx * (L + 0.8), fz = s.z + dz * (L + 0.8);
    flag(parts, fx, y, fz, 2.4, RED, s.yaw + Math.PI / 2);
    glow.push([new THREE.SphereGeometry(0.1, 6, 4), 0xff4040, at(fx, y + 2.45, fz)]);
  },
};

export function createSpecialView(scene) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true });
  let mesh = null, lit = null, key = '';

  function clear() {
    for (const m of [mesh, lit]) if (m) { scene.remove(m); m.geometry.dispose(); }
    mesh = lit = null; key = '';
  }

  function sync(state, ter) {
    const s = state.special, k = s ? [state.level, s.kind, s.x, s.z].join('/') : 'none';
    if (k === key) return;
    clear(); key = k;
    if (!s || !BUILD[s.kind]) return;
    const parts = [], glow = [], H = (x, z) => ter.height(x, z);
    BUILD[s.kind](parts, glow, s, H, rngFrom([(s.x * 131 + s.z * 7 + state.level * 977) >>> 0]));
    mesh = new THREE.Mesh(merge(parts), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    if (glow.length) { lit = new THREE.Mesh(merge(glow), glowMat); scene.add(lit); }
  }

  return { sync, clear };
}
