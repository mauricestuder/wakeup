// Cash Out: boot, input, game loop and game state.
import * as THREE from '../vendor/three.module.min.js';
import { initAudio, setVolume, sfx } from './audio.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Arsenal, weaponName } from './weapons.js';
import { Enemies } from './enemies.js';
import { Items } from './items.js';
import { Hud } from './hud.js';
import { PS1Pass } from './ps1.js';
import { isTouch, initTouch } from './touch.js';
import { settings, initSettingsUI } from './settings.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020203);
scene.fog = new THREE.Fog(0x020203, 3, 20);
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
scene.add(camera);

// Separate scene for the gun in your hands.
const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(65, 1, 0.01, 10);
vmScene.add(vmCamera);
vmScene.add(new THREE.HemisphereLight(0xffffff, 0x444433, 1.4));
const vmSun = new THREE.DirectionalLight(0xfff2d0, 1.2);
vmSun.position.set(1, 2, 1);
vmScene.add(vmSun);

const game = {
  scene, camera, vmScene, vmCamera, renderer, settings,
  aiming: false,
  state: {
    mode: 'menu', cash: 500, round: 0, kills: 0, headshots: 0, earned: 0,
    grenades: 2, doubleT: 0, instaT: 0, saleT: 0, perks: new Set(), bestCombo: 0,
  },
};
window.__game = game; // handy for debugging in the console
const ps1 = new PS1Pass(renderer);

game.hud = new Hud();
game.world = buildWorld(scene);
game.player = new Player(game);
game.arsenal = new Arsenal(game);
game.enemies = new Enemies(game);
game.items = new Items(game);
game.items.buildBuyables();
game.arsenal.give('penny');
game.player.update(0, {});

game.addCash = (base, worldPos, quiet) => {
  const s = game.state;
  const amount = base * (s.perks.has('interest') ? 1.5 : 1) * (s.doubleT > 0 ? 2 : 1);
  s.cash += amount;
  s.earned += amount;
  game.hud.setCash(s.cash);
  if (!quiet || amount >= 20) game.hud.popCash(amount);
  else if (Math.random() < 0.5) game.hud.popCash(amount);
};

// ---------- high scores ----------
const BEST_KEY = 'cashout.best';
function loadBest() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY)) || null; } catch { return null; }
}
function showBest() {
  const b = loadBest();
  const el = document.getElementById('best');
  el.hidden = !b;
  if (b) el.innerHTML = `Best: <b>round ${b.round}</b> · ${b.kills} kills · $${b.earned.toLocaleString('en-US')} earned`;
}
showBest();

game.gameOver = () => {
  const s = game.state;
  s.mode = 'over';
  document.exitPointerLock?.();
  firing(false);
  touch?.reset();
  game.hud.clear();
  const run = { round: s.round, kills: s.kills, earned: Math.floor(s.earned) };
  const best = loadBest();
  const record = !best || run.round > best.round || (run.round === best.round && run.kills > best.kills);
  if (record) { try { localStorage.setItem(BEST_KEY, JSON.stringify(run)); } catch { /* not saved */ } }
  document.getElementById('overStats').innerHTML =
    (record && best ? '<span class="record">NEW RECORD!</span><br>' : '') +
    `You survived <b>${s.round}</b> round${s.round === 1 ? '' : 's'}<br>` +
    `Undead put down: <b>${s.kills}</b> (${s.headshots} headshots)<br>` +
    `Best combo: <b>${s.bestCombo}x</b><br>` +
    `Cash earned: <b>$${run.earned.toLocaleString('en-US')}</b>` +
    (!record ? `<br><span class="prev">Your best: round ${best.round}, ${best.kills} kills</span>` : '');
  show('over');
  sfx.roundEnd();
};

// ---------- screens ----------
function show(id) {
  for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== id;
  document.getElementById('hud').hidden = game.state.mode === 'menu';
}

// Settings open from the menu or the pause screen and go back there.
function applySettings() {
  ps1.configure(settings.quality, settings.effects);
  setVolume(settings.volume);
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
}
initSettingsUI(document.getElementById('setList'), applySettings);
applySettings();
let settingsFrom = 'menu';
for (const btn of document.querySelectorAll('.openSettings')) {
  btn.addEventListener('click', () => { settingsFrom = btn.closest('.screen').id; show('settings'); });
}
document.getElementById('setBack').addEventListener('click', () => show(settingsFrom));

