// Idle Lift: the 3D stage. Renderer, sky, light, the mountain mesh, the forest and falling snow.
import * as THREE from '../../../game/vendor/three.module.min.js';
import { T, DIFF } from '../tuning.js';
import { clamp, smooth } from '../terrain.js';

export { THREE };

// Join simple geometries into one, painting each part in one colour.
export function merge(parts) {
  const pos = [], nor = [], col = [];
  for (const [geo, color, matrix] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    g.computeVertexNormals();
    const c = new THREE.Color(color);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) { pos.push(p[i], p[i + 1], p[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]); col.push(c.r, c.g, c.b); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
// ---------- the blocky pixel look ----------
// Every surface gets a small pixel-art texture, like 16 x 16 blocks: a few shades of its own colour,
// sharp pixels close up. It is laid along the faces of each part in the part's own space, so it
// sticks to moving things. density = texture pixels per unit, amp = how strong the shading is.
let PIX = null;
function pixTex() {
  if (PIX) return PIX;
  const n = 16, d = new Uint8Array(n * n * 4);
  let s = 12345;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n * n; i++) {
    // Four shades, like a hand-made pixel palette, with now and then a darker speck.
    let v = Math.floor(r() * 4) / 3;
    if (r() < 0.06) v = 0;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.round(v * 255); d[i * 4 + 3] = 255;
  }
  PIX = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  PIX.wrapS = PIX.wrapT = THREE.RepeatWrapping;
  PIX.magFilter = THREE.NearestFilter; PIX.minFilter = THREE.LinearMipmapLinearFilter; PIX.generateMipmaps = true;
  PIX.needsUpdate = true;
  return PIX;
}
export function pixMat(o = {}, density = 12, amp = 0.3) {
  const m = new THREE.MeshLambertMaterial(o);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.pixTex = { value: pixTex() }; sh.uniforms.pixD = { value: density }; sh.uniforms.pixA = { value: amp };
    sh.vertexShader = 'varying vec3 vPixP;\nvarying vec3 vPixN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPixP = position; vPixN = normal;');
    sh.fragmentShader = 'uniform sampler2D pixTex;\nuniform float pixD;\nuniform float pixA;\nvarying vec3 vPixP;\nvarying vec3 vPixN;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  vec3 an = abs(vPixN);
  vec2 tuv = an.x > an.y && an.x > an.z ? vPixP.zy : (an.y > an.z ? vPixP.xz : vPixP.xy);
  diffuseColor.rgb *= 1.0 + pixA * (texture2D(pixTex, tuv * pixD / 16.0).r - 0.5);`);
  };
  m.customProgramCacheKey = () => 'pix' + density + '/' + amp;
  return m;
}

export const at = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));

const SKY = {
  sun: { top: 0x3f86d8, mid: 0xbfdcf2, fog: 0xcfe3f3, sun: 2.5, amb: 1.25, far: 520 },
  cloud: { top: 0x8ea3b6, mid: 0xcfd8df, fog: 0xd2dae0, sun: 1.1, amb: 1.25, far: 420 },
  snow: { top: 0xa9b4bf, mid: 0xdfe4e8, fog: 0xe2e6ea, sun: 0.7, amb: 1.4, far: 230 },
  storm: { top: 0x6f7b87, mid: 0xb3bcc4, fog: 0xbcc4cb, sun: 0.4, amb: 1.25, far: 150 },
  thaw: { top: 0x5d98d2, mid: 0xdfe3d2, fog: 0xdfe6dc, sun: 2.0, amb: 1.0, far: 480 },
};

export function createScene(canvas, opts) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const baseRatio = Math.min(devicePixelRatio || 1, 1.5);
  let scale = 1, frameNo = 0;
  renderer.setPixelRatio(baseRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // redrawn every second frame, see render()
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  let treeShadows = false; // tree shade is painted on the snow instead, see paintLand

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe3f3, 120, 520);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 900);

  const hemi = new THREE.HemisphereLight(0xdcebff, 0xeaf0ff, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.3);
  sun.castShadow = true;
  const sm = opts.touch ? 1024 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera;
  sc.left = -78; sc.right = 78; sc.top = 78; sc.bottom = -78; sc.near = 20; sc.far = 400;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.25;
  scene.add(sun, sun.target);

  // Sky dome.
  const skyU = { top: { value: new THREE.Color(0x3f86d8) }, mid: { value: new THREE.Color(0xbfdcf2) } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; varying vec3 vp; void main(){ float h = clamp(normalize(vp).y * 1.6 + .08, 0., 1.); gl_FragColor = vec4(mix(mid, top, pow(h, .8)), 1.); }',
  }));
  sky.renderOrder = -10;
  scene.add(sky);

  // Falling snow, in a box that follows the camera's target.
  const FLAKES = opts.touch ? 1500 : 3000;
  const snowU = { time: { value: 0 }, centre: { value: new THREE.Vector3() }, amount: { value: 0 }, size: { value: 1 }, wind: { value: 1 } };
  const flakeGeo = new THREE.BufferGeometry();
  const fp = new Float32Array(FLAKES * 3);
  for (let i = 0; i < fp.length; i++) fp[i] = Math.random();
  flakeGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const flakes = new THREE.Points(flakeGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: snowU,
    vertexShader: `uniform float time; uniform vec3 centre; uniform float amount; uniform float size; uniform float wind;
      varying float a;
      void main(){
        vec3 box = vec3(90., 50., 90.);
        vec3 p = position * box + vec3(time * 3.2 * wind + sin(time * .6 + position.y * 20.) * 1.5, -time * 5., time * 1.1 * wind);
        p = mod(p, box) - box * .5 + centre + vec3(0., 12., 0.);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * 90. / -mv.z;
        a = step(position.x * .999 + position.z * .001, amount);
      }`,
    fragmentShader: 'varying float a; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(1., 1., 1., a * smoothstep(.5, .15, d) * .85); }',
  }));
  flakes.frustumCulled = false;
  flakes.renderOrder = 10;
  scene.add(flakes);

  // ---------- the mountain ----------
  let ter = null, land = null, trees = null, overlay = 'none', snowFn = null;
  const world = new THREE.Group();
  scene.add(world);
  const SNOW = new THREE.Color(0.95, 0.97, 1.0), SHADE = new THREE.Color(0.74, 0.83, 0.99), ROCK = new THREE.Color(0.45, 0.44, 0.47),
    GRASS = new THREE.Color(0.47, 0.5, 0.33), DARKROCK = new THREE.Color(0.3, 0.29, 0.32), WIND = new THREE.Color(0.86, 0.91, 0.99), ICE = new THREE.Color(0.55, 0.78, 0.92), DIRT = new THREE.Color(0.5, 0.43, 0.34), UNDER = new THREE.Color(0.56, 0.66, 0.84);
  const tmpC = new THREE.Color(), tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3();

  function buildLand() {
    const N = ter.N, W = ter.W, h = ter.h;
    const tris = N * N * 2;
    const pos = new Float32Array(tris * 9), col = new Float32Array(tris * 9);
    let k = 0;
    const put = (i, j) => { pos[k++] = i; pos[k++] = h[j * W + i]; pos[k++] = j; };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      put(i, j); put(i, j + 1); put(i + 1, j);
      put(i + 1, j); put(i, j + 1); put(i + 1, j + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    land = new THREE.Mesh(geo, pixMat({ vertexColors: true }, 2, 0.13));
    land.receiveShadow = true;
    world.add(land);

    buildFar();
  }

  // The land around the mountain: a coarse mesh that is fine only where it meets the
  // real one, so the two join without gaps. Painted once, it never changes.
  function buildFar() {
    const N = ter.N, steps = [2, 5, 9, 14, 20, 28, 40, 56, 80, 112, 152, 200, 256, 320, 384, 448];
    const line = [];
    for (let i = steps.length - 1; i >= 0; i--) line.push(-steps[i]);
    for (let i = 0; i <= N; i++) line.push(i);
    for (const d of steps) line.push(N + d);
    const n = line.length, hs = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) hs[j * n + i] = ter.ground(line[i], line[j]);
    // One colour per corner, so the far slopes shade softly instead of in flat patches.
    const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), idx = [];
    const FOREST = new THREE.Color(0.3, 0.42, 0.36), nn = new THREE.Vector3();
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = (j * n + i) * 3, x = line[i], z = line[j], y = hs[j * n + i];
      // Slightly sunk where it meets the real mountain, so the two never fight over the same spot.
      const out = Math.hypot(Math.max(0, -x, x - N), Math.max(0, -z, z - N));
      pos[k] = x; pos[k + 1] = y - (out > 0 ? 0 : 0.03); pos[k + 2] = z;
      const e = 1.5 + out * 0.05;
      nn.set(ter.ground(x - e, z) - ter.ground(x + e, z), 2 * e, ter.ground(x, z - e) - ter.ground(x, z + e)).normalize();
      const steep = Math.sqrt(Math.max(0, 1 - nn.y * nn.y)) / Math.max(0.05, nn.y), ns = ter.noise(x * 0.9, z * 0.9);
      tmpC.copy(SNOW).lerp(SHADE, clamp(0.35 - nn.x * 0.9 + nn.z * 0.5 + (ns - 0.5) * 0.4, 0, 1) * 0.55);
      // Far away the forest is only a colour on the slope. Close by, real trees stand there.
      const w = ter.woods(x, z, y) * smooth(18, 46, out);
      if (w > 0 && !(z > N - 2.5 && z < N + 22)) tmpC.lerp(FOREST, Math.min(0.75, w * 0.9));
      const rock = smooth(0.72, 1.0, steep + (ns - 0.5) * 0.25);
      if (rock > 0) tmpC.lerp(ROCK, rock * 0.9);
      col[k] = tmpC.r; col[k + 1] = tmpC.g; col[k + 2] = tmpC.b;
    }
    const i0 = steps.length, i1 = steps.length + N; // the real mountain covers the cells from i0 to i1
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      if (i >= i0 && i < i1 && j >= i0 && j < i1) continue;
      const a = j * n + i, b = a + n;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    world.add(new THREE.Mesh(g, pixMat({ vertexColors: true }, 0.7, 0.1)));
  }

  // Colour every triangle: snow, bare ground where the snow is gone, rock on cliffs.
  // How many living trees stand close to a point.
  function near(x, z) {
    let n = 0;
    const i0 = Math.max(0, Math.floor(x - 1)), i1 = Math.min(ter.N - 1, Math.floor(x + 1)), j0 = Math.max(0, Math.floor(z - 1)), j1 = Math.min(ter.N - 1, Math.floor(z + 1));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const ids = ter.byTile.get(j * ter.N + i);
      if (ids) for (const id of ids) if (ter.alive[id]) { const t = ter.trees[id], d = Math.hypot(t.x + 0.25 - x, t.z - 0.2 - z); if (d < 1.1) n += 1.1 - d; }
    }
    return n;
  }

  function paintLand() {
    const pos = land.geometry.attributes.position.array, col = land.geometry.attributes.color.array;
    const nor = land.geometry.attributes.normal.array;
    for (let t = 0; t < pos.length; t += 9) {
      const x = (pos[t] + pos[t + 3] + pos[t + 6]) / 3, z = (pos[t + 2] + pos[t + 5] + pos[t + 8]) / 3;
      const up = nor[t + 1], steep = Math.sqrt(Math.max(0, 1 - up * up)) / Math.max(0.05, up);
      const n = ter.noise(x * 0.9, z * 0.9), depth = snowFn ? snowFn(x, z) : 40;
      if (overlay === 'steep') {
        const d = steep < T.GREEN ? 0 : steep < T.BLUE ? 1 : steep < T.RED ? 2 : 3;
        tmpC.set(DIFF[d].color).lerp(SNOW, d === 3 ? 0.25 : 0.45);
        if (steep > 0.8) tmpC.set(0x7a4bb0);
      } else if (overlay === 'snow') {
        const f = clamp(depth / 80, 0, 1);
        tmpC.setRGB(0.75 - 0.6 * f, 0.55 + 0.3 * f - 0.45 * Math.max(0, f - 0.6), 0.35 + 0.65 * f);
        if (depth <= 0) tmpC.copy(DIRT);
      } else {
        // West and north faces sit in blue shade, like a real snowfield.
        tmpC.copy(SNOW).lerp(SHADE, clamp(0.3 - nor[t] * 1.3 + nor[t + 2] * 0.6 + (n - 0.5) * 0.4, 0, 1) * 0.7);
        const bare = 1 - smooth(-2, 14, depth + (n - 0.5) * 12);
        if (bare > 0) tmpC.lerp(n > 0.55 ? DIRT : GRASS, bare * 0.92);
        // Shade under the trees, painted on once. Much cheaper than real tree shadows every frame.
        const under = near(x, z);
        if (under) tmpC.lerp(UNDER, Math.min(0.42, under * 0.14));
        const rock = smooth(0.62, 0.95, steep + (n - 0.5) * 0.3);
        if (rock > 0) tmpC.lerp(rock > 0.5 && n > 0.6 ? DARKROCK : ROCK, rock * 0.92).multiplyScalar(1 - rock * 0.25 * n);
        // Wind-blown streaks across the open snow.
        const streak = ter.noise(x * 0.12 + z * 0.05, z * 0.9);
        if (!rock && streak > 0.72) tmpC.lerp(WIND, (streak - 0.72) * 1.4);
        // Frozen lakes: blue ice with a white rim.
        for (const l of ter.lakes) {
          const d = Math.hypot(x - l.x, z - l.z);
          if (d < l.r) tmpC.copy(ICE).lerp(SNOW, smooth(l.r - 0.7, l.r, d) * 0.7 + (n - 0.5) * 0.15);
        }
      }
      for (let v = 0; v < 9; v += 3) { col[t + v] = tmpC.r; col[t + v + 1] = tmpC.g; col[t + v + 2] = tmpC.b; }
    }
    land.geometry.attributes.color.needsUpdate = true;
  }

  // Two kinds of tree: bushy spruces and slim pines with a bare trunk. Each kind is one
  // instanced mesh; which tree is which kind is fixed by its number.
  let pines = null, slots = null;
  const isPine = (i) => ((i * 2654435761) >>> 0) % 100 < 28;
  function buildTrees() {
    // Blocky trees: a spruce of stacked square layers with snow on each, and a leafy tree of cubes.
    const cube = (w, h, y, c, x = 0, z = 0) => [new THREE.BoxGeometry(w, h, w), c, at(x, y, z)];
    const spruce = merge([
      cube(0.18, 0.5, 0.25, 0x6b4a2f),
      cube(1.0, 0.26, 0.6, 0x2f6b3a), cube(0.9, 0.05, 0.75, 0xf4f8ff),
      cube(0.78, 0.26, 0.88, 0x37784a), cube(0.68, 0.05, 1.03, 0xf4f8ff),
      cube(0.56, 0.26, 1.16, 0x2f6b3a), cube(0.46, 0.05, 1.31, 0xf4f8ff),
      cube(0.34, 0.26, 1.44, 0x37784a), cube(0.2, 0.22, 1.68, 0xf4f8ff),
    ]);
    const pine = merge([
      cube(0.16, 1.0, 0.5, 0x7a5232),
      cube(0.86, 0.6, 1.2, 0x3a8a44), cube(0.56, 0.36, 1.66, 0x46a052), cube(0.5, 0.06, 1.87, 0xf4f8ff), cube(0.7, 0.05, 1.53, 0xf4f8ff, 0.08, 0.08),
    ]);
    const all = ter.trees.length + ter.outer.length;
    slots = new Int32Array(all);
    let a = 0, b = 0;
    for (let i = 0; i < all; i++) slots[i] = isPine(i) ? b++ : a++;
    trees = new THREE.InstancedMesh(spruce, pixMat({ vertexColors: true }, 16, 0.35), Math.max(1, a));
    pines = new THREE.InstancedMesh(pine, trees.material, Math.max(1, b));
    for (const m of [trees, pines]) { m.castShadow = treeShadows; m.receiveShadow = false; m.frustumCulled = false; world.add(m); }
    updateTrees();
  }

  function placeTree(i, t, s) {
    tmpQ.setFromAxisAngle(tmpV.set(0, 1, 0), (i % 4) * Math.PI / 2); // blocks stay square to the world
    tmpM.compose(tmpV.set(t.x, t.y - 0.05, t.z), tmpQ, tmpS.set(s, s * (0.85 + (i % 7) * 0.05), s));
    (isPine(i) ? pines : trees).setMatrixAt(slots[i], tmpM);
  }
  function updateTrees() {
    if (!trees) return;
    for (let i = 0; i < ter.trees.length; i++) placeTree(i, ter.trees[i], ter.alive[i] ? ter.trees[i].s : 0);
    if (!trees.outerDone) {
      trees.outerDone = true;
      for (let i = 0; i < ter.outer.length; i++) placeTree(ter.trees.length + i, ter.outer[i], ter.outer[i].s);
    }
    trees.instanceMatrix.needsUpdate = true; pines.instanceMatrix.needsUpdate = true;
  }

  function setTerrain(t, depthAt) {
    world.clear();
    ter = t; snowFn = depthAt;
    buildLand(); paintLand(); buildTrees();
    sun.target.position.set(ter.N / 2, 6, ter.N / 2);
  }

  // ---------- weather and time of day ----------
  const cur = { top: new THREE.Color(0x3f86d8), mid: new THREE.Color(0xbfdcf2), fog: new THREE.Color(0xcfe3f3), sun: 2.3, amb: 0.95, far: 520, snow: 0 };
  const DUSK_TOP = new THREE.Color(0x35508a), DUSK_MID = new THREE.Color(0xffd9b8), DUSK_FOG = new THREE.Color(0xf6e2d2);
  let weather = 'sun';
  function setWeather(w) { weather = w; }

  function update(dt, clock, target) {
    const s = SKY[weather] || SKY.sun, k = Math.min(1, dt * 1.5);
    // The sun travels from the east in the morning to the west in the evening.
    const day = clamp((clock - 450) / (1050 - 450), 0, 1);
    const ang = (day - 0.5) * 2.2, low = Math.abs(day - 0.5) * 2;
    const warm = smooth(0.55, 1, low);
    cur.top.lerp(tmpC.set(s.top).lerp(DUSK_TOP, warm * 0.5), k);
    cur.mid.lerp(tmpC.set(s.mid).lerp(DUSK_MID, warm * 0.4), k);
    cur.fog.lerp(tmpC.set(s.fog).lerp(DUSK_FOG, warm * 0.18), k);
    cur.sun += (s.sun * (1 - warm * 0.35) - cur.sun) * k;
    cur.amb += (s.amb - cur.amb) * k;
    cur.far += (s.far - cur.far) * k;
    cur.snow += ((weather === 'snow' ? 0.6 : weather === 'storm' ? 1 : 0) - cur.snow) * k;
    skyU.top.value.copy(cur.top); skyU.mid.value.copy(cur.mid);
    scene.fog.color.copy(cur.fog); scene.fog.far = cur.far; scene.fog.near = cur.far * 0.35;
    renderer.setClearColor(cur.fog);
    hemi.intensity = cur.amb;
    sun.intensity = cur.sun;
    sun.color.setRGB(1, 0.95 - warm * 0.2, 0.86 - warm * 0.42);
    const c = ter ? ter.N / 2 : 48;
    sun.position.set(c + Math.sin(ang) * 150, 95 - low * 35, c + 70 + Math.cos(ang) * 60);
    snowU.time.value += dt;
    snowU.amount.value = cur.snow;
    snowU.size.value = opts.touch ? 1.6 : 1.2;
    snowU.wind.value = weather === 'storm' ? 4 : 1;
    if (target) snowU.centre.value.copy(target);
    sky.position.copy(camera.position);
  }

  // Matches the 3D picture to the canvas's real size on screen. Cheap when nothing changed,
  // so it can be called often: phones change the visible height when their browser bar slides.
  let lastW = 0, lastH = 0;
  function resize(force = false) {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (!force && w === lastW && h === lastH) return false;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Narrow screens get a wider lens so the mountain still fits.
    camera.fov = w < h ? 56 : 42;
    camera.updateProjectionMatrix();
    return true;
  }

  return {
    THREE, renderer, scene, camera, world, sun,
    setTerrain, updateTrees, setWeather, update, resize,
    repaint: () => land && paintLand(),
    setOverlay: (o) => { overlay = o; if (land) paintLand(); },
    setShadows: (on) => { renderer.shadowMap.enabled = on; sun.castShadow = on; renderer.shadowMap.needsUpdate = true; if (land) land.material.needsUpdate = true; },
    // Tree shadows are the most expensive part of the shadow map.
    setTreeShadows: () => {},
    // Render at a share of the screen's resolution.
    setScale: (f) => { if (f !== scale) { scale = f; renderer.setPixelRatio(baseRatio * f); resize(true); } },
    render: () => { if ((frameNo++ & 1) === 0) renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera); },
  };
}
