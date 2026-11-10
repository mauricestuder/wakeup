// Fresh Line: boot, game loop, camera, scoring and screens.
import * as THREE from '../../game/vendor/three.module.min.js';
import { buildTerrain, height, WORLD, dropIns, LANE, JUMP, jumpU, onJumpHill, loadMap, currentMap } from './terrain.js';
import { MAPS, mapById } from './maps.js';
import { Skier, showName } from './skier.js';
import { Input, isTouch, keyHintsChanged } from './input.js';
import { initAudio, setMix, sfx, setVolume } from './audio.js';
import { initLobby, profile, saveProfile, flakesFor } from './lobby.js';
import { Trail } from './trail.js';
import { Spray } from './spray.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 2 : 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const HORIZON = new THREE.Color(0xd9e6f3);
scene.fog = new THREE.Fog(HORIZON, 260, 1500);
const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 4200);

// Sky dome: deep blue overhead, a warm glow around the sun, drifting clouds.
const SUN_DIR = new THREE.Vector3(-40, 60, 70).normalize();
const sky = new THREE.Mesh(new THREE.SphereGeometry(3800, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x2763c4) }, mid: { value: HORIZON }, sunDir: { value: SUN_DIR }, time: { value: 0 },
    sunCol: { value: new THREE.Color(1, 0.72, 0.42) }, clouds: { value: 0.52 }, cloudTint: { value: new THREE.Color(1, 1, 1) }, stars: { value: 0 } },
  vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 sunDir; uniform float time; uniform vec3 sunCol; uniform float clouds; uniform vec3 cloudTint; uniform float stars; varying vec3 vp;
    float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float ns(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(hs(i), hs(i + vec2(1, 0)), f.x), mix(hs(i + vec2(0, 1)), hs(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * ns(p); p *= 2.03; a *= .5; } return s; }
    void main(){
      vec3 d = normalize(vp);
      float h = clamp(d.y * 2.2 + 0.05, 0., 1.);
      vec3 col = mix(mid, top, pow(h, .7));
      float sd = max(dot(d, sunDir), 0.);
      col += sunCol * pow(sd, 6.) * .32 + mix(sunCol, vec3(1.), .5) * pow(sd, 90.) * .7;
      col = mix(col, mix(sunCol, vec3(1.), .7), smoothstep(.9972, .9988, sd));
      vec2 sg = floor(vec2(atan(d.z, d.x) * 260., d.y * 420.));
      col += vec3(step(.9975, hs(sg)) * stars * smoothstep(.04, .3, d.y));
      if (d.y > 0.0) {
        vec2 uv = d.xz / (d.y + .12) * 1.4 + vec2(time * .012, time * .005);
        float c = fbm(uv);
        float cov = smoothstep(1.04 - clouds, 1.32 - clouds, c) * smoothstep(.0, .18, d.y);
        vec3 cc = mix(vec3(.96, .97, 1.), vec3(1., .86, .7), pow(sd, 3.)) * (.82 + .18 * fbm(uv * 2.3 + 3.)) * cloudTint;
        col = mix(col, cc, cov * .9);
      }
      gl_FragColor = vec4(col, 1.);
    }`,
}));
sky.renderOrder = -1;
scene.add(sky);

// Light snow drifting around the camera.
const snowfall = (() => {
  const N = 2400, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos.set([Math.random() * 80, Math.random() * 40, Math.random() * 80], i * 3); seed[i] = Math.random() * 6.3; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() } },
    vertexShader: `uniform float time; uniform vec3 cam; attribute float seed;
      void main(){ vec3 b = vec3(80., 40., 80.);
        vec3 p = position + vec3(sin(time * .7 + seed) * 1.5 + time * 1.2, -time * 2.2, time * .6);
        p = mod(p - cam + b * .5, b) + cam - b * .5;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_PointSize = clamp(80. / -mv.z, 1., 5.); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'void main(){ vec2 c = gl_PointCoord - .5; if (dot(c, c) > .25) discard; gl_FragColor = vec4(1., 1., 1., .75); }',
  }));
  m.frustumCulled = false;
  scene.add(m);
  return m;
})();
const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x4f6a96, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.1);
const SUN_OFF = new THREE.Vector3(-40, 60, 70);
sun.position.copy(SUN_OFF);
scene.add(sun, sun.target);

// ---------- maps ----------