function start() {
  initAudio();
  if (isTouch) {
    // Fullscreen works on Android and iPad; iPhone just ignores it.
    const el = document.documentElement, fs = el.requestFullscreen || el.webkitRequestFullscreen;
    try { fs?.call(el)?.catch?.(() => {}); } catch { /* not allowed here */ }
  } else lock();
  if (game.state.mode === 'menu') {
    game.state.mode = 'playing';
    game.enemies.startRound(1);
  } else if (game.state.mode === 'paused') {
    game.state.mode = 'playing';
  }
  show(null);
}

let hadLock = false;
function lock() {
  try {
    const p = canvas.requestPointerLock?.();
    if (p && p.catch) p.catch(() => {});
  } catch { /* headless or unsupported: play without mouse lock */ }
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { hadLock = true; return; }
  if (hadLock && game.state.mode === 'playing') pause();
});
function pause() {
  game.state.mode = 'paused';
  firing(false);
  touch?.reset();
  game.hud.clear();
  show('paused');
}

document.getElementById('play').addEventListener('click', start);
document.getElementById('resume').addEventListener('click', start);
document.getElementById('again').addEventListener('click', () => location.reload());

// ---------- input ----------
const keys = {};
function firing(down) { game.arsenal.setTrigger(down); }

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (game.state.mode !== 'playing') return;
  if (e.code === 'KeyR') game.arsenal.startReload();
  if (e.code === 'Digit1') game.arsenal.switchTo(0);
  if (e.code === 'Digit2') game.arsenal.switchTo(1);
  if (e.code === 'Digit3') game.arsenal.switchTo(2);
  if (e.code === 'KeyQ') game.arsenal.cycle();
  if (e.code === 'KeyG') game.items.throwGrenade();
  if (e.code === 'KeyE' || e.code === 'KeyF') { const n = game.items.nearest(); if (n) n.it.use(); }
  if (e.code === 'KeyP') pause();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; firing(false); });

canvas.addEventListener('mousedown', (e) => {
  if (game.state.mode !== 'playing') return;
  if (!document.pointerLockElement) lock();
  if (e.button === 0) firing(true);
  if (e.button === 2) game.aiming = true;
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) firing(false);
  if (e.button === 2) game.aiming = false;
});
addEventListener('mousemove', (e) => {
  if (game.state.mode === 'playing' && document.pointerLockElement === canvas) game.player.look(e.movementX, e.movementY);
});
addEventListener('wheel', () => { if (game.state.mode === 'playing') game.arsenal.cycle(); });
addEventListener('contextmenu', (e) => e.preventDefault());
const touch = isTouch ? initTouch(game, { keys, firing, pause }) : null;

// ---------- loop ----------
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  ps1.setSize(w, h);
  camera.aspect = vmCamera.aspect = w / h;
  camera.updateProjectionMatrix();
  vmCamera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let last = performance.now();
let monitorT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  ps1.render(scene, camera, vmScene, vmCamera);
}

function step(dt) {
  const { state, hud, arsenal, player } = game;
  game.world.update(dt);
  if (state.mode !== 'playing') return;

  player.update(dt, keys);
  arsenal.update(dt);
  game.enemies.update(dt);
  game.enemies.updateRounds(dt);
  game.items.update(dt);

  const fov = settings.fov;
  const targetFov = game.aiming ? fov - 20 : player.sprinting ? fov + 7 : fov;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
    camera.updateProjectionMatrix();
  }

  // Flicker a random trading monitor now and then.
  monitorT -= dt;
  if (monitorT <= 0) {
    monitorT = 0.15;
    const m = game.world.monitors[Math.floor(Math.random() * game.world.monitors.length)];
    m.visible = Math.random() > 0.08;
  }

  const w = arsenal.weapon;
  hud.setCash(state.cash);
  hud.setAmmo(weaponName(w), w.mag, w.reserve, w.gold, arsenal.reloadT > 0);
  hud.setGrenades(state.grenades);
  hud.setHealth(player.hp / player.maxHp);
  hud.setPowerups(state);
  hud.setLeft(game.enemies.breakT > 0 ? 0 : game.enemies.aliveCount());
  const near = game.items.nearest();
  hud.prompt(near ? (isTouch ? near.text.replace('Press E', 'Tap USE') : near.text) : '');
  hud.update(dt);
}

show('menu');
requestAnimationFrame(frame);
