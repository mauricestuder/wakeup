// PS1 horror look: low-res render, wobbly vertex snapping, 15-bit dithered
// color, film grain, scanlines and a dark vignette.
import * as THREE from '../vendor/three.module.min.js';


// Snap every vertex to a coarse screen grid, like the PlayStation's
// integer-only GPU. Patching the prototype covers materials made later too.
const snap = { value: new THREE.Vector2(192, 108) };
THREE.Material.prototype.onBeforeCompile = function (shader) {
  shader.uniforms.ps1Snap = snap;
  shader.vertexShader = shader.vertexShader
    .replace('void main() {', 'uniform vec2 ps1Snap;\nvoid main() {')
    .replace('#include <project_vertex>', `#include <project_vertex>
      gl_Position.xy = floor(gl_Position.xy / gl_Position.w * ps1Snap) / ps1Snap * gl_Position.w;`);
};
THREE.Material.prototype.customProgramCacheKey = () => 'ps1';

const FRAG = `
  uniform sampler2D tDiffuse; uniform vec2 res; uniform float time; uniform float fx; varying vec2 vUv;
  float bayer(vec2 p) {
    int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
    int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
    return float(m[i]) / 16.0 - 0.5;
  }
  float rand(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
  void main() {
    vec2 px = floor(vUv * res);
    vec3 c = pow(texture2D(tDiffuse, vUv).rgb, vec3(1.0 / 2.2));
    c = pow(c, vec3(1.15)) * vec3(1.05, 0.98, 0.9);
    c += fx * bayer(px) / 24.0;
    c = mix(c, floor(c * 31.0 + 0.5) / 31.0, fx);
    c *= smoothstep(0.85, 0.3, length(vUv - 0.5));
    c += fx * (rand(px) - 0.5) * 0.06;
    c *= 1.0 - fx * (0.08 - 0.08 * mod(px.y, 2.0));
    gl_FragColor = vec4(c, 1.0);
  }`;

export class PS1Pass {
  constructor(renderer) {
    this.renderer = renderer;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    });
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.target.texture }, res: { value: new THREE.Vector2() }, time: { value: 0 }, fx: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: FRAG,
      depthTest: false, depthWrite: false,
    });
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.height = 360; // internal render height in pixels
    this.effects = true;
  }

  // Quality is the render height; effects toggles dither, grain, scanlines
  // and the wobbly vertices.
  configure(height, effects) {
    this.height = height;
    this.effects = effects;
    this.mat.uniforms.fx.value = effects ? 1 : 0;
    if (this.w) this.setSize(this.w, this.h);
  }

  setSize(w, h) {
    this.w = w; this.h = h;
    const H = this.height, W = Math.round(H * w / h);
    this.target.setSize(W, H);
    this.mat.uniforms.res.value.set(W, H);
    if (this.effects) snap.value.set(W / 2, H / 2);
    else snap.value.set(4096, 4096);
  }

  // Draw the world, then the gun on top, into the low-res target and
  // blow it up to the screen through the filter.
  render(scene, camera, vmScene, vmCamera) {
    const r = this.renderer;
    r.setRenderTarget(this.target);
    r.clear();
    r.render(scene, camera);
    r.clearDepth();
    r.render(vmScene, vmCamera);
    r.setRenderTarget(null);
    this.mat.uniforms.time.value = (performance.now() / 1000) % 10;
    r.render(this.scene, this.camera);
  }
}