// Sky, light and weather for a map (the ground is built by terrain.js).
let snowAmount = 0.3, snowOn = true;
function mapLook(m) {
  const u = sky.material.uniforms, c = (h) => new THREE.Color(h);
  u.top.value.set(m.sky.top); u.mid.value.set(m.sky.horizon);
  u.sunCol.value.set(m.sky.sun).lerp(c(0xffb878), 0.35);
  u.clouds.value = m.sky.clouds; u.stars.value = m.sky.stars;
  u.cloudTint.value.setRGB(...(m.cloudTint || [1, 1, 1]));
  SUN_OFF.set(...m.sun).normalize().multiplyScalar(Math.hypot(40, 60, 70));
  SUN_DIR.copy(SUN_OFF).normalize();
  scene.fog.color.set(m.sky.horizon); scene.fog.near = m.fog[0]; scene.fog.far = m.fog[1];
  sun.color.set(m.sky.sun); sun.intensity = m.light.sun;
  hemi.color.set(m.light.sky); hemi.groundColor.set(m.light.ground); hemi.intensity = m.light.hemi;
  renderer.toneMappingExposure = m.light.exposure;
  snowAmount = m.snow;
  snowfall.geometry.setDrawRange(0, Math.round(2400 * Math.max(m.snow, 0.29)));
  snowfall.visible = snowOn && m.snow > 0;
}
// ?map=<id> in the address always uses that map (for testing).
const fixedMap = new URLSearchParams(location.search).get('map');
function nextMap() {
  if (fixedMap) return mapById(fixedMap);
  const others = MAPS.filter((m) => m !== currentMap());
  return others[Math.floor(Math.random() * others.length)];
}
const firstMap = fixedMap ? mapById(fixedMap) : MAPS[Math.floor(Math.random() * MAPS.length)];
if (firstMap !== currentMap()) loadMap(firstMap);
let world = buildTerrain(scene);
mapLook(firstMap);
function setMap(m) {
  loadMap(m);
  world.dispose();
  world = buildTerrain(scene);
  mapLook(m);
  if (mode === 'menu') skier.spawn(LOBBY.x, LOBBY.z, 0);
  lobby.refresh();
}
const skier = new Skier(scene);
const spray = new Spray(scene);
const trail = new Trail(scene);

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
  score: $('score'), scoreBox: $('scoreBox'), best: $('best'), speed: $('speed'), speedMult: $('speedMult'), jumpHud: $('jumpHud'), jumpLabel: $('jumpLabel'), jumpMark: $('jumpMark'), combo: $('combo'), comboPts: $('comboPts'),
  live: $('live'), pop: $('pop'), popName: $('popName'), popPts: $('popPts'), popTag: $('popTag'),
};
let popTimer = 0;
function showPop(name, pts, tag, kind = '') {
  hud.popName.textContent = name;
  // Long trick names get smaller so they fit on one or two lines.
  hud.popName.style.fontSize = `calc(var(--nameSize) * ${Math.max(0.55, Math.min(1, 13 / name.length)).toFixed(2)})`;
  hud.popPts.textContent = pts ? '+' + pts.toLocaleString() : '';
  hud.popTag.textContent = tag || '';
  hud.pop.className = 'show ' + kind;
  void hud.pop.offsetWidth;
  popTimer = 1.8;
}
let shownScore = 0;
function updateHud(dt) {
  // The score counts up rather than jumping.
  if (shownScore !== run.score) {
    shownScore += (run.score - shownScore) * (1 - Math.exp(-7 * dt));
    if (Math.abs(run.score - shownScore) < 5) shownScore = run.score;
  }
  const txt = Math.round(shownScore).toLocaleString();
  if (hud.score.textContent !== txt) {
    hud.score.textContent = txt;
    // Long numbers get smaller so a big score doesn't take over the screen.
    hud.score.style.fontSize = `calc(var(--scoreSize) * ${Math.max(0.5, Math.min(1, 5 / txt.length)).toFixed(2)})`;
  }
  hud.best.textContent = 'BEST ' + Math.max(best, run.score).toLocaleString();
  hud.speed.textContent = Math.round(skier.speed * 3.6);
  const m = speedMult();
  hud.speedMult.textContent = m > 1 ? '×' + m.toFixed(1) : '';
  if (run.combo.length) {
    hud.combo.textContent = run.combo.join('  ·  ');
    hud.comboPts.textContent = run.comboPts.toLocaleString() + (run.combo.length > 1 ? '  ×' + comboMult() : '');
    hud.combo.parentElement.classList.add('on');
  } else hud.combo.parentElement.classList.remove('on');
  // Live read-out of the trick in progress
  let live = '';
  if (skier.state === 'air' && skier.air.t > 0.25) {
    const deg = Math.round(skier.air.total * 180 / Math.PI / 10) * 10;
    live = (deg >= 90 ? deg + '°' : '') + (skier.air.grab ? '  ' + showName(skier.air.grab.name).toUpperCase() : '');
  } else if (skier.state === 'grind') live = skier.grind.name.toUpperCase();
  hud.live.textContent = live;
  updateJumpHud();
  if (popTimer > 0 && (popTimer -= dt) <= 0) hud.pop.className = '';
}

