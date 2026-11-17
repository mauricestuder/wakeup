// Idle Lift: pistes drawn as groomed ribbons lying on the snow, edged in their difficulty colour.
import { THREE, merge, at, toon } from './scene.js';
import { T, DIFF } from '../tuning.js';

const WHITE = new THREE.Color(0.9, 0.95, 1.0);

// A strip draped over the terrain along a list of points one tile apart.
export function ribbon(ter, pts, width, lift, edge, inner = WHITE, edgeW = 0.28) {
  const fine = [];
  for (let i = 0; i < pts.length - 1; i++) {
    fine.push(pts[i]);
    // Over a bridge or through a tunnel the strip stays level, at the piste's own height.
    const deck = pts[i].deck && pts[i + 1].deck;
    fine.push({ x: (pts[i].x + pts[i + 1].x) / 2, z: (pts[i].z + pts[i + 1].z) / 2, deck, y: (pts[i].y + pts[i + 1].y) / 2 });
  }
  fine.push(pts[pts.length - 1]);
  const h = width / 2, offs = [-h, -h + edgeW, 0, h - edgeW, h], cols = [edge, inner, inner, inner, edge];
  const pos = [], col = [], idx = [];
  for (let i = 0; i < fine.length; i++) {
    const a = fine[Math.max(0, i - 1)], b = fine[Math.min(fine.length - 1, i + 1)];
    let tx = b.x - a.x, tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    // Round off the two ends.
    const end = Math.min(i, fine.length - 1 - i), taper = end === 0 ? 0.55 : end === 1 ? 0.85 : 1;
    for (let k = 0; k < 5; k++) {
      const x = fine[i].x - tz * offs[k] * taper, z = fine[i].z + tx * offs[k] * taper;
      pos.push(x, (fine[i].deck ? fine[i].y : ter.height(x, z)) + lift, z);
      const c = cols[k], shade = k > 0 && k < 4 ? 1 - 0.035 * ((i + k) % 2) : 1; // faint corduroy
      col.push(c.r * shade, c.g * shade, c.b * shade);
    }
    if (i) for (let k = 0; k < 4; k++) {
      const p = (i - 1) * 5 + k, q = i * 5 + k;
      idx.push(p, q, p + 1, p + 1, q, q + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createPisteView(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const views = new Map();
  const mat = toon({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const signMat = toon({ vertexColors: true });

  function make(ter, p) {
    const g = new THREE.Group();
    const c = new THREE.Color(DIFF[p.diff].color);
    const m = new THREE.Mesh(ribbon(ter, p.pts, T.PISTE_WIDTH, 0.09, c), mat);
    m.userData.noOutline = true; // flat on the snow: no edge
    m.receiveShadow = true;
    g.add(m);
    // A sign at the start, in the piste's colour.
    const s = p.pts[0], n = p.pts[1];
    const sign = new THREE.Mesh(merge([
      [new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5), 0x4a3b2e, at(0, 0.55, 0)],
      [new THREE.CylinderGeometry(0.3, 0.3, 0.07, 12), DIFF[p.diff].color, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 1.15, 0)],
    ]), signMat);
    const tx = n.x - s.x, tz = n.z - s.z, l = Math.hypot(tx, tz) || 1;
    sign.position.set(s.x - tz / l * 1.5, ter.height(s.x - tz / l * 1.5, s.z + tx / l * 1.5), s.z + tx / l * 1.5);
    sign.rotation.y = Math.atan2(tx, tz);
    sign.castShadow = true;
    g.add(sign);
    return g;
  }

  return {
    sync(state, ter) {
      for (const [id, v] of views) if (!state.pisteById[id]) { group.remove(v); v.children[0].geometry.dispose(); views.delete(id); }
      for (const p of state.pistes) if (!views.has(p.id)) { const v = make(ter, p); views.set(p.id, v); group.add(v); }
    },
    clear() { for (const v of views.values()) group.remove(v); views.clear(); },
  };
}
