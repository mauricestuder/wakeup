// Idle Lift: low-poly buildings and the village at the car park.
import { THREE, merge, at } from './scene.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const SNOWY = 0xf4f7fb, STONE = 0x6a6f78, GLASS = 0x26384d;

// A pitched roof with its ridge along z.
function gable(w, d, h) {
  const x = w / 2, z = d / 2, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    -x, 0, -z, -x, 0, z, 0, h, z, -x, 0, -z, 0, h, z, 0, h, -z,
    x, 0, z, x, 0, -z, 0, h, -z, x, 0, z, 0, h, -z, 0, h, z,
    -x, 0, z, x, 0, z, 0, h, z, x, 0, -z, -x, 0, -z, 0, h, -z], 3));
  return g;
}

// Walls on a stone base with a snow-covered roof. Returns parts for merge().
function house(w, d, h, wall, trim, roofH = 0.7) {
  return [
    [box(w + 0.2, 1.8, d + 0.2), STONE, at(0, -0.85, 0)],
    [box(w, h, d), wall, at(0, h / 2, 0)],
    [box(w + 0.36, 0.1, d + 0.36), trim, at(0, h + 0.02, 0)],
    [gable(w + 0.3, d + 0.3, roofH), SNOWY, at(0, h + 0.07, 0)],
  ];
}

const MODELS = {
  hut: () => merge([
    ...house(1.9, 1.6, 0.95, 0x8a5a36, 0x5c3a22, 0.75),
    [box(1.92, 0.3, 1.62), 0x7a7f88, at(0, 0.12, 0)],                               // stone footing
    [box(0.3, 0.8, 0.3), 0x7a7f88, at(0.5, 1.55, -0.3)], [box(0.38, 0.06, 0.38), 0x4a4f57, at(0.5, 1.97, -0.3)], // chimney
    [box(0.4, 0.62, 0.05), 0x3b2616, at(0, 0.31, 0.81)], [box(0.48, 0.06, 0.07), 0x5c3a22, at(0, 0.65, 0.82)],
    [box(0.36, 0.3, 0.05), GLASS, at(-0.55, 0.55, 0.81)], [box(0.36, 0.3, 0.05), GLASS, at(0.55, 0.55, 0.81)],
    [box(0.44, 0.05, 0.07), 0xf4f4f0, at(-0.55, 0.72, 0.82)], [box(0.44, 0.05, 0.07), 0xf4f4f0, at(0.55, 0.72, 0.82)], // window frames
    [box(0.44, 0.05, 0.07), 0xf4f4f0, at(-0.55, 0.38, 0.82)], [box(0.44, 0.05, 0.07), 0xf4f4f0, at(0.55, 0.38, 0.82)],
    [box(0.42, 0.1, 0.12), 0x7a4a22, at(-0.55, 0.33, 0.86)], [box(0.42, 0.1, 0.12), 0x7a4a22, at(0.55, 0.33, 0.86)],     // flower boxes
    [box(0.36, 0.06, 0.08), 0xe5484d, at(-0.55, 0.4, 0.86)], [box(0.36, 0.06, 0.08), 0xf2c230, at(0.55, 0.4, 0.86)],
    [box(0.5, 0.14, 0.04), 0xf4f4f0, at(0, 0.95, 0.83)],                            // name board
    [box(0.6, 0.35, 0.3), 0x9a6a3a, at(-1.15, 0.18, -0.4)], [box(0.62, 0.06, 0.32), 0xf4f8ff, at(-1.15, 0.38, -0.4)], // wood pile
    [box(0.06, 0.6, 0.06), 0x5c3a22, at(-1.2, 0.3, 1.8)], [box(0.06, 0.6, 0.06), 0x5c3a22, at(1.2, 0.3, 1.8)],      // terrace rail
    [box(2.46, 0.06, 0.06), 0x5c3a22, at(0, 0.55, 1.83)],
    [box(0.9, 0.06, 0.3), 0x6b4a2f, at(0, 0.3, 1.25)], [box(0.9, 0.06, 0.3), 0x6b4a2f, at(0, 0.3, 1.6)],           // benches
    [box(2.3, 0.1, 1.0), 0xb98a5a, at(0, 0.02, 1.35)],                               // terrace
    [new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), 0x4a3b2e, at(-0.7, 0.5, 1.4)],
    [new THREE.ConeGeometry(0.5, 0.25, 8), 0xe5484d, at(-0.7, 1.0, 1.4)],            // parasols
    [new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), 0x4a3b2e, at(0.7, 0.5, 1.4)],
    [new THREE.ConeGeometry(0.5, 0.25, 8), 0xf2c230, at(0.7, 1.0, 1.4)],
  ]),
  rental: () => merge([
    ...house(1.7, 1.4, 0.9, 0x2aa7a0, 0x1b6f6a, 0.5),
    [box(1.1, 0.3, 0.06), 0xf2a33a, at(0, 0.78, 0.72)],
    [box(0.45, 0.6, 0.05), 0x173d3b, at(0, 0.3, 0.71)],
    [box(0.05, 0.85, 0.05), 0xe5484d, at(0.95, 0.42, 0.5, 0, 1, 1, 1)], [box(0.05, 0.85, 0.05), 0xf2c230, at(1.05, 0.42, 0.4)],
    [box(0.05, 0.85, 0.05), 0x3d8bff, at(1.0, 0.42, 0.3)], [box(0.05, 0.85, 0.05), 0x34b05a, at(1.05, 0.42, 0.2)],
  ]),
  firstaid: () => merge([
    ...house(1.5, 1.3, 0.9, 0xf2f2ee, 0xd43a3a, 0.45),
    [box(0.5, 0.16, 0.05), 0xd43a3a, at(0, 0.6, 0.67)], [box(0.16, 0.5, 0.05), 0xd43a3a, at(0, 0.6, 0.67)],
    [box(0.4, 0.55, 0.05), 0x8a9099, at(-0.45, 0.28, 0.66)],
    [new THREE.CylinderGeometry(0.02, 0.02, 1.3, 4), 0x9aa0a8, at(0.9, 0.65, 0.5)], [box(0.4, 0.26, 0.02), 0xd43a3a, at(1.1, 1.15, 0.5)],
  ]),
  groomer: () => merge([
    ...house(2.4, 1.9, 1.15, 0xb23a32, 0x6f211c, 0.5),
    [box(1.5, 0.9, 0.05), 0x30343b, at(0, 0.45, 0.96)],
    // the snow groomer parked outside
    [box(0.8, 0.4, 1.2), 0xd9372f, at(1.9, 0.42, 0.7)], [box(0.7, 0.36, 0.55), 0x26384d, at(1.9, 0.8, 0.85)],
    [box(0.25, 0.26, 1.35), 0x1c1e22, at(1.55, 0.13, 0.7)], [box(0.25, 0.26, 1.35), 0x1c1e22, at(2.25, 0.13, 0.7)],
    [box(1.2, 0.3, 0.08), 0x9aa0a8, at(1.9, 0.2, 1.48)],
  ]),
  hotel: () => {
    const parts = [...house(3.2, 2.2, 2.5, 0xe9dcc3, 0x6b4a2f, 1.0)];
    for (let f = 0; f < 3; f++) {
      parts.push([box(3.3, 0.08, 0.3), 0x6b4a2f, at(0, 0.62 + f * 0.75, 1.2)]);
      for (let k = -3; k <= 3; k += 2) parts.push([box(0.4, 0.42, 0.05), GLASS, at(k * 0.42, 0.95 + f * 0.75, 1.11)]);
    }
    parts.push([box(0.6, 0.62, 0.05), 0x3b2616, at(0, 0.31, 1.11)]);
    return merge(parts);
  },
  cannon: () => merge([
    [new THREE.CylinderGeometry(0.06, 0.1, 2.3, 6), 0x8a9099, at(0, 0.5, 0)],
    [new THREE.CylinderGeometry(0.3, 0.24, 0.6, 10), 0xf2c230, new THREE.Matrix4().makeRotationX(Math.PI / 2 - 0.35).setPosition(0, 1.75, 0.1)],
    [box(0.5, 0.3, 0.4), 0x4b5058, at(0, 0.1, -0.2)],
  ]),
};

