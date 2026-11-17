// Idle Lift: boot, the game loop, saving, and wiring the rules to the 3D view and the buttons.
import { createScene, THREE, outlineAll, setOutlines } from './view/scene.js';
import { createCamera } from './view/camera.js';
import { createLiftView } from './view/lifts.js';
import { createPisteView } from './view/pistes.js';
import { createBuildingView } from './view/buildings.js';
import { createGuestView } from './view/guests.js';
import { createExtraView } from './view/extras.js';
import { createCarView } from './view/cars.js';
import { createDecoView } from './view/deco.js';
import { createCashView, cashSpot } from './view/cash.js';
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
const settings = Object.assign({ volume: 0.7, graphics: 'auto' }, store.get('settings', {}));
if (!['auto', 'high', 'low'].includes(settings.graphics)) settings.graphics = 'auto';

const canvas = document.getElementById('game');
const stage = createScene(canvas, { touch: isTouch, treeShadows: !isTouch });
const cam = createCamera(stage.camera, canvas, { onTap: (x, y) => { initAudio(); if (!(playing && tapCash(x, y))) tapCeleb(x, y); } });
const views = { lifts: createLiftView(stage.scene), pistes: createPisteView(stage.scene), buildings: createBuildingView(stage.scene), guests: createGuestView(stage.scene), extras: createExtraView(stage.scene), cars: createCarView(stage.scene), deco: createDecoView(stage.scene), cash: createCashView(stage.scene) };

let state = null, ter = null, playing = false, saveT = 0, popT = 0, follow = 0;

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
  quests: () => ui.showQuests(),
  parkPreview: (k) => idle.parkPreview(state, k),
  setPark: (k) => { initAudio(); if (idle.setPark(state, k)) { sfx.cash(); drain(); ui.update(state, 0, true); save(); } },
  hire: (id) => { initAudio(); if (!idle.hire(state, id)) { sfx.buzz(); return false; } sfx.build(); drain(); ui.update(state, 0, true); save(); return true; },
  toggleMgr: (id) => { if (idle.toggleMgr(state, id)) { ui.update(state, 0, true); save(); } },
  eventAction: () => {
    const e = state && state.event;
    if (!e) return;
    if (e.id === 'storm') idle.eventAction(state, 'storm');
    else if (e.id === 'celeb') follow = e.guest; // the camera follows the celebrity until the event ends or the player moves it
    drain();
  },
  next: () => { state = idle.nextGame(state); world(); save(); sfx.goal(); ui.toast(`Welcome to <b>${idle.mapOf(state).name}</b>. All income x${idle.short(idle.fameOf(state))}.`, 'star', 5000); },
});

// ---------- graphics quality ----------

// Each level is lighter than the one before. Auto starts at the top and steps down when frames come slowly.
const LEVELS = [
  { scale: 1, trees: false, shadows: true, outlines: true },
  { scale: 0.8, trees: false, shadows: true, outlines: true },
  { scale: 0.8, trees: false, shadows: false, outlines: false },
  { scale: 0.62, trees: false, shadows: false, outlines: false },
];
const quality = { level: 0, time: 0, frames: 0, warm: 0, lastFps: 0, stuck: 0, done: false };
function setLevel(n) {
  quality.level = n;
  const q = LEVELS[n];
  stage.setScale(q.scale); stage.setTreeShadows(q.trees); stage.setShadows(q.shadows); setOutlines(q.outlines);
}
// Called every frame with the real frame time. Looks at 3 seconds at a time.
function watchQuality(dt) {
  if (settings.graphics !== 'auto' || quality.done || dt > 0.5) return;
  if (quality.warm < 2.5) { quality.warm += dt; return; } // loading and the first frames do not count
  quality.time += dt; quality.frames++;
  if (quality.time < 3) return;
  const fps = quality.frames / quality.time;
  quality.time = 0; quality.frames = 0;
  if (fps >= 45) { quality.lastFps = 0; quality.stuck = 0; return; }
  // If lighter graphics twice in a row changed nothing, something else limits the frame rate
  // (a 30 fps power-saving mode, for example), so stop there.
  if (quality.lastFps && fps < quality.lastFps * 1.08) quality.stuck++; else quality.stuck = 0;
  quality.lastFps = fps;
  if (quality.stuck >= 2 || quality.level >= LEVELS.length - 1) { quality.done = true; return; }
  setLevel(quality.level + 1);
  quality.warm = 1.5;
}

function applySettings() {
  setVolume(settings.volume);
  Object.assign(quality, { time: 0, frames: 0, warm: 0, lastFps: 0, stuck: 0, done: false });
  setLevel(settings.graphics === 'low' ? LEVELS.length - 1 : 0);
  store.set('settings', settings);
}

// ---------- starting, saving, leaving ----------

