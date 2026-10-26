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
scene.fog = new THREE.Fog(0x020203, 4, 28);
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
  assistSlow: 1, // touch aim assist slows looking while the crosshair is on an enemy
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

// Fullscreen on PC, Android and iPad. iPhone Safari ignores it; there the game runs
// fullscreen when it's added to the home screen (see manifest.webmanifest).
function goFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const el = document.documentElement, fs = el.requestFullscreen || el.webkitRequestFullscreen;
  try { fs?.call(el, { navigationUI: 'hide' })?.catch?.(() => {}); } catch { /* not allowed here, e.g. in a frame */ }
}

function start() {
  initAudio();
  document.activeElement?.blur?.();
  goFullscreen();
  if (!isTouch) lock();
  if (game.state.mode === 'menu') {
    game.state.mode = 'playing';
    game.enemies.startRound(1);
  } else if (game.state.mode === 'paused') {
    game.state.mode = 'playing';
  }
  show(null);
}

let hadLock = false;
let skipMoves = 0;
let lockRefused = false;
// Raw mouse input skips the OS acceleration and Chrome's sudden jumps; older browsers fall back to normal locking.
function lock() {
  try {
    const p = canvas.requestPointerLock?.({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => { try { canvas.requestPointerLock()?.catch?.(() => {}); } catch { /* still not allowed */ } });
  } catch { /* headless or unsupported: play without mouse lock */ }
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { hadLock = true; lockRefused = false; skipMoves = 2; return; }
  if (hadLock && game.state.mode === 'playing') pause();
});
document.addEventListener('pointerlockerror', () => { lockRefused = true; });
function pause() {
  game.state.mode = 'paused';
  if (document.pointerLockElement) document.exitPointerLock();
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

// Keyboard-only play: X / Enter shoot, C / right Shift aim.
const FIRE_KEYS = ['KeyX', 'Enter', 'NumpadEnter'];
const AIM_KEYS = ['KeyC', 'ShiftRight'];
// Some iPad keyboards leave e.code empty, so fall back to the key's name.
const isFire = (e) => FIRE_KEYS.includes(e.code) || e.key === 'Enter' || e.key === 'x' || e.key === 'X';
const isAim = (e) => AIM_KEYS.includes(e.code) || e.key === 'c' || e.key === 'C';

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  const mode = game.state.mode;
  // Enter starts, resumes and restarts, so menus work without a mouse or touch.
  if (mode !== 'playing') {
    const onSettings = !document.getElementById('settings').hidden;
    if (e.key === 'Enter' && !e.repeat && !onSettings) {
      e.preventDefault();
      if (mode === 'over') location.reload(); else start();
    } else if ((e.code === 'KeyP' || e.code === 'Escape') && mode === 'paused' && !onSettings) start();
    return;
  }
  if (isFire(e)) { e.preventDefault(); if (!e.repeat) firing(true); }
  if (isAim(e)) game.aiming = true;
  if (e.code === 'KeyR') game.arsenal.startReload();
  if (e.code === 'Digit1') game.arsenal.switchTo(0);
  if (e.code === 'Digit2') game.arsenal.switchTo(1);
  if (e.code === 'Digit3') game.arsenal.switchTo(2);
  if (e.code === 'Digit4') game.arsenal.switchTo(3);
  if (e.code === 'KeyQ') game.arsenal.cycle();
  if (e.code === 'KeyG') game.items.throwGrenade();
  if (e.code === 'KeyE' || e.code === 'KeyF') { const n = game.items.nearest(); if (n) n.it.use(); }
  if (e.code === 'KeyP' || e.code === 'Escape') pause();
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (isFire(e)) firing(false);
  if (isAim(e)) game.aiming = false;
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; firing(false); });

canvas.addEventListener('mousedown', (e) => {
  if (game.state.mode !== 'playing') return;
  // The click that grabs the mouse shouldn't also fire.
  if (!isTouch && document.pointerLockElement !== canvas) { lock(); if (!lockRefused) return; }
  if (e.button === 0) firing(true);
  if (e.button === 2) game.aiming = true;
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) firing(false);
  if (e.button === 2) game.aiming = false;
});
addEventListener('mousemove', (e) => {
  if (game.state.mode !== 'playing' || document.pointerLockElement !== canvas) return;
  // The first events after locking can carry the whole cursor jump, and some browsers send odd spikes.
  if (skipMoves > 0) { skipMoves--; return; }
  const dx = e.movementX, dy = e.movementY;
  if (Math.abs(dx) > 600 || Math.abs(dy) > 600) return;
  game.player.look(dx, dy);
});
let wheelT = 0;
addEventListener('wheel', () => {
  // One flick of a wheel or trackpad sends many events; switch once per flick.
  const now = performance.now();
  if (game.state.mode === 'playing' && now - wheelT > 250) game.arsenal.cycle();
  wheelT = now;
});
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
let dividendT = 5;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  ps1.render(scene, camera, vmScene, vmCamera);
}

// Touch screens only, and gentle: aiming slows down over an enemy, and while shooting or aiming
// the view drifts toward one that is already close to the crosshair. It never snaps or turns for you.
const assistFwd = new THREE.Vector3(), assistPos = new THREE.Vector3();
function aimAssist(dt) {
  game.assistSlow = 1;
  if (!isTouch || !settings.assist) return;
  camera.getWorldPosition(assistPos);
  assistFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const target = game.enemies.assistTarget(assistPos, assistFwd, 0.16, 26);
  if (!target) return;
  if (target.ang < 0.09) game.assistSlow = 0.55;
  if (!game.aiming && !game.arsenal.triggerHeld && !game.player.moving) return;
  const p = game.player, d = target.dir;
  const wantYaw = Math.atan2(-d.x, -d.z), wantPitch = Math.asin(Math.max(-1, Math.min(1, d.y)));
  let dy = wantYaw - p.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const dp = wantPitch - p.pitch;
  // Close a share of the gap each second, capped so it stays subtle.
  const k = Math.min(1, dt * (game.aiming ? 3 : game.arsenal.triggerHeld ? 2 : 1.5)), cap = 0.5 * dt;
  p.yaw += Math.max(-cap, Math.min(cap, dy * k));
  p.pitch += Math.max(-cap, Math.min(cap, dp * k));
}

function step(dt) {
  const { state, hud, arsenal, player } = game;
  game.world.update(dt);
  if (state.mode !== 'playing') return;

  player.update(dt, keys);
  aimAssist(dt);
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

  // Dividends perk pays out every 5 seconds.
  if (state.perks.has('dividends')) {
    dividendT -= dt;
    if (dividendT <= 0) { dividendT = 5; game.addCash(25); }
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

// iPhone and iPad only go fullscreen as a home screen app, so tell Safari players how.
const iOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
let framed = true;
try { framed = window.top !== window.self; } catch { /* cross-origin frame */ }
document.getElementById('homeTip').hidden = !(iOS && !standalone && !framed);

show('menu');
requestAnimationFrame(frame);
