// The ending: open all 10 rooms, pay to start the armored truck in the garage,
// hold out while the loading dock shutter rolls up, then drive off with the cash.
import * as THREE from '../vendor/three.module.min.js';
import { AREAS } from './world.js';
import { sfx } from './audio.js';

const COST = 10000;
const HOLD = 60; // seconds the shutter takes to open
const DRIVE = 3.4; // length of the drive-off scene

// Night street seen through the open loading dock.
function outsideTex() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, 40);
  sky.addColorStop(0, '#04050c'); sky.addColorStop(1, '#1c2238');
  x.fillStyle = sky; x.fillRect(0, 0, 128, 40);
  for (let i = 0; i < 25; i++) { x.fillStyle = `rgba(255,255,230,${0.3 + Math.random() * 0.6})`; x.fillRect(Math.random() * 128, Math.random() * 26, 1, 1); }
  x.fillStyle = '#0b0c10';
  for (let i = 0; i < 9; i++) { const w = 8 + Math.random() * 10, h = 8 + Math.random() * 18; x.fillRect(i * 14 + Math.random() * 4, 40 - h, w, h); }
  x.fillStyle = '#e8c25a';
  for (let i = 0; i < 18; i++) x.fillRect(Math.random() * 128, 22 + Math.random() * 16, 1, 1);
  x.fillStyle = '#16171b'; x.fillRect(0, 40, 128, 24);
  x.fillStyle = '#c9a227';
  for (let i = 0; i < 8; i++) x.fillRect(i * 17 + 3, 51, 8, 1);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Escape {
  constructor(game, { begin, win }) {
    this.game = game;
    this.begin = begin;
    this.win = win;
    this.phase = 'locked'; // locked -> holding -> ready -> driving
    this.t = 0;
    const w = game.world;
    this.outside = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.2), new THREE.MeshBasicMaterial({ map: outsideTex() }));
    // Just in front of the wall face, behind the shutter.
    this.outside.position.set(0, 2.1, 27.69); this.outside.rotation.y = Math.PI;
    this.outside.visible = false;
    game.scene.add(this.outside);
    this.timerEl = document.getElementById('escapeT');
    game.items.addInteractable(-3.0, 19.5, 2.6, () => this.prompt(), () => this.use());
  }

  roomsOpen() { return Object.keys(AREAS).filter(k => this.game.world.isUnlocked(k)).length; }

  prompt() {
    const total = Object.keys(AREAS).length, n = this.roomsOpen();
    if (this.phase === 'locked') {
      return n < total ? `Armored truck: open all ${total} rooms to escape (${n} / ${total})`
        : `Press E to start the truck and open the loading dock [$${COST.toLocaleString('en-US')}]`;
    }
    if (this.phase === 'holding') return `The loading dock is opening… hold out ${Math.ceil(HOLD - this.t)}s`;
    if (this.phase === 'ready') return 'Press E to DRIVE OFF';
    return null;
  }

  use() {
    const { game } = this, state = game.state;
    if (this.phase === 'locked') {
      if (this.roomsOpen() < Object.keys(AREAS).length) { sfx.denied(); return; }
      if (state.cash < COST) { sfx.denied(); game.hud.toast('Not enough cash'); return; }
      state.cash -= COST; sfx.kaching(); game.hud.setCash(state.cash);
      sfx.door();
      this.phase = 'holding'; this.t = 0;
      this.outside.visible = true;
      game.world.dockSign.visible = false;
      game.hud.announce('HOLD OUT', 'The loading dock is opening. Survive 60 seconds!', 4);
    } else if (this.phase === 'ready') {
      this.phase = 'driving'; this.t = 0;
      this.timerEl.hidden = true;
      for (const c of game.world.truckCols) c.active = false;
      sfx.engine();
      this.begin();
    }
  }

  // While playing: the shutter rolls up and the bank throws everything at you.
  update(dt) {
    if (this.phase !== 'holding') return;
    const { game } = this, en = game.enemies;
    this.t += dt;
    game.world.shutterWall.position.y = 2.1 + Math.min(1, this.t / HOLD) * 4.2;
    if (en.breakT > 0) en.breakT = Math.min(en.breakT, 0.01); // no breather during the hold-out
    if (en.toSpawn < 4) en.toSpawn += 4;
    this.timerEl.hidden = false;
    this.timerEl.textContent = `DOCK OPENS IN ${Math.ceil(HOLD - this.t)}`;
    if (this.t >= HOLD) {
      this.phase = 'ready';
      this.timerEl.textContent = 'DOCK OPEN – GET TO THE TRUCK!';
      game.hud.announce('DOCK OPEN', 'Get in the armored truck and drive off!', 4);
      sfx.roundEnd();
    }
  }

  // The drive-off scene: watch the truck roll out of the dock, then fade to black.
  drive(dt) {
    const { game } = this, cam = game.camera, truck = game.world.truck;
    this.t += dt;
    const t = this.t;
    const go = Math.max(0, t - 0.7); // engine starts, then it pulls away
    truck.position.z = 2.2 * go * go;
    truck.position.x = 5 * Math.min(1, truck.position.z / 6);
    truck.rotation.y = 0;
    // From the lobby end of the garage, looking past the truck at the open dock.
    cam.position.set(2, 3, 11.2 + Math.min(2, t * 0.6));
    cam.lookAt((truck.position.x - 5) * 0.5, 1.5, 22 + truck.position.z * 0.5);
    const fade = document.getElementById('fade');
    fade.style.opacity = Math.max(0, Math.min(1, (t - (DRIVE - 1)) / 0.9));
    if (t >= DRIVE) { this.phase = 'done'; this.win(); }
  }
}