function save() { if (playing && state) store.set('idle', idle.toSave(state)); }

function liftPoints(l) {
  const p = state.pisteById[l.id];
  return [l.a, l.b, ...p.pts.filter((_, i) => i % 4 === 0)];
}
function frameAll(snap) {
  const pts = [{ x: ter.base.x - 5, z: ter.base.z + 3 }, { x: ter.base.x + 5, z: ter.base.z + 3 }];
  for (const l of state.lifts) pts.push(...liftPoints(l));
  cam.frame(pts, snap, ui.free);
}
function syncViews() { views.lifts.sync(state, ter); views.pistes.sync(state, ter); views.buildings.sync(state, ter); views.extras.sync(state, ter); views.cars.sync(state, ter); views.deco.sync(state, ter); }

// Puts the mountain of the current game on screen.
function world() {
  ter = idle.attach(state);
  stage.setTerrain(ter, () => 45);
  cam.setTerrain(ter);
  for (const v of Object.values(views)) v.clear();
  views.buildings.buildVillage(ter);
  syncViews();
  stage.updateTrees(); stage.repaint();
  stage.setWeather(state.weather);
  ui.clearLabels(); tags.clear(); bubbles.clear(); star = null; follow = 0;
  views.cash.clear();
  outlineAll(stage.scene);
  frameAll(true);
}

function start(fresh) {
  initAudio(); sfx.click();
  const old = fresh ? null : idle.fromSave(store.get('idle', null));
  state = old || idle.newGame(0);
  playing = true;
  world();
  ui.hideMenu();
  ui.update(state, 0, true);
  frameAll(true); // again, now that the buttons are on screen and their size is known
  save();
  // Money earned while the game was closed.
  const away = old ? idle.payAway(state) : null;
  if (away) { ui.update(state, 0, true); ui.welcomeBack(away); sfx.goal(); save(); }
  if (!old) ui.toast('Welcome! Your first lift is running. Spend the money with the <b>big buttons</b>.', 'star', 6000);
}

function quit() {
  save();
  playing = false;
  ui.clearLabels(); tags.clear(); bubbles.clear(); star = null; follow = 0;
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
  ui.update(state, 0, true);
  return true;
}

function drain() {
  if (!state.events.length) return;
  let sync = false, trees = false;
  for (const e of state.events.splice(0)) {
    if (e.type === 'world') sync = true;
    else if (e.type === 'trees') trees = true;
    else if (e.type === 'weather') stage.setWeather(state.weather);
    else if (e.type === 'lift') ui.toast(`<b>Lift ${e.lift.i + 1}</b> is open: ${idle.money(idle.fare(state, e.lift.i))} per ride.`, 'star');
    else if (e.type === 'upgraded') { ui.toast(`Lift ${e.lift.i + 1} is now a <b>${LIFTS[e.lift.type].name.toLowerCase()}</b>.`, 'star'); }
    else if (e.type === 'goal') { sfx.goal(); ui.toast(`<b>Quest done:</b> ${e.goal.text} · +${idle.money(e.reward)}`, 'star', 4200); ui.flyCoins(innerWidth * (1 - ui.free.right) / 2, innerHeight * 0.3, 8); }
    else if (e.type === 'unlock' && e.id === 'mgr') { sfx.goal(); ui.toast('<b>Managers unlocked!</b> Tap <b>Hire</b> on a board and its manager buys it for you.', 'star', 6000); ui.pulseManagers(); }
    else if (e.type === 'unlock') { sfx.goal(); ui.toast(`<b>New board unlocked:</b> ${e.name}`, 'star', 4600); }
    else if (e.type === 'trick') {
      const p = project(e.x, e.y + 2.2, e.z);
      if (p.front && p.x > 0 && p.y > 40 && p.x < innerWidth * (1 - ui.free.right) && p.y < innerHeight * (1 - ui.free.bottom)) { ui.pop(p.x, p.y, 'Trick! +' + idle.money(e.pay), true); ui.flyCoins(p.x, p.y, 3); sfx.tick(); }
    }
    else if (e.type === 'rushEnd') ui.toast('Rush hour is over.');
    else if (e.type === 'hired') ui.toast(`<b>Manager hired</b> for ${e.name}.`, 'star');
    else if (e.type === 'collect') {
      sfx.cash(); views.cash.bump(e.key);
      const p = cashScreen(e.key);
      if (p && p.front) { ui.pop(p.x, p.y - 10, '+' + idle.money(e.amt)); ui.flyCoins(p.x, p.y, Math.min(9, 3 + Math.floor(Math.log10(e.amt + 1)))); }
    }
    else if (e.type === 'smgr') ui.toast(`<b>Station manager hired</b> at ${e.key === 'till' ? 'the car park till' : 'lift ' + e.key}. Its cash now comes in by itself, and it sells ${Math.round(T.SMGR_GAIN * 100)}% more.`, 'star', 4200);
    else if (e.type === 'event') {
      const ev = e.event;
      sfx.goal();
      // The event sign under the quest explains it, so no extra message here.
      if (ev.id === 'powder') stage.setWeather('snow');
      else if (ev.id === 'storm') stage.setWeather('storm');
    }
    else if (e.type === 'eventEnd') {
      stage.setWeather(state.weather);
      if (follow === e.event.guest) follow = 0;
      if (e.how === 'time' && e.event.id === 'storm') ui.toast('The storm is over. The lifts run again.');
      else if (e.how === 'time' && e.event.id === 'celeb') ui.toast('The celebrity has left.');
      else if (e.how === 'time') ui.toast('The powder is skied out.');
    }
    else if (e.type === 'eventPay') {
      sfx.goal();
      ui.toast(e.id === 'storm' ? `<b>Lifts secured!</b> +${idle.money(e.pay)}` : `<b>Autograph!</b> The celebrity loved your resort. +${idle.money(e.pay)}`, 'star', 3600);
      ui.flyCoins(innerWidth * (1 - ui.free.right) / 2, innerHeight * 0.4, 8);
    }
  }
  if (sync) { syncViews(); outlineAll(stage.scene); }
  if (trees) { stage.updateTrees(); stage.repaint(); }
}