// ---------- scoring ----------

// Going faster pays: ×1 up to 40 km/h, then +0.1 for every 6 km/h, up to ×2.5.
function speedMult() {
  const kmh = skier.speed * 3.6;
  return Math.min(2.5, Math.max(1, Math.round((1 + (kmh - 40) / 60) * 10) / 10));
}
const withSpeed = (pts, m) => Math.round(pts * m / 10) * 10;
// Hang time pays too: ×1 up to 1 s in the air, +0.5 per extra second, up to ×2.5.
const airMult = (t) => Math.min(2.5, Math.max(1, Math.round((1 + (t - 1) * 0.5) * 10) / 10));
const airTag = (m) => (m > 1 ? 'AIR ×' + m.toFixed(1) : '');
// Combos multiply by the number of tricks, up to ×10.
const COMBO_MAX = 10;
const comboMult = () => Math.min(COMBO_MAX, run.combo.length);
const speedTag = (m) => (m > 1 ? 'SPEED ×' + m.toFixed(1) : '');
const tags = (...t) => t.filter(Boolean).join('  ·  ');

function addToCombo(name, pts) {
  run.combo.push(name);
  run.comboPts += pts;
  run.comboT = 2.6;
  run.tricks++;
  if (!run.bestTrick || pts > run.bestTrick.pts) run.bestTrick = { name, pts };
}

function bankCombo() {
  if (!run.combo.length) return;
  const total = run.comboPts * comboMult();
  run.score += total;
  hud.scoreBox.classList.remove('bump');
  void hud.scoreBox.offsetWidth;
  hud.scoreBox.classList.add('bump');
  if (run.combo.length > 1) showPop(comboMult() + 'x COMBO', total, run.combo.length > COMBO_MAX ? 'MAX COMBO · ' + run.combo.length + ' TRICKS' : '', 'bank');
  sfx.bank();
  run.combo = []; run.comboPts = 0;
}

// Ski jump: distance points like real jumping (60 at the K point, 1.8 per
// metre either side) plus up to 60 style points for takeoff, flight and
// telemark, all ×10 to match the other scores.
const grade = (q) => (q > 0.9 ? 'PERFECT' : q > 0.65 ? 'GOOD' : q > 0.3 ? 'OK' : 'POOR');
function scoreJump(e) {
  if (!e.dist) { showPop('NO DISTANCE', 0, 'Land past the takeoff edge', 'crash'); return; }
  const distPts = Math.max(0, 60 + (e.dist - JUMP.K) * 1.8);
  const style = 20 * e.takeoff + 20 * e.flight + 20 * (e.tele ? e.tele.q : 0);
  const pts = Math.round((distPts + style) * 10 / 10) * 10;
  run.score += pts;
  run.tricks++;
  const name = e.dist.toFixed(1) + ' m';
  if (!run.bestTrick || pts > run.bestTrick.pts) run.bestTrick = { name: 'Ski jump ' + name, pts };
  hud.scoreBox.classList.remove('bump');
  void hud.scoreBox.offsetWidth;
  hud.scoreBox.classList.add('bump');
  const tags = [e.dist >= JUMP.HS ? 'HILL RECORD ZONE' : e.dist >= JUMP.K ? 'PAST K' : '',
    'TAKEOFF ' + grade(e.takeoff), 'FLIGHT ' + grade(e.flight), e.tele ? 'TELEMARK ' + e.tele.grade : 'NO TELEMARK'];
  showPop(name, pts, tags.filter(Boolean).join('  ·  '), e.dist >= JUMP.K ? 'perfect' : '');
  popTimer = 4;
  sfx.bank();
}

