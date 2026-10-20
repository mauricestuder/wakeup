// The bank map: rooms, walls, doors, decor, colliders and navigation helpers.
// Everything is axis-aligned boxes so collision and ray tests stay simple.
import * as THREE from '../vendor/three.module.min.js';
import * as T from './textures.js';

export const WALL_H = 5;
const THICK = 0.6;

export const AREAS = {
  lobby:   { name: 'Lobby',         rect: [-15, 15, -10, 10] },
  trading: { name: 'Trading Floor', rect: [-15, 15, -40, -10] },
  vault:   { name: 'Vault',         rect: [15, 30, -36, -18] },
};

export function buildWorld(scene) {
  const colliders = [];
  const doors = [];
  const animated = [];

  const mats = {
    wall: T.bankWall(),
    steel: T.steelWall(),
  };

  function box(x1, x2, z1, z2, y1, y2, material, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, y2 - y1, z2 - z1), material);
    mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    scene.add(mesh);
    let col = null;
    if (collide) {
      col = { minX: x1, maxX: x2, minZ: z1, maxZ: z2, minY: y1, maxY: y2, active: true };
      colliders.push(col);
    }
    return { mesh, col };
  }

  function wallMat(len, kind = 'wall') {
    const t = mats[kind].clone();
    t.repeat.set(Math.max(1, Math.round(len / 4)), 1);
    t.needsUpdate = true;
    return new THREE.MeshLambertMaterial({ map: t });
  }
  // Wall running along X at depth z, and along Z at x.
  const wallX = (z, x1, x2, kind) => box(x1 - THICK / 2, x2 + THICK / 2, z - THICK / 2, z + THICK / 2, 0, WALL_H, wallMat(x2 - x1, kind));
  const wallZ = (x, z1, z2, kind) => box(x - THICK / 2, x + THICK / 2, z1 - THICK / 2, z2 + THICK / 2, 0, WALL_H, wallMat(z2 - z1, kind));

  // ---------- floor & ceiling ----------
  const floorTex = T.marbleFloor();
  floorTex.repeat.set(45 / 8, 50 / 8);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(45, 50), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(7.5, 0, -15);
  scene.add(floor);

  const vaultFloor = new THREE.Mesh(new THREE.PlaneGeometry(15, 18), new THREE.MeshLambertMaterial({ map: T.steelWall() }));
  vaultFloor.material.map.repeat.set(4, 5);
  vaultFloor.rotation.x = -Math.PI / 2;
  vaultFloor.position.set(22.5, 0.01, -27);
  scene.add(vaultFloor);

  const ceilTex = T.ceilingTex();
  ceilTex.repeat.set(12, 13);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(45, 50), new THREE.MeshLambertMaterial({ map: ceilTex }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(7.5, WALL_H, -15);
  scene.add(ceil);

  // ---------- walls ----------
  // Lobby
  wallX(10, -15, 15);
  wallZ(-15, -10, 10);
  wallZ(15, -10, 10);
  wallX(-10, -15, -2);
  wallX(-10, 2, 15);
  // Trading floor
  wallZ(-15, -40, -10);
  wallX(-40, -15, 15);
  wallZ(15, -40, -30);
  wallZ(15, -24, -10);
  // Vault
  wallX(-36, 15, 30, 'steel');
  wallX(-18, 15, 30, 'steel');
  wallZ(30, -36, -18, 'steel');

  // ---------- doors ----------
  function addDoor({ name, cost, x1, x2, z1, z2, a, b, x, z, nx, nz, material }) {
    const { mesh, col } = box(x1, x2, z1, z2, 0, WALL_H, material);
    const door = {
      name, cost, a, b, x, z, nx, nz, mesh, col, opened: false, t: 0,
      open() {
        if (this.opened) return;
        this.opened = true;
        col.active = false;
        animated.push((dt) => {
          this.t += dt;
          mesh.position.y = WALL_H / 2 - this.t * 6;
          if (mesh.position.y < -WALL_H) { scene.remove(mesh); return true; }
          return false;
        });
      },
    };
    doors.push(door);
    return door;
  }
  const boards = T.woodBoards();
  addDoor({
    name: 'Trading Floor', cost: 750, x1: -2, x2: 2, z1: -10.25, z2: -9.75,
    a: 'lobby', b: 'trading', x: 0, z: -10, nx: 0, nz: -1,
    material: new THREE.MeshLambertMaterial({ map: boards }),
  });
  const vd = T.vaultDoor();
  vd.repeat.set(1, 1);
  addDoor({
    name: 'Vault', cost: 1250, x1: 14.6, x2: 15.4, z1: -30, z2: -24,
    a: 'trading', b: 'vault', x: 15, z: -27, nx: 1, nz: 0,
    material: new THREE.MeshLambertMaterial({ map: vd }),
  });

  // ---------- decor ----------
  const marble = new THREE.MeshLambertMaterial({ color: 0xd8d2c4 });
  const wood = new THREE.MeshLambertMaterial({ color: 0x5a3519 });
  const gold = new THREE.MeshLambertMaterial({ color: 0xd4af37, emissive: 0x4a3505 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x222226 });

  // Lobby pillars
  for (const [x, z] of [[-7, -4], [7, -4], [-7, 5], [7, 5]]) {
    box(x - 0.45, x + 0.45, z - 0.45, z + 0.45, 0, WALL_H, marble);
    box(x - 0.6, x + 0.6, z - 0.6, z + 0.6, 0, 0.3, gold, false);
    box(x - 0.6, x + 0.6, z - 0.6, z + 0.6, WALL_H - 0.3, WALL_H, gold, false);
  }
  // Teller counter with glass
  box(-12.5, -10.5, -6, 6, 0, 1.1, wood);
  box(-12.6, -10.4, -6.1, 6.1, 1.1, 1.18, marble, false);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.4),
    new THREE.MeshLambertMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  glass.position.set(-10.6, 1.9, 0); glass.rotation.y = Math.PI / 2;
  scene.add(glass);
  sign('TELLER', -10.3, 2.9, 0, Math.PI / 2, 3, 0.7);
  sign('CASH OUT\nNATIONAL BANK', 0, 3.6, 9.68, Math.PI, 7, 1.6, { bg: '#0d1f17', fg: '#f5d76e', border: '#b8902f', h: 256 });

  // Scattered bills on the floor
  const billMat = new THREE.MeshLambertMaterial({ map: T.bill(), side: THREE.DoubleSide });
  const billGeo = new THREE.PlaneGeometry(0.5, 0.25);
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(billGeo, billMat);
    const zone = Math.random();
    const x = zone < 0.5 ? -14 + Math.random() * 28 : -14 + Math.random() * 28;
    const z = zone < 0.5 ? -9 + Math.random() * 18 : -39 + Math.random() * 28;
    m.position.set(x, 0.02 + Math.random() * 0.01, z);
    m.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
    scene.add(m);
  }

  // Trading floor desks with monitors
  const monitors = [];
  let seed = 3;
  for (const z of [-18, -26, -34]) {
    for (const x of [-10, -5.5, 5.5, 10]) {
      box(x - 1.3, x + 1.3, z - 0.6, z + 0.6, 0, 0.8, wood);
      for (const dx of [-0.6, 0.6]) {
        const mon = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.06), dark);
        mon.position.set(x + dx, 1.15, z - 0.3);
        scene.add(mon);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.47),
          new THREE.MeshBasicMaterial({ map: T.monitorTex(seed++) }));
        scr.position.set(x + dx, 1.15, z - 0.265);
        scene.add(scr);
        monitors.push(scr);
      }
    }
  }
  // Big stock ticker board on the north wall
  const ticker = T.labelTex('DOW ▼ 12.4%   GOLD ▲ 8.1%   DEBT ▲ 99%   CASH ▼ 50%   BOTS ▲ 300%   ', {
    w: 2048, h: 128, bg: '#020a05', fg: '#21ff7a', font: 'bold 72px monospace',
  });
  ticker.repeat.set(0.5, 1);
  const tickerMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.1), new THREE.MeshBasicMaterial({ map: ticker }));
  tickerMesh.position.set(0, 4.1, -39.68);
  scene.add(tickerMesh);
  animated.push((dt) => { ticker.offset.x += dt * 0.04; return false; });

  // Vault decor: gold bar stacks and deposit boxes
  const depTex = T.depositBoxes();
  depTex.repeat.set(5, 1.5);
  for (const [z, ry] of [[-35.68, 0], [-18.32, Math.PI]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.6), new THREE.MeshLambertMaterial({ map: depTex }));
    p.position.set(22.5, 2.2, z); p.rotation.y = ry;
    scene.add(p);
  }
  const barGeo = new THREE.BoxGeometry(0.5, 0.18, 0.25);
  for (const [cx, cz] of [[18, -34.3], [22.5, -34.3], [18, -19.7], [22.5, -19.7]]) {
    box(cx - 0.8, cx + 0.8, cz - 0.6, cz + 0.6, 0, 0.9, wood, true).mesh.visible = false;
    for (let layer = 0; layer < 5; layer++) {
      for (let i = 0; i < 6 - layer; i++) {
        const b = new THREE.Mesh(barGeo, gold);
        b.position.set(cx - 0.65 + i * 0.26 + layer * 0.13, 0.09 + layer * 0.18, cz + (layer % 2 ? 0.15 : -0.15));
        scene.add(b);
      }
    }
  }

  // Ceiling lamps
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1c9 });
  for (const [x, z] of [[0, 0], [-8, -25], [8, -25], [0, -33], [0, -17], [22.5, -27]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.5), lampMat);
    l.position.set(x, WALL_H - 0.05, z);
    scene.add(l);
  }

  // ---------- spawn vents ----------
  const spawnPoints = [
    { x: -13, z: 8.5, area: 'lobby' }, { x: 13, z: 8.5, area: 'lobby' },
    { x: 13, z: -8.5, area: 'lobby' }, { x: -13, z: -8.5, area: 'lobby' },
    { x: -13, z: -38.5, area: 'trading' }, { x: 13, z: -38.5, area: 'trading' },
    { x: -13, z: -12, area: 'trading' }, { x: 12.5, z: -12, area: 'trading' },
    { x: 28, z: -34.5, area: 'vault' }, { x: 28, z: -19.5, area: 'vault' },
  ];
  const ventMat = new THREE.MeshBasicMaterial({ color: 0x1a0606 });
  const ventGlow = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.35 });
  for (const s of spawnPoints) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), ventMat);
    v.rotation.x = -Math.PI / 2; v.position.set(s.x, 0.02, s.z);
    scene.add(v);
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.08), ventGlow);
      bar.rotation.x = -Math.PI / 2; bar.position.set(s.x, 0.03, s.z + i * 0.25);
      scene.add(bar);
    }
  }

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xbfc8ff, 0x3a2a18, 0.35));
  scene.add(new THREE.AmbientLight(0xffffff, 0.05));
  for (const [x, z, c, i] of [
    [0, 0, 0xffd9a0, 40], [-8, -25, 0x9effc4, 30], [8, -25, 0x9effc4, 30],
    [0, -36, 0x9effc4, 20], [22.5, -27, 0xffd56a, 35],
  ]) {
    const p = new THREE.PointLight(c, i * 0.8, 30, 1.2);
    p.position.set(x, WALL_H - 0.6, z);
    scene.add(p);
  }

  // Wall-mounted sign helper.
  function sign(text, x, y, z, ry, w, h, opts = {}) {
    const t = T.labelTex(text, { bg: '#0d1f17', fg: '#f5d76e', border: '#b8902f', ...opts });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: opts.bg === null }));
    m.position.set(x, y, z); m.rotation.y = ry;
    scene.add(m);
    return m;
  }

  // ---------- queries ----------
  function areaAt(x, z) {
    for (const key of ['vault', 'trading', 'lobby']) {
      const [x1, x2, z1, z2] = AREAS[key].rect;
      if (x >= x1 && x <= x2 && z >= z1 && z <= z2) return key;
    }
    return x > 15 ? 'vault' : z < -10 ? 'trading' : 'lobby';
  }

  function isUnlocked(area) {
    if (area === 'lobby') return true;
    return doors.some(d => d.opened && (d.a === area || d.b === area));
  }

  // Next point an enemy at `pos` (in area `from`) should walk to to reach area `to`.
  function pathTarget(pos, from, to) {
    if (from === to) return null;
    const prev = { [from]: null };
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === to) break;
      for (const d of doors) {
        if (!d.opened) continue;
        const next = d.a === cur ? d.b : d.b === cur ? d.a : null;
        if (next && !(next in prev)) { prev[next] = { area: cur, door: d }; queue.push(next); }
      }
    }
    if (!(to in prev)) return null;
    let step = to;
    while (prev[step] && prev[step].area !== from) step = prev[step].area;
    const d = prev[step].door;
    const sign = d.a === from ? 1 : -1;
    const dist = Math.hypot(pos.x - d.x, pos.z - d.z);
    const k = dist < 2.2 ? 1.8 : -1.5;
    return { x: d.x + d.nx * sign * k, z: d.z + d.nz * sign * k };
  }

  // Move a circle (approximated as a square) through the colliders, sliding along walls.
  function moveCircle(pos, dx, dz, r) {
    pos.x += dx;
    for (const c of colliders) {
      if (!c.active) continue;
      if (pos.x + r > c.minX && pos.x - r < c.maxX && pos.z + r > c.minZ && pos.z - r < c.maxZ) {
        if (dx > 0) pos.x = c.minX - r; else if (dx < 0) pos.x = c.maxX + r;
      }
    }
    pos.z += dz;
    for (const c of colliders) {
      if (!c.active) continue;
      if (pos.x + r > c.minX && pos.x - r < c.maxX && pos.z + r > c.minZ && pos.z - r < c.maxZ) {
        if (dz > 0) pos.z = c.minZ - r; else if (dz < 0) pos.z = c.maxZ + r;
      }
    }
  }

  // Distance along a ray to the first wall, floor or ceiling.
  function raycast(o, d, maxDist = 200) {
    let best = maxDist;
    if (d.y < -1e-6) best = Math.min(best, -o.y / d.y);
    if (d.y > 1e-6) best = Math.min(best, (WALL_H - o.y) / d.y);
    for (const c of colliders) {
      if (!c.active) continue;
      const t = rayBox(o, d, c);
      if (t < best) best = t;
    }
    return best;
  }

  function pointBlocked(p) {
    if (p.y <= 0 || p.y >= WALL_H) return true;
    for (const c of colliders) {
      if (c.active && p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ && p.y > c.minY && p.y < c.maxY) return true;
    }
    return false;
  }

  function update(dt) {
    for (let i = animated.length - 1; i >= 0; i--) if (animated[i](dt)) animated.splice(i, 1);
  }

  return { colliders, doors, spawnPoints, monitors, areaAt, isUnlocked, pathTarget, moveCircle, raycast, pointBlocked, update, box, sign };
}

function rayBox(o, d, b) {
  let tmin = 0, tmax = Infinity;
  for (const [oo, dd, mn, mx] of [[o.x, d.x, b.minX, b.maxX], [o.y, d.y, b.minY, b.maxY], [o.z, d.z, b.minZ, b.maxZ]]) {
    if (Math.abs(dd) < 1e-9) {
      if (oo < mn || oo > mx) return Infinity;
    } else {
      let t1 = (mn - oo) / dd, t2 = (mx - oo) / dd;
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}
