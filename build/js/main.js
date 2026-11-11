// High Ground: boot, the loop, the three modes (gun, build, edit) and the screens.

import * as THREE from '../../game/vendor/three.module.min.js';
import { T } from './tuning.js';
import { Pieces } from './pieces.js';
import { World } from './collide.js';
import { Player } from './player.js';
import { Builder } from './build.js';
import { Editor } from './edit.js';
import { Arsenal, GUNS } from './weapons.js';
import { Targets } from './targets.js';
import { buildArena, startLayout, SPAWN } from './arena.js';
import { Hud } from './hud.js';
import { settings, initSettingsUI, lookSpeed } from './settings.js';
import * as input from './input.js';
import { initAudio, setVolume, sfx } from './audio.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.08, 400);

buildArena(scene);
const pieces = new Pieces(scene);
const world = new World(pieces);
const player = new Player(scene, camera, world);
const builder = new Builder(scene, pieces, world, player);
const editor = new Editor(scene, pieces, world, player);
const hud = new Hud(camera, world);
const arsenal = new Arsenal(scene, world, pieces, player, hud);
const targets = new Targets(scene, world, pieces);

const game = { state: 'menu', mode: 'gun', before: 'gun' };   // state: menu | playing | paused
const BUILD = { wall: 'wall', floor: 'floor', ramp: 'ramp', roof: 'roof' };

pieces.onBreak = (p, cause) => {
  if (cause === 'collapse') sfx.collapse(); else sfx.breakPiece();
  targets.onBreak(p);
};
arsenal.onDummyHit = (d, amount, head, dead) => { if (dead) targets.downs++; };

function resetArena(quiet) {
  editor.close();
  if (game.mode === 'edit') setMode(game.before);
  pieces.clear();
  startLayout(pieces);
  targets.reset();
  player.spawn(SPAWN.x, SPAWN.y, SPAWN.z, SPAWN.yaw);
  arsenal.refill();
  builder.placed = 0;
  hud.clear();
  if (!quiet) { sfx.reset(); hud.toast('Arena reset'); }
}

// ---------- modes ----------
function setMode(mode) {
  const was = game.mode;
  game.mode = mode;
  if (mode !== 'build') builder.hide();
  if (mode === 'gun') {
    if (was !== 'gun') arsenal.raise();
    player.setTool(arsenal.gun.id);
    hud.mode('gun', 'gun' + (arsenal.current + 1));
  } else {
    arsenal.trigger(false);
    player.setTool('plan');
    if (mode === 'build') hud.mode('build', builder.kind);
    else hud.mode('edit', null);
  }
}

function pickGun(n) {
  if (game.mode === 'edit') editor.close();
  arsenal.select(n);
  setMode('gun');
}

function pickPiece(kind) {
  if (game.mode === 'edit') editor.close();
  builder.kind = kind;
  setMode('build');
  builder.aim();
  // Switching piece with the button still held keeps building.
  if (input.down('fire')) builder.place();
}

function editKey() {
  if (game.mode === 'edit') {
    if (editor.confirm()) setMode(game.before);
    return;
  }
  if (editor.start() === 'edit') {
    game.before = game.mode;
    setMode('edit');
  }
}

input.handlers.press = (id) => {
  if (game.state !== 'playing') return;
  if (BUILD[id]) return pickPiece(id);
  switch (id) {
    case 'jump': player.pressJump(); break;
    case 'fire':
      if (game.mode === 'gun') arsenal.trigger(true);
      else if (game.mode === 'build') builder.place();
      else editor.press();
      break;
    case 'gun1': pickGun(0); break;
    case 'gun2': pickGun(1); break;
    case 'gun3': pickGun(2); break;
    case 'edit': editKey(); break;
    case 'editReset': if (game.mode === 'edit') editor.reset(); break;
    case 'reload': if (game.mode === 'gun') arsenal.reload(); break;
    case 'resetArena': resetArena(); break;
  }
};
input.handlers.release = (id) => {
  if (id === 'fire') arsenal.trigger(false);
  // Edit on release: letting go of select or reset confirms the edit.
  if ((id === 'fire' || id === 'editReset') && game.state === 'playing' && game.mode === 'edit' && settings.editRelease && editor.changed) {
    if (editor.confirm()) setMode(game.before);
  }
};

// ---------- screens ----------
function show(id) {
  for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== id;
  document.getElementById('hud').hidden = game.state !== 'playing';
}

function applySettings() {
  setVolume(settings.volume);
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
  hud.keys();
  hud.cache.gap = -1;
  document.getElementById('hints').hidden = !settings.hints;
}
const settingsUI = initSettingsUI(document.getElementById('setBody'), applySettings);
applySettings();
let settingsFrom = 'menu';
for (const btn of document.querySelectorAll('.openSettings')) {
  btn.addEventListener('click', () => { settingsFrom = btn.closest('.screen').id; show('settings'); sfx.ui(); });
}
document.getElementById('setBack').addEventListener('click', () => { show(settingsFrom); sfx.ui(); });

let hadLock = false, locked = false, skipMoves = 0, lockRefused = false;
// Raw mouse input skips the system's pointer acceleration. Older browsers fall back to a normal lock.
function lock() {
  try {
    const p = canvas.requestPointerLock?.({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => { try { canvas.requestPointerLock()?.catch?.(() => {}); } catch { /* not allowed */ } });
  } catch { /* headless or unsupported: play without mouse lock */ }
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) { hadLock = true; lockRefused = false; skipMoves = 2; return; }
  if (hadLock && game.state === 'playing') pause();
});
document.addEventListener('pointerlockerror', () => { lockRefused = true; });