// ---------- pop-ups and tags over the lifts ----------

const v3 = new THREE.Vector3();
let box = canvas.getBoundingClientRect(); // asked for once and on resize, not on every call
function project(x, y, z) {
  v3.set(x, y, z).project(stage.camera);
  return { x: box.left + (v3.x + 1) / 2 * box.width, y: box.top + (1 - v3.y) / 2 * box.height, front: v3.z < 1 };
}

// The money each lift took since the last pop-up floats up from its station.
function pops() {
  for (const l of state.lifts) {
    const whole = Math.floor(l.pop);
    if (whole < 1) continue; // keep collecting until there is a whole dollar to show
    const s = project(l.a.x, l.pts[0].g + 3.4, l.a.z);
    if (s.front && s.x > 0 && s.y > 60 && s.x < innerWidth * (1 - ui.free.right) && s.y < innerHeight * (1 - ui.free.bottom)) ui.pop(s.x, s.y, '+' + idle.money(whole));
    l.pop -= whole;
  }
}

// The celebrity: a star tag over their head, and a tap near them pays the bonus.
let star = null;
function celebScreen() {
  const g = idle.celebGuest(state);
  if (!g || g.vx === undefined) return null;
  return project(g.vx, g.vy + 1.4, g.vz);
}
function updateStar() {
  const s = playing ? celebScreen() : null;
  if (!s || !s.front) { if (star) star.hidden = true; return; }
  if (!star) { star = document.createElement('div'); star.className = 'tag star'; star.textContent = '★ Celebrity'; ui.labels.appendChild(star); }
  star.hidden = false;
  star.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%)`;
}
function tapCeleb(x, y) {
  if (!playing) return;
  const s = celebScreen();
  if (!s || !s.front) return;
  // Generous: the skier is small and moving, so anywhere near them or their tag counts.
  if (Math.hypot(s.x - x, s.y + 12 - y) < (isTouch ? 60 : 45)) { idle.eventAction(state, 'celeb'); drain(); }
}
canvas.addEventListener('pointerdown', () => { follow = 0; });

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

// ---------- cash bubbles ----------
// A tappable bubble over every station with money waiting. Full boxes turn red and wobble.
const bubbles = new Map();
function cashScreen(key) {
  const s = cashSpot(state, ter, key);
  return s ? project(s.x, s.y + (key === 'till' ? 2.6 : 3.4), s.z) : null;
}
function collectAt(key) { initAudio(); if (idle.collect(state, key)) drain(); }
function updateBubbles() {
  for (const key of idle.STATIONS) {
    let el = bubbles.get(key);
    const have = Math.floor(state.box[key] || 0), man = idle.managed(state, key);
    const s = !man && have >= 1 ? cashScreen(key) : null;
    // Not under the boards or off the screen.
    if (!s || !s.front || s.y < 40 || s.x < 20 || s.x > innerWidth * (1 - ui.free.right) - 20 || s.y > innerHeight * (1 - ui.free.bottom)) { if (el) el.hidden = true; continue; }
    if (!el) {
      el = document.createElement('button');
      el.className = 'cash'; el.innerHTML = '<span class="cc"></span><b class="num"></b><i>FULL</i>';
      el.querySelector('.cc').innerHTML = document.querySelector('#sMoney .coin').innerHTML;
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); collectAt(key); });
      bubbles.set(key, el); ui.labels.appendChild(el);
    }
    el.hidden = false;
    const full = idle.boxFull(state, key), cap = idle.boxCap(state, key);
    const f = isFinite(cap) ? Math.min(1, have / cap) : Math.min(1, have / (((state.steadyParts || {})[key] || 1) * 600));
    const text = idle.money(have);
    if (el._t !== text) { el._t = text; el.querySelector('b').textContent = text; }
    el.classList.toggle('full', full);
    el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%) scale(${(0.82 + f * 0.3).toFixed(2)})`;
  }
}
// A tap on the mountain near a bubble counts as well.
function tapCash(x, y) {
  for (const key of idle.STATIONS) {
    const el = bubbles.get(key);
    if (!el || el.hidden) continue;
    const r = el.getBoundingClientRect();
    if (Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y) < (isTouch ? 56 : 40)) { collectAt(key); return true; }
  }
  return false;
}