// The meters for the ski jump's three skill shots.
function updateJumpHud() {
  const el = hud.jumpHud;
  let show = false;
  const a = skier.air, J = a && a.jump;
  if (skier.state === 'ground' && onJumpHill(skier.p.x, skier.p.z, 2) && jumpU(skier.p.z) < JUMP.edge) {
    const d = JUMP.edge - jumpU(skier.p.z);
    if (d < 45) {
      show = true;
      el.dataset.mode = 'takeoff';
      hud.jumpLabel.textContent = input.jump ? 'RELEASE IN THE GREEN!' : 'HOLD JUMP · RELEASE AT THE EDGE';
      hud.jumpMark.style.left = (100 - Math.min(45, d) / 45 * 100) + '%';
    }
  } else if (J) {
    show = true;
    if (J.tele) { el.dataset.mode = 'done'; hud.jumpLabel.textContent = 'TELEMARK ' + J.tele.grade; }
    else if (J.h !== undefined && J.h < 6 && skier.v.y < 0 && J.t > 0.4) {
      el.dataset.mode = 'tele';
      hud.jumpLabel.textContent = 'TELEMARK! PRESS JUMP';
      hud.jumpMark.style.left = (100 - Math.min(6, J.h) / 6 * 100) + '%';
    } else {
      el.dataset.mode = 'balance';
      hud.jumpLabel.textContent = 'BALANCE · STEER TO STAY CENTRED';
      hud.jumpMark.style.left = (50 + (J.bal || 0) * 50) + '%';
    }
  }
  el.hidden = !show;
}