function start() {
  initAudio();
  document.activeElement?.blur?.();
  if (game.state === 'menu') resetArena(true);
  game.state = 'playing';
  input.releaseAll();
  setMode(game.mode === 'edit' ? game.before : game.mode);
  show(null);
  lock();
  last = performance.now();
  acc = 0;
}

function pause() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  if (document.pointerLockElement) document.exitPointerLock();
  input.releaseAll();
  arsenal.trigger(false);
  show('paused');
}

function toMenu() {
  game.state = 'menu';
  editor.close();
  show('menu');
}

document.getElementById('play').addEventListener('click', start);
document.getElementById('resume').addEventListener('click', start);
document.getElementById('restart').addEventListener('click', () => { resetArena(true); start(); });
document.getElementById('quit').addEventListener('click', toMenu);

// ---------- input events ----------
addEventListener('keydown', (e) => {
  if (settingsUI.isListening()) return;
  if (e.code === 'Escape') {
    // With the mouse locked the browser handles Esc itself and we pause when the lock ends.
    if (game.state === 'playing' && document.pointerLockElement !== canvas) pause();
    else if (game.state === 'paused' && !document.getElementById('paused').hidden && !e.repeat) start();
    return;
  }
  if (game.state !== 'playing') return;
  if (input.press(e.code, e.repeat) || e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => { input.release(e.code); });
canvas.addEventListener('mousedown', (e) => {
  if (game.state !== 'playing') return;
  e.preventDefault();
  if (document.pointerLockElement !== canvas) { lock(); if (!lockRefused && hadLock) return; }
  input.press('Mouse' + e.button);
});
addEventListener('mouseup', (e) => {
  if (game.state === 'playing' && e.button > 2) e.preventDefault();   // side buttons would go back a page
  input.release('Mouse' + e.button);
});
addEventListener('mousemove', (e) => {
  if (game.state !== 'playing') return;
  // Only once the lock is confirmed: a move that arrives just before can carry the whole cursor jump.
  if (!locked && !game.freeLook) return;
  // The first events after locking can jump too, and some browsers send odd spikes.
  if (skipMoves > 0) { skipMoves--; return; }
  const dx = e.movementX, dy = e.movementY;
  if (Math.abs(dx) > 800 || Math.abs(dy) > 800) return;
  player.look(dx, dy, lookSpeed(game.mode));
});
addEventListener('wheel', (e) => {
  if (game.state !== 'playing' || settingsUI.isListening()) return;
  input.tap(e.deltaY < 0 ? 'WheelUp' : 'WheelDown');
}, { passive: true });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('auxclick', (e) => { if (game.state === 'playing') e.preventDefault(); });
addEventListener('blur', () => { input.releaseAll(); arsenal.trigger(false); if (game.state === 'playing' && hadLock) pause(); });
addEventListener('beforeunload', (e) => {
  if (game.state === 'menu') return;
  e.preventDefault();
  e.returnValue = '';
});

// ---------- loop ----------
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  hud.cache.gap = -1;
}
addEventListener('resize', resize);
resize();

const STEP = 1 / 120;
let last = performance.now(), acc = 0;

const TIPS = {
  build: () => `${input.label('fire')} place · hold to keep building`,
  edit: () => (settings.editRelease
    ? `Hold ${input.label('fire')} and drag over tiles · let go to confirm · ${input.label('editReset')} reset`
    : `${input.label('fire')} mark tiles · ${input.label('edit')} confirm · ${input.label('editReset')} reset`),
};

function tick(dt) {
  if (game.state === 'playing') {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n++ < 24) { player.step(STEP); acc -= STEP; }
    if (acc >= STEP) acc = 0;
    player.view(acc / STEP, dt);
    camera.updateMatrixWorld();   // the HUD projects with this frame's camera, not the last one

    if (game.mode === 'build') {
      builder.aim();
      builder.hold(dt, input.down('fire'));
    } else if (game.mode === 'edit') {
      if (!editor.update(input.down('fire'))) setMode(game.before);
    }
    arsenal.update(dt, game.mode === 'gun');
    targets.update(dt);
    pieces.update(dt);

    const gun = game.mode === 'gun' ? arsenal.gun : null;
    hud.ammo(gun, arsenal.ammo[arsenal.current], arsenal.reloading, arsenal.reloadLeft);
    if (gun) hud.spread(arsenal.spread);
    hud.tipText(TIPS[game.mode] ? TIPS[game.mode]() : '');
    hud.stats(`Dummies down ${targets.downs} · Pieces placed ${builder.placed}`);
    hud.update(dt, targets.list);
  } else if (game.state === 'menu') {
    // a slow look around the room behind the menu
    const t = performance.now() / 9000;
    camera.position.set(14 + Math.cos(t) * 19, 9, 14 + Math.sin(t) * 19);
    camera.lookAt(14, 1.5, 14);
    pieces.update(dt);
  }
  if (!game.noRender) renderer.render(scene, camera);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (game.manual) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tick(dt);
}

// The menu shows the start layout too.
resetArena(true);
player.model.root.visible = false;
setMode('gun');
show('menu');
if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) {
  document.getElementById('touchNote').hidden = false;
}
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// For testing from the console: __game.manual = true stops the clock, tick(dt) moves it by hand.
window.__game = Object.assign(game, {
  T, GUNS, settings, input, pieces, world, player, builder, editor, arsenal, targets, hud, camera,
  manual: false, noRender: false, freeLook: false, tick, start, pause, resetArena, setMode, pickGun, pickPiece, editKey,
});
