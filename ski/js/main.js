// Fresh Line: boot, game loop, camera, scoring and screens.
import * as THREE from '../../game/vendor/three.module.min.js';
import { buildTerrain, height, WORLD, dropIns, LANE } from './terrain.js';
import { Skier } from './skier.js';
import { Input, isTouch } from './input.js';
import { initAudio, setMix, sfx } from './audio.js';
import { Spray } from './spray.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 2 : 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const HORIZON = new THREE.Color(0xd9e6f3);
scene.fog = new THREE.Fog(HORIZON, 120, 780);
const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 2600);

// Sky dome
const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 24, 12), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x3d7fd6) }, mid: { value: HORIZON } },
  vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 mid; varying vec3 vp; void main(){ float h = clamp(vp.y*2.2+0.05,0.,1.); gl_FragColor = vec4(mix(mid, top, pow(h,0.7)),1.); }',
}));
scene.add(sky);
scene.add(new THREE.HemisphereLight(0xcfe2ff, 0x5d7394, 0.85));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(-40, 60, 70);
scene.add(sun, sun.target);

const world = buildTerrain(scene);
const skier = new Skier(scene);
const spray = new Spray(scene);

let mode = 'menu';
let dropIn = 'summit';
const store = {
  get(k, d) { try { const v = localStorage.getItem('freshline.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('freshline.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
let best = store.get('best', 0);

const run = { score: 0, combo: [], comboPts: 0, comboT: 0, bestTrick: null, tricks: 0 };

const input = new Input({
  onPause: () => { if (mode === 'play') pause(); else if (mode === 'pause') resume(); },
  onReset: () => { if (mode === 'play') startRun(dropIn, true); },
});

// ---------- HUD ----------

const hud = {
  score: $('score'), best: $('best'), speed: $('speed'), combo: $('combo'), comboPts: $('comboPts'),
  live: $('live'), pop: $('pop'), popName: $('popName'), popPts: $('popPts'), popTag: $('popTag'),
};
let popTimer = 0;
function showPop(name, pts, tag, kind = '') {
  hud.popName.textContent = name;
  hud.popPts.textContent = pts ? '+' + pts.toLocaleString() : '';
  hud.popTag.textContent = tag || '';
  hud.pop.className = 'show ' + kind;
  void hud.pop.offsetWidth;
  popTimer = 1.8;
}
function updateHud(dt) {
  hud.score.textContent = run.score.toLocaleString();
  hud.best.textContent = 'BEST ' + Math.max(best, run.score).toLocaleString();
  hud.speed.textContent = Math.round(skier.speed * 3.6);
  if (run.combo.length) {
    hud.combo.textContent = run.combo.join('  ·  ');
    hud.comboPts.textContent = run.comboPts.toLocaleString() + (run.combo.length > 1 ? '  ×' + run.combo.length : '');
    hud.combo.parentElement.classList.add('on');
  } else hud.combo.parentElement.classList.remove('on');
  // Live read-out of the trick in progress
  let live = '';
  if (skier.state === 'air' && skier.air.t > 0.25) {
    const deg = Math.round(skier.air.total * 180 / Math.PI / 10) * 10;
    live = (deg >= 90 ? deg + '°' : '') + (skier.air.grab ? '  ' + skier.air.grab.name.toUpperCase() : '');
  } else if (skier.state === 'grind') live = skier.grind.name.toUpperCase();
  hud.live.textContent = live;
  if (popTimer > 0 && (popTimer -= dt) <= 0) hud.pop.className = '';
}

// ---------- scoring ----------

function addToCombo(name, pts) {
  run.combo.push(name);
  run.comboPts += pts;
  run.comboT = 2.6;
  run.tricks++;
  if (!run.bestTrick || pts > run.bestTrick.pts) run.bestTrick = { name, pts };
}

function bankCombo() {
  if (!run.combo.length) return;
  const total = run.comboPts * run.combo.length;
  run.score += total;
  if (run.combo.length > 1) showPop(run.combo.length + 'x COMBO', total, '', 'bank');
  sfx.bank();
  run.combo = []; run.comboPts = 0;
}

function handleEvents() {
  for (const e of skier.events) {
    if (e.type === 'takeoff' && e.popped) sfx.pop();
    if (e.type === 'grind') {
      sfx.grind();
      if (e.airTrick && e.airTrick.name) addToCombo(e.airTrick.name, e.airTrick.points);
      run.comboT = 99;
    }
    if (e.type === 'grindEnd') {
      const pts = Math.round((200 + e.time * 300) / 10) * 10;
      if (e.time > 0.25) {
        addToCombo(e.name, pts);
        showPop(e.name, pts, '');
      }
    }
    if (e.type === 'land') {
      if (e.airtime > 0.2) sfx.land(e.impact);
      shake = Math.min(0.5, e.impact * 0.03);
      const t = e.trick;
      if (t.name && (t.points > 120 || t.name !== 'Air')) {
        let pts = t.points;
        let tag = '';
        if (e.clean) { pts = Math.round(pts * 1.25 / 10) * 10; tag = 'PERFECT'; }
        else if (e.sketchy) { pts = Math.round(pts * 0.7 / 10) * 10; tag = 'SKETCHY'; }
        addToCombo(t.name, pts);
        showPop(t.name, pts, tag, e.clean ? 'perfect' : '');
        sfx.trick(Math.min(3, Math.floor(pts / 700)));
      }
      run.comboT = 2.6;
    }
    if (e.type === 'crash') {
      sfx.crash();
      shake = 0.6;
      const lost = run.combo.length;
      run.combo = []; run.comboPts = 0;
      showPop(e.reason.toUpperCase(), 0, lost ? 'COMBO LOST' : '', 'crash');
    }
  }
  skier.events.length = 0;
}

// ---------- camera ----------

const camDir = new THREE.Vector3(0, 0, 1);
const camPos = new THREE.Vector3();
const look = new THREE.Vector3();
let shake = 0;
function updateCamera(dt, snap = false) {
  const vh = new THREE.Vector3(skier.v.x, 0, skier.v.z);
  if (skier.state !== 'crash' && vh.lengthSq() > 1) camDir.lerp(vh.normalize(), snap ? 1 : 1 - Math.exp(-(skier.state === 'air' ? 1.5 : 3.5) * dt)).normalize();
  if (snap) camDir.set(Math.sin(skier.heading), 0, Math.cos(skier.heading));
  const sp = Math.min(1, skier.speed / 30);
  const dist = 4.6 + sp * 1.4, up = 2.0 + sp * 0.3;
  const want = new THREE.Vector3().copy(skier.p).addScaledVector(camDir, -dist);
  want.y = Math.max(skier.p.y + up, height(want.x, want.z) + 1.2);
  if (skier.state === 'air') want.y = Math.max(want.y, skier.p.y + 1.2);
  if (snap) camPos.copy(want);
  camPos.x += (want.x - camPos.x) * (1 - Math.exp(-10 * dt));
  camPos.z += (want.z - camPos.z) * (1 - Math.exp(-10 * dt));
  camPos.y += (want.y - camPos.y) * (1 - Math.exp(-(skier.state === 'air' ? 4 : 9) * dt));
  if (snap) camPos.copy(want);
  camera.position.copy(camPos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.3;
    camera.position.y += (Math.random() - 0.5) * shake * 0.3;
    shake = Math.max(0, shake - dt * 1.5);
  }
  look.copy(skier.p).addScaledVector(camDir, 4).add(new THREE.Vector3(0, 0.9, 0));
  camera.lookAt(look);
  camera.fov += ((innerWidth < innerHeight ? 80 : 66) + sp * 8 - camera.fov) * (1 - Math.exp(-3 * dt));
  camera.updateProjectionMatrix();
  sun.position.copy(skier.p).add(new THREE.Vector3(-40, 60, 70));
  sun.target.position.copy(skier.p);
  sky.position.copy(camera.position);
}

// ---------- screens ----------

const screens = ['menu', 'pauseScreen', 'finish'];
function show(id) {
  for (const s of screens) $(s).hidden = s !== id;
  $('hud').hidden = !(mode === 'play');
  document.body.classList.toggle('playing', mode === 'play');
}

function startRun(where, quick = false) {
  dropIn = where;
  const d = dropIns[where];
  skier.spawn(d.x, d.z, 0, d.speed);
  Object.assign(run, { score: 0, combo: [], comboPts: 0, comboT: 0, bestTrick: null, tricks: 0 });
  input.clear();
  mode = 'play';
  show(null);
  updateCamera(1 / 60, true);
  if (quick) showPop('DROP IN', 0, d.label.toUpperCase());
}

function pause() {
  mode = 'pause';
  input.clear();
  show('pauseScreen');
}
function resume() { mode = 'play'; show(null); }

function finishRun() {
  bankCombo();
  mode = 'finish';
  const isBest = run.score > best;
  if (isBest) { best = run.score; store.set('best', best); }
  $('finScore').textContent = run.score.toLocaleString();
  $('finBest').textContent = isBest ? 'NEW BEST!' : 'Best ' + best.toLocaleString();
  $('finTricks').textContent = run.tricks;
  $('finTop').textContent = run.bestTrick ? `${run.bestTrick.name} (${run.bestTrick.pts.toLocaleString()})` : '—';
  show('finish');
}

for (const b of document.querySelectorAll('[data-drop]')) {
  b.addEventListener('click', () => { initAudio(); startRun(b.dataset.drop); });
}
$('resumeBtn').addEventListener('click', resume);
$('restartBtn').addEventListener('click', () => startRun(dropIn));
$('menuBtn').addEventListener('click', () => { mode = 'menu'; show('menu'); });
$('againBtn').addEventListener('click', () => { initAudio(); startRun(dropIn); });
$('finMenuBtn').addEventListener('click', () => { mode = 'menu'; show('menu'); });
$('menuBest').textContent = best ? 'Best run ' + best.toLocaleString() : '';
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') pause(); });

// Menu backdrop: a slow orbit of the park while nobody is riding.
skier.spawn(0, dropIns.summit.z, 0);
let menuT = 0;
function menuCamera(dt) {
  menuT += dt * 0.05;
  const z = 300 + Math.sin(menuT) * 120;
  camera.position.set(Math.sin(menuT * 1.3) * 30 + 20, height(20, z) + 14, z - 30);
  camera.lookAt(0, height(0, z + 40), z + 40);
  camera.fov = innerWidth < innerHeight ? 80 : 60;
  camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
}

// ---------- loop ----------

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const STEP = 1 / 120;
let acc = 0, last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.update(dt);
  if (mode === 'play') {
    input.read();
    acc += dt;
    while (acc >= STEP) {
      skier.step(STEP, input);
      input.consume();
      acc -= STEP;
    }
    handleEvents();
    if (run.combo.length && skier.state === 'ground' && (run.comboT -= dt) <= 0) bankCombo();
    skier.render(dt);
    spray.emitFrom(skier, dt);
    updateCamera(dt);
    updateHud(dt);
    setMix(skier.speed, skier.scrub, skier.state === 'ground' || skier.state === 'crash', false);
    if (skier.p.z > WORLD.finishZ) finishRun();
    if (Math.abs(skier.p.x) > WORLD.half - 8) skier.p.x = Math.sign(skier.p.x) * (WORLD.half - 8);
  } else {
    setMix(0, 0, false, true);
    if (mode === 'menu') menuCamera(dt);
    skier.render(dt);
  }
  spray.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
show('menu');
requestAnimationFrame(frame);

window.__ski = { skier, run, input, startRun, LANE };

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
