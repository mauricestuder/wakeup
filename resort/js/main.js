// First Chair: boot, the game loop, saving, and wiring the rules to the 3D view and the buttons.
import { createScene, THREE } from './view/scene.js';
import { createCamera } from './view/camera.js';
import { createLiftView } from './view/lifts.js';
import { createPisteView } from './view/pistes.js';
import { createBuildingView } from './view/buildings.js';
import { createGuestView } from './view/guests.js';
import { T, LIFTS } from './tuning.js';
import { MAPS } from './maps.js';
import * as idle from './idle.js';
import { createUI } from './ui.js';
import { initAudio, setVolume, setAmbience, sfx } from './audio.js';

const isTouch = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
const store = {
  get(k, d) { try { const v = localStorage.getItem('firstchair.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('firstchair.' + k, JSON.stringify(v)); } catch { /* private mode or full */ } },
};
const settings = Object.assign({ volume: 0.7, shadows: true }, store.get('settings', {}));

const canvas = document.getElementById('game');
const stage = createScene(canvas, { touch: isTouch, treeShadows: !isTouch });
const cam = createCamera(stage.camera, canvas, { onTap: () => initAudio() });
const views = { lifts: createLiftView(stage.scene), pistes: createPisteView(stage.scene), buildings: createBuildingView(stage.scene), guests: createGuestView(stage.scene) };

let state = null, ter = null, playing = false, acc = 0, saveT = 0, popT = 0;

const ui = createUI({
  click: () => { initAudio(); sfx.click(); },
  buy,
  rush: () => { initAudio(); if (idle.startRush(state)) { sfx.goal(); ui.toast('<b>Rush hour!</b> More guests and faster lifts for 30 seconds.', 'star', 2600); } else sfx.buzz(); },
  overview: () => frameAll(false),
  settings: () => settings,
  applySettings,
  start: () => start(false),
  quit,
  reset: () => { store.set('idle', null); start(true); },
  next: () => { state = idle.nextGame(state); world(); save(); sfx.goal(); ui.toast(`Welcome to <b>${idle.mapOf(state).name}</b>. All income x${idle.short(idle.fameOf(state))}.`, 'star', 5000); },
});

function applySettings() {
  setVolume(settings.volume);
  stage.setShadows(settings.shadows);
  store.set('settings', settings);
}

// ---------- starting, saving, leaving ----------

function save() { if (playing && state) store.set('idle', idle.toSave(state)); }

// How much of the screen height the buttons at the bottom cover.
const lowPart = () => Math.min(0.42, ((ui.deckHeight || 100) + 14) / innerHeight);

function liftPoints(l) {
  const p = state.pisteById[l.id];
  return [l.a, l.b, ...p.pts.filter((_, i) => i % 4 === 0)];
}
function frameAll(snap) {
  const pts = [{ x: ter.base.x - 5, z: ter.base.z + 3 }, { x: ter.base.x + 5, z: ter.base.z + 3 }];
  for (const l of state.lifts) pts.push(...liftPoints(l));
  cam.frame(pts, snap, lowPart());
}
function frameLift(l) {
  const from = l.from === 0 ? [{ x: ter.base.x, z: ter.base.z + 2 }] : [];
  cam.frame([...liftPoints(l), ...from], false, lowPart());
}

function syncViews() { views.lifts.sync(state, ter); views.pistes.sync(state, ter); views.buildings.sync(state, ter); }

// Puts the mountain of the current game on screen.
function world() {
  ter = idle.attach(state);
  stage.setTerrain(ter, () => 45);
  cam.setTerrain(ter);
  for (const v of Object.values(views)) v.clear();
  views.buildings.buildVillage(ter);
  syncViews();
  stage.updateTrees();
  stage.setWeather(state.weather);
  ui.labels.innerHTML = ''; tags.clear();
  acc = 0;
  frameAll(true);
}

function start(fresh) {
  initAudio(); sfx.click();
  const old = fresh ? null : idle.fromSave(store.get('idle', null));
  state = old || idle.newGame(0);
  playing = true;
  world();
  ui.hideMenu();
  ui.update(state);
  save();
  if (!old) ui.toast('Welcome! Your first lift is running. Spend the money with the <b>big buttons</b>.', 'star', 6000);
}

function quit() {
  save();
  playing = false;
  ui.labels.innerHTML = ''; tags.clear();
  ui.showMenu(store.get('idle', null));
}

// ---------- buying ----------

// first = the press itself (a held button repeats without the error sound).
function buy(id, first) {
  if (!playing) return false;
  initAudio();
  if (!idle.buy(state, ter, id)) { if (first) sfx.buzz(); return false; }
  if (id === 'lift' || id === 'upgrade') sfx.build(); else sfx.cash();
  drain();
  return true;
}

function drain() {
  if (!state.events.length) return;
  let sync = false, trees = false;
  for (const e of state.events.splice(0)) {
    if (e.type === 'world') sync = true;
    else if (e.type === 'trees') trees = true;
    else if (e.type === 'weather') stage.setWeather(state.weather);
    else if (e.type === 'lift') { frameLift(e.lift); ui.toast(`<b>Lift ${e.lift.i + 1}</b> is open: ${idle.short(idle.fare(state, e.lift.i))} per ride.`, 'star'); }
    else if (e.type === 'upgraded') { frameLift(e.lift); ui.toast(`Lift ${e.lift.i + 1} is now a <b>${LIFTS[e.lift.type].name.toLowerCase()}</b>.`, 'star'); }
    else if (e.type === 'goal') { sfx.goal(); ui.toast(`<b>Goal reached:</b> ${e.goal.text} · +${idle.short(e.reward)}`, 'star', 4200); }
    else if (e.type === 'rushEnd') ui.toast('Rush hour is over.');
  }
  if (sync) syncViews();
  if (trees) stage.updateTrees();
}

// ---------- pop-ups and tags over the lifts ----------

const v3 = new THREE.Vector3();
function project(x, y, z) {
  v3.set(x, y, z).project(stage.camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + (v3.x + 1) / 2 * r.width, y: r.top + (1 - v3.y) / 2 * r.height, front: v3.z < 1 };
}

// The money each lift took since the last pop-up floats up from its station.
function pops() {
  for (const l of state.lifts) {
    if (l.pop <= 0) continue;
    const s = project(l.a.x, l.pts[0].g + 3.4, l.a.z);
    if (s.front && s.x > 0 && s.y > 60 && s.x < innerWidth && s.y < innerHeight) ui.pop(s.x, s.y, '+' + idle.short(l.pop));
    l.pop = 0;
  }
}

const tags = new Map();
function updateTags() {
  for (const l of state.lifts) {
    const n = l.queue.length;
    let el = tags.get(l.id);
    if (n < 6) { if (el) el.hidden = true; continue; }
    if (!el) { el = document.createElement('div'); tags.set(l.id, el); ui.labels.appendChild(el); }
    const s = project(l.a.x - Math.sin(l.dir) * 2.5, l.pts[0].g + 1.9, l.a.z - Math.cos(l.dir) * 2.5);
    el.hidden = !s.front;
    const text = n + ' waiting', cls = 'tag ' + (n >= 40 ? 'bad' : n >= 18 ? 'warn' : '');
    if (el.textContent !== text) el.textContent = text;
    if (el.className !== cls) el.className = cls;
    el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%)`;
  }
}

// ---------- keys ----------

addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea, button') || !playing) return;
  const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(e.code);
  if (n >= 0 && !e.repeat) buy(idle.UPGRADES[n], true);
  else if (e.code === 'Space' && !e.repeat) { e.preventDefault(); document.getElementById('rush').click(); }
  else if (e.code === 'Escape') ui.closeSheet();
});

addEventListener('resize', () => stage.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);

// ---------- the loop ----------

let lastT = performance.now();
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (t - lastT) / 1000);
  lastT = t;
  if (playing) {
    acc += dt;
    let n = 0;
    while (acc >= T.STEP && n++ < 10) { idle.tick(state, ter, T.STEP); acc -= T.STEP; }
    if (acc > T.STEP * 4) acc = 0;
    drain();
    views.lifts.update(state);
    views.guests.update(state, ter, dt, idle.speedOf(state));
    ui.update(state);
    popT += dt; if (popT >= 0.7) { popT = 0; pops(); }
    saveT += dt; if (saveT >= 10) { saveT = 0; save(); }
  } else {
    cam.rotate(dt * 0.04); // slow turn behind the start screen
    views.lifts.update(state || demo);
  }
  cam.update(dt);
  stage.update(dt, playing ? idle.clockOf(state) : 640, cam.target);
  if (playing) updateTags();
  stage.render();
  setAmbience(Math.min(1, cam.now.dist / 150), playing && state.weather === 'snow' ? 0.3 : 0, playing ? state.guests.length : 0, !playing);
}

// The start screen shows the first mountain turning slowly in the background.
let demo = null;
{
  demo = idle.newGame(0);
  demo.open = T.LIFT_COUNT;
  const dter = idle.attach(demo);
  stage.setTerrain(dter, () => 45);
  cam.setTerrain(dter);
  views.buildings.buildVillage(dter);
  views.lifts.sync(demo, dter); views.pistes.sync(demo, dter);
  stage.updateTrees();
  cam.view(48, 52, 128, 0.5, 0.62, true);
}
stage.resize();
applySettings();
ui.showMenu(store.get('idle', null));
addEventListener('pointerdown', initAudio, { once: true });
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// For testing from the console.
window.__fc = { get state() { return state; }, get ter() { return ter; }, idle, cam, ui, stage, views, project, start, save, T, MAPS };
