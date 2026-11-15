// First Chair: boot, the game loop, saving, picking things on the mountain and wiring the parts together.
import { createScene, THREE } from './view/scene.js';
import { createCamera } from './view/camera.js';
import { createLiftView } from './view/lifts.js';
import { createPisteView } from './view/pistes.js';
import { createBuildingView } from './view/buildings.js';
import { createGuestView } from './view/guests.js';
import { T, WEATHER, LIFTS, BUILDINGS } from './tuning.js';
import { MAPS } from './maps.js';
import * as sim from './sim.js';
import { toSave, fromSave } from './save.js';
import { snowDepth } from './economy.js';
import { nearestOnPiste } from './network.js';
import { createUI, money, ICON } from './ui.js';
import { createBuilder } from './build.js';
import { initAudio, setVolume, setAmbience, sfx } from './audio.js';

const isTouch = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
const store = {
  get(k, d) { try { const v = localStorage.getItem('firstchair.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('firstchair.' + k, JSON.stringify(v)); } catch { /* private mode or full */ } },
};
const profile = Object.assign({ stars: 1, settings: {} }, store.get('profile', {}));
profile.settings = Object.assign({ volume: 0.7, shadows: true, autoNext: false }, profile.settings);
const settings = profile.settings;

const canvas = document.getElementById('game');
const stage = createScene(canvas, { touch: isTouch, treeShadows: !isTouch });
const cam = createCamera(stage.camera, canvas, { onTap: tap, onHover: (x, y) => { pendingHover = [x, y]; } });
const views = { lifts: createLiftView(stage.scene), pistes: createPisteView(stage.scene), buildings: createBuildingView(stage.scene), guests: createGuestView(stage.scene) };

let state = null, ter = null, playing = false, speed = 1, lastSpeed = 1, acc = 0, selected = null, pendingHover = null, autoTimer = 0;

// A bouncing arrow over whatever is selected.
const marker = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0xffc247, depthTest: false, transparent: true }));
marker.rotation.x = Math.PI; marker.renderOrder = 30; marker.visible = false;
stage.scene.add(marker);

const ui = createUI({
  click: () => { initAudio(); sfx.click(); },
  buzz: () => sfx.buzz(),
  tool: (t) => { select(null); builder.setTool(t); },
  cancel: () => builder.cancel(),
  undo: () => builder.undo(),
  confirm: () => builder.confirm(),
  overlay: (o) => stage.setOverlay(o),
  speed: setSpeed,
  select,
  toggleLift: (id) => { sim.toggleLift(state, ter, id); save(); },
  remove: (kind, item) => { builder.setTool({ kind: 'remove' }); builder.tap(null, { kind, item }); },
  loan: (d) => { if (sim.setLoan(state, d)) sfx.cash(); else sfx.buzz(); save(); },
  nextDay,
  lookAround: () => builder.redraw(),
  sheet: () => {},
  quit,
  start,
  settings: () => settings,
  applySettings,
  jacket: (i) => views.guests.color(i),
});

const builder = createBuilder({
  scene: stage.scene, ui, views, sfx,
  state: () => state, ter: () => ter,
  changed: () => { save(); },
  // With no tool in hand, the bar offers the next day once the day is over.
  idle: () => (playing && state.phase === 'summary' && !ui.sheetOpen
    ? { html: '<b>The day is over.</b><small>Build in peace, then start the next day.</small>', ok: true, label: 'Next day', noCancel: true } : null),
  idleConfirm: () => { if (playing && state.phase === 'summary') { sfx.click(); nextDay(); } },
});

function applySettings() {
  setVolume(settings.volume);
  stage.setShadows(settings.shadows);
  store.set('profile', profile);
}

// ---------- starting, saving, leaving ----------

function saveList() {
  const out = {};
  for (const m of MAPS) { const s = store.get('save.' + m.id, null); if (s && s.v === 1) out[m.id] = { day: s.day, rating: s.rating, sandbox: s.sandbox }; }
  return out;
}

function save() {
  if (!playing || !state) return;
  store.set('save.' + state.mapId, toSave(state));
  if (!state.sandbox && state.best.stars > profile.stars) { profile.stars = state.best.stars; store.set('profile', profile); }
}

function setWorld() {
  stage.setTerrain(ter, (x, z) => snowDepth(state, ter, x, z));
  cam.setTerrain(ter);
  for (const v of Object.values(views)) v.clear();
  views.buildings.buildVillage(ter);
  syncViews();
  stage.setWeather(state.weather);
}
function syncViews() {
  views.lifts.sync(state, ter); views.pistes.sync(state, ter); views.buildings.sync(state, ter);
  if (selected && selected.kind !== 'guest' && selected.kind !== 'base') {
    const list = selected.kind === 'lift' ? state.lifts : selected.kind === 'piste' ? state.pistes : state.buildings;
    if (!list.includes(selected.item)) select(null);
  }
}