function handleEvents() {
  for (const e of skier.events) {
    if (e.type === 'takeoff' && e.popped) sfx.pop();
    if (e.type === 'grab') sfx.grab();
    if (e.type === 'butter') {
      const m = speedMult();
      const pts = withSpeed(150, m);
      addToCombo(e.name, pts);
      showPop(e.name, pts, speedTag(m));
      sfx.grab();
    }
    if (e.type === 'jumpLand') scoreJump(e);
    if (e.type === 'pressEnd' && e.time > 0.4) {
      const m = speedMult();
      const pts = withSpeed(100 + Math.min(e.time, 3) * 250, m);
      addToCombo(e.name, pts);
      showPop(e.name, pts, speedTag(m));
    }
    if (e.type === 'grind') {
      sfx.grind();
      if (e.airTrick && e.airTrick.name) addToCombo(e.airTrick.name, withSpeed(e.airTrick.points, speedMult()));
      run.comboT = 99;
    }
    if (e.type === 'grindEnd') {
      const m = speedMult();
      const pts = withSpeed(200 + e.time * 300, m);
      if (e.time > 0.25) {
        addToCombo(e.name, pts);
        showPop(e.name, pts, speedTag(m));
      }
    }
    if (e.type === 'land') {
      if (e.airtime > 0.2) sfx.land(e.impact);
      shake = Math.min(0.5, e.impact * 0.03);
      const t = e.trick;
      if (!e.jump && t.name && (t.points > 120 || t.name !== 'Air')) {
        const m = speedMult();
        let pts = t.points;
        let tag = '';
        if (e.clean) { pts *= 1.25; tag = 'PERFECT'; }
        else if (e.sketchy) { pts *= 0.7; tag = 'SKETCHY'; }
        const am = airMult(e.airtime);
        pts = withSpeed(pts * am, m);
        addToCombo(t.name, pts);
        showPop(t.name, pts, tags(tag, airTag(am), speedTag(m)), e.clean ? 'perfect' : '');
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
  if (shake > 0 && !settings.shake) shake = 0;
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.3;
    camera.position.y += (Math.random() - 0.5) * shake * 0.3;
    shake = Math.max(0, shake - dt * 1.5);
  }
  look.copy(skier.p).addScaledVector(camDir, 4).add(new THREE.Vector3(0, 0.9, 0));
  camera.lookAt(look);
  camera.fov += ((innerWidth < innerHeight ? 80 : 66) + sp * 8 - camera.fov) * (1 - Math.exp(-3 * dt));
  camera.updateProjectionMatrix();
  sun.position.copy(skier.p).add(SUN_OFF);
  sun.target.position.copy(skier.p);
  sky.position.copy(camera.position);
}

// ---------- screens ----------

const screens = ['pauseScreen', 'pauseSettings', 'finish'];
function show(id) {
  for (const s of screens) $(s).hidden = s !== id;
  $('hud').hidden = !(mode === 'play');
  document.body.classList.toggle('playing', mode === 'play');
  if (id === 'lobby') lobby.show(); else lobby.hide();
}

// A run's points become snowflakes for the shop when the run ends.
let paid = true;
function payRun() {
  if (paid) return 0;
  paid = true;
  bankCombo();
  return lobby.award(run.score);
}

function startRun(where, quick = false) {
  if (!quick) payRun();
  dropIn = where;
  const d = dropIns[where];
  skier.spawn(d.x, d.z, 0, d.speed);
  shownScore = 0;
  Object.assign(run, { score: 0, combo: [], comboPts: 0, comboT: 0, bestTrick: null, tricks: 0 });
  paid = false;
  input.clear();
  mode = 'play';
  show(null);
  updateCamera(1 / 60, true);
  if (quick) showPop('DROP IN', 0, d.label.toUpperCase());
  else showPop(currentMap().name.toUpperCase(), 0, d.label.toUpperCase() + '  ·  ' + currentMap().desc.toUpperCase());
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
  const n = payRun();
  $('finFlakes').textContent = n ? '+' + n.toLocaleString() + ' ❄' : '';
  show('finish');
}
// Back to the lobby, on a new map so the next run is a little different.
function toLobby(newMap = true) {
  payRun();
  if (run.score > best) { best = run.score; store.set('best', best); }
  mode = 'menu';
  skier.spawn(LOBBY.x, LOBBY.z, 0);
  if (newMap && !fixedMap) setMap(nextMap());
  show('lobby');
}

// Settings from the lobby.
const settings = { shake: true };
function applySettings(s) {
  settings.shake = s.shake;
  document.body.classList.toggle('nokeys', !s.keys);
  renderer.setPixelRatio(s.quality === 'low' ? 1 : Math.min(devicePixelRatio, isTouch ? 2 : 1.5));
  resize();
  snowOn = s.snowfall;
  snowfall.visible = snowOn && snowAmount > 0;
  setVolume(s.volume);
}
keyHintsChanged((on) => { profile.settings.keys = on; saveProfile(); drawPauseSettings(); });

// Settings from the pause menu: the same settings as in the lobby.
const PS = $('pauseSettings');
function drawPauseSettings() {
  const S = profile.settings;
  for (const t of PS.querySelectorAll('[data-ps]')) {
    t.classList.toggle('on', !!S[t.dataset.ps]);
    t.querySelector('b').textContent = S[t.dataset.ps] ? 'ON' : 'OFF';
  }
  for (const b of PS.querySelectorAll('[data-pq]')) b.classList.toggle('on', b.dataset.pq === S.quality);
  $('psVol').value = Math.round(S.volume * 100);
  $('psVolV').textContent = $('psVol').value;
}
function changeSetting(fn) {
  fn(profile.settings);
  saveProfile(); applySettings(profile.settings); drawPauseSettings(); lobby.syncSettings();
}
for (const t of PS.querySelectorAll('[data-ps]')) t.addEventListener('click', () => changeSetting((S) => { S[t.dataset.ps] = !S[t.dataset.ps]; }));
for (const b of PS.querySelectorAll('[data-pq]')) b.addEventListener('click', () => changeSetting((S) => { S.quality = b.dataset.pq; }));
$('psVol').addEventListener('input', () => changeSetting((S) => { S.volume = $('psVol').value / 100; }));
$('pSetBtn').addEventListener('click', () => { drawPauseSettings(); show('pauseSettings'); });
$('psBack').addEventListener('click', () => show('pauseScreen'));

let trailPreview = 'none';
const lobby = initLobby({
  skier,
  setGear: (board) => { skier.setBoard(board); },
  play: (where) => { initAudio(); startRun(where); },
  map: () => currentMap(),
  shuffleMap: () => setMap(nextMap()),
  best: () => best,
  applySettings,
  setTrailPreview: (id) => { trailPreview = id; trail.setStyle(id); },
});

$('resumeBtn').addEventListener('click', resume);
$('restartBtn').addEventListener('click', () => startRun(dropIn));
$('menuBtn').addEventListener('click', toLobby);
$('againBtn').addEventListener('click', () => { initAudio(); startRun(dropIn); });
$('finMenuBtn').addEventListener('click', toLobby);
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') pause(); });

// Lobby: the rider stands by the start hut and turns slowly for the camera;
// drag to spin them round. An equipped trail circles them.
const LOBBY = { x: 3, z: -84 };
let lobbyT = 0, lobbyYaw = 0, dragX = null;
addEventListener('pointerdown', (e) => { if (mode === 'menu' && e.target === canvas) dragX = e.clientX; });
addEventListener('pointermove', (e) => { if (dragX !== null) { lobbyYaw += (e.clientX - dragX) * 0.012; dragX = e.clientX; } });
addEventListener('pointerup', () => { dragX = null; });
const _tp = new THREE.Vector3(), _ts = new THREE.Vector3();
function lobbyScene(dt) {
  lobbyT += dt;
  if (dragX === null) lobbyYaw += dt * 0.25;
  const gy = height(LOBBY.x, LOBBY.z);
  skier.p.set(LOBBY.x, gy, LOBBY.z);
  skier.v.set(0, 0, 0);
  skier.state = 'ground';
  skier.heading = lobbyYaw;
  skier.crouch = 0.25; skier.lean = 0; skier.skid = 0;
  // Camera in front of the rider, a little to the side so the UI has room.
  const portrait = innerWidth < innerHeight;
  const tab = lobby.tab();
  // Shift the view so the rider stands left of the panels (the camera looks
  // up the hill, so +x is screen right).
  const panel = tab === 'locker' || tab === 'shop';
  const side = panel ? (portrait ? 0 : 1.5) : 0.35;
  const far = portrait ? 7 : 5.4;
  camera.position.set(LOBBY.x + side, gy + 1.5, LOBBY.z + far);
  camera.lookAt(LOBBY.x + side, gy + 1.0, LOBBY.z);
  if (portrait && panel) { camera.position.y += 1.2; camera.lookAt(LOBBY.x, gy + 0.1, LOBBY.z); }
  camera.fov = portrait ? 60 : 42;
  camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  // Trail preview: a loop around the rider.
  const a = lobbyT * 3.2;
  _tp.set(LOBBY.x + Math.cos(a) * 0.95, gy + 0.9 + Math.sin(lobbyT * 2.1) * 0.45, LOBBY.z + Math.sin(a) * 0.95);
  _ts.set(0, 1, 0);
  trail.update(dt, _tp, _ts, trailPreview !== 'none', 0.03);
}

// ---------- loop ----------

// Size the picture to the canvas as it is really shown. iPhones and iPads
// sometimes report the old window size during a rotation or when the
// address bar moves, which stretched the picture, so this also runs every
// frame and fixes any mismatch.
var viewW = 0, viewH = 0; // var: resize() can run before this line (from the settings)
function viewSize() {
  const c = renderer.domElement;
  return [c.clientWidth || innerWidth, c.clientHeight || innerHeight];
}
function checkSize() {
  const [w, h] = viewSize();
  if (w !== viewW || h !== viewH) resize();
}
function resize() {
  const [w, h] = viewSize();
  if (!w || !h) return;
  viewW = w; viewH = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 300));
visualViewport?.addEventListener('resize', resize);
resize();

const STEP = 1 / 120;
let acc = 0, last = performance.now();
function frame(now) {
  checkSize();
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
    // Trail from the feet while flying or grinding.
    _tp.copy(skier.model.root.position).addScaledVector(_ts.set(0, 1, 0).applyQuaternion(skier.renderQ), 0.08);
    _ts.set(1, 0, 0).applyQuaternion(skier.renderQ);
    trail.update(dt, _tp, _ts, skier.state === 'air' || skier.state === 'grind');
    updateCamera(dt);
    updateHud(dt);
    setMix(skier.speed, skier.scrub, skier.state === 'ground' || skier.state === 'crash', false, skier.board);
    if (skier.p.z > (dropIns[dropIn].finish || WORLD.finishZ)) finishRun();
    if (Math.abs(skier.p.x) > WORLD.half - 8) skier.p.x = Math.sign(skier.p.x) * (WORLD.half - 8);
  } else {
    setMix(0, 0, false, true);
    if (mode === 'menu') lobbyScene(dt);
    skier.render(dt);
  }
  spray.update(dt);
  sky.material.uniforms.time.value += dt;
  snowfall.material.uniforms.time.value += dt;
  snowfall.material.uniforms.cam.value.copy(camera.position);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
lobby.wearEquipped();
toLobby(false);
requestAnimationFrame(frame);

window.__ski = { skier, run, input, startRun, LANE, camDir, setMap: (id) => setMap(mapById(id)) };

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