export function createBuildingView(scene) {
  const group = new THREE.Group(), village = new THREE.Group();
  scene.add(group, village);
  const views = new Map(), geos = {};
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });

  function mesh(type) {
    const m = new THREE.Mesh(geos[type] || (geos[type] = MODELS[type]()), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // The square at the bottom, a welcome arch and the valley lodge. The road and cars are in cars.js.
  function buildVillage(ter) {
    village.clear();
    const b = ter.base, y = ter.height(b.x, b.z);
    const rnd = (i) => ((Math.sin(i * 91.7) * 43758.5) % 1 + 1) % 1;
    const parts = [
      [box(9, 0.5, 3.2), 0x4b4f56, at(b.x, y - 0.17, b.z + 2.2)],
      [box(0.16, 1.9, 0.16), 0x6b4a2f, at(b.x - 1.6, y + 0.95, b.z - 0.2)], [box(0.16, 1.9, 0.16), 0x6b4a2f, at(b.x + 1.6, y + 0.95, b.z - 0.2)],
      [box(3.7, 0.5, 0.14), 0xe5484d, at(b.x, y + 1.9, b.z - 0.2)], [box(3.76, 0.08, 0.2), SNOWY, at(b.x, y + 2.18, b.z - 0.2)],
    ];
    for (const [geo, c, m] of house(3.4, 2, 1.3, 0xd9c3a0, 0x6b4a2f, 0.9)) parts.push([geo, c, at(b.x - 7, y, b.z + 2.6).multiply(m)]);
    parts.push([box(0.5, 0.75, 0.05), 0x3b2616, at(b.x - 7, y + 0.38, b.z + 3.62)]);
    const m = new THREE.Mesh(merge(parts), mat);
    m.castShadow = true; m.receiveShadow = true;
    village.add(m);
  }

  return {
    mesh, buildVillage,
    sync(state, ter) {
      for (const [id, v] of views) if (!state.buildingById[id]) { group.remove(v); views.delete(id); }
      for (const b of state.buildings) {
        if (views.has(b.id)) continue;
        const v = mesh(b.type);
        v.position.set(b.x, ter.height(b.x, b.z), b.z);
        v.rotation.y = b.rot || 0;
        views.set(b.id, v); group.add(v);
      }
    },
    clear() { for (const v of views.values()) group.remove(v); views.clear(); },
  };
}