function start(mapId, fresh, sandbox) {
  initAudio();
  let s = fresh ? null : fromSave(store.get('save.' + mapId, null));
  const isNew = !s;
  if (!s) s = sim.newState(mapId, sandbox);
  state = s;
  ter = sim.attach(state);
  if (isNew) sim.startDay(state, ter, true);
  playing = true; acc = 0; selected = null; marker.visible = false;
  setWorld();
  builder.setTool(null);
  ui.hideMenu();
  ui.update(state);
  setSpeed(1);
  const tall = innerHeight > innerWidth;
  cam.view(ter.base.x, ter.base.z - (tall ? 15 : 17), tall ? 92 : 74, 0, tall ? 0.95 : 0.86, true);
  save();
  if (state.phase === 'summary') ui.showSummary();
  else if (isNew && !state.sandbox && mapId === 'sunny') ui.toast('Welcome! Follow the <b>goal</b> at the top left to get started.', 'star', 6000);
}

function quit() {
  save();
  playing = false;
  clearTimeout(autoTimer);
  builder.setTool(null);
  select(null);
  ui.showMenu(profile, saveList());
  document.getElementById('labels').innerHTML = '';
  tags.clear();
}

function nextDay() {
  if (!playing || state.phase !== 'summary') return;
  clearTimeout(autoTimer);
  sim.startDay(state, ter);
  save();
  builder.redraw();
}

function setSpeed(s) {
  if (s !== 0) lastSpeed = s;
  speed = s;
  ui.setSpeed(s);
}

// ---------- events from the simulation ----------

function drain() {
  if (!state.events.length) return;
  let net = false, trees = false;
  for (const e of state.events.splice(0)) {
    if (e.type === 'net') net = true;
    else if (e.type === 'trees') trees = true;
    else if (e.type === 'toast') ui.toast(e.text, e.bad ? 'bad' : '');
    else if (e.type === 'goal') {
      sfx.goal();
      const un = e.goal.unlock ? '<br>Unlocked: ' + e.goal.unlock.map((k) => (LIFTS[k] || BUILDINGS[k]).name).join(', ') : '';
      ui.toast(`<b>Goal reached:</b> ${e.goal.text}${state.sandbox ? '' : ` · +${money(e.goal.reward)}`}${un}`, 'star', 5200);
    } else if (e.type === 'closing') ui.toast('The lifts are closing. Everyone heads home.');
    else if (e.type === 'season') ui.toast(`<b>Season ${e.season}</b> begins. Fresh snow, fresh start.`, 'star', 5000);
    else if (e.type === 'dayStart') {
      stage.setWeather(state.weather);
      stage.repaint();
      sfx.morning();
      if (state.day > 1) ui.toast(`${ICON[state.weather]} ${sim.DAYS[(state.day - 1) % 7]}, day ${state.day}: ${WEATHER[state.weather].name.toLowerCase()}`, '', 2600);
    } else if (e.type === 'dayEnd') {
      sfx.day();
      save();
      if (settings.autoNext) {
        const s = state.last;
        ui.toast(`Day ${s.day}: ${s.guests} guests, profit <b>${money(s.profit)}</b>`, s.profit >= 0 ? 'good' : 'bad', 3200);
        autoTimer = setTimeout(nextDay, 2200);
      } else ui.showSummary();
      builder.redraw();
    }
  }
  if (net) { syncViews(); if (builder.tool) builder.redraw(); }
  if (trees) stage.updateTrees();
}

// ---------- picking ----------

const v3 = new THREE.Vector3();
function project(x, y, z) {
  v3.set(x, y, z).project(stage.camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + (v3.x + 1) / 2 * r.width, y: r.top + (1 - v3.y) / 2 * r.height, front: v3.z < 1 };
}

function pick(p, cx, cy) {
  let best = null, bd = isTouch ? 34 : 24;
  for (const g of state.guests) {
    if (!g.shown || g.vx === undefined) continue;
    const s = project(g.vx, g.vy + 0.5, g.vz);
    const d = Math.hypot(s.x - cx, s.y - cy);
    if (s.front && d < bd) { bd = d; best = g; }
  }
  if (best) return { kind: 'guest', item: best };
  if (!p) return null;
  const near = (o, r) => Math.hypot(o.x - p.x, o.z - p.z) < r;
  for (const b of state.buildings) if (near(b, b.type === 'cannon' ? 1.1 : 1.9)) return { kind: 'building', item: b };
  for (const l of state.lifts) if (near(l.a, 2) || near(l.b, 2)) return { kind: 'lift', item: l };
  if (near(ter.base, 4.5)) return { kind: 'base', item: ter.base };
  for (const l of state.lifts) {
    const ax = l.a.x, az = l.a.z, bx = l.b.x - ax, bz = l.b.z - az;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * bx + (p.z - az) * bz) / (bx * bx + bz * bz)));
    if (Math.hypot(p.x - ax - bx * t, p.z - az - bz * t) < 0.9) return { kind: 'lift', item: l };
  }
  let bp = null, bpd = 1.6;
  for (const q of state.pistes) { const n = nearestOnPiste(q, p.x, p.z); if (n.d < bpd) { bpd = n.d; bp = q; } }
  return bp ? { kind: 'piste', item: bp } : null;
}

