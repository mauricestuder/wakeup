// Trails: a ribbon that streams from the rider's feet in the air and fades.
import * as THREE from '../../game/vendor/three.module.min.js';

const MAX = 90, LIFE = 0.55;

// How each trail colours a point: k is 0 at the rider and 1 at the tail end,
// i counts points so patterns can move along the ribbon.
export const TRAIL_STYLES = {
  none: null,
  frost: { add: false, col: (k, i, c) => c.setRGB(0.2 + 0.5 * k, 0.72, 1) },
  ember: { add: false, col: (k, i, c) => c.setRGB(1, 0.62 - k * 0.5, 0.08) },
  neon: { add: false, col: (k, i, c) => c.setHSL(0.83 + 0.06 * Math.sin(i * 0.4), 1, 0.52) },
  rainbow: { add: false, col: (k, i, c, t) => c.setHSL((i * 0.035 + t * 0.4) % 1, 1, 0.5) },
  shadow: { add: false, col: (k, i, c) => c.setRGB(0.18 + 0.12 * k, 0.08, 0.28 + 0.1 * k) },
  void: { add: false, alpha: 0.9, col: (k, i, c) => c.setRGB(0, 0, 0) },
  gold: { add: false, col: (k, i, c, t) => c.setRGB(1, 0.7, 0.1).multiplyScalar(0.75 + 0.5 * Math.max(0, Math.sin(i * 1.7 + t * 18))) },
};

export class Trail {
  constructor(scene) {
    this.pts = [];
    this.t = 0;
    this.style = null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 2 * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 2 * 4), 4));
    const idx = [];
    for (let i = 0; i < MAX - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  setStyle(id) {
    this.style = TRAIL_STYLES[id] || null;
    this.pts.length = 0;
    if (this.style) this.mesh.material.blending = this.style.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.mesh.material.needsUpdate = true;
  }

  // pos: where the ribbon starts, side: unit vector across it, on: emitting.
  update(dt, pos, side, on, width = 0.05) {
    this.t += dt;
    for (const p of this.pts) p.age += dt;
    while (this.pts.length && this.pts[0].age > LIFE) this.pts.shift();
    if (this.style && on) {
      this.pts.push({ p: pos.clone(), s: side.clone().multiplyScalar(width), age: 0 });
      if (this.pts.length > MAX) this.pts.shift();
    }
    const n = this.pts.length;
    this.mesh.visible = !!this.style && n > 1;
    if (!this.mesh.visible) return;
    const P = this.mesh.geometry.attributes.position, C = this.mesh.geometry.attributes.color;
    const c = new THREE.Color();
    for (let j = 0; j < MAX; j++) {
      const q = this.pts[Math.min(j, n - 1)];
      const k = q.age / LIFE, w = 1 - k * 0.8;
      P.setXYZ(j * 2, q.p.x + q.s.x * w, q.p.y + q.s.y * w, q.p.z + q.s.z * w);
      P.setXYZ(j * 2 + 1, q.p.x - q.s.x * w, q.p.y - q.s.y * w, q.p.z - q.s.z * w);
      this.style.col(k, j, c, this.t);
      const a = j < n ? (1 - k) * (1 - k) * (this.style.alpha ?? 0.55) : 0;
      C.setXYZW(j * 2, c.r, c.g, c.b, a);
      C.setXYZW(j * 2 + 1, c.r, c.g, c.b, a);
    }
    P.needsUpdate = C.needsUpdate = true;
  }
}