// ---------- keys ----------

addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea, button') || !playing) return;
  const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(e.code);
  if (n >= 0 && !e.repeat) buy(idle.UPGRADES[n], true);
  else if (e.code === 'Space' && !e.repeat) { e.preventDefault(); document.getElementById('rush').click(); }
  else if (e.code === 'Escape') ui.closeSheet();
});

// Keep the 3D picture the size of the screen. Phones change the visible height when the browser
// bar slides in or out, often without a resize event, so several signals are watched, and the
// game loop checks twice a second as a safety net.
function fit() { if (stage.resize()) box = canvas.getBoundingClientRect(); }
addEventListener('resize', fit);
addEventListener('orientationchange', () => setTimeout(fit, 120));
if (window.visualViewport) visualViewport.addEventListener('resize', fit);
if (window.ResizeObserver) new ResizeObserver(fit).observe(canvas);
let fitT = 0;
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);

// ---------- the loop ----------

let lastT = performance.now();
function frame(t) {
  requestAnimationFrame(frame);
  const real = (t - lastT) / 1000, dt = Math.min(0.1, real);
  lastT = t;
  if (playing) {
    watchQuality(real);
    // The rules run every frame, so everything on the mountain moves every frame.
    for (let left = dt, n = 0; left > 1e-4 && n < 4; n++) { const step = Math.min(0.05, left); idle.tick(state, ter, step); left -= step; }
    drain();
    views.lifts.update(state);
    views.guests.update(state, ter, dt, idle.speedOf(state));
    views.cars.update(state, ter);
    views.cash.update(state, ter, dt);
    views.buildings.update();
    if (follow) { const g = idle.celebGuest(state); if (g) { cam.goal.x = g.x; cam.goal.z = g.z + 6; cam.goal.dist = Math.min(cam.goal.dist, 40); } else follow = 0; }
    ui.update(state, dt);
    popT += dt; if (popT >= 1) { popT = 0; pops(); }
    saveT += dt; if (saveT >= 10) { saveT = 0; save(); }
  } else {
    cam.rotate(dt * 0.04); // slow turn behind the start screen
    views.lifts.update(state || demo);
    if (!state) { idle.tick(demo, dter, Math.min(0.05, dt)); demo.events.length = 0; views.guests.update(demo, dter, dt, 1); views.cars.update(demo, dter); }
  }
  fitT += dt; if (fitT > 0.5) { fitT = 0; fit(); outlineAll(stage.scene); }
  views.deco.update(dt);
  cam.update(dt);
  stage.update(dt, playing ? idle.clockOf(state) : 640, cam.target);
  if (playing) { updateTags(); updateStar(); updateBubbles(); }
  else for (const el of bubbles.values()) el.hidden = true;
  stage.render();
  setAmbience(Math.min(1, cam.now.dist / 150), playing && state.weather === 'snow' ? 0.3 : 0, playing ? state.guests.length : 0, !playing);
}

// The start screen shows the first mountain turning slowly in the background.
let demo = null, dter = null;
{
  demo = idle.newGame(0);
  demo.open = T.LIFT_COUNT;
  dter = idle.attach(demo);
  stage.setTerrain(dter, () => 45);
  cam.setTerrain(dter);
  views.buildings.buildVillage(dter);
  views.lifts.sync(demo, dter); views.pistes.sync(demo, dter); views.extras.sync(demo, dter); views.cars.sync(demo, dter); views.deco.sync(demo, dter);
  stage.updateTrees(); stage.repaint();
  cam.view(48, 52, 128, 0.5, 0.62, true);
}
stage.resize();
box = canvas.getBoundingClientRect();
applySettings();
ui.showMenu(store.get('idle', null));
addEventListener('pointerdown', initAudio, { once: true });
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// For testing from the console.
window.__fc = { get state() { return state; }, get ter() { return ter; }, idle, cam, ui, stage, views, project, start, save, T, MAPS, quality, watchQuality, settings, applySettings };