function select(sel) {
  selected = sel;
  marker.visible = !!sel;
  if (ui.card !== sel) ui.showCard(sel);
}

function tap(cx, cy) {
  initAudio();
  if (!playing) return;
  ui.closeSub();
  const p = cam.pickGround(cx, cy);
  const picked = pick(p, cx, cy);
  if (builder.tool) builder.tap(p, picked);
  else { if (picked) sfx.tick(); select(picked); }
}

// ---------- labels over the lifts ----------

const tags = new Map(), labels = document.getElementById('labels');
function updateTags() {
  for (const [id, el] of tags) if (!state.liftById[id]) { el.remove(); tags.delete(id); }
  for (const l of state.lifts) {
    const n = l.queue.length, shut = l.storm ? 'Storm' : !l.open ? 'Closed' : '';
    let el = tags.get(l.id);
    if (!shut && n < 4) { if (el) el.hidden = true; continue; }
    if (!el) { el = document.createElement('div'); tags.set(l.id, el); labels.appendChild(el); }
    const s = project(l.a.x, l.pts[0].g + 3.2, l.a.z);
    el.hidden = !s.front;
    const text = shut || n + ' waiting', cls = 'tag ' + (shut ? 'off' : n >= 30 ? 'bad' : n >= 14 ? 'warn' : '');
    if (el.textContent !== text) el.textContent = text;
    if (el.className !== cls) el.className = cls;
    el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%)`;
  }
}

function updateMarker(t) {
  if (!selected) return;
  const it = selected.item, bob = Math.sin(t * 0.005) * 0.25;
  let x, y, z;
  if (selected.kind === 'guest') {
    if (it.st === 'gone' || it.vx === undefined) { select(null); return; }
    x = it.vx; y = it.vy + 1.9; z = it.vz;
    marker.visible = it.shown !== false;
  } else if (selected.kind === 'lift') { x = it.a.x; z = it.a.z; y = it.pts[0].g + 4.2; }
  else if (selected.kind === 'piste') { const m = it.pts[it.pts.length >> 1]; x = m.x; z = m.z; y = m.y + 2; }
  else { x = it.x; z = it.z; y = ter.height(x, z) + (selected.kind === 'base' ? 3.6 : 3.4); }
  marker.position.set(x, y + bob, z);
  marker.rotation.y = t * 0.002;
}

// ---------- keys ----------

addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea') || !playing) return;
  if (e.code === 'Space') { e.preventDefault(); setSpeed(speed === 0 ? lastSpeed : 0); }
  else if (e.code === 'Digit1') setSpeed(1);
  else if (e.code === 'Digit2') setSpeed(2);
  else if (e.code === 'Digit3' || e.code === 'Digit4') setSpeed(4);
  else if (e.code === 'Escape') {
    if (ui.sheetOpen) ui.closeSheet();
    else if (builder.tool) builder.cancel();
    else { ui.closeSub(); select(null); }
  } else if (e.code === 'Enter') builder.confirm();
  else if (e.code === 'Backspace' && builder.tool) builder.undo();
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
  const paused = speed === 0 || ui.sheetOpen;
  if (playing) {
    if (state.phase === 'day' && !paused) {
      acc += dt * speed;
      let n = 0;
      while (acc >= T.STEP && n++ < 60 && state.phase === 'day') { sim.tick(state, ter, T.STEP); acc -= T.STEP; }
      if (acc > T.STEP * 4) acc = 0;
    }
    drain();
    if (pendingHover) { if (builder.tool) builder.hover(cam.pickGround(pendingHover[0], pendingHover[1])); pendingHover = null; }
    views.lifts.update(state);
    views.guests.update(state, ter, dt, paused ? 1 : speed);
    ui.update(state);
  } else {
    cam.rotate(dt * 0.04); // slow turn behind the menu
  }
  cam.update(dt);
  stage.update(dt, playing ? state.clock : 640, cam.target);
  if (playing) { updateTags(); updateMarker(t); }
  stage.render();
  setAmbience(Math.min(1, cam.now.dist / 150), playing && state.weather === 'storm' ? 1 : playing && state.weather === 'snow' ? 0.3 : 0, playing ? state.guests.length : 0, !playing || paused);
}

// The menu shows the first mountain turning slowly in the background.
{
  const demo = sim.newState('sunny');
  const dter = sim.attach(demo);
  stage.setTerrain(dter, () => 40);
  cam.setTerrain(dter);
  views.buildings.buildVillage(dter);
  cam.view(48, 52, 128, 0.5, 0.62, true);
}
stage.resize();
applySettings();
ui.showMenu(profile, saveList());
addEventListener('pointerdown', initAudio, { once: true });
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// For testing from the console.
window.__fc = { get state() { return state; }, get ter() { return ter; }, sim, cam, builder, ui, stage, views, project, pick, start, save, setSpeed, T };
