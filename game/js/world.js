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
  boardroom: { name: 'Boardroom',   rect: [15, 29, -9, 3] },
  loans:    { name: 'Loan Office',    rect: [-30, -15, -12, 10] },
  archive:  { name: 'Records Archive', rect: [-30, -15, -40, -12] },
  servers:  { name: 'Server Room',    rect: [-15, 15, -56, -40] },
  counting: { name: 'Counting Room',  rect: [15, 30, -56, -36] },
  garage:   { name: 'Armored Car Garage', rect: [-15, 15, 10, 28] },
  security: { name: 'Security Office', rect: [15, 29, 3, 18] },
};

export function buildWorld(scene) {
  const colliders = [];
  const doors = [];
  const animated = [];

  const mats = {
    wall: T.bankWall(),
    steel: T.steelWall(),
  };
  mats.steelMat = new THREE.MeshLambertMaterial({ map: T.steelWall() });
  mats.concreteMat = new THREE.MeshLambertMaterial({ color: 0x77736a });

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
  floorTex.repeat.set(60 / 8, 84 / 8);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 84), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -14);
  scene.add(floor);

  const vaultFloor = new THREE.Mesh(new THREE.PlaneGeometry(15, 18), new THREE.MeshLambertMaterial({ map: T.steelWall() }));
  vaultFloor.material.map.repeat.set(4, 5);
  vaultFloor.rotation.x = -Math.PI / 2;
  vaultFloor.position.set(22.5, 0.01, -27);
  scene.add(vaultFloor);

  const ceilTex = T.ceilingTex();
  ceilTex.repeat.set(15, 21);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(60, 84), new THREE.MeshLambertMaterial({ map: ceilTex }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, WALL_H, -14);
  const concrete = T.concreteFloor();
  concrete.repeat.set(30 / 4, 18 / 4);
  const garageFloor = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), new THREE.MeshLambertMaterial({ map: concrete }));
  garageFloor.rotation.x = -Math.PI / 2;
  garageFloor.position.set(0, 0.01, 19);
  scene.add(garageFloor);
  scene.add(ceil);

  // ---------- walls ----------
  // Lobby (doors: trading north, boardroom east, loan office west, garage south)
  wallX(10, -15, 9);
  wallX(10, 13, 15);
  wallZ(-15, -10, 6.4);
  wallZ(-15, 9.6, 10);
  wallZ(15, -10, -6);
  wallZ(15, -2, 10);
  wallX(-10, -15, -2);
  wallX(-10, 2, 15);
  // Trading floor (doors: archive west, server room north, vault east)
  wallZ(-15, -40, -18.5);
  wallZ(-15, -14.5, -10);
  wallX(-40, -15, -13);
  wallX(-40, -9, 15);
  wallZ(15, -40, -30);
  wallZ(15, -24, -10);
  // Vault
  wallX(-36, 15, 30, 'steel');
  wallX(-18, 15, 30, 'steel');
  wallZ(30, -36, -18, 'steel');
  // Boardroom (door to the security office in the south wall)
  wallX(3, 15, 24);
  wallX(3, 28, 29);
  wallX(-9, 15, 29);
  wallZ(29, -9, 3);
  // Loan office and records archive, west of the lobby and trading floor
  wallX(10, -30, -15);
  wallZ(-30, -40, 10);
  wallX(-12, -30, -24);
  wallX(-12, -20, -15);
  wallX(-40, -30, -15);
  // Server room north of the trading floor, counting room north of the vault
  wallZ(-15, -56, -40);
  wallX(-56, -15, 30);
  wallZ(15, -56, -50);
  wallZ(15, -46, -40);
  wallZ(30, -56, -36, 'steel');
  // Garage south of the lobby, security office south of the boardroom
  wallZ(-15, 10, 28);
  wallX(28, -15, 15);
  wallZ(15, 10, 12);
  wallZ(15, 16, 28);
  wallX(18, 15, 29);
  wallZ(29, 3, 18);

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

  addDoor({
    name: 'Boardroom', cost: 1500, x1: 14.6, x2: 15.4, z1: -6, z2: -2,
    a: 'lobby', b: 'boardroom', x: 15, z: -4, nx: 1, nz: 0,
    material: new THREE.MeshLambertMaterial({ map: T.boardroomDoor() }),
  });

  const staff = (text, plate) => new THREE.MeshLambertMaterial({ map: T.staffDoor(text, plate) });
  addDoor({
    name: 'Loan Office', cost: 1000, x1: -15.4, x2: -14.6, z1: 6.4, z2: 9.6,
    a: 'lobby', b: 'loans', x: -15, z: 8, nx: -1, nz: 0, material: staff('LOANS'),
  });
  addDoor({
    name: 'Records Archive', cost: 1250, x1: -15.4, x2: -14.6, z1: -18.5, z2: -14.5,
    a: 'trading', b: 'archive', x: -15, z: -16.5, nx: -1, nz: 0, material: staff('RECORDS'),
  });
  addDoor({
    name: 'Records Archive', cost: 750, x1: -24, x2: -20, z1: -12.25, z2: -11.75,
    a: 'loans', b: 'archive', x: -22, z: -12, nx: 0, nz: -1, material: new THREE.MeshLambertMaterial({ map: boards }),
  });
  addDoor({
    name: 'Server Room', cost: 1500, x1: -13, x2: -9, z1: -40.25, z2: -39.75,
    a: 'trading', b: 'servers', x: -11, z: -40, nx: 0, nz: -1, material: staff('SERVERS', '#3aa0ff'),
  });
  addDoor({
    name: 'Counting Room', cost: 2000, x1: 14.6, x2: 15.4, z1: -50, z2: -46,
    a: 'servers', b: 'counting', x: 15, z: -48, nx: 1, nz: 0, material: staff('COUNTING', '#3fd16a'),
  });
  const shutter = T.shutterTex();
  addDoor({
    name: 'Armored Car Garage', cost: 1000, x1: 9, x2: 13, z1: 9.75, z2: 10.25,
    a: 'lobby', b: 'garage', x: 11, z: 10, nx: 0, nz: 1, material: new THREE.MeshLambertMaterial({ map: shutter }),
  });
  addDoor({
    name: 'Security Office', cost: 1250, x1: 24, x2: 28, z1: 2.75, z2: 3.25,
    a: 'boardroom', b: 'security', x: 26, z: 3, nx: 0, nz: 1, material: staff('SECURITY', '#ff4a3a'),
  });
  addDoor({
    name: 'Security Office', cost: 1250, x1: 14.6, x2: 15.4, z1: 12, z2: 16,
    a: 'garage', b: 'security', x: 15, z: 14, nx: 1, nz: 0, material: staff('SECURITY', '#ff4a3a'),
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
  const BILL_AREAS = ['lobby', 'trading', 'lobby', 'trading', 'loans', 'archive', 'servers', 'counting', 'garage', 'security'].map(k => AREAS[k]);
  const billMat = new THREE.MeshLambertMaterial({ map: T.bill(), side: THREE.DoubleSide });
  const billGeo = new THREE.PlaneGeometry(0.5, 0.25);
  for (let i = 0; i < 130; i++) {
    const m = new THREE.Mesh(billGeo, billMat);
    const [x1, x2, z1, z2] = BILL_AREAS[i % BILL_AREAS.length].rect;
    const x = x1 + 1 + Math.random() * (x2 - x1 - 2);
    const z = z1 + 1 + Math.random() * (z2 - z1 - 2);
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

  // Boardroom: long table with chairs, the President's portrait and a sinking chart.
  box(19, 25, -4.2, -1.8, 0, 0.78, wood);
  box(18.9, 25.1, -4.3, -1.7, 0.78, 0.84, new THREE.MeshLambertMaterial({ color: 0x3a1f0c }), false);
  const leather = new THREE.MeshLambertMaterial({ color: 0x2a1410 });
  for (const x of [19.8, 21.4, 23, 24.6]) {
    for (const [z, back] of [[-5, -5.3], [-1, -0.7]]) {
      box(x - 0.3, x + 0.3, z - 0.3, z + 0.3, 0, 0.5, leather, false);
      box(x - 0.3, x + 0.3, back - 0.06, back + 0.06, 0.5, 1.3, leather, false);
    }
  }
  box(25.6, 26.2, -3.3, -2.7, 0, 0.5, leather, false); // the President's seat at the head
  box(26.1, 26.25, -3.4, -2.6, 0.5, 1.6, leather, false);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0, 1.6), gold);
  frame.position.set(28.66, 2.6, -3); scene.add(frame);
  const portrait = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.75), new THREE.MeshLambertMaterial({ map: T.npcFace('shark'), emissive: 0x222222 }));
  portrait.position.set(28.61, 2.6, -3); portrait.rotation.y = -Math.PI / 2; scene.add(portrait);
  sign('OUR FOUNDER', 28.62, 1.35, -3, -Math.PI / 2, 1.6, 0.3, { h: 64 });
  const chart = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), new THREE.MeshBasicMaterial({ map: T.chartTex() }));
  chart.position.set(19.5, 2.4, -8.68); scene.add(chart);
  sign('BOARDROOM', 14.66, 4.2, -4, -Math.PI / 2, 3, 0.6);

  // Loan office: desks with lamps, chairs and a predatory rate sign.
  for (const z of [-6, 0, 6]) {
    box(-25.5, -23, z - 0.7, z + 0.7, 0, 0.8, wood);
    box(-25.6, -22.9, z - 0.8, z + 0.8, 0.8, 0.85, new THREE.MeshLambertMaterial({ color: 0x2e4a2a }), false);
    box(-22.1, -21.5, z - 0.3, z + 0.3, 0, 0.5, leather, false);
    box(-21.56, -21.44, z - 0.3, z + 0.3, 0.5, 1.2, leather, false);
    box(-25.2, -24.9, z - 0.15, z + 0.15, 0.85, 1.25, gold, false);
    box(-25.35, -24.75, z - 0.3, z + 0.3, 1.25, 1.4, new THREE.MeshBasicMaterial({ color: 0x9fd88a }), false);
  }
  for (const z of [-10.6, 8.6]) box(-29.6, -28.4, z - 0.6, z + 0.6, 0, 1.4, mats.steelMat);
  sign('LOANS\n99.9% APR', -29.68, 3.0, -1, Math.PI / 2, 5, 1.6, { bg: '#2a0606', fg: '#ff5a4a', border: '#7a1a12', h: 256 });
  sign('LOAN OFFICE', -15.32, 4.2, 4, -Math.PI / 2, 3.2, 0.6);

  // Records archive: rows of short shelves full of boxes.
  const shelfMat = new THREE.MeshLambertMaterial({ map: T.fileShelf() });
  for (const x of [-26, -21.5]) {
    for (const z of [-36, -31, -26, -21]) box(x - 0.45, x + 0.45, z - 1.5, z + 1.5, 0, 2.6, shelfMat);
  }
  sign('RECORDS ARCHIVE', -15.32, 4.2, -21, -Math.PI / 2, 3.6, 0.6);
  sign('ALL DEBTS\nARE FOREVER', -29.68, 3.4, -28.5, Math.PI / 2, 4, 1.2, { h: 256 });

  // Server room: rows of humming racks with blinking lights.
  const rackMat = new THREE.MeshLambertMaterial({ map: T.serverRack(), emissive: 0x111111 });
  const leds = [];
  for (const z of [-45.5, -50.5]) {
    for (const x of [-6.5, -1, 4.5, 10]) {
      box(x - 1.5, x + 1.5, z - 0.5, z + 0.5, 0, 2.7, rackMat);
      for (let i = 0; i < 4; i++) {
        const led = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.05), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x33ff88 : 0xff4040 }));
        led.position.set(x - 1.2 + i * 0.8, 2.3 - i * 0.37, z + 0.51);
        scene.add(led); leds.push(led);
      }
    }
  }
  let ledT = 0;
  animated.push((dt) => {
    ledT -= dt;
    if (ledT <= 0) { ledT = 0.12; leds[Math.floor(Math.random() * leds.length)].visible ^= true; }
    return false;
  });
  sign('SERVER ROOM', -11, 4.3, -55.68, 0, 3.4, 0.6, { bg: '#06121f', fg: '#7fc8ff', border: '#2a6aa0' });
  sign('DO NOT UNPLUG\nTHE ECONOMY', 5, 3.6, -55.68, 0, 4.4, 1.2, { bg: '#06121f', fg: '#7fc8ff', border: '#2a6aa0', h: 256 });

  // Counting room: tables piled with cash bricks.
  const brickGeo = new THREE.BoxGeometry(0.5, 0.16, 0.25);
  const brickMat = new THREE.MeshLambertMaterial({ map: T.cashBrick() });
  for (const [cx, cz] of [[19.5, -42], [25.5, -42], [19.5, -50], [25.5, -50]]) {
    box(cx - 1.6, cx + 1.6, cz - 0.9, cz + 0.9, 0, 0.85, wood);
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 5 - layer; i++) {
        const b = new THREE.Mesh(brickGeo, brickMat);
        b.position.set(cx - 1 + i * 0.52 + layer * 0.26, 0.93 + layer * 0.16, cz + (layer % 2 ? 0.2 : -0.2));
        scene.add(b);
      }
    }
  }
  sign('COUNTING ROOM', 22.5, 4.2, -55.68, 0, 3.6, 0.6);
  sign('COUNT IT TWICE.\nKEEP IT ALL.', 29.68, 3.4, -42, -Math.PI / 2, 4, 1.2, { h: 256 });

  // Garage: an armored cash truck, parking lines, pillars and the big shutter.
  const truckMat = new THREE.MeshLambertMaterial({ color: 0x3d4a3d });
  box(-6.4, -3.6, 14, 21, 0, 2.8, truckMat);
  box(-6.3, -3.7, 21, 23, 0, 2.1, truckMat);
  box(-6.25, -3.75, 22.2, 22.95, 1.2, 1.9, new THREE.MeshBasicMaterial({ color: 0x1a2a33 }), false);
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10);
  for (const x of [-6.5, -3.5]) for (const z of [15.5, 19.5, 22]) {
    const w = new THREE.Mesh(wheelGeo, dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.5, z); scene.add(w);
  }
  sign('ARMORED\nCASH OUT', -6.42, 1.7, 17.5, -Math.PI / 2, 4.6, 1.5, { bg: '#2a3a2a', fg: '#f5d76e', border: '#b8902f', h: 256 });
  sign('ARMORED\nCASH OUT', -3.58, 1.7, 17.5, Math.PI / 2, 4.6, 1.5, { bg: '#2a3a2a', fg: '#f5d76e', border: '#b8902f', h: 256 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xc9a227 });
  for (const x of [-8, -2, 4]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 7), lineMat);
    l.rotation.x = -Math.PI / 2; l.position.set(x, 0.02, 23.5); scene.add(l);
  }
  for (const x of [3, 9]) box(x - 0.4, x + 0.4, 18.6, 19.4, 0, WALL_H, mats.concreteMat);
  const shutterWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.2), new THREE.MeshLambertMaterial({ map: T.shutterTex() }));
  shutterWall.position.set(0, 2.1, 27.68); shutterWall.rotation.y = Math.PI; scene.add(shutterWall);
  sign('LOADING DOCK – CLOSED', 0, 4.55, 27.66, Math.PI, 5, 0.5);

  // Security office: a wall of camera feeds, a desk and lockers.
  for (let i = 0; i < 6; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), new THREE.MeshBasicMaterial({ map: T.cctvTex(i + 3) }));
    scr.position.set(19 + col * 1.6, 2.0 + row * 1.2, 17.66); scr.rotation.y = Math.PI; scene.add(scr);
    monitors.push(scr);
  }
  box(17.5, 23.5, 15.4, 16.6, 0, 0.8, wood);
  box(19.9, 20.5, 13.9, 14.5, 0, 0.5, leather, false);
  for (const z of [6, 7.2, 8.4, 9.6]) box(28.1, 28.7, z - 0.55, z + 0.55, 0, 2.2, mats.steelMat);
  sign('SECURITY', 15.32, 4.2, 7, Math.PI / 2, 2.8, 0.6, { bg: '#1f0606', fg: '#ff6a5a', border: '#7a1a12' });

  // Ceiling lamps
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1c9 });
  for (const [x, z] of [[0, 0], [-8, -25], [8, -25], [0, -33], [0, -17], [22.5, -27], [22, -3],
    [-22.5, -1], [-22.5, -26], [0, -48], [22.5, -46], [0, 19], [22, 10]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.5), lampMat);
    l.position.set(x, WALL_H - 0.05, z);
    scene.add(l);
  }

  // ---------- spawn vents ----------
  const spawnPoints = [
    { x: -13.7, z: -3, area: 'lobby' }, { x: 6, z: -8.5, area: 'lobby' },
    { x: 13, z: -8.5, area: 'lobby' }, { x: -13, z: -8.5, area: 'lobby' },
    { x: -5, z: -38.5, area: 'trading' }, { x: 13, z: -38.5, area: 'trading' },
    { x: -13, z: -12, area: 'trading' }, { x: 12.5, z: -12, area: 'trading' },
    { x: 28, z: -34.5, area: 'vault' }, { x: 28, z: -19.5, area: 'vault' },
    { x: 16.6, z: 1.5, area: 'boardroom' }, { x: 27.6, z: -6.6, area: 'boardroom' },
    { x: -28, z: 8.5, area: 'loans' }, { x: -28, z: -10.5, area: 'loans' },
    { x: -28, z: -38.5, area: 'archive' }, { x: -17, z: -38.5, area: 'archive' },
    { x: -13, z: -54.5, area: 'servers' }, { x: 13, z: -54.5, area: 'servers' },
    { x: 28.5, z: -54.5, area: 'counting' }, { x: 17, z: -54.5, area: 'counting' },
    { x: -13, z: 26.5, area: 'garage' }, { x: 13, z: 26.5, area: 'garage' },
    { x: 27.5, z: 16.5, area: 'security' }, { x: 16.5, z: 16.5, area: 'security' },
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
    [0, -36, 0x9effc4, 20], [22.5, -27, 0xffd56a, 35], [22, -3, 0xffd9a0, 30],
    [-22.5, -1, 0xffd9a0, 28], [-22.5, -26, 0xffe0b0, 26], [0, -48, 0x6ab8ff, 32],
    [22.5, -46, 0xffd56a, 30], [0, 19, 0xdfe8ff, 32], [22, 10, 0xffb0a0, 26],
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
    let best = 'lobby', bestD = Infinity;
    for (const key in AREAS) {
      const [x1, x2, z1, z2] = AREAS[key].rect;
      if (x >= x1 && x <= x2 && z >= z1 && z <= z2) return key;
      const d = Math.hypot(Math.max(x1 - x, 0, x - x2), Math.max(z1 - z, 0, z - z2));
      if (d < bestD) { bestD = d; best = key; }
    }
    return best;
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
