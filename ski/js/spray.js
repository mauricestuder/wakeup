// Snow spray thrown up by the skis when carving, braking and landing.
import * as THREE from '../../game/vendor/three.module.min.js';

const N = 400;

export class Spray {
  constructor(scene) {
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.life = new Float32Array(N);
    this.alpha = new Float32Array(N);
    this.next = 0;
    this.carry = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { scale: { value: 1 } },
      vertexShader: `attribute float alpha; varying float a;
        void main(){ a = alpha; vec4 mv = modelViewMatrix * vec4(position,1.);
        gl_PointSize = (0.25 + (1.0-alpha)*0.35) * 380. / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float a; void main(){ vec2 c = gl_PointCoord-0.5; float d = dot(c,c);
        if (d > 0.25) discard; gl_FragColor = vec4(0.97,0.98,1.,a*(1.-d*4.)*0.8); }`,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.wasAir = false;
  }

  add(p, v, n) {
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % N;
      this.pos.set([p.x + (Math.random() - 0.5) * 0.5, p.y + 0.1, p.z + (Math.random() - 0.5) * 0.5], i * 3);
      this.vel.set([v.x + (Math.random() - 0.5) * 3, v.y + Math.random() * 2.5, v.z + (Math.random() - 0.5) * 3], i * 3);
      this.life[i] = 0.5 + Math.random() * 0.5;
    }
  }

  emitFrom(skier, dt) {
    const landed = this.wasAir && skier.state === 'ground';
    this.wasAir = skier.state === 'air';
    const sp = skier.speed;
    const v = skier.v.clone().multiplyScalar(0.35);
    if (landed) this.add(skier.p, v, 40);
    if (skier.state !== 'ground' && skier.state !== 'crash') return;
    this.carry += dt * (skier.scrub * 160 + Math.min(sp, 25) * 1.2);
    const n = Math.floor(this.carry);
    this.carry -= n;
    if (n) this.add(skier.p, v, n);
  }

  update(dt) {
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 6 * dt;
      const drag = Math.exp(-2.5 * dt);
      this.vel[i * 3] *= drag; this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.max(0, Math.min(1, this.life[i] * 1.6));
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.alpha.needsUpdate = true;
  }
}
